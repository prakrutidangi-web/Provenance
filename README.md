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

## Where the ads are, and where they lead

| Ad | Where you see it | Lands on | Attribution |
|---|---|---|---|
| Koah native ad | Penrose chat (`/chat`), under each answer, matched to the question (38 topics) | the matched course, e.g. `/courses/kubernetes-production` | `utm_source=koah`, `utm_campaign=<topic>`, `kad_cid` |
| Google search ad (simulated) | dashboard, "Simulate an ad click" | `/courses/production-rag` or the home page | `utm_source=google&utm_medium=cpc` |
| Facebook ad (simulated) | dashboard, "Simulate an ad click" | `/courses/react-native-apps` or checkout (retargeting) | `utm_source=facebook&utm_medium=social` |
| In-store "Sponsored" listing | home (category tabs), catalog and search results, course pages | the promoted course | none on purpose (see below) |

In-store sponsored listings are internal promotions, so their links carry **no UTMs**. Putting UTMs on internal links would overwrite the tab's real source and steal the sale from the ad that actually brought the user in. They report `PromoView` and `PromoClick` events instead (`web/src/ads.ts`), and `e2e/ads.spec.ts` checks that every ad opens the right course with the right attribution.
