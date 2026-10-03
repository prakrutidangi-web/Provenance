import { z } from "zod";

/** Standard event names, mirroring Koah's pixel event taxonomy. */
export const EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "Search",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "Purchase",
  "Lead",
  "SignUp",
  "PromoView", // in-store sponsored slot shown (internal promotion, not an ad touch)
  "PromoClick", // in-store sponsored slot clicked
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Events that count as conversions and get merged into the `conversions` table. */
export const CONVERSION_EVENTS: readonly EventName[] = ["Purchase"];

const str = (max: number) => z.string().trim().min(1).max(max);
const optStr = (max: number) => z.string().max(max).nullish();

/** Koah truncates over-long values rather than rejecting the event; so do we. */
const clip = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max));
const optClip = (max: number) => z.string().transform((s) => s.slice(0, max)).nullish();

const ProductSchema = z.object({
  id: clip(100),
  name: optClip(255),
  category: optClip(100),
  quantity: z.number().int().positive().max(1000).optional(),
  price: z.number().nonnegative().max(1_000_000).optional(),
});

/** Event parameters (Koah-style: value is in major currency units, e.g. 12.5 = $12.50). */
export const PropertiesSchema = z
  .object({
    value: z.number().positive().max(10_000_000).optional(), // Koah: a value, when present, must be greater than 0
    currency: z.string().length(3).toUpperCase().optional(),
    products: z.array(ProductSchema).max(100).optional(),
    itemCount: z.number().int().nonnegative().optional(),
    order_id: optStr(100),
  })
  .passthrough();

/** The ad touch the pixel captured from the landing URL (sent with every event of that tab). */
export const TouchSchema = z.object({
  touch_id: str(64),
  utm_source: optStr(200),
  utm_medium: optStr(200),
  utm_campaign: optStr(200),
  utm_content: optStr(200),
  click_id: optStr(200),
  landing_url: optStr(2048),
});
export type TouchInput = z.infer<typeof TouchSchema>;

const purchaseNeedsValue = (e: { event_name: string; properties?: { value?: number; currency?: string } }, ctx: z.RefinementCtx) => {
  if (e.event_name === "Purchase" && (e.properties?.value === undefined || !e.properties?.currency)) {
    ctx.addIssue({ code: "custom", path: ["properties"], message: "Purchase requires value and currency" });
  }
};

// ---------------------------------------------------------------------------
// Pixel (browser) batch: POST /kad/e
// ---------------------------------------------------------------------------
export const PixelEventSchema = z
  .object({
    event_name: z.enum(EVENT_NAMES),
    event_id: clip(512), // Koah truncates event IDs longer than 512 characters
    tab_id: str(64),
    touch: TouchSchema.nullish(),
    page_url: z.string().max(2048),
    referrer: optStr(2048),
    properties: PropertiesSchema.default({}),
    client_ts: z.number().int().positive().optional(), // ms, browser clock
  })
  .superRefine(purchaseNeedsValue);

export const PixelBatchSchema = z.object({
  advertiser_id: str(64),
  sent_at: z.number().int().positive().optional(), // ms, browser clock
  events: z.array(z.unknown()).min(1).max(50), // validated one by one for partial success
});

// ---------------------------------------------------------------------------
// Conversion API (server-to-server): POST /api/v1/conversion_events
// ---------------------------------------------------------------------------
export const ApiEventSchema = z
  .object({
    event_name: z.enum(EVENT_NAMES),
    event_id: clip(512), // Koah truncates event IDs longer than 512 characters
    user_id: str(128),
    kad_cid: optStr(200), // Koah's name for the click ID
    click_id: optStr(200), // accepted as an alias
    event_time: z.string().datetime().optional(),
    page_url: optStr(2048),
    properties: PropertiesSchema.default({}),
  })
  .superRefine(purchaseNeedsValue);

export const ApiBatchSchema = z.object({
  advertiser_id: optStr(64),
  events: z.array(z.unknown()).min(1).max(100), // Koah's API accepts up to 100 events per request
});
