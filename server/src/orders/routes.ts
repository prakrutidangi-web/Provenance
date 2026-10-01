/**
 * The store's own backend: catalog + checkout.
 *
 * Checkout does what an advertiser's server does with Koah's Conversion API:
 *   1. create the order (priced on the server, so the browser can't change the total)
 *   2. generate an event_id for the Purchase
 *   3. send a server-side Purchase event with that event_id
 *   4. return the event_id so the browser pixel sends ITS Purchase with the same id
 * Koah then sees one purchase, reported twice, and merges the two copies.
 *
 * Because store and tracker share a process here, step 3 calls the ingestion
 * service directly (the same code the /api/v1/conversion_events route uses). In
 * production it would be an HTTP call, written to an outbox table in the same
 * transaction as the order and delivered with retries, so a Koah outage can
 * never lose a conversion or block checkout.
 */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { CURRENCY, PRODUCTS, TRACKS, getProduct } from "../domain/catalog.js";
import { getClickId, getOrSetUserId } from "../lib/identity.js";
import { ingest } from "../ingest/service.js";

export const ordersRouter = Router();

ordersRouter.get("/api/products", (_req, res) => res.json(PRODUCTS));

/** Everything the storefront needs in one call (15 products: small enough to filter client-side). */
ordersRouter.get("/api/catalog", (_req, res) => res.json({ tracks: TRACKS, products: PRODUCTS }));

ordersRouter.get("/api/products/:id", (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "not_found" });
  res.json(product);
});

const CheckoutSchema = z.object({
  // Digital products: each course can be bought once per order.
  items: z
    .array(z.object({ product_id: z.string(), quantity: z.literal(1).default(1) }))
    .min(1)
    .max(20)
    .refine((items) => new Set(items.map((i) => i.product_id)).size === items.length, "duplicate product"),
  page_url: z.string().max(2048).optional(),
});

ordersRouter.post("/api/orders", async (req, res) => {
  const parsed = CheckoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_order", issues: parsed.error.issues });

  const items = [];
  for (const { product_id, quantity } of parsed.data.items) {
    const product = getProduct(product_id);
    if (!product) return res.status(400).json({ error: "unknown_product", product_id });
    items.push({ product_id, name: product.name, quantity, unit_price_cents: product.priceCents });
  }
  const totalCents = items.reduce((sum, i) => sum + i.unit_price_cents * i.quantity, 0);

  const userId = getOrSetUserId(req, res);
  const orderId = `ord_${randomUUID().slice(0, 13).replace(/-/g, "")}`;
  const eventId = `purchase_${orderId}`; // derived from the order, so retries reuse it
  const products = items.map((i) => ({ id: i.product_id, name: i.name, quantity: i.quantity, price: i.unit_price_cents / 100 }));

  await pool.query(
    `INSERT INTO orders (order_id, user_id, items, total_cents, currency, event_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [orderId, userId, JSON.stringify(items), totalCents, CURRENCY, eventId],
  );

  // Server-side Purchase (the "Conversion API" half). This still counts if the pixel is blocked.
  await ingest([
    {
      via: "api",
      advertiserId: config.storeAdvertiserId,
      eventName: "Purchase",
      eventId,
      userId,
      tabId: null,
      touch: null,
      clickId: getClickId(req),
      pageUrl: parsed.data.page_url ?? null,
      referrer: null,
      userAgent: null,
      isBot: false,
      properties: {
        value: totalCents / 100,
        currency: CURRENCY,
        products,
        itemCount: items.reduce((n, i) => n + i.quantity, 0),
        order_id: orderId,
      },
      occurredAt: new Date(),
    },
  ]);

  res.status(201).json({
    order_id: orderId,
    event_id: eventId,
    value: totalCents / 100,
    currency: CURRENCY,
    products,
  });
});
