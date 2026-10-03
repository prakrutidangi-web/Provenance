/** Site basics: legal pages are linked and reachable, keyboard focus is visible, home search works. */
import { test, expect } from "@playwright/test";

test("footer links open the Terms and Privacy pages, which flag missing details as drafts", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await footer.getByRole("link", { name: "Terms of Service" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of Service");
  await expect(page.locator(".draft-tag").first()).toBeVisible();

  await page.locator("footer").getByRole("link", { name: "Privacy Policy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
  await expect(page.getByText("koah_uid")).toBeVisible();
});

test("keyboard focus is visible on buttons and links", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { width: parseFloat(s.outlineWidth), style: s.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(1);
});

test("the home search sends you to matching courses", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search courses").fill("kubernetes");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/courses\?q=kubernetes/);
  await expect(page.getByRole("link", { name: /Kubernetes in Production/ }).first()).toBeVisible();
});

test("an unknown course shows a useful message instead of a blank page", async ({ page }) => {
  await page.goto("/courses/does-not-exist");
  await expect(page.getByRole("heading", { name: "Course not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse courses" })).toBeVisible();
});

test("the dashboard explains an empty state, and Reset data asks before deleting", async ({ page, request }) => {
  await request.delete("/api/admin/data");
  await page.goto("/admin");
  await expect(page.getByText("No traffic in this range yet")).toBeVisible();

  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByText("Delete all data?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Reset data" })).toBeVisible();
});

test("the dashboard has its own bar, not the store header", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Kernelcraft store" })).toBeVisible();
  await expect(page.getByLabel("Search courses")).toHaveCount(0);
});

test("the Penrose assistant is on the home page and answers in place", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Postgres query is slow, where do I start?" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".penrose.is-embedded .msg-user")).toContainText("Postgres query is slow");
  await expect(page.locator(".penrose.is-embedded [data-testid=koah-ad]")).toBeVisible({ timeout: 20000 });
});
