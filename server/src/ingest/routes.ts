import { Router, type Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { getOrSetUserId, setClickIdCookie } from "../lib/identity.js";
import { isBot } from "../lib/bots.js";
import { rateLimit } from "../lib/rateLimit.js";
import { ApiBatchSchema, ApiEventSchema, PixelBatchSchema, PixelEventSchema } from "./schemas.js";
import { ingest, type IncomingEvent } from "./service.js";

export const ingestRouter = Router();

type ItemResult = { index: number; event_id?: string; status: "accepted" | "duplicate" | "invalid"; issues?: unknown };

/**
 * Validates each event on its own so one bad event doesn't reject the whole batch
 * (partial success). Valid events are written in one transaction.
 */
async function processBatch<T>(
  items: unknown[],
  parse: (raw: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } },
  toEvent: (data: T) => IncomingEvent,
): Promise<ItemResult[]> {
  const results: ItemResult[] = new Array(items.length);
  const valid: { index: number; event: IncomingEvent }[] = [];
  items.forEach((raw, index) => {
    const parsed = parse(raw);
    if (parsed.success) valid.push({ index, event: toEvent(parsed.data) });
    else results[index] = { index, status: "invalid", issues: parsed.error.issues };
  });
  const statuses = await ingest(valid.map((v) => v.event));
  valid.forEach((v, i) => (results[v.index] = { index: v.index, event_id: v.event.eventId, status: statuses[i] }));
  return results;
}

const summarize = (results: ItemResult[]) => ({
  received: results.filter((r) => r.status === "accepted").length,
  duplicates: results.filter((r) => r.status === "duplicate").length,
  invalid: results.filter((r) => r.status === "invalid").length,
  results,
  // Like Koah's API: a 200 does not mean every event was accepted, so failures are spelled out here too.
  messages: results
    .filter((r) => r.status === "invalid")
    .map((r) => `events[${r.index}] was rejected: ${JSON.stringify(r.issues)}`),
});

// ---------------------------------------------------------------------------
// Pixel endpoint (browser -> us). Same-origin in this demo.
// The pixel sends text/plain JSON so a cross-origin pixel avoids a CORS preflight.
// ---------------------------------------------------------------------------
ingestRouter.post("/kad/e", rateLimit(config.rateLimit), async (req, res) => {
  const batch = PixelBatchSchema.safeParse(req.body);
  if (!batch.success) return res.status(400).json({ error: "invalid_batch", issues: batch.error.issues });
  const advertiserId = batch.data.advertiser_id;
  if (!config.advertisers[advertiserId]) return res.status(404).json({ error: "unknown_advertiser" });

  const userId = getOrSetUserId(req, res);
  const userAgent = req.get("user-agent") ?? null;
  const bot = isBot(userAgent);
  const now = Date.now();
  const sentAt = batch.data.sent_at;

  const results = await processBatch(batch.data.events, (raw) => PixelEventSchema.safeParse(raw), (e) => {
    if (e.touch?.click_id) setClickIdCookie(res, e.touch.click_id);
    return {
      via: "pixel",
      advertiserId,
      eventName: e.event_name,
      eventId: e.event_id,
      userId,
      tabId: e.tab_id,
      touch: e.touch ?? null,
      clickId: null,
      pageUrl: e.page_url,
      referrer: e.referrer ?? null,
      userAgent,
      isBot: bot,
      properties: e.properties,
      occurredAt: correctedTime(now, sentAt, e.client_ts),
    };
  });
  req.log.debug({ advertiserId, count: results.length }, "pixel batch");
  res.json(summarize(results));
});

/**
 * When did a pixel event happen, on the SERVER's clock?
 *
 * Events can wait in the pixel's outbox (batching, retries, a page change), so
 * the receive time can be seconds or hours late, which reorders events (an ad
 * click could appear to happen after the purchase). Browser clocks can't be
 * trusted either: they can be hours off. So we measure only the DELAY on the
 * browser clock (sent_at - client_ts, where the skew cancels out) and subtract
 * it from the server's receive time. Same idea as Segment's sentAt correction.
 */
const MAX_DELAY_MS = 7 * 24 * 3600 * 1000;
export function correctedTime(serverNow: number, sentAt?: number, clientTs?: number): Date {
  if (!sentAt || !clientTs) return new Date(serverNow);
  const delay = Math.min(Math.max(sentAt - clientTs, 0), MAX_DELAY_MS);
  return new Date(serverNow - delay);
}

// <noscript> fallback: a 1x1 image request records a bare PageView without JavaScript.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
ingestRouter.get("/kad/e", async (req, res) => {
  const advertiserId = String(req.query.id ?? "");
  if (config.advertisers[advertiserId] && req.query.ev === "PageView") {
    const userAgent = req.get("user-agent") ?? null;
    await ingest([
      {
        via: "pixel",
        advertiserId,
        eventName: "PageView",
        eventId: `noscript-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        userId: getOrSetUserId(req, res),
        tabId: null,
        touch: null,
        clickId: null,
        pageUrl: req.get("referer") ?? null,
        referrer: null,
        userAgent,
        isBot: isBot(userAgent),
        properties: { noscript: true },
        occurredAt: new Date(),
      },
    ]);
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" }).send(GIF);
});

// ---------------------------------------------------------------------------
// Conversion API (advertiser server -> us). Mirrors Koah's
// POST /api/v1/conversion_events: Bearer API key, up to 100 events per call.
// ---------------------------------------------------------------------------
function authenticate(req: Request): string | null {
  const token = /^Bearer (.+)$/.exec(req.get("authorization") ?? "")?.[1];
  if (!token) return null;
  for (const [id, adv] of Object.entries(config.advertisers)) {
    const a = Buffer.from(token);
    const b = Buffer.from(adv.apiKey);
    if (a.length === b.length && timingSafeEqual(a, b)) return id; // constant-time compare
  }
  return null;
}

const MAX_PAST_MS = 7 * 24 * 3600 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

/** Accept the advertiser's event_time only within a sane window; otherwise use receive time. */
function clampEventTime(iso: string | undefined, now: Date): Date {
  if (!iso) return now;
  const t = new Date(iso).getTime();
  return t >= now.getTime() - MAX_PAST_MS && t <= now.getTime() + MAX_FUTURE_MS ? new Date(t) : now;
}

ingestRouter.post("/api/v1/conversion_events", async (req, res) => {
  const advertiserId = authenticate(req);
  if (!advertiserId) return res.status(401).json({ error: "invalid_api_key" });
  const batch = ApiBatchSchema.safeParse(req.body);
  if (!batch.success) return res.status(400).json({ error: "invalid_batch", issues: batch.error.issues });
  if (batch.data.advertiser_id && batch.data.advertiser_id !== advertiserId) {
    return res.status(403).json({ error: "advertiser_mismatch" });
  }

  const now = new Date();
  const results = await processBatch(batch.data.events, (raw) => ApiEventSchema.safeParse(raw), (e) => ({
    via: "api",
    advertiserId,
    eventName: e.event_name,
    eventId: e.event_id,
    userId: e.user_id,
    tabId: null,
    touch: null,
    clickId: e.kad_cid ?? e.click_id ?? null,
    pageUrl: e.page_url ?? null,
    referrer: null,
    userAgent: null,
    isBot: false, // server-to-server: the advertiser vouches for these
    properties: e.properties,
    occurredAt: clampEventTime(e.event_time, now),
  }));
  res.json(summarize(results));
});
