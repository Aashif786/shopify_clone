import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createNewElement,
  normalizePageElement,
  normalizeLandingPageConfig,
  createDefaultLandingPageConfig,
  type PageElement,
  type StorefrontLandingPageConfig,
} from "@calcart/stores/landing-page";
import { SectionWrapper } from "../apps/web/src/components/storefront/landing-page/section-wrapper";
import { ElementRenderer } from "../apps/web/src/components/storefront/landing-page/elements/element-renderer";
import { StorefrontLandingRenderer } from "../apps/web/src/components/storefront/landing-page/storefront-landing-renderer";

describe("Landing Page Normalization and Rendering Consistency", () => {
  describe("Element Configuration Normalization", () => {
    it("normalizes button element legacy properties to canonical schema", () => {
      const legacyButton: PageElement = {
        id: "btn-1",
        type: "button",
        content: {
          label: "Discover Collection",
          showArrow: false,
          link: "/collections/summer",
        },
      };

      const normalized = normalizePageElement(legacyButton);

      expect(normalized.content.text).toBe("Discover Collection");
      expect(normalized.content.label).toBe("Discover Collection");
      expect(normalized.content.icon).toBe("none");
      expect(normalized.content.showArrow).toBe(false);
    });

    it("normalizes button showArrow true to arrow icon", () => {
      const legacyButton: PageElement = {
        id: "btn-2",
        type: "button",
        content: {
          label: "Get Started",
          showArrow: true,
        },
      };

      const normalized = normalizePageElement(legacyButton);
      expect(normalized.content.text).toBe("Get Started");
      expect(normalized.content.icon).toBe("arrow");
    });

    it("normalizes image element legacy url and aspect ratio notation", () => {
      const legacyImage: PageElement = {
        id: "img-1",
        type: "image",
        content: {
          url: "https://example.com/photo.jpg",
          aspectRatio: "16:9",
          alt: "Featured Product",
        },
      };

      const normalized = normalizePageElement(legacyImage);

      expect(normalized.content.imageUrl).toBe("https://example.com/photo.jpg");
      expect(normalized.content.url).toBe("https://example.com/photo.jpg");
      expect(normalized.content.aspectRatio).toBe("16/9");
    });

    it("normalizes video element legacy url and aspect ratio", () => {
      const legacyVideo: PageElement = {
        id: "vid-1",
        type: "video",
        content: {
          url: "https://youtube.com/watch?v=123",
          aspectRatio: "16:9",
        },
      };

      const normalized = normalizePageElement(legacyVideo);

      expect(normalized.content.videoUrl).toBe("https://youtube.com/watch?v=123");
      expect(normalized.content.url).toBe("https://youtube.com/watch?v=123");
      expect(normalized.content.aspectRatio).toBe("16/9");
    });

    it("normalizes icon element legacy name and layout", () => {
      const legacyIcon: PageElement = {
        id: "ico-1",
        type: "icon",
        content: {
          name: "shield-check",
          layout: "stacked",
          title: "Guaranteed Quality",
        },
      };

      const normalized = normalizePageElement(legacyIcon);

      expect(normalized.content.icon).toBe("shield-check");
      expect(normalized.content.name).toBe("shield-check");
      expect(normalized.content.layout).toBe("vertical");
    });

    it("recursively normalizes nested container and columns children", () => {
      const container: PageElement = {
        id: "cont-1",
        type: "container",
        content: {},
        children: [
          {
            id: "btn-nested",
            type: "button",
            content: {
              label: "Click Here",
              showArrow: true,
            },
          },
          {
            id: "img-nested",
            type: "image",
            content: {
              url: "https://example.com/banner.jpg",
              aspectRatio: "16:9",
            },
          },
        ],
      };

      const normalized = normalizePageElement(container);

      expect(normalized.children).toHaveLength(2);
      expect(normalized.children?.[0].content.text).toBe("Click Here");
      expect(normalized.children?.[0].content.icon).toBe("arrow");
      expect(normalized.children?.[1].content.imageUrl).toBe("https://example.com/banner.jpg");
      expect(normalized.children?.[1].content.aspectRatio).toBe("16/9");
    });

    it("normalizes entire landing page config including all sections and element trees", () => {
      const rawConfig: StorefrontLandingPageConfig = {
        version: 1,
        theme: {
          presetId: "modern-minimalist",
          mode: "default",
          colors: {
            background: "#ffffff",
            surface: "#f9fafb",
            text: "#111827",
            primary: "#000000",
            border: "#e5e7eb",
          },
          typography: {
            headingFont: "sans",
            bodyFont: "sans",
            baseSize: "16px",
          },
          layout: {
            containerWidth: "1280px",
            sectionSpacing: "md",
            borderRadius: "0.75rem",
          },
          animations: {
            enabled: true,
            style: "subtle",
          },
        },
        sections: [
          {
            id: "sec-1",
            type: "custom_container",
            isVisible: true,
            layout: {
              layoutType: "single",
              columns: 1,
              verticalAlignment: "center",
              horizontalAlignment: "center",
              gap: "md",
            },
            elements: [
              {
                id: "btn-raw",
                type: "button",
                content: {
                  label: "Explore Now",
                  showArrow: false,
                },
              },
            ],
            config: {},
          },
        ],
      };

      const normalizedConfig = normalizeLandingPageConfig(rawConfig);
      const buttonEl = normalizedConfig.sections[0]?.elements?.[0];

      expect(buttonEl?.content.text).toBe("Explore Now");
      expect(buttonEl?.content.icon).toBe("none");
    });
  });

  describe("Factory Functions Output Canonical Schemas", () => {
    it("createNewElement outputs canonical keys for button, image, video, and icon", () => {
      const btn = createNewElement("button");
      expect(btn.content.text).toBe("Shop Now");
      expect(btn.content.label).toBe("Shop Now");
      expect(btn.content.icon).toBe("arrow");
      expect(btn.content.showArrow).toBe(true);

      const img = createNewElement("image");
      expect(img.content.imageUrl).toBeTruthy();
      expect(img.content.url).toBeTruthy();
      expect(img.content.aspectRatio).toBe("16/9");

      const vid = createNewElement("video");
      expect(vid.content.videoUrl).toBeTruthy();
      expect(vid.content.url).toBeTruthy();
      expect(vid.content.aspectRatio).toBe("16/9");

      const icon = createNewElement("icon");
      expect(icon.content.icon).toBe("sparkles");
      expect(icon.content.name).toBe("sparkles");
      expect(icon.content.layout).toBe("vertical");
    });
  });

  describe("Responsive Visibility and Section Wrapper Behavior", () => {
    it("applies responsive hiding classes correctly for mobile, tablet, and desktop", () => {
      const htmlMobileHidden = renderToStaticMarkup(
        <SectionWrapper
          section={{
            id: "test-1",
            type: "hero",
            isVisible: true,
            styles: { hideOnMobile: true },
            config: {},
          }}
          isPreview={false}
        >
          <div>Content</div>
        </SectionWrapper>,
      );
      expect(htmlMobileHidden).toContain("hidden sm:block");

      const htmlTabletHidden = renderToStaticMarkup(
        <SectionWrapper
          section={{
            id: "test-2",
            type: "hero",
            isVisible: true,
            styles: { hideOnTablet: true },
            config: {},
          }}
          isPreview={false}
        >
          <div>Content</div>
        </SectionWrapper>,
      );
      expect(htmlTabletHidden).toContain("sm:hidden lg:block");

      const htmlDesktopHidden = renderToStaticMarkup(
        <SectionWrapper
          section={{
            id: "test-3",
            type: "hero",
            isVisible: true,
            styles: { hideOnDesktop: true },
            config: {},
          }}
          isPreview={false}
        >
          <div>Content</div>
        </SectionWrapper>,
      );
      expect(htmlDesktopHidden).toContain("lg:hidden");
    });

    it("displays visibility badge and maintains rendering in editor preview mode", () => {
      const htmlPreview = renderToStaticMarkup(
        <SectionWrapper
          section={{
            id: "test-preview",
            type: "hero",
            isVisible: true,
            styles: { hideOnTablet: true },
            config: {},
          }}
          isPreview={true}
        >
          <div>Preview Content</div>
        </SectionWrapper>,
      );

      // In preview, content is still rendered
      expect(htmlPreview).toContain("Preview Content");
      // Badge indicates hidden on tablet
      expect(htmlPreview).toContain("Hidden on tablet");
    });
  });

  describe("ElementRenderer Rendering and Padding", () => {
    it("renders button element with normalized text and link", () => {
      const button: PageElement = {
        id: "btn-render",
        type: "button",
        isVisible: true,
        content: {
          label: "Purchase Now",
          link: "/products/aurora-tee",
          variant: "solid",
        },
      };

      const html = renderToStaticMarkup(
        <ElementRenderer element={button} storeSlug="aurora" />,
      );

      expect(html).toContain("Purchase Now");
      expect(html).toContain("/stores/aurora/products/aurora-tee");
    });

    it("renders image element with normalized imageUrl and ratio", () => {
      const image: PageElement = {
        id: "img-render",
        type: "image",
        isVisible: true,
        content: {
          url: "https://images.unsplash.com/sample.jpg",
          aspectRatio: "16/9",
          alt: "Sample Hero",
        },
      };

      const html = renderToStaticMarkup(
        <ElementRenderer element={image} storeSlug="aurora" />,
      );

      expect(html).toContain("https://images.unsplash.com/sample.jpg");
      expect(html).toContain("Sample Hero");
      expect(html).toContain("aspect-video");
    });

    it("renders container element with nested children recursively", () => {
      const container: PageElement = {
        id: "parent-container",
        type: "container",
        isVisible: true,
        content: {},
        children: [
          {
            id: "child-btn",
            type: "button",
            isVisible: true,
            content: {
              text: "Explore",
              link: "/products",
            },
          },
        ],
      };

      const html = renderToStaticMarkup(
        <ElementRenderer element={container} storeSlug="aurora" />,
      );

      expect(html).toContain("Explore");
      expect(html).toContain("/stores/aurora/products");
    });
  });

  describe("Global Background Positioning Preview vs Published", () => {
    it("renders global background with absolute in preview and fixed in published", () => {
      const config = createDefaultLandingPageConfig("Test Brand");
      config.theme.background = {
        type: "image",
        color: "#ffffff",
        imageUrl: "https://example.com/bg.jpg",
        opacity: 50,
        position: "center",
        size: "cover",
        repeat: "no-repeat",
        attachment: "scroll",
      };

      const htmlPreview = renderToStaticMarkup(
        <StorefrontLandingRenderer
          config={config}
          storeSlug="test-brand"
          storeName="Test Brand"
          isPreview={true}
        />,
      );

      expect(htmlPreview).toContain("absolute inset-0");

      const htmlPublished = renderToStaticMarkup(
        <StorefrontLandingRenderer
          config={config}
          storeSlug="test-brand"
          storeName="Test Brand"
          isPreview={false}
        />,
      );

      expect(htmlPublished).toContain("fixed inset-0");
    });
  });
});
