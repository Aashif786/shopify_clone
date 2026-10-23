import { test, expect } from "@playwright/test";
import {
  registerMerchant,
  completeMerchantOnboarding,
  uniqueEmail,
  uniqueSlug,
  closeTestDb,
} from "./helpers/test-utils.js";

test.describe("Authentication Boundaries and Mobile Responsiveness", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("negative authentication paths: invalid credentials, password mismatch, and duplicate email registration", async ({
    page,
  }) => {
    // 1. Merchant Login: Invalid credentials
    await page.goto("/merchant/login");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[name="email"]', "nonexistent_merchant@example.com");
    await page.fill('input[name="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    await expect(
      page.locator(".alert--danger, [role='alert']").filter({ hasText: "Invalid email or password" })
    ).toBeVisible({
      timeout: 10_000,
    });
    // Remains on login page
    expect(page.url()).toContain("/merchant/login");

    // 2. Merchant Register: Password mismatch and validation guard
    await page.goto("/merchant/register");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[name="name"]', "Test Mismatch");
    await page.fill('input[name="email"]', uniqueEmail("mismatch"));
    await page.fill('input[name="password"]', "ValidPassword123!");
    await page.fill('input[name="confirmPassword"]', "CompletelyDifferentPassword456!");

    // Form disables submit button on password mismatch
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    expect(page.url()).toContain("/merchant/register");

    // Short password (< 8 chars) shows client validation error upon submit
    await page.fill('input[name="password"]', "short");
    await page.fill('input[name="confirmPassword"]', "short");
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Password must be at least 8 characters long.")).toBeVisible({ timeout: 10_000 });

    // 3. Merchant Register: Duplicate email registration
    const existingEmail = uniqueEmail("dup_merchant");
    await registerMerchant(page, {
      name: "Original User",
      email: existingEmail,
      password: "Password123!",
    });

    // Complete onboarding to finalize setup
    await completeMerchantOnboarding(page, {
      orgName: "Original Org",
      storeName: "Original Store",
      slug: uniqueSlug("orig"),
    });

    // Clear session by visiting registration again in a fresh attempt
    await page.goto("/merchant/register");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[name="name"]', "Duplicate Attempt");
    await page.fill('input[name="email"]', existingEmail);
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="confirmPassword"]', "Password123!");
    await page.click('button[type="submit"]');

    await expect(
      page.locator(".alert--danger, [role='alert']").filter({ hasText: /already/i })
    ).toBeVisible({
      timeout: 15_000,
    });

    // 4. Storefront Customer Login: Invalid credentials
    await page.goto("/stores/souled-store/login");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[name="email"]', "unknown_customer@example.com");
    await page.fill('input[name="password"]', "CustomerWrong123!");
    await page.click('button[type="submit"]');

    await expect(
      page.locator(".alert--danger, [role='alert']").filter({ hasText: "Invalid email or password" })
    ).toBeVisible({
      timeout: 10_000,
    });
    expect(page.url()).toContain("/stores/souled-store/login");
  });

  test("password reset dispatch flows on merchant console and storefront", async ({ page }) => {
    // 1. Merchant Password Reset Request
    await page.goto("/merchant/forgot-password");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1:has-text('Reset Your Password')")).toBeVisible();
    await page.fill("#reset-email", "merchant_recovery@example.com");
    await page.click('button:has-text("Send Reset Instructions")');

    await expect(page.locator("text=Instructions Dispatched")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=merchant_recovery@example.com")).toBeVisible();

    // 2. Storefront Customer Password Recovery
    await page.goto("/stores/souled-store/forgot-password");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Reset your password")).toBeVisible();
    await page.fill("#recovery-email", "customer_recovery@example.com");
    await page.click('button:has-text("Send Reset Instructions")');

    await expect(page.locator("text=Recovery Email Sent")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=customer_recovery@example.com")).toBeVisible();
  });

  test("mobile responsive viewport adapts navigation, catalog cards, and console drawer", async ({
    page,
  }) => {
    // Standard compact mobile viewport (iPhone SE width)
    await page.setViewportSize({ width: 375, height: 667 });

    // 1. Public storefront catalog on mobile
    await page.goto("/stores/souled-store/products");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1:has-text('All Products')")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=luffy tshirt").first()).toBeVisible({ timeout: 15_000 });

    // Verify layout does not horizontally overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 2. Storefront Cart button interaction on mobile
    const cartBtn = page.locator('[data-testid="storefront-cart-button"]');
    await expect(cartBtn).toBeVisible();

    // 3. Merchant Console mobile drawer interaction
    // Register and login a merchant
    const merchantEmail = uniqueEmail("mobile_merchant");
    const password = "MobilePassword123!";
    const storeName = "Mobile Luxe";
    const storeSlug = uniqueSlug("mobile");

    await registerMerchant(page, {
      name: "Mobile Owner",
      email: merchantEmail,
      password,
    });

    await completeMerchantOnboarding(page, {
      orgName: "Mobile Org",
      storeName,
      slug: storeSlug,
    });

    // Ensure on dashboard with mobile viewport
    await expect(page).toHaveURL(/\/merchant/, { timeout: 20_000 });

    // Verify mobile hamburger trigger button is visible
    const menuTrigger = page.locator('button[aria-label="Open merchant navigation"]');
    await expect(menuTrigger).toBeVisible({ timeout: 10_000 });

    // Open mobile sidebar
    await menuTrigger.click();

    // Verify sidebar drawer opens
    const sidebar = page.locator('aside[aria-label="Merchant Navigation"]');
    await expect(sidebar).toHaveClass(/is-mobile-open/);

    // Verify nav items are accessible within mobile drawer
    await expect(sidebar.locator('a:has-text("Overview")')).toBeVisible();
    await expect(sidebar.locator('a:has-text("Products")')).toBeVisible();
    await expect(sidebar.locator('a:has-text("Orders")')).toBeVisible();

    // Close mobile drawer by clicking the backdrop
    const backdrop = page.locator("button.orbit-mobile-backdrop");
    await expect(backdrop).toBeVisible();
    await backdrop.click();

    // Verify drawer closed
    await expect(sidebar).not.toHaveClass(/is-mobile-open/);
  });
});
