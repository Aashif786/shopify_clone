import React from "react";
import type { SectionType, LandingPageSection } from "@shopify-clone/stores/landing-page";
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
      columns: 3,
      viewAllLink: "/collections",
      items: [],
    },
  },
  promotional_banner: {
    type: "promotional_banner",
    title: "Promotional Banner",
    description: "High-visibility promo strip with coupon copy button and call-to-action.",
    icon: Tag,
    component: PromotionalBannerSection,
    defaultTitle: "Announcement Strip",
    defaultConfig: {
      bannerText: "Complimentary worldwide shipping on orders over $100",
      highlightCode: "FREESHIP",
      badgeText: "LIMITED TIME",
      link: "/products",
      style: "accent",
    },
  },
  editorial: {
    type: "editorial",
    title: "Editorial Story",
    description: "Balanced media and storytelling layout highlighting design philosophy.",
    icon: Compass,
    component: EditorialSection,
    defaultTitle: "Editorial Story",
    defaultConfig: {
      heading: "Crafted with Intention & Care",
      eyebrow: "Our Philosophy",
      description: "We partner with independent makers to craft objects that balance enduring utility with architectural simplicity.",
      secondaryText: "Every batch is produced in limited runs to minimize waste.",
      imagePosition: "right",
      ctaText: "Explore our story",
      ctaLink: "/about",
      imageUrl: "",
    },
  },
  asymmetric_showcase: {
    type: "asymmetric_showcase",
    title: "Split / Asymmetric Showcase",
    description: "Dynamic asymmetrical grid pairing a large spotlight banner with stacked feature cards.",
    icon: LayoutGrid,
    component: AsymmetricShowcaseSection,
    defaultTitle: "Curated Spotlights",
    defaultConfig: {
      heading: "Featured Spotlights",
      subtitle: "Handpicked pieces designed to make a statement",
      spotlightTitle: "The Signature Series",
      spotlightSubtitle: "Engineered with precision for a lasting silhouette.",
      spotlightBadge: "SPOTLIGHT",
      spotlightLink: "/products",
      spotlightImage: "",
      secondaryCards: [
        {
          title: "Seasonal Essentials",
          description: "Effortless versatility for daily rituals.",
          badge: "NEW ARRIVALS",
          link: "/products",
          image: "",
        },
        {
          title: "The Archival Release",
          description: "Limited re-release of our classic silhouette.",
          badge: "LIMITED",
          link: "/products",
          image: "",
        },
      ],
    },
  },
  brand_story: {
    type: "brand_story",
    title: "Brand Storytelling",
    description: "Elevated narrative layout with founder quotes and core pillars.",
    icon: Quote,
    component: BrandStorySection,
    defaultTitle: "Brand Story",
    defaultConfig: {
      quote: "We set out to create goods that outlast fast cycles and bring timeless intention back into everyday living.",
      quoteAuthor: "The Founding Team",
      quoteAuthorRole: "Design & Craft Directorate",
      storyParagraphs: [
        "Our journey began with a single question: Why should high-grade craft and sustainable integrity be mutually exclusive?",
        "Today, every collection is developed through close relationships with master artisans who share our commitment to clean materials.",
      ],
      pillars: [
        { title: "Pure Materials", desc: "Sustainably harvested fibers, non-toxic finishes." },
        { title: "Small Batches", desc: "Crafted in measured lots to preserve meticulous detail." },
        { title: "Enduring Form", desc: "Designed to age with grace and survive passing trends." },
      ],
    },
  },
  testimonials: {
    type: "testimonials",
    title: "Testimonials & Trust Indicators",
    description: "Trust badges, star ratings, and verified buyer reviews to build confidence.",
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
    config: def ? JSON.parse(JSON.stringify(def.defaultConfig)) : {},
  };
}
