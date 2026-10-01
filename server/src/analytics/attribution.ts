/**
 * Attribution engine.
 *
 * Attribution means: for each conversion, pick the ad touch that gets credit.
 * Nothing is stored. It's computed at query time by joining `conversions` to
 * `touches`, so switching models re-attributes all historical data instantly
 * and a bug fix never needs a backfill. (At Koah's scale you'd materialize
 * these results incrementally in ClickHouse; see DESIGN.md.)
 *
 * Models:
 *   tab             (the assignment's requirement) The touch that was active in the
 *                   tab where the purchase happened, as reported by the pixel. A tab
 *                   with no touch is "direct", even if the user clicked an ad in
 *                   another tab. If the pixel never reported the purchase (ad
 *                   blocker), we fall back to the user's last touch within 7 days,
 *                   because the server-side event carries no tab context.
 *   last_touch_7d   The user's most recent ad touch in the 7 days before converting,
 *                   in any tab. The industry-standard default ("last non-direct click").
 *   first_touch_30d The user's FIRST ad touch in the 30 days before converting.
 *                   Credits the channel that introduced the customer.
 */
import { config } from "../config.js";

export const MODELS = ["tab", "last_touch_7d", "first_touch_30d"] as const;
export type AttributionModel = (typeof MODELS)[number];

export const MODEL_LABELS: Record<AttributionModel, string> = {
  tab: "Same tab (last touch in the tab)",
  last_touch_7d: `Last touch, ${config.attribution.lastTouchDays}-day window`,
  first_touch_30d: `First touch, ${config.attribution.firstTouchDays}-day window`,
};

/**
 * Returns a SQL CTE body producing one row per conversion in the range, with the
 * credited touch's source/campaign (NULL = direct).
 *
 * Expects params: $1 advertiser_id, $2 range start, $3 range end.
 * `model` comes from the MODELS allow-list, never raw user input, so the
 * interpolated fragments below are constants.
 */
export function attributedConversionsSql(model: AttributionModel): string {
  const last = `${Number(config.attribution.lastTouchDays)} days`;
  const first = `${Number(config.attribution.firstTouchDays)} days`;

  const rule: Record<AttributionModel, { where: string; order: "ASC" | "DESC" }> = {
    tab: {
      where: `(
        t.touch_id = c.touch_id
        OR (NOT ('pixel' = ANY (c.received_via))        -- pixel never saw it (blocked):
            AND t.source IS NOT NULL                    -- fall back to the last ad touch
            AND t.occurred_at > c.occurred_at - interval '${last}')
      )`,
      order: "DESC",
    },
    last_touch_7d: {
      where: `t.source IS NOT NULL AND t.occurred_at > c.occurred_at - interval '${last}'`,
      order: "DESC",
    },
    first_touch_30d: {
      where: `t.source IS NOT NULL AND t.occurred_at > c.occurred_at - interval '${first}'`,
      order: "ASC",
    },
  };
  const { where, order } = rule[model];

  return `
    SELECT c.*, t.touch_id AS credited_touch_id, t.source, t.campaign
    FROM conversions c
    LEFT JOIN LATERAL (
      SELECT t.touch_id, t.source, t.campaign, t.occurred_at
      FROM touches t
      WHERE t.advertiser_id = c.advertiser_id
        AND t.user_id = c.user_id
        AND NOT t.is_bot
        AND t.occurred_at <= c.occurred_at
        AND ${where}
      ORDER BY t.occurred_at ${order}
      LIMIT 1
    ) t ON true
    WHERE c.advertiser_id = $1 AND c.occurred_at >= $2 AND c.occurred_at < $3`;
}

/**
 * "User sessions" per source: unique users who arrived via that platform's ads
 * in the range. Direct = users who viewed a page in a tab with no ad touch.
 * The same person can count under several sources if they came in several ways.
 */
export const VISITS_SQL = `
  SELECT user_id, source, campaign, occurred_at FROM touches
   WHERE advertiser_id = $1 AND occurred_at >= $2 AND occurred_at < $3 AND NOT is_bot
  UNION ALL
  SELECT user_id, NULL, NULL, occurred_at FROM raw_events
   WHERE advertiser_id = $1 AND occurred_at >= $2 AND occurred_at < $3 AND NOT is_bot
     AND via = 'pixel' AND event_name = 'PageView' AND touch_id IS NULL`;
