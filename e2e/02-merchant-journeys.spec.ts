import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  uniqueSlug,
  registerMerchant,
  completeMerchantOnboarding,
  loginMerchant,
  logoutMerchant,
  closeTestDb,
} from "./helpers/test-utils.js";

test.describe("Merchant Browser Journeys", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("unauthenticated user accessing /merchant is redirected to /merchant/login", async ({
    page,
  }) => {
    await page.goto("/merchant");
    await expect(page).toHaveURL(/\/merchant\/login/, { timeout: 15_000 });
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test("unauthenticated user accessing /merchant/products is redirected to /merchant/login", async ({
    page,
  }) => {
    await page.goto("/merchant/products");
    await expect(page).toHaveURL(/\/merchant\/login/, { timeout: 15_000 });
  });

  test("merchant registration, onboarding, store creation, store switcher, settings edit, and logout/login flow", async ({
    page,
  }) => {
    const email = uniqueEmail("journey_merchant");
    const password = "ValidPassword123!";
    const primaryStoreName = "Primary Test Boutique";
    const primarySlug = uniqueSlug("boutique");

    // 1. Register new merchant account
    await registerMerchant(page, {
      name: "Alice Merchant",
      email,
      password,
    });

    // 2. Complete 3-step onboarding
    await completeMerchantOnboarding(page, {
      orgName: "Alice Commercial Group",
      storeName: primaryStoreName,
      slug: primarySlug,
      currency: "USD",
    });

    // 3. Verify reach merchant dashboard
    await expect(page).toHaveURL(/\/merchant$/, { timeout: 10_000 });
    await expect(page.locator("text=MERCHANT CONSOLE").first()).toBeVisible();
    await expect(page.locator("#merchant-store-select")).toBeVisible();

    // 4. Create a second store
    await page.goto("/merchant/stores/new");
    await page.waitForLoadState("domcontentloaded");

    const secondStoreName = "Second Test Outpost";
    const secondSlug = uniqueSlug("outpost");

    await page.fill('input[name="name"]', secondStoreName);
    const slugInput = page.locator('input[name="slug"]');
    await slugInput.fill("");
    await slugInput.fill(secondSlug);
    await page.selectOption('select[name="status"]', "ACTIVE");

    await page.click('button[type="submit"]');

    // Verify creation success
    await expect(page.locator("text=Store Activated")).toBeVisible({ timeout: 10_000 });
    await page.click('a:has-text("Go to Dashboard")');
    await page.waitForLoadState("domcontentloaded");

    // 5. Switch between authorized stores
    const select = page.locator("#merchant-store-select");
    await expect(select).toBeVisible();

    // Switch back to primary store
    const primaryOption = select.locator("option").filter({ hasText: primaryStoreName }).first();
    const primaryVal = await primaryOption.getAttribute("value");
    if (primaryVal) {
      await select.selectOption(primaryVal);
    }
    await page.waitForTimeout(500);

    // Switch to second store
    const secondOption = select.locator("option").filter({ hasText: secondStoreName }).first();
    const secondVal = await secondOption.getAttribute("value");
    if (secondVal) {
      await select.selectOption(secondVal);
    }
    await page.waitForTimeout(500);

    // 6. Edit store details in settings and verify changes persist
    await page.goto("/merchant/settings");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=General Store Settings")).toBeVisible({ timeout: 15_000 });

    const updatedStoreName = "Second Outpost Updated";
    const nameInput = page.locator("#settings-name");
    await nameInput.fill("");
    await nameInput.fill(updatedStoreName);

    const descInput = page.locator("#settings-description");
    await descInput.fill("Updated bio for our second commerce outpost.");

    // Click Save Settings
    const saveBtn = page.locator('button:has-text("Save Settings")');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Expect success message
    await expect(
      page.locator("text=Store settings successfully updated."),
    ).toBeVisible({ timeout: 10_000 });

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("#settings-name")).toHaveValue(updatedStoreName);
    await expect(page.locator("#settings-description")).toHaveValue(
      "Updated bio for our second commerce outpost.",
    );

    // 7. Log out
    await logoutMerchant(page);

    // 8. Log in again with credentials
    await loginMerchant(page, {
      email,
      password,
    });

    // Verify back on dashboard with authorized access
    await expect(page).toHaveURL(/\/merchant/, { timeout: 10_000 });
    await expect(page.locator("text=MERCHANT CONSOLE").first()).toBeVisible();
  });

  test("unauthorized store access is rejected for merchants not belonging to the store", async ({
    page,
  }) => {
    // Register merchant Bob
    const bobEmail = uniqueEmail("bob_merchant");
    const password = "ValidPassword123!";
    const bobStoreName = "Bob Store Only";
    const bobSlug = uniqueSlug("bobstore");

    await registerMerchant(page, {
      name: "Bob Merchant",
      email: bobEmail,
      password,
    });

    await completeMerchantOnboarding(page, {
      orgName: "Bob Group",
      storeName: bobStoreName,
      slug: bobSlug,
    });

    await expect(page).toHaveURL(/\/merchant$/, { timeout: 10_000 });

    // Bob tries to access an unauthorized store's settings by navigating with a foreign storeId in local storage or query
    // Let's attempt an unauthorized API call through page.evaluate using the browser's current authenticated session
    const response = await page.evaluate(async () => {
      // souled-store is not Bob's store
      const res = await fetch("/api/v1/stores/00000000-0000-0000-0000-000000000001/products", {
        headers: { "Content-Type": "application/json" },
      });
      return { status: res.status };
    });

    // The backend multi-tenant guard must reject foreign store access (403 Forbidden or 404)
    expect([403, 404]).toContain(response.status);
  });
});
