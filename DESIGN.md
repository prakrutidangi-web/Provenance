# Design: UTM conversion attribution

**Status:** implemented · **Scope:** take-home, built to mirror how Koah's conversion tracking works in production

**Demo cast (both fictional):** *Kernelcraft*, a course platform for engineers, is the **advertiser**. *Penrose*, an AI assistant, is the **publisher** that shows Koah's native ad. That matches Koah's real marketplace: AI apps on one side, tech and online-service brands on the other.

## 1. Problem

An advertiser runs ads on Google, Koah and Facebook and wants to measure, independently of the platforms, for each one:

- **User sessions**: unique users who arrived via the platform's ads.
- **Purchases**: unique users who bought after arriving that way.
- **Conversion rate**: purchases ÷ user sessions.

The hard part is that the `utm_source` tag is only on the landing URL. The purchase usually happens several pages later. The assignment fixes the rule: attribute within the same browser tab.

### Goals

- Correct numbers under real-world mess: reloads, double clicks, retries, ad blockers, bots, typos in UTMs, events arriving out of order.
- The same shape as Koah's product: a script-tag pixel, a server-side Conversion API, and deduplication between them.
- Attribution models that can be switched and re-run over historical data.

### Non-goals

- Multi-tenant advertiser management, auth on the dashboard, payments.
- Running at Koah's volume. Section 10 covers how that would change things.

## 2. Architecture

```mermaid
flowchart LR
  subgraph "Publisher: Penrose (AI chat)"
    AD["Sponsored card<br/>utm_source=koah · kad_cid"]
  end
  AD -- "click (new tab)" --> S
  subgraph Browser
    S[Kernelcraft pages] -- "kad('track', …)" --> P[pixel.js<br/>outbox · batching · retries]
  end
  subgraph "Advertiser server (Kernelcraft's backend)"
    O[POST /api/orders<br/>prices order, mints event_id]
  end
  subgraph "Tracking service"
    E1[POST /kad/e<br/>pixel endpoint]
    E2[POST /api/v1/conversion_events<br/>Conversion API · Bearer key]
    I[ingest()<br/>single write path]
    A[Attribution engine<br/>query-time models]
  end
  DB[(Postgres<br/>raw_events · touches<br/>conversions · orders)]
  D[Admin dashboard]

  P -- "text/plain JSON, keepalive / sendBeacon" --> E1
  S -- checkout --> O
  O -- "server-side Purchase<br/>(same event_id)" --> I
  O -. "event_id" .-> S
  E1 --> I
  E2 --> I
  I --> DB
  DB --> A --> D
```

Both channels go through one function, `ingest()`, so validation, idempotency and the pixel/API merge live in exactly one place.

## 3. Data model

| Table | Job | Key decisions |
|---|---|---|
| `raw_events` | Append-only log of everything received, from both channels. Feeds the debugger and the funnel. | `UNIQUE (advertiser_id, via, event_id)` makes retries idempotent per channel. Bots are stored with a flag, not dropped. |
| `touches` | One row per ad landing (UTM params or `kad_cid`). The thing conversions are credited to. | The pixel generates `touch_id`. `ON CONFLICT DO NOTHING` keeps the first sighting. `source` is normalized; `source_raw` keeps the original. |
| `conversions` | One row per logical purchase, merged across channels. | `PRIMARY KEY (advertiser_id, event_id)`. `received_via` records `{api,pixel}`, which proves deduplication. |
| `orders` | The advertiser's own business records. | Carries the `event_id` shared with the pixel. |

**Attribution is not stored.** It's a join computed at query time (section 5), which keeps the write path simple and makes model changes free.

## 4. Identity: who is the user?

There are two IDs with different scopes:

| ID | Where | Scope | Used for |
|---|---|---|---|
| `koah_uid` | **HTTP-only first-party cookie**, set by the server | The browser, for 1 year | "Unique users" in every metric; joining pixel events to server events |
| `tab_id` + touch | `sessionStorage`, managed by the pixel | One tab | The assignment's "same tab" attribution |

**Why a server-set HTTP-only cookie** (Koah's docs recommend it too):

- JavaScript can't read or tamper with it.
- Safari's ITP caps cookies *set by JavaScript* at 7 days.
- Because the server sets it, the checkout request and the pixel requests carry the same ID. That's what lets a server-side Purchase and a browser-side Purchase describe the same person.

**Why `sessionStorage` for attribution:** the requirement is "same tab". sessionStorage is scoped to exactly one tab, survives reloads and in-tab navigation, and is cleared when the tab closes.

## 5. Attribution

### Capturing touches

On every page view (including SPA route changes), the pixel checks the URL for `utm_*` or `kad_cid`.

- If they're there, it creates a touch `{touch_id, utm_source, utm_medium, utm_campaign, utm_content, click_id, landing_url}` and saves it to sessionStorage, replacing any older one.
- A reload of the same landing URL is not treated as a new click.
- Every event from the tab carries the current touch, so the purchase event knows its ad even though its URL has no UTMs.
- A `kad_cid` click ID beats a UTM tag. Click IDs are minted by the ad server; UTMs are typed by humans and are often wrong.

### Models (switchable in the dashboard)

| Model | Rule | Why it exists |
|---|---|---|
| **Same tab** (default) | The touch active in the tab where the purchase happened. No touch means direct. | The assignment's definition. Conservative: it misses users who come back later. |
| **Last touch, 7 days** | The user's most recent ad touch within 7 days before the purchase, in any tab. | The industry default ("last non-direct click"). |
| **First touch, 30 days** | The user's first ad touch within 30 days. | Credits the channel that introduced the customer. |

All three are one `LEFT JOIN LATERAL … ORDER BY occurred_at LIMIT 1` from `conversions` to `touches`, with a different `WHERE` and sort direction (`server/src/analytics/attribution.ts`).

**Fallback:** if the pixel never reported a purchase (an ad blocker), only the server copy exists, and it has no tab context. In that case the "Same tab" model falls back to last-touch for that one conversion instead of calling it direct.

The seed data is designed so the models disagree. For example, a user who clicks a Facebook ad, leaves, and returns directly two days later to buy is *direct* under "Same tab" but *facebook* under "Last touch".

### Metric definitions

- **User sessions(source)** = distinct `koah_uid` with a non-bot touch from that source in the range. Direct = distinct users with a page view in a tab without a touch.
- **Purchases(source)** = distinct `koah_uid` whose conversions are credited to that source under the selected model.
- **Conversion rate** = purchases ÷ sessions. Under a window model, a purchase can be credited to a click from before the date range, so short ranges can exceed 100%. That's documented in the UI rather than hidden.

## 6. Pixel + Conversion API deduplication

The flow mirrors Koah's documented "combined" setup:

1. The browser posts the cart to `POST /api/orders`. The server prices it (it never trusts browser prices), creates the order, and mints `event_id = purchase_<order_id>`.
2. The server sends a **server-side Purchase** with that `event_id`. This copy survives ad blockers.
3. The response returns the `event_id`. The pixel sends **its** Purchase with the same ID.
4. `ingest()` upserts both into one `conversions` row. Each channel contributes what only it knows:
   - The pixel provides `touch_id` (tab context).
   - The API provides the trusted `value`, `currency`, `products` and the `kad_cid` cookie. If both channels send a value, the API's wins.
   - `received_via` becomes `{api,pixel}`.
   - Arrival order doesn't matter: `COALESCE` and `LEAST` make the merge commutative.

The integration test `the same purchase from both channels becomes one conversion` sends a tampered pixel value of $0.01 and asserts the stored value is the server's $290.00.

## 7. Delivery guarantees

**The pixel gives at-least-once delivery:**

- **Outbox.** Events go into a sessionStorage outbox before sending, so a page change doesn't lose them. The next page sends whatever is left.
- **Batching.** Up to 20 events per request, flushed after 1 second. Conversion-type events flush immediately.
- **Retries.** Exponential backoff with jitter (1s, 2s, 4s… capped at 30s) on network errors, 5xx and 429. Other 4xx responses are dropped, because the server will never accept them.
- **Unload.** On `pagehide` or a hidden tab, remaining events go out with `sendBeacon`.
- **One request at a time,** so the first response's cookie is in place before the next request.

**The server is idempotent:** event IDs are unique per channel. At-least-once delivery plus idempotent writes means each event is effectively counted once.

**Partial success:** a batch is validated event by event. One malformed event returns `invalid` for its index, and the rest are stored.

## 8. Time

Server receive time is wrong for batched or delayed events. An ad click waiting in a tab's outbox can arrive *after* the purchase it caused. Browser clocks can't be trusted either; they can be hours off.

The pixel sends `client_ts` per event and `sent_at` per batch. The server computes:

```
occurred_at = server_receive_time − clamp(sent_at − client_ts, 0, 7 days)
```

Only the *delay* is measured on the browser clock, so clock skew cancels out. This is the same technique as Segment's `sentAt` correction, and it's unit-tested with a browser clock 3 hours fast. Conversion API events may send their own `event_time`; it's accepted only within the last 7 days to 5 minutes ahead, and the receive time is used otherwise.

## 9. Bugs found by the end-to-end tests

These are worth recording because unit tests didn't catch them; only a real browser did.

1. **Identity race.** The user cookie was first set lazily, on the first API response. A fast user could click "Place order" before the pixel's first batch went out. Both requests arrived without a cookie and minted **two different user IDs for one person**, so the purchase lost its ad touch and showed as direct.

   *Fix:* set the cookie on the HTML document response, before any script runs. That's an Express middleware in production and a Vite plugin in dev. Koah's docs prescribe the same thing: the advertiser's server sets it on every page load.

2. **Out-of-order events.** With identity fixed, the "last touch across tabs" test still failed. The ad tab's PageView was waiting in its 1-second batch when the purchase happened in another tab, so by receive time the click came *after* the purchase.

   *Fix:* the clock-skew-corrected timestamps in section 8.

## 10. Trade-offs

| Decision | Alternative | Why this one |
|---|---|---|
| Attribution at query time | Materialize attribution on write | Models are switchable and retroactive; bug fixes need no backfill. Costs CPU per dashboard load, which is fine at this scale; see section 11. |
| sessionStorage for tab attribution | localStorage or cookie | The requirement says same tab. A cookie-based touch is the "Last touch" model, which is also offered. |
| HTTP-only server cookie for user ID | localStorage UUID | Survives ITP, can't be tampered with, and is shared with the server-side events. Costs a server hop to set it. |
| One Postgres for everything | Separate event store | Simple and transactional. Fine for thousands of events per second, not billions per day. |
| Count bots, then filter them | Drop at ingest | Rules can be tuned against stored data; nothing is lost on a false positive. |
| `text/plain` pixel POSTs | `application/json` | A "simple" CORS request skips the preflight when the pixel is cross-origin (the real Koah setup). |

## 11. Scaling to Koah's volume

The logic stays the same; the plumbing changes:

```
pixel / CAPI ──► stateless ingest API (validate, enrich, assign occurred_at)
                    │  202 Accepted immediately
                    ▼
                  Kafka (topic per event type, keyed by user_id for ordering)
                    ├──► dedupe (Redis SETNX on event_id, TTL 7d) ──► ClickHouse raw_events (ReplacingMergeTree)
                    ├──► touch + conversion consumers ──► ClickHouse / Postgres
                    └──► Conversion export back to ad platforms (Google, Meta CAPI)
Dashboards ◄── ClickHouse materialized views (daily rollups per advertiser × source × campaign × model)
```

- **Ingest** returns `202` before any database write; Kafka absorbs spikes. Rate limiting moves to Redis or the edge (Cloudflare), keyed by IP plus advertiser.
- **ClickHouse** for the event tables: columnar storage makes `COUNT(DISTINCT user_id) GROUP BY source` over billions of rows cheap. `uniqCombined` gives approximate distinct counts where exactness isn't needed.
- **Attribution** becomes an incremental job. When a conversion lands, look up the user's touches (a key-value store of recent touches per user) and write the credited row for each model. Dashboards then read pre-aggregated rollups.
- **Late data:** windowed recomputation (re-attribute the last N days nightly) handles events that arrive after their rollup was built.
- **Observability:** the structured pino logs with request IDs ship to Loki. Key metrics would be ingest lag, dedupe rate, pixel-to-API match rate (a drop means a broken pixel install) and the bot ratio.

## 12. Privacy

- No PII is collected. IDs are random UUIDs; there's no fingerprinting and no third-party cookies.
- A production system would add consent mode (no IDs before consent, with the server-side channel still counting modeled conversions), retention limits on `raw_events`, and hashed email or phone only with consent, for cross-device matching and platform conversion APIs.

## 13. What I'd build next

1. **Click-ID round-trip.** Send conversions with `kad_cid` back to Koah's ad server so its bidding can optimize.
2. **Cross-device identity.** Link `koah_uid` to a logged-in user ID.
3. **Ad spend import.** Pull spend so the dashboard can show CPA and ROAS (return on ad spend), not just volume.
4. **More attribution models.** Multi-touch models (linear, position-based) and a view-through window for impressions.
5. **Fraud signals.** Click-to-landing latency, IP reputation, and conversion-rate anomaly alerts per campaign.
