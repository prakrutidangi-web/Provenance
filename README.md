# Koah Labs Take-Home: UTM Conversion Attribution

This is a conversion-tracking system built the way Koah's own works. It has:

- a script-tag **pixel** (`kad()`)
- a server-side **Conversion API**
- **deduplication** of the two by a shared `event_id`
- an **attribution engine** with switchable models
- an admin **dashboard**

It runs on both sides of Koah's marketplace:

- **Kernelcraft** (the *advertiser*): a fictional course platform for engineers building with AI. It's laid out like Udemy or Coursera: 40 courses across 8 categories plus an All-Access plan, with search, category tabs, a filter sidebar and in-store "Sponsored" listings. It's where users browse and buy.
- **Penrose** (the *publisher*): a fictional AI assistant at `/chat`. It shows a native, labeled "Sponsored" Koah ad matched to what the user asks about. Clicking the ad opens Kernelcraft with `utm_source=koah` and a `kad_cid` click ID, and the attribution system takes over from there.

> **Design doc:** [`DESIGN.md`](DESIGN.md) covers the architecture, data model, trade-offs, two bugs the end-to-end tests caught, and how this scales.

**Stack:** TypeScript throughout. React (Vite) for the site, the chat app and the dashboard, Node and Express 5 for the API, PostgreSQL 16, esbuild for the pixel, Playwright for browser tests, GitHub Actions for CI.

---

## Quick start

You need Node 20+ and Docker.

```bash
npm run setup      # install all packages + build the pixel
npm run db:up      # Postgres 16 on localhost:55432
npm run dev        # pixel watcher + API (:4180) + web (:5180)
```

| What | URL |
|---|---|
| **Start here:** Penrose, an AI chat app showing a Koah ad | http://localhost:5180/chat |
| Kernelcraft, arriving from a Koah ad | http://localhost:5180/?utm_source=koah&utm_campaign=rag_launch |
| Kernelcraft with the pixel's debug log in the console | add `&kad_debug=1` to any URL |
| Dashboard | http://localhost:5180/admin |

Run `npm run seed` to generate 60 days of realistic traffic (about 1,500 users), so the dashboard can compare each 30-day window with the one before. It wipes existing data first. Run `npm run db:reset` to drop the database volume and start fresh.

### Tests

```bash
npx playwright install chromium   # first time only
npm test                          # 20 server tests (unit + integration on real Postgres) + 26 browser tests (attribution flows, every ad opening the right course, the catalog filters, legal pages and keyboard focus)
```

---

## How it fits together

```
Browser                         Kernelcraft backend           Tracking service
───────                         ─────────────                 ────────────────
index.html loads pixel.js ─── PageView, ViewContent, AddToCart, … ──► POST /kad/e ──┐
                                                                                     │
Cart "Place order" ──► POST /api/orders                                              ├─► ingest() ─► Postgres
                        prices order, mints event_id ─── server-side Purchase ───────┤
                ◄────── returns event_id                                             │
pixel Purchase (same event_id) ─────────────────────────────────► POST /kad/e ──────┘
                                                                  (merged into ONE conversion)

Dashboard ◄── /api/analytics/* ◄── attribution engine (query-time: same tab | last touch 7d | first touch 30d)
```

## Design

- **Visual system:** matches Koah's own site (koahlabs.com) while following a stricter brief. A warm cream page (`#faf8f5`, no pure white), navy text (`#1c2a51`) and one accent, Koah yellow (`#f8d870`), used only for the main action and anything sponsored. Instrument Sans for text and Instrument Serif for italic display accents, both bundled with the app. Corners are 2 to 4px, with pills only on buttons. Depth comes from 1px borders, with no shadows. The course posters are the main visual. The dashboard's four series colors stay distinct because charts need them. Tokens and the final visual layer are in `web/src/design.css`; `web/src/styles.css` holds the older base rules.
- **Accessibility:** an axe-core WCAG A and AA scan of the home, catalog, course, pricing, checkout, legal, chat and dashboard pages reports no violations. Focus rings are visible, inputs have labels, and motion respects `prefers-reduced-motion`.
- **Legal pages:** `/terms` and `/privacy` describe what the demo really does. Missing details (operator, governing law, retention, contact) are marked Draft and need review before any real use.
- **Course posters:** illustrated per course by `web/scripts/posters.mjs`. Each is a topic metaphor in its track's colors, written as SVG and rendered to JPEG with headless Chromium. Regenerate with `npm --prefix web run posters`.
- **Photos:** Unsplash, credited in the footer. Web-sized copies are in `web/public/images`; the originals are in `photos-original/`.
- **Interface rules:** checked against Vercel's web-interface guidelines (focus states, labels, reduced motion, typography, URL state).

## Project layout

```
pixel/src/pixel.ts           The kad() pixel: touch capture, outbox, batching, retries, SPA tracking
server/
  migrations/001_init.sql    raw_events · touches · conversions · orders
  src/ingest/                Pixel endpoint, Conversion API, validation, the single ingest() write path
  src/orders/                Kernelcraft's backend: catalog + checkout (sends the server-side Purchase)
  src/domain/catalog.ts      Courses, tracks and prices (the server is the source of truth for prices)
  src/analytics/             Attribution engine + dashboard queries + event debugger
  src/lib/                   Identity cookies, bot filter, rate limiter, logger
  src/seed.ts                Realistic traffic generator
  test/api.test.ts           Integration tests (dedupe, models, auth, bots, ...)
web/src/
  pages/                     Kernelcraft: Home, Courses, CoursePage, Pricing, Checkout, ThankYou
  pages/chat/                Penrose (demo publisher): chat UI, canned answers, keyword intent matching for the ad
  pages/admin/               Dashboard: metrics, trend chart, funnel, campaigns, conversions, debugger
e2e/attribution.spec.ts      Browser tests for the assignment's requirements
.github/workflows/ci.yml     CI: typecheck, tests against a Postgres service, e2e
```

## API

| Endpoint | Purpose |
|---|---|
| `POST /kad/e` | Pixel batch ingest (`{advertiser_id, sent_at, events[]}`, up to 50 events). Sets the `koah_uid` and `koah_kad_cid` HTTP-only cookies. |
| `GET /kad/e?id=…&ev=PageView` | `<noscript>` 1×1 GIF fallback |
| `POST /api/v1/conversion_events` | Conversion API: `Authorization: Bearer <key>`, up to 100 events, partial success |
| `GET /api/catalog` | Kernelcraft's tracks and courses |
| `POST /api/orders` | Checkout: prices the order server-side and returns `event_id` for the pixel |
| `GET /api/analytics/{summary,timeseries,funnel,campaigns,conversions}?model=&from=&to=&tz=` | Dashboard data |
| `GET /api/events?via=&name=&source=` | Event debugger |
| `GET /healthz` | Liveness and database check |

Try the Conversion API:

```bash
curl -s localhost:4180/api/v1/conversion_events \
  -H "Authorization: Bearer sk_test_kernelcraft" -H "Content-Type: application/json" \
  -d '{"events":[{"event_name":"Purchase","event_id":"demo-1","user_id":"u-123",
       "properties":{"value":42.5,"currency":"USD","order_id":"ord_demo"}}]}'
```

---

## Questions a reviewer might ask

**Is Kernelcraft a real store?** No. It is a practice store. Courses, instructors and prices are made up, nothing is sold, and no payment is taken. Placing an order saves a record in the local database so a purchase can be attributed.

**What is Penrose?** A fictional AI assistant for engineers. Its answers are pre-written. The sponsored card under an answer is a Koah-style ad that links back to a Kernelcraft course with `utm_source=koah` and a click id.

**What does the site store about a visitor?** A random visitor ID in a first-party cookie, the ad parameters from the landing URL, the pages opened and the products viewed. No names, emails or card numbers. The Privacy Policy lists it all. The dashboard's event debugger shows the raw events.

**Where is the dashboard?** `/admin`. It is deliberately not linked from the store.

## Demo script (for the video)

1. Open **/chat** (Penrose). Point out the "Sponsored" card under the answer: it's matched to the question. Ask about something else, such as "how do I evaluate my LLM app", and the ad changes. Ask something unrelated and no ad appears.
2. Click **View course**. Kernelcraft opens in a new tab with `utm_source=koah&kad_cid=…` in the URL.
3. Browse to another course (the URL no longer has UTMs), add to cart and check out.
4. Open **/admin**. Koah shows the session and the purchase, and the conversion row says **api + pixel, merged**.
5. Switch attribution models to show how credit moves between platforms.
6. On the dashboard, under **Simulate an ad click**, click **Facebook: React Native**. It lands on that course with `utm_source=facebook`. Open **Explore**: the top result is a **Sponsored** listing. Click it and buy: the sale still goes to facebook, and the debugger shows a `PromoClick`.

### Where the ads are, and where they lead

| Ad | Where you see it | Lands on | Attribution |
|---|---|---|---|
| Koah native ad | Penrose chat (`/chat`), under each answer, matched to the question (38 topics) | the matched course, e.g. `/courses/kubernetes-production` | `utm_source=koah`, `utm_campaign=<topic>`, `kad_cid` |
| Google search ad (simulated) | dashboard, "Simulate an ad click" | `/courses/production-rag` or the home page | `utm_source=google&utm_medium=cpc` |
| Facebook ad (simulated) | dashboard, "Simulate an ad click" | `/courses/react-native-apps` or checkout (retargeting) | `utm_source=facebook&utm_medium=social` |
| In-store "Sponsored" listing | home (category tabs), catalog and search results, course pages | the promoted course | none on purpose (see below) |

In-store sponsored listings are internal promotions, so their links carry **no UTMs**. Putting UTMs on internal links would overwrite the tab's real source and steal the sale from the ad that actually brought the user in. They report `PromoView` and `PromoClick` events instead (`web/src/ads.ts`), and `e2e/ads.spec.ts` checks that every ad opens the right course with the right attribution.

## Notes for the video

**1. Backend design for recording page views and purchases**

There are two channels into one write path.

- **The pixel** queues events in a sessionStorage outbox and sends them in batches to `/kad/e`, with retries and `sendBeacon` when the page closes.
- **Kernelcraft's server** sends a server-side Purchase when it creates the order.
- **`ingest()` handles both.** It validates each event (partial success), appends it to `raw_events` idempotently by `(channel, event_id)`, records the ad touch, and upserts purchases into `conversions`.
- **Deduplication.** The pixel and server copies of a purchase share an `event_id` and merge into one row. The pixel contributes the tab's ad touch; the server contributes the trusted price.
- **Metrics** are computed at query time by the attribution engine.

**2. Fields stored per event, and what else would help**

- **Stored:** `event_name`, `event_id`, `via`, `user_id`, `tab_id`, `touch_id`, `page_url`, `referrer`, `user_agent`, `is_bot`, `properties` (value, currency, products, order_id), and a clock-corrected `occurred_at` plus `received_at`.
- **Each touch also stores:** source (normalized and raw), medium, campaign, content, click ID and landing URL.
- **Useful in a real system:** consent state, IP-derived geo, device type, hashed email for cross-device matching and platform conversion APIs, ad spend for ROAS, and an impression or view-through ID.

**3. Tracking one user across pages**

- **The user** is identified by a server-set **HTTP-only first-party cookie** (`koah_uid`), as Koah's docs recommend. It survives Safari's ITP, can't be tampered with, and the server sees it on checkout too, so the browser and server copies of an event agree on who the user is. It's set on the HTML response, which fixed an identity race found in testing.
- **Attribution** lives in **sessionStorage**, which is scoped to exactly one tab, matching the requirement. Every event from the tab carries the touch, so a purchase page without UTMs still knows its ad.

**4. Additional attribution features for a real system**

- Click-ID round-trip to Koah's bidder
- Multi-touch and view-through models
- Cross-device identity
- Ad spend import for ROAS
- Fraud signals
- Consent mode
- At scale: Kafka → ClickHouse with incremental attribution (see DESIGN.md §11)
