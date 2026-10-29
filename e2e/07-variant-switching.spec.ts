import { test, expect } from "@playwright/test";
import { closeTestDb } from "./helpers/test-utils.js";

test.describe("Storefront Variant Switching and Standalone Listing Navigation", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("customer switches Size and Model options on product detail page without reverts or lost state", async ({
    page,
  }) => {
    // 1. Navigate to the SM product page in souled-store
    await page.goto("/stores/souled-store/products/sm");
    await page.waitForLoadState("domcontentloaded");

    const titleLocator = page.locator('[data-testid="product-title"]');
    await expect(titleLocator).toBeVisible({ timeout: 15_000 });

    // 2. Verify Size and Model option pickers are rendered
    const sizePillS = page.locator('[data-testid="pill-size-s"]');
    const sizePillM = page.locator('[data-testid="pill-size-m"]');
    const sizePillL = page.locator('[data-testid="pill-size-l"]');
    const modelPillBlack = page.locator('[data-testid="pill-model-black"]');
    const modelPillBlue = page.locator('[data-testid="pill-model-blue"]');
    const modelPillRed = page.locator('[data-testid="pill-model-red"]');

    await expect(sizePillS).toBeVisible();
    await expect(sizePillM).toBeVisible();
    await expect(sizePillL).toBeVisible();
    await expect(modelPillBlack).toBeVisible();
    await expect(modelPillBlue).toBeVisible();
    await expect(modelPillRed).toBeVisible();

    const skuLocator = page.locator('[data-testid="product-sku"]');
    await expect(skuLocator).toBeVisible();

    // 3. Click Size = M: must resolve M variant and MUST NOT revert to S
    await sizePillM.click();
    await page.waitForTimeout(300); // Give frame time for any unwanted effect triggers
    await expect(sizePillM).toHaveAttribute("aria-checked", "true");
    await expect(skuLocator).toContainText("M");

    // 4. Click Size = L: must resolve L variant and MUST NOT revert
    await sizePillL.click();
    await page.waitForTimeout(300);
    await expect(sizePillL).toHaveAttribute("aria-checked", "true");
    await expect(skuLocator).toContainText("L");

    // 5. Click Model = Blue: must switch to Blue listing and preserve Size = L
    await modelPillBlue.click();
    await page.waitForTimeout(300);
    await expect(modelPillBlue).toHaveAttribute("aria-checked", "true");
    await expect(sizePillL).toHaveAttribute("aria-checked", "true");
    await expect(skuLocator).toContainText("BLUE");
    await expect(skuLocator).toContainText("L");
    await expect(page).toHaveURL(/variant=/);

    // 6. Click Size = S while in Blue listing: must update to S / Blue
    await sizePillS.click();
    await page.waitForTimeout(300);
    await expect(sizePillS).toHaveAttribute("aria-checked", "true");
    await expect(modelPillBlue).toHaveAttribute("aria-checked", "true");
    await expect(skuLocator).toContainText("SM-S-BLUE");

    // 7. Click Model = Red: must switch to Red listing and preserve Size = S
    await modelPillRed.click();
    await page.waitForTimeout(300);
    await expect(modelPillRed).toHaveAttribute("aria-checked", "true");
    await expect(sizePillS).toHaveAttribute("aria-checked", "true");
    await expect(skuLocator).toContainText("SM-S-RED");

    // 8. Add to cart: verifies button adds the exact resolved variant
    const addToCartBtn = page.locator('[data-testid="add-to-cart-button"]');
    await expect(addToCartBtn).toBeEnabled();
    await addToCartBtn.click();
    await expect(page.locator('[data-testid="add-to-cart-success"]')).toBeVisible({ timeout: 10_000 });
  });
});
