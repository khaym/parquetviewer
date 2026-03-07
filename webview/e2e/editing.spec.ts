import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Cell editing", () => {
  test("UTF8 cell: click to edit, type new value, Enter to commit", async ({
    page,
  }) => {
    // name column (2nd column), first row = "Alice"
    const nameCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator(".cell-value");
    await expect(nameCell).toContainText("Alice");

    // Click to enter edit mode
    await nameCell.click();

    // Input should appear
    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator("input.cell-input");
    await expect(input).toBeVisible();

    // Clear and type new value
    await input.fill("Updated");
    await input.press("Enter");

    // Value should be updated
    const updatedCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator(".cell-value");
    await expect(updatedCell).toContainText("Updated");
  });

  test("INT32 cell: edit with numeric value", async ({ page }) => {
    // id column (1st column), first row = 1
    const idCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");
    await expect(idCell).toContainText("1");

    await idCell.click();

    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator("input.cell-input");
    await expect(input).toBeVisible();

    await input.fill("999");
    await input.press("Enter");

    const updatedCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .first()
      .locator(".cell-value");
    await expect(updatedCell).toContainText("999");
  });

  test("BOOLEAN cell: click toggles value", async ({ page }) => {
    // active column (3rd column), first row: i=0, i%3 !== 0 => false
    const boolCellLocator = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(2)
      .locator(".cell-value");
    await expect(boolCellLocator).toHaveText("false");

    // Click to toggle — mock processes async via setTimeout
    await boolCellLocator.click();

    // Wait for the toggled value to appear
    await expect(boolCellLocator).toHaveText("true");
  });

  test("NULL cell: click to edit, enter value, commit", async ({ page }) => {
    // Row 5 (index 4) has null for score (nullable FLOAT)
    // score is column index 3
    const nullCell = page
      .locator("table tbody tr")
      .nth(4)
      .locator("td")
      .nth(3)
      .locator(".cell-value");
    await expect(nullCell.locator(".null-value")).toHaveText("NULL");

    // Click to edit
    await nullCell.click();

    const input = page
      .locator("table tbody tr")
      .nth(4)
      .locator("td")
      .nth(3)
      .locator("input.cell-input");
    await expect(input).toBeVisible();

    await input.fill("42.5");
    await input.press("Enter");

    // Should now show the value
    const updatedCell = page
      .locator("table tbody tr")
      .nth(4)
      .locator("td")
      .nth(3)
      .locator(".cell-value");
    await expect(updatedCell).toContainText("42.5");
  });

  test("Escape cancels edit without changing value", async ({ page }) => {
    const nameCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator(".cell-value");
    const originalText = await nameCell.textContent();

    await nameCell.click();

    const input = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator("input.cell-input");
    await input.fill("ShouldNotSave");
    await input.press("Escape");

    const restoredCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .locator(".cell-value");
    await expect(restoredCell).toHaveText(originalText!);
  });
});
