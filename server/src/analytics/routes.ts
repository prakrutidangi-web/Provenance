import { Router, type Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { AD_SOURCES } from "../domain/sources.js";
import { MODELS, MODEL_LABELS, VISITS_SQL, attributedConversionsSql, type AttributionModel } from "./attribution.js";

export const analyticsRouter = Router();

const FUNNEL_STEPS = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"] as const;

const QuerySchema = z.object({
  model: z.enum(MODELS).default("tab"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  tz: z
    .string()
    .default("UTC")
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "invalid time zone"),
});

interface Range {
  model: AttributionModel;
  from: Date;
  to: Date;
  tz: string;
  advertiserId: string;
}

function parseRange(req: Request): Range {
  const q = QuerySchema.parse(req.query);
  const to = q.to ? new Date(q.to) : new Date(Date.now() + 60_000);
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 30 * 24 * 3600 * 1000);
  return { model: q.model, from, to, tz: q.tz, advertiserId: config.storeAdvertiserId };
}

const params = (r: Range) => [r.advertiserId, r.from, r.to];

analyticsRouter.get("/api/analytics/models", (_req, res) =>
  res.json(MODELS.map((id) => ({ id, label: MODEL_LABELS[id] }))),
);

/** Headline table: per platform sessions, purchasers, conversion rate, orders, revenue. */
analyticsRouter.get("/api/analytics/summary", async (req, res) => {
  const r = parseRange(req);
  const { rows } = await pool.query(
    `WITH sources(source) AS (SELECT unnest($4::text[]) UNION ALL SELECT NULL),
          visits     AS (${VISITS_SQL}),
          attributed AS (${attributedConversionsSql(r.model)}),
          s AS (SELECT source, COUNT(DISTINCT user_id) AS sessions FROM visits GROUP BY source),
          c AS (SELECT source,
                       COUNT(DISTINCT user_id)       AS purchasers,
                       COUNT(*)                      AS orders,
                       COALESCE(SUM(value_cents), 0) AS revenue_cents
                  FROM attributed GROUP BY source)
     SELECT COALESCE(src.source, 'direct')  AS source,
            COALESCE(s.sessions, 0)         AS sessions,
            COALESCE(c.purchasers, 0)       AS purchasers,
            COALESCE(c.orders, 0)           AS orders,
            COALESCE(c.revenue_cents, 0)    AS revenue_cents
       FROM sources src
       LEFT JOIN s ON s.source IS NOT DISTINCT FROM src.source
       LEFT JOIN c ON c.source IS NOT DISTINCT FROM src.source
      ORDER BY src.source IS NULL, src.source`,
    [...params(r), AD_SOURCES],
  );
  res.json({
    model: r.model,
    from: r.from,
    to: r.to,
    rows: rows.map((row) => ({ ...row, conversion_rate: row.sessions > 0 ? row.purchasers / row.sessions : 0 })),
  });
});

/** Same metrics broken down by source + utm_campaign. */
analyticsRouter.get("/api/analytics/campaigns", async (req, res) => {
  const r = parseRange(req);
  const { rows } = await pool.query(
    `WITH visits     AS (${VISITS_SQL}),
          attributed AS (${attributedConversionsSql(r.model)}),
          s AS (SELECT source, campaign, COUNT(DISTINCT user_id) AS sessions
                  FROM visits WHERE source IS NOT NULL GROUP BY 1, 2),
          c AS (SELECT source, campaign, COUNT(DISTINCT user_id) AS purchasers,
                       COALESCE(SUM(value_cents), 0) AS revenue_cents
                  FROM attributed WHERE source IS NOT NULL GROUP BY 1, 2)
     SELECT COALESCE(s.source, c.source) AS source,
            COALESCE(s.campaign, c.campaign, '(none)') AS campaign,
            COALESCE(s.sessions, 0) AS sessions,
            COALESCE(c.purchasers, 0) AS purchasers,
            COALESCE(c.revenue_cents, 0) AS revenue_cents
       FROM s FULL OUTER JOIN c
         ON c.source = s.source AND c.campaign IS NOT DISTINCT FROM s.campaign
      ORDER BY revenue_cents DESC, sessions DESC`,
    params(r),
  );
  res.json(rows.map((row) => ({ ...row, conversion_rate: row.sessions > 0 ? row.purchasers / row.sessions : 0 })));
});

/**
 * Funnel per source: unique users reaching each step, from browser (pixel)
 * events tagged with the tab's touch. Shows WHERE each platform's traffic drops off.
 */
analyticsRouter.get("/api/analytics/funnel", async (req, res) => {
  const r = parseRange(req);
  const { rows } = await pool.query(
    `SELECT COALESCE(t.source, 'direct') AS source, e.event_name AS step, COUNT(DISTINCT e.user_id) AS users
       FROM raw_events e
       LEFT JOIN touches t ON t.touch_id = e.touch_id
      WHERE e.advertiser_id = $1 AND e.occurred_at >= $2 AND e.occurred_at < $3
        AND e.via = 'pixel' AND NOT e.is_bot AND e.event_name = ANY($4::text[])
      GROUP BY 1, 2`,
    [...params(r), FUNNEL_STEPS],
  );
  const bySource = new Map<string, Record<string, number>>();
  for (const s of [...AD_SOURCES, "direct"]) bySource.set(s, Object.fromEntries(FUNNEL_STEPS.map((st) => [st, 0])));
  for (const row of rows) bySource.get(row.source)![row.step] = row.users;
  res.json({
    steps: FUNNEL_STEPS,
    rows: [...bySource].map(([source, counts]) => ({ source, counts: FUNNEL_STEPS.map((s) => counts[s]) })),
  });
});

/** Daily sessions, purchasers and revenue per source, bucketed in the viewer's time zone. */
analyticsRouter.get("/api/analytics/timeseries", async (req, res) => {
  const r = parseRange(req);
  const { rows } = await pool.query(
    `WITH visits     AS (${VISITS_SQL}),
          attributed AS (${attributedConversionsSql(r.model)}),
          days AS (
            SELECT generate_series(date_trunc('day', $2::timestamptz AT TIME ZONE $4),
                                   date_trunc('day', $3::timestamptz AT TIME ZONE $4),
                                   interval '1 day')::date AS day),
          s AS (SELECT (occurred_at AT TIME ZONE $4)::date AS day, COALESCE(source, 'direct') AS source,
                       COUNT(DISTINCT user_id) AS sessions FROM visits GROUP BY 1, 2),
          c AS (SELECT (occurred_at AT TIME ZONE $4)::date AS day, COALESCE(source, 'direct') AS source,
                       COUNT(DISTINCT user_id) AS purchasers,
                       COALESCE(SUM(value_cents), 0) AS revenue_cents FROM attributed GROUP BY 1, 2)
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day, src.source,
            COALESCE(s.sessions, 0) AS sessions, COALESCE(c.purchasers, 0) AS purchasers,
            COALESCE(c.revenue_cents, 0)::int AS revenue_cents
       FROM days d
      CROSS JOIN (SELECT unnest($5::text[]) AS source) src
       LEFT JOIN s ON s.day = d.day AND s.source = src.source
       LEFT JOIN c ON c.day = d.day AND c.source = src.source
      ORDER BY d.day, src.source`,
    [...params(r), r.tz, [...AD_SOURCES, "direct"]],
  );
  res.json(rows);
});

/** Recent conversions with their credited source; shows the pixel+API merge at work. */
analyticsRouter.get("/api/analytics/conversions", async (req, res) => {
  const r = parseRange(req);
  const { rows } = await pool.query(
    `SELECT a.event_id, a.order_id, a.user_id, a.value_cents, a.currency, a.products, a.received_via,
            a.occurred_at, COALESCE(a.source, 'direct') AS source, a.campaign,
            (a.touch_id IS NOT NULL) AS had_tab_touch
       FROM (${attributedConversionsSql(r.model)}) a
      ORDER BY a.occurred_at DESC
      LIMIT 100`,
    params(r),
  );
  res.json(rows);
});

/** Event debugger: the raw log, newest first, with each event's tab touch. */
analyticsRouter.get("/api/events", async (req, res) => {
  const q = z
    .object({
      via: z.enum(["pixel", "api"]).optional(),
      name: z.string().max(40).optional(),
      source: z.string().max(40).optional(),
      tab: z.string().max(80).optional(),
      limit: z.coerce.number().int().min(1).max(1000).default(200),
    })
    .parse(req.query);

  const where = ["e.advertiser_id = $1"];
  const args: unknown[] = [config.storeAdvertiserId];
  const add = (sql: string, v: unknown) => {
    args.push(v);
    where.push(sql.replace("?", `$${args.length}`));
  };
  if (q.via) add("e.via = ?", q.via);
  if (q.name) add("e.event_name = ?", q.name);
  if (q.tab) add("e.tab_id = ?", q.tab);
  if (q.source === "direct") where.push("t.source IS NULL");
  else if (q.source) add("t.source = ?", q.source);
  args.push(q.limit);

  const { rows } = await pool.query(
    `SELECT e.id, e.via, e.event_name, e.event_id, e.user_id, e.tab_id, e.touch_id, e.page_url,
            e.is_bot, e.properties, e.received_at,
            t.source, t.source_raw, t.campaign, t.click_id
       FROM raw_events e
       LEFT JOIN touches t ON t.touch_id = e.touch_id
      WHERE ${where.join(" AND ")}
      ORDER BY e.received_at DESC, e.id DESC
      LIMIT $${args.length}`,
    args,
  );
  res.json(rows);
});

/** Demo helper: wipe all tracking data and orders. */
analyticsRouter.delete("/api/admin/data", async (_req, res) => {
  await pool.query("TRUNCATE raw_events, touches, conversions, orders");
  res.status(204).end();
});
