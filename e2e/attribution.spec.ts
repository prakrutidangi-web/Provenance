/**
 * End-to-end: a real browser drives the store; assertions read the API.
 * Covers the assignment's requirements plus the pixel/API merge and models.
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

/** The ad source this tab is attributed to, read from the pixel (what the old demo pill showed). */
async function expectTabSource(page: Page, source: string) {
  await expect
    .poll(() => page.evaluate(() => {
      const t = window.kad?.getContext?.()?.touch;
      return t ? (t.click_id ? "koah" : t.utm_source ?? "direct") : "direct";
    }))
    .toBe(source);
}

type Row = { source: string; sessions: number; purchasers: number; orders: number };

async function summary(request: APIRequestContext, model = "tab") {
  const res = await request.get(`/api/analytics/summary?model=${model}`);
  const rows = (await res.json()).rows as Row[];
  return Object.fromEntries(rows.map((r) => [r.source, r])) as Record<string, Row>;
}

/** Open the course from the catalog (client-side, so the tab keeps its ad), add it to the cart, check out. */
async function buy(page: Page, courseId = "prompting-for-devs") {
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page).toHaveURL(/\/courses(\?|$)/);
  await page.getByTestId(`course-${courseId}`).first().click();
  await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`));
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("added-to-cart")).toBeVisible();
  await page.getByTestId("cart-link").click();
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByTestId("checkout").click();
  await expect(page).toHaveURL(/\/thank-you/);
}

test.beforeEach(async ({ request, page }) => {
  await request.delete("/api/admin/data");
  await page.context().addInitScript(() => localStorage.removeItem("kernelcraft_cart"));
});

test("purchase on a later page is attributed to the landing page's UTM (and counted once)", async ({ page, request }) => {
  await page.goto("/?utm_source=koah&utm_campaign=rag_launch");
  await expectTabSource(page, "koah");
  await page.reload(); // must not create a second user or a second touch
  await buy(page);

  await expect.poll(async () => (await summary(request)).koah?.purchasers).toBe(1);
  expect((await summary(request)).koah).toMatchObject({ sessions: 1, purchasers: 1, orders: 1 });

  // The pixel's purchase event came from a URL without UTMs but carries koah.
  const events = await (await request.get("/api/events?via=pixel&name=Purchase")).json();
  expect(events[0].page_url).not.toContain("utm_source");
  expect(events[0].source).toBe("koah");
});

test("the server and pixel copies of a purchase merge into one conversion", async ({ page, request }) => {
  await page.goto("/?utm_source=google");
  await buy(page, "production-rag");
  await expect
    .poll(async () => (await (await request.get("/api/analytics/conversions")).json())[0]?.received_via)
    .toEqual(["api", "pixel"]);
  const conversions = await (await request.get("/api/analytics/conversions")).json();
  expect(conversions).toHaveLength(1);
  expect(conversions[0]).toMatchObject({ source: "google", value_cents: 12900 });
});

test("attribution is per tab; last-touch looks across tabs", async ({ context, request }) => {
  const adTab = await context.newPage();
  await adTab.goto("/?utm_source=facebook&utm_campaign=retargeting");
  await expectTabSource(adTab, "facebook");

  const newTab = await context.newPage(); // same browser = same user cookie, fresh sessionStorage
  await newTab.goto("/");
  await expectTabSource(newTab, "direct");
  await buy(newTab);

  await expect.poll(async () => (await summary(request, "tab")).direct?.purchasers).toBe(1);
  // The ad tab's PageView may still be in its pixel batch; ingestion is eventually consistent.
  await expect.poll(async () => (await summary(request, "last_touch_7d")).facebook?.purchasers).toBe(1);
  expect((await summary(request, "tab")).facebook.purchasers).toBe(0);
});

test("a Koah click id attributes to koah even without utm_source", async ({ page, request }) => {
  await page.goto("/?kad_cid=cid_e2e");
  await expectTabSource(page, "koah");
  await expect.poll(async () => (await summary(request)).koah?.sessions).toBe(1);
});

test("the dashboard shows the metrics and switches attribution models", async ({ context, page, request }) => {
  const adTab = await context.newPage();
  await adTab.goto("/?utm_source=facebook");
  await expectTabSource(adTab, "facebook");
  await page.goto("/");
  await buy(page);
  await expect.poll(async () => (await summary(request)).direct?.purchasers).toBe(1);

  await expect.poll(async () => (await summary(request, "last_touch_7d")).facebook?.purchasers).toBe(1);

  await page.goto("/admin");
  const fb = page.getByTestId("metrics-facebook");
  await expect(fb.locator("[data-col=sessions]")).toHaveText("1");
  await expect(fb.locator("[data-col=purchasers]")).toHaveText("0");

  await page.getByTestId("model-picker").selectOption("last_touch_7d");
  await expect(fb.locator("[data-col=purchasers]")).toHaveText("1");
  await expect(fb.locator("[data-col=rate]")).toHaveText("100.0%");
});

test("admin page views are not tracked as traffic", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page.getByText("Attribution dashboard")).toBeVisible();
  await page.waitForTimeout(1500);
  const events = await (await request.get("/api/events")).json();
  expect(events).toHaveLength(0);
});

test("the full Koah loop: sponsored ad in an AI chat app -> click -> purchase -> attributed to koah", async ({ context, page, request }) => {
  // The publisher (Penrose) shows a native ad matched to the question.
  await page.goto("/chat");
  await page.getByRole("button", { name: "How do I stop my support bot from making things up?" }).click();
  const ad = page.getByTestId("koah-ad").first();
  await expect(ad).toBeVisible({ timeout: 15_000 });
  const href = await ad.getAttribute("href");
  expect(href).toContain("utm_source=koah");
  expect(href).toContain("kad_cid=");

  // Clicking opens the advertiser in a new tab, like a real ad click.
  const [store] = await Promise.all([context.waitForEvent("page"), ad.click()]);
  await expect(store).toHaveURL(/\/courses\/production-rag\?/);
  await expectTabSource(store, "koah");
  await store.getByTestId("buy-now").click();
  await expect(store).toHaveURL(/\/checkout$/);
  await store.getByTestId("checkout").click();
  await expect(store).toHaveURL(/\/thank-you/);

  await expect.poll(async () => (await summary(request)).koah?.purchasers).toBe(1);
  const conversions = await (await request.get("/api/analytics/conversions")).json();
  expect(conversions[0]).toMatchObject({ source: "koah", campaign: "rag_launch", value_cents: 12900 });

  // The chat page itself is the publisher's app, so it's never counted as store traffic.
  const views = await (await request.get("/api/events?name=PageView")).json();
  expect(views.some((e: { page_url: string }) => e.page_url.includes("/chat"))).toBe(false);
});
