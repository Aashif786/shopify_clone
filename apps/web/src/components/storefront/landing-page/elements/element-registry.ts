import React from "react";
import type { ElementType, ElementCategory } from "@calcart/stores/landing-page";
import {
  Heading,
  AlignLeft,
  MousePointerClick,
  Image as ImageIcon,
  Video,
  Sparkles,
  Minus,
  MoveVertical,
  Star,
  ShoppingBag,
  Grid3X3,
  SlidersHorizontal,
  Flame,
  Layers,
  Tag,
  Box,
  Columns as ColumnsIcon,
  LayoutGrid,
  Rows,
} from "lucide-react";

export interface ElementDefinition {
  type: ElementType;
  category: ElementCategory;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultLabel: string;
  badge?: string;
}

export const ELEMENT_REGISTRY: Record<ElementType, ElementDefinition> = {
  // Content Elements
  heading: {
    type: "heading",
    category: "content",
    name: "Heading",
    description: "Configurable headline (H1-H6) with typography scaling and alignment.",
    icon: Heading,
    defaultLabel: "Heading",
  },
  paragraph: {
    type: "paragraph",
    category: "content",
    name: "Paragraph",
    description: "Rich body text, descriptions, or subtitles with line-height and max-width.",
    icon: AlignLeft,
    defaultLabel: "Paragraph",
  },
  button: {
    type: "button",
    category: "content",
    name: "Action Button",
    description: "Clickable CTA button with custom styling, hover effects, and target link.",
    icon: MousePointerClick,
    defaultLabel: "Button",
  },
  badge: {
    type: "badge",
    category: "content",
    name: "Tag / Badge",
    description: "Compact status pill, category chip, or announcement tag.",
    icon: Sparkles,
    defaultLabel: "Badge",
  },
  divider: {
    type: "divider",
    category: "content",
    name: "Divider Line",
    description: "Horizontal border separator with solid, dashed, or gradient styling.",
    icon: Minus,
    defaultLabel: "Divider",
  },
  spacer: {
    type: "spacer",
    category: "content",
    name: "Spacer",
    description: "Adjustable vertical breathing room between elements.",
    icon: MoveVertical,
    defaultLabel: "Spacer",
  },
  icon: {
    type: "icon",
    category: "content",
    name: "Feature Icon & Text",
    description: "Icon box with title and micro-copy for trust badges, perks, or selling points.",
    icon: Star,
    defaultLabel: "Feature Icon",
  },

  // Media Elements
  image: {
    type: "image",
    category: "media",
    name: "Image",
    description: "High-resolution image with aspect-ratio lock, cropping, and zoom effects.",
    icon: ImageIcon,
    defaultLabel: "Image",
  },
  video: {
    type: "video",
    category: "media",
    name: "Video Player",
    description: "Direct MP4 or video embed with autoplay, looping, and ratio controls.",
    icon: Video,
    defaultLabel: "Video",
  },

  // Commerce Elements
  product_card: {
    type: "product_card",
    category: "commerce",
    name: "Product Card",
    description: "Tenant product card with live pricing, badges, and instant checkout action.",
    icon: ShoppingBag,
    defaultLabel: "Product Card",
    badge: "Commerce",
  },
  product_grid: {
    type: "product_grid",
    category: "commerce",
    name: "Product Grid",
    description: "Curated multi-column product catalog with filters and responsive columns.",
    icon: Grid3X3,
    defaultLabel: "Product Grid",
    badge: "Commerce",
  },
  product_collection: {
    type: "product_collection",
    category: "commerce",
    name: "Product Collection",
    description: "Curated collection grid showcase with category header and items.",
    icon: Layers,
    defaultLabel: "Product Collection",
    badge: "Commerce",
  },
  product_carousel: {
    type: "product_carousel",
    category: "commerce",
    name: "Product Carousel",
    description: "Smooth horizontal snap-scroll product slider with navigation controls.",
    icon: SlidersHorizontal,
    defaultLabel: "Product Carousel",
    badge: "Commerce",
  },
  featured_product: {
    type: "featured_product",
    category: "commerce",
    name: "Featured Product Split",
    description: "Spotlight presentation for a flagship product with gallery and description.",
    icon: Flame,
    defaultLabel: "Featured Product",
    badge: "Commerce",
  },
  collection_banner: {
    type: "collection_banner",
    category: "commerce",
    name: "Collection Banner",
    description: "Promotional card highlighting a specific product category with image.",
    icon: Layers,
    defaultLabel: "Collection Banner",
    badge: "Commerce",
  },
  category_links: {
    type: "category_links",
    category: "commerce",
    name: "Category Pills",
    description: "Interactive horizontal chip navigation for all store collections.",
    icon: Tag,
    defaultLabel: "Category Links",
    badge: "Commerce",
  },

  // Layout Elements
  container: {
    type: "container",
    category: "layout",
    name: "Nested Container",
    description: "Group elements with custom background, inner padding, and border radius.",
    icon: Box,
    defaultLabel: "Container",
  },
  columns: {
    type: "columns",
    category: "layout",
    name: "Columns",
    description: "Split content into side-by-side columns with custom ratios (50/50, 60/40, 70/30).",
    icon: ColumnsIcon,
    defaultLabel: "Columns",
  },
  grid: {
    type: "grid",
    category: "layout",
    name: "Sub-Grid",
    description: "Evenly spaced multi-column layout for small cards, perks, or stats.",
    icon: LayoutGrid,
    defaultLabel: "Grid",
  },
  stack: {
    type: "stack",
    category: "layout",
    name: "Vertical Stack",
    description: "Organize items vertically with controlled alignment and spacing.",
    icon: Rows,
    defaultLabel: "Stack",
  },
};

export const ELEMENT_CATEGORIES: Array<{
  id: ElementCategory;
  name: string;
  description: string;
}> = [
  { id: "content", name: "Content", description: "Text, headings, buttons, and badges" },
  { id: "media", name: "Media", description: "Images, video players, and visual assets" },
  { id: "commerce", name: "Commerce", description: "Tenant products, collections, and catalog showcases" },
  { id: "layout", name: "Layout", description: "Multi-column structures and containers" },
];
