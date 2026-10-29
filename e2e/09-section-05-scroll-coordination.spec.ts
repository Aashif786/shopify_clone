import { test, expect } from "@playwright/test";

test.describe("Section 05 Separated Capability Sections Acceptance Tests", () => {
  const sections = [
    { id: "platform", number: "01 / 05", category: "STOREFRONT ENGINE", headline: "Your storefront," },
    { id: "catalog-dimension", number: "02 / 05", category: "CATALOG ARCHITECTURE", headline: "Products that" },
    { id: "orders-dimension", number: "03 / 05", category: "CONCURRENCY ENGINE", headline: "Orders &" },
    { id: "payments-dimension", number: "04 / 05", category: "CRYPTOGRAPHIC LEDGER", headline: "Payments," },
    { id: "telemetry-dimension", number: "05 / 05", category: "TELEMETRY ENGINE", headline: "Insight at" },
  ];

  for (const viewport of [
    { width: 1440, height: 900, name: "desktop-large" },
    { width: 1280, height: 720, name: "desktop-standard" },
    { width: 768, height: 1024, name: "tablet" },
  ]) {
    test(`verify 5 separated capability sections and interactions on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Verify each section in sequence as user scrolls down
      for (const sec of sections) {
        const section = page.locator(`#${sec.id}`);
        await expect(section).toBeVisible();

        // Scroll section into view
        await section.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);

        // Check index and category
        await expect(section.locator(`text=${sec.number}`)).toBeVisible();
        await expect(section.locator(`text=${sec.category}`)).toBeVisible();
        await expect(section.locator(`text=${sec.headline}`)).toBeVisible();
      }

      // Test interactive controls in Section 01 (Storefront Theme Selector)
      const storefrontSection = page.locator("#platform");
      await storefrontSection.scrollIntoViewIfNeeded();
      const themeButtons = storefrontSection.locator("button[aria-label*='theme']");
      const themeCount = await themeButtons.count();
      if (themeCount > 1) {
        await themeButtons.nth(1).click();
        await page.waitForTimeout(100);
      }

      // Test interactive controls in Section 02 (Catalog Matrix Model Selector)
      const catalogSection = page.locator("#catalog-dimension");
      await catalogSection.scrollIntoViewIfNeeded();
      const blueModelBtn = catalogSection.locator("button:has-text('Blue')");
      if (await blueModelBtn.isVisible()) {
        await blueModelBtn.click();
        await page.waitForTimeout(100);
        await expect(catalogSection.locator("text=/the-essence-tee-blue")).toBeVisible();
      }

      // Test interactive controls in Section 03 (Concurrency Engine Step click)
      const ordersSection = page.locator("#orders-dimension");
      await ordersSection.scrollIntoViewIfNeeded();
      const stepBtn = ordersSection.locator("button:has-text('Stock Reserved in PostgreSQL')");
      if (await stepBtn.isVisible()) {
        await stepBtn.click();
        await page.waitForTimeout(100);
      }

      // Scroll smoothly down to the next major section (Operations #operations)
      const operationsSection = page.locator("#operations");
      await operationsSection.scrollIntoViewIfNeeded();
      await expect(operationsSection).toBeVisible();
    });
  }
});
