/**
 * Catalog filters behave like a real marketplace:
 *  - every group is multi-select (options OR-ed inside a group, groups AND-ed),
 *  - each option's count is what you'd get with your other filters applied,
 *  - every course on screen (organic or sponsored) matches the filters.
 * Expectations are computed from the live catalog, not hard-coded.
 */
import { test, expect, type Page } from "@playwright/test";

type Course = { id: string; kind: string; track: string; level: string; name: string };

const opt = (page: Page, group: string, label: string) =>
  page.getByRole("group", { name: group }).locator("label.filter-opt", { hasText: new RegExp(`^${label}\\s*\\d+$`) });

async function shownIds(page: Page) {
  const organic = await page.locator(".results [data-testid^=course-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.slice(7)));
  const sponsored = await page.locator(".results [data-testid^=sponsored-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-course")!));
  return [...sponsored, ...organic];
}

test("category and level filters are multi-select with faceted counts", async ({ page, request }) => {
  const { products } = await (await request.get("/api/catalog")).json();
  const courses = (products as Course[]).filter((p) => p.kind === "course");
  const where = (tracks: string[], levels: string[]) =>
    courses.filter((c) => (!tracks.length || tracks.includes(c.track)) && (!levels.length || levels.includes(c.level)));

  await page.goto("/courses");
  await expect(page.locator(".result-count")).toHaveText(`${courses.length} courses`);

  // Two categories at once: both stay checked, results are the union.
  await opt(page, "Category", "AI Engineering").click();
  await opt(page, "Category", "Data").click();
  await expect(page).toHaveURL(/track=ai%2Cdata|track=ai,data/);
  await expect(opt(page, "Category", "AI Engineering").locator("input")).toBeChecked();
  await expect(opt(page, "Category", "Data").locator("input")).toBeChecked();
  await expect(page.locator(".result-count")).toHaveText(`${where(["ai", "data"], []).length} courses`);

  // Level counts reflect the selected categories, not the whole catalog.
  await expect(opt(page, "Level", "Beginner").locator(".filter-n")).toHaveText(String(where(["ai", "data"], ["Beginner"]).length));
  // Category counts reflect the other groups too (here: no level yet, so the full category size).
  await expect(opt(page, "Category", "Frontend").locator(".filter-n")).toHaveText(String(where(["frontend"], []).length));

  // Two levels at once, AND-ed with the categories.
  await opt(page, "Level", "Beginner").click();
  await opt(page, "Level", "Advanced").click();
  const expected = where(["ai", "data"], ["Beginner", "Advanced"]);
  await expect(page.locator(".result-count")).toHaveText(`${expected.length} courses`);
  await expect(opt(page, "Category", "Frontend").locator(".filter-n")).toHaveText(String(where(["frontend"], ["Beginner", "Advanced"]).length));

  // Everything on screen, sponsored included, matches; nothing is shown twice.
  const ids = await shownIds(page);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.sort()).toEqual(expected.map((c) => c.id).sort());

  // Unchecking one category narrows back down.
  await opt(page, "Category", "AI Engineering").click();
  await expect(page.locator(".result-count")).toHaveText(`${where(["data"], ["Beginner", "Advanced"]).length} courses`);
});

test("an option with no results is disabled, and Clear filters keeps the search", async ({ page }) => {
  await page.goto("/courses?q=kubernetes");
  await expect(opt(page, "Category", "Mobile").locator("input")).toBeDisabled();
  await opt(page, "Category", "DevOps & Cloud").click();
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/courses\?q=kubernetes$/);
});
