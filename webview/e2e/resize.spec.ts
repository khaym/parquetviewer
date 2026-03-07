import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("table tbody tr");
});

test.describe("Column resize", () => {
  test("resize handles exist on each header", async ({ page }) => {
    const headers = page.locator("table thead th");
    const headerCount = await headers.count();

    const resizeHandles = page.locator("table thead th .resize-handle");
    await expect(resizeHandles).toHaveCount(headerCount);
  });

  test("dragging resize handle changes column width", async ({ page }) => {
    const firstHeader = page.locator("table thead th").first();
    const initialWidth = await firstHeader.evaluate(
      (el) => el.getBoundingClientRect().width,
    );

    const resizeHandle = firstHeader.locator(".resize-handle");
    const handleBox = await resizeHandle.boundingBox();
    expect(handleBox).toBeTruthy();

    // Drag the handle 100px to the right
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2 + 100,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.up();

    const newWidth = await firstHeader.evaluate(
      (el) => el.getBoundingClientRect().width,
    );

    // Width should have increased
    expect(newWidth).toBeGreaterThan(initialWidth);
  });
});
