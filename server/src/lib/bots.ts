/**
 * Cheap first-pass bot detection by user agent.
 *
 * Bot events are still stored (so you can see them in the debugger and tune the
 * rules) but they're flagged and excluded from metrics. Real systems layer on IP
 * reputation, behavioral signals (no scroll, impossible click speed) and the ad
 * platform's own invalid-traffic feeds.
 */
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|curl\/|wget|python-requests|axios\/|go-http-client/i;

export function isBot(userAgent: string | undefined | null): boolean {
  if (!userAgent) return true; // every real browser sends a UA
  return BOT_UA.test(userAgent);
}
