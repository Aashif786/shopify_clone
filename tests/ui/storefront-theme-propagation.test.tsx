import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DESIGN_THEMES,
  createDefaultLandingPageConfig,
  type LandingPageTheme,
} from "@calcart/stores/landing-page";

// The Next route files rely on the automatic JSX runtime; vitest's transform needs React in scope.
(globalThis as { React?: typeof React }).React = React;

// `next` is only installed under apps/web, so the route files resolve it from there.
vi.mock("../../apps/web/node_modules/next/navigation", () => ({
  useParams: () => ({ storeSlug: "alpha" }),
  usePathname: () => "/stores/alpha",
}));

import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import {
  StorefrontPortalContainerContext,
  StorefrontThemeScope,
  useStorefrontPortalContainer,
} from "@/components/storefront/storefront-theme-root";
import {
  StorefrontIdentityContext,
  useLayoutStorefrontIdentity,
} from "@/components/storefront/use-storefront-identity";
import { QuickViewContent } from "@/components/storefront/products/quick-view-modal";
import { OptionSelector } from "@/components/storefront/products/option-selector";
import StorefrontNotFound from "../../apps/web/app/stores/[storeSlug]/not-found";
import StorefrontError from "../../apps/web/app/stores/[storeSlug]/error";
import StorefrontLoading from "../../apps/web/app/stores/[storeSlug]/loading";
import type { StorefrontProductDetailDTO } from "@/components/storefront/products/product-detail-view";

function themeWith(overrides: Partial<LandingPageTheme> = {}): LandingPageTheme {
  return { ...createDefaultLandingPageConfig("Test").theme, ...overrides };
}

const luxury = themeWith({ designTheme: "luxury-editorial" });
const bold = themeWith({ designTheme: "bold-contemporary" });

function withIdentity(slug: string, theme: LandingPageTheme | undefined, ui: React.ReactNode) {
  return (
    <StorefrontIdentityContext.Provider value={{ slug, storeName: "Alpha Goods", theme, isLoaded: true }}>
      {ui}
    </StorefrontIdentityContext.Provider>
  );
}

const rootTag = (html: string) => html.slice(0, html.indexOf(">") + 1);

describe("published theme resolution through the layout identity", () => {
  it("a route that passes no theme inherits the store's published design theme", () => {
    const html = renderToStaticMarkup(
      withIdentity(
        "alpha",
        luxury,
        <StorefrontShell storeName="Store" storeSlug="alpha">
          <div>Cart</div>
        </StorefrontShell>,
      ),
    );
    expect(html).toContain('data-design-theme="luxury-editorial"');
    expect(html).toContain(`--ds-radius-btn:${DESIGN_THEMES["luxury-editorial"].tokens["--ds-radius-btn"]}`);
    // the real store name replaces the page's placeholder
    expect(html).toContain("Alpha Goods");
  });

  it("a page's own theme wins over the layout identity", () => {
    const html = renderToStaticMarkup(
      withIdentity(
        "alpha",
        luxury,
        <StorefrontShell storeName="Store" storeSlug="alpha" theme={bold}>
          <div>Page</div>
        </StorefrontShell>,
      ),
    );
    expect(html).toContain('data-design-theme="bold-contemporary"');
    expect(html).not.toContain('data-design-theme="luxury-editorial"');
  });

  it("never serves one store's identity to another store (store isolation)", () => {
    const html = renderToStaticMarkup(
      withIdentity(
        "store-a",
        luxury,
        <StorefrontShell storeName="Store" storeSlug="store-b">
          <div>Page</div>
        </StorefrontShell>,
      ),
    );
    expect(html).not.toContain('data-design-theme="luxury-editorial"');
    expect(html).not.toContain("Alpha Goods");
    // missing theme data uses the established fallback
    expect(html).toContain('data-design-theme="rustic-heritage"');
  });

  it("useLayoutStorefrontIdentity is null for another store and outside the provider", () => {
    const probe = (slug: string) => {
      function Probe() {
        const id = useLayoutStorefrontIdentity(slug);
        return <span>{id ? `identity:${id.storeName}` : "none"}</span>;
      }
      return Probe;
    };
    const A = probe("alpha");
    const B = probe("beta");
    expect(renderToStaticMarkup(withIdentity("alpha", luxury, <A />))).toContain("identity:Alpha Goods");
    expect(renderToStaticMarkup(withIdentity("alpha", luxury, <B />))).toContain("none");
    expect(renderToStaticMarkup(<A />)).toContain("none");
  });

  it("falls back to the default design theme when the store has no theme", () => {
    const html = renderToStaticMarkup(
      withIdentity(
        "alpha",
        undefined,
        <StorefrontShell storeName="Store" storeSlug="alpha">
          <div>Page</div>
        </StorefrontShell>,
      ),
    );
    expect(html).toContain('data-design-theme="rustic-heritage"');
    expect(html).not.toContain('data-ds-custom="true"');
  });
});

describe("surfaces outside the shell carry the same published theme", () => {
  it.each([
    ["not-found", () => <StorefrontNotFound />],
    ["error", () => <StorefrontError error={new Error("x")} reset={() => {}} />],
    ["loading", () => <StorefrontLoading />],
  ])("%s state is themed with the store's design theme", (_name, render) => {
    const html = renderToStaticMarkup(withIdentity("alpha", luxury, render()));
    expect(html).toContain('data-design-theme="luxury-editorial"');
    expect(html).toContain('data-ds-custom="true"');
    expect(html).toContain("--ds-radius-btn");
  });

  it("they do not adopt another store's theme", () => {
    const html = renderToStaticMarkup(withIdentity("other-store", luxury, <StorefrontNotFound />));
    expect(html).not.toContain('data-design-theme="luxury-editorial"');
  });

  it("StorefrontThemeScope keeps the design theme independent of light/dark appearance", () => {
    const dark = themeWith({ designTheme: "luxury-editorial", appearanceToggle: true, mode: "dark" });
    const light = themeWith({ designTheme: "luxury-editorial", appearanceToggle: true, mode: "light" });
    const darkHtml = renderToStaticMarkup(
      withIdentity("alpha", dark, <StorefrontThemeScope storeSlug="alpha">x</StorefrontThemeScope>),
    );
    const lightHtml = renderToStaticMarkup(
      withIdentity("alpha", light, <StorefrontThemeScope storeSlug="alpha">x</StorefrontThemeScope>),
    );
    expect(darkHtml).toContain('data-design-theme="luxury-editorial"');
    expect(lightHtml).toContain('data-design-theme="luxury-editorial"');
    expect(rootTag(darkHtml)).not.toEqual(rootTag(lightHtml)); // palette/mode differ
  });

  it("Rustic Heritage keeps its identity in dark appearance", () => {
    const dark = themeWith({ designTheme: "rustic-heritage", appearanceToggle: true, mode: "dark" });
    const html = renderToStaticMarkup(
      withIdentity("alpha", dark, <StorefrontThemeScope storeSlug="alpha">x</StorefrontThemeScope>),
    );
    expect(html).toContain('data-design-theme="rustic-heritage"');
  });
});

describe("portalled surfaces", () => {
  it("expose the shell root as the portal container (null outside a shell)", () => {
    function Probe() {
      return <span>{useStorefrontPortalContainer() === null ? "document-body" : "shell-root"}</span>;
    }
    expect(renderToStaticMarkup(<Probe />)).toContain("document-body");
    const fake = { nodeName: "DIV" } as unknown as HTMLElement;
    expect(
      renderToStaticMarkup(
        <StorefrontPortalContainerContext.Provider value={fake}>
          <Probe />
        </StorefrontPortalContainerContext.Provider>,
      ),
    ).toContain("shell-root");
  });
});

describe("Quick View and selectors inherit the theme", () => {
  const product = {
    id: "p1",
    storeId: "s1",
    title: "Linen Shirt",
    description: "A shirt.",
    slug: "linen-shirt",
    status: "ACTIVE",
    options: [{ id: "o1", productId: "p1", name: "Size", position: 0, values: ["S", "M"], isPublishable: false }],
    variants: ["S", "M"].map((s) => ({
      id: `v-${s}`,
      productId: "p1",
      title: s,
      sku: null,
      price: 2000,
      compareAtPrice: 2500,
      currency: "USD",
      position: 0,
      status: "ACTIVE",
      option1: s,
      option2: null,
      option3: null,
    })),
    media: [{ id: "m1", productId: "p1", variantId: null, url: "https://x/y.jpg", altText: null, position: 0 }],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as unknown as StorefrontProductDetailDTO;

  it("renders inside the themed shell root and uses theme primitives instead of fixed styling", () => {
    const html = renderToStaticMarkup(
      withIdentity(
        "alpha",
        bold,
        <StorefrontShell storeName="Store" storeSlug="alpha">
          <QuickViewContent product={product} storeSlug="alpha" productSlug="linen-shirt" addItem={vi.fn()} />
        </StorefrontShell>,
      ),
    );
    const root = html.indexOf('data-design-theme="bold-contemporary"');
    const quick = html.indexOf('data-testid="quick-view-options"');
    expect(root).toBeGreaterThan(-1);
    expect(quick).toBeGreaterThan(root); // descendant of the themed root, so it inherits its variables
    // shared Atelier / design-system primitives
    expect(html).toContain("ds-btn ds-btn-primary");
    expect(html).toContain("ds-media");
    expect(html).toContain("ds-badge");
    expect(html).toContain("at-title");
    // option pills take the theme's button radius token
    expect(html).toContain("var(--ds-radius-btn");
  });

  it("no longer hardcodes off-theme radii or mono/legacy badge styling", () => {
    const html = renderToStaticMarkup(
      <QuickViewContent product={product} storeSlug="alpha" productSlug="linen-shirt" addItem={vi.fn()} />,
    );
    expect(html).not.toMatch(/rounded-(xl|2xl|3xl)/);
    expect(html).not.toContain("font-mono");
    expect(html).not.toContain("btn-primary btn-md");
  });

  it("OptionSelector pills and legend use theme tokens", () => {
    const html = renderToStaticMarkup(
      <OptionSelector
        option={{ id: "o", productId: "p", name: "Size", position: 0, values: ["S", "M"], isPublishable: false }}
        value="M"
        onChange={() => {}}
      />,
    );
    expect(html).toContain("var(--ds-radius-btn");
    expect(html).toContain("var(--at-hairline)");
    expect(html).not.toMatch(/rounded-(xl|2xl|3xl)/);
    const checked = [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes('checked=""'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="M"');
  });
});
