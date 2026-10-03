import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { logger } from "./lib/logger.js";
import { pool } from "./db/pool.js";
import { getOrSetUserId } from "./lib/identity.js";
import { ingestRouter } from "./ingest/routes.js";
import { ordersRouter } from "./orders/routes.js";
import { analyticsRouter } from "./analytics/routes.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Builds the Express app. Kept separate from index.ts so tests can mount it without listening. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // req.ip must be the real client: behind the Vite dev proxy locally, behind the host's load balancer when deployed.
  app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : "loopback");

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/healthz" },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "debug"),
    }),
  );
  app.use(cookieParser());
  // The pixel posts JSON as text/plain (a "simple" request, so no CORS preflight).
  app.use(express.json({ type: ["application/json", "text/plain"], limit: "256kb" }));

  app.get("/healthz", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  // The pixel script itself, built from /pixel into server/public by esbuild.
  app.get("/pixel.js", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.sendFile(path.resolve(here, "../public/pixel.js"));
  });

  app.use(ingestRouter);
  app.use(ordersRouter);
  app.use(analyticsRouter);

  // Production mode: serve the built store. In dev, Vite serves it on :5180.
  const webDist = path.resolve(here, "../../web/dist");
  if (existsSync(webDist)) {
    // Establish identity on the HTML response, before any script runs (see identity.ts).
    app.use((req, res, next) => {
      if (req.method === "GET" && req.accepts("html") && !req.path.startsWith("/api")) getOrSetUserId(req, res);
      next();
    });
    app.use(express.static(webDist));
    app.get(/^(?!\/(api|kad)\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ZodError) return res.status(400).json({ error: "invalid_request", issues: err.issues });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "invalid_json" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
    req.log.error({ err }, "unhandled error");
    res.status(500).json({ error: "internal_error" });
  };
  app.use(onError);
  return app;
}
