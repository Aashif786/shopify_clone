"use client";

import React, { useState } from "react";
import type {
  LandingPageSection,
  SectionAnimationConfig,
  SectionStyleConfig,
  BackgroundConfig,
  CarouselSlide,
} from "@calcart/stores/landing-page";
import { SECTION_REGISTRY } from "@/components/storefront/landing-page/registry";
import {
  Sliders,
  Image as ImageIcon,
  Smartphone,
  Monitor,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface SectionEditorProps {
  section: LandingPageSection | null;
  onUpdateSection: (updated: LandingPageSection) => void;
}

const SAMPLE_SECTION_BACKGROUNDS = [
  { label: "Dark Studio", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80" },
  { label: "Warm Linen", url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=80" },
  { label: "Slate Rock", url: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=1600&q=80" },
];

export function SectionEditor({ section, onUpdateSection }: SectionEditorProps) {
  const [activeTab, setActiveTab] = useState<"content" | "style" | "animation">("content");
  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(0);

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
  const styles: SectionStyleConfig = section.styles || {};
  const secBg: BackgroundConfig = styles.background || { type: "color", opacity: 100 };

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

  const handleStyleChange = (key: keyof SectionStyleConfig, value: unknown) => {
    onUpdateSection({
      ...section,
      styles: {
        ...styles,
        [key]: value,
      },
    });
  };

  const handleBackgroundChange = (key: keyof BackgroundConfig, value: unknown) => {
    onUpdateSection({
      ...section,
      styles: {
        ...styles,
        background: {
          ...secBg,
          [key]: value,
        },
      },
    });
  };

  // Carousel slide helpers
  const slides = (config.slides as CarouselSlide[]) || [];

  const handleAddSlide = () => {
    const newSlide: CarouselSlide = {
      id: `slide_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: "custom_image",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80",
      title: `Slide ${slides.length + 1}`,
      subtitle: "New curated banner highlight",
      badge: "FEATURED",
      ctaText: "Shop now",
      ctaLink: "/products",
    };
    handleConfigChange("slides", [...slides, newSlide]);
    setExpandedSlideIndex(slides.length);
  };

  const handleUpdateSlide = (index: number, key: keyof CarouselSlide, value: unknown) => {
    const updated = [...slides];
    if (!updated[index]) return;
    updated[index] = { ...updated[index], [key]: value };
    handleConfigChange("slides", updated);
  };

  const handleRemoveSlide = (index: number) => {
    const updated = slides.filter((_, i) => i !== index);
    handleConfigChange("slides", updated);
    if (expandedSlideIndex === index) {
      setExpandedSlideIndex(null);
    }
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    const updated = [...slides];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIndex]!;
    updated[targetIndex] = temp!;
    handleConfigChange("slides", updated);
    setExpandedSlideIndex(targetIndex);
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

      {/* Editor Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg border border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab("content")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${
            activeTab === "content"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Content
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("style")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${
            activeTab === "style"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Background & Spacing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("animation")}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all ${
            activeTab === "animation"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Motion
        </button>
      </div>

      {/* TAB 1: CONTENT */}
      {activeTab === "content" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Section Label</label>
            <Input
              value={section.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Hero Banner"
              className="h-8 text-xs"
            />
          </div>

          {/* HERO */}
          {section.type === "hero" && (
            <div className="space-y-3 pt-2">
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
                    <option value="split">Split Columns</option>
                    <option value="centered">Centered Focal</option>
                    <option value="minimal">Minimal Compact</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Text Alignment</label>
                  <select
                    value={getString("textAlignment", "left")}
                    onChange={(e) => handleConfigChange("textAlignment", e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Primary CTA Text</label>
                  <Input
                    value={getString("ctaText")}
                    onChange={(e) => handleConfigChange("ctaText", e.target.value)}
                    placeholder="Shop the collection"
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
            </div>
          )}

          {/* FEATURED PRODUCTS */}
          {section.type === "featured_products" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Heading</label>
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
                  placeholder="Explore our most sought-after pieces"
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
                  <label className="text-xs font-semibold">Product Limit</label>
                  <select
                    value={getNumber("limit", 8)}
                    onChange={(e) => handleConfigChange("limit", Number(e.target.value))}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value={4}>4 Products</option>
                    <option value={8}>8 Products</option>
                    <option value={12}>12 Products</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PRODUCT & CUSTOM CAROUSEL */}
          {section.type === "product_carousel" && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Carousel Heading</label>
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

              {/* Source Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Content Source</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "products", label: "Store Products" },
                    { id: "custom_slides", label: "Custom Slides" },
                    { id: "mixed", label: "Curated" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleConfigChange("sourceType", s.id)}
                      className={`py-1.5 px-2 text-xs font-medium rounded-md border transition-colors ${
                        (config.sourceType || "products") === s.id
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-input bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Carousel Layout</label>
                  <select
                    value={getString("layout", "standard")}
                    onChange={(e) => handleConfigChange("layout", e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="standard">Standard Slider</option>
                    <option value="cards">Card Carousel</option>
                    <option value="hero_showcase">Hero Showcase</option>
                    <option value="fullwidth">Fullwidth Banner</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Aspect Ratio</label>
                  <select
                    value={getString("aspectRatio", "16:9")}
                    onChange={(e) => handleConfigChange("aspectRatio", e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="16:9">16:9 Widescreen</option>
                    <option value="4:3">4:3 Classic</option>
                    <option value="1:1">1:1 Square</option>
                    <option value="21:9">21:9 Cinematic</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Slides Manager (for custom_slides or mixed) */}
              {(config.sourceType === "custom_slides" || config.sourceType === "mixed") && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Slides ({slides.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSlide}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Slide</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {slides.map((slide, idx) => {
                      const isExpanded = expandedSlideIndex === idx;
                      return (
                        <div
                          key={slide.id || idx}
                          className="border border-border/80 rounded-xl bg-card/60 overflow-hidden"
                        >
                          <div className="flex items-center justify-between p-3 bg-muted/30">
                            <button
                              type="button"
                              onClick={() => setExpandedSlideIndex(isExpanded ? null : idx)}
                              className="flex items-center gap-2 text-left font-medium text-xs flex-1 truncate"
                            >
                              <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <span className="truncate">{slide.title || `Slide ${idx + 1}`}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSlide(idx, "up")}
                                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                                title="Move up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === slides.length - 1}
                                onClick={() => handleMoveSlide(idx, "down")}
                                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
                                title="Move down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlide(idx)}
                                className="p-1 rounded hover:bg-destructive/10 text-destructive"
                                title="Delete slide"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 space-y-2.5 border-t border-border/50">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">Title</label>
                                <Input
                                  value={slide.title || ""}
                                  onChange={(e) => handleUpdateSlide(idx, "title", e.target.value)}
                                  placeholder="Slide headline"
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">Subtitle</label>
                                <Input
                                  value={slide.subtitle || ""}
                                  onChange={(e) => handleUpdateSlide(idx, "subtitle", e.target.value)}
                                  placeholder="Slide description"
                                  className="h-7 text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-muted-foreground">Image URL</label>
                                <Input
                                  value={slide.imageUrl || ""}
                                  onChange={(e) => handleUpdateSlide(idx, "imageUrl", e.target.value)}
                                  placeholder="https://images.unsplash.com/..."
                                  className="h-7 text-xs font-mono"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground">Badge</label>
                                  <Input
                                    value={slide.badge || ""}
                                    onChange={(e) => handleUpdateSlide(idx, "badge", e.target.value)}
                                    placeholder="FEATURED"
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground">CTA Text</label>
                                  <Input
                                    value={slide.ctaText || ""}
                                    onChange={(e) => handleUpdateSlide(idx, "ctaText", e.target.value)}
                                    placeholder="Shop now"
                                    className="h-7 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Autoplay & Transition Controls */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold">Autoplay Slides</span>
                    <p className="text-[11px] text-muted-foreground">Automatically advance slides</p>
                  </div>
                  <Switch
                    checked={getBoolean("autoplay", false)}
                    onCheckedChange={(checked) => handleConfigChange("autoplay", checked)}
                  />
                </div>

                {getBoolean("autoplay", false) && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Interval</span>
                      <span className="font-mono text-muted-foreground">{getNumber("autoplayInterval", 5)}s</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={getNumber("autoplayInterval", 5)}
                      onChange={(e) => handleConfigChange("autoplayInterval", Number(e.target.value))}
                      className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Transition</label>
                    <select
                      value={getString("transition", "slide")}
                      onChange={(e) => handleConfigChange("transition", e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="slide">Slide</option>
                      <option value="fade">Fade</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Card Spacing</label>
                    <select
                      value={getString("cardSpacing", "normal")}
                      onChange={(e) => handleConfigChange("cardSpacing", e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="spacious">Spacious</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold">Navigation Arrows</span>
                  <Switch
                    checked={getBoolean("showArrows", true)}
                    onCheckedChange={(checked) => handleConfigChange("showArrows", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Pagination Dots</span>
                  <Switch
                    checked={getBoolean("showPagination", true)}
                    onCheckedChange={(checked) => handleConfigChange("showPagination", checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* EDITORIAL */}
          {section.type === "editorial" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Heading</label>
                <Input
                  value={getString("heading")}
                  onChange={(e) => handleConfigChange("heading", e.target.value)}
                  placeholder="Crafted with Intention"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Primary Text</label>
                <Textarea
                  rows={3}
                  value={getString("description")}
                  onChange={(e) => handleConfigChange("description", e.target.value)}
                  placeholder="Our story..."
                  className="text-xs resize-none"
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
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Image Aspect</label>
                  <select
                    value={getString("imageAspectRatio", "portrait")}
                    onChange={(e) => handleConfigChange("imageAspectRatio", e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                    <option value="square">Square</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PROMOTIONAL BANNER */}
          {section.type === "promotional_banner" && (
            <div className="space-y-3 pt-2">
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
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Badge Label</label>
                  <Input
                    value={getString("badgeText")}
                    onChange={(e) => handleConfigChange("badgeText", e.target.value)}
                    placeholder="LIMITED TIME"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TESTIMONIALS */}
          {section.type === "testimonials" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Heading</label>
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
                  placeholder="Uncompromising standards"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* NEWSLETTER */}
          {section.type === "newsletter" && (
            <div className="space-y-3 pt-2">
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
                  placeholder="Be the first to hear about private sales."
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
            <div className="space-y-3 pt-2">
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
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SECTION BACKGROUND & SPACING */}
      {activeTab === "style" && (
        <div className="space-y-5">
          {/* Section Background */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <ImageIcon className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Section Background
              </h4>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">Background Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "color", label: "Color" },
                  { id: "image", label: "Image" },
                  { id: "gradient", label: "Gradient" },
                ].map((bgT) => (
                  <button
                    key={bgT.id}
                    type="button"
                    onClick={() => handleBackgroundChange("type", bgT.id)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md border transition-colors ${
                      (secBg.type || "color") === bgT.id
                        ? "border-primary bg-primary/10 text-primary font-bold"
                        : "border-input bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {bgT.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            {(secBg.type === "color" || !secBg.type) && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-muted-foreground">Section Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secBg.color || "#16181f"}
                    onChange={(e) => handleBackgroundChange("color", e.target.value)}
                    className="w-6 h-6 rounded-md border border-border cursor-pointer bg-transparent p-0"
                  />
                  <Input
                    value={secBg.color || ""}
                    onChange={(e) => handleBackgroundChange("color", e.target.value)}
                    placeholder="#16181f"
                    className="w-24 h-7 text-[11px] font-mono uppercase px-2"
                  />
                </div>
              </div>
            )}

            {/* Image */}
            {secBg.type === "image" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Image URL</label>
                  <Input
                    value={secBg.imageUrl || ""}
                    onChange={(e) => handleBackgroundChange("imageUrl", e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Quick Textures</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SAMPLE_SECTION_BACKGROUNDS.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => handleBackgroundChange("imageUrl", sample.url)}
                        className={`text-[11px] py-1 px-2 rounded-md border truncate text-left transition-all ${
                          secBg.imageUrl === sample.url
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">Opacity</span>
                    <span className="font-mono text-muted-foreground">{secBg.opacity ?? 100}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={secBg.opacity ?? 100}
                    onChange={(e) => handleBackgroundChange("opacity", Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Scale Mode</label>
                    <select
                      value={secBg.size || "cover"}
                      onChange={(e) => handleBackgroundChange("size", e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="cover">Cover (Full)</option>
                      <option value="contain">Contain (Fit)</option>
                      <option value="auto">Original</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Position</label>
                    <select
                      value={secBg.position || "center"}
                      onChange={(e) => handleBackgroundChange("position", e.target.value)}
                      className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                    >
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {/* Overlay */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-semibold">Overlay Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secBg.overlayColor || "#000000"}
                      onChange={(e) => handleBackgroundChange("overlayColor", e.target.value)}
                      className="w-6 h-6 rounded-md border border-border cursor-pointer bg-transparent p-0"
                    />
                    <Input
                      value={secBg.overlayColor || "#000000"}
                      onChange={(e) => handleBackgroundChange("overlayColor", e.target.value)}
                      className="w-24 h-7 text-[11px] font-mono uppercase px-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Gradient */}
            {secBg.type === "gradient" && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold">CSS Gradient</label>
                <Input
                  value={secBg.gradient || ""}
                  onChange={(e) => handleBackgroundChange("gradient", e.target.value)}
                  placeholder="linear-gradient(135deg, #16181f 0%, #0d0e12 100%)"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Section Vertical Spacing */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Spacing & Padding
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Top Padding</label>
                <select
                  value={styles.paddingTop || "md"}
                  onChange={(e) => handleStyleChange("paddingTop", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="none">None (0px)</option>
                  <option value="xs">Extra Small</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                  <option value="2xl">Massive (Hero)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Bottom Padding</label>
                <select
                  value={styles.paddingBottom || "md"}
                  onChange={(e) => handleStyleChange("paddingBottom", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="none">None (0px)</option>
                  <option value="xs">Extra Small</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                  <option value="2xl">Massive (Hero)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Alignment, Radius, Shadow */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Styling & Geometry
            </h4>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Alignment</label>
                <select
                  value={styles.alignment || "left"}
                  onChange={(e) => handleStyleChange("alignment", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Corner Radius</label>
                <select
                  value={styles.borderRadius || "none"}
                  onChange={(e) => handleStyleChange("borderRadius", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="none">Square (0)</option>
                  <option value="md">Medium</option>
                  <option value="xl">Rounded XL</option>
                  <option value="2xl">Pill Curve</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Shadow</label>
                <select
                  value={styles.boxShadow || "none"}
                  onChange={(e) => handleStyleChange("boxShadow", e.target.value)}
                  className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="none">None</option>
                  <option value="sm">Subtle</option>
                  <option value="lg">Elevated</option>
                  <option value="glow">Primary Glow</option>
                </select>
              </div>
            </div>
          </div>

          {/* Responsive Controls */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Responsive Visibility
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Hide on Mobile</span>
                </div>
                <Switch
                  checked={styles.hideOnMobile ?? false}
                  onCheckedChange={(checked) => handleStyleChange("hideOnMobile", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Hide on Desktop</span>
                </div>
                <Switch
                  checked={styles.hideOnDesktop ?? false}
                  onCheckedChange={(checked) => handleStyleChange("hideOnDesktop", checked)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MOTION & ANIMATION */}
      {activeTab === "animation" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Entrance Motion Preset</label>
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
              <option value="none">None (Static)</option>
              <option value="fade-up">Fade Up (Clean Slide)</option>
              <option value="fade-in">Fade In (Subtle Dissolve)</option>
              <option value="stagger">Stagger (Cascading Reveal)</option>
              <option value="scale-in">Scale In (Zoom Entrance)</option>
              <option value="slide">Slide In (Side Glide)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Motion Intensity & Distance</label>
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
              <option value="subtle">Subtle (Restrained, gentle 16px displacement)</option>
              <option value="medium">Medium (Standard, 24px displacement)</option>
              <option value="expressive">Expressive (Bold, 36px displacement & spring)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
