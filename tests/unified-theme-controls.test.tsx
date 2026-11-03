import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COLOR_PRESETS,
  getPaletteColors,
  resolveThemeSemanticTokens,
  isDarkHex,
  isLightHex,
  createDefaultLandingPageConfig,
  type ColorPresetId,
  type LandingPageTheme,
} from "@calcart/stores/landing-page";
import { StorefrontLandingRenderer } from "../apps/web/src/components/storefront/landing-page/storefront-landing-renderer";
import { SectionWrapper } from "../apps/web/src/components/storefront/landing-page/section-wrapper";
import { StorefrontShell } from "../apps/web/src/components/storefront/StorefrontShell";

describe("Unified Theme Controls and Consistent Color Palette System", () => {
  const PRESET_IDS: ColorPresetId[] = [
    "modern-minimalist",
    "bold-vibrant",
    "editorial-luxury",
    "high-tech",
    "monochromatic",
  ];

  describe("Curated Color Presets (Light and Dark variants)", () => {
    it("has complete curated light and dark definitions for all 5 presets", () => {
      expect(Object.keys(COLOR_PRESETS)).toHaveLength(5);

      for (const presetId of PRESET_IDS) {
        const preset = COLOR_PRESETS[presetId];
        expect(preset).toBeDefined();
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();

        // Must have light and dark definitions
        expect(preset.light).toBeDefined();
        expect(preset.dark).toBeDefined();
        expect(preset.colors).toBeDefined(); // legacy compatibility

        // Light background must be light
        expect(isLightHex(preset.light.background)).toBe(true);
        expect(isDarkHex(preset.light.text)).toBe(true);

        // Dark background must be dark
        expect(isDarkHex(preset.dark.background)).toBe(true);
        expect(isLightHex(preset.dark.text)).toBe(true);
      }
    });

    it("getPaletteColors returns the appropriate variant based on mode", () => {
      for (const presetId of PRESET_IDS) {
        const lightColors = getPaletteColors(presetId, "light");
        const darkColors = getPaletteColors(presetId, "dark");
        const defaultColors = getPaletteColors(presetId, "default");

        // Light colors should have bright background
        expect(isLightHex(lightColors.background)).toBe(true);
        expect(isDarkHex(lightColors.text)).toBe(true);

        // Dark colors should have dark background
        expect(isDarkHex(darkColors.background)).toBe(true);
        expect(isLightHex(darkColors.text)).toBe(true);

        // Default mode should delegate to platform CSS variables
        expect(defaultColors.background).toBe("var(--color-background, #fafafa)");
      }
    });

    it("luminance functions correctly classify dark and light colors", () => {
      expect(isDarkHex("#000000")).toBe(true);
      expect(isDarkHex("#0d0e12")).toBe(true);
      expect(isDarkHex("#12141c")).toBe(true);
      expect(isDarkHex("#ffffff")).toBe(false);
      expect(isDarkHex("#f8f9fb")).toBe(false);

      expect(isLightHex("#ffffff")).toBe(true);
      expect(isLightHex("#fcfbfa")).toBe(true);
      expect(isLightHex("#000000")).toBe(false);
      expect(isLightHex("#0d0e12")).toBe(false);
    });
  });

  describe("Semantic Theme Token Resolution", () => {
    it("resolves all standard --store-* tokens for both light and dark modes", () => {
      const lightTheme: LandingPageTheme = {
        presetId: "bold-vibrant",
        mode: "light",
        colors: COLOR_PRESETS["bold-vibrant"].light,
      };

      const lightTokens = resolveThemeSemanticTokens(lightTheme);
      expect(lightTokens.modeClass).toBe("light");

      const vars = lightTokens.cssVars;
      expect(vars["--store-background"]).toBe(COLOR_PRESETS["bold-vibrant"].light.background);
      expect(vars["--store-foreground"]).toBe(COLOR_PRESETS["bold-vibrant"].light.text);
      expect(vars["--store-surface"]).toBe(COLOR_PRESETS["bold-vibrant"].light.surface);
      expect(vars["--store-card-background"]).toBe(COLOR_PRESETS["bold-vibrant"].light.cardBackground);
      expect(vars["--store-card-foreground"]).toBe(COLOR_PRESETS["bold-vibrant"].light.cardForeground);
      expect(vars["--store-primary"]).toBe(COLOR_PRESETS["bold-vibrant"].light.primary);
      expect(vars["--store-border"]).toBe(COLOR_PRESETS["bold-vibrant"].light.border);
      expect(vars["--store-muted"]).toBe(COLOR_PRESETS["bold-vibrant"].light.muted);
      expect(vars["--store-muted-foreground"]).toBe(COLOR_PRESETS["bold-vibrant"].light.mutedText);

      // Tailored Tailwind v4 & Shadcn tokens
      expect(vars["--background"]).toBe(vars["--store-background"]);
      expect(vars["--foreground"]).toBe(vars["--store-foreground"]);
      expect(vars["--card"]).toBe(vars["--store-card-background"]);
      expect(vars["--card-foreground"]).toBe(vars["--store-card-foreground"]);
      expect(vars["--primary"]).toBe(vars["--store-primary"]);
      expect(vars["--border"]).toBe(vars["--store-border"]);

      // Cal Cart color variables
      expect(vars["--color-bg-canvas"]).toBe(vars["--store-background"]);
      expect(vars["--color-bg-surface"]).toBe(vars["--store-surface"]);
      expect(vars["--color-text-primary"]).toBe(vars["--store-foreground"]);
    });

    it("resolves dark mode tokens with dark mode class and appropriate variables", () => {
      const darkTheme: LandingPageTheme = {
        presetId: "editorial-luxury",
        mode: "dark",
        colors: COLOR_PRESETS["editorial-luxury"].dark,
      };

      const darkTokens = resolveThemeSemanticTokens(darkTheme);
      expect(darkTokens.modeClass).toBe("dark");

      const vars = darkTokens.cssVars;
      expect(vars["--store-background"]).toBe(COLOR_PRESETS["editorial-luxury"].dark.background);
      expect(vars["--store-foreground"]).toBe(COLOR_PRESETS["editorial-luxury"].dark.text);
      expect(vars["--store-surface"]).toBe(COLOR_PRESETS["editorial-luxury"].dark.surface);
    });

    it("resolves default mode without forcing a restrictive modeClass", () => {
      const defaultTheme: LandingPageTheme = {
        presetId: "modern-minimalist",
        mode: "default",
      };

      const tokens = resolveThemeSemanticTokens(defaultTheme);
      expect(tokens.modeClass).toBe("");
      expect(tokens.cssVars["--store-background"]).toContain("var(--color-background");
    });
  });

  describe("Storefront Landing Renderer Theme Integration", () => {
    it("injects semantic CSS variables and mode class on the root storefront element in light mode", () => {
      const config = createDefaultLandingPageConfig("Aurora Light");
      config.theme.presetId = "bold-vibrant";
      config.theme.mode = "light";
      config.theme.colors = getPaletteColors("bold-vibrant", "light");

      const html = renderToStaticMarkup(
        <StorefrontLandingRenderer
          config={config}
          storeSlug="aurora-light"
          storeName="Aurora Light"
          products={[]}
        />,
      );

      // Root element should have modeClass 'light'
      expect(html).toContain("storefront-landing-root");
      expect(html).toContain("light");
      expect(html).toContain('data-theme-mode="light"');

      // Should include CSS variables in style attribute
      expect(html).toContain("--store-background");
      expect(html).toContain("--store-foreground");
      expect(html).toContain("--store-primary");
      expect(html).toContain("--landing-bg");
      expect(html).toContain("--card");
    });

    it("injects semantic CSS variables and mode class on the root storefront element in dark mode", () => {
      const config = createDefaultLandingPageConfig("Aurora Dark");
      config.theme.presetId = "high-tech";
      config.theme.mode = "dark";
      config.theme.colors = getPaletteColors("high-tech", "dark");

      const html = renderToStaticMarkup(
        <StorefrontLandingRenderer
          config={config}
          storeSlug="aurora-dark"
          storeName="Aurora Dark"
          products={[]}
        />,
      );

      // Root element should have modeClass 'dark'
      expect(html).toContain("storefront-landing-root");
      expect(html).toContain("dark");
      expect(html).toContain('data-theme-mode="dark"');

      // Should include CSS variables in style attribute
      expect(html).toContain(COLOR_PRESETS["high-tech"].dark.background);
    });
  });

  describe("Tiered Styling Precedence & Section Overrides", () => {
    it("inherits root theme background when section has no explicit override", () => {
      const config = createDefaultLandingPageConfig("Inherit Test");
      const hero = { ...config.sections[0] };
      // No explicit background color and no nested elements to test children rendering
      hero.elements = [];
      hero.styles = { ...hero.styles, background: undefined };

      const html = renderToStaticMarkup(
        <SectionWrapper
          section={hero}
          storeSlug="inherit-test"
        >
          <div data-testid="section-content">Hero Content</div>
        </SectionWrapper>,
      );

      // Section wrapper should NOT have a hardcoded background-color style, allowing it to inherit
      expect(html).not.toMatch(/style="[^"]*background-color:[^"]*"/i);
      expect(html).toContain("Hero Content");
    });

    it("respects explicit merchant-configured section background color over theme default", () => {
      const config = createDefaultLandingPageConfig("Override Test");
      const hero = { ...config.sections[0] };
      hero.elements = [];
      hero.styles = {
        ...hero.styles,
        background: {
          type: "color",
          color: "#ff0055", // Explicit override
          opacity: 100,
        },
      };

      const html = renderToStaticMarkup(
        <SectionWrapper
          section={hero}
          storeSlug="override-test"
        >
          <div data-testid="section-content">Hero Content</div>
        </SectionWrapper>,
      );

      // Section wrapper must have the explicit merchant color
      expect(html).toContain("background-color:#ff0055");
    });
  });

  describe("StorefrontShell Theme Propagation", () => {
    it("applies theme semantic tokens and mode class to StorefrontShell wrapper", () => {
      const theme: LandingPageTheme = {
        presetId: "monochromatic",
        mode: "dark",
        colors: getPaletteColors("monochromatic", "dark"),
      };

      const html = renderToStaticMarkup(
        <StorefrontShell
          storeName="Mono Studio"
          storeSlug="mono-studio"
          theme={theme}
        >
          <main>Store Body</main>
        </StorefrontShell>,
      );

      expect(html).toContain("storefront-layout");
      expect(html).toContain("dark");
      expect(html).toContain("--store-background");
      expect(html).toContain(COLOR_PRESETS["monochromatic"].dark.background);
    });
  });
});
