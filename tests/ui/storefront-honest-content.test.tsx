import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";
import { PromotionalBannerSection } from "@/components/storefront/landing-page/sections/promotional-banner-section";
import { TestimonialsSection } from "@/components/storefront/landing-page/sections/testimonials-section";
import { BrandStorySection } from "@/components/storefront/landing-page/sections/brand-story-section";
import { resolveStoreDiscount, clearStoreDiscounts } from "@/lib/storefront-discount-helpers";

function section(type: string, config: Record<string, unknown> = {}) {
  return { id: `${type}-1`, type, isVisible: true, config } as never;
}

describe("Storefront never fabricates content", () => {
  it("shows no announcement or invented promo when the merchant sets none", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storeName="Alpine" storeSlug="alpine">
        <div>Page</div>
      </StorefrontShell>,
    );
    expect(html).not.toContain("storefront-announcement");
    expect(html).not.toContain("WELCOME20");
    expect(html).not.toContain("over $75");
  });

  it("footer carries no unverifiable guarantees", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storeName="Alpine" storeSlug="alpine">
        <div>Page</div>
      </StorefrontShell>,
    );
    for (const claim of ["Verified Merchant", "Fast Dispatch", "30-day", "256-bit"]) {
      expect(html).not.toContain(claim);
    }
    expect(html).toContain("Razorpay");
  });

  it("renders the shell announcement only when provided", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell storeName="Alpine" storeSlug="alpine" announcement="Spring sale">
        <div>Page</div>
      </StorefrontShell>,
    );
    expect(html).toContain("Spring sale");
  });

  it("promotional banner renders nothing without merchant text", () => {
    const html = renderToStaticMarkup(
      <PromotionalBannerSection section={section("promotional_banner")} storeSlug="alpine" />,
    );
    expect(html).toBe("");
  });

  it("testimonials render nothing without merchant badges or reviews", () => {
    const html = renderToStaticMarkup(
      <TestimonialsSection section={section("testimonials")} storeSlug="alpine" />,
    );
    expect(html).toBe("");
    expect(html).not.toContain("Verified Buyer");
  });

  it("brand story renders nothing without merchant copy, and shows merchant copy when present", () => {
    expect(
      renderToStaticMarkup(<BrandStorySection section={section("brand_story")} storeSlug="alpine" storeName="Alpine" />),
    ).toBe("");
    const html = renderToStaticMarkup(
      <BrandStorySection
        section={section("brand_story", { storyText: "We make boots." })}
        storeSlug="alpine"
        storeName="Alpine"
      />,
    );
    expect(html).toContain("We make boots.");
    expect(html).not.toContain("Founding Team");
  });
});

describe("Built-in demo discount fixtures are test-only", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearStoreDiscounts();
  });

  it("resolves demo fixtures under NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const found = await resolveStoreDiscount({} as never, "00000000-0000-0000-0000-000000000001", "WELCOME20");
    expect(found?.code).toBe("WELCOME20");
  });

  it("returns null for demo codes in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const code of ["WELCOME20", "WELCOME10", "SAVE20"]) {
      expect(await resolveStoreDiscount({} as never, "00000000-0000-0000-0000-000000000001", code)).toBeNull();
    }
  });
});

describe("Storefront provider continuity", () => {
  it("pages do not mount their own cart/wishlist providers (the shared layout owns them)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(process.cwd(), "apps/web/app/stores/[storeSlug]");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx$/.test(name) && /<(CartProvider|WishlistProvider)[\s>]/.test(readFileSync(full, "utf8"))) {
          offenders.push(full);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
