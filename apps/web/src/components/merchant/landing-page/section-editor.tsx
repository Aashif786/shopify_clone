"use client";

import React from "react";
import type { LandingPageSection, SectionAnimationConfig } from "@calcart/stores/landing-page";
import { SECTION_REGISTRY } from "@/components/storefront/landing-page/registry";
import { Sliders } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface SectionEditorProps {
  section: LandingPageSection | null;
  onUpdateSection: (updated: LandingPageSection) => void;
}

export function SectionEditor({ section, onUpdateSection }: SectionEditorProps) {
  if (!section) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-full space-y-3">
        <Sliders className="w-8 h-8 opacity-40" />
        <p className="text-sm font-medium">Select a section to customize</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Click any section in the left panel or directly in the live preview to inspect and edit its properties.
        </p>
      </div>
    );
  }

  const def = SECTION_REGISTRY[section.type];
  const config = (section.config || {}) as Record<string, unknown>;

  const getString = (key: string, fallback = ""): string => {
    const val = config[key];
    return typeof val === "string" ? val : fallback;
  };

  const getNumber = (key: string, fallback = 0): number => {
    const val = config[key];
    return typeof val === "number" ? val : fallback;
  };

  const getBoolean = (key: string, fallback = false): boolean => {
    const val = config[key];
    return typeof val === "boolean" ? val : fallback;
  };

  const handleConfigChange = (key: string, value: unknown) => {
    onUpdateSection({
      ...section,
      config: {
        ...config,
        [key]: value,
      },
    });
  };

  const handleTitleChange = (title: string) => {
    onUpdateSection({
      ...section,
      title,
    });
  };

  const handleVisibilityChange = (isVisible: boolean) => {
    onUpdateSection({
      ...section,
      isVisible,
    });
  };

  const handleAnimationChange = (
    key: keyof SectionAnimationConfig,
    value: SectionAnimationConfig[keyof SectionAnimationConfig],
  ) => {
    onUpdateSection({
      ...section,
      animation: {
        preset: section.animation?.preset || "fade-up",
        intensity: section.animation?.intensity || "medium",
        ...section.animation,
        [key]: value,
      },
    });
  };

  return (
    <div className="p-5 space-y-6 text-foreground overflow-y-auto">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">{section.title || def?.title}</h3>
            <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
              {section.type.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {def?.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Visible</span>
          <Switch
            checked={section.isVisible}
            onCheckedChange={handleVisibilityChange}
          />
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          General & Animation
        </h4>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold">Section Label</label>
          <Input
            value={section.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Hero Banner"
            className="h-8 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Entrance Motion</label>
            <select
              value={section.animation?.preset || "fade-up"}
              onChange={(e) =>
                handleAnimationChange(
                  "preset",
                  e.target.value as SectionAnimationConfig["preset"],
                )
              }
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="none">None</option>
              <option value="fade-up">Fade Up</option>
              <option value="fade-in">Fade In</option>
              <option value="stagger">Stagger</option>
              <option value="scale-in">Scale In</option>
              <option value="slide">Slide In</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Motion Intensity</label>
            <select
              value={section.animation?.intensity || "medium"}
              onChange={(e) =>
                handleAnimationChange(
                  "intensity",
                  e.target.value as SectionAnimationConfig["intensity"],
                )
              }
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="subtle">Subtle</option>
              <option value="medium">Medium</option>
              <option value="expressive">Expressive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section-Specific Form Controls */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Content & Layout
        </h4>

        {/* HERO */}
        {section.type === "hero" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Badge / Eyebrow</label>
              <Input
                value={getString("badge")}
                onChange={(e) => handleConfigChange("badge", e.target.value)}
                placeholder="NEW SEASONAL ESSENTIALS"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Headline</label>
              <Input
                value={getString("headline")}
                onChange={(e) => handleConfigChange("headline", e.target.value)}
                placeholder="Store made memorable."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Subheading</label>
              <Textarea
                rows={3}
                value={getString("subheading")}
                onChange={(e) => handleConfigChange("subheading", e.target.value)}
                placeholder="Thoughtful pieces handcrafted with sustainable materials."
                className="text-xs resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Layout</label>
                <select
                  value={getString("layout", "split")}
                  onChange={(e) => handleConfigChange("layout", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="split">Split Two-Column</option>
                  <option value="centered">Centered</option>
                  <option value="minimal">Minimal Left</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Background</label>
                <select
                  value={getString("backgroundStyle", "gradient")}
                  onChange={(e) => handleConfigChange("backgroundStyle", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="gradient">Subtle Gradient Glow</option>
                  <option value="solid">Surface Solid</option>
                  <option value="image">Custom Image</option>
                </select>
              </div>
            </div>
            {getString("backgroundStyle") === "image" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold">Image URL</label>
                <Input
                  value={getString("backgroundImage")}
                  onChange={(e) => handleConfigChange("backgroundImage", e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Primary CTA Text</label>
                <Input
                  value={getString("ctaText")}
                  onChange={(e) => handleConfigChange("ctaText", e.target.value)}
                  placeholder="Shop collection"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Primary CTA Link</label>
                <Input
                  value={getString("ctaLink")}
                  onChange={(e) => handleConfigChange("ctaLink", e.target.value)}
                  placeholder="/products"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Secondary CTA Text</label>
                <Input
                  value={getString("cta2Text")}
                  onChange={(e) => handleConfigChange("cta2Text", e.target.value)}
                  placeholder="Our story"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Secondary CTA Link</label>
                <Input
                  value={getString("cta2Link")}
                  onChange={(e) => handleConfigChange("cta2Link", e.target.value)}
                  placeholder="/about"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* FEATURED PRODUCTS */}
        {section.type === "featured_products" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Section Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Favourites, for good reason."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Subtitle</label>
              <Input
                value={getString("subtitle")}
                onChange={(e) => handleConfigChange("subtitle", e.target.value)}
                placeholder="Explore our most sought-after pieces."
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Columns</label>
                <select
                  value={getNumber("columns", 4)}
                  onChange={(e) => handleConfigChange("columns", Number(e.target.value))}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns</option>
                  <option value={4}>4 Columns</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Max Products</label>
                <select
                  value={getNumber("limit", 8)}
                  onChange={(e) => handleConfigChange("limit", Number(e.target.value))}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value={2}>2 Items</option>
                  <option value={4}>4 Items</option>
                  <option value={8}>8 Items</option>
                  <option value={12}>12 Items</option>
                  <option value={16}>16 Items</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">View All Link</label>
              <Input
                value={getString("viewAllLink")}
                onChange={(e) => handleConfigChange("viewAllLink", e.target.value)}
                placeholder="/products"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* PRODUCT CAROUSEL */}
        {section.type === "product_carousel" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Trending Releases"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Subtitle</label>
              <Input
                value={getString("subtitle")}
                onChange={(e) => handleConfigChange("subtitle", e.target.value)}
                placeholder="Swipe through our newest curated selections"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Product Limit</label>
                <select
                  value={getNumber("limit", 8)}
                  onChange={(e) => handleConfigChange("limit", Number(e.target.value))}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value={4}>4 Items</option>
                  <option value={8}>8 Items</option>
                  <option value={12}>12 Items</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">View All Link</label>
                <Input
                  value={getString("viewAllLink")}
                  onChange={(e) => handleConfigChange("viewAllLink", e.target.value)}
                  placeholder="/products"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* COLLECTION SHOWCASE */}
        {section.type === "collection_showcase" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Shop by Category"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Subtitle</label>
              <Input
                value={getString("subtitle")}
                onChange={(e) => handleConfigChange("subtitle", e.target.value)}
                placeholder="Browse through our collections"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Columns</label>
              <select
                value={getNumber("columns", 3)}
                onChange={(e) => handleConfigChange("columns", Number(e.target.value))}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value={2}>2 Columns</option>
                <option value={3}>3 Columns</option>
                <option value={4}>4 Columns</option>
              </select>
            </div>
          </div>
        )}

        {/* PROMOTIONAL BANNER */}
        {section.type === "promotional_banner" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Banner Text</label>
              <Input
                value={getString("bannerText")}
                onChange={(e) => handleConfigChange("bannerText", e.target.value)}
                placeholder="Complimentary shipping over $75"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Discount Code</label>
                <Input
                  value={getString("highlightCode")}
                  onChange={(e) => handleConfigChange("highlightCode", e.target.value)}
                  placeholder="WELCOME20"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Badge Text</label>
                <Input
                  value={getString("badgeText")}
                  onChange={(e) => handleConfigChange("badgeText", e.target.value)}
                  placeholder="LIMITED TIME"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Target Link</label>
                <Input
                  value={getString("link")}
                  onChange={(e) => handleConfigChange("link", e.target.value)}
                  placeholder="/products"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Style</label>
                <select
                  value={getString("style", "accent")}
                  onChange={(e) => handleConfigChange("style", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="accent">Accent Surface</option>
                  <option value="gradient">Gradient Strip</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* EDITORIAL */}
        {section.type === "editorial" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Eyebrow</label>
              <Input
                value={getString("eyebrow")}
                onChange={(e) => handleConfigChange("eyebrow", e.target.value)}
                placeholder="Our Philosophy"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Headline</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Crafted with Intention & Care"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Main Description</label>
              <Textarea
                rows={3}
                value={getString("description")}
                onChange={(e) => handleConfigChange("description", e.target.value)}
                className="text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Secondary Quote / Commentary</label>
              <Input
                value={getString("secondaryText")}
                onChange={(e) => handleConfigChange("secondaryText", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Image Position</label>
                <select
                  value={getString("imagePosition", "right")}
                  onChange={(e) => handleConfigChange("imagePosition", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="right">Image on Right</option>
                  <option value="left">Image on Left</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Image URL</label>
                <Input
                  value={getString("imageUrl")}
                  onChange={(e) => handleConfigChange("imageUrl", e.target.value)}
                  placeholder="https://images..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">CTA Button Text</label>
                <Input
                  value={getString("ctaText")}
                  onChange={(e) => handleConfigChange("ctaText", e.target.value)}
                  placeholder="Explore story"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">CTA Link</label>
                <Input
                  value={getString("ctaLink")}
                  onChange={(e) => handleConfigChange("ctaLink", e.target.value)}
                  placeholder="/about"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* ASYMMETRIC SHOWCASE */}
        {section.type === "asymmetric_showcase" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Section Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Featured Spotlights"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Spotlight Title</label>
              <Input
                value={getString("spotlightTitle")}
                onChange={(e) => handleConfigChange("spotlightTitle", e.target.value)}
                placeholder="The Signature Series"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Spotlight Subtitle</label>
              <Input
                value={getString("spotlightSubtitle")}
                onChange={(e) => handleConfigChange("spotlightSubtitle", e.target.value)}
                placeholder="Precision crafted for lasting silhouette."
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Spotlight Badge</label>
                <Input
                  value={getString("spotlightBadge")}
                  onChange={(e) => handleConfigChange("spotlightBadge", e.target.value)}
                  placeholder="SPOTLIGHT"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Spotlight Image URL</label>
                <Input
                  value={getString("spotlightImage")}
                  onChange={(e) => handleConfigChange("spotlightImage", e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* BRAND STORY */}
        {section.type === "brand_story" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Section Label</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="The Story Behind Our Brand"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Featured Pull Quote</label>
              <Textarea
                rows={3}
                value={getString("quote")}
                onChange={(e) => handleConfigChange("quote", e.target.value)}
                placeholder="We set out to create goods that outlast fast cycles..."
                className="text-xs resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Quote Author</label>
                <Input
                  value={getString("quoteAuthor")}
                  onChange={(e) => handleConfigChange("quoteAuthor", e.target.value)}
                  placeholder="The Founding Team"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Author Role</label>
                <Input
                  value={getString("quoteAuthorRole")}
                  onChange={(e) => handleConfigChange("quoteAuthorRole", e.target.value)}
                  placeholder="Design & Craft Directorate"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* TESTIMONIALS */}
        {section.type === "testimonials" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Section Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Why customers choose us"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Subtitle</label>
              <Input
                value={getString("subtitle")}
                onChange={(e) => handleConfigChange("subtitle", e.target.value)}
                placeholder="Uncompromising standards from studio to doorstep"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* NEWSLETTER */}
        {section.type === "newsletter" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Heading</label>
              <Input
                value={getString("heading")}
                onChange={(e) => handleConfigChange("heading", e.target.value)}
                placeholder="Stay in the loop"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Description</label>
              <Textarea
                rows={2}
                value={getString("description")}
                onChange={(e) => handleConfigChange("description", e.target.value)}
                placeholder="Be the first to hear about drops and private sales."
                className="text-xs resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Button Text</label>
                <Input
                  value={getString("buttonText")}
                  onChange={(e) => handleConfigChange("buttonText", e.target.value)}
                  placeholder="Subscribe"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Placeholder</label>
                <Input
                  value={getString("placeholder")}
                  onChange={(e) => handleConfigChange("placeholder", e.target.value)}
                  placeholder="Enter email address..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* SPACER / DIVIDER */}
        {section.type === "spacer_divider" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Height</label>
              <select
                value={getString("height", "md")}
                onChange={(e) => handleConfigChange("height", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="sm">Small (24px)</option>
                <option value="md">Medium (40px)</option>
                <option value="lg">Large (64px)</option>
                <option value="xl">Extra Large (96px)</option>
              </select>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold">Show Divider Line</span>
              <Switch
                checked={getBoolean("showLine", true)}
                onCheckedChange={(checked) => handleConfigChange("showLine", checked)}
              />
            </div>
            {getBoolean("showLine", true) && (
              <div className="space-y-1">
                <label className="text-xs font-semibold">Divider Style</label>
                <select
                  value={getString("style", "solid")}
                  onChange={(e) => handleConfigChange("style", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="solid">Solid Line</option>
                  <option value="dashed">Dashed Line</option>
                  <option value="gradient">Gradient Line</option>
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
