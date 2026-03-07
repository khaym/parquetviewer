import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Schema view", () => {
  test("tab bar shows Data and Schema tabs", async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText("Data");
    await expect(tabs.nth(1)).toHaveText("Schema");
  });

  test("Data tab is active by default", async ({ page }) => {
    const dataTab = page.locator('[role="tab"]', { hasText: "Data" });
    await expect(dataTab).toHaveAttribute("aria-selected", "true");
  });

  test("clicking Schema tab shows schema view", async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();

    // Schema table headers
    await expect(page.locator(".schema-view th").nth(0)).toHaveText("Name");
    await expect(page.locator(".schema-view th").nth(1)).toHaveText("Type");
    await expect(page.locator(".schema-view th").nth(2)).toHaveText("Nullable");
  });

  test("schema view lists all 8 columns", async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();

    const rows = page.locator(".schema-view tbody tr");
    await expect(rows).toHaveCount(8);
  });

  test("schema view shows column details", async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();

    // First column: id / INT32 / No
    const firstRow = page.locator(".schema-view tbody tr").first();
    await expect(firstRow.locator("td").nth(0)).toHaveText("id");
    await expect(firstRow.locator("td").nth(1)).toHaveText("INT32");
    await expect(firstRow.locator("td").nth(2)).toHaveText("No");
  });

  test("schema view shows column count", async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();

    await expect(page.locator(".schema-summary")).toHaveText("8 columns");
  });

  test("clicking Data tab switches back to data table", async ({ page }) => {
    // Switch to schema
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();
    await expect(page.locator(".schema-view")).toBeVisible();

    // Switch back to data
    await page.locator('[role="tab"]', { hasText: "Data" }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(10);
  });

  test("pagination is hidden when schema tab is active", async ({ page }) => {
    await page.locator('[role="tab"]', { hasText: "Schema" }).click();

    await expect(page.locator(".pagination")).not.toBeVisible();
  });

  test("tab bar shows total row count", async ({ page }) => {
    await expect(page.locator(".tab-bar-info")).toContainText("30 rows");
  });
});
