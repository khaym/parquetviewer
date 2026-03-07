import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Wait for the table to render with data
  await page.waitForSelector("table tbody tr");
});

test.describe("Table display", () => {
  test("shows 8 header columns", async ({ page }) => {
    const headers = page.locator("table thead th");
    await expect(headers).toHaveCount(8);

    const expectedNames = [
      "id",
      "name",
      "active",
      "score",
      "big_number",
      "created_date",
      "updated_at",
      "notes",
    ];
    for (let i = 0; i < expectedNames.length; i++) {
      await expect(headers.nth(i)).toContainText(expectedNames[i]);
    }
  });

  test("shows type labels for each column", async ({ page }) => {
    const typeLabels = page.locator("table thead th .column-type");
    await expect(typeLabels).toHaveCount(8);

    const expectedTypes = [
      "INT32",
      "UTF8",
      "BOOLEAN",
      "FLOAT",
      "INT64",
      "DATE",
      "TIMESTAMP_MILLIS",
      "UTF8",
    ];
    for (let i = 0; i < expectedTypes.length; i++) {
      await expect(typeLabels.nth(i)).toHaveText(expectedTypes[i]);
    }
  });

  test("score column values are displayed", async ({ page }) => {
    // First row score: Math.round((0 * 7.3 + 1.5) * 100) / 100 = 1.5
    const firstRowScoreCell = page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(3);
    await expect(firstRowScoreCell).toContainText("1.5");

    // Verify multiple score cells have content (not empty)
    const scoreCells = page.locator("table tbody tr td:nth-child(4) .cell-value");
    const count = await scoreCells.count();
    expect(count).toBeGreaterThan(0);

    // Check that non-null score cells have numeric values
    for (let i = 0; i < count; i++) {
      const text = await scoreCells.nth(i).textContent();
      expect(text).toBeTruthy();
    }
  });

  test("numeric cells have cell-numeric class", async ({ page }) => {
    // id column (INT32) cells should be numeric
    const idCells = page.locator(
      "table tbody tr td:nth-child(1) .cell-numeric",
    );
    const count = await idCells.count();
    expect(count).toBe(10);

    // score column (FLOAT) cells should be numeric
    const scoreCells = page.locator(
      "table tbody tr td:nth-child(4) .cell-numeric",
    );
    const scoreCount = await scoreCells.count();
    expect(scoreCount).toBeGreaterThan(0);
  });

  test("NULL cells have null-value class", async ({ page }) => {
    // Every 5th row (index 4, 9, ...) has null values for nullable columns
    const nullCells = page.locator("table tbody .null-value");
    const count = await nullCells.count();
    expect(count).toBeGreaterThan(0);

    // Verify NULL text
    const firstNull = nullCells.first();
    await expect(firstNull).toHaveText("NULL");
  });

  test("shows 10 rows (default page size)", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10);
  });

  test("table is horizontally scrollable when wider than container", async ({
    page,
  }) => {
    const container = page.locator(".table-container");
    const table = page.locator(".table-container table");

    const containerBox = await container.boundingBox();
    const tableBox = await table.boundingBox();

    expect(containerBox).toBeTruthy();
    expect(tableBox).toBeTruthy();

    // table should have overflow:auto on container
    const overflow = await container.evaluate(
      (el) => getComputedStyle(el).overflow,
    );
    expect(overflow).toBe("auto");
  });
});
