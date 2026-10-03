/**
 * Generates 60 days of realistic traffic through the real ingestion service.
 *   npm run seed            (from the repo root: wipes data first)
 *
 * The journeys are designed so the attribution models disagree, which is the
 * point of having a model switch:
 *  - funnel drop-off per platform (koah converts best, facebook worst)
 *  - users who click an ad, leave, and come back DIRECT days later to buy
 *    (tab model: direct; last-touch: the ad)
 *  - users introduced by google who later click a koah ad and buy
 *    (first-touch: google; last-touch: koah)
 *  - ~8% of purchases with the pixel blocked (API-only; tab model falls back)
 *  - some crawler traffic (stored, flagged, excluded)
 */
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { pool } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { PRODUCTS, CURRENCY } from "./domain/catalog.js";
import { ingest, type IncomingEvent } from "./ingest/service.js";
import type { EventName, TouchInput } from "./ingest/schemas.js";

const SHOP = process.env.PUBLIC_URL ?? "http://localhost:5180";
const COURSES = PRODUCTS; // includes the All-Access plan
const ADV = "adv_kernelcraft";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const DAYS = 60; // two 30-day windows, so the dashboard can compare against the previous period
const SCALE = DAYS / 30; // the PLAN volumes below are per 30 days

type Src = "google" | "koah" | "facebook";
const PLAN: Record<Src | "direct", { visitors: number; view: number; cart: number; campaigns: string[] }> = {
  google: { visitors: 260, view: 0.68, cart: 0.3, campaigns: ["search_brand", "search_ai_courses"] },
  koah: { visitors: 170, view: 0.8, cart: 0.4, campaigns: ["rag_launch", "coding_agents"] },
  facebook: { visitors: 220, view: 0.55, cart: 0.2, campaigns: ["retargeting", "lookalike_devs"] },
  direct: { visitors: 90, view: 0.6, cart: 0.25, campaigns: [] },
};
const P_CHECKOUT = 0.7; // of carts
const P_PURCHASE = 0.85; // of checkouts
const P_RETURN_DIRECT = 0.04; // non-buyers who come back later in a new tab and buy
const P_PIXEL_BLOCKED = 0.08;

const rand = Math.random;
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Start time with a gentle upward trend (more traffic in recent days), during waking hours. */
function startTime(): number {
  const dayOffset = Math.floor(DAYS * rand() ** 0.8); // skews toward recent
  const d = new Date(Date.now() - (DAYS - 1 - dayOffset) * DAY);
  d.setHours(8 + Math.floor(rand() * 14), Math.floor(rand() * 60), 0, 0);
  return Math.min(d.getTime(), Date.now() - 30 * MIN);
}

class Journey {
  events: IncomingEvent[] = [];
  orders: unknown[][] = [];
  constructor(public userId: string, public t: number) {}

  tab(touch: TouchInput | null) {
    const tabId = randomUUID();
    const ev = (eventName: EventName, pageUrl: string, properties: IncomingEvent["properties"] = {}, via: "pixel" | "api" = "pixel", eventId: string = randomUUID()) => {
      this.t += (0.3 + rand() * 3) * MIN;
      if (this.t > Date.now()) this.t = Date.now() - MIN;
      this.events.push({
        via, advertiserId: ADV, eventName, eventId, userId: this.userId,
        tabId: via === "pixel" ? tabId : null, touch: via === "pixel" ? touch : null,
        clickId: via === "api" ? touch?.click_id ?? null : null,
        pageUrl, referrer: null, userAgent: via === "pixel" ? UA : null, isBot: false, properties,
        occurredAt: new Date(this.t),
      });
    };
    return {
      browse: (plan: (typeof PLAN)[Src], forceBuy = false): boolean => {
        ev("PageView", touch?.landing_url ?? `${SHOP}/`);
        if (!forceBuy && rand() > plan.view) return false;
        const product = pick(COURSES);
        const qty = 1; // digital products
        const props = { value: (product.priceCents * qty) / 100, currency: CURRENCY, products: [{ id: product.id, name: product.name, quantity: qty, price: product.priceCents / 100 }] };
        ev("PageView", `${SHOP}/courses/${product.id}`);
        ev("ViewContent", `${SHOP}/courses/${product.id}`, props);
        if (!forceBuy && rand() > plan.cart) return false;
        ev("AddToCart", `${SHOP}/courses/${product.id}`, { ...props, itemCount: qty });
        ev("PageView", `${SHOP}/checkout`);
        if (!forceBuy && rand() > P_CHECKOUT) return false;
        ev("InitiateCheckout", `${SHOP}/checkout`, { ...props, itemCount: qty });
        if (!forceBuy && rand() > P_PURCHASE) return false;

        const orderId = `ord_${randomUUID().slice(0, 12).replace(/-/g, "")}`;
        const eventId = `purchase_${orderId}`;
        const purchaseProps = { ...props, itemCount: qty, order_id: orderId };
        ev("Purchase", `${SHOP}/checkout`, purchaseProps, "api", eventId); // server-side, always
        if (rand() > P_PIXEL_BLOCKED) ev("Purchase", `${SHOP}/checkout`, purchaseProps, "pixel", eventId); // browser copy
        ev("PageView", `${SHOP}/thank-you?order=${orderId}`);
        this.orders.push([orderId, this.userId, JSON.stringify([{ product_id: product.id, name: product.name, quantity: qty, unit_price_cents: product.priceCents }]), product.priceCents * qty, CURRENCY, eventId, new Date(this.t)]);
        return true;
      },
    };
  }
}

function adTouch(source: Src): TouchInput {
  const campaign = pick(PLAN[source].campaigns);
  const clickId = source === "koah" ? `cid_${randomUUID().slice(0, 10)}` : null;
  const params = new URLSearchParams({ utm_source: source, utm_medium: source === "facebook" ? "social" : "cpc", utm_campaign: campaign });
  if (clickId) params.set("kad_cid", clickId);
  return {
    touch_id: randomUUID(), utm_source: source, utm_medium: params.get("utm_medium"), utm_campaign: campaign,
    utm_content: null, click_id: clickId, landing_url: `${SHOP}/?${params}`,
  };
}

export async function seedDemoData() {
  await migrate(() => {});
  await pool.query("TRUNCATE raw_events, touches, conversions, orders");
  const journeys: Journey[] = [];

  for (const source of ["google", "koah", "facebook"] as Src[]) {
    for (let i = 0; i < PLAN[source].visitors * SCALE; i++) {
      const j = new Journey(randomUUID(), startTime());
      const bought = j.tab(adTouch(source)).browse(PLAN[source]);
      if (!bought && rand() < P_RETURN_DIRECT) {
        // Comes back days later by typing the URL: a new tab, no ad touch.
        j.t += (1 + rand() * 4) * DAY;
        if (j.t < Date.now() - MIN) j.tab(null).browse(PLAN.direct, rand() < 0.4);
      } else if (!bought && source === "google" && rand() < 0.2) {
        // Later clicks a koah ad (first touch google, last touch koah).
        j.t += (1 + rand() * 3) * DAY;
        if (j.t < Date.now() - MIN) j.tab(adTouch("koah")).browse(PLAN.koah, rand() < 0.6);
      }
      journeys.push(j);
    }
  }
  for (let i = 0; i < PLAN.direct.visitors * SCALE; i++) {
    const j = new Journey(randomUUID(), startTime());
    j.tab(null).browse(PLAN.direct);
    journeys.push(j);
  }

  // Crawlers: recorded and flagged, never counted.
  const bots: IncomingEvent[] = Array.from({ length: 40 }, () => ({
    via: "pixel", advertiserId: ADV, eventName: "PageView", eventId: randomUUID(), userId: randomUUID(), tabId: randomUUID(),
    touch: rand() < 0.5 ? adTouch(pick(["google", "facebook"] as Src[])) : null, clickId: null,
    pageUrl: `${SHOP}/`, referrer: null, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    isBot: true, properties: {}, occurredAt: new Date(startTime()),
  }));

  await ingest(bots); // first, so crawler rows are the oldest in the event log
  let count = 0;
  for (const j of journeys) {
    await ingest(j.events);
    count += j.events.length;
    for (const o of j.orders) {
      await pool.query(`INSERT INTO orders (order_id, user_id, items, total_cents, currency, event_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, o);
    }
  }
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM conversions");
  console.log(`Seeded ${journeys.length} users, ${count + bots.length} events, ${rows[0].n} purchases.`);
}

// Run directly (`npm run seed`); importing this file from the server does nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemoData()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
