import { describe, expect, it } from "vitest";
import { getResponsiveVisibilityClasses } from "@/components/storefront/landing-page/responsive";

describe("Landing Page Responsive Visibility Utility (Bug F)", () => {
  describe("Live Storefront Rules", () => {
    it("returns empty string when no devices are hidden", () => {
      expect(getResponsiveVisibilityClasses(false, false, false, false)).toBe("");
      expect(getResponsiveVisibilityClasses(undefined, undefined, undefined, false)).toBe("");
    });

    it("hides on mobile only (< 640px)", () => {
      expect(getResponsiveVisibilityClasses(true, false, false, false)).toBe("hidden sm:block");
    });

    it("hides on tablet only (640px - 1023px)", () => {
      expect(getResponsiveVisibilityClasses(false, true, false, false)).toBe("sm:hidden lg:block");
    });

    it("hides on desktop only (>= 1024px)", () => {
      expect(getResponsiveVisibilityClasses(false, false, true, false)).toBe("lg:hidden");
    });

    it("hides on mobile AND tablet (visible on desktop only)", () => {
      expect(getResponsiveVisibilityClasses(true, true, false, false)).toBe("hidden lg:block");
    });

    it("hides on mobile AND desktop (visible on tablet only)", () => {
      expect(getResponsiveVisibilityClasses(true, false, true, false)).toBe("hidden sm:block lg:hidden");
    });

    it("hides on tablet AND desktop (visible on mobile only)", () => {
      expect(getResponsiveVisibilityClasses(false, true, true, false)).toBe("sm:hidden");
    });

    it("hides everywhere when all three are true", () => {
      expect(getResponsiveVisibilityClasses(true, true, true, false)).toBe("hidden");
    });
  });

  describe("Editor Preview Mode (Affordances)", () => {
    it("renders subtle affordance rings with opacity-75 in preview instead of hiding", () => {
      const mobilePreview = getResponsiveVisibilityClasses(true, false, false, true);
      expect(mobilePreview).toContain("opacity-75");
      expect(mobilePreview).toContain("ring-amber-500/30");
      expect(mobilePreview).not.toContain("hidden");

      const tabletPreview = getResponsiveVisibilityClasses(false, true, false, true);
      expect(tabletPreview).toContain("opacity-75");
      expect(tabletPreview).toContain("ring-purple-500/30");

      const desktopPreview = getResponsiveVisibilityClasses(false, false, true, true);
      expect(desktopPreview).toContain("opacity-75");
      expect(desktopPreview).toContain("ring-sky-500/30");
    });

    it("combines preview rings if multiple are hidden in editor", () => {
      const multiPreview = getResponsiveVisibilityClasses(true, true, false, true);
      expect(multiPreview).toContain("ring-amber-500/30");
      expect(multiPreview).toContain("ring-purple-500/30");
    });
  });
});
