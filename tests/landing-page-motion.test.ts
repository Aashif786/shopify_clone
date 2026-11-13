import { describe, expect, it } from "vitest";
import {
  getElementMotion,
  getSectionMotion,
  resolveIntensity,
} from "@/components/storefront/landing-page/motion";
import {
  ENTRANCE_PRESET_GROUPS,
  ENTRANCE_PRESET_VALUES,
} from "@/components/storefront/landing-page/motion-presets";

describe("landing page entrance motion", () => {
  describe("getSectionMotion", () => {
    const base = { intensity: "medium" as const, enabled: true, reduced: false, hasElements: true };

    it("returns null for none, disabled themes and reduced motion", () => {
      expect(getSectionMotion({ ...base, preset: "none" })).toBeNull();
      expect(getSectionMotion({ ...base, preset: undefined })).toBeNull();
      expect(getSectionMotion({ ...base, preset: "fade-up", enabled: false })).toBeNull();
      expect(getSectionMotion({ ...base, preset: "fade-up", reduced: true })).toBeNull();
    });

    it("plays once on live viewport entry and allows replay in editor preview", () => {
      const live = getSectionMotion({ ...base, preset: "fade-up", isPreview: false });
      const preview = getSectionMotion({ ...base, preset: "fade-up", isPreview: true });
      expect(live?.props.viewport).toMatchObject({ once: true });
      expect(preview?.props.viewport).toMatchObject({ once: false });
      expect(live?.props.whileInView).toEqual({ opacity: 1, y: 0 });
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

describe("extended entrance presets", () => {
  const section = { intensity: "medium" as const, enabled: true, reduced: false, hasElements: true };
  const element = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

  it("offers more than the original five presets, each id only once", () => {
    expect(ENTRANCE_PRESET_VALUES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ENTRANCE_PRESET_VALUES).size).toBe(ENTRANCE_PRESET_VALUES.length);
    expect(ENTRANCE_PRESET_GROUPS.every((g) => g.options.length > 0)).toBe(true);
  });

  it.each(ENTRANCE_PRESET_VALUES)("%s animates sections and elements (no selectable preset is a no-op)", (preset) => {
    const sectionMotion = getSectionMotion({ ...section, preset });
    const elementMotion = getElementMotion({ ...element, animation: { preset } });
    expect(sectionMotion?.props.initial).toBeTruthy();
    expect(sectionMotion?.props.whileInView).toBeTruthy();
    expect(sectionMotion?.stagger).toBe(false);
    expect(elementMotion?.initial).toBeTruthy();
    expect(elementMotion?.whileInView).toBeTruthy();
  });

  it.each(ENTRANCE_PRESET_VALUES)("%s respects reduced motion and disabled animations", (preset) => {
    expect(getSectionMotion({ ...section, preset, reduced: true })).toBeNull();
    expect(getSectionMotion({ ...section, preset, enabled: false })).toBeNull();
    expect(getElementMotion({ ...element, animation: { preset }, reduced: true })).toBeNull();
    expect(getElementMotion({ ...element, animation: { preset }, enabled: false })).toBeNull();
  });

  it.each(ENTRANCE_PRESET_VALUES)("%s starts hidden and ends fully revealed", (preset) => {
    const m = getElementMotion({ ...element, animation: { preset } })!;
    const from = m.initial as Record<string, unknown>;
    const to = m.whileInView as Record<string, unknown>;
    const hiddenByOpacity = from.opacity === 0;
    const hiddenByClip = typeof from.clipPath === "string" && from.clipPath !== "inset(0% 0% 0% 0%)";
    expect(hiddenByOpacity || hiddenByClip).toBe(true);
    if ("opacity" in to) expect(to.opacity).toBe(1);
    if ("clipPath" in to) expect(to.clipPath).toBe("inset(0% 0% 0% 0%)");
  });

  it("keeps the original presets exactly as before", () => {
    expect(getElementMotion({ ...element, animation: { preset: "slide" } })?.initial).toEqual({ opacity: 0, x: -20 });
    expect(getElementMotion({ ...element, animation: { preset: "fade-up" } })?.initial).toEqual({ opacity: 0, y: 16 });
    expect(getSectionMotion({ ...section, preset: "slide" })?.props.initial).toEqual({ opacity: 0, x: -24 });
    expect(getSectionMotion({ ...section, preset: "slide-left" })?.props.initial).toEqual({ opacity: 0, x: -24 });
  });

  it("uses the saved duration and delay for timed element presets", () => {
    const m = getElementMotion({ ...element, animation: { preset: "blur-in", duration: 0.8, delay: 0.3 } });
    expect(m?.transition).toMatchObject({ duration: 0.8, delay: 0.3 });
    expect(m?.initial).toMatchObject({ filter: "blur(12px)" });
  });

  it("spring-pop uses a spring and keeps the merchant's delay", () => {
    const m = getElementMotion({ ...element, animation: { preset: "spring-pop", delay: 0.2 } });
    expect(m?.transition).toMatchObject({ type: "spring", delay: 0.2 });
  });

  it("wipes reveal with clip-path rather than moving layout", () => {
    const up = getElementMotion({ ...element, animation: { preset: "wipe-up" } })!;
    const right = getSectionMotion({ ...section, preset: "wipe-right" })!;
    expect(up.initial).toEqual({ clipPath: "inset(100% 0% 0% 0%)" });
    expect(right.props.initial).toEqual({ clipPath: "inset(0% 100% 0% 0%)" });
  });

  it("section distance scales with intensity for directional presets", () => {
    const subtle = getSectionMotion({ ...section, preset: "fade-down", intensity: "subtle" });
    const expressive = getSectionMotion({ ...section, preset: "fade-down", intensity: "expressive" });
    expect(subtle?.props.initial).toEqual({ opacity: 0, y: -16 });
    expect(expressive?.props.initial).toEqual({ opacity: 0, y: -36 });
  });

  it("flip-up carries a perspective so the tilt reads as 3D", () => {
    const m = getElementMotion({ ...element, animation: { preset: "flip-up" } })!;
    expect(m.initial).toMatchObject({ rotateX: -18, transformPerspective: 900 });
    expect(m.whileInView).toMatchObject({ rotateX: 0, transformPerspective: 900 });
  });

  it("unknown preset ids from old or hand-edited data render statically instead of throwing", () => {
    expect(getElementMotion({ ...element, animation: { preset: "does-not-exist" as never } })).toBeNull();
    expect(getSectionMotion({ ...section, preset: "does-not-exist" as never })).toBeNull();
  });
});

