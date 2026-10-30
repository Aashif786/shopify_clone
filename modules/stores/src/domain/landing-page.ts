export type SectionType =
  | "hero"
  | "featured_products"
  | "product_carousel"
  | "collection_showcase"
  | "promotional_banner"
  | "editorial"
  | "asymmetric_showcase"
  | "brand_story"
  | "testimonials"
  | "newsletter"
  | "spacer_divider"
  | "custom_container";

export type ColorPresetId =
  | "modern-minimalist"
  | "bold-vibrant"
  | "editorial-luxury"
  | "high-tech"
  | "monochromatic";

export interface ColorTokens {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  primary: string;
  secondary: string;
  border: string;
  buttonText: string;
}

export interface BackgroundConfig {
  type: "color" | "image" | "gradient";
  color?: string;
  gradient?: string;
  imageUrl?: string;
  opacity?: number; // 0 to 100
  size?: "cover" | "contain" | "auto";
  position?: "center" | "top" | "bottom" | "left" | "right";
  repeat?: "no-repeat" | "repeat";
  overlayColor?: string;
  overlayOpacity?: number; // 0 to 100
  blur?: number; // 0 to 20 px
}

export interface TypographyTokens {
  headingFont: "sans" | "display" | "serif" | "mono";
  bodyFont: "sans" | "mono";
  scale: "sm" | "md" | "lg";
  headingWeight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
  bodyWeight?: "normal" | "medium";
  headingColor?: string;
  bodyColor?: string;
}

export interface ButtonTokens {
  shape?: "pill" | "rounded" | "sharp";
  variant?: "solid" | "outline" | "soft";
  hoverEffect?: "lift" | "glow" | "scale" | "none";
}

export interface AnimationTokens {
  enabled: boolean;
  intensity: "subtle" | "medium" | "expressive";
}

export interface LandingPageTheme {
  presetId: ColorPresetId;
  colors: ColorTokens;
  typography: TypographyTokens;
  animations: AnimationTokens;
  background?: BackgroundConfig;
  buttons?: ButtonTokens;
}

export interface SectionAnimationConfig {
  preset: "none" | "fade-up" | "fade-in" | "stagger" | "scale-in" | "slide";
  intensity?: "subtle" | "medium" | "expressive";
}

export interface SectionStyleConfig {
  background?: BackgroundConfig;
  paddingTop?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  paddingBottom?: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  alignment?: "left" | "center" | "right";
  borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  boxShadow?: "none" | "sm" | "md" | "lg" | "xl" | "glow";
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

export interface CarouselSlide {
  id: string;
  type?: "product" | "custom_image";
  productId?: string;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  ctaText?: string;
  ctaLink?: string;
  alt?: string;
}

// ==========================================
// UNIVERSAL ELEMENT SYSTEM
// ==========================================

export type ElementType =
  // Content Elements
  | "heading"
  | "paragraph"
  | "button"
  | "image"
  | "video"
  | "badge"
  | "divider"
  | "spacer"
  | "icon"
  // Commerce Elements
  | "product_card"
  | "product_grid"
  | "product_collection"
  | "featured_product"
  | "product_carousel"
  | "collection_banner"
  | "category_links"
  // Layout Elements
  | "container"
  | "columns"
  | "grid"
  | "stack";

export type ElementCategory = "content" | "commerce" | "layout" | "media";

export interface ResponsiveVisibilityConfig {
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  hideOnDesktop?: boolean;
}

export interface ElementStyleConfig {
  // Typography
  fontSize?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
  fontWeight?: "normal" | "medium" | "semibold" | "bold" | "extrabold";
  fontFamily?: "sans" | "serif" | "mono" | "display";
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  lineHeight?: "tight" | "normal" | "relaxed" | "loose";
  letterSpacing?: "tighter" | "tight" | "normal" | "wide" | "wider";
  maxWidth?: string; // e.g. "45ch", "600px", "100%"

  // Sizing & Spacing
  width?: "auto" | "full" | "half" | "third" | "two_thirds" | "custom";
  customWidth?: string;
  marginTop?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  marginBottom?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  paddingTop?: "none" | "xs" | "sm" | "md" | "lg";
  paddingBottom?: "none" | "xs" | "sm" | "md" | "lg";

  // Appearance
  backgroundColor?: string;
  borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  borderWidth?: "none" | "thin" | "medium";
  borderColor?: string;
  boxShadow?: "none" | "sm" | "md" | "lg" | "glow";
  opacity?: number; // 0 to 100

  // Flex/Grid Placement
  columnSpan?: number; // 1 to 12
  alignSelf?: "auto" | "start" | "center" | "end";
}

export interface ElementAnimationConfig {
  preset: "none" | "fade-up" | "fade-in" | "scale-in" | "slide" | "slide-left" | "slide-right";
  delay?: number; // seconds
  duration?: number;
}

export interface PageElement<TContent = Record<string, unknown>> {
  id: string;
  type: ElementType;
  label?: string;
  isVisible: boolean;
  content: TContent;
  style?: ElementStyleConfig;
  responsive?: ResponsiveVisibilityConfig;
  animation?: ElementAnimationConfig;
  children?: PageElement[];
}

export interface SectionLayoutConfig {
  mode: "stack" | "row" | "columns-2" | "columns-3" | "grid";
  containerWidth?: "standard" | "narrow" | "wide" | "fullwidth";
  horizontalAlignment?: "left" | "center" | "right" | "space-between";
  verticalAlignment?: "top" | "center" | "bottom" | "stretch";
  gap?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  stackOnMobile?: boolean;
  columnsRatio?: "50_50" | "60_40" | "40_60" | "70_30" | "30_70" | "33_33_33";
  gridColumns?: number; // 1, 2, 3, 4
}

export interface LandingPageSection<TConfig = Record<string, unknown>> {
  id: string;
  type: SectionType;
  title: string;
  isVisible: boolean;
  animation?: SectionAnimationConfig;
  styles?: SectionStyleConfig;
  layout?: SectionLayoutConfig;
  elements?: PageElement[];
  config: TConfig;
}

export interface StorefrontLandingPageConfig {
  version: number;
  theme: LandingPageTheme;
  sections: LandingPageSection[];
}

export interface StorefrontLandingPageRecord {
  id: string;
  storeId: string;
  draftConfig: StorefrontLandingPageConfig;
  publishedConfig: StorefrontLandingPageConfig | null;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorefrontLandingPageDTO {
  id: string;
  storeId: string;
  draftConfig: StorefrontLandingPageConfig;
  publishedConfig: StorefrontLandingPageConfig | null;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const COLOR_PRESETS: Record<ColorPresetId, { name: string; description: string; colors: ColorTokens }> = {
  "modern-minimalist": {
    name: "Modern Minimalist",
    description: "Restrained neutrals, generous whitespace, clean typography",
    colors: {
      background: "#0d0e12",
      surface: "#16181f",
      text: "#f3f4f6",
      mutedText: "#9ca3af",
      primary: "#fafafa",
      secondary: "#3b82f6",
      border: "#27272a",
      buttonText: "#09090b",
    },
  },
  "bold-vibrant": {
    name: "Bold & Vibrant",
    description: "Vivid accents, high contrast, energetic highlights",
    colors: {
      background: "#0c0d14",
      surface: "#141724",
      text: "#f8fafc",
      mutedText: "#94a3b8",
      primary: "#ff3366",
      secondary: "#6366f1",
      border: "#282e4a",
      buttonText: "#ffffff",
    },
  },
  "editorial-luxury": {
    name: "Editorial Luxury",
    description: "Warm sophisticated neutrals, champagne gold accents, serif elegance",
    colors: {
      background: "#0f0e0c",
      surface: "#1a1815",
      text: "#f5f3ee",
      mutedText: "#a8a29e",
      primary: "#d4af37",
      secondary: "#b45309",
      border: "#292524",
      buttonText: "#0c0a09",
    },
  },
  "high-tech": {
    name: "High-Tech Premium",
    description: "Deep space navy, luminous cyber cyan, crisp technical borders",
    colors: {
      background: "#090d16",
      surface: "#0f1626",
      text: "#f1f5f9",
      mutedText: "#64748b",
      primary: "#00f0ff",
      secondary: "#3b82f6",
      border: "#1e293b",
      buttonText: "#090d16",
    },
  },
  monochromatic: {
    name: "Contemporary Monochromatic",
    description: "Balanced single-hue tonal palette, high clarity, architectural feel",
    colors: {
      background: "#121212",
      surface: "#1c1c1c",
      text: "#eeeeee",
      mutedText: "#888888",
      primary: "#ffffff",
      secondary: "#666666",
      border: "#2e2e2e",
      buttonText: "#121212",
    },
  },
};

// ==========================================
// ELEMENT FACTORY & HELPERS
// ==========================================

export function createNewElement(type: ElementType): PageElement {
  const id = `el_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  switch (type) {
    case "heading":
      return {
        id,
        type: "heading",
        label: "Heading",
        isVisible: true,
        content: {
          text: "Headline That Captivates",
          level: "h2",
        },
        style: {
          fontSize: "3xl",
          fontWeight: "bold",
          textAlign: "left",
        },
      };

    case "paragraph":
      return {
        id,
        type: "paragraph",
        label: "Paragraph",
        isVisible: true,
        content: {
          text: "Thoughtfully crafted details and sustainable materials create enduring pieces designed for modern life.",
        },
        style: {
          fontSize: "base",
          fontWeight: "normal",
          textAlign: "left",
          lineHeight: "relaxed",
          maxWidth: "60ch",
        },
      };

    case "button":
      return {
        id,
        type: "button",
        label: "Call to Action",
        isVisible: true,
        content: {
          label: "Shop Now",
          link: "/products",
          showArrow: true,
        },
        style: {
          width: "auto",
        },
      };

    case "image":
      return {
        id,
        type: "image",
        label: "Image",
        isVisible: true,
        content: {
          url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
          alt: "Curated display",
          aspectRatio: "16:9",
          fit: "cover",
        },
        style: {
          borderRadius: "xl",
        },
      };

    case "video":
      return {
        id,
        type: "video",
        label: "Video",
        isVisible: true,
        content: {
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          aspectRatio: "16:9",
          autoplay: false,
          controls: true,
        },
        style: {
          borderRadius: "xl",
        },
      };

    case "badge":
      return {
        id,
        type: "badge",
        label: "Badge",
        isVisible: true,
        content: {
          text: "NEW SEASONAL ESSENTIALS",
          icon: "sparkles",
          variant: "accent",
        },
        style: {
          fontSize: "xs",
          fontWeight: "bold",
        },
      };

    case "divider":
      return {
        id,
        type: "divider",
        label: "Divider",
        isVisible: true,
        content: {
          style: "solid",
          thickness: "thin",
        },
        style: {
          marginTop: "md",
          marginBottom: "md",
        },
      };

    case "spacer":
      return {
        id,
        type: "spacer",
        label: "Spacer",
        isVisible: true,
        content: {
          height: "md",
        },
      };

    case "icon":
      return {
        id,
        type: "icon",
        label: "Icon Feature",
        isVisible: true,
        content: {
          name: "sparkles",
          title: "Considered Quality",
          description: "Engineered with architectural precision.",
          layout: "stacked",
        },
      };

    case "product_card":
      return {
        id,
        type: "product_card",
        label: "Featured Product Card",
        isVisible: true,
        content: {
          showPrice: true,
          showBadge: true,
          showAddToCart: true,
          aspectRatio: "4:3",
        },
      };

    case "product_grid":
      return {
        id,
        type: "product_grid",
        label: "Product Grid",
        isVisible: true,
        content: {
          columns: 4,
          limit: 8,
          showPrice: true,
          showBadge: true,
          viewAllLink: "/products",
        },
      };

    case "product_carousel":
      return {
        id,
        type: "product_carousel",
        label: "Product Carousel",
        isVisible: true,
        content: {
          heading: "Trending Selections",
          limit: 8,
          layout: "standard",
          aspectRatio: "16:9",
          autoplay: false,
          showArrows: true,
          showPagination: true,
        },
      };

    case "product_collection":
      return {
        id,
        type: "product_collection",
        label: "Collection Showcase",
        isVisible: true,
        content: {
          columns: 3,
          showCount: true,
        },
      };

    case "featured_product":
      return {
        id,
        type: "featured_product",
        label: "Spotlight Product",
        isVisible: true,
        content: {
          layout: "split",
          showDescription: true,
          showPrice: true,
          showAddToCart: true,
        },
      };

    case "collection_banner":
      return {
        id,
        type: "collection_banner",
        label: "Collection Banner",
        isVisible: true,
        content: {
          title: "Seasonal Archival Collection",
          subtitle: "Explore small batch limited pieces",
          ctaText: "Shop Collection",
          ctaLink: "/collections",
          imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
        },
        style: {
          borderRadius: "2xl",
        },
      };

    case "category_links":
      return {
        id,
        type: "category_links",
        label: "Category Quick Links",
        isVisible: true,
        content: {
          links: [
            { label: "All Items", href: "/products" },
            { label: "New Arrivals", href: "/products?sort=new" },
            { label: "Accessories", href: "/collections/accessories" },
            { label: "Apparel", href: "/collections/apparel" },
          ],
        },
      };

    case "container":
      return {
        id,
        type: "container",
        label: "Container",
        isVisible: true,
        content: {},
        style: {
          paddingTop: "md",
          paddingBottom: "md",
          borderRadius: "xl",
        },
        children: [],
      };

    case "columns":
      return {
        id,
        type: "columns",
        label: "Columns (2 Columns)",
        isVisible: true,
        content: {
          ratio: "50_50",
          stackOnMobile: true,
        },
        children: [],
      };

    case "grid":
      return {
        id,
        type: "grid",
        label: "Grid Layout",
        isVisible: true,
        content: {
          columns: 3,
          gap: "md",
        },
        children: [],
      };

    case "stack":
      return {
        id,
        type: "stack",
        label: "Stack Layout",
        isVisible: true,
        content: {
          direction: "vertical",
          gap: "md",
        },
        children: [],
      };

    default:
      return {
        id,
        type: "paragraph",
        label: "Text",
        isVisible: true,
        content: { text: "Element content" },
      };
  }
}

/**
 * Converts a classic section's config into a set of flexible elements
 * Allows existing merchants to instantly convert predefined sections into flexible visual blocks.
 */
export function convertSectionToElements(section: LandingPageSection): PageElement[] {
  const cfg = (section.config || {}) as Record<string, unknown>;

  switch (section.type) {
    case "hero": {
      const elements: PageElement[] = [];
      if (cfg.badge) {
        elements.push({
          id: `el_badge_${Date.now()}_1`,
          type: "badge",
          label: "Hero Eyebrow",
          isVisible: true,
          content: { text: String(cfg.badge), icon: "sparkles" },
          style: { fontSize: "xs", fontWeight: "bold" },
        });
      }
      if (cfg.headline) {
        elements.push({
          id: `el_heading_${Date.now()}_2`,
          type: "heading",
          label: "Headline",
          isVisible: true,
          content: { text: String(cfg.headline), level: "h1" },
          style: { fontSize: "5xl", fontWeight: "extrabold", textAlign: "left" },
        });
      }
      if (cfg.subheading) {
        elements.push({
          id: `el_para_${Date.now()}_3`,
          type: "paragraph",
          label: "Subheading",
          isVisible: true,
          content: { text: String(cfg.subheading) },
          style: { fontSize: "lg", color: "#9ca3af", lineHeight: "relaxed", maxWidth: "60ch" },
        });
      }
      if (cfg.ctaText) {
        elements.push({
          id: `el_btn_${Date.now()}_4`,
          type: "button",
          label: "Primary CTA",
          isVisible: true,
          content: { label: String(cfg.ctaText), link: String(cfg.ctaLink || "/products"), showArrow: true },
        });
      }
      return elements;
    }

    case "featured_products": {
      return [
        {
          id: `el_head_${Date.now()}_1`,
          type: "heading",
          label: "Grid Heading",
          isVisible: true,
          content: { text: String(cfg.heading || "Featured Products"), level: "h2" },
          style: { fontSize: "3xl", fontWeight: "bold" },
        },
        {
          id: `el_grid_${Date.now()}_2`,
          type: "product_grid",
          label: "Product Grid",
          isVisible: true,
          content: {
            columns: Number(cfg.columns) || 4,
            limit: Number(cfg.limit) || 8,
            showPrice: Boolean(cfg.showPrice ?? true),
            showBadge: Boolean(cfg.showBadge ?? true),
            viewAllLink: String(cfg.viewAllLink || "/products"),
          },
        },
      ];
    }

    case "product_carousel": {
      return [
        {
          id: `el_car_${Date.now()}_1`,
          type: "product_carousel",
          label: "Curated Carousel",
          isVisible: true,
          content: {
            heading: String(cfg.heading || "Trending Releases"),
            subtitle: String(cfg.subtitle || ""),
            sourceType: cfg.sourceType || "products",
            slides: cfg.slides || [],
            limit: Number(cfg.limit) || 8,
            layout: cfg.layout || "standard",
            aspectRatio: cfg.aspectRatio || "16:9",
            autoplay: Boolean(cfg.autoplay ?? false),
            showArrows: Boolean(cfg.showArrows ?? true),
            showPagination: Boolean(cfg.showPagination ?? true),
          },
        },
      ];
    }

    case "promotional_banner": {
      return [
        {
          id: `el_badge_${Date.now()}_1`,
          type: "badge",
          label: "Announcement Tag",
          isVisible: true,
          content: { text: String(cfg.badgeText || "OFFER"), variant: "accent" },
        },
        {
          id: `el_head_${Date.now()}_2`,
          type: "heading",
          label: "Banner Text",
          isVisible: true,
          content: { text: String(cfg.bannerText || "Exclusive offer"), level: "h3" },
          style: { fontSize: "xl", fontWeight: "semibold" },
        },
        {
          id: `el_btn_${Date.now()}_3`,
          type: "button",
          label: "Banner CTA",
          isVisible: true,
          content: { label: "Shop Sale", link: String(cfg.link || "/products") },
        },
      ];
    }

    default:
      return [
        {
          id: `el_head_${Date.now()}_1`,
          type: "heading",
          label: "Section Title",
          isVisible: true,
          content: { text: section.title, level: "h2" },
          style: { fontSize: "3xl", fontWeight: "bold" },
        },
        {
          id: `el_para_${Date.now()}_2`,
          type: "paragraph",
          label: "Content",
          isVisible: true,
          content: { text: "Add, arrange, and style elements inside this section." },
        },
      ];
  }
}

export function createDefaultLandingPageConfig(storeName: string): StorefrontLandingPageConfig {
  return {
    version: 2,
    theme: {
      presetId: "modern-minimalist",
      colors: { ...COLOR_PRESETS["modern-minimalist"].colors },
      typography: {
        headingFont: "display",
        bodyFont: "sans",
        scale: "md",
        headingWeight: "bold",
        bodyWeight: "normal",
      },
      animations: {
        enabled: true,
        intensity: "medium",
      },
      buttons: {
        shape: "rounded",
        variant: "solid",
        hoverEffect: "lift",
      },
    },
    sections: [
      {
        id: "hero_default",
        type: "hero",
        title: "Hero Banner",
        isVisible: true,
        animation: { preset: "fade-up", intensity: "medium" },
        styles: {
          paddingTop: "xl",
          paddingBottom: "xl",
          alignment: "left",
        },
        layout: {
          mode: "stack",
          containerWidth: "standard",
          horizontalAlignment: "left",
          gap: "md",
        },
        elements: [
          {
            id: "el_hero_badge",
            type: "badge",
            label: "Eyebrow Badge",
            isVisible: true,
            content: { text: "NEW SEASONAL ESSENTIALS", icon: "sparkles", variant: "accent" },
            style: { fontSize: "xs", fontWeight: "bold" },
          },
          {
            id: "el_hero_headline",
            type: "heading",
            label: "Main Headline",
            isVisible: true,
            content: { text: `${storeName} made memorable.`, level: "h1" },
            style: { fontSize: "5xl", fontWeight: "extrabold", textAlign: "left", maxWidth: "16ch" },
          },
          {
            id: "el_hero_subheading",
            type: "paragraph",
            label: "Subheading Paragraph",
            isVisible: true,
            content: {
              text: "Thoughtful pieces, beautiful details, and lasting craftsmanship. Handcrafted in small batches with sustainable materials.",
            },
            style: { fontSize: "lg", color: "#9ca3af", lineHeight: "relaxed", maxWidth: "55ch" },
          },
          {
            id: "el_hero_cta",
            type: "button",
            label: "Shop Now Button",
            isVisible: true,
            content: { label: "Shop the collection", link: "/products", showArrow: true },
          },
        ],
        config: {
          headline: `${storeName} made memorable.`,
          subheading: "Thoughtful pieces, beautiful details, and lasting craftsmanship.",
          eyebrow: "Curated for the everyday",
          ctaText: "Shop the collection",
          ctaLink: "/products",
          badge: "NEW SEASONAL ESSENTIALS",
        },
      },
      {
        id: "trust_default",
        type: "testimonials",
        title: "Trust Badges & Quotes",
        isVisible: true,
        animation: { preset: "fade-up", intensity: "subtle" },
        styles: {
          paddingTop: "md",
          paddingBottom: "md",
        },
        layout: {
          mode: "stack",
          containerWidth: "standard",
          horizontalAlignment: "center",
          gap: "lg",
        },
        elements: [
          {
            id: "el_trust_heading",
            type: "heading",
            label: "Trust Title",
            isVisible: true,
            content: { text: "Why customers choose us", level: "h2" },
            style: { fontSize: "3xl", fontWeight: "bold", textAlign: "center" },
          },
          {
            id: "el_trust_sub",
            type: "paragraph",
            label: "Trust Subtitle",
            isVisible: true,
            content: { text: "Uncompromising standards from studio to doorstep" },
            style: { fontSize: "base", color: "#9ca3af", textAlign: "center" },
          },
        ],
        config: {
          heading: "Why customers choose us",
          subtitle: "Uncompromising standards from studio to doorstep",
          badges: [
            { icon: "sparkles", title: "Considered Design", description: "Thoughtfully engineered with clean lines." },
            { icon: "check", title: "Small-Batch Quality", description: "Produced in limited quantities." },
            { icon: "truck", title: "Delivered With Care", description: "Fast tracked shipping in eco-friendly packaging." },
            { icon: "shield", title: "Verified & Secure", description: "Instant order confirmation backed by encrypted checkout." },
          ],
          items: [
            {
              quote: "The kind of shop that makes you want to refresh your whole space.",
              author: "A happy customer",
              role: "Verified Buyer",
              rating: 5,
            },
          ],
        },
      },
      {
        id: "featured_products_default",
        type: "featured_products",
        title: "Featured Products Grid",
        isVisible: true,
        animation: { preset: "stagger", intensity: "medium" },
        styles: {
          paddingTop: "lg",
          paddingBottom: "lg",
        },
        layout: {
          mode: "stack",
          containerWidth: "standard",
          gap: "md",
        },
        elements: [
          {
            id: "el_featured_heading",
            type: "heading",
            label: "Grid Header",
            isVisible: true,
            content: { text: "Favourites, for good reason.", level: "h2" },
            style: { fontSize: "3xl", fontWeight: "bold" },
          },
          {
            id: "el_featured_grid",
            type: "product_grid",
            label: "Catalog Grid",
            isVisible: true,
            content: { columns: 4, limit: 8, showPrice: true, showBadge: true, viewAllLink: "/products" },
          },
        ],
        config: {
          heading: "Favourites, for good reason.",
          subtitle: "Explore our most sought-after pieces and latest releases.",
          source: "all",
          columns: 4,
          limit: 8,
          showPrice: true,
          showBadge: true,
          viewAllLink: "/products",
        },
      },
      {
        id: "promo_banner_default",
        type: "promotional_banner",
        title: "Announcement Strip",
        isVisible: true,
        animation: { preset: "fade-in", intensity: "subtle" },
        styles: {
          paddingTop: "sm",
          paddingBottom: "sm",
        },
        layout: {
          mode: "row",
          containerWidth: "standard",
          horizontalAlignment: "space-between",
          verticalAlignment: "center",
          gap: "md",
        },
        elements: [
          {
            id: "el_promo_badge",
            type: "badge",
            label: "Limited Tag",
            isVisible: true,
            content: { text: "LIMITED TIME", variant: "accent" },
          },
          {
            id: "el_promo_text",
            type: "heading",
            label: "Promo Message",
            isVisible: true,
            content: { text: "Complimentary shipping on orders over $75 • Use code WELCOME20", level: "h4" },
            style: { fontSize: "base", fontWeight: "semibold" },
          },
          {
            id: "el_promo_btn",
            type: "button",
            label: "Shop Now Button",
            isVisible: true,
            content: { label: "Shop Sale", link: "/products" },
          },
        ],
        config: {
          bannerText: "Complimentary shipping on orders over $75",
          highlightCode: "WELCOME20",
          badgeText: "LIMITED TIME",
          link: "/products",
          style: "accent",
        },
      },
      {
        id: "editorial_default",
        type: "editorial",
        title: "Editorial Story",
        isVisible: true,
        animation: { preset: "fade-up", intensity: "medium" },
        styles: {
          paddingTop: "xl",
          paddingBottom: "xl",
        },
        layout: {
          mode: "columns-2",
          containerWidth: "standard",
          columnsRatio: "50_50",
          verticalAlignment: "center",
          gap: "xl",
        },
        elements: [
          {
            id: "el_editorial_heading",
            type: "heading",
            label: "Story Title",
            isVisible: true,
            content: { text: "Crafted with Intention & Care", level: "h2" },
            style: { fontSize: "4xl", fontWeight: "extrabold" },
          },
          {
            id: "el_editorial_para",
            type: "paragraph",
            label: "Story Body",
            isVisible: true,
            content: {
              text: "We partner with local artisans and sustainable suppliers to ensure every material is responsibly harvested and constructed to endure daily life.",
            },
            style: { fontSize: "base", color: "#9ca3af", lineHeight: "relaxed" },
          },
        ],
        config: {
          heading: "Crafted with Intention & Care",
          description: "We partner with local artisans and sustainable suppliers to ensure every material is responsibly harvested and constructed to endure daily life.",
          secondaryText: "From tactile textures to durable finishes, our collection is curated to bring balance and warmth into your rituals.",
          imagePosition: "right",
          imageAspectRatio: "portrait",
          ctaText: "Explore our story",
          ctaLink: "/about",
        },
      },
      {
        id: "newsletter_default",
        type: "newsletter",
        title: "Newsletter Subscription",
        isVisible: true,
        animation: { preset: "fade-up", intensity: "subtle" },
        styles: {
          paddingTop: "lg",
          paddingBottom: "lg",
        },
        layout: {
          mode: "stack",
          containerWidth: "narrow",
          horizontalAlignment: "center",
          gap: "md",
        },
        elements: [
          {
            id: "el_news_heading",
            type: "heading",
            label: "Newsletter Heading",
            isVisible: true,
            content: { text: "Stay in the loop", level: "h2" },
            style: { fontSize: "3xl", fontWeight: "bold", textAlign: "center" },
          },
          {
            id: "el_news_sub",
            type: "paragraph",
            label: "Newsletter Subtitle",
            isVisible: true,
            content: { text: "Be the first to hear about small-batch drops, private sales, and seasonal lookbooks." },
            style: { fontSize: "base", color: "#9ca3af", textAlign: "center" },
          },
        ],
        config: {
          heading: "Stay in the loop",
          description: "Be the first to hear about small-batch drops, private sales, and seasonal lookbooks.",
          placeholder: "Enter your email address...",
          buttonText: "Subscribe",
          disclaimer: "No spam, unsubscribe anytime with one click.",
        },
      },
    ],
  };
}
