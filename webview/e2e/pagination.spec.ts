import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Pagination", () => {
  test("shows initial page info", async ({ page }) => {
    const pageInfo = page.locator(".pagination span");
    await expect(pageInfo).toContainText("Page 1 of 3 (30 rows)");
  });

  test("Next goes to page 2, Previous goes back to page 1", async ({
    page,
  }) => {
    const nextButton = page.locator(".pagination button", { hasText: "Next" });
    const prevButton = page.locator(".pagination button", {
      hasText: "Previous",
    });
    const pageInfo = page.locator(".pagination span");

    // Go to page 2
    await nextButton.click();
    await expect(pageInfo).toContainText("Page 2 of 3");

    // Go back to page 1
    await prevButton.click();
    await expect(pageInfo).toContainText("Page 1 of 3");
  });

  test("Previous is disabled on first page", async ({ page }) => {
    const prevButton = page.locator(".pagination button", {
      hasText: "Previous",
    });
    await expect(prevButton).toBeDisabled();
  });

  test("Next is disabled on last page", async ({ page }) => {
    const nextButton = page.locator(".pagination button", { hasText: "Next" });
    const pageInfo = page.locator(".pagination span");

    // Navigate to last page (page 3)
    await nextButton.click();
    await expect(pageInfo).toContainText("Page 2 of 3");
    await nextButton.click();
    await expect(pageInfo).toContainText("Page 3 of 3");

    await expect(nextButton).toBeDisabled();
  });

  test("page size change: 50 rows shows all data in 1 page", async ({
    page,
  }) => {
    const pageSizeSelect = page.locator(".page-size-select");
    const pageInfo = page.locator(".pagination span");

    await pageSizeSelect.selectOption("50");
    await expect(pageInfo).toContainText("Page 1 of 1 (30 rows)");

    // All 30 rows visible
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(30);
  });

  test("page jump: enter 3 to go to page 3", async ({ page }) => {
    const jumpInput = page.locator('.pagination input[type="number"]');
    const pageInfo = page.locator(".pagination span");

    await jumpInput.fill("3");
    await jumpInput.press("Enter");
    await expect(pageInfo).toContainText("Page 3 of 3");
  });
});
