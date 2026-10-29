"use client";

import React from "react";
import type { LandingPageTheme, ColorPresetId, ColorTokens } from "@shopify-clone/stores/landing-page";
import { COLOR_PRESETS } from "@shopify-clone/stores/landing-page";
import { Check, Palette, Type, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface ThemeEditorProps {
  theme: LandingPageTheme;
  onUpdateTheme: (updated: LandingPageTheme) => void;
}

export function ThemeEditor({ theme, onUpdateTheme }: ThemeEditorProps) {
  const currentPresetId = theme?.presetId || "modern-minimalist";
  const colors = theme?.colors || COLOR_PRESETS["modern-minimalist"].colors;
  const typography = theme?.typography || { headingFont: "display", bodyFont: "sans", scale: "md" };
  const animations = theme?.animations || { enabled: true, intensity: "medium" };

  const handleApplyPreset = (presetId: ColorPresetId) => {
    const preset = COLOR_PRESETS[presetId];
    if (!preset) return;
    onUpdateTheme({
      ...theme,
      presetId,
      colors: { ...preset.colors },
    });
  };

  const handleColorChange = (key: keyof ColorTokens, value: string) => {
    onUpdateTheme({
      ...theme,
      colors: {
        ...colors,
        [key]: value,
      },
    });
  };

  const handleTypographyChange = (key: string, value: unknown) => {
    onUpdateTheme({
      ...theme,
      typography: {
        ...typography,
        [key]: value,
      },
    });
  };

  const handleAnimationChange = (key: string, value: unknown) => {
    onUpdateTheme({
      ...theme,
      animations: {
        ...animations,
        [key]: value,
      },
    });
  };

  const colorFields: { key: keyof ColorTokens; label: string }[] = [
    { key: "background", label: "Page Background" },
    { key: "surface", label: "Card / Surface" },
    { key: "text", label: "Primary Text" },
    { key: "mutedText", label: "Secondary / Muted Text" },
    { key: "primary", label: "Accent / Primary" },
    { key: "secondary", label: "Secondary Accent" },
    { key: "border", label: "Border / Divider" },
    { key: "buttonText", label: "Primary Button Text" },
  ];

  return (
    <div className="p-5 space-y-6 text-foreground overflow-y-auto">
      {/* 1. Presets Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Curated Color Palettes
          </h3>
        </div>

        <div className="space-y-2.5">
          {(Object.entries(COLOR_PRESETS) as [ColorPresetId, typeof COLOR_PRESETS[ColorPresetId]][]).map(
            ([pId, pData]) => {
              const isSelected = currentPresetId === pId;
              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => handleApplyPreset(pId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                      : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-foreground">
                      {pData.name}
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                        <Check className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground mb-2.5 leading-snug">
                    {pData.description}
                  </p>

                  {/* Swatches preview */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-background/80 border border-border/50">
                    <div
                      className="w-5 h-5 rounded-md border border-border/40 shrink-0 shadow-xs"
                      style={{ backgroundColor: pData.colors.background }}
                      title="Background"
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-border/40 shrink-0 shadow-xs"
                      style={{ backgroundColor: pData.colors.surface }}
                      title="Surface"
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-border/40 shrink-0 shadow-xs"
                      style={{ backgroundColor: pData.colors.text }}
                      title="Text"
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-border/40 shrink-0 shadow-xs"
                      style={{ backgroundColor: pData.colors.primary }}
                      title="Primary Accent"
                    />
                    <div
                      className="w-5 h-5 rounded-md border border-border/40 shrink-0 shadow-xs"
                      style={{ backgroundColor: pData.colors.border }}
                      title="Border"
                    />
                  </div>
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* 2. Custom Color Tokens */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Custom Color Tokens
        </h3>

        <div className="space-y-2.5">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground font-medium truncate">
                {label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="color"
                  value={colors[key] || "#ffffff"}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-6 h-6 rounded-md border border-border cursor-pointer bg-transparent p-0"
                />
                <Input
                  value={colors[key] || ""}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="w-24 h-7 text-[11px] font-mono uppercase px-2"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Typography */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2 pb-1">
          <Type className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Typography System
          </h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Heading Font Pairing</label>
            <select
              value={typography.headingFont || "display"}
              onChange={(e) => handleTypographyChange("headingFont", e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground"
            >
              <option value="display">Display Grotesk (Modern Clean)</option>
              <option value="serif">Editorial Serif (Luxury Elegant)</option>
              <option value="sans">Geometric Sans (Neutral High-Density)</option>
              <option value="mono">Technical Monospace (Cyber / Precision)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Body Font</label>
              <select
                value={typography.bodyFont || "sans"}
                onChange={(e) => handleTypographyChange("bodyFont", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="sans">System Sans</option>
                <option value="mono">Clean Mono</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Type Scale</label>
              <select
                value={typography.scale || "md"}
                onChange={(e) => handleTypographyChange("scale", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="sm">Compact</option>
                <option value="md">Balanced</option>
                <option value="lg">Prominent</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Global Animation Behavior */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2 pb-1">
          <Wand2 className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Motion & Transitions
          </h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold">Enable Animations</span>
              <p className="text-[11px] text-muted-foreground">
                Smooth scroll triggers and section entrance motion
              </p>
            </div>
            <Switch
              checked={animations.enabled}
              onCheckedChange={(checked) => handleAnimationChange("enabled", checked)}
            />
          </div>

          {animations.enabled && (
            <div className="space-y-1">
              <label className="text-xs font-semibold">Global Intensity</label>
              <select
                value={animations.intensity || "medium"}
                onChange={(e) => handleAnimationChange("intensity", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2.5 text-foreground"
              >
                <option value="subtle">Subtle (Restrained, gentle fade)</option>
                <option value="medium">Medium (Standard balanced motion)</option>
                <option value="expressive">Expressive (Bold glide & scale)</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
