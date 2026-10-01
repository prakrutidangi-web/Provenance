import pino from "pino";
import { config } from "../config.js";

/** Structured JSON logs (pretty-printed in dev). Every request gets a req id via pino-http. */
export const logger = pino({
  level: config.logLevel,
  transport:
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname", translateTime: "HH:MM:ss" } },
});
