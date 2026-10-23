import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  registerMerchant,
  completeMerchantOnboarding,
  uniqueEmail,
  uniqueSlug,
  closeTestDb,
} from "./helpers/test-utils.js";

const SCREENSHOT_DIR = path.resolve(process.cwd(), "test-results/visual-acceptance");

test.describe("Visual Acceptance & Cross-Application Consistency", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("1. Root Landing Page: Dark and Light themes across Desktop, Tablet, and Mobile", async ({ page }) => {
    // 1. Desktop Viewport (1440x900) - Dark Theme
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heroTitle = page.locator("h1").first();
    await expect(heroTitle).toBeVisible();

    // Verify dark theme is active by default
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-root-dark-desktop.png") });

    // Toggle to Light Theme on Desktop
    const desktopThemeBtn = page.locator(".nova-theme-toggle button.theme-mode-toggle");
    await expect(desktopThemeBtn).toBeVisible();
    await desktopThemeBtn.click();
    await page.waitForTimeout(300);

    const isLight = await page.evaluate(() => document.documentElement.classList.contains("light"));
    expect(isLight).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-root-light-desktop.png") });

    // Toggle back to Dark Theme
    await desktopThemeBtn.click();
    await page.waitForTimeout(300);

    // 2. Tablet Viewport (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-root-dark-tablet.png") });

    // 3. Mobile Viewport (375x667) - Verify no horizontal overflow and test mobile drawer
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(hasHorizontalOverflow).toBe(false);

    // Open mobile menu
    const mobileMenuBtn = page.locator("button.nova-mobile-toggle");
    await expect(mobileMenuBtn).toBeVisible();
    await mobileMenuBtn.click();

    // Assert mobile drawer opens and displays theme toggle & navigation
    const mobileNav = page.locator("nav.nova-nav-links.is-open");
    await expect(mobileNav).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-root-dark-mobile.png") });

    // Close mobile menu
    await mobileMenuBtn.click();
  });

  test("2. Merchant Authentication Pages (/merchant/login, /merchant/register)", async ({ page }) => {
    // Desktop Viewport - Dark Theme
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/merchant/login");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h3:has-text('Sign in to your merchant account')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-merchant-login-dark-desktop.png") });

    // Toggle to Light Theme on Login Page
    const themeBtn = page.locator("button.theme-mode-toggle");
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-merchant-login-light-desktop.png") });

    // Mobile Viewport (375x667) - Light Theme
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(hasOverflow).toBe(false);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-merchant-login-light-mobile.png") });

    // Navigate to /merchant/register
    await page.goto("/merchant/register");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1:has-text('Create Your Merchant Account')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-merchant-register-light-mobile.png") });
  });

  test("3. Merchant Console Routes: Overview, Products, Inventory, Orders, Customers, Discounts, Settings", async ({ page }) => {
    test.setTimeout(240_000);

    const merchantEmail = uniqueEmail("visual_merchant");
    const storeSlug = uniqueSlug("visstore");
    const storeName = "Visual Commerce Store";

    const navigateMerchant = async (url: string) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await page
        .locator("text=Authenticating merchant...")
        .waitFor({ state: "detached", timeout: 20_000 })
        .catch(() => {});
    };

    await page.setViewportSize({ width: 1440, height: 900 });
    await registerMerchant(page, {
      name: "Visual Admin",
      email: merchantEmail,
      password: "TestSecurePassword123!",
    });

    await completeMerchantOnboarding(page, {
      orgName: "Visual Org",
      storeName,
      slug: storeSlug,
    });

    // 3.1 Merchant Dashboard (/merchant) - Dark Theme
    await expect(page).toHaveURL(/\/merchant/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h2.merchant-banner-title")).toBeVisible();
    await expect(page.locator(".kpi-grid")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-merchant-dashboard-dark-desktop.png") });

    // Switch to Light Theme
    const shellThemeBtn = page.locator(".orbit-rail-bottom button.theme-mode-toggle");
    await shellThemeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-merchant-dashboard-light-desktop.png") });

    // Switch back to Dark Theme
    await shellThemeBtn.click();
    await page.waitForTimeout(300);

    // 3.2 Merchant Products (/merchant/products)
    await navigateMerchant("/merchant/products");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Products')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-merchant-products-dark-desktop.png") });

    // 3.3 Merchant New Product Form (/merchant/products/new)
    await navigateMerchant("/merchant/products/new");
    await expect(page.locator("text=Basic Information")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-merchant-product-new-dark-desktop.png") });

    // 3.4 Merchant Inventory (/merchant/inventory)
    await navigateMerchant("/merchant/inventory");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Inventory')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-merchant-inventory-dark-desktop.png") });

    // Light Theme Inventory
    await shellThemeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-merchant-inventory-light-desktop.png") });
    await shellThemeBtn.click(); // Back to dark
    await page.waitForTimeout(300);

    // 3.5 Merchant Orders (/merchant/orders)
    await navigateMerchant("/merchant/orders");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Orders')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-merchant-orders-dark-desktop.png") });

    // Light Theme Orders Table
    await shellThemeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-merchant-orders-light-desktop.png") });
    await shellThemeBtn.click(); // Back to dark
    await page.waitForTimeout(300);

    // 3.6 Merchant Customers (/merchant/customers)
    await navigateMerchant("/merchant/customers");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Customers')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "08-merchant-customers-dark-desktop.png") });

    // 3.7 Merchant Discounts (/merchant/discounts & /merchant/discounts/new)
    await navigateMerchant("/merchant/discounts");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Discounts')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-merchant-discounts-dark-desktop.png") });

    await navigateMerchant("/merchant/discounts/new");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Create Discount')")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "09-merchant-discount-new-dark-desktop.png") });

    // 3.8 Merchant Settings (/merchant/settings)
    await navigateMerchant("/merchant/settings");
    await expect(page.locator(".orbit-breadcrumb strong:has-text('Store Settings')")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "10-merchant-settings-dark-desktop.png") });

    // 3.9 Merchant Mobile Navigation Drawer (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateMerchant("/merchant");
    await page.waitForLoadState("networkidle");

    const menuTrigger = page.locator('button[aria-label="Open merchant navigation"]');
    await expect(menuTrigger).toBeVisible();
    await menuTrigger.click();

    const sidebar = page.locator('aside[aria-label="Merchant Navigation"]');
    await expect(sidebar).toHaveClass(/is-mobile-open/);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "11-merchant-drawer-mobile.png") });

    // Close drawer
    await page.locator("button.orbit-mobile-backdrop").click();
    await expect(sidebar).not.toHaveClass(/is-mobile-open/);
  });

  test("4. Storefront Customer Experience (/stores/[storeSlug]/*)", async ({ page }) => {
    // 4.1 Storefront Catalog Page
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/stores/souled-store/products");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1:has-text('All Products')")).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12-storefront-catalog-dark-desktop.png") });

    // Light Theme Catalog
    const storefrontThemeBtn = page.locator(".storefront-actions button.theme-mode-toggle");
    await storefrontThemeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "12-storefront-catalog-light-desktop.png") });

    // 4.2 Cart Drawer Inspection
    const cartButton = page.locator('[data-testid="storefront-cart-button"]');
    await cartButton.click();

    const cartDrawer = page.locator('[data-testid="cart-drawer"]');
    await expect(cartDrawer).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "13-storefront-cart-drawer-light-desktop.png") });

    // Close cart drawer
    await page.locator('[data-testid="cart-drawer-close"]').click();
    await expect(cartDrawer).not.toBeVisible();

    // 4.3 Storefront Checkout Page (/stores/[storeSlug]/checkout)
    await page.goto("/stores/souled-store/checkout");
    await page.waitForLoadState("networkidle");

    // Check stepper and form panels in light mode
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14-storefront-checkout-light-desktop.png") });

    // Switch checkout to dark mode
    await storefrontThemeBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14-storefront-checkout-dark-desktop.png") });

    // Mobile Checkout Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(hasOverflow).toBe(false);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "14-storefront-checkout-dark-mobile.png") });
  });

  test("5. Loading State & Stationary Spinner Label Verification in Rendered DOM", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const spinnerCheck = await page.evaluate(() => {
      const container = document.createElement("div");
      container.innerHTML = `
        <div role="status" class="spinner spinner-md" aria-label="Loading test items" aria-busy="true">
          <span class="spinner-icon" aria-hidden="true"></span>
          <span class="spinner-label">Loading test items</span>
        </div>
      `;
      document.body.appendChild(container);

      const spinnerEl = container.querySelector(".spinner") as HTMLElement;
      const iconEl = container.querySelector(".spinner-icon") as HTMLElement;
      const labelEl = container.querySelector(".spinner-label") as HTMLElement;

      const spinnerTransform = window.getComputedStyle(spinnerEl).transform;
      const iconAnimation = window.getComputedStyle(iconEl).animationName;
      const labelTransform = window.getComputedStyle(labelEl).transform;

      document.body.removeChild(container);

      return {
        spinnerTransform,
        iconAnimation,
        labelTransform,
      };
    });

    expect(spinnerCheck.iconAnimation).toBe("spin");
    expect(spinnerCheck.labelTransform).toBe("none");
    expect(spinnerCheck.spinnerTransform).toBe("none");
  });
});
