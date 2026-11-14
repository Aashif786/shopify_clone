import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createNewElement,
  type LandingPageSection,
} from "@calcart/stores/landing-page";
import { ParagraphElement } from "../apps/web/src/components/storefront/landing-page/elements/paragraph-element";
import { HeadingElement } from "../apps/web/src/components/storefront/landing-page/elements/heading-element";
import { ButtonElement } from "../apps/web/src/components/storefront/landing-page/elements/button-element";
import { ElementRenderer } from "../apps/web/src/components/storefront/landing-page/elements/element-renderer";
import { SectionElementsLayout } from "../apps/web/src/components/storefront/landing-page/elements/section-elements-layout";

describe("Landing Page Studio - Paragraph Typography Alignment & Element Widths", () => {
  describe("Paragraph Element Typography Alignment and Max Width", () => {
    it("centers paragraph text and wrapper container without default 65ch clamping", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Centered paragraph content for testing" };
      element.style = { textAlign: "center" };

      const html = renderToStaticMarkup(<ParagraphElement element={element} />);

      expect(html).toContain("text-center");
      expect(html).toContain("mx-auto");
      // Should not contain a hardcoded 65ch max-width when user did not set one
      expect(html).not.toContain("max-width:65ch");
      expect(html).not.toContain("max-width: 65ch");
    });

    it("respects custom max-width when configured by user and centers container with mx-auto", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Constrained centered paragraph" };
      element.style = {
        textAlign: "center",
        maxWidth: "500px",
      };

      const html = renderToStaticMarkup(<ParagraphElement element={element} />);

      expect(html).toContain("text-center");
      expect(html).toContain("mx-auto");
      expect(html).toContain("500px");
    });

    it("aligns paragraph text and container to the right with ml-auto", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Right aligned paragraph" };
      element.style = {
        textAlign: "right",
        maxWidth: "400px",
      };

      const html = renderToStaticMarkup(<ParagraphElement element={element} />);

      expect(html).toContain("text-right");
      expect(html).toContain("ml-auto");
      expect(html).toContain("400px");
    });

    it("handles default left alignment cleanly", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Left aligned paragraph" };
      element.style = { textAlign: "left" };

      const html = renderToStaticMarkup(<ParagraphElement element={element} />);

      expect(html).toContain("text-left");
      expect(html).not.toContain("mx-auto");
      expect(html).not.toContain("ml-auto");
    });

    it("resolves and applies font family correctly", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Custom font paragraph" };
      element.style = { fontFamily: "inter" };

      const html = renderToStaticMarkup(<ParagraphElement element={element} />);

      expect(html).toContain("font-family:var(--font-ds-inter");
    });
  });

  describe("Heading Element Typography Alignment", () => {
    it("centers heading container with mx-auto when custom maxWidth is configured", () => {
      const element = createNewElement("heading");
      element.content = { text: "Centered Heading" };
      element.style = {
        textAlign: "center",
        maxWidth: "600px",
      };

      const html = renderToStaticMarkup(<HeadingElement element={element} />);

      expect(html).toContain("text-center");
      expect(html).toContain("mx-auto");
      expect(html).toContain("600px");
    });

    it("aligns heading container to the right with ml-auto when right aligned", () => {
      const element = createNewElement("heading");
      element.content = { text: "Right Heading" };
      element.style = {
        textAlign: "right",
        maxWidth: "450px",
      };

      const html = renderToStaticMarkup(<HeadingElement element={element} />);

      expect(html).toContain("text-right");
      expect(html).toContain("ml-auto");
      expect(html).toContain("450px");
    });
  });

  describe("ElementRenderer Sizing & Widths in Layout & Spacing", () => {
    it("applies 50% width classes for half width element", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Half width test" };
      element.style = { width: "half" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("md:w-1/2");
      expect(html).toContain("md:max-w-[50%]");
    });

    it("applies 33.333% width classes for third width element", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "One third width test" };
      element.style = { width: "third" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("md:w-1/3");
      expect(html).toContain("md:max-w-[33.333%]");
    });

    it("applies 66.666% width classes for two_thirds width element", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Two thirds width test" };
      element.style = { width: "two_thirds" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("md:w-2/3");
      expect(html).toContain("md:max-w-[66.666%]");
    });

    it("applies full width for full width element", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Full width test" };
      element.style = { width: "full" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("w-full");
      expect(html).not.toContain("md:w-1/2");
    });

    it("applies auto width for auto width element", () => {
      const element = createNewElement("paragraph");
      element.content = { text: "Auto width test" };
      element.style = { width: "auto" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("w-auto");
    });

    it("applies self-alignment classes accurately", () => {
      const elemCenter = createNewElement("paragraph");
      elemCenter.style = { width: "half", alignSelf: "center" };
      const htmlCenter = renderToStaticMarkup(
        <ElementRenderer element={elemCenter} storeSlug="test-store" />,
      );
      expect(htmlCenter).toContain("self-center mx-auto");

      const elemStart = createNewElement("paragraph");
      elemStart.style = { width: "half", alignSelf: "start" };
      const htmlStart = renderToStaticMarkup(
        <ElementRenderer element={elemStart} storeSlug="test-store" />,
      );
      expect(htmlStart).toContain("self-start mr-auto");

      const elemEnd = createNewElement("paragraph");
      elemEnd.style = { width: "half", alignSelf: "end" };
      const htmlEnd = renderToStaticMarkup(
        <ElementRenderer element={elemEnd} storeSlug="test-store" />,
      );
      expect(htmlEnd).toContain("self-end ml-auto");
    });

    it("automatically centers the element wrapper when textAlign is center and alignSelf is auto/unset", () => {
      const element = createNewElement("paragraph");
      element.style = { width: "half", textAlign: "center" };

      const html = renderToStaticMarkup(
        <ElementRenderer element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("md:w-1/2");
      expect(html).toContain("self-center mx-auto");
    });
  });

  describe("Button Element Fractional Width Handling", () => {
    it("stretches button container to full width of element wrapper when width is fractional", () => {
      const element = createNewElement("button");
      element.content = { text: "Action Button", link: "/test" };
      element.style = { width: "half", textAlign: "center" };

      const html = renderToStaticMarkup(
        <ButtonElement element={element} storeSlug="test-store" />,
      );

      expect(html).toContain("w-full");
      expect(html).toContain("justify-center");
    });
  });

  describe("Section Layout with Fractional Width Elements", () => {
    it("renders centered fractional elements with proper grid column start in 12-col grid", () => {
      const heroSection: LandingPageSection = {
        id: "hero-frac-test",
        type: "hero",
        layout: {
          mode: "auto",
          containerWidth: "standard",
          gap: "md",
        },
        elements: [
          {
            id: "p-centered",
            type: "paragraph",
            content: { text: "Centered half paragraph" },
            style: { width: "half", alignSelf: "center", textAlign: "center" },
            isVisible: true,
          },
        ],
      };

      const html = renderToStaticMarkup(
        <SectionElementsLayout section={heroSection} storeSlug="test-store" />,
      );

      expect(html).toContain("grid grid-cols-12");
      expect(html).toContain("col-span-12 md:col-span-6 md:col-start-4");
    });

    it("renders consecutive half elements side by side in 12-col grid", () => {
      const heroSection: LandingPageSection = {
        id: "hero-side-by-side",
        type: "hero",
        layout: {
          mode: "auto",
          containerWidth: "standard",
          gap: "md",
        },
        elements: [
          {
            id: "btn-1",
            type: "button",
            content: { text: "Button 1" },
            style: { width: "half" },
            isVisible: true,
          },
          {
            id: "btn-2",
            type: "button",
            content: { text: "Button 2" },
            style: { width: "half" },
            isVisible: true,
          },
        ],
      };

      const html = renderToStaticMarkup(
        <SectionElementsLayout section={heroSection} storeSlug="test-store" />,
      );

      expect(html).toContain("grid grid-cols-12");
      expect(html).toContain("col-span-12 md:col-span-6");
    });
  });
});
