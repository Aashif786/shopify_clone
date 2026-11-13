import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DESIGN_THEME_IDS,
  DESIGN_THEMES,
  createDefaultLandingPageConfig,
  type DesignThemeId,
  type LandingPageTheme,
} from "@calcart/stores/landing-page";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import { StorefrontLandingRenderer } from "@/components/storefront/landing-page/storefront-landing-renderer";
import { ThemeEditor } from "@/components/merchant/landing-page/theme-editor";

function themeWith(overrides: Partial<LandingPageTheme> = {}): LandingPageTheme {
  return { ...createDefaultLandingPageConfig("Test").theme, ...overrides };
}

function renderShell(theme?: LandingPageTheme) {
  return renderToStaticMarkup(
    <StorefrontShell storeName="Alpine Outfitters" storeSlug="alpine" theme={theme}>
      <div>Page</div>
    </StorefrontShell>,
  );
}

describe("storefront shell applies the selected design theme", () => {
  it.each(DESIGN_THEME_IDS)("marks the root with the %s theme, its variants and its tokens", (id: DesignThemeId) => {
    const html = renderShell(themeWith({ designTheme: id }));
    const def = DESIGN_THEMES[id];
    expect(html).toContain(`data-design-theme="${id}"`);
    expect(html).toContain(`data-ds-card="${def.variants.productCard}"`);
    expect(html).toContain(`data-ds-grid="${def.variants.grid}"`);
    expect(html).toContain(`data-ds-collections="${def.variants.collections}"`);
    expect(html).toContain(`--ds-radius-btn:${def.tokens["--ds-radius-btn"]}`);
  });

  it("each theme brings its own display face; Rustic Heritage keeps the merchant heading-font rules", () => {
    expect(renderShell(themeWith({ designTheme: "modern-minimal" }))).toContain("--at-display:var(--ds-font-heading)");
    expect(renderShell(themeWith({ designTheme: "luxury-editorial" }))).toContain("--at-display:var(--ds-font-heading)");
    const serif = themeWith({
      designTheme: "rustic-heritage",
      typography: { headingFont: "serif", bodyFont: "sans", scale: "md" },
    });
    const mono = themeWith({
      designTheme: "rustic-heritage",
      typography: { headingFont: "mono", bodyFont: "sans", scale: "md" },
    });
    expect(renderShell(serif)).toContain("--at-display:var(--at-serif)");
    expect(renderShell(mono)).toContain("--at-display:var(--font-mono)");
    // A non-default theme ignores the merchant's old heading-font choice.
    expect(
      renderShell({ ...mono, designTheme: "modern-minimal" }),
    ).toContain("--at-display:var(--ds-font-heading)");
  });

  it("leaves Rustic Heritage on the original rendering path (no custom-theme marker)", () => {
    const rustic = renderShell(themeWith({ designTheme: "rustic-heritage" }));
    const legacy = renderShell(); // no theme at all, as for any pre-existing store
    for (const html of [rustic, legacy]) {
      expect(html).not.toContain("data-ds-custom");
      expect(html).toContain('data-design-theme="rustic-heritage"');
      expect(html).toContain('class="storefront-brand-name"');
    }
  });

  it("uses a different header composition per theme", () => {
    const centered = renderShell(themeWith({ designTheme: "rustic-heritage" }));
    const inline = renderShell(themeWith({ designTheme: "modern-minimal" }));
    // Centred: navigation precedes the wordmark. Inline: the wordmark leads.
    expect(centered.indexOf("storefront-nav ")).toBeLessThan(centered.indexOf("storefront-brand "));
    expect(inline.indexOf("storefront-brand ")).toBeLessThan(inline.indexOf("storefront-nav "));
    expect(DESIGN_THEMES["luxury-editorial"].variants.header).toBe("centered");
    expect(DESIGN_THEMES["bold-contemporary"].variants.header).toBe("inline");
  });
});

describe("appearance toggle on the storefront", () => {
  it("is not rendered unless the merchant enabled it", () => {
    expect(renderShell(themeWith({ appearanceToggle: false }))).not.toContain("storefront-appearance-toggle");
    expect(renderShell(themeWith())).not.toContain("storefront-appearance-toggle");
    expect(renderShell()).not.toContain("storefront-appearance-toggle");
  });

  it("is rendered as an accessible toggle when enabled, for every design theme", () => {
    for (const id of DESIGN_THEME_IDS) {
      const html = renderShell(themeWith({ designTheme: id, appearanceToggle: true, mode: "light" }));
      expect(html).toContain('data-testid="storefront-appearance-toggle"');
      expect(html).toContain('aria-label="Switch to dark appearance"');
      expect(html).toContain('aria-pressed="false"');
    }
  });

  it("starts from the merchant default appearance", () => {
    const dark = renderShell(themeWith({ appearanceToggle: true, mode: "dark" }));
    expect(dark).toContain('aria-label="Switch to light appearance"');
    expect(dark).toContain('aria-pressed="true"');
  });

  it("does not change the design theme", () => {
    const html = renderShell(themeWith({ designTheme: "bold-contemporary", appearanceToggle: true, mode: "dark" }));
    expect(html).toContain('data-design-theme="bold-contemporary"');
  });
});

describe("landing page renderer (storefront and editor preview)", () => {
  function renderLanding(theme: LandingPageTheme, isPreview = false) {
    const config = { ...createDefaultLandingPageConfig("Preview"), theme };
    return renderToStaticMarkup(
      <StorefrontLandingRenderer config={config} storeSlug="alpine" isPreview={isPreview} products={[]} />,
    );
  }

  it.each(DESIGN_THEME_IDS)("the editor preview updates to the %s theme immediately", (id: DesignThemeId) => {
    const html = renderLanding(themeWith({ designTheme: id }), true);
    expect(html).toContain(`data-design-theme="${id}"`);
    expect(html).toContain(`--ds-heading-weight:${DESIGN_THEMES[id].tokens["--ds-heading-weight"]}`);
  });

  it("gives non-default themes the button radius of the theme, not the merchant's old shape", () => {
    const html = renderLanding(themeWith({ designTheme: "bold-contemporary" }), true);
    expect(html).toContain("--landing-btn-radius:var(--ds-radius-btn)");
    expect(renderLanding(themeWith({ designTheme: "rustic-heritage" }), true)).not.toContain(
      "--landing-btn-radius:var(--ds-radius-btn)",
    );
  });

  it("the editor preview shows the merchant default appearance, not a visitor's", () => {
    const html = renderLanding(themeWith({ appearanceToggle: true, mode: "light" }), true);
    expect(html).toContain('data-theme-mode="light"');
  });
});

describe("theme editor", () => {
  const noop = () => {};
  const html = (theme: LandingPageTheme) =>
    renderToStaticMarkup(<ThemeEditor theme={theme} onUpdateTheme={noop} />);

  it("lists every design theme as a selectable option with a visual preview", () => {
    const markup = html(themeWith());
    for (const id of DESIGN_THEME_IDS) {
      expect(markup).toContain(`data-testid="design-theme-option-${id}"`);
      expect(markup).toContain(DESIGN_THEMES[id].name);
      expect(markup).toContain(`data-design-theme="${id}"`); // the miniature preview
    }
    expect(markup.match(/type="radio"/g)?.length).toBeGreaterThanOrEqual(DESIGN_THEME_IDS.length);
  });

  it("states what is different about each theme", () => {
    const markup = html(themeWith());
    for (const id of DESIGN_THEME_IDS) {
      for (const line of DESIGN_THEMES[id].preview.differences) {
        expect(markup).toContain(line);
      }
    }
  });

  it("marks only the active theme as selected", () => {
    for (const id of DESIGN_THEME_IDS) {
      const markup = html(themeWith({ designTheme: id }));
      const option = markup.split(`data-testid="design-theme-option-${id}"`)[1]!.split("</label>")[0]!;
      expect(option).toContain("checked");
      expect(option).toContain("Selected");
      const others = DESIGN_THEME_IDS.filter((other) => other !== id);
      for (const other of others) {
        const block = markup.split(`data-testid="design-theme-option-${other}"`)[1]!.split("</label>")[0]!;
        expect(block).not.toContain("Selected");
      }
    }
  });

  it("replaces the old Default / Dark / Light theme selector", () => {
    const markup = html(themeWith());
    for (const legacy of ["Default Theme", "Storefront Inherited", "Forced Light Appearance", "Forced Dark Appearance", "Natural Storefront Behavior"]) {
      expect(markup).not.toContain(legacy);
    }
  });

  it("offers the appearance toggle as a separate setting from the theme", () => {
    const off = html(themeWith({ appearanceToggle: false }));
    expect(off).toContain("Enable storefront appearance toggle");
    expect(off).toContain('data-testid="appearance-toggle-setting"');
    expect(off).toContain("Default appearance");

    const on = html(themeWith({ appearanceToggle: true }));
    expect(on).toContain('aria-checked="true"');
  });

  it("keeps the colour palette controls as their own section", () => {
    expect(html(themeWith())).toContain("Curated Color Palettes");
  });
});
