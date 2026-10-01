// React StrictMode mounts components twice in development, which would send
// duplicate funnel events. Keying on the navigation (location.key) + event makes
// each event fire once per page visit, in dev and prod alike.
const sent = new Set<string>();

export function trackOnce(navigationKey: string, eventName: string, params: Record<string, unknown>, dedupeKey = "") {
  const key = `${navigationKey}:${eventName}:${dedupeKey}`;
  if (sent.has(key)) return;
  sent.add(key);
  window.kad("track", eventName, params);
}
