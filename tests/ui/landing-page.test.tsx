import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Page from "../../apps/web/app/page";

describe("Cal Cart Root Landing Page", () => {
  it("renders the complete new landing page with Cal Cart branding and core sections", () => {
    const html = renderToStaticMarkup(<Page />);

    // Brand and header
    expect(html).toContain("CAL");
    expect(html).toContain("CART");
    expect(html).toContain("/merchant/login");
    expect(html).toContain("/merchant/register");

    // Hero section
    expect(html).toContain("COMMERCE OS / 001");
    expect(html).toContain("Everything");
    expect(html).toContain("you sell.");
    expect(html).toContain("One system");
    expect(html).toContain("that moves.");
    expect(html).toContain("Enter Cal Cart");

    // Catalog & Product lab
    expect(html).toContain("01 / THE CATALOG");
    expect(html).toContain("ORBIT");
    expect(html).toContain("TEE");
    expect(html).toContain("COLORWAY");
    expect(html).toContain("Signal orange");

    // Storefront & World section
    expect(html).toContain("02 / STOREFRONT");
    expect(html).toContain("Your brand");
    expect(html).toContain("orbit-supply.co");
    expect(html).toContain("/stores/artisan-store/products");

    // Operations Engine
    expect(html).toContain("04 / OPERATIONS");
    expect(html).toContain("THE COMMERCE ENGINE");
    expect(html).toContain("CATALOG");
    expect(html).toContain("INVENTORY");
    expect(html).toContain("CHECKOUT");
    expect(html).toContain("ORDERS");
    expect(html).toContain("AUTOMATION");

    // Manifesto & Details with horizontal track & sticky container
    expect(html).toContain("05 / A NEW DIMENSION");
    expect(html).toContain("manifesto-sticky");
    expect(html).toContain("manifesto-track-wrap");
    expect(html).toContain("manifesto-track");
    expect(html).toContain("manifesto-progress");
    expect(html).toContain("06 / BUILT FOR THE DETAILS");
    expect(html).toContain("Product");
    expect(html).toContain("intelligence");

    // Interactive elements and stages
    expect(html).toContain("tee-stage");
    expect(html).toContain("op-detail");
    expect(html).toContain("store-window");
    expect(html).toContain("orbit-card");

    // CTA & Footer
    expect(html).toContain("08 / YOUR NEXT CHAPTER");
    expect(html).toContain("Build your store");
    expect(html).toContain("/merchant/products");
    expect(html).toContain("/stores/artisan-store");
    expect(html).toContain("/merchant/inventory");
    expect(html).toContain("/merchant/orders");
    expect(html).toContain("© 2026 CAL CART SYSTEMS");
    expect(html).toContain("ALL SYSTEMS NOMINAL");
  });
});
