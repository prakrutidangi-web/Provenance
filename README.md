# Provenance: UTM conversion attribution
Submission by Prakruti Dangi
Provenance measures, independently of the ad platforms, how well each platform's ads convert. For Google, Koah and Facebook (plus direct visits) it answers three questions:

- **User sessions:** how many unique users arrived through that platform's ads.
- **Purchases:** how many of those users went on to buy.
- **Conversion rate:** purchases divided by user sessions.

The hard part is that `utm_source` is only on the landing URL, while the purchase usually happens several pages later. Provenance keeps the ad's UTM parameters with the browser tab, so a purchase made pages later is still credited to the ad that opened the tab.

The repo contains three apps that share one backend:

| App | What it is | Where |
|---|---|---|
| **Kernelcraft** | The advertiser's website: a practice store with 40 video courses and an All-Access plan. Nothing is charged. This is where the tracking pixel runs. | `/` |
| **Penrose** | A practice AI chat app that plays the *publisher*. It shows a labeled "Sponsored" ad matched to the question, the way Koah ads appear in AI chats. | `/chat` |
| **Dashboard** | The admin page with the metrics and the raw event list. No login, as the brief allows. | `/admin` |

The tracking works the way Koah's own does: a script-tag **pixel** in the browser, a server-side **Conversion API**, and **de-duplication** between them by a shared event ID.

---

## Run it

You need Node 20+ and Docker.

```bash
npm run setup      # install packages and build the pixel
npm run db:up      # Postgres 16 on localhost:55432
npm run dev        # pixel watcher + API (:4180) + web (:5180)
npm run seed       # optional: 60 days of realistic traffic (about 1,500 users)
```

| Open | URL |
|---|---|
| Penrose chat: click the sponsored card to start a tracked visit | http://localhost:5180/chat |
| Kernelcraft as if arriving from a Koah ad | http://localhost:5180/?utm_source=koah&utm_campaign=rag_launch |
| Dashboard | http://localhost:5180/admin |

Add `&kad_debug=1` to any store URL to see the pixel's log in the browser console. `npm run seed` wipes existing data first.

A `Dockerfile` and `render.yaml` are included if you want to host a copy; they are not needed to run it locally.

**Tests:** `npx playwright install chromium` once, then `npm test`. That runs 20 server tests (against a real Postgres) and 26 browser tests.

---

## What happens when someone buys

Follow one user from ad click to purchase:

1. **Ad click.** The user clicks a Koah ad in Penrose and lands on `/courses/production-rag?utm_source=koah&utm_medium=ai_chat&utm_campaign=rag_launch&kad_cid=…`.
2. **The server gives the browser an ID.** The page response sets an HTTP-only cookie, `koah_uid`, holding a random user ID. If the URL has `kad_cid` (Koah's click ID), it is kept in a second cookie.
3. **The pixel records a touch.** `pixel/src/pixel.ts` reads the UTM parameters and click ID and saves them in the tab's **sessionStorage** as the tab's *touch*. sessionStorage belongs to one tab, which is exactly the scope the brief asks for. A new tab starts with no touch.
4. **Every event carries the touch.** PageView, ViewContent, AddToCart and the rest are queued in the browser and sent in batches to `POST /kad/e`. Each event includes the tab's touch, so pages without UTMs (the cart, checkout) still know which ad opened the tab.
5. **Checkout.** `POST /api/orders` prices the order on the server (the browser's prices are never trusted), saves it, and sends a **server-side Purchase** to the same ingestion code that the public Conversion API uses. It returns an `event_id`.
6. **The pixel reports the same purchase.** The browser sends its own Purchase with that same `event_id`. The two copies **merge into one conversion**: the server's copy supplies the trusted value, and the pixel's copy supplies which ad touch the tab had.
7. **The dashboard reads it.** Attribution is worked out when a query runs, by joining each conversion to the touch that gets credit (see below).

Why these choices:

- **sessionStorage for the ad.** The brief says to attribute within the same tab. Cookies would leak an ad's credit into every tab, and a second tab opened directly would wrongly count as the ad.
- **A server-set HTTP-only cookie for the user.** JavaScript can't read or change it, Safari doesn't shorten it the way it does cookies set from JavaScript, and the server sees the same ID at checkout, so browser and server events agree on who the user is.
- **One event ID for both channels.** If an ad blocker stops the pixel, the server's Purchase still arrives. If both arrive, they are counted once.

---

## How the ads work

Penrose and Kernelcraft are the two sides of Koah's marketplace.

| Ad | Where you see it | Where it leads | How it is credited |
|---|---|---|---|
| **Koah ad** | Under Penrose's answers at `/chat`, matched to the question (38 topics, e.g. a Kubernetes question shows the Kubernetes course) | The matched course | `utm_source=koah`, `utm_medium=ai_chat`, `utm_campaign=<topic>`, plus a `kad_cid` click ID |
| **Google and Facebook ads** (simulated) | Dashboard, under "Simulate an ad click" | A course, the home page or checkout | `utm_source=google` / `facebook` with the matching `utm_medium` |
| **Sponsored listings inside the store** | Home, catalog, search results and course pages | The promoted course | None, on purpose (explained below) |

**Penrose** (`web/src/pages/chat/`): the answers are pre-written. `topics.ts` maps keywords in the question to a topic, and each topic names the course to promote. No keyword match means no ad. The card always says "Sponsored".

**In-store sponsored listings** (`web/src/ads.ts`, `SponsoredCard.tsx`) are internal promotions, so their links carry **no UTMs**. Adding UTMs to an internal link would overwrite the tab's real source and steal the sale from the ad that actually brought the user in. They report their own `PromoView` and `PromoClick` events instead. A test (`e2e/ads.spec.ts`) checks that a sponsored click keeps the original ad's credit.

---

## How the dashboard works

Open `/admin`. It reads from the endpoints under `/api/analytics/*` and `/api/events`.

**The three metrics, per platform** (Google, Koah, Facebook, Direct):

- **User sessions:** distinct users with at least one visit credited to that platform in the date range. Reloads and clicking around count once. *Direct* means a page view in a tab with no ad touch.
- **Purchasers:** distinct users whose purchase is credited to that platform.
- **Conversion rate:** purchasers divided by user sessions.

**Choosing a model.** The dropdown changes which touch gets credit for a purchase. Nothing is stored, so switching re-runs every historical purchase.

| Model | Credit goes to |
|---|---|
| **Same tab** (default, the brief's rule) | The touch active in the tab where the purchase happened. A tab with no touch is *direct*, even if the user clicked an ad in another tab. If the pixel never reported the purchase (blocked), it falls back to the user's last ad touch in the previous 7 days. |
| **Last touch, 7 days** | The user's most recent ad touch before buying, in any tab. |
| **First touch, 30 days** | The channel that first introduced the user. |

**On the page:**

- a one-sentence summary ("N visitors led to M purchases, a X% conversion rate, and platform P converts best")
- metric cards that compare with the previous period and drive the trend chart
- a platform table with a "low volume" tag when a platform has too few sessions to trust the rate
- a funnel (viewed, added to cart, started checkout, purchased) per platform
- campaign and recent-conversion tables
- the **event debugger**: the raw list of every page view and purchase, with the platform, the product bought (purchases only), the page URL, the user, the tab and the channel (`pixel` or `api`)
- a "Simulate an ad click" strip that opens the store as a Google, Facebook or Koah visitor

Crawler traffic is stored and flagged but left out of every number.

---

## Reading the code

Start here, in this order:

| File | Why it matters |
|---|---|
| `pixel/src/pixel.ts` | The browser side: captures the touch, queues events, batches them, retries, and falls back to `sendBeacon` when the page closes |
| `server/src/ingest/service.ts` | `ingest()`, the single write path for the pixel and the API: stores events once per `(channel, event_id)`, records touches, and merges purchases into `conversions` |
| `server/src/ingest/routes.ts` | `POST /kad/e` (pixel), `POST /api/v1/conversion_events` (Conversion API) and the `<noscript>` image |
| `server/src/analytics/attribution.ts` | The attribution models, as SQL. The comments at the top explain each |
| `server/src/orders/routes.ts` | Kernelcraft's checkout: prices the order and sends the server-side Purchase |
| `server/src/lib/identity.ts` | The `koah_uid` and click-ID cookies |
| `web/src/pages/chat/` | Penrose and how a question picks an ad |
| `web/src/pages/admin/` | The dashboard and event debugger |

Full layout:

```
pixel/src/pixel.ts           the kad() pixel
server/
  migrations/001_init.sql    raw_events · touches · conversions · orders
  src/ingest/                pixel endpoint, Conversion API, validation, ingest()
  src/orders/                Kernelcraft's backend: catalog and checkout
  src/domain/                catalog (the server is the source of truth for prices), UTM normalization
  src/analytics/             attribution models and dashboard queries
  src/lib/                   cookies, bot filter, rate limiter, logger
  src/seed.ts                realistic traffic generator
  test/api.test.ts           integration tests on real Postgres
web/src/
  pages/                     Kernelcraft: Home, Courses, CoursePage, Pricing, Checkout, ThankYou, Legal
  pages/chat/                Penrose
  pages/admin/               dashboard
  ads.ts, components/        in-store sponsored listings
e2e/                         browser tests (attribution, ads, filters, site)
```

**What is stored.** Four tables:

- `raw_events`: every event, with its name, ID, channel, user, tab, touch, page URL, referrer, user agent, a bot flag, and its properties (value, currency, products, order ID).
- `touches`: one row per ad arrival, with the normalized source (`google`, `koah` or `facebook`), the raw `utm_source`, medium, campaign, content, click ID and landing URL.
- `conversions`: one row per purchase, merged across channels, with `received_via` showing whether it came from the pixel, the API or both.
- `orders`: Kernelcraft's own order records.

`utm_source` values are normalized (`"Google "` and `"KOAH"` become `google` and `koah`), and unknown values are kept but not credited to a platform.

**Handling messy data:** retries and double clicks are stored once. One invalid event in a batch doesn't reject the others. Browser clock drift is corrected from the batch's send time. Events can arrive out of order, and the dashboard still gets the right answer. Bots are flagged rather than deleted.

For deeper reasoning (trade-offs, how it would scale, bugs the tests found), see [`DESIGN.md`](DESIGN.md).

---

## API

| Endpoint | Purpose |
|---|---|
| `POST /kad/e` | Pixel batch ingest (`{advertiser_id, sent_at, events[]}`, up to 50 events) |
| `GET /kad/e?id=…&ev=PageView` | `<noscript>` 1×1 image fallback |
| `POST /api/v1/conversion_events` | Conversion API: `Authorization: Bearer <key>`, up to 100 events, and a `messages` list for rejected events |
| `GET /api/catalog` | Courses and categories |
| `POST /api/orders` | Checkout: prices the order on the server and returns the `event_id` |
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

Event names are Koah's fixed set (PageView, ViewContent, Search, AddToCart, AddToWishlist, InitiateCheckout, Purchase, Lead, SignUp). Kernelcraft also sends two internal ones, `PromoView` and `PromoClick`, for its in-store sponsored listings.
