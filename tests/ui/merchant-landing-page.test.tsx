import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COLOR_PRESETS,
  createDefaultLandingPageConfig,
  type ColorPresetId,
  type StorefrontLandingPageConfig,
} from "@calcart/stores/landing-page";
import { StorefrontLandingRenderer } from "../../apps/web/src/components/storefront/landing-page/storefront-landing-renderer";
import { SECTION_REGISTRY, createNewSection } from "../../apps/web/src/components/storefront/landing-page/registry";

describe("Storefront Landing Page Dynamic System", () => {
  it("provides 5 distinct curated color presets with full token sets", () => {
    const presetIds: ColorPresetId[] = [
      "modern-minimalist",
      "bold-vibrant",
      "editorial-luxury",
      "high-tech",
      "monochromatic",
    ];

    expect(Object.keys(COLOR_PRESETS)).toHaveLength(5);

    for (const id of presetIds) {
      const preset = COLOR_PRESETS[id];
      expect(preset).toBeDefined();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.colors.background).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.colors.surface).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.colors.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.colors.border).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("creates a well-structured default landing page configuration for new stores", () => {
    const config = createDefaultLandingPageConfig("Aurora Goods");
    expect(config.version).toBe(1);
    expect(config.theme.presetId).toBe("modern-minimalist");
    expect(config.theme.animations.enabled).toBe(true);
    expect(config.sections.length).toBeGreaterThanOrEqual(5);

    // Verify presence of hero, trust indicators, featured products, announcement, editorial, and newsletter
    const types = config.sections.map((s) => s.type);
    expect(types).toContain("hero");
    expect(types).toContain("testimonials");
    expect(types).toContain("featured_products");
    expect(types).toContain("promotional_banner");
    expect(types).toContain("editorial");
    expect(types).toContain("newsletter");

    // Verify hero contains store name
    const hero = config.sections.find((s) => s.type === "hero");
    expect(hero).toBeDefined();
    expect((hero?.config as Record<string, unknown>)?.headline).toContain("Aurora Goods");
  });

  it("supports all 11 section types in the component registry", () => {
    const registeredTypes = Object.keys(SECTION_REGISTRY);
    expect(registeredTypes).toContain("hero");
    expect(registeredTypes).toContain("featured_products");
    expect(registeredTypes).toContain("product_carousel");
    expect(registeredTypes).toContain("collection_showcase");
    expect(registeredTypes).toContain("promotional_banner");
    expect(registeredTypes).toContain("editorial");
    expect(registeredTypes).toContain("asymmetric_showcase");
    expect(registeredTypes).toContain("brand_story");
    expect(registeredTypes).toContain("testimonials");
    expect(registeredTypes).toContain("newsletter");
    expect(registeredTypes).toContain("spacer_divider");
    expect(registeredTypes).toHaveLength(11);

    for (const [type, def] of Object.entries(SECTION_REGISTRY)) {
      expect(def.type).toBe(type);
      expect(def.title).toBeTruthy();
      expect(def.icon).toBeDefined();
      expect(def.component).toBeDefined();
      expect(def.defaultConfig).toBeDefined();
    }
  });

  it("createNewSection creates distinct valid section instances with default configurations", () => {
    const carouselSec = createNewSection("product_carousel");
    expect(carouselSec.id).toMatch(/^sec_product_carousel_/);
    expect(carouselSec.type).toBe("product_carousel");
    expect(carouselSec.isVisible).toBe(true);
    expect((carouselSec.config as Record<string, unknown>).heading).toBe("Trending Releases");

    const spacerSec = createNewSection("spacer_divider");
    expect(spacerSec.id).toMatch(/^sec_spacer_divider_/);
    expect(spacerSec.type).toBe("spacer_divider");
    expect((spacerSec.config as Record<string, unknown>).height).toBe("md");
  });

  it("renders StorefrontLandingRenderer with CSS custom properties and section HTML", () => {
    const config: StorefrontLandingPageConfig = {
      version: 1,
      theme: {
        presetId: "bold-vibrant",
        colors: COLOR_PRESETS["bold-vibrant"].colors,
        typography: {
          headingFont: "serif",
          bodyFont: "sans",
          scale: "lg",
        },
        animations: {
          enabled: true,
          intensity: "medium",
        },
      },
      sections: [
        {
          id: "sec_hero_1",
          type: "hero",
          title: "Main Hero",
          isVisible: true,
          config: {
            headline: "Bold Future Apparel",
            subheading: "High performance materials designed for modern movement.",
            ctaText: "Shop Drop",
            ctaLink: "/products",
            badge: "NEW CAPSULE",
          },
        },
        {
          id: "sec_promo_1",
          type: "promotional_banner",
          title: "Promo Banner",
          isVisible: true,
          config: {
            bannerText: "Take 25% off all outerwear",
            highlightCode: "FALL25",
            badgeText: "SPECIAL",
            link: "/products",
          },
        },
        {
          id: "sec_hidden_1",
          type: "newsletter",
          title: "Hidden Newsletter",
          isVisible: false,
          config: {},
        },
      ],
    };

    const html = renderToStaticMarkup(
      <StorefrontLandingRenderer
        config={config}
        storeSlug="bold-store"
        storeName="Bold Apparel"
        products={[]}
        isPreview={false}
      />,
    );

    // Root theme variables
    expect(html).toContain("--landing-bg:#0c0d14");
    expect(html).toContain("--landing-primary:#ff3366");
    expect(html).toContain("font-serif");

    // Visible sections
    expect(html).toContain("Bold Future Apparel");
    expect(html).toContain("NEW CAPSULE");
    expect(html).toContain("FALL25");
    expect(html).toContain("Take 25% off all outerwear");

    // Hidden section must not render in public view
    expect(html).not.toContain("Hidden Newsletter");
  });

  it("renders hidden sections in isPreview mode with indicator badge", () => {
    const config: StorefrontLandingPageConfig = {
      version: 1,
      theme: {
        presetId: "monochromatic",
        colors: COLOR_PRESETS["monochromatic"].colors,
        typography: { headingFont: "sans", bodyFont: "sans", scale: "md" },
        animations: { enabled: false, intensity: "subtle" },
      },
      sections: [
        {
          id: "sec_hidden_2",
          type: "newsletter",
          title: "Coming Soon Signup",
          isVisible: false,
          config: {
            heading: "Join our secret club",
          },
        },
      ],
    };

    const previewHtml = renderToStaticMarkup(
      <StorefrontLandingRenderer
        config={config}
        storeSlug="mono-store"
        isPreview={true}
        selectedSectionId="sec_hidden_2"
      />,
    );

    // Should render hidden section with preview badge
    expect(previewHtml).toContain("Coming Soon Signup");
    expect(previewHtml).toContain("Hidden");
    expect(previewHtml).toContain("(Editing)");
  });

  it("correctly handles section reordering, duplication, and deletion state transformations", () => {
    const initialConfig = createDefaultLandingPageConfig("Test Store");
    const count = initialConfig.sections.length;

    // Move first down
    const movedSections = [...initialConfig.sections];
    const s0 = movedSections[0];
    const s1 = movedSections[1];
    movedSections[0] = s1;
    movedSections[1] = s0;
    expect(movedSections[0].id).toBe(s1.id);
    expect(movedSections[1].id).toBe(s0.id);

    // Duplicate
    const clone = {
      ...JSON.parse(JSON.stringify(s0)),
      id: "sec_clone_123",
      title: `${s0.title} (Copy)`,
    };
    movedSections.splice(2, 0, clone);
    expect(movedSections.length).toBe(count + 1);
    expect(movedSections[2].id).toBe("sec_clone_123");

    // Delete
    const filtered = movedSections.filter((s) => s.id !== "sec_clone_123");
    expect(filtered.length).toBe(count);
    expect(filtered.find((s) => s.id === "sec_clone_123")).toBeUndefined();
  });

  it("renders full-viewport global background and section-level background customizations", () => {
    const config: StorefrontLandingPageConfig = {
      version: 1,
      theme: {
        presetId: "modern-minimalist",
        colors: COLOR_PRESETS["modern-minimalist"].colors,
        typography: {
          headingFont: "display",
          bodyFont: "sans",
          scale: "md",
          headingWeight: "bold",
          headingColor: "#ffffff",
        },
        animations: { enabled: true, intensity: "medium" },
        background: {
          type: "image",
          imageUrl: "https://example.com/global-bg.jpg",
          opacity: 80,
          size: "cover",
          position: "center",
          overlayColor: "#000000",
          overlayOpacity: 50,
        },
        buttons: {
          shape: "pill",
          variant: "solid",
          hoverEffect: "lift",
        },
      },
      sections: [
        {
          id: "sec_hero_custom",
          type: "hero",
          title: "Custom Styled Hero",
          isVisible: true,
          styles: {
            paddingTop: "xl",
            paddingBottom: "lg",
            borderRadius: "2xl",
            boxShadow: "lg",
            background: {
              type: "image",
              imageUrl: "https://example.com/section-hero.jpg",
              opacity: 90,
              size: "cover",
              position: "top",
              overlayColor: "#111827",
              overlayOpacity: 60,
            },
          },
          config: {
            headline: "Engineered for Excellence",
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <StorefrontLandingRenderer
        config={config}
        storeSlug="custom-store"
        products={[]}
        isPreview={false}
      />,
    );

    // Global background assertions
    expect(html).toContain("url(https://example.com/global-bg.jpg)");
    expect(html).toContain("background-position:center");
    expect(html).toContain("opacity:0.8");
    expect(html).toContain("background-color:#000000");

    // Section-level background & styling assertions
    expect(html).toContain("url(https://example.com/section-hero.jpg)");
    expect(html).toContain("background-position:top");
    expect(html).toContain("opacity:0.9");
    expect(html).toContain("pt-16 sm:pt-28"); // paddingTop: xl
    expect(html).toContain("pb-12 sm:pb-20"); // paddingBottom: lg
    expect(html).toContain("rounded-2xl");
    expect(html).toContain("shadow-lg");

    // Button token variable
    expect(html).toContain("--landing-btn-radius:9999px");
  });

  it("renders dynamic customizable carousel with slides, aspect ratios, and navigation", () => {
    const config: StorefrontLandingPageConfig = {
      version: 1,
      theme: {
        presetId: "modern-minimalist",
        colors: COLOR_PRESETS["modern-minimalist"].colors,
        typography: { headingFont: "display", bodyFont: "sans", scale: "md" },
        animations: { enabled: true, intensity: "medium" },
      },
      sections: [
        {
          id: "sec_carousel_1",
          type: "product_carousel",
          title: "Dynamic Carousel",
          isVisible: true,
          config: {
            heading: "Curated Showcase",
            subtitle: "Handpicked highlights for the season",
            sourceType: "custom_slides",
            layout: "cards",
            aspectRatio: "16:9",
            cardSpacing: "spacious",
            showArrows: true,
            showPagination: true,
            slides: [
              {
                id: "slide_a",
                type: "custom_image",
                title: "Autumn Capsule",
                subtitle: "Heavyweight wool and recycled nylon.",
                badge: "NEW DROP",
                imageUrl: "https://example.com/slide-a.jpg",
                ctaText: "Explore capsule",
                ctaLink: "/products",
              },
              {
                id: "slide_b",
                type: "custom_image",
                title: "Monochrome Study",
                subtitle: "Minimal silhouette engineered for daily rotation.",
                badge: "ESSENTIAL",
                imageUrl: "https://example.com/slide-b.jpg",
                ctaText: "Shop monochrome",
                ctaLink: "/products",
              },
            ],
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <StorefrontLandingRenderer
        config={config}
        storeSlug="carousel-store"
        products={[]}
        isPreview={false}
      />,
    );

    // Section header
    expect(html).toContain("Curated Showcase");
    expect(html).toContain("Handpicked highlights for the season");

    // Dynamic slides content
    expect(html).toContain("Autumn Capsule");
    expect(html).toContain("Heavyweight wool and recycled nylon.");
    expect(html).toContain("NEW DROP");
    expect(html).toContain("Explore capsule");
    expect(html).toContain("url(https://example.com/slide-a.jpg)");

    expect(html).toContain("Monochrome Study");
    expect(html).toContain("ESSENTIAL");
    expect(html).toContain("Shop monochrome");
    expect(html).toContain("url(https://example.com/slide-b.jpg)");

    // Aspect ratio and layout
    expect(html).toContain("aspect-video");
    expect(html).toContain("gap-8 sm:gap-10"); // spacious
  });

  it("renders hero showcase cinematic carousel mode with pagination dots", () => {
    const config: StorefrontLandingPageConfig = {
      version: 1,
      theme: {
        presetId: "editorial-luxury",
        colors: COLOR_PRESETS["editorial-luxury"].colors,
        typography: { headingFont: "serif", bodyFont: "sans", scale: "lg" },
        animations: { enabled: true, intensity: "medium" },
      },
      sections: [
        {
          id: "sec_hero_carousel",
          type: "product_carousel",
          title: "Cinematic Stage",
          isVisible: true,
          config: {
            heading: "Signature Collection",
            layout: "hero_showcase",
            aspectRatio: "21:9",
            showArrows: true,
            showPagination: true,
            slides: [
              {
                id: "slide_cinematic_1",
                type: "custom_image",
                title: "Grand Editorial Showcase",
                subtitle: "Cinematic visual design crafted for maximum impact.",
                badge: "EXCLUSIVE",
                imageUrl: "https://example.com/cinematic-1.jpg",
                ctaText: "Shop the show",
                ctaLink: "/products",
              },
            ],
          },
        },
      ],
    };

    const html = renderToStaticMarkup(
      <StorefrontLandingRenderer
        config={config}
        storeSlug="luxury-store"
        products={[]}
        isPreview={false}
      />,
    );

    expect(html).toContain("Grand Editorial Showcase");
    expect(html).toContain("Cinematic visual design crafted for maximum impact.");
    expect(html).toContain("EXCLUSIVE");
    expect(html).toContain("Shop the show");
    expect(html).toContain("aspect-[21/9]");
    expect(html).toContain("storefront-carousel-hero");
  });
});
