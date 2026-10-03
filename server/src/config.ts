/**
 * All runtime configuration in one place, read from env with dev-friendly defaults.
 * In production these would come from a secrets manager, never defaults.
 */
export const config = {
  port: Number(process.env.PORT ?? 4180),
  /** 127.0.0.1 in dev (a clear EADDRINUSE if the port is taken); set HOST=0.0.0.0 when hosted. */
  host: process.env.HOST ?? "127.0.0.1",
  /** On a public deployment the "Reset data" action is off unless ALLOW_RESET=1. */
  resetEnabled: process.env.NODE_ENV !== "production" || process.env.ALLOW_RESET === "1",
  /** Load demo data when the database is empty (first boot of a hosted copy). */
  autoSeed: process.env.AUTO_SEED === "1",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://koah:koah@localhost:55432/koah_attribution",
  logLevel: process.env.LOG_LEVEL ?? "info",

  /**
   * Advertisers allowed to send events. A real system stores these in a table,
   * with hashed API keys and key rotation. One advertiser keeps the demo simple.
   */
  advertisers: {
    adv_kernelcraft: { name: "Kernelcraft", apiKey: process.env.KOAH_API_KEY ?? "sk_test_kernelcraft" },
  } as Record<string, { name: string; apiKey: string }>,

  /** The store's own advertiser id (the store is the advertiser in this demo). */
  storeAdvertiserId: "adv_kernelcraft",

  cookies: {
    userId: "koah_uid",          // persistent first-party user id (HTTP-only, set by the server)
    clickId: "koah_kad_cid",     // last Koah click id (HTTP-only), lets server-side events carry it
    userIdMaxAgeDays: 365,
    clickIdMaxAgeDays: 30,
  },

  /** Lookback windows for the window-based attribution models. */
  attribution: {
    lastTouchDays: 7,
    firstTouchDays: 30,
  },

  rateLimit: { perSecond: 20, burst: 60 },
};
