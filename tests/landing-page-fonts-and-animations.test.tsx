import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FONT_LIBRARY,
  getFontById,
  resolveFontFamily,
  getGoogleFontsUrl,
  LEGACY_FONT_MAP,
} from "@/lib/font-library";
import {
  ENTRANCE_PRESET_GROUPS,
  ENTRANCE_PRESET_VALUES,
} from "@/components/storefront/landing-page/motion-presets";
import {
  getElementMotion,
  getSectionMotion,
} from "@/components/storefront/landing-page/motion";
import {
  normalizeLandingPageConfig,
  resolveThemeSemanticTokens,
  type StorefrontLandingPageConfig,
} from "@calcart/stores/landing-page";
import { StorefrontLandingRenderer } from "@/components/storefront/landing-page/storefront-landing-renderer";
import { HeadingElement } from "@/components/storefront/landing-page/elements/heading-element";

describe("Landing Page Studio: Font System & Library", () => {
  it("provides at least 10 unique font families across distinct categories", () => {
    expect(FONT_LIBRARY.length).toBeGreaterThanOrEqual(10);

    const uniqueIds = new Set(FONT_LIBRARY.map((f) => f.id));
    expect(uniqueIds.size).toBe(FONT_LIBRARY.length);

    const categories = new Set(FONT_LIBRARY.map((f) => f.category));
    expect(categories.has("sans-serif")).toBe(true);
    expect(categories.has("serif")).toBe(true);
    expect(categories.has("display")).toBe(true);
    expect(categories.has("monospace")).toBe(true);
  });

  it("retrieves fonts by id or legacy alias", () => {
    const playfair = getFontById("playfair-display");
    expect(playfair).toBeDefined();
    expect(playfair?.name).toBe("Playfair Display");
    expect(playfair?.category).toBe("serif");

    const cinzel = getFontById("cinzel");
    expect(cinzel).toBeDefined();
    expect(cinzel?.name).toBe("Cinzel");

    // Legacy keywords map cleanly
    const legacyDisplay = getFontById("display");
    expect(legacyDisplay).toBeDefined();
    expect(legacyDisplay?.id).toBe(LEGACY_FONT_MAP.display);
  });

  it("resolves independent font families for headings and body text", () => {
    const headingFamily = resolveFontFamily("playfair-display");
    const bodyFamily = resolveFontFamily("plus-jakarta-sans");

    expect(headingFamily).toContain("Playfair Display");
    expect(bodyFamily).toContain("Plus Jakarta Sans");
    expect(headingFamily).not.toEqual(bodyFamily);

    // Fallbacks work for legacy or unconfigured values
    expect(resolveFontFamily(undefined, "fallback-sans")).toBe("fallback-sans");
  });

  it("generates combined Google Fonts stylesheet link URLs", () => {
    const url = getGoogleFontsUrl(["playfair-display", "plus-jakarta-sans", "jetbrains-mono"]);
    expect(url).toBeDefined();
    expect(url).toContain("family=Playfair+Display");
    expect(url).toContain("family=Plus+Jakarta+Sans");
    expect(url).toContain("family=JetBrains+Mono");
    expect(url).toContain("display=swap");

    // Deduplicates repeated requests
    const dedupedUrl = getGoogleFontsUrl(["cinzel", "cinzel", "inter"]);
    expect(dedupedUrl).toContain("family=Cinzel");
    expect(dedupedUrl).toContain("family=Inter");
  });

  it("persists and normalizes custom font selections in theme configuration", () => {
    const customConfig: StorefrontLandingPageConfig = {
      version: 2,
      theme: {
        presetId: "editorial-luxury",
        colors: {
          primary: "#d4af37",
          secondary: "#1a1a1a",
          background: "#0c0d10",
          surface: "#14161c",
          text: "#f5f5f7",
          mutedText: "#a1a1aa",
          border: "#27272a",
          buttonText: "#000000",
        },
        typography: {
          headingFont: "cinzel",
          bodyFont: "lora",
          scale: "lg",
          headingWeight: "bold",
          bodyWeight: "normal",
          customFonts: ["cinzel", "lora", "jetbrains-mono"],
        },
        animations: {
          enabled: true,
          intensity: "expressive",
        },
      },
      sections: [],
    };

    const normalized = normalizeLandingPageConfig(customConfig);
    expect(normalized.theme.typography.headingFont).toBe("cinzel");
    expect(normalized.theme.typography.bodyFont).toBe("lora");
    expect(normalized.theme.typography.customFonts).toEqual(["cinzel", "lora", "jetbrains-mono"]);

    const semanticTokens = resolveThemeSemanticTokens(normalized.theme);
    expect(semanticTokens.cssVars["--landing-font-heading"]).toBe("cinzel");
    expect(semanticTokens.cssVars["--landing-font-body"]).toBe("lora");
  });
});

describe("Landing Page Studio: Animation Options & Directional Variations", () => {
  it("provides comprehensive animation categories in motion presets", () => {
    const categoryLabels = ENTRANCE_PRESET_GROUPS.map((g) => g.label);
    expect(categoryLabels).toContain("Fade & Dissolve");
    expect(categoryLabels).toContain("Directional Slide");
    expect(categoryLabels).toContain("Zoom & Pop");
    expect(categoryLabels).toContain("Flip & Rotate");
    expect(categoryLabels).toContain("Bounce & Dynamic");
    expect(categoryLabels).toContain("Focus & Blur");
    expect(categoryLabels).toContain("Curtain & Reveal");
  });

  it("supports all directional variations for slides and fades", () => {
    const base = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

    // Directional slides
    const slideLeft = getElementMotion({ ...base, animation: { preset: "slide-left" } });
    const slideRight = getElementMotion({ ...base, animation: { preset: "slide-right" } });
    const slideTop = getElementMotion({ ...base, animation: { preset: "slide-top" } });
    const slideBottom = getElementMotion({ ...base, animation: { preset: "slide-bottom" } });

    expect(slideLeft?.initial).toMatchObject({ x: -20 });
    expect(slideRight?.initial).toMatchObject({ x: 20 });
    expect(slideTop?.initial).toMatchObject({ y: -20 });
    expect(slideBottom?.initial).toMatchObject({ y: 20 });

    // Directional fades
    const fadeUp = getElementMotion({ ...base, animation: { preset: "fade-up" } });
    const fadeDown = getElementMotion({ ...base, animation: { preset: "fade-down" } });
    const fadeLeft = getElementMotion({ ...base, animation: { preset: "fade-left" } });
    const fadeRight = getElementMotion({ ...base, animation: { preset: "fade-right" } });

    expect(fadeUp?.initial).toMatchObject({ opacity: 0, y: 16 });
    expect(fadeDown?.initial).toMatchObject({ opacity: 0, y: -20 });
    expect(fadeLeft?.initial).toMatchObject({ opacity: 0, x: 20 });
    expect(fadeRight?.initial).toMatchObject({ opacity: 0, x: -20 });
  });

  it("supports zoom, pop, bounce, and elastic springs with physical dynamics", () => {
    const base = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

    const popIn = getElementMotion({ ...base, animation: { preset: "pop-in" } });
    expect(popIn?.initial).toMatchObject({ opacity: 0, scale: 0.75 });
    expect(popIn?.transition).toMatchObject({ type: "spring" });

    const popOut = getElementMotion({ ...base, animation: { preset: "pop-out" } });
    expect(popOut?.initial).toMatchObject({ opacity: 0, scale: 1.15 });

    const bounce = getElementMotion({ ...base, animation: { preset: "bounce" } });
    expect(bounce?.transition).toMatchObject({ type: "spring" });

    const elastic = getElementMotion({ ...base, animation: { preset: "elastic" } });
    expect(elastic?.initial).toMatchObject({ scale: 0.65 });
    expect(elastic?.transition).toMatchObject({ type: "spring" });
  });

  it("supports 3D flip, rotate, and swing variations with perspective", () => {
    const base = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

    const flipUp = getElementMotion({ ...base, animation: { preset: "flip-up" } });
    const flipDown = getElementMotion({ ...base, animation: { preset: "flip-down" } });
    const flipLeft = getElementMotion({ ...base, animation: { preset: "flip-left" } });
    const flipRight = getElementMotion({ ...base, animation: { preset: "flip-right" } });

    expect(flipUp?.initial).toMatchObject({ rotateX: -18, transformPerspective: 900 });
    expect(flipDown?.initial).toMatchObject({ rotateX: 18, transformPerspective: 900 });
    expect(flipLeft?.initial).toMatchObject({ rotateY: -20, transformPerspective: 900 });
    expect(flipRight?.initial).toMatchObject({ rotateY: 20, transformPerspective: 900 });

    const swing = getElementMotion({ ...base, animation: { preset: "swing" } });
    expect(swing?.initial).toMatchObject({ rotate: -12, transformOrigin: "top center" });
    expect(swing?.transition).toMatchObject({ type: "spring" });
  });

  it("supports blur, wipes, and typewriter reveals without layout shifts", () => {
    const base = { enabled: true, reduced: false, joinStagger: false, intensity: "medium" as const };

    const blurIn = getElementMotion({ ...base, animation: { preset: "blur-in" } });
    expect(blurIn?.initial).toMatchObject({ filter: "blur(12px)" });

    const wipeDown = getElementMotion({ ...base, animation: { preset: "wipe-down" } });
    expect(wipeDown?.initial).toEqual({ clipPath: "inset(0% 0% 100% 0%)" });

    const typewriter = getElementMotion({ ...base, animation: { preset: "typewriter" } });
    expect(typewriter?.initial).toEqual({ opacity: 0, clipPath: "inset(0% 100% 0% 0%)" });
    expect(typewriter?.whileInView).toEqual({ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" });
  });

  it("allows custom duration and delay configuration for sections and elements", () => {
    const elementMotion = getElementMotion({
      enabled: true,
      reduced: false,
      joinStagger: false,
      intensity: "medium",
      animation: { preset: "bounce", duration: 1.2, delay: 0.5 },
    });
    expect(elementMotion?.transition).toMatchObject({ delay: 0.5 });

    const sectionMotion = getSectionMotion({
      preset: "slide-top",
      intensity: "expressive",
      enabled: true,
      reduced: false,
      hasElements: true,
      duration: 0.8,
      delay: 0.2,
    });
    expect(sectionMotion?.props.transition).toMatchObject({ duration: 0.8, delay: 0.2 });
  });

  it("strictly respects prefers-reduced-motion across all animation presets", () => {
    for (const preset of ENTRANCE_PRESET_VALUES) {
      const elementRes = getElementMotion({
        enabled: true,
        reduced: true, // Reduced motion preferred
        joinStagger: false,
        intensity: "medium",
        animation: { preset },
      });
      expect(elementRes).toBeNull();

      const sectionRes = getSectionMotion({
        preset,
        intensity: "medium",
        enabled: true,
        reduced: true, // Reduced motion preferred
        hasElements: true,
      });
      expect(sectionRes).toBeNull();
    }
  });
});

describe("Landing Page Studio: Rendering & Visual Hierarchy", () => {
  it("renders storefront landing page root with custom heading and body font CSS variables", () => {
    const config: StorefrontLandingPageConfig = {
      version: 2,
      theme: {
        presetId: "editorial-luxury",
        colors: {
          primary: "#c5a880",
          secondary: "#1f1f1f",
          background: "#0a0a0c",
          surface: "#141418",
          text: "#f7f7f8",
          mutedText: "#9e9ea7",
          border: "#282830",
          buttonText: "#000000",
        },
        typography: {
          headingFont: "cinzel",
          bodyFont: "plus-jakarta-sans",
          scale: "md",
        },
        animations: {
          enabled: true,
          intensity: "medium",
        },
      },
      sections: [],
    };

    const markup = renderToStaticMarkup(
      <StorefrontLandingRenderer config={config} storeSlug="artisan-atelier" />,
    );

    expect(markup).toContain("storefront-landing-root");
    expect(markup).toContain("--landing-font-heading");
    expect(markup).toContain("--landing-font-body");
    expect(markup).toContain("Cinzel");
    expect(markup).toContain("Plus Jakarta Sans");
  });

  it("renders HeadingElement using the primary heading font or individual element override", () => {
    // 1. Default heading inherits --landing-font-heading
    const defaultHeadingMarkup = renderToStaticMarkup(
      <HeadingElement
        element={{
          id: "h1",
          type: "heading",
          isVisible: true,
          content: { text: "Default Atelier Heading" },
        }}
      />,
    );
    expect(defaultHeadingMarkup).toContain("Default Atelier Heading");
    expect(defaultHeadingMarkup).toContain("var(--landing-font-heading");

    // 2. Heading with individual font override
    const overrideHeadingMarkup = renderToStaticMarkup(
      <HeadingElement
        element={{
          id: "h2",
          type: "heading",
          isVisible: true,
          content: { text: "Custom Playfair Headline" },
          style: { fontFamily: "playfair-display" },
        }}
      />,
    );
    expect(overrideHeadingMarkup).toContain("Custom Playfair Headline");
    expect(overrideHeadingMarkup).toContain("Playfair Display");
  });
});
