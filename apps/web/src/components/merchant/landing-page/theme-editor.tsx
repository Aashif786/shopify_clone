"use client";

import React from "react";
import type {
  LandingPageTheme,
  ColorPresetId,
  ColorTokens,
  BackgroundConfig,
  TypographyTokens,
  ButtonTokens,
} from "@calcart/stores/landing-page";
import { COLOR_PRESETS } from "@calcart/stores/landing-page";
import { Check, Palette, Type, Wand2, Image as ImageIcon, MousePointerClick } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface ThemeEditorProps {
  theme: LandingPageTheme;
  onUpdateTheme: (updated: LandingPageTheme) => void;
}

const PRESET_BACKGROUND_IMAGES = [
  { label: "Dark Studio", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80" },
  { label: "Warm Linen", url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1920&q=80" },
  { label: "Slate Granite", url: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=1920&q=80" },
  { label: "Cyber Mesh", url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1920&q=80" },
];

const PRESET_GRADIENTS = [
  { label: "Radial Void", css: "radial-gradient(circle at 50% 0%, #1e2230 0%, #0d0e12 75%)" },
  { label: "Champagne Glow", css: "linear-gradient(135deg, #1f1b16 0%, #0f0e0c 100%)" },
  { label: "Cyber Cyan", css: "linear-gradient(180deg, #0f1c2e 0%, #090d16 100%)" },
  { label: "Rose Quartz", css: "linear-gradient(135deg, #26141c 0%, #0c0d14 100%)" },
];

export function ThemeEditor({ theme, onUpdateTheme }: ThemeEditorProps) {
  const currentPresetId = theme?.presetId || "modern-minimalist";
  const colors = theme?.colors || COLOR_PRESETS["modern-minimalist"].colors;
  const typography = theme?.typography || { headingFont: "display", bodyFont: "sans", scale: "md", headingWeight: "bold" };
  const animations = theme?.animations || { enabled: true, intensity: "medium" };
  const background = theme?.background || { type: "color", opacity: 100, size: "cover", position: "center" };
  const buttons = theme?.buttons || { shape: "rounded", variant: "solid", hoverEffect: "lift" };

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

  const handleBackgroundChange = (key: keyof BackgroundConfig, value: unknown) => {
    onUpdateTheme({
      ...theme,
      background: {
        ...background,
        [key]: value,
      },
    });
  };

  const handleTypographyChange = (key: keyof TypographyTokens, value: unknown) => {
    onUpdateTheme({
      ...theme,
      typography: {
        ...typography,
        [key]: value,
      },
    });
  };

  const handleButtonChange = (key: keyof ButtonTokens, value: unknown) => {
    onUpdateTheme({
      ...theme,
      buttons: {
        ...buttons,
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

      {/* 2. Global Background Customization */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2 pb-1">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Global Storefront Background
          </h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Background Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["color", "image", "gradient"] as const).map((bgType) => (
                <button
                  key={bgType}
                  type="button"
                  onClick={() => handleBackgroundChange("type", bgType)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md border capitalize transition-colors ${
                    background.type === bgType
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {bgType}
                </button>
              ))}
            </div>
          </div>

          {/* Solid Color Background */}
          {background.type === "color" && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-muted-foreground">Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={background.color || colors.background}
                  onChange={(e) => {
                    handleBackgroundChange("color", e.target.value);
                    handleColorChange("background", e.target.value);
                  }}
                  className="w-6 h-6 rounded-md border border-border cursor-pointer bg-transparent p-0"
                />
                <Input
                  value={background.color || colors.background}
                  onChange={(e) => {
                    handleBackgroundChange("color", e.target.value);
                    handleColorChange("background", e.target.value);
                  }}
                  className="w-24 h-7 text-[11px] font-mono uppercase px-2"
                />
              </div>
            </div>
          )}

          {/* Image Background */}
          {background.type === "image" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Image URL</label>
                <Input
                  value={background.imageUrl || ""}
                  onChange={(e) => handleBackgroundChange("imageUrl", e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Preset Background Suggestions */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Sample Textures</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_BACKGROUND_IMAGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleBackgroundChange("imageUrl", preset.url)}
                      className={`text-[11px] py-1 px-2 rounded-md border truncate text-left transition-all ${
                        background.imageUrl === preset.url
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">Image Opacity</span>
                  <span className="font-mono text-muted-foreground">{background.opacity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={background.opacity ?? 100}
                  onChange={(e) => handleBackgroundChange("opacity", Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                />
              </div>

              {/* Sizing & Positioning */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Scale Mode</label>
                  <select
                    value={background.size || "cover"}
                    onChange={(e) => handleBackgroundChange("size", e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                  >
                    <option value="cover">Cover (Full Bleed)</option>
                    <option value="contain">Contain (Fit)</option>
                    <option value="auto">Original Size</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Alignment</label>
                  <select
                    value={background.position || "center"}
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

              {/* Overlay Color & Opacity */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold">Color Overlay</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={background.overlayColor || "#000000"}
                      onChange={(e) => handleBackgroundChange("overlayColor", e.target.value)}
                      className="w-6 h-6 rounded-md border border-border cursor-pointer bg-transparent p-0"
                    />
                    <Input
                      value={background.overlayColor || "#000000"}
                      onChange={(e) => handleBackgroundChange("overlayColor", e.target.value)}
                      className="w-24 h-7 text-[11px] font-mono uppercase px-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Overlay Opacity</span>
                    <span className="font-mono text-muted-foreground">{background.overlayOpacity ?? 40}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={background.overlayOpacity ?? 40}
                    onChange={(e) => handleBackgroundChange("overlayOpacity", Number(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gradient Background */}
          {background.type === "gradient" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Curated Gradients</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESET_GRADIENTS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleBackgroundChange("gradient", preset.css)}
                      className={`text-[11px] py-1 px-2 rounded-md border truncate text-left transition-all ${
                        background.gradient === preset.css
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Custom CSS Gradient</label>
                <Input
                  value={background.gradient || ""}
                  onChange={(e) => handleBackgroundChange("gradient", e.target.value)}
                  placeholder="linear-gradient(...)"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Custom Color Tokens */}
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

      {/* 4. Typography */}
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
              <label className="text-xs font-semibold">Heading Weight</label>
              <select
                value={typography.headingWeight || "bold"}
                onChange={(e) => handleTypographyChange("headingWeight", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="normal">Normal (400)</option>
                <option value="medium">Medium (500)</option>
                <option value="semibold">Semibold (600)</option>
                <option value="bold">Bold (700)</option>
                <option value="extrabold">Extrabold (800)</option>
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
              <label className="text-xs font-semibold">Body Weight</label>
              <select
                value={typography.bodyWeight || "normal"}
                onChange={(e) => handleTypographyChange("bodyWeight", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="normal">Normal (400)</option>
                <option value="medium">Medium (500)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Button Styles */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center gap-2 pb-1">
          <MousePointerClick className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Button Appearance
          </h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Button Shape</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "pill", label: "Pill", radius: "rounded-full" },
                { id: "rounded", label: "Rounded", radius: "rounded-xl" },
                { id: "sharp", label: "Sharp", radius: "rounded-none" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleButtonChange("shape", s.id)}
                  className={`py-1.5 px-2 text-xs font-medium border transition-colors ${s.radius} ${
                    buttons.shape === s.id
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Button Variant</label>
              <select
                value={buttons.variant || "solid"}
                onChange={(e) => handleButtonChange("variant", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="solid">Solid Fill</option>
                <option value="outline">Border Outline</option>
                <option value="soft">Soft Tint</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Hover Effect</label>
              <select
                value={buttons.hoverEffect || "lift"}
                onChange={(e) => handleButtonChange("hoverEffect", e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
              >
                <option value="lift">Tactile Lift</option>
                <option value="glow">Ambient Glow</option>
                <option value="scale">Slight Scale</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Global Animation Behavior */}
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
