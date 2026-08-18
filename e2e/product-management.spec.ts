import { test, expect } from "@playwright/test";

test.describe("Product Management", () => {
  test("loads the products tab with a list", async ({ page }) => {
    await page.goto("/product-management");
    await expect(page.getByRole("tab", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Product" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  });

  test("navigates to the add product form", async ({ page }) => {
    await page.goto("/product-management");
    await page.getByRole("button", { name: "Add Product" }).click();
    await expect(page).toHaveURL(/\/product-management\/products\/new/);
    await expect(page.getByRole("heading", { name: "Add Product" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Product" })).toBeVisible();
  });

  test("switches between all tabs", async ({ page }) => {
    await page.goto("/product-management");
    const tabs = [
      "Products",
      "Variants",
      "Categories",
      "Product Groups",
      "Brands",
      "UoMs",
      "Standards",
      "Variation Templates",
    ];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
  });
});
