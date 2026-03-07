import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Validation error display", () => {
  test("shows validation error when non-numeric value is entered for INT32 column", async ({
    page,
  }) => {
    // id column (1st column), first row = 1
    const idCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");
    await expect(idCell).toContainText("1");

    // Click to edit
    await idCell.click();
    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("input.cell-input");
    await expect(input).toBeVisible();

    // Type non-numeric value and commit
    await input.fill("abc");
    await input.press("Enter");

    // Should show validation error (red border + error banner)
    const errorCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".validation-error");
    await expect(errorCell).toBeVisible();

    // Error banner should appear
    const errorBanner = page.locator(".error-banner");
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText("Validation error");
  });

  test("validation error is cleared when cell is re-edited with valid value", async ({
    page,
  }) => {
    const idCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");

    // Enter invalid value
    await idCell.click();
    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("input.cell-input");
    await input.fill("abc");
    await input.press("Enter");

    // Verify error appears
    await expect(
      page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .first()
        .locator(".validation-error"),
    ).toBeVisible();

    // Now enter a valid value
    const errorCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".validation-error");
    await errorCell.click();

    const input2 = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("input.cell-input");
    await input2.fill("42");
    await input2.press("Enter");

    // Error should be gone, value should be updated
    const updatedCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");
    await expect(updatedCell).toContainText("42");
    await expect(updatedCell).not.toHaveClass(/validation-error/);
  });

  test("error banner can be dismissed", async ({ page }) => {
    const idCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");

    await idCell.click();
    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("input.cell-input");
    await input.fill("abc");
    await input.press("Enter");

    const errorBanner = page.locator(".error-banner");
    await expect(errorBanner).toBeVisible();

    // Click dismiss button
    await errorBanner.locator("button").click();
    await expect(errorBanner).not.toBeVisible();
  });
});
