import React from "react";
import type { SectionType, LandingPageSection } from "@calcart/stores/landing-page";
import type { StorefrontLandingSectionProps } from "./types";
import { HeroSection } from "./sections/hero-section";
import { FeaturedProductsSection } from "./sections/featured-products-section";
import { ProductCarouselSection } from "./sections/product-carousel-section";
import { CollectionShowcaseSection } from "./sections/collection-showcase-section";
import { PromotionalBannerSection } from "./sections/promotional-banner-section";
import { EditorialSection } from "./sections/editorial-section";
import { AsymmetricShowcaseSection } from "./sections/asymmetric-showcase-section";
import { BrandStorySection } from "./sections/brand-story-section";
import { TestimonialsSection } from "./sections/testimonials-section";
import { NewsletterSection } from "./sections/newsletter-section";
import { SpacerDividerSection } from "./sections/spacer-divider-section";
import { CustomContainerSection } from "./sections/custom-container-section";

import {
  Sparkles,
  ShoppingBag,
  SlidersHorizontal,
  Layers,
  Tag,
  Compass,
  LayoutGrid,
  Quote,
  Star,
  Mail,
  SeparatorHorizontal,
  Layout,
} from "lucide-react";

export interface SectionDefinition {
  type: SectionType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<StorefrontLandingSectionProps>;
  defaultTitle: string;
  defaultConfig: Record<string, unknown>;
}

export const SECTION_REGISTRY: Record<SectionType, SectionDefinition> = {
  custom_container: {
    type: "custom_container",
    title: "Blank Layout Container",
    description: "A flexible container where you can freely arrange any mix of content, commerce, and media elements.",
    icon: Layout,
    component: CustomContainerSection,
    defaultTitle: "Custom Container",
    defaultConfig: {},
  },
  hero: {
    type: "hero",
    title: "Hero Banner",
    description: "High-impact opening banner with headline, badges, and primary action buttons.",
    icon: Sparkles,
    component: HeroSection,
    defaultTitle: "Hero Banner",
    defaultConfig: {
      headline: "Made for the intentional living.",
      subheading: "Thoughtful pieces, beautiful details, and lasting craftsmanship.",
      eyebrow: "Seasonal Collection",
      ctaText: "Explore Shop",
      ctaLink: "/products",
      cta2Text: "Our Story",
      cta2Link: "/about",
      layout: "split",
      textAlignment: "left",
      backgroundStyle: "gradient",
      badge: "NEW DROP",
    },
  },
  featured_products: {
    type: "featured_products",
    title: "Featured Products Grid",
    description: "2, 3, or 4 column grid displaying curated products with live pricing and badges.",
    icon: ShoppingBag,
    component: FeaturedProductsSection,
    defaultTitle: "Featured Products Grid",
    defaultConfig: {
      heading: "Favourites, for good reason.",
      subtitle: "Explore our most sought-after pieces and latest releases.",
      columns: 4,
      limit: 8,
      viewAllLink: "/products",
    },
  },
  product_carousel: {
    type: "product_carousel",
    title: "Product Carousel",
    description: "Smooth horizontal snap-scroll gallery with responsive controls.",
    icon: SlidersHorizontal,
    component: ProductCarouselSection,
    defaultTitle: "Product Carousel",
    defaultConfig: {
      heading: "Trending Releases",
      subtitle: "Swipe through our newest curated selections",
      limit: 8,
      viewAllLink: "/products",
    },
  },
  collection_showcase: {
    type: "collection_showcase",
    title: "Collection Showcase",
    description: "Visual category blocks showcasing collections with product counts.",
    icon: Layers,
    component: CollectionShowcaseSection,
    defaultTitle: "Collection Showcase",
    defaultConfig: {
      heading: "Shop by Category",
      subtitle: "Browse through our thoughtfully structured collections",
    },
  },
  promotional_banner: {
    type: "promotional_banner",
    title: "Promotional Banner",
    description: "Urgency-focused promotional strip or callout with discount code and countdown.",
    icon: Tag,
    component: PromotionalBannerSection,
    defaultTitle: "Special Offer Banner",
    defaultConfig: {
      eyebrow: "Limited Time Only",
      headline: "Mid-Season Private Sale",
      description: "Use code CALCART20 at checkout for 20% off selected small-batch arrivals.",
      ctaText: "Shop the Sale",
      ctaLink: "/products",
      badge: "SAVE 20%",
      style: "accent",
    },
  },
  editorial: {
    type: "editorial",
    title: "Editorial Showcase",
    description: "Magazine-inspired visual story with large imagery, pull-quotes, and narrative copy.",
    icon: Compass,
    component: EditorialSection,
    defaultTitle: "Editorial Showcase",
    defaultConfig: {
      heading: "Crafted with Intention & Care",
      description: "We partner with local artisans and sustainable suppliers to ensure every material is responsibly harvested and constructed to endure daily life.",
      secondaryText: "From tactile textures to durable finishes, our collection is curated to bring balance and warmth into your rituals.",
      imagePosition: "right",
      imageAspectRatio: "portrait",
      ctaText: "Explore our story",
      ctaLink: "/about",
    },
  },
  asymmetric_showcase: {
    type: "asymmetric_showcase",
    title: "Asymmetric Editorial Grid",
    description: "Architectural bento-style layout with varied card heights, overlapping imagery, and staggered reveals.",
    icon: LayoutGrid,
    component: AsymmetricShowcaseSection,
    defaultTitle: "Curated Selections",
    defaultConfig: {
      heading: "Modern Perspectives",
      subtitle: "Artisanal silhouettes meets functional minimalism",
      badge: "CURATED",
    },
  },
  brand_story: {
    type: "brand_story",
    title: "Brand Story & Values",
    description: "Elevate your store mission with large typography, founding principles, and signature details.",
    icon: Quote,
    component: BrandStorySection,
    defaultTitle: "Our Mission",
    defaultConfig: {
      quote: "We believe commerce should feel honest, intentional, and deeply considered.",
      author: "The Founding Collective",
      heading: "Built for those who value longevity.",
      description: "Every item in our catalogue goes through a rigorous prototyping phase to ensure form follows function without sacrificing tactile beauty.",
    },
  },
  testimonials: {
    type: "testimonials",
    title: "Reviews & Social Proof",
    description: "Verified customer testimonials, ratings, and reassurance badges.",
    icon: Star,
    component: TestimonialsSection,
    defaultTitle: "Trust & Reviews",
    defaultConfig: {
      heading: "Why customers choose us",
      subtitle: "Uncompromising standards from studio to doorstep",
      badges: [
        { icon: "sparkles", title: "Considered Design", description: "Clean lines and timeless appeal." },
        { icon: "check", title: "Small-Batch Quality", description: "Produced in limited quantities." },
        { icon: "truck", title: "Delivered With Care", description: "Fast tracked shipping in eco-friendly packaging." },
        { icon: "shield", title: "Verified & Secure", description: "Encrypted checkout & order protection." },
      ],
      items: [
        {
          quote: "The quality of the material and stitching is extraordinary. It feels made to last decades.",
          author: "Elena Rostova",
          role: "Verified Collector",
          rating: 5,
        },
        {
          quote: "From checkout to doorstep, the whole experience was seamless and delightfully packaged.",
          author: "Marcus Chen",
          role: "Verified Buyer",
          rating: 5,
        },
      ],
    },
  },
  newsletter: {
    type: "newsletter",
    title: "Newsletter Subscription",
    description: "High-conversion email capture box with spam disclaimer and instant feedback.",
    icon: Mail,
    component: NewsletterSection,
    defaultTitle: "Newsletter Subscription",
    defaultConfig: {
      heading: "Stay in the loop",
      description: "Be the first to hear about small-batch drops, private sales, and seasonal lookbooks.",
      placeholder: "Enter your email address...",
      buttonText: "Subscribe",
      disclaimer: "No spam, unsubscribe anytime with one click.",
    },
  },
  spacer_divider: {
    type: "spacer_divider",
    title: "Spacer & Divider",
    description: "Configurable vertical breathing room and optional divider lines between sections.",
    icon: SeparatorHorizontal,
    component: SpacerDividerSection,
    defaultTitle: "Divider",
    defaultConfig: {
      height: "md",
      showLine: true,
      style: "solid",
    },
  },
};

export function createNewSection(type: SectionType): LandingPageSection {
  const def = SECTION_REGISTRY[type];
  return {
    id: `sec_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    title: def ? def.defaultTitle : type,
    isVisible: true,
    animation: { preset: "fade-up", intensity: "medium" },
    layout: {
      mode: "stack",
      containerWidth: "standard",
      gap: "md",
    },
    elements: [],
    config: def ? JSON.parse(JSON.stringify(def.defaultConfig)) : {},
  };
}
