/**
 * kad: a browser conversion pixel, modeled on Koah's.
 *
 * Install (in <head>; the tiny stub queues calls until this script loads):
 *
 *   <script>
 *     !function(w,d){if(!w.kad){var p=w.kad=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.queue.push(arguments)};
 *     p.queue=[];var t=d.createElement("script");t.src="/pixel.js";t.async=!0;
 *     var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
 *     kad("init", "adv_kernelcraft", { spa: true });
 *     kad("track", "PageView");
 *   </script>
 *
 * API:
 *   kad("init", advertiserId, { spa?, debug?, ignorePaths? })
 *   kad("track", eventName, { value?, currency?, products?, eventId?, ... })
 *   kad.getContext() -> { tabId, touch }
 *
 * What it does:
 *  - Attribution: when the URL has utm_* params or a kad_cid click id, it records a
 *    "touch" in sessionStorage (scoped to this tab) and attaches it to every event
 *    from this tab, so a purchase three pages later still carries the ad that
 *    brought the user in.
 *  - Identity: the user id is NOT handled here. The server sets an HTTP-only
 *    cookie on the first pixel request (JavaScript can't read or forge it).
 *  - Delivery: events are queued in a sessionStorage "outbox", sent in batches,
 *    retried with exponential backoff, and flushed with sendBeacon when the page is
 *    hidden. The outbox survives navigation, so an event queued just before a page
 *    change is sent from the next page. The server dedupes by event_id, so
 *    resending is always safe: at-least-once delivery plus idempotent writes.
 *  - SPA support: wraps history.pushState / replaceState and listens to popstate,
 *    so client-side route changes record a PageView (and capture new UTMs).
 *  - Never breaks the host page: every entry point is wrapped in try/catch.
 */

type Params = Record<string, unknown> & { eventId?: string };
interface AdTouch {
  touch_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  click_id: string | null;
  landing_url: string;
}
interface QueuedEvent {
  event_name: string;
  event_id: string;
  tab_id: string;
  touch: AdTouch | null;
  page_url: string;
  referrer: string | null;
  properties: Record<string, unknown>;
  client_ts: number; // when it happened, by this browser's clock (ms)
}
interface KadStub {
  (...args: unknown[]): void;
  queue?: ArrayLike<unknown>[];
  sendEvent?: (...args: unknown[]) => void;
  getContext?: () => { tabId: string; touch: AdTouch | null };
  version?: string;
}

declare global {
  interface Window {
    kad?: KadStub;
  }
}

const VERSION = "1.0.0";
const KEYS = { tab: "kad_tab_id", touch: "kad_touch", outbox: "kad_outbox" } as const;
const MAX_BATCH = 20;
const MAX_OUTBOX = 200;
const FLUSH_DELAY_MS = 1000;
const IMMEDIATE = new Set(["Purchase", "Lead", "SignUp", "InitiateCheckout"]); // don't wait to batch these

// The endpoint lives on the same origin as this script (document.currentScript is
// set while an async script first executes).
const scriptSrc = (document.currentScript as HTMLScriptElement | null)?.src || location.href;
const ENDPOINT = new URL("/kad/e", scriptSrc).toString();

let advertiserId: string | null = null;
let debug = false;
let ignorePaths: string[] = [];
let sending = false;
let attempt = 0;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let lastUrl = location.href;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const log = (...args: unknown[]) => debug && console.log("%c[kad]", "color:#0f766e;font-weight:bold", ...args);

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// sessionStorage can throw (privacy modes, sandboxed iframes): fall back to memory.
const mem: Record<string, string> = {};
const store = {
  get(k: string): string | null {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return mem[k] ?? null;
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      mem[k] = v;
    }
  },
};
const getJSON = <T>(k: string, fallback: T): T => {
  try {
    const raw = store.get(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

function tabId(): string {
  let id = store.get(KEYS.tab);
  if (!id) {
    id = uuid();
    store.set(KEYS.tab, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Attribution: capture the ad touch from the landing URL
// ---------------------------------------------------------------------------
function captureTouch(href: string): void {
  const p = new URL(href).searchParams;
  const source = p.get("utm_source");
  const clickId = p.get("kad_cid");
  if (!source && !clickId) return; // no ad params: keep the tab's existing touch

  const current = getJSON<AdTouch | null>(KEYS.touch, null);
  if (current && current.landing_url === href) return; // a reload of the same landing page is not a new click

  const touch: AdTouch = {
    touch_id: uuid(),
    utm_source: source,
    utm_medium: p.get("utm_medium"),
    utm_campaign: p.get("utm_campaign"),
    utm_content: p.get("utm_content"),
    click_id: clickId,
    landing_url: href,
  };
  store.set(KEYS.touch, JSON.stringify(touch)); // a newer ad click in this tab replaces the old one
  log("captured touch", touch);
}

// ---------------------------------------------------------------------------
// Outbox + delivery
// ---------------------------------------------------------------------------
const readOutbox = () => getJSON<QueuedEvent[]>(KEYS.outbox, []);
const writeOutbox = (events: QueuedEvent[]) => store.set(KEYS.outbox, JSON.stringify(events.slice(-MAX_OUTBOX)));

function removeFromOutbox(sent: QueuedEvent[]) {
  const ids = new Set(sent.map((e) => e.event_id));
  writeOutbox(readOutbox().filter((e) => !ids.has(e.event_id)));
}

function scheduleFlush(delay: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flush(), delay);
}

/** Sends the next batch. One request at a time, so the first response's user cookie is set before the next request. */
function flush(): void {
  if (!advertiserId || sending) return;
  const batch = readOutbox().slice(0, MAX_BATCH);
  if (batch.length === 0) return;
  // sent_at + client_ts let the server measure how long each event waited in the
  // outbox using only the browser's own clock, so skew between clocks cancels out.
  const body = JSON.stringify({ advertiser_id: advertiserId, sent_at: Date.now(), events: batch });
  sending = true;

  fetch(ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "text/plain" }, // "simple" request: no CORS preflight
    credentials: "include",
    keepalive: body.length < 60_000, // lets the request outlive a page navigation
  })
    .then((res) => {
      // 2xx: delivered. Other 4xx (except 429): the server will never accept it, so drop it.
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        removeFromOutbox(batch);
        attempt = 0;
        log(`sent ${batch.length} event(s)`, batch.map((e) => e.event_name));
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      attempt += 1;
      const backoff = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500; // jitter avoids thundering herds
      log(`send failed (${err}); retry in ${Math.round(backoff)}ms`);
      scheduleFlush(backoff);
    })
    .finally(() => {
      sending = false;
      if (attempt === 0 && readOutbox().length > 0) flush();
    });
}

/** Page is going away: hand whatever is left to the browser with sendBeacon. */
function flushWithBeacon(): void {
  if (!advertiserId || !navigator.sendBeacon) return;
  const pending = readOutbox();
  for (let i = 0; i < pending.length; i += MAX_BATCH) {
    const batch = pending.slice(i, i + MAX_BATCH);
    const blob = new Blob([JSON.stringify({ advertiser_id: advertiserId, sent_at: Date.now(), events: batch })], { type: "text/plain" });
    if (navigator.sendBeacon(ENDPOINT, blob)) removeFromOutbox(batch);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function track(eventName: string, params: Params = {}): void {
  if (!advertiserId) {
    log("track() before init(); ignored");
    return;
  }
  if (eventName === "PageView" && ignorePaths.some((p) => location.pathname.startsWith(p))) return; // e.g. internal admin pages
  const { eventId, ...properties } = params;
  const event: QueuedEvent = {
    event_name: eventName,
    event_id: typeof eventId === "string" && eventId ? eventId : uuid(), // shared id lets the server merge with the API copy
    tab_id: tabId(),
    touch: getJSON<AdTouch | null>(KEYS.touch, null),
    page_url: location.href,
    referrer: document.referrer || null,
    properties,
    client_ts: Date.now(),
  };
  writeOutbox([...readOutbox(), event]);
  log("track", eventName, event);
  if (IMMEDIATE.has(eventName) || readOutbox().length >= MAX_BATCH) flush();
  else scheduleFlush(FLUSH_DELAY_MS);
}

function onUrlChange(): void {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  captureTouch(location.href);
  track("PageView");
}

function enableSpaTracking(): void {
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      try {
        onUrlChange();
      } catch {
        /* never break navigation */
      }
      return result;
    };
  }
  addEventListener("popstate", onUrlChange);
}

function init(id: unknown, options: { spa?: boolean; debug?: boolean; ignorePaths?: string[] } = {}): void {
  if (advertiserId) return; // init is idempotent
  if (typeof id !== "string" || !id) throw new Error("kad init: advertiser id required");
  advertiserId = id;
  ignorePaths = Array.isArray(options.ignorePaths) ? options.ignorePaths : [];
  debug = !!options.debug || new URLSearchParams(location.search).has("kad_debug");
  captureTouch(location.href);
  if (options.spa) enableSpaTracking();
  addEventListener("pagehide", flushWithBeacon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushWithBeacon();
  });
  log(`init ${id} v${VERSION}`, { tabId: tabId() });
  flush(); // deliver anything left over from the previous page
}

function dispatch(command: unknown, ...args: unknown[]): void {
  try {
    if (command === "init") init(args[0], args[1] as never);
    else if (command === "track") track(String(args[0]), (args[1] as Params) ?? {});
    else log(`unknown command ${String(command)}`);
  } catch (err) {
    console.warn("[kad]", err); // tracking must never throw into the host page
  }
}

// ---------------------------------------------------------------------------
// Boot: take over from the stub and replay calls queued before we loaded
// ---------------------------------------------------------------------------
const stub: KadStub = window.kad ?? (Object.assign((...a: unknown[]) => void stub.queue!.push(a), { queue: [] }) as KadStub);
const queued = Array.from(stub.queue ?? []);
stub.queue = [];
stub.sendEvent = dispatch;
stub.getContext = () => ({ tabId: tabId(), touch: getJSON<AdTouch | null>(KEYS.touch, null) });
stub.version = VERSION;
window.kad = stub;
for (const call of queued) {
  const [command, ...args] = Array.from(call);
  dispatch(command, ...args);
}
dispatchEvent(new Event("kad:ready"));

export {};
