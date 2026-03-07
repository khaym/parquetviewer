import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Filter feature", () => {
  test("filter icon is visible in each column header", async ({ page }) => {
    const filterButtons = page.locator(".filter-icon");
    // 8 columns in the mock schema
    await expect(filterButtons).toHaveCount(8);
  });

  test("clicking filter icon opens dropdown", async ({ page }) => {
    const filterBtn = page.locator('button[aria-label="Filter name"]');
    await filterBtn.click();
    await expect(page.locator(".filter-dropdown")).toBeVisible();
  });

  test("applying a string equals filter reduces visible rows", async ({
    page,
  }) => {
    // Open filter for "name" column
    await page.locator('button[aria-label="Filter name"]').click();

    // Type value and apply
    const input = page.locator('.filter-dropdown input[aria-label="Filter value"]');
    await input.fill("Alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    // Should show only Alice rows (rows 1, 11, 21 → 3 of 30)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(3);
  });

  test("filter icon becomes highlighted when filter is active", async ({
    page,
  }) => {
    await page.locator('button[aria-label="Filter name"]').click();
    await page.locator('.filter-dropdown input[aria-label="Filter value"]').fill("Alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    const filterBtn = page.locator('button[aria-label="Filter name"]');
    await expect(filterBtn).toHaveClass(/filter-active/);
  });

  test("tab bar shows filtered row count", async ({ page }) => {
    await page.locator('button[aria-label="Filter name"]').click();
    await page.locator('.filter-dropdown input[aria-label="Filter value"]').fill("Alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    const tabBarInfo = page.locator(".tab-bar-info");
    await expect(tabBarInfo).toContainText("3 of 30 rows");
  });

  test("pagination shows filtered row info", async ({ page }) => {
    await page.locator('button[aria-label="Filter name"]').click();
    await page.locator('.filter-dropdown input[aria-label="Filter value"]').fill("Alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    const paginationInfo = page.locator(".pagination span");
    await expect(paginationInfo).toContainText("3 of 30 rows");
  });

  test("clearing filter restores all rows", async ({ page }) => {
    // Apply filter
    await page.locator('button[aria-label="Filter name"]').click();
    await page.locator('.filter-dropdown input[aria-label="Filter value"]').fill("Alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    // Verify filtered
    await expect(page.locator("table tbody tr")).toHaveCount(3);

    // Clear filter
    await page.locator('button[aria-label="Filter name"]').click();
    await page.locator(".filter-dropdown-actions button", { hasText: "Clear" }).click();

    // Should restore to 10 rows (page size)
    await expect(page.locator("table tbody tr")).toHaveCount(10);
  });

  test("boolean filter: isTrue filters correctly", async ({ page }) => {
    await page.locator('button[aria-label="Filter active"]').click();
    // Default operator should be isTrue
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    // active: i % 3 !== 0, so rows 2,3,5,6,8,9,... (20 out of 30)
    const tabBarInfo = page.locator(".tab-bar-info");
    await expect(tabBarInfo).toContainText("20 of 30 rows");
  });

  test("contains filter is case-insensitive", async ({ page }) => {
    await page.locator('button[aria-label="Filter name"]').click();

    // Change operator to contains
    const select = page.locator('.filter-dropdown select[aria-label="Filter operator"]');
    await select.selectOption("contains");

    await page.locator('.filter-dropdown input[aria-label="Filter value"]').fill("alice");
    await page.locator(".filter-dropdown-actions button", { hasText: "Apply" }).click();

    const tabBarInfo = page.locator(".tab-bar-info");
    await expect(tabBarInfo).toContainText("3 of 30 rows");
  });
});
