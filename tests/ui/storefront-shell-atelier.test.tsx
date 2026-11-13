import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import type { LandingPageTheme } from "@calcart/stores/landing-page";

const theme = (headingFont: LandingPageTheme["typography"]["headingFont"]): LandingPageTheme => ({
  presetId: "editorial-luxury",
  mode: "light",
  colors: {} as LandingPageTheme["colors"],
  typography: { headingFont, bodyFont: "sans", scale: "md" },
  animations: { enabled: true, intensity: "subtle" },
});

function render(props: Partial<React.ComponentProps<typeof StorefrontShell>> = {}) {
  return renderToStaticMarkup(
    <StorefrontShell storeName="Alpine Outfitters" storeSlug="alpine" {...props}>
      <div>Page</div>
    </StorefrontShell>,
  );
}

describe("Atelier storefront shell", () => {
  it("sets the store name as a typographic wordmark linking to the store home", () => {
    const html = render();
    expect(html).toContain('class="storefront-brand-name"');
    expect(html).toContain('href="/stores/alpine"');
    expect(html).toContain('aria-label="Alpine Outfitters home"');
  });

  it("uses the Atelier serif display face when the merchant has not chosen a heading font", () => {
    expect(render()).toContain("--at-display:var(--at-serif)");
  });

  it.each([
    ["sans", "var(--font-sans)"],
    ["mono", "var(--font-mono)"],
    ["display", "var(--font-display, var(--font-sans))"],
    ["serif", "var(--at-serif)"],
  ] as const)("honours the merchant heading font '%s'", (font, expected) => {
    expect(render({ theme: theme(font) })).toContain(`--at-display:${expected}`);
  });

  it("applies merchant theme tokens to the shell root", () => {
    const html = render({ theme: theme("serif") });
    expect(html).toContain("--background:");
    expect(html).toContain("--primary:");
  });

  it("renders the announcement as one static line, with no ticker or looping animation", () => {
    const html = render({ announcement: "Free shipping over 999" });
    expect(html).toContain("Free shipping over 999");
    expect(html).not.toContain("marquee");
    expect(html).not.toContain("animate-pulse");
  });

  it("keeps the cart count digit in its own aria-hidden span and wraps it for the (n) treatment", () => {
    const html = render({ cartItemCount: 4 });
    expect(html).toContain('class="storefront-cart-count" aria-hidden="true">4</span>');
    expect(html).toContain("at-count");
  });

  it("does not render a count badge for an empty cart", () => {
    expect(render({ cartItemCount: 0 })).not.toContain("storefront-cart-count");
  });

  it("exposes an accessible index-menu trigger and a skip link", () => {
    const html = render();
    expect(html).toContain('aria-label="Open navigation menu"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('href="#main-content"');
  });

  it("scopes footer links to the store and states only the true payment fact", () => {
    const html = render();
    expect(html).toContain('href="/stores/alpine/account/orders"');
    expect(html).toContain("Payments processed by Razorpay");
    expect(html).toContain("Powered by Cal Cart");
  });
});
