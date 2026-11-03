import { describe, expect, it } from "vitest";
import {
  getElementMotion,
  getSectionMotion,
  resolveIntensity,
} from "@/components/storefront/landing-page/motion";

describe("landing page entrance motion", () => {
  describe("getSectionMotion", () => {
    const base = { intensity: "medium" as const, enabled: true, reduced: false, hasElements: true };

    it("returns null for none, disabled themes and reduced motion", () => {
      expect(getSectionMotion({ ...base, preset: "none" })).toBeNull();
      expect(getSectionMotion({ ...base, preset: undefined })).toBeNull();
      expect(getSectionMotion({ ...base, preset: "fade-up", enabled: false })).toBeNull();
      expect(getSectionMotion({ ...base, preset: "fade-up", reduced: true })).toBeNull();
    });

    it("plays once on viewport entry, identically for preview and live", () => {
      const motion = getSectionMotion({ ...base, preset: "fade-up" });
      expect(motion?.props.viewport).toMatchObject({ once: true });
      expect(motion?.props.whileInView).toEqual({ opacity: 1, y: 0 });
    });

    it("scales distance with intensity", () => {
      const subtle = getSectionMotion({ ...base, preset: "fade-up", intensity: "subtle" });
      const expressive = getSectionMotion({ ...base, preset: "fade-up", intensity: "expressive" });
      expect(subtle?.props.initial).toEqual({ opacity: 0, y: 16 });
      expect(expressive?.props.initial).toEqual({ opacity: 0, y: 36 });
    });

    it("orchestrates children for stagger when an element tree exists", () => {
      const motion = getSectionMotion({ ...base, preset: "stagger" });
      expect(motion?.stagger).toBe(true);
      expect(motion?.props.initial).toBe("hidden");
      expect(motion?.props.whileInView).toBe("visible");
    });

    it("reveals legacy sections without elements itself when staggering", () => {
      const motion = getSectionMotion({ ...base, preset: "stagger", hasElements: false });
      expect(motion?.stagger).toBe(false);
    });
  });

  describe("getElementMotion", () => {
    const base = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

    it("returns null for none, disabled themes and reduced motion", () => {
      expect(getElementMotion({ ...base, animation: undefined })).toBeNull();
      expect(getElementMotion({ ...base, animation: { preset: "none" } })).toBeNull();
      expect(getElementMotion({ ...base, animation: { preset: "fade-up" }, enabled: false })).toBeNull();
      expect(getElementMotion({ ...base, animation: { preset: "fade-up" }, reduced: true })).toBeNull();
    });

    it("preserves duration and delay from the saved config", () => {
      const motion = getElementMotion({
        ...base,
        animation: { preset: "scale-in", duration: 0.8, delay: 0.3 },
      });
      expect(motion?.transition).toMatchObject({ duration: 0.8, delay: 0.3 });
    });

    it("falls back to safe defaults for invalid timing values", () => {
      const motion = getElementMotion({
        ...base,
        animation: { preset: "fade-in", duration: Number.NaN, delay: -2 },
      });
      expect(motion?.transition).toMatchObject({ duration: 0.4, delay: 0 });
    });

    it("keeps slide direction", () => {
      const left = getElementMotion({ ...base, animation: { preset: "slide-left" } });
      const right = getElementMotion({ ...base, animation: { preset: "slide-right" } });
      expect(left?.initial).toMatchObject({ x: -20 });
      expect(right?.initial).toMatchObject({ x: 20 });
    });

    it("joins a staggering section only when it has no animation of its own", () => {
      const joined = getElementMotion({ ...base, joinStagger: true, animation: undefined });
      expect(joined?.variants).toBeDefined();
      expect(joined?.initial).toBeUndefined();

      const own = getElementMotion({ ...base, joinStagger: true, animation: { preset: "fade-in" } });
      expect(own?.initial).toEqual({ opacity: 0 });
    });
  });

  it("resolveIntensity picks the first valid candidate", () => {
    expect(resolveIntensity(undefined, "subtle", "expressive")).toBe("subtle");
    expect(resolveIntensity("bogus", undefined)).toBe("medium");
  });
});
