import { config } from "./config.js";
import { createApp } from "./app.js";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { logger } from "./lib/logger.js";

await migrate((msg) => logger.info(msg));

// Bind to 127.0.0.1 explicitly: if another app already owns the port we get a
// clear EADDRINUSE error instead of two servers silently sharing "localhost".
const server = createApp()
  .listen(config.port, "127.0.0.1", () => logger.info(`API listening on http://127.0.0.1:${config.port}`))
  .on("error", (err) => {
    logger.fatal(`Could not start API on port ${config.port}: ${err.message}`);
    process.exit(1);
  });

// Graceful shutdown: stop accepting connections, finish in-flight requests, close the pool.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
