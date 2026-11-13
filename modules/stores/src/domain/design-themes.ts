/**
 * Storefront design-system themes.
 *
 * A design theme is a complete visual language for a storefront: type, shape, surfaces,
 * buttons, forms, navigation, product/collection composition, imagery, density and
 * motion. It is chosen independently of the colour palette (`presetId`) and of the
 * light/dark appearance (`mode` + `appearanceToggle`).
 *
 * The registry below is the single source of truth. The storefront and the editor
 * preview both turn a definition into CSS custom properties (`--ds-*`) and layout
 * variant flags (`data-ds-*`) with `resolveDesignThemeTokens`, so a theme can never
 * look different in the editor than it does when published.
 *
 * Rustic Heritage is the storefront's original look and is the default for any
 * configuration that does not name a theme, so existing stores are unchanged.
 */

export const DESIGN_THEME_IDS = [
  "rustic-heritage",
  "modern-minimal",
  "luxury-editorial",
  "bold-contemporary",
] as const;

export type DesignThemeId = (typeof DESIGN_THEME_IDS)[number];

export const DEFAULT_DESIGN_THEME_ID: DesignThemeId = "rustic-heritage";

export type DesignHeaderVariant = "centered" | "inline";
export type DesignCardVariant = "frame" | "soft" | "editorial" | "block";
export type DesignGridVariant = "uniform" | "asymmetric";
export type DesignCollectionsVariant = "index" | "cards" | "tiles";

/** Keys of the font families the storefront loads (see design-theme-fonts.ts). */
export type DesignFontKey = "fraunces" | "inter" | "cormorant" | "jost" | "bricolage";

export interface DesignThemeVariants {
  header: DesignHeaderVariant;
  productCard: DesignCardVariant;
  grid: DesignGridVariant;
  collections: DesignCollectionsVariant;
}

export interface DesignThemePreview {
  /** Short description of the heading treatment used by the editor swatch. */
  headingSample: string;
  /** Plain-language bullets shown beside the swatch so differences are obvious. */
  differences: string[];
}

export interface DesignThemeDefinition {
  id: DesignThemeId;
  name: string;
  tagline: string;
  description: string;
  /** Colour palette recommended for this theme; null keeps whatever the merchant has. */
  recommendedPalette: "modern-minimalist" | "bold-vibrant" | "editorial-luxury" | "high-tech" | "monochromatic" | null;
  /** Appearance a store starts in when the merchant has not chosen one. */
  defaultAppearance: "light" | "dark";
  fonts: { heading: DesignFontKey; body: DesignFontKey };
  variants: DesignThemeVariants;
  /** CSS custom properties. All values are static strings; no user input reaches them. */
  tokens: Record<`--ds-${string}`, string>;
  preview: DesignThemePreview;
}

const RUSTIC_HERITAGE: DesignThemeDefinition = {
  id: "rustic-heritage",
  name: "Rustic Heritage",
  tagline: "Traditional, boxy and antique",
  description:
    "The storefront's original look: warm serif headlines, square corners, hairline rules and a quiet, framed product presentation.",
  recommendedPalette: null,
  defaultAppearance: "dark",
  fonts: { heading: "fraunces", body: "inter" },
  variants: { header: "centered", productCard: "frame", grid: "uniform", collections: "index" },
  tokens: {
    "--ds-font-heading": 'var(--font-atelier-serif, ui-serif, Georgia, "Times New Roman", serif)',
    "--ds-font-body": "var(--font-sans, system-ui, sans-serif)",
    "--ds-heading-weight": "400",
    "--ds-heading-tracking": "-0.015em",
    "--ds-heading-transform": "none",
    "--ds-heading-style": "normal",
    "--ds-eyebrow-tracking": "0.18em",
    "--ds-eyebrow-transform": "uppercase",
    "--ds-eyebrow-size": "0.6875rem",
    "--ds-nav-weight": "400",
    "--ds-nav-tracking": "0",
    "--ds-nav-transform": "none",
    "--ds-brand-tracking": "-0.01em",
    "--ds-brand-transform": "none",
    "--ds-radius-card": "0",
    "--ds-radius-btn": "0",
    "--ds-radius-input": "0",
    "--ds-radius-media": "0",
    "--ds-radius-badge": "0",
    "--ds-border-width": "1px",
    "--ds-card-bg": "transparent",
    "--ds-card-border": "var(--at-hairline)",
    "--ds-card-shadow": "none",
    "--ds-card-padding": "0",
    "--ds-btn-height": "3rem",
    "--ds-btn-px": "2rem",
    "--ds-btn-size": "0.75rem",
    "--ds-btn-weight": "500",
    "--ds-btn-tracking": "0.14em",
    "--ds-btn-transform": "uppercase",
    "--ds-btn-border-width": "1px",
    "--ds-btn-shadow": "none",
    "--ds-btn-shadow-hover": "none",
    "--ds-btn-hover-translate": "0px",
    "--ds-btn-primary-bg": "var(--primary)",
    "--ds-btn-primary-fg": "var(--primary-foreground)",
    "--ds-btn-primary-border": "var(--primary)",
    "--ds-btn-primary-hover-bg": "var(--primary)",
    "--ds-btn-primary-hover-fg": "var(--primary-foreground)",
    "--ds-media-ratio": "4 / 5",
    "--ds-media-hover-scale": "1.03",
    "--ds-media-filter": "none",
    "--ds-grid-gap-x": "1.5rem",
    "--ds-grid-gap-y": "2.5rem",
    "--ds-section-gap": "6rem",
    "--ds-header-h": "3.5rem",
    "--ds-header-border": "1px solid var(--at-hairline)",
    "--ds-motion-ms": "200ms",
    "--ds-badge-bg": "var(--foreground)",
    "--ds-badge-fg": "var(--background)",
    "--ds-text-align-card": "left",
  },
  preview: {
    headingSample: "Serif headline, sentence case",
    differences: ["Square corners, 1px rules", "Warm serif headlines", "Framed 4:5 product images", "Centred wordmark"],
  },
};

const MODERN_MINIMAL: DesignThemeDefinition = {
  id: "modern-minimal",
  name: "Modern Minimal",
  tagline: "Clean, airy and contemporary",
  description:
    "Crisp sans-serif type, generous whitespace, soft rounded surfaces and understated buttons. Almost no borders; hierarchy comes from space.",
  recommendedPalette: "modern-minimalist",
  defaultAppearance: "light",
  fonts: { heading: "inter", body: "inter" },
  variants: { header: "inline", productCard: "soft", grid: "uniform", collections: "cards" },
  tokens: {
    "--ds-font-heading": "var(--font-ds-inter, system-ui, -apple-system, 'Segoe UI', sans-serif)",
    "--ds-font-body": "var(--font-ds-inter, system-ui, -apple-system, 'Segoe UI', sans-serif)",
    "--ds-heading-weight": "500",
    "--ds-heading-tracking": "-0.035em",
    "--ds-heading-transform": "none",
    "--ds-heading-style": "normal",
    "--ds-eyebrow-tracking": "0.02em",
    "--ds-eyebrow-transform": "none",
    "--ds-eyebrow-size": "0.8125rem",
    "--ds-nav-weight": "500",
    "--ds-nav-tracking": "-0.005em",
    "--ds-nav-transform": "none",
    "--ds-brand-tracking": "-0.04em",
    "--ds-brand-transform": "none",
    "--ds-radius-card": "1.25rem",
    "--ds-radius-btn": "0.75rem",
    "--ds-radius-input": "0.75rem",
    "--ds-radius-media": "1.25rem",
    "--ds-radius-badge": "999px",
    "--ds-border-width": "0px",
    "--ds-card-bg": "color-mix(in srgb, var(--foreground) 4%, transparent)",
    "--ds-card-border": "transparent",
    "--ds-card-shadow": "none",
    "--ds-card-padding": "1rem",
    "--ds-btn-height": "2.875rem",
    "--ds-btn-px": "1.5rem",
    "--ds-btn-size": "0.9375rem",
    "--ds-btn-weight": "500",
    "--ds-btn-tracking": "-0.005em",
    "--ds-btn-transform": "none",
    "--ds-btn-border-width": "0px",
    "--ds-btn-shadow": "none",
    "--ds-btn-shadow-hover": "none",
    "--ds-btn-hover-translate": "0px",
    "--ds-btn-primary-bg": "var(--primary)",
    "--ds-btn-primary-fg": "var(--primary-foreground)",
    "--ds-btn-primary-border": "var(--primary)",
    "--ds-btn-primary-hover-bg": "color-mix(in srgb, var(--primary) 88%, var(--foreground))",
    "--ds-btn-primary-hover-fg": "var(--primary-foreground)",
    "--ds-media-ratio": "1 / 1",
    "--ds-media-hover-scale": "1.02",
    "--ds-media-filter": "none",
    "--ds-grid-gap-x": "1.25rem",
    "--ds-grid-gap-y": "3rem",
    "--ds-section-gap": "8rem",
    "--ds-header-h": "4.5rem",
    "--ds-header-border": "0 solid transparent",
    "--ds-motion-ms": "260ms",
    "--ds-badge-bg": "color-mix(in srgb, var(--foreground) 8%, transparent)",
    "--ds-badge-fg": "var(--foreground)",
    "--ds-text-align-card": "left",
  },
  preview: {
    headingSample: "Clean sans headline, tight tracking",
    differences: ["Soft 20px corners, no borders", "Inter sans-serif, airy spacing", "Square 1:1 product images", "Logo left, quiet header"],
  },
};

const LUXURY_EDITORIAL: DesignThemeDefinition = {
  id: "luxury-editorial",
  name: "Luxury Editorial",
  tagline: "Refined, serif and magazine-like",
  description:
    "Elegant high-contrast serif headlines paired with a light sans, tall portrait imagery, wide letter-spacing and thin outlined buttons.",
  recommendedPalette: "editorial-luxury",
  defaultAppearance: "light",
  fonts: { heading: "cormorant", body: "jost" },
  variants: { header: "centered", productCard: "editorial", grid: "uniform", collections: "tiles" },
  tokens: {
    "--ds-font-heading": "var(--font-ds-cormorant, 'Cormorant Garamond', Georgia, serif)",
    "--ds-font-body": "var(--font-ds-jost, system-ui, sans-serif)",
    "--ds-heading-weight": "400",
    "--ds-heading-tracking": "0.005em",
    "--ds-heading-transform": "none",
    "--ds-heading-style": "italic",
    "--ds-eyebrow-tracking": "0.32em",
    "--ds-eyebrow-transform": "uppercase",
    "--ds-eyebrow-size": "0.625rem",
    "--ds-nav-weight": "400",
    "--ds-nav-tracking": "0.14em",
    "--ds-nav-transform": "uppercase",
    "--ds-brand-tracking": "0.22em",
    "--ds-brand-transform": "uppercase",
    "--ds-radius-card": "0",
    "--ds-radius-btn": "0",
    "--ds-radius-input": "0",
    "--ds-radius-media": "0",
    "--ds-radius-badge": "0",
    "--ds-border-width": "1px",
    "--ds-card-bg": "transparent",
    "--ds-card-border": "transparent",
    "--ds-card-shadow": "none",
    "--ds-card-padding": "0",
    "--ds-btn-height": "3.25rem",
    "--ds-btn-px": "2.5rem",
    "--ds-btn-size": "0.6875rem",
    "--ds-btn-weight": "400",
    "--ds-btn-tracking": "0.28em",
    "--ds-btn-transform": "uppercase",
    "--ds-btn-border-width": "1px",
    "--ds-btn-shadow": "none",
    "--ds-btn-shadow-hover": "none",
    "--ds-btn-hover-translate": "0px",
    "--ds-btn-primary-bg": "transparent",
    "--ds-btn-primary-fg": "var(--foreground)",
    "--ds-btn-primary-border": "var(--foreground)",
    "--ds-btn-primary-hover-bg": "var(--foreground)",
    "--ds-btn-primary-hover-fg": "var(--background)",
    "--ds-media-ratio": "3 / 4",
    "--ds-media-hover-scale": "1.04",
    "--ds-media-filter": "saturate(0.92) contrast(1.02)",
    "--ds-grid-gap-x": "2.5rem",
    "--ds-grid-gap-y": "4.5rem",
    "--ds-section-gap": "9rem",
    "--ds-header-h": "5rem",
    "--ds-header-border": "1px solid var(--at-hairline)",
    "--ds-motion-ms": "420ms",
    "--ds-badge-bg": "transparent",
    "--ds-badge-fg": "var(--foreground)",
    "--ds-text-align-card": "center",
  },
  preview: {
    headingSample: "Italic serif headline, wide-set caps",
    differences: ["Cormorant serif + Jost sans", "Tall 3:4 portrait images", "Thin outlined, letter-spaced buttons", "Centred captions, slow 420ms motion"],
  },
};

const BOLD_CONTEMPORARY: DesignThemeDefinition = {
  id: "bold-contemporary",
  name: "Bold Contemporary",
  tagline: "Loud, graphic and confident",
  description:
    "Heavy expressive headlines, thick outlines, offset shadows and chunky pill buttons. Cards pop off the page and the product grid breaks its own rhythm.",
  recommendedPalette: "bold-vibrant",
  defaultAppearance: "light",
  fonts: { heading: "bricolage", body: "inter" },
  variants: { header: "inline", productCard: "block", grid: "asymmetric", collections: "tiles" },
  tokens: {
    "--ds-font-heading": "var(--font-ds-bricolage, system-ui, 'Segoe UI', sans-serif)",
    "--ds-font-body": "var(--font-ds-inter, system-ui, sans-serif)",
    "--ds-heading-weight": "800",
    "--ds-heading-tracking": "-0.045em",
    "--ds-heading-transform": "none",
    "--ds-heading-style": "normal",
    "--ds-eyebrow-tracking": "0.06em",
    "--ds-eyebrow-transform": "uppercase",
    "--ds-eyebrow-size": "0.75rem",
    "--ds-nav-weight": "700",
    "--ds-nav-tracking": "-0.01em",
    "--ds-nav-transform": "none",
    "--ds-brand-tracking": "-0.05em",
    "--ds-brand-transform": "none",
    "--ds-radius-card": "1.25rem",
    "--ds-radius-btn": "999px",
    "--ds-radius-input": "0.875rem",
    "--ds-radius-media": "0.875rem",
    "--ds-radius-badge": "999px",
    "--ds-border-width": "2px",
    "--ds-card-bg": "var(--card, var(--background))",
    "--ds-card-border": "var(--foreground)",
    "--ds-card-shadow": "5px 5px 0 var(--foreground)",
    "--ds-card-padding": "0.875rem",
    "--ds-btn-height": "3.25rem",
    "--ds-btn-px": "2rem",
    "--ds-btn-size": "0.9375rem",
    "--ds-btn-weight": "700",
    "--ds-btn-tracking": "-0.01em",
    "--ds-btn-transform": "none",
    "--ds-btn-border-width": "2px",
    "--ds-btn-shadow": "4px 4px 0 var(--foreground)",
    "--ds-btn-shadow-hover": "6px 6px 0 var(--foreground)",
    "--ds-btn-hover-translate": "-2px",
    "--ds-btn-primary-bg": "var(--primary)",
    "--ds-btn-primary-fg": "var(--primary-foreground)",
    "--ds-btn-primary-border": "var(--foreground)",
    "--ds-btn-primary-hover-bg": "var(--primary)",
    "--ds-btn-primary-hover-fg": "var(--primary-foreground)",
    "--ds-media-ratio": "4 / 5",
    "--ds-media-hover-scale": "1.05",
    "--ds-media-filter": "saturate(1.12) contrast(1.04)",
    "--ds-grid-gap-x": "1.25rem",
    "--ds-grid-gap-y": "2rem",
    "--ds-section-gap": "5rem",
    "--ds-header-h": "4.25rem",
    "--ds-header-border": "2px solid var(--foreground)",
    "--ds-motion-ms": "150ms",
    "--ds-badge-bg": "var(--primary)",
    "--ds-badge-fg": "var(--primary-foreground)",
    "--ds-text-align-card": "left",
  },
  preview: {
    headingSample: "Heavy grotesque headline, tight",
    differences: ["2px outlines + offset shadows", "Chunky pill buttons", "Asymmetric product grid", "Bold accent chips, fast 150ms motion"],
  },
};

export const DESIGN_THEMES: Record<DesignThemeId, DesignThemeDefinition> = {
  "rustic-heritage": RUSTIC_HERITAGE,
  "modern-minimal": MODERN_MINIMAL,
  "luxury-editorial": LUXURY_EDITORIAL,
  "bold-contemporary": BOLD_CONTEMPORARY,
};

export function isDesignThemeId(value: unknown): value is DesignThemeId {
  return typeof value === "string" && (DESIGN_THEME_IDS as readonly string[]).includes(value);
}

/** Unknown or missing ids fall back to the original look so nothing breaks. */
export function normalizeDesignThemeId(value: unknown): DesignThemeId {
  return isDesignThemeId(value) ? value : DEFAULT_DESIGN_THEME_ID;
}

export function getDesignTheme(id: unknown): DesignThemeDefinition {
  return DESIGN_THEMES[normalizeDesignThemeId(id)];
}

export interface ResolvedDesignTheme {
  id: DesignThemeId;
  definition: DesignThemeDefinition;
  /** Inline-style custom properties for the storefront root. */
  cssVars: Record<string, string>;
  /** `data-ds-*` attributes selecting the layout variants. */
  dataAttributes: {
    "data-design-theme": DesignThemeId;
    "data-ds-header": DesignHeaderVariant;
    "data-ds-card": DesignCardVariant;
    "data-ds-grid": DesignGridVariant;
    "data-ds-collections": DesignCollectionsVariant;
  };
}

export function resolveDesignThemeTokens(themeId: unknown): ResolvedDesignTheme {
  const definition = getDesignTheme(themeId);
  return {
    id: definition.id,
    definition,
    cssVars: { ...definition.tokens },
    dataAttributes: {
      "data-design-theme": definition.id,
      "data-ds-header": definition.variants.header,
      "data-ds-card": definition.variants.productCard,
      "data-ds-grid": definition.variants.grid,
      "data-ds-collections": definition.variants.collections,
    },
  };
}
