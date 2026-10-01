import type { RequestHandler } from "express";

/**
 * In-memory token bucket per client IP.
 *
 * Each IP gets `burst` tokens that refill at `perSecond`. A request spends one
 * token, and an empty bucket returns 429. Good enough for one process; with
 * several API instances this moves to Redis (INCR + EXPIRE, or a Lua token bucket).
 */
export function rateLimit(opts: { perSecond: number; burst: number }): RequestHandler {
  const buckets = new Map<string, { tokens: number; updated: number }>();

  // Drop idle buckets so memory doesn't grow without bound.
  setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [key, b] of buckets) if (b.updated < cutoff) buckets.delete(key);
  }, 60_000).unref();

  return (req, res, next) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: opts.burst, updated: now };
    b.tokens = Math.min(opts.burst, b.tokens + ((now - b.updated) / 1000) * opts.perSecond);
    b.updated = now;
    if (b.tokens < 1) {
      buckets.set(key, b);
      res.setHeader("Retry-After", "1");
      return res.status(429).json({ error: "rate_limited" });
    }
    b.tokens -= 1;
    buckets.set(key, b);
    next();
  };
}
