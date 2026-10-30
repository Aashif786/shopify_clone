import { test, expect } from "@playwright/test";

test.describe("Landing Page Editor: Full-Viewport Storefront Preview Acceptance Tests", () => {
  test.beforeEach(async ({ context }) => {
    // Authenticate with active session
    await context.addCookies([
      {
        name: "calcart_session",
        value: "01a18888-0000-7000-8000-fcc69d5d8e34",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  });

  for (const viewport of [
    { width: 1440, height: 900, name: "desktop-large" },
    { width: 1280, height: 720, name: "desktop-standard" },
  ]) {
    test(`editor occupies full viewport with expanded preview on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.addInitScript(() => {
        localStorage.setItem("calcart_active_store_id", "01a157eb-ab55-7000-a721-73b85799bd32");
      });

      await page.goto("/merchant/landing-page");
      await page.waitForLoadState("networkidle");

      // Verify Save Draft button and Studio header are visible
      const saveDraftBtn = page.locator('button:has-text("Save Draft")');
      await expect(saveDraftBtn).toBeVisible({ timeout: 20000 });

      // 1. Verify no duplicate headers: only the studio header is rendered in the workspace
      const merchantHeaders = page.locator(".merchant-header");
      await expect(merchantHeaders).toHaveCount(0);

      // 2. Verify editor root occupies full height
      const studioHeader = page.locator("header:has-text('Landing Page Studio')");
      await expect(studioHeader).toBeVisible();

      // 3. Verify storefront preview canvas is substantial in desktop mode
      const previewCanvas = page.getByTestId("storefront-preview-canvas");
      await expect(previewCanvas).toBeVisible();

      const initialBox = await previewCanvas.boundingBox();
      expect(initialBox).not.toBeNull();
      // With both panels and merchant sidebar open, verify preview width is healthy
      expect(initialBox!.width).toBeGreaterThan(viewport.width >= 1440 ? 500 : 380);

      // 4. Test Collapsible Panels: Collapse sections panel
      const sectionsToggle = page.locator('button[title*="sections panel"]').first();
      await sectionsToggle.click();
      await page.waitForTimeout(200);

      const boxAfterLeftCollapse = await previewCanvas.boundingBox();
      // Preview width should expand by ~280px
      expect(boxAfterLeftCollapse!.width).toBeGreaterThan(initialBox!.width + 200);

      // Collapse controls panel
      const controlsToggle = page.locator('button[title*="controls panel"]').first();
      await controlsToggle.click();
      await page.waitForTimeout(200);

      const boxAfterBothCollapse = await previewCanvas.boundingBox();
      // Preview should now take nearly the full width between sidebar and edge (> 900px)
      expect(boxAfterBothCollapse!.width).toBeGreaterThan(900);

      // 5. Test Full-Screen Mode
      const fullscreenBtn = page.locator('button[title*="Full-Screen"]').first();
      await fullscreenBtn.click();
      await page.waitForTimeout(300);

      const fullscreenBox = await previewCanvas.boundingBox();
      // In fullscreen mode with panels collapsed, preview takes entire screen width
      expect(fullscreenBox!.width).toBeGreaterThanOrEqual(viewport.width - 20);

      // Exit fullscreen mode
      await fullscreenBtn.click();
      await page.waitForTimeout(200);

      // Re-open controls and sections
      await controlsToggle.click();
      await page.waitForTimeout(200);
      await sectionsToggle.click();
      await page.waitForTimeout(200);

      // 6. Test Device Switching
      const tabletBtn = page.locator('button[title*="Tablet"]');
      await tabletBtn.click();
      await page.waitForTimeout(200);
      await expect(page.locator("text=Tablet (768px)")).toBeVisible();

      const mobileBtn = page.locator('button[title*="Mobile"]');
      await mobileBtn.click();
      await page.waitForTimeout(200);
      await expect(page.locator("text=9:41")).toBeVisible();

      // Switch back to desktop
      const desktopBtn = page.locator('button[title*="Desktop"]');
      await desktopBtn.click();
      await page.waitForTimeout(200);
      await expect(page.locator(".storefront-landing-root")).toBeVisible();
    });
  }

  test("clicking a section in preview selects it and opens controls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem("calcart_active_store_id", "01a157eb-ab55-7000-a721-73b85799bd32");
    });

    await page.goto("/merchant/landing-page");
    await page.waitForLoadState("networkidle");

    // Close right panel first
    const controlsToggle = page.locator('button[title*="controls panel"]').first();
    await controlsToggle.click();
    await page.waitForTimeout(200);

    // Verify right panel is closed
    await expect(page.locator("text=General & Animation")).toHaveCount(0);

    // Click on a section inside the preview
    const heroSection = page.locator(".storefront-landing-root [data-section-type='hero']").first();
    await expect(heroSection).toBeVisible();
    await heroSection.click();
    await page.waitForTimeout(300);

    // Right panel should have automatically opened
    await expect(page.locator("text=General & Animation")).toBeVisible();
    await expect(page.locator("input[placeholder='e.g. Hero Banner']")).toBeVisible();
  });

  test("public storefront at /stores/souled-store remains completely unchanged and functional", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/stores/souled-store");
    await page.waitForLoadState("networkidle");

    // Public storefront header and branding
    await expect(page.locator("header.storefront-header")).toBeVisible();
    await expect(page.locator(".storefront-brand")).toBeVisible();

    // Verify hero and content are rendered at full desktop scale
    const storefrontLayout = page.locator(".storefront-layout").first();
    await expect(storefrontLayout).toBeVisible();
    const layoutBox = await storefrontLayout.boundingBox();
    expect(layoutBox!.width).toBeGreaterThanOrEqual(1200);
  });
});
