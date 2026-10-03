export interface Track {
  id: string;
  name: string;
  blurb: string;
  accent: string;
}

export interface Product {
  id: string;
  kind: "course" | "plan";
  name: string;
  subtitle: string;
  code: string;
  track: string;
  level: string;
  durationMin: number;
  lessons: number;
  instructor: { name: string; title: string };
  priceCents: number;
  compareAtCents?: number;
  badge?: string;
  updated: string;
  snippet: string[];
  outcomes: string[];
  syllabus: { title: string; lessons: number }[];
}

export interface Catalog {
  tracks: Track[];
  products: Product[];
}

export type Model = "tab" | "last_touch_7d" | "first_touch_30d";

export interface SummaryRow {
  source: string;
  sessions: number;
  purchasers: number;
  orders: number;
  revenue_cents: number;
  conversion_rate: number;
}

export interface CampaignRow {
  source: string;
  campaign: string;
  sessions: number;
  purchasers: number;
  revenue_cents: number;
  conversion_rate: number;
}

export interface FunnelData {
  steps: string[];
  rows: { source: string; counts: number[] }[];
}

export interface TimeseriesRow {
  day: string;
  source: string;
  sessions: number;
  purchasers: number;
  revenue_cents: number;
}

export interface ConversionRow {
  event_id: string;
  order_id: string | null;
  user_id: string;
  value_cents: number | null;
  currency: string | null;
  products: { id: string; name?: string; quantity?: number }[] | null;
  received_via: string[];
  occurred_at: string;
  source: string;
  campaign: string | null;
  had_tab_touch: boolean;
}

export interface RawEvent {
  id: number;
  via: "pixel" | "api";
  event_name: string;
  event_id: string;
  user_id: string;
  tab_id: string | null;
  touch_id: string | null;
  page_url: string | null;
  is_bot: boolean;
  properties: { value?: number; currency?: string; products?: { id: string; name?: string; quantity?: number }[]; order_id?: string };
  received_at: string;
  source: string | null;
  source_raw: string | null;
  campaign: string | null;
  click_id: string | null;
}

export interface Order {
  order_id: string;
  event_id: string;
  value: number;
  currency: string;
  products: { id: string; name: string; quantity: number; price: number }[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface RangeQuery {
  model: Model;
  from: string;
  to: string;
  tz: string;
}
const qs = (q: object) =>
  new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();

export const api = {
  catalog: () => request<Catalog>("/api/catalog"),
  createOrder: (items: { product_id: string }[]) =>
    request<Order>("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, page_url: location.href }),
    }),

  summary: (q: RangeQuery) => request<{ rows: SummaryRow[] }>(`/api/analytics/summary?${qs(q)}`),
  campaigns: (q: RangeQuery) => request<CampaignRow[]>(`/api/analytics/campaigns?${qs(q)}`),
  funnel: (q: RangeQuery) => request<FunnelData>(`/api/analytics/funnel?${qs(q)}`),
  timeseries: (q: RangeQuery) => request<TimeseriesRow[]>(`/api/analytics/timeseries?${qs(q)}`),
  conversions: (q: RangeQuery) => request<ConversionRow[]>(`/api/analytics/conversions?${qs(q)}`),
  events: (q: { via?: string; name?: string; source?: string; tab?: string; limit?: number }) => request<RawEvent[]>(`/api/events?${qs(q)}`),
  resetData: () => fetch("/api/admin/data", { method: "DELETE" }),
};

export const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const SOURCES = ["google", "koah", "facebook", "direct"] as const;
