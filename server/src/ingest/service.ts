/**
 * Ingestion service: the single write path for events from BOTH channels.
 *
 *   pixel (browser) ──► POST /kad/e ─────────────────────┐
 *                                                        ├─► ingest() ─► raw_events (+ touches, conversions)
 *   advertiser server ─► POST /api/v1/conversion_events ─┘
 *
 * Guarantees:
 *  - Idempotent: the same (channel, event_id) is stored once, so clients can
 *    retry freely (at-least-once delivery + idempotent writes = effectively once).
 *  - Pixel/API dedupe: a Purchase sent by both channels with the same event_id
 *    becomes ONE conversion row. Each channel fills in what only it knows:
 *    the pixel knows the tab's ad touch, the API knows the trusted order value.
 */
import type pg from "pg";
import { withTransaction } from "../db/pool.js";
import { resolveTouchSource } from "../domain/sources.js";
import { CONVERSION_EVENTS, type EventName, type TouchInput } from "./schemas.js";

export type Channel = "pixel" | "api";

export interface IncomingEvent {
  via: Channel;
  advertiserId: string;
  eventName: EventName;
  eventId: string;
  userId: string;
  tabId: string | null;
  touch: TouchInput | null;
  clickId: string | null; // API events: from the kad_cid cookie the advertiser kept
  pageUrl: string | null;
  referrer: string | null;
  userAgent: string | null;
  isBot: boolean;
  properties: {
    value?: number;
    currency?: string;
    products?: { id: string; name?: string | null; quantity?: number; price?: number }[];
    order_id?: string | null;
    [k: string]: unknown;
  };
  occurredAt: Date;
}

export type IngestStatus = "accepted" | "duplicate";

export async function ingest(events: IncomingEvent[]): Promise<IngestStatus[]> {
  if (events.length === 0) return [];
  return withTransaction(async (client) => {
    const statuses: IngestStatus[] = [];
    for (const e of events) statuses.push(await ingestOne(client, e));
    return statuses;
  });
}

async function ingestOne(client: pg.PoolClient, e: IncomingEvent): Promise<IngestStatus> {
  // 1. Touch first, so the raw event can reference it. ON CONFLICT DO NOTHING keeps
  //    the first sighting (the landing page), even though every later event in the
  //    tab carries the same touch object.
  if (e.touch) {
    await client.query(
      `INSERT INTO touches (touch_id, advertiser_id, user_id, tab_id, source, source_raw, medium,
                            campaign, content, click_id, landing_url, is_bot, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (touch_id) DO NOTHING`,
      [
        e.touch.touch_id,
        e.advertiserId,
        e.userId,
        e.tabId,
        resolveTouchSource(e.touch.utm_source, e.touch.click_id),
        e.touch.utm_source ?? null,
        e.touch.utm_medium ?? null,
        e.touch.utm_campaign ?? null,
        e.touch.utm_content ?? null,
        e.touch.click_id ?? null,
        e.touch.landing_url ?? null,
        e.isBot,
        e.occurredAt,
      ],
    );
  }

  // 2. Append to the raw log. A conflict means this channel already delivered this event.
  const inserted = await client.query(
    `INSERT INTO raw_events (advertiser_id, via, event_name, event_id, user_id, tab_id, touch_id,
                             page_url, referrer, user_agent, is_bot, properties, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (advertiser_id, via, event_id) DO NOTHING
     RETURNING id`,
    [
      e.advertiserId,
      e.via,
      e.eventName,
      e.eventId,
      e.userId,
      e.tabId,
      e.touch?.touch_id ?? null,
      e.pageUrl,
      e.referrer,
      e.userAgent,
      e.isBot,
      JSON.stringify(e.properties),
      e.occurredAt,
    ],
  );
  if (inserted.rowCount === 0) return "duplicate";

  // 3. Conversions: merge pixel + API copies of the same event into one row.
  if (CONVERSION_EVENTS.includes(e.eventName) && !e.isBot) {
    const valueCents = e.properties.value !== undefined ? Math.round(e.properties.value * 100) : null;
    await client.query(
      `INSERT INTO conversions (advertiser_id, event_id, event_name, user_id, touch_id, click_id, order_id,
                                value_cents, currency, products, page_url, received_via, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,ARRAY[$12::text],$13)
       ON CONFLICT (advertiser_id, event_id) DO UPDATE SET
         -- Only the pixel knows the tab's touch; only the API knows the kad_cid cookie.
         touch_id     = COALESCE(conversions.touch_id, EXCLUDED.touch_id),
         click_id     = COALESCE(conversions.click_id, EXCLUDED.click_id),
         order_id     = COALESCE(conversions.order_id, EXCLUDED.order_id),
         page_url     = COALESCE(conversions.page_url, EXCLUDED.page_url),
         -- The server-side value is trusted; a browser-reported value is only a fallback.
         value_cents  = CASE WHEN $12 = 'api' THEN EXCLUDED.value_cents ELSE COALESCE(conversions.value_cents, EXCLUDED.value_cents) END,
         currency     = CASE WHEN $12 = 'api' THEN EXCLUDED.currency    ELSE COALESCE(conversions.currency, EXCLUDED.currency) END,
         products     = CASE WHEN $12 = 'api' THEN EXCLUDED.products    ELSE COALESCE(conversions.products, EXCLUDED.products) END,
         -- Keep the earliest time either channel saw it.
         occurred_at  = LEAST(conversions.occurred_at, EXCLUDED.occurred_at),
         received_via = ARRAY(SELECT DISTINCT unnest(conversions.received_via || EXCLUDED.received_via) ORDER BY 1)`,
      [
        e.advertiserId,
        e.eventId,
        e.eventName,
        e.userId,
        e.touch?.touch_id ?? null,
        e.clickId ?? e.touch?.click_id ?? null,
        e.properties.order_id ?? null,
        valueCents,
        e.properties.currency ?? null,
        e.properties.products ? JSON.stringify(e.properties.products) : null,
        e.pageUrl,
        e.via,
        e.occurredAt,
      ],
    );
  }
  return "accepted";
}

