/**
 * Integration tests: the real Express app against a real Postgres.
 * Run with `npm test` (needs DATABASE_URL or the default local database).
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db/migrate.js";
import { pool } from "../src/db/pool.js";
import { config } from "../src/config.js";

const app = createApp();
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/129.0 Safari/537.36";
const API_KEY = config.advertisers.adv_kernelcraft.apiKey;

type Agent = ReturnType<typeof request.agent>;

/** A browser: a supertest agent keeps cookies between requests, like a real browser. */
const browser = () => request.agent(app);

function touch(source: string | null, extra: Record<string, string> = {}) {
  return { touch_id: randomUUID(), utm_source: source, utm_campaign: "fall_sale", landing_url: `http://shop/?utm_source=${source}`, ...extra };
}

async function pixel(agent: Agent, events: Record<string, unknown>[], ua = BROWSER_UA) {
  const res = await agent
    .post("/kad/e")
    .set("User-Agent", ua)
    .set("Content-Type", "text/plain")
    .send(JSON.stringify({ advertiser_id: "adv_kernelcraft", events }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

const pageView = (tabId: string, t: ReturnType<typeof touch> | null, url = "http://shop/") => ({
  event_name: "PageView",
  event_id: randomUUID(),
  tab_id: tabId,
  touch: t,
  page_url: url,
});

const purchase = (tabId: string, t: ReturnType<typeof touch> | null, eventId: string, value = 1) => ({
  event_name: "Purchase",
  event_id: eventId,
  tab_id: tabId,
  touch: t,
  page_url: "http://shop/cart",
  properties: { value, currency: "USD" },
});

async function checkout(agent: Agent, productIds: string[] = ["prompting-for-devs"]) {
  const res = await agent.post("/api/orders").send({ items: productIds.map((product_id) => ({ product_id })) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body as { order_id: string; event_id: string; value: number };
}

async function summary(model = "tab") {
  const res = await request(app).get(`/api/analytics/summary?model=${model}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return Object.fromEntries((res.body.rows as { source: string }[]).map((r) => [r.source, r])) as unknown as Record<
    string,
    { sessions: number; purchasers: number; orders: number; revenue_cents: number }
  >;
}

before(async () => {
  await migrate(() => {});
});
beforeEach(async () => {
  await pool.query("TRUNCATE raw_events, touches, conversions, orders");
});
after(async () => {
  await pool.end();
});

describe("pixel ingestion", () => {
  test("sets an HTTP-only user cookie and counts one session per user", async () => {
    const b = browser();
    const tab = randomUUID();
    const t = touch("koah");
    const res = await b
      .post("/kad/e")
      .set("User-Agent", BROWSER_UA)
      .send({ advertiser_id: "adv_kernelcraft", events: [pageView(tab, t)] });
    assert.match(String(res.headers["set-cookie"]), /koah_uid=.*HttpOnly/);
    await pixel(b, [pageView(tab, t, "http://shop/products/x"), pageView(tab, t)]); // more pages, same tab
    const s = await summary();
    assert.equal(s.koah.sessions, 1);
  });

  test("a retried event is stored once", async () => {
    const b = browser();
    const ev = pageView(randomUUID(), touch("google"));
    assert.equal((await pixel(b, [ev])).received, 1);
    const second = await pixel(b, [ev]);
    assert.equal(second.duplicates, 1);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM raw_events");
    assert.equal(rows[0].n, 1);
  });

  test("partial success: one invalid event doesn't reject the batch", async () => {
    const body = await pixel(browser(), [pageView(randomUUID(), null), { event_name: "Nope" }]);
    assert.equal(body.received, 1);
    assert.equal(body.invalid, 1);
    assert.equal(body.results[1].status, "invalid");
  });

  test("bot traffic is recorded but excluded from metrics", async () => {
    await pixel(browser(), [pageView(randomUUID(), touch("facebook"))], "Mozilla/5.0 (compatible; Googlebot/2.1)");
    const { rows } = await pool.query("SELECT is_bot FROM raw_events");
    assert.equal(rows[0].is_bot, true);
    assert.equal((await summary()).facebook.sessions, 0);
  });

  test("a Koah click id (kad_cid) attributes to koah and is kept in an HTTP-only cookie", async () => {
    const b = browser();
    const res = await b
      .post("/kad/e")
      .set("User-Agent", BROWSER_UA)
      .send({ advertiser_id: "adv_kernelcraft", events: [pageView(randomUUID(), touch(null, { click_id: "cid_abc" } as never))] });
    assert.match(String(res.headers["set-cookie"]), /koah_kad_cid=cid_abc/);
    assert.equal((await summary()).koah.sessions, 1);
  });
});

describe("pixel + Conversion API deduplication", () => {
  test("the same purchase from both channels becomes one conversion with the server's value", async () => {
    const b = browser();
    const tab = randomUUID();
    const t = touch("koah");
    await pixel(b, [pageView(tab, t)]);
    const order = await checkout(b, ["production-rag", "llm-evals"]); // server-side Purchase (API channel)
    await pixel(b, [purchase(tab, t, order.event_id, 0.01)]); // pixel copy, with a tampered value

    const { rows } = await pool.query("SELECT received_via, value_cents, touch_id FROM conversions");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].received_via, ["api", "pixel"]);
    assert.equal(rows[0].value_cents, 22800); // $129 + $99 from the server, not $0.01
    assert.equal(rows[0].touch_id, t.touch_id); // tab context from the pixel

    const s = await summary();
    assert.equal(s.koah.purchasers, 1);
    assert.equal(s.koah.orders, 1);
    assert.equal(s.koah.revenue_cents, 22800);
  });

  test("order matters not: pixel first, then API, merges the same way", async () => {
    const b = browser();
    const tab = randomUUID();
    const t = touch("google");
    await pixel(b, [pageView(tab, t)]);
    const eventId = `purchase_${randomUUID()}`;
    await pixel(b, [purchase(tab, t, eventId, 5)]);
    const cookie = (await pool.query("SELECT user_id FROM raw_events LIMIT 1")).rows[0].user_id;
    const api = await request(app)
      .post("/api/v1/conversion_events")
      .set("Authorization", `Bearer ${API_KEY}`)
      .send({ events: [{ event_name: "Purchase", event_id: eventId, user_id: cookie, properties: { value: 32, currency: "USD" } }] });
    assert.equal(api.status, 200);
    const { rows } = await pool.query("SELECT received_via, value_cents FROM conversions");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].received_via, ["api", "pixel"]);
    assert.equal(rows[0].value_cents, 3200);
  });
});

describe("attribution models", () => {
  test("tab model: a purchase in a new tab without UTMs is direct; last-touch credits the ad", async () => {
    const b = browser(); // one browser = one user cookie
    const adTab = randomUUID();
    await pixel(b, [pageView(adTab, touch("facebook"))]);
    const otherTab = randomUUID();
    await pixel(b, [pageView(otherTab, null)]);
    const order = await checkout(b);
    await pixel(b, [purchase(otherTab, null, order.event_id)]);

    const tab = await summary("tab");
    assert.equal(tab.direct.purchasers, 1);
    assert.equal(tab.facebook.purchasers, 0);

    const last = await summary("last_touch_7d");
    assert.equal(last.facebook.purchasers, 1);
    assert.equal(last.direct.purchasers, 0);
  });

  test("first-touch vs last-touch: google introduced the user, koah closed the sale", async () => {
    const b = browser();
    await pixel(b, [pageView(randomUUID(), touch("google"))]);
    await new Promise((r) => setTimeout(r, 20));
    const tab = randomUUID();
    const t = touch("koah");
    await pixel(b, [pageView(tab, t)]);
    const order = await checkout(b);
    await pixel(b, [purchase(tab, t, order.event_id)]);

    assert.equal((await summary("first_touch_30d")).google.purchasers, 1);
    assert.equal((await summary("last_touch_7d")).koah.purchasers, 1);
    assert.equal((await summary("tab")).koah.purchasers, 1);
  });

  test("tab model falls back to last touch when the pixel was blocked (API-only purchase)", async () => {
    const b = browser();
    await pixel(b, [pageView(randomUUID(), touch("google"))]);
    await checkout(b); // no pixel Purchase arrives, like an ad blocker would cause
    const s = await summary("tab");
    assert.equal(s.google.purchasers, 1);
  });
});

describe("Conversion API", () => {
  test("rejects a missing or wrong API key", async () => {
    const res = await request(app).post("/api/v1/conversion_events").send({ events: [{}] });
    assert.equal(res.status, 401);
    const wrong = await request(app).post("/api/v1/conversion_events").set("Authorization", "Bearer nope").send({ events: [{}] });
    assert.equal(wrong.status, 401);
  });

  test("Purchase requires value and currency", async () => {
    const res = await request(app)
      .post("/api/v1/conversion_events")
      .set("Authorization", `Bearer ${API_KEY}`)
      .send({ events: [{ event_name: "Purchase", event_id: "e1", user_id: "u1" }] });
    assert.equal(res.body.invalid, 1);
  });
});

describe("orders", () => {
  test("prices orders on the server and rejects unknown or duplicate products", async () => {
    const b = browser();
    const order = await checkout(b, ["typescript-deep-dive", "all-access"]);
    assert.equal(order.value, 388); // $89 + $299
    assert.match(order.event_id, /^purchase_ord_/);
    const bad = await b.post("/api/orders").send({ items: [{ product_id: "free-course" }] });
    assert.equal(bad.status, 400);
    const dup = await b.post("/api/orders").send({ items: [{ product_id: "llm-evals" }, { product_id: "llm-evals" }] });
    assert.equal(dup.status, 400);
    const qty = await b.post("/api/orders").send({ items: [{ product_id: "llm-evals", quantity: 3 }] });
    assert.equal(qty.status, 400);
  });
});
