import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns this browser's persistent user id, creating it if needed.
 *
 * Koah's docs recommend server-set HTTP-only cookies for the user id and click id:
 *  - JavaScript can't read or tamper with them (safer than localStorage).
 *  - Safari's ITP caps cookies *set by JavaScript* at 7 days; server-set ones last longer.
 *  - The server sees the same id on pixel requests AND on checkout, so the browser
 *    pixel and the server-side Conversion API agree on who the user is.
 *
 * It is set on the HTML page response (app.ts in production, a Vite plugin in dev)
 * so it exists before the first pixel request. Setting it lazily on API calls
 * alone caused a race: a fast checkout and the first pixel batch could both
 * arrive cookie-less and mint two different ids for one person. This function
 * remains the fallback for any request that still arrives without one.
 */
export function getOrSetUserId(req: Request, res: Response): string {
  const existing = req.cookies?.[config.cookies.userId];
  if (typeof existing === "string" && existing.length > 0 && existing.length <= 64) return existing;
  const id = randomUUID();
  res.cookie(config.cookies.userId, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: config.cookies.userIdMaxAgeDays * DAY_MS,
  });
  return id;
}

/** Remembers the latest Koah click id (kad_cid) so server-side events can include it. */
export function setClickIdCookie(res: Response, clickId: string): void {
  res.cookie(config.cookies.clickId, clickId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: config.cookies.clickIdMaxAgeDays * DAY_MS,
  });
}

export function getClickId(req: Request): string | null {
  const v = req.cookies?.[config.cookies.clickId];
  return typeof v === "string" && v ? v : null;
}
