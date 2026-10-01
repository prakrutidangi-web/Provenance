/**
 * Every ad leads to the right page, with the right attribution.
 *
 *  - Koah ads in the Penrose chat: each topic promotes a real course, and a
 *    click opens that course page with utm_source=koah + kad_cid.
 *  - In-store "Sponsored" slots: each opens the promoted course, reports a
 *    PromoClick, and does NOT steal credit from the ad that brought the user in.
 *  - The demo's simulated Google / Facebook ads land on real pages.
 */
import { test, expect, type Page } from "@playwright/test";
import { TOPICS } from "../web/src/pages/chat/topics";

/** The ad source this tab is attributed to, read from the pixel (what the old demo pill showed). */
async function expectTabSource(page: Page, source: string) {
  await expect
    .poll(() => page.evaluate(() => {
      const t = window.kad?.getContext?.()?.touch;
      return t ? (t.click_id ? "koah" : t.utm_source ?? "direct") : "direct";
    }))
    .toBe(source);
}

test.beforeEach(async ({ request, page }) => {
  await request.delete("/api/admin/data");
  await page.context().addInitScript(() => localStorage.removeItem("kernelcraft_cart"));
});

/** The course page for `id` actually rendered (not a 404 or the wrong course). */
async function expectCoursePage(page: Page, id: string, name: string) {
  await expect(page).toHaveURL(new RegExp(`/courses/${id}(\\?|$)`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test("every Penrose topic promotes a course that exists", async ({ request }) => {
  const { products } = await (await request.get("/api/catalog")).json();
  const ids = new Set(products.map((p: { id: string }) => p.id));
  for (const t of TOPICS) expect(ids.has(t.courseId), `${t.id} -> ${t.courseId}`).toBe(true);
  // Campaign names are unique, so the dashboard can tell the ads apart.
  expect(new Set(TOPICS.map((t) => t.campaign)).size).toBe(TOPICS.length);
});

const CHAT_CASES = [
  { q: "My pods keep crashing in Kubernetes", id: "kubernetes-production", name: "Kubernetes in Production" },
  { q: "How do I stop prompt injection in my agent?", id: "llm-security", name: "Securing LLM Apps" },
  { q: "should I fine-tune llama with lora?", id: "fine-tuning-llms", name: "Fine-Tuning Open LLMs" },
];

for (const c of CHAT_CASES) {
  test(`Penrose ad for “${c.q}” opens ${c.id} attributed to koah`, async ({ context, page }) => {
    await page.goto("/chat");
    await page.getByLabel("Message Penrose").fill(c.q);
    await page.keyboard.press("Enter");
    // The ad appears once the answer has finished streaming.
    await expect(page.getByTestId("koah-ad")).toHaveCount(1, { timeout: 15_000 });
    const ad = page.getByTestId("koah-ad").last();
    const [store] = await Promise.all([context.waitForEvent("page"), ad.click()]);
    await expectCoursePage(store, c.id, c.name);
    expect(store.url()).toContain("utm_source=koah");
    expect(store.url()).toContain("kad_cid=kcid_");
    await expectTabSource(store, "koah");
  });
}

test("every in-store sponsored slot opens its course", async ({ page, request }) => {
  test.setTimeout(180_000); // ~20 page loads
  const { products, tracks } = await (await request.get("/api/catalog")).json();
  const nameOf = (id: string) => products.find((p: { id: string }) => p.id === id).name;
  const pages = ["/", "/courses", "/courses/production-rag", ...tracks.map((t: { id: string }) => `/courses?track=${t.id}`)];
  let checked = 0;
  for (const url of pages) {
    await page.goto(url);
    const slots = page.locator("[data-testid^=sponsored-]");
    await expect(slots.first()).toBeVisible();
    const n = await slots.count();
    for (let i = 0; i < n; i++) {
      await page.goto(url);
      const slot = page.locator("[data-testid^=sponsored-]").nth(i);
      const id = (await slot.getAttribute("data-course"))!;
      expect(await slot.getAttribute("href")).toBe(`/courses/${id}`); // internal link, no UTMs
      await slot.click();
      await expectCoursePage(page, id, nameOf(id));
      checked++;
    }
  }
  expect(checked).toBeGreaterThanOrEqual(pages.length);
});

test("a sponsored click keeps the original ad's credit", async ({ page, request }) => {
  await page.goto("/courses?utm_source=facebook&utm_campaign=lookalike_devs&track=devops");
  const slot = page.getByTestId("sponsored-search_top");
  const id = (await slot.getAttribute("data-course"))!;
  await slot.click();
  await expect(page).toHaveURL(new RegExp(`/courses/${id}$`));
  await expectTabSource(page, "facebook");
  await page.getByTestId("buy-now").click();
  await page.getByTestId("checkout").click();
  await expect(page).toHaveURL(/\/thank-you/);

  await expect.poll(async () => (await (await request.get("/api/analytics/conversions")).json())[0]?.source).toBe("facebook");
  await expect
    .poll(async () => (await (await request.get("/api/events?name=PromoClick")).json()).length)
    .toBeGreaterThan(0);
  const [click] = await (await request.get("/api/events?name=PromoClick")).json();
  expect(click.source).toBe("facebook");
});

const DEMO_ADS = [
  { href: "/courses/production-rag?utm_source=google&utm_medium=cpc&utm_campaign=search_ai_courses&utm_content=rag_text_ad", source: "google", heading: "Production RAG" },
  { href: "/courses/react-native-apps?utm_source=facebook&utm_medium=social&utm_campaign=lookalike_devs&utm_content=feed_video", source: "facebook", heading: "React Native Apps" },
];

for (const ad of DEMO_ADS) {
  test(`simulated ${ad.source} ad lands on ${ad.heading}`, async ({ page }) => {
    await page.goto(ad.href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ad.heading);
    await expectTabSource(page, ad.source);
  });
}

test("the dashboard's Koah link opens Penrose and asks the question for you", async ({ page }) => {
  await page.goto("/admin");
  const href = await page.getByRole("link", { name: /Koah: ask Penrose/ }).getAttribute("href");
  await page.goto(href!);
  await expect(page.getByTestId("koah-ad")).toBeVisible({ timeout: 15_000 });
  expect(await page.getByTestId("koah-ad").getAttribute("href")).toContain("/courses/production-rag?utm_source=koah");
  expect(page.url()).not.toContain("ask="); // the param is cleaned up so a reload doesn't ask twice
});

test("Stop ends the answer early with no ad, New chat starts fresh", async ({ page }) => {
  await page.goto("/chat");
  await page.getByLabel("Message Penrose").fill("My pods keep crashing in Kubernetes");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Stop generating" }).click();
  await expect(page.getByTestId("koah-ad")).toHaveCount(0);
  await page.getByRole("button", { name: "New chat" }).first().click();
  await expect(page.getByRole("heading", { name: "What are you building?" })).toBeVisible();
});
