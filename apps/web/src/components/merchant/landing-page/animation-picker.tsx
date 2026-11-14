"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  RotateCcw,
  Search,
  Eye,
  Sliders,
  X,
  VolumeX,
} from "lucide-react";
import {
  ENTRANCE_PRESET_GROUPS,
  ENTRANCE_PRESET_MAP,
  type EntrancePresetOption,
} from "@/components/storefront/landing-page/motion-presets";
import {
  getElementMotion,
  getSectionMotion,
  type Intensity,
} from "@/components/storefront/landing-page/motion";

interface AnimationPickerProps {
  preset: string;
  duration?: number;
  delay?: number;
  intensity?: Intensity;
  showIntensity?: boolean;
  allowStagger?: boolean;
  onChange: (updates: {
    preset?: string;
    duration?: number;
    delay?: number;
    intensity?: Intensity;
  }) => void;
}

export function AnimationPicker({
  preset = "none",
  duration = 0.4,
  delay = 0,
  intensity = "medium",
  showIntensity = false,
  allowStagger = false,
  onChange,
}: AnimationPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [previewKey, setPreviewKey] = useState(0);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  const reducedMotion = useReducedMotion();

  const activePreset = hoveredPreset || preset || "none";

  // Replay preview whenever active preset, duration, or delay changes
  const replay = () => setPreviewKey((k) => k + 1);

  useEffect(() => {
    replay();
  }, [preset, duration, delay, hoveredPreset]);

  const categories = useMemo(() => {
    return [
      { id: "all", label: "All" },
      { id: "fade", label: "Fade" },
      { id: "slide", label: "Slide" },
      { id: "zoom", label: "Zoom & Pop" },
      { id: "rotate", label: "Flip & Rotate" },
      { id: "dynamic", label: "Dynamics" },
      { id: "focus", label: "Focus & Blur" },
      { id: "reveal", label: "Reveal" },
    ];
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allOptions: EntrancePresetOption[] = [];

    for (const group of ENTRANCE_PRESET_GROUPS) {
      for (const opt of group.options) {
        const matchesCategory =
          activeCategory === "all" || opt.category === activeCategory;
        const matchesSearch =
          !q ||
          opt.label.toLowerCase().includes(q) ||
          opt.value.toLowerCase().includes(q) ||
          opt.description.toLowerCase().includes(q) ||
          (opt.tags && opt.tags.some((t) => t.toLowerCase().includes(q)));

        if (matchesCategory && matchesSearch) {
          allOptions.push(opt);
        }
      }
    }
    return allOptions;
  }, [search, activeCategory]);

  // Compute motion props for the live preview box
  const previewMotion = useMemo(() => {
    if (activePreset === "none") return null;
    if (activePreset === "stagger") {
      return getSectionMotion({
        preset: "stagger",
        intensity,
        enabled: true,
        reduced: false, // Force show in preview even if reduced motion is enabled
        hasElements: false,
        isPreview: true,
      })?.props;
    }

    return getElementMotion({
      animation: {
        preset: activePreset as never,
        duration,
        delay: 0, // No delay in instant preview so user sees it right away
      },
      enabled: true,
      reduced: false,
      joinStagger: false,
      intensity,
      isPreview: true,
    });
  }, [activePreset, duration, intensity]);

  const currentOption = ENTRANCE_PRESET_MAP[activePreset];

  return (
    <div className="space-y-4">
      {/* 1. Interactive Live Preview Stage */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Live Motion Preview
          </span>
          <button
            type="button"
            onClick={replay}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            title="Replay entrance motion"
          >
            <RotateCcw className="w-3 h-3" />
            Replay
          </button>
        </div>

        {/* Stage Container */}
        <div className="relative h-28 rounded-xl border border-dashed border-border/80 bg-background/80 flex items-center justify-center overflow-hidden p-4">
          {activePreset === "none" ? (
            <div className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground block">Static Mount</span>
              No animation applied (element appears immediately)
            </div>
          ) : (
            <motion.div
              key={`${activePreset}-${previewKey}`}
              initial={previewMotion?.initial}
              animate={previewMotion?.whileInView}
              transition={previewMotion?.transition}
              variants={previewMotion?.variants}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md flex items-center gap-2 select-none"
            >
              <Sparkles className="w-4 h-4 text-primary-foreground/90 shrink-0" />
              <span>{currentOption?.label || activePreset}</span>
            </motion.div>
          )}

          {reducedMotion && (
            <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-sm">
              <VolumeX className="w-3 h-3" /> Reduced Motion Preferred
            </div>
          )}
        </div>

        {/* Current Selection Caption */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>
            Selected:{" "}
            <strong className="text-foreground font-semibold">
              {activePreset === "none"
                ? "None"
                : activePreset === "stagger"
                ? "Stagger Cascade"
                : currentOption?.label || activePreset}
            </strong>
          </span>
          <span>
            {duration}s duration • {delay}s delay
          </span>
        </div>
      </div>

      {/* 2. Timing Controls */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            Timing &amp; Intensity
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Duration</label>
            <select
              value={duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value={0.25}>0.25s (Fast / Snappy)</option>
              <option value={0.4}>0.4s (Balanced Default)</option>
              <option value={0.6}>0.6s (Cinematic)</option>
              <option value={0.8}>0.8s (Deliberate)</option>
              <option value={1.2}>1.2s (Dramatic)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Delay</label>
            <select
              value={delay}
              onChange={(e) => onChange({ delay: Number(e.target.value) })}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value={0}>0s (Instant Start)</option>
              <option value={0.1}>0.1s</option>
              <option value={0.2}>0.2s</option>
              <option value={0.3}>0.3s</option>
              <option value={0.5}>0.5s</option>
              <option value={0.8}>0.8s</option>
              <option value={1.0}>1.0s</option>
            </select>
          </div>
        </div>

        {showIntensity && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground">Motion Intensity</label>
            <select
              value={intensity}
              onChange={(e) =>
                onChange({
                  intensity: e.target.value as Intensity,
                })
              }
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
            >
              <option value="subtle">Subtle (Restrained 16px displacement)</option>
              <option value="medium">Medium (Standard 24px displacement)</option>
              <option value="expressive">Expressive (Bold 36px displacement &amp; spring)</option>
            </select>
          </div>
        )}
      </div>

      {/* 3. Animation Preset Library */}
      <div className="p-3.5 rounded-2xl border border-border/70 bg-card/40 space-y-3">
        <span className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
          Animation Presets
        </span>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search animations (e.g. bounce, slide, blur)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Preset Cards List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {/* Default Option: None */}
          <button
            type="button"
            onClick={() => onChange({ preset: "none" })}
            onMouseEnter={() => setHoveredPreset("none")}
            onMouseLeave={() => setHoveredPreset(null)}
            className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
              preset === "none"
                ? "border-primary bg-primary/10 text-primary font-bold"
                : "border-border/60 bg-background hover:bg-muted/50 text-foreground"
            }`}
          >
            <div>
              <span className="font-semibold block">None (Static Mount)</span>
              <span className="text-[10px] text-muted-foreground">Appears immediately without motion</span>
            </div>
          </button>

          {/* Stagger Option (if allowed for section) */}
          {allowStagger && (
            <button
              type="button"
              onClick={() => onChange({ preset: "stagger" })}
              onMouseEnter={() => setHoveredPreset("stagger")}
              onMouseLeave={() => setHoveredPreset(null)}
              className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                preset === "stagger"
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border/60 bg-background hover:bg-muted/50 text-foreground"
              }`}
            >
              <div>
                <span className="font-semibold block">Stagger (Cascading Sequence)</span>
                <span className="text-[10px] text-muted-foreground">Orchestrates children sequentially</span>
              </div>
            </button>
          )}

          {/* Categorized Options */}
          {filteredOptions.map((opt) => {
            const isSelected = preset === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ preset: opt.value })}
                onMouseEnter={() => setHoveredPreset(opt.value)}
                onMouseLeave={() => setHoveredPreset(null)}
                className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/30"
                    : "border-border/60 bg-background hover:bg-muted/50 text-foreground"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block line-clamp-1">
                    {opt.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
