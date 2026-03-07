import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Filter + edit combination", () => {
  test("editing a filtered row updates the value in place", async ({
    page,
  }) => {
    // Apply filter: name equals "Alice"
    await page.locator('button[aria-label="Filter name"]').click();
    await page
      .locator('.filter-dropdown input[aria-label="Filter value"]')
      .fill("Alice");
    await page
      .locator(".filter-dropdown-actions button", { hasText: "Apply" })
      .click();

    // Should show only Alice rows
    const filteredRows = page.locator("table tbody tr");
    await expect(filteredRows).toHaveCount(3);

    // Edit the name of the first filtered row
    const nameCell = filteredRows
      .first()
      .locator("td")
      .nth(1)
      .locator(".cell-value");
    await expect(nameCell).toContainText("Alice");

    await nameCell.click();
    const input = filteredRows
      .first()
      .locator("td")
      .nth(1)
      .locator("input.cell-input");
    await input.fill("Alice Updated");
    await input.press("Enter");

    // After edit, mock re-applies filter. "Alice Updated" no longer equals "Alice"
    // so filtered rows should decrease
    await expect(filteredRows).toHaveCount(2);
  });

  test("clearing filter after editing shows all rows with edits", async ({
    page,
  }) => {
    // Apply filter: name equals "Bob"
    await page.locator('button[aria-label="Filter name"]').click();
    await page
      .locator('.filter-dropdown input[aria-label="Filter value"]')
      .fill("Bob");
    await page
      .locator(".filter-dropdown-actions button", { hasText: "Apply" })
      .click();

    // Edit first Bob row's score
    const scoreCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .locator(".cell-value");
    await scoreCell.click();
    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .locator("input.cell-input");
    await input.fill("999");
    await input.press("Enter");

    // Clear filter
    await page.locator('button[aria-label="Filter name"]').click();
    await page
      .locator(".filter-dropdown-actions button", { hasText: "Clear" })
      .click();

    // Should show all rows (page size 10)
    await expect(page.locator("table tbody tr")).toHaveCount(10);
  });

  test("validation error persists while filter is active", async ({
    page,
  }) => {
    // Apply filter: name contains "A" (Alice rows)
    await page.locator('button[aria-label="Filter name"]').click();
    const select = page.locator(
      '.filter-dropdown select[aria-label="Filter operator"]',
    );
    await select.selectOption("contains");
    await page
      .locator('.filter-dropdown input[aria-label="Filter value"]')
      .fill("A");
    await page
      .locator(".filter-dropdown-actions button", { hasText: "Apply" })
      .click();

    // Enter invalid value in id column of first filtered row
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
    await input.fill("not-a-number");
    await input.press("Enter");

    // Validation error should show
    const errorCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".validation-error");
    await expect(errorCell).toBeVisible();

    // Error banner should be visible
    await expect(page.locator(".error-banner")).toBeVisible();
  });
});
