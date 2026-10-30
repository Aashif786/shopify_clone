import type { ProductSummaryDTO } from "@calcart/products";
import type { LandingPageSection, LandingPageTheme } from "@calcart/stores/landing-page";

export interface StorefrontLandingSectionProps<TConfig = Record<string, unknown>> {
  section: LandingPageSection<TConfig>;
  storeSlug: string;
  storeName?: string;
  storeCurrency?: string;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
  isPreview?: boolean;
  isSelected?: boolean;
  onSelect?: (sectionId: string) => void;
  theme?: LandingPageTheme;
}
