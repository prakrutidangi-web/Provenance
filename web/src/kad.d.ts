/** Types for the global pixel (see /pixel/src/pixel.ts). */
interface KadTouch {
  touch_id: string;
  utm_source: string | null;
  utm_campaign: string | null;
  click_id: string | null;
  landing_url: string;
}

interface KadFn {
  (command: "init", advertiserId: string, options?: { spa?: boolean; debug?: boolean; ignorePaths?: string[] }): void;
  (command: "track", eventName: string, params?: Record<string, unknown> & { eventId?: string }): void;
  getContext?: () => { tabId: string; touch: KadTouch | null };
}

interface Window {
  kad: KadFn;
}
