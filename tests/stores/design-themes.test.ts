import { describe, expect, it } from "vitest";
import {
  COLOR_PRESETS,
  DESIGN_THEMES,
  DESIGN_THEME_IDS,
  applyAppearanceToTheme,
  applyDesignThemeToTheme,
  createDefaultLandingPageConfig,
  getDefaultAppearance,
  getDesignTheme,
  getPaletteColors,
  normalizeDesignThemeId,
  normalizeLandingPageConfig,
  resolveAppearance,
  resolveDesignThemeTokens,
  type LandingPageTheme,
  type StorefrontLandingPageConfig,
} from "@calcart/stores/landing-page";
import { LandingPageDraftValidator } from "../../apps/web/src/lib/api/landing-page-validator";

function baseTheme(overrides: Partial<LandingPageTheme> = {}): LandingPageTheme {
  return {
    ...createDefaultLandingPageConfig("Test").theme,
    ...overrides,
  };
}

describe("design theme registry", () => {
  it("offers at least four themes including Rustic Heritage", () => {
    expect(DESIGN_THEME_IDS.length).toBeGreaterThanOrEqual(4);
    expect(DESIGN_THEME_IDS).toEqual(
      expect.arrayContaining(["rustic-heritage", "modern-minimal", "luxury-editorial", "bold-contemporary"]),
    );
    for (const id of DESIGN_THEME_IDS) {
      const theme = DESIGN_THEMES[id];
      expect(theme.id).toBe(id);
      expect(theme.name).toBeTruthy();
      expect(theme.preview.differences.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every theme defines the full token set (so none can silently fall back to another)", () => {
    const reference = Object.keys(DESIGN_THEMES["rustic-heritage"].tokens).sort();
    for (const id of DESIGN_THEME_IDS) {
      expect(Object.keys(DESIGN_THEMES[id].tokens).sort()).toEqual(reference);
    }
  });

  it("themes are genuinely different design systems, not recoloured copies", () => {
    const ids = [...DESIGN_THEME_IDS];
    const dimensions: Array<(t: ReturnType<typeof getDesignTheme>) => string> = [
      (t) => t.fonts.heading,
      (t) => t.tokens["--ds-radius-btn"],
      (t) => t.tokens["--ds-radius-card"],
      (t) => t.tokens["--ds-media-ratio"],
      (t) => t.tokens["--ds-btn-shadow"],
      (t) => t.tokens["--ds-heading-tracking"],
      (t) => t.tokens["--ds-motion-ms"],
      (t) => `${t.variants.header}/${t.variants.productCard}/${t.variants.grid}/${t.variants.collections}`,
    ];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = getDesignTheme(ids[i]);
        const b = getDesignTheme(ids[j]);
        const differing = dimensions.filter((dim) => dim(a) !== dim(b)).length;
        // At least five independent dimensions must differ for any pair.
        expect(differing, `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("uses distinct typography, component shape and layout per theme", () => {
    const rustic = getDesignTheme("rustic-heritage");
    const modern = getDesignTheme("modern-minimal");
    const luxury = getDesignTheme("luxury-editorial");
    const bold = getDesignTheme("bold-contemporary");

    expect(new Set([rustic, modern, luxury, bold].map((t) => t.fonts.heading)).size).toBe(4);
    expect(rustic.tokens["--ds-radius-card"]).toBe("0");
    expect(modern.tokens["--ds-radius-card"]).not.toBe("0");
    expect(bold.tokens["--ds-btn-shadow"]).not.toBe("none");
    expect(luxury.tokens["--ds-media-ratio"]).toBe("3 / 4");
    expect(bold.variants.grid).toBe("asymmetric");
    expect(rustic.variants.grid).toBe("uniform");
    expect(modern.variants.productCard).not.toBe(rustic.variants.productCard);
  });

  it("resolves tokens and data attributes for a theme", () => {
    const resolved = resolveDesignThemeTokens("bold-contemporary");
    expect(resolved.dataAttributes["data-design-theme"]).toBe("bold-contemporary");
    expect(resolved.dataAttributes["data-ds-card"]).toBe("block");
    expect(resolved.cssVars["--ds-btn-shadow"]).toBe("4px 4px 0 var(--foreground)");
  });

  it("falls back to Rustic Heritage for missing or unknown ids", () => {
    for (const bad of [undefined, null, "", "neon", 7]) {
      expect(normalizeDesignThemeId(bad)).toBe("rustic-heritage");
    }
  });
});

describe("design theme persistence shape", () => {
  it("existing configurations without a design theme keep the original look", () => {
    const legacy = createDefaultLandingPageConfig("Legacy");
    delete (legacy.theme as Partial<LandingPageTheme>).designTheme;
    delete (legacy.theme as Partial<LandingPageTheme>).appearanceToggle;
    const normalized = normalizeLandingPageConfig(legacy);
    expect(normalized.theme.designTheme).toBe("rustic-heritage");
    expect(normalized.theme.appearanceToggle).toBe(false);
  });

  it("round-trips a chosen theme and the appearance toggle through normalisation", () => {
    const config = createDefaultLandingPageConfig("Round trip");
    config.theme = baseTheme({ designTheme: "luxury-editorial", appearanceToggle: true });
    const normalized = normalizeLandingPageConfig(JSON.parse(JSON.stringify(config)));
    expect(normalized.theme.designTheme).toBe("luxury-editorial");
    expect(normalized.theme.appearanceToggle).toBe(true);
  });

  it("accepts valid theme fields and rejects invalid ones at the API boundary", () => {
    const validator = new LandingPageDraftValidator();
    const config = createDefaultLandingPageConfig("Validate");

    const ok = validator.validate({
      draftConfig: { ...config, theme: { ...config.theme, designTheme: "modern-minimal", appearanceToggle: true } },
    });
    expect(ok.success).toBe(true);

    const badTheme = validator.validate({
      draftConfig: { ...config, theme: { ...config.theme, designTheme: "neon-party" } },
    });
    expect(badTheme.success).toBe(false);

    const badToggle = validator.validate({
      draftConfig: { ...config, theme: { ...config.theme, appearanceToggle: "yes" } },
    });
    expect(badToggle.success).toBe(false);
  });
});

describe("switching themes preserves content", () => {
  it("never touches sections, elements or any non-theme field", () => {
    const config = createDefaultLandingPageConfig("Content");
    const sectionsBefore = JSON.stringify(config.sections);

    let theme = config.theme;
    for (const id of DESIGN_THEME_IDS) {
      theme = applyDesignThemeToTheme(theme, id);
      expect(theme.designTheme).toBe(id);
    }
    const switched: StorefrontLandingPageConfig = { ...config, theme };
    expect(JSON.stringify(switched.sections)).toBe(sectionsBefore);
  });

  it("keeps typography, buttons, animations and background the merchant configured", () => {
    const theme = baseTheme({
      typography: { headingFont: "serif", bodyFont: "sans", scale: "lg", headingWeight: "bold" },
      buttons: { shape: "pill", variant: "solid", hoverEffect: "lift" },
      background: { type: "color", color: "#123456", opacity: 100, size: "cover", position: "center" },
    });
    const next = applyDesignThemeToTheme(theme, "bold-contemporary");
    expect(next.typography).toEqual(theme.typography);
    expect(next.buttons).toEqual(theme.buttons);
    expect(next.animations).toEqual(theme.animations);
    expect(next.background).toEqual(theme.background);
  });

  it("selecting Rustic Heritage changes only the theme id", () => {
    const theme = baseTheme({ designTheme: "modern-minimal" });
    const next = applyDesignThemeToTheme(theme, "rustic-heritage");
    expect({ ...next, designTheme: theme.designTheme }).toEqual(theme);
  });

  it("moves an untouched curated palette to the theme's recommendation", () => {
    const theme = baseTheme({ mode: "light", presetId: "modern-minimalist", colors: getPaletteColors("modern-minimalist", "light") });
    const next = applyDesignThemeToTheme(theme, "luxury-editorial");
    expect(next.presetId).toBe("editorial-luxury");
    expect(next.colors).toEqual(getPaletteColors("editorial-luxury", "light"));
  });

  it("never overwrites a palette the merchant customised", () => {
    const custom = { ...getPaletteColors("modern-minimalist", "light"), primary: "#ff00aa" };
    const theme = baseTheme({ mode: "light", presetId: "modern-minimalist", colors: custom });
    const next = applyDesignThemeToTheme(theme, "bold-contemporary");
    expect(next.colors).toEqual(custom);
    expect(next.presetId).toBe("modern-minimalist");
  });
});

describe("appearance is independent of the design theme", () => {
  it("changing appearance never changes the selected design theme", () => {
    for (const id of DESIGN_THEME_IDS) {
      const theme = baseTheme({ designTheme: id, mode: "light", colors: getPaletteColors("modern-minimalist", "light") });
      const dark = applyAppearanceToTheme(theme, "dark");
      expect(dark.designTheme).toBe(id);
      expect(dark.mode).toBe("dark");
    }
  });

  it("swaps neutrals but keeps a merchant's brand colours when flipping appearance", () => {
    const custom = { ...getPaletteColors("modern-minimalist", "light"), primary: "#ff00aa" };
    const theme = baseTheme({ mode: "light", presetId: "modern-minimalist", colors: custom });
    const dark = applyAppearanceToTheme(theme, "dark");
    expect(dark.colors.primary).toBe("#ff00aa");
    expect(dark.colors.background).toBe(COLOR_PRESETS["modern-minimalist"].dark.background);
  });

  it("ignores visitor and system preference entirely when the toggle is off", () => {
    const theme = baseTheme({ mode: "light", appearanceToggle: false });
    expect(resolveAppearance(theme, "dark", "dark")).toBe("light");
    expect(resolveAppearance(baseTheme({ mode: "dark" }), "light", "light")).toBe("dark");
  });

  it("with the toggle on: visitor choice, then system preference, then merchant default", () => {
    const theme = baseTheme({ mode: "light", appearanceToggle: true });
    expect(resolveAppearance(theme, "dark", "light")).toBe("dark");
    expect(resolveAppearance(theme, null, "dark")).toBe("dark");
    expect(resolveAppearance(theme, null, null)).toBe("light");
  });

  it("a legacy 'default' mode falls back to the theme's own default appearance", () => {
    expect(getDefaultAppearance(baseTheme({ mode: "default", designTheme: "rustic-heritage" }))).toBe("dark");
    expect(getDefaultAppearance(baseTheme({ mode: "default", designTheme: "modern-minimal" }))).toBe("light");
  });
});
