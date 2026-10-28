import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "../../apps/web/app/page";

describe("Cal Cart Root Landing Page", () => {
  it("renders the complete new landing page with Cal Cart branding and core sections", () => {
    const html = renderToStaticMarkup(<Page />);

    // Brand and header navigation
    expect(html).toContain("Cal Cart");
    expect(html).toContain("/merchant/login");
    expect(html).toContain("/merchant/register");
    expect(html).toContain("nova-theme-toggle");
    expect(html).toContain("theme-mode-toggle");
    expect(html).toContain("nova-mobile-toggle");
    expect(html).toContain("nova-nav-links");

    // Hero section
    expect(html).toContain("COMMERCE OS / 001");
    expect(html).toContain("Commerce,");
    expect(html).toContain("in a different");
    expect(html).toContain("dimension.");
    expect(html).toContain("Start building free");
    expect(html).toContain("10x");
    expect(html).toContain("faster launch");
    expect(html).toContain("scalability");

    // Brand Philosophy section
    expect(html).toContain("Our belief");
    expect(html).toContain("Your brand.");
    expect(html).toContain("Human-first design");
    expect(html).toContain("Power you can&#x27;t see");
    expect(html).toContain("Built to scale with you");

    // Storefront Showcase section
    expect(html).toContain("02 / STOREFRONT EXPERIENCE");
    expect(html).toContain("Give your products a world");
    expect(html).toContain("of their own.");
    expect(html).toContain("The Essence Tee");
    expect(html).toContain("Ceramic Ritual Set");
    expect(html).toContain("Midnight Amber Extract");

    // Horizontal Story Platform section
    expect(html).toContain("05 / A NEW DIMENSION");
    expect(html).toContain("SCROLL TO DISCOVER");
    expect(html).toContain("Your storefront,");
    expect(html).toContain("Products that");
    expect(html).toContain("Orders &amp;");
    expect(html).toContain("Payments,");
    expect(html).toContain("Insight at");

    // Operations Engine section
    expect(html).toContain("04 / OPERATIONS");
    expect(html).toContain("THE COMMERCE ENGINE");
    expect(html).toContain("Everything works together.");
    expect(html).toContain("Beautifully.");
    expect(html).toContain("Storefront");
    expect(html).toContain("Orders");
    expect(html).toContain("Inventory");
    expect(html).toContain("Payments");
    expect(html).toContain("Analytics");
    expect(html).toContain("24,180");
    expect(html).toContain("99.8%");

    // Visual Proof Bento capabilities
    expect(html).toContain("06 / BUILT FOR THE DETAILS");
    expect(html).toContain("Everything you need.");
    expect(html).toContain("Launch in a day");
    expect(html).toContain("Every payment flow");
    expect(html).toContain("Zero-oversell inventory");
    expect(html).toContain("Insights you can act on");

    // Growth Story timeline
    expect(html).toContain("07 / GROWTH STORY");
    expect(html).toContain("Make your next stage");
    expect(html).toContain("feel natural.");
    expect(html).toContain("Day 1");
    expect(html).toContain("Month 3");
    expect(html).toContain("Year 1");
    expect(html).toContain("Beyond");

    // Final CTA section
    expect(html).toContain("08 / YOUR NEXT CHAPTER");
    expect(html).toContain("friction.");
    expect(html).toContain("Start building free");
    expect(html).toContain("Explore live demo store");

    // Footer section
    expect(html).toContain("Cal Cart Systems");
    expect(html).toContain("All systems nominal");
    expect(html).toContain("/merchant/products");
    expect(html).toContain("/merchant/inventory");
    expect(html).toContain("/merchant/orders");
    expect(html).toContain("/stores/souled-store");
  });

  it("renders with dark and light class compatibility without throwing", () => {
    expect(() => renderToStaticMarkup(<Page />)).not.toThrow();
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('class="landing-page-root"');
  });
});
