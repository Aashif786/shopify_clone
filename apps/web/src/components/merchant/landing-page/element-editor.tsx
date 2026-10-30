"use client";

import React, { useState } from "react";
import type {
  PageElement,
  LandingPageSection,
} from "@calcart/stores/landing-page";
import type { ProductSummaryDTO } from "@calcart/products";
import { ELEMENT_REGISTRY } from "@/components/storefront/landing-page/elements/element-registry";
import {
  ArrowLeft,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Sliders,
  Type,
  Smartphone,
  Tablet,
  Monitor,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ElementEditorProps {
  element: PageElement;
  section: LandingPageSection;
  onUpdate: (updated: PageElement) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBackToSection: () => void;
  products?: ProductSummaryDTO[];
  collections?: Array<{ id: string; name: string; slug?: string; imageUrl?: string; productCount?: number }>;
}

export function ElementEditor({
  element,
  section,
  onUpdate,
  onDelete,
  onDuplicate,
  onBackToSection,
  products = [],
  collections = [],
}: ElementEditorProps) {
  const [activeTab, setActiveTab] = useState<"content" | "style" | "responsive">("content");

  const def = ELEMENT_REGISTRY[element.type];
  const content = (element.content || {}) as Record<string, unknown>;
  const style = (element.style || {}) as Record<string, unknown>;
  const responsive = (element.responsive || {}) as Record<string, unknown>;
  const animation = (element.animation || { preset: "none" }) as Record<string, unknown>;

  const getString = (key: string, fallback = ""): string => {
    const val = content[key];
    return typeof val === "string" ? val : fallback;
  };

  const getNumber = (key: string, fallback = 0): number => {
    const val = content[key];
    return typeof val === "number" ? val : fallback;
  };

  const getBoolean = (key: string, fallback = false): boolean => {
    const val = content[key];
    return typeof val === "boolean" ? val : fallback;
  };

  const getStyleString = (key: string, fallback = ""): string => {
    const val = style[key];
    return typeof val === "string" ? val : fallback;
  };

  const getAnimString = (key: string, fallback = ""): string => {
    const val = animation[key];
    return typeof val === "string" ? val : fallback;
  };

  const getAnimNumber = (key: string, fallback = 0): number => {
    const val = animation[key];
    return typeof val === "number" ? val : fallback;
  };

  const getRespBoolean = (key: string, fallback = false): boolean => {
    const val = responsive[key];
    return typeof val === "boolean" ? val : fallback;
  };

  const updateContent = (updates: Record<string, unknown>) => {
    onUpdate({
      ...element,
      content: { ...content, ...updates },
    });
  };

  const updateStyle = (updates: Record<string, unknown>) => {
    onUpdate({
      ...element,
      style: { ...style, ...updates },
    });
  };

  const updateResponsive = (updates: Record<string, unknown>) => {
    onUpdate({
      ...element,
      responsive: { ...responsive, ...updates },
    });
  };

  const updateAnimation = (updates: Record<string, unknown>) => {
    const currentPreset =
      typeof animation.preset === "string"
        ? (animation.preset as "none" | "fade-up" | "fade-in" | "scale-in" | "slide" | "slide-left" | "slide-right")
        : "none";

    onUpdate({
      ...element,
      animation: {
        preset: currentPreset,
        ...animation,
        ...updates,
      },
    });
  };

  const toggleVisibility = () => {
    onUpdate({
      ...element,
      isVisible: !element.isVisible,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background select-none text-foreground">
      {/* Header & Breadcrumb */}
      <div className="p-4 border-b border-border space-y-3 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToSection}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to {section.title || section.type}</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleVisibility}
              title={element.isVisible ? "Hide element" : "Show element"}
              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                element.isVisible
                  ? "bg-muted/60 text-muted-foreground hover:text-foreground border-border"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/30"
              }`}
            >
              {element.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(element.id)}
              title="Duplicate element"
              className="p-1.5 rounded-lg border border-border bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(element.id)}
              title="Delete element"
              className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title & Label Editor */}
        <div className="flex items-center gap-2">
          {def && (
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
              <def.icon className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={element.label || ""}
              onChange={(e) => onUpdate({ ...element, label: e.target.value })}
              placeholder={def?.name || element.type}
              className="w-full text-sm font-bold bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-hidden text-foreground px-1 py-0.5 rounded-xs"
            />
            <div className="flex items-center gap-1.5 px-1 mt-0.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Type: {element.type}
              </span>
              {def?.badge && (
                <Badge variant="outline" className="text-[9px] uppercase font-mono py-0 px-1">
                  {def.badge}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Inspector Tabs */}
        <div className="flex border-b border-border gap-1 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Content</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("style")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "style"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Styling & Spacing</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("responsive")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "responsive"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Responsive & Motion</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* TAB 1: CONTENT */}
        {activeTab === "content" && (
          <div className="space-y-4">
            {/* Heading Element */}
            {element.type === "heading" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Headline Text</label>
                  <textarea
                    rows={2}
                    value={getString("text")}
                    onChange={(e) => updateContent({ text: e.target.value })}
                    placeholder="Enter headline..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Tag Level</label>
                    <select
                      value={getString("level", "h2")}
                      onChange={(e) => updateContent({ level: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="h1">H1 (Hero Principal)</option>
                      <option value="h2">H2 (Section Header)</option>
                      <option value="h3">H3 (Sub-heading)</option>
                      <option value="h4">H4 (Card Title)</option>
                      <option value="h5">H5 (Minor Title)</option>
                      <option value="h6">H6 (Micro Title)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Optional Eyebrow</label>
                    <input
                      type="text"
                      value={getString("eyebrow")}
                      onChange={(e) => updateContent({ eyebrow: e.target.value })}
                      placeholder="e.g. NEW RELEASE"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Paragraph Element */}
            {element.type === "paragraph" && (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Paragraph Text</label>
                <textarea
                  rows={4}
                  value={getString("text")}
                  onChange={(e) => updateContent({ text: e.target.value })}
                  placeholder="Write paragraph content..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/40 resize-none leading-relaxed"
                />
              </div>
            )}

            {/* Button Element */}
            {element.type === "button" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Button Label</label>
                  <input
                    type="text"
                    value={getString("text")}
                    onChange={(e) => updateContent({ text: e.target.value })}
                    placeholder="e.g. Shop the Collection"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Link URL / Destination</label>
                  <input
                    type="text"
                    value={getString("link")}
                    onChange={(e) => updateContent({ link: e.target.value })}
                    placeholder="/products or https://..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden font-mono text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Visual Style</label>
                    <select
                      value={getString("variant", "solid")}
                      onChange={(e) => updateContent({ variant: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="solid">Solid Fill</option>
                      <option value="outline">Outline Border</option>
                      <option value="soft">Soft Tint</option>
                      <option value="ghost">Ghost / Text Only</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Shape</label>
                    <select
                      value={getString("shape", "rounded")}
                      onChange={(e) => updateContent({ shape: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="pill">Pill (Rounded-Full)</option>
                      <option value="rounded">Rounded (12px)</option>
                      <option value="sharp">Sharp (0px)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Button Size</label>
                    <select
                      value={getString("size", "md")}
                      onChange={(e) => updateContent({ size: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="sm">Small (Compact)</option>
                      <option value="md">Medium (Default)</option>
                      <option value="lg">Large (Prominent)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Accompanying Icon</label>
                    <select
                      value={getString("icon", "arrow")}
                      onChange={(e) => updateContent({ icon: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="none">No Icon</option>
                      <option value="arrow">Arrow Right</option>
                      <option value="cart">Shopping Bag</option>
                      <option value="sparkles">Sparkles</option>
                      <option value="external">External Link</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card/40">
                  <span className="font-semibold text-foreground">Full Width Button</span>
                  <input
                    type="checkbox"
                    checked={getBoolean("isFullWidth")}
                    onChange={(e) => updateContent({ isFullWidth: e.target.checked })}
                    className="rounded-md"
                  />
                </div>
              </>
            )}

            {/* Badge Element */}
            {element.type === "badge" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Badge Text</label>
                  <input
                    type="text"
                    value={getString("text")}
                    onChange={(e) => updateContent({ text: e.target.value })}
                    placeholder="e.g. LIMITED EDITION"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Icon</label>
                    <select
                      value={getString("icon", "sparkles")}
                      onChange={(e) => updateContent({ icon: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="sparkles">Sparkles</option>
                      <option value="tag">Tag</option>
                      <option value="check">Checkmark</option>
                      <option value="flame">Flame / Hot</option>
                      <option value="shield">Shield</option>
                      <option value="star">Star</option>
                      <option value="award">Award</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Color Variant</label>
                    <select
                      value={getString("variant", "default")}
                      onChange={(e) => updateContent({ variant: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="default">Primary Solid</option>
                      <option value="outline">Outline</option>
                      <option value="accent">Secondary Accent</option>
                      <option value="subtle">Subtle Neutral</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Divider Element */}
            {element.type === "divider" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Line Style</label>
                  <select
                    value={getString("style", "solid")}
                    onChange={(e) => updateContent({ style: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="gradient">Gradient Fade</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Width</label>
                  <select
                    value={getString("width", "full")}
                    onChange={(e) => updateContent({ width: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="full">Full Width (100%)</option>
                    <option value="half">Half Width (50%)</option>
                    <option value="third">One Third (33%)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Spacer Element */}
            {element.type === "spacer" && (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Vertical Height</label>
                <select
                  value={getString("height", "md")}
                  onChange={(e) => updateContent({ height: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                >
                  <option value="xs">Extra Small (12px)</option>
                  <option value="sm">Small (24px)</option>
                  <option value="md">Medium (48px)</option>
                  <option value="lg">Large (80px)</option>
                  <option value="xl">Extra Large (128px)</option>
                  <option value="2xl">Massive (192px)</option>
                </select>
              </div>
            )}

            {/* Icon Element */}
            {element.type === "icon" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Icon</label>
                    <select
                      value={getString("icon", "sparkles")}
                      onChange={(e) => updateContent({ icon: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="sparkles">Sparkles</option>
                      <option value="check">Checkmark</option>
                      <option value="truck">Delivery Truck</option>
                      <option value="shield">Security Shield</option>
                      <option value="star">Star</option>
                      <option value="flame">Flame</option>
                      <option value="award">Award Medal</option>
                      <option value="heart">Heart</option>
                      <option value="clock">Clock / Fast</option>
                      <option value="return">Return Policy</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Layout</label>
                    <select
                      value={getString("layout", "vertical")}
                      onChange={(e) => updateContent({ layout: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="vertical">Vertical Card</option>
                      <option value="horizontal">Horizontal Row</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Title</label>
                  <input
                    type="text"
                    value={getString("title")}
                    onChange={(e) => updateContent({ title: e.target.value })}
                    placeholder="e.g. Free Express Shipping"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Description</label>
                  <input
                    type="text"
                    value={getString("description")}
                    onChange={(e) => updateContent({ description: e.target.value })}
                    placeholder="On orders over $75"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
              </>
            )}

            {/* Image Element */}
            {element.type === "image" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Image URL</label>
                  <input
                    type="text"
                    value={getString("imageUrl")}
                    onChange={(e) => updateContent({ imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden font-mono text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Aspect Ratio</label>
                    <select
                      value={getString("aspectRatio", "16/9")}
                      onChange={(e) => updateContent({ aspectRatio: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="auto">Auto / Natural</option>
                      <option value="1/1">Square (1:1)</option>
                      <option value="4/3">Standard (4:3)</option>
                      <option value="16/9">Widescreen (16:9)</option>
                      <option value="21/9">Cinematic (21:9)</option>
                      <option value="portrait">Portrait (3:4)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Fit Mode</label>
                    <select
                      value={getString("fit", "cover")}
                      onChange={(e) => updateContent({ fit: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="cover">Cover (Fill & Crop)</option>
                      <option value="contain">Contain (Full Image)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Alt Text (Accessibility)</label>
                  <input
                    type="text"
                    value={getString("alt")}
                    onChange={(e) => updateContent({ alt: e.target.value })}
                    placeholder="Describe image..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
              </>
            )}

            {/* Video Element */}
            {element.type === "video" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Video URL (MP4 or YouTube/Vimeo)</label>
                  <input
                    type="text"
                    value={getString("videoUrl")}
                    onChange={(e) => updateContent({ videoUrl: e.target.value })}
                    placeholder="https://... or YouTube link"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden font-mono text-[11px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Aspect Ratio</label>
                    <select
                      value={getString("aspectRatio", "16/9")}
                      onChange={(e) => updateContent({ aspectRatio: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="16/9">16:9 (Standard Video)</option>
                      <option value="4/3">4:3</option>
                      <option value="1/1">1:1 (Square)</option>
                      <option value="21/9">21:9 (Ultrawide)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end space-y-2 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getBoolean("autoplay", false)}
                        onChange={(e) => updateContent({ autoplay: e.target.checked })}
                        className="rounded-md"
                      />
                      <span>Autoplay Video</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getBoolean("loop", true)}
                        onChange={(e) => updateContent({ loop: e.target.checked })}
                        className="rounded-md"
                      />
                      <span>Loop Video</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Product Card Element */}
            {element.type === "product_card" && (
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Select Product</label>
                <select
                  value={getString("productId")}
                  onChange={(e) => updateContent({ productId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                >
                  <option value="">Auto (First Catalog Item)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Product Grid Element */}
            {element.type === "product_grid" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Grid Columns</label>
                    <select
                      value={getNumber("columns", 4)}
                      onChange={(e) => updateContent({ columns: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value={2}>2 Columns</option>
                      <option value={3}>3 Columns</option>
                      <option value={4}>4 Columns</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Max Items</label>
                    <select
                      value={getNumber("limit", 8)}
                      onChange={(e) => updateContent({ limit: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value={4}>4 Products</option>
                      <option value={6}>6 Products</option>
                      <option value={8}>8 Products</option>
                      <option value={12}>12 Products</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card/40">
                  <span className="font-semibold text-foreground">Show View All Button</span>
                  <input
                    type="checkbox"
                    checked={getBoolean("showViewAll", true)}
                    onChange={(e) => updateContent({ showViewAll: e.target.checked })}
                    className="rounded-md"
                  />
                </div>
              </>
            )}

            {/* Featured Product Element */}
            {element.type === "featured_product" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Featured Product</label>
                  <select
                    value={getString("productId")}
                    onChange={(e) => updateContent({ productId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="">Auto (First Product)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Image Position</label>
                    <select
                      value={getString("imagePosition", "left")}
                      onChange={(e) => updateContent({ imagePosition: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="left">Image on Left</option>
                      <option value="right">Image on Right</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">CTA Text</label>
                    <input
                      type="text"
                      value={getString("ctaText", "Shop Product")}
                      onChange={(e) => updateContent({ ctaText: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Collection Banner Element */}
            {element.type === "collection_banner" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Select Collection</label>
                  <select
                    value={getString("collectionId")}
                    onChange={(e) => updateContent({ collectionId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="">Default (First Collection)</option>
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Custom Title</label>
                  <input
                    type="text"
                    value={getString("title")}
                    onChange={(e) => updateContent({ title: e.target.value })}
                    placeholder="e.g. Summer Essentials"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Image URL</label>
                  <input
                    type="text"
                    value={getString("imageUrl")}
                    onChange={(e) => updateContent({ imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden font-mono text-[11px]"
                  />
                </div>
              </>
            )}

            {/* Category Links Element */}
            {element.type === "category_links" && (
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card/40">
                <span className="font-semibold text-foreground">Show Product Counts</span>
                <input
                  type="checkbox"
                  checked={getBoolean("showCount", true)}
                  onChange={(e) => updateContent({ showCount: e.target.checked })}
                  className="rounded-md"
                />
              </div>
            )}

            {/* Columns Element */}
            {element.type === "columns" && (
              <>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Columns Ratio</label>
                  <select
                    value={getString("ratio", "50_50")}
                    onChange={(e) => updateContent({ ratio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="50_50">50% / 50% (Equal Split)</option>
                    <option value="60_40">60% / 40% (Wide Left)</option>
                    <option value="40_60">40% / 60% (Wide Right)</option>
                    <option value="70_30">70% / 30% (Hero Sidebar)</option>
                    <option value="30_70">30% / 70% (Sidebar Hero)</option>
                    <option value="33_33_33">33% / 33% / 33% (3 Equal)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Column Gap</label>
                    <select
                      value={getString("gap", "md")}
                      onChange={(e) => updateContent({ gap: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="none">None (0px)</option>
                      <option value="xs">Extra Small (8px)</option>
                      <option value="sm">Small (16px)</option>
                      <option value="md">Medium (24px)</option>
                      <option value="lg">Large (32px)</option>
                      <option value="xl">Extra Large (48px)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-card/40 mt-5">
                    <span className="font-semibold text-foreground">Stack on Mobile</span>
                    <input
                      type="checkbox"
                      checked={getBoolean("stackOnMobile", true)}
                      onChange={(e) => updateContent({ stackOnMobile: e.target.checked })}
                      className="rounded-md"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Container Element */}
            {element.type === "container" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Container Width</label>
                    <select
                      value={getString("containerWidth", "standard")}
                      onChange={(e) => updateContent({ containerWidth: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="standard">Standard (1280px)</option>
                      <option value="narrow">Narrow (896px)</option>
                      <option value="wide">Wide (1600px)</option>
                      <option value="fullwidth">Full Width (100%)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Inner Padding</label>
                    <select
                      value={getString("paddingY", "md")}
                      onChange={(e) => updateContent({ paddingY: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="none">None</option>
                      <option value="sm">Small</option>
                      <option value="md">Medium</option>
                      <option value="lg">Large</option>
                      <option value="xl">Extra Large</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: STYLING & SPACING */}
        {activeTab === "style" && (
          <div className="space-y-4">
            {/* Typography Controls for text elements */}
            {["heading", "paragraph", "badge", "icon"].includes(element.type) && (
              <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
                <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">
                  Typography
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Font Size</label>
                    <select
                      value={getStyleString("fontSize")}
                      onChange={(e) => updateStyle({ fontSize: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="">Default</option>
                      <option value="xs">Extra Small</option>
                      <option value="sm">Small</option>
                      <option value="base">Base (16px)</option>
                      <option value="lg">Large (18px)</option>
                      <option value="xl">XL (20px)</option>
                      <option value="2xl">2XL (24px)</option>
                      <option value="3xl">3XL (30px)</option>
                      <option value="4xl">4XL (36px)</option>
                      <option value="5xl">5XL (48px)</option>
                      <option value="6xl">6XL (60px)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Font Weight</label>
                    <select
                      value={getStyleString("fontWeight")}
                      onChange={(e) => updateStyle({ fontWeight: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="">Default</option>
                      <option value="normal">Normal (400)</option>
                      <option value="medium">Medium (500)</option>
                      <option value="semibold">Semibold (600)</option>
                      <option value="bold">Bold (700)</option>
                      <option value="extrabold">Extra Bold (800)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Alignment</label>
                    <select
                      value={getStyleString("textAlign", "left")}
                      onChange={(e) => updateStyle({ textAlign: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value="left">Left Aligned</option>
                      <option value="center">Centered</option>
                      <option value="right">Right Aligned</option>
                      <option value="justify">Justified</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Custom Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={getStyleString("color", "#ffffff")}
                        onChange={(e) => updateStyle({ color: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={getStyleString("color")}
                        onChange={(e) => updateStyle({ color: e.target.value })}
                        placeholder="#ffffff"
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-card/50 text-foreground font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sizing & Margins */}
            <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">
                Layout & Spacing
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Element Width</label>
                  <select
                    value={getStyleString("width", "full")}
                    onChange={(e) => updateStyle({ width: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="full">Full Width (100%)</option>
                    <option value="half">Half (50%)</option>
                    <option value="third">One Third (33%)</option>
                    <option value="two_thirds">Two Thirds (66%)</option>
                    <option value="auto">Auto (Fit Content)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Max Width Limit</label>
                  <input
                    type="text"
                    value={getStyleString("maxWidth")}
                    onChange={(e) => updateStyle({ maxWidth: e.target.value })}
                    placeholder="e.g. 65ch, 600px"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Margin Top</label>
                  <select
                    value={getStyleString("marginTop", "none")}
                    onChange={(e) => updateStyle({ marginTop: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="none">None (0px)</option>
                    <option value="xs">Extra Small (4px)</option>
                    <option value="sm">Small (8px)</option>
                    <option value="md">Medium (16px)</option>
                    <option value="lg">Large (24px)</option>
                    <option value="xl">Extra Large (40px)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Margin Bottom</label>
                  <select
                    value={getStyleString("marginBottom", "none")}
                    onChange={(e) => updateStyle({ marginBottom: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                  >
                    <option value="none">None (0px)</option>
                    <option value="xs">Extra Small (4px)</option>
                    <option value="sm">Small (8px)</option>
                    <option value="md">Medium (16px)</option>
                    <option value="lg">Large (24px)</option>
                    <option value="xl">Extra Large (40px)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESPONSIVE & MOTION */}
        {activeTab === "responsive" && (
          <div className="space-y-4">
            {/* Viewport Visibility */}
            <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">
                Viewport Visibility
              </span>
              <p className="text-[11px] text-muted-foreground">
                Control which device screen sizes display this element.
              </p>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background/50">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-500" />
                    <span>Hide on Mobile (&lt; 640px)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={getRespBoolean("hideOnMobile")}
                    onChange={(e) => updateResponsive({ hideOnMobile: e.target.checked })}
                    className="rounded-md"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background/50">
                  <div className="flex items-center gap-2">
                    <Tablet className="w-4 h-4 text-purple-500" />
                    <span>Hide on Tablet (640px - 1024px)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={getRespBoolean("hideOnTablet")}
                    onChange={(e) => updateResponsive({ hideOnTablet: e.target.checked })}
                    className="rounded-md"
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background/50">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-sky-500" />
                    <span>Hide on Desktop (&gt; 1024px)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={getRespBoolean("hideOnDesktop")}
                    onChange={(e) => updateResponsive({ hideOnDesktop: e.target.checked })}
                    className="rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Entrance Animation */}
            <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-primary">
                Entrance Animation
              </span>
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Animation Preset</label>
                <select
                  value={getAnimString("preset", "none")}
                  onChange={(e) => updateAnimation({ preset: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                >
                  <option value="none">None (Static Mount)</option>
                  <option value="fade-up">Fade Up (Smooth Rise)</option>
                  <option value="fade-in">Fade In (Gentle Dissolve)</option>
                  <option value="scale-in">Scale In (Zoom Reveal)</option>
                  <option value="slide">Slide In (From Left)</option>
                </select>
              </div>

              {getAnimString("preset", "none") !== "none" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Duration</label>
                    <select
                      value={getAnimNumber("duration", 0.4)}
                      onChange={(e) => updateAnimation({ duration: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value={0.25}>0.25s (Fast)</option>
                      <option value={0.4}>0.4s (Balanced)</option>
                      <option value={0.6}>0.6s (Cinematic)</option>
                      <option value={0.8}>0.8s (Deliberate)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Delay</label>
                    <select
                      value={getAnimNumber("delay", 0)}
                      onChange={(e) => updateAnimation({ delay: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card/50 text-foreground focus:outline-hidden"
                    >
                      <option value={0}>0s (Instant)</option>
                      <option value={0.1}>0.1s</option>
                      <option value={0.2}>0.2s</option>
                      <option value={0.3}>0.3s</option>
                      <option value={0.5}>0.5s</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
