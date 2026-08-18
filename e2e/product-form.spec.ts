import { test, expect, type Page } from "@playwright/test";

async function pickCombobox(page: Page, label: string, text: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.click();
  await input.fill(text);
  await page.locator('[data-slot="combobox-item"]', { hasText: text }).first().click();
  await expect(input).not.toBeEmpty();
}

test.describe("Product Management", () => {
  test("creates a single product end to end", async ({ page }) => {
    const name = `E2E Test Product ${Date.now()}`;

    await page.goto("/product-management/products/new");
    await expect(page.getByRole("heading", { name: "Add Product" })).toBeVisible();

    await page.getByLabel("Product Description", { exact: true }).fill(name);

    await pickCombobox(page, "Category", "Phone");
    await pickCombobox(page, "Product Group", "001 —");
    await pickCombobox(page, "Unit of Measure", "PCS");

    await page.getByPlaceholder("0.00").first().fill("15.50");
    await page.getByPlaceholder("Remark...").fill("Created by Playwright E2E");

    await page.getByRole("button", { name: "Save Product" }).click();

    await expect(page).toHaveURL(/\/product-management$/);
    await expect(page.getByText("Product created.")).toBeVisible();

    await page.getByPlaceholder("Search by name, code, group, or brand...").fill(name);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible({ timeout: 15_000 });
  });
});