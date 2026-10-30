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
  | "spacer_divider";

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

export interface LandingPageSection<TConfig = Record<string, unknown>> {
  id: string;
  type: SectionType;
  title: string;
  isVisible: boolean;
  animation?: SectionAnimationConfig;
  styles?: SectionStyleConfig;
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

export function createDefaultLandingPageConfig(storeName: string): StorefrontLandingPageConfig {
  return {
    version: 1,
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
          paddingTop: "lg",
          paddingBottom: "lg",
          alignment: "left",
        },
        config: {
          headline: `${storeName} made memorable.`,
          subheading: "Thoughtful pieces, beautiful details, and a little more delight in every delivery. Handcrafted in small batches with sustainable materials.",
          eyebrow: "Curated for the everyday",
          ctaText: "Shop the collection",
          ctaLink: "/products",
          cta2Text: "Our story",
          cta2Link: "/about",
          textAlignment: "left",
          layout: "split",
          backgroundStyle: "gradient",
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
        config: {
          heading: "Why customers choose us",
          subtitle: "Uncompromising standards from studio to doorstep",
          badges: [
            { icon: "sparkles", title: "Considered Design", description: "Thoughtfully engineered with clean lines and timeless appeal." },
            { icon: "check", title: "Small-Batch Quality", description: "Produced in limited quantities to ensure high standards." },
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
