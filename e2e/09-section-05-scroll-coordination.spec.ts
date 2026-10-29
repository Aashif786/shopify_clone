import { test, expect } from "@playwright/test";

test.describe("Section 05 Scroll Coordination Acceptance Tests", () => {
  for (const viewport of [
    { width: 1440, height: 900, name: "desktop-large" },
    { width: 1280, height: 720, name: "desktop-standard" },
    { width: 768, height: 1024, name: "tablet" },
  ]) {
    test(`verify scroll pinning, card progress, and unpinning on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const section = page.locator("#platform");
      await expect(section).toBeVisible();

      const stickyContainer = section.locator(".sticky");
      await expect(stickyContainer).toBeVisible();

      // Get initial position of section
      const sectionStartBox = await section.boundingBox();
      expect(sectionStartBox).not.toBeNull();
      const sectionInitialTop = sectionStartBox!.y;

      // 1. Scroll down until Section 05 reaches its pinning position
      await page.evaluate((top) => window.scrollTo(0, top), sectionInitialTop);
      await page.waitForTimeout(100);

      const atPin = await stickyContainer.boundingBox();
      expect(Math.abs(atPin!.y)).toBeLessThanOrEqual(1);

      // Verify Card 1 is active
      const dots = page.locator("#platform button[aria-label*='Jump to slide']");
      await expect(dots).toHaveCount(5);

      // 2 & 3. Continued vertical scroll drives horizontal movement while remaining stationary
      const sectionHeight = (await section.boundingBox())!.height;
      const pinnedScrollableDistance = sectionHeight - viewport.height;

      // Sample along the scroll path from 0% to 100% of pinned scroll distance
      // At 20%, 40%, 60%, 80%: sticky container must remain at y = 0
      for (const pct of [0.2, 0.4, 0.6, 0.8, 0.85]) {
        const targetScroll = sectionInitialTop + pct * pinnedScrollableDistance;
        await page.evaluate((top) => window.scrollTo(0, top), targetScroll);
        await page.waitForTimeout(50);

        const currentStickyBox = await stickyContainer.boundingBox();
        expect(
          Math.abs(currentStickyBox!.y),
          `Sticky container must remain stationary at y=0 at ${(pct * 100).toFixed(0)}% scroll`
        ).toBeLessThanOrEqual(1);
      }

      // 4. Confirm the fifth card reaches its intended final position completely by 85% scroll
      const at85Scroll = sectionInitialTop + 0.85 * pinnedScrollableDistance;
      await page.evaluate((top) => window.scrollTo(0, top), at85Scroll);
      await page.waitForTimeout(50);

      // At 85% scroll, Card 5 must be reached
      const card5Dot = dots.nth(4);
      const card5Class = await card5Dot.getAttribute("class");
      expect(card5Class).toContain("w-7 bg-cobalt-500");

      // Check stationary dwell buffer: between 85% and 98% scroll, Card 5 remains in view and stationary
      const at95Scroll = sectionInitialTop + 0.95 * pinnedScrollableDistance;
      await page.evaluate((top) => window.scrollTo(0, top), at95Scroll);
      await page.waitForTimeout(50);

      const stickyBoxAt95 = await stickyContainer.boundingBox();
      expect(Math.abs(stickyBoxAt95!.y)).toBeLessThanOrEqual(1);

      const card5ClassAt95 = await card5Dot.getAttribute("class");
      expect(card5ClassAt95).toContain("w-7 bg-cobalt-500");

      // 5. Confirm next section (CommerceOperations #operations) does not move into view prematurely
      const nextSection = page.locator("#operations");
      const nextBoxAt95 = await nextSection.boundingBox();
      // Next section top must still be at or below viewport bottom
      expect(nextBoxAt95!.y).toBeGreaterThanOrEqual(viewport.height - 5);

      // 6. Continue scrolling past 100% and confirm normal vertical movement resumes
      const afterSectionScroll = sectionInitialTop + pinnedScrollableDistance + 300;
      await page.evaluate((top) => window.scrollTo(0, top), afterSectionScroll);
      await page.waitForTimeout(50);

      const nextBoxAfter = await nextSection.boundingBox();
      expect(nextBoxAfter!.y).toBeLessThan(viewport.height);

      // 7. Scroll upward and confirm horizontal movement reverses before returning to preceding section
      await page.evaluate((top) => window.scrollTo(0, top), at85Scroll);
      await page.waitForTimeout(50);

      const stickyBoxReturn85 = await stickyContainer.boundingBox();
      expect(Math.abs(stickyBoxReturn85!.y)).toBeLessThanOrEqual(1);

      const card5ClassReturn = await dots.nth(4).getAttribute("class");
      expect(card5ClassReturn).toContain("w-7 bg-cobalt-500");

      // Scroll back up to 25% (Card 2)
      const at25Scroll = sectionInitialTop + 0.25 * pinnedScrollableDistance;
      await page.evaluate((top) => window.scrollTo(0, top), at25Scroll);
      await page.waitForTimeout(50);

      const stickyBoxReturn25 = await stickyContainer.boundingBox();
      expect(Math.abs(stickyBoxReturn25!.y)).toBeLessThanOrEqual(1);

      // Scroll all the way before section 05
      await page.evaluate((top) => window.scrollTo(0, top), sectionInitialTop - 200);
      await page.waitForTimeout(50);

      const stickyBoxPre = await stickyContainer.boundingBox();
      expect(stickyBoxPre!.y).toBeGreaterThanOrEqual(100);
    });
  }
});
