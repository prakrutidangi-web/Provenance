/**
 * In-store sponsored placements (like Udemy's "Sponsored" listings).
 *
 * These are internal promotions, not ad-platform touches, so their links carry
 * NO utm_* parameters: putting UTMs on internal links would overwrite the tab's
 * real attribution (google / facebook / koah) and steal the credit for the sale.
 * Instead each slot reports PromoView / PromoClick events with its promo id and
 * placement, and the original ad touch keeps the conversion.
 */
import type { Product } from "./api";

export interface Promo {
  id: string; // promo id, reported on PromoView / PromoClick
  courseId: string; // the course it promotes; the link always goes to /courses/<courseId>
  tracks: string[];
  keywords: string[];
}

export const PROMOS: Promo[] = [
  { id: "sp_fine_tuning", courseId: "fine-tuning-llms", tracks: ["ai"], keywords: ["llm", "fine-tun", "model", "train", "lora", "ai"] },
  { id: "sp_llm_security", courseId: "llm-security", tracks: ["security"], keywords: ["security", "prompt", "injection", "secure"] },
  { id: "sp_nextjs", courseId: "nextjs-app-router", tracks: ["frontend"], keywords: ["react", "next", "frontend", "web"] },
  { id: "sp_rust", courseId: "rust-backend", tracks: ["backend"], keywords: ["rust", "backend", "server", "performance"] },
  { id: "sp_kubernetes", courseId: "kubernetes-production", tracks: ["devops"], keywords: ["kubernetes", "k8s", "docker", "deploy", "cloud", "devops"] },
  { id: "sp_dbt", courseId: "dbt-analytics", tracks: ["data"], keywords: ["sql", "data", "analytics", "dbt", "warehouse"] },
  { id: "sp_react_native", courseId: "react-native-apps", tracks: ["mobile"], keywords: ["mobile", "ios", "android", "app"] },
  { id: "sp_staff", courseId: "staff-engineer", tracks: ["career"], keywords: ["career", "staff", "senior", "promotion", "lead"] },
];

/**
 * Picks `n` distinct promos for a context: same track first, then keyword
 * matches on the search, then a stable rotation so every slot is filled.
 * Never promotes a course in `exclude` (e.g. the page you're on).
 */
export function pickPromos(ctx: { track?: string; q?: string; exclude?: string[] }, n = 1, seed = 0): Promo[] {
  const q = (ctx.q ?? "").toLowerCase();
  const pool = PROMOS.filter((p) => !ctx.exclude?.includes(p.courseId));
  const score = (p: Promo) =>
    (ctx.track && p.tracks.includes(ctx.track) ? 10 : 0) + (q ? p.keywords.filter((k) => q.includes(k)).length : 0);
  const rotated = pool.map((p, i) => ({ p, s: score(p), r: (i + seed) % pool.length }));
  rotated.sort((a, b) => b.s - a.s || a.r - b.r);
  return rotated.slice(0, n).map((x) => x.p);
}

export const promoProduct = (promo: Promo, products: Product[]) => products.find((p) => p.id === promo.courseId);
