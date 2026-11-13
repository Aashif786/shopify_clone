"use client";

import React, { useId, useMemo } from "react";
import {
  DESIGN_THEMES,
  DESIGN_THEME_IDS,
  applyAppearanceToTheme,
  applyDesignThemeToTheme,
  getDefaultAppearance,
  getPaletteColors,
  normalizeDesignThemeId,
  resolveDesignThemeTokens,
  resolveThemeSemanticTokens,
  type DesignThemeDefinition,
  type DesignThemeId,
  type LandingPageTheme,
  type StorefrontAppearance,
} from "@calcart/stores/landing-page";
import "../../storefront/design-themes.css";
import { designThemeFontClassName } from "../../../lib/design-theme-fonts";
import { Check, LayoutTemplate, SunMoon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface DesignThemeSelectorProps {
  theme: LandingPageTheme;
  onUpdateTheme: (updated: LandingPageTheme) => void;
}

/**
 * A miniature storefront drawn from the theme's own tokens (the same custom properties
 * and `ds-*` primitives the published storefront uses), so what the merchant sees here is
 * what each theme actually looks like: type, corner shape, borders, shadows, imagery
 * ratio and button treatment.
 */
export function DesignThemePreview({
  definition,
  theme,
  appearance,
}: {
  definition: DesignThemeDefinition;
  theme: LandingPageTheme;
  appearance: StorefrontAppearance;
}) {
  const resolved = useMemo(() => resolveDesignThemeTokens(definition.id), [definition.id]);
  const style = useMemo(() => {
    // Show each theme in its recommended palette; Rustic Heritage keeps the merchant's own.
    const presetId = definition.recommendedPalette ?? theme.presetId;
    const preview: LandingPageTheme = {
      ...theme,
      designTheme: definition.id,
      presetId,
      mode: appearance,
      colors: getPaletteColors(presetId, appearance),
    };
    return {
      ...resolved.cssVars,
      ...resolveThemeSemanticTokens(preview).cssVars,
    } as React.CSSProperties;
  }, [definition, theme, appearance, resolved]);

  const isCustom = definition.id !== "rustic-heritage";
  const tile = (key: string) => (
    <div
      key={key}
      className="min-w-0 flex-1"
      style={{
        padding: "var(--ds-card-padding)",
        background: "var(--ds-card-bg)",
        border: "var(--ds-border-width) solid var(--ds-card-border)",
        borderRadius: "var(--ds-radius-card)",
        boxShadow: "var(--ds-card-shadow)",
        textAlign: "var(--ds-text-align-card)" as React.CSSProperties["textAlign"],
      }}
    >
      <div
        className="ds-media w-full"
        style={{
          aspectRatio: "var(--ds-media-ratio)",
          borderRadius: "var(--ds-radius-media)",
          background: "color-mix(in srgb, var(--foreground) 12%, var(--background))",
          maxHeight: 64,
        }}
      />
      <div
        style={{
          marginTop: 6,
          height: 4,
          width: "70%",
          borderRadius: 2,
          background: "var(--foreground)",
          marginInline: definition.id === "luxury-editorial" ? "auto" : 0,
        }}
      />
      <div
        style={{
          marginTop: 3,
          height: 3,
          width: "35%",
          borderRadius: 2,
          background: "var(--muted-foreground, var(--foreground))",
          opacity: 0.6,
          marginInline: definition.id === "luxury-editorial" ? "auto" : 0,
        }}
      />
    </div>
  );

  return (
    <div
      aria-hidden="true"
      className={`${designThemeFontClassName} overflow-hidden rounded-md border border-border`}
      style={{ ...style, background: "var(--background)", color: "var(--foreground)" }}
      {...resolved.dataAttributes}
      data-ds-custom={isCustom ? "true" : undefined}
    >
      <div
        className="flex items-center justify-between px-3"
        style={{ height: 26, borderBottom: "var(--ds-header-border)" }}
      >
        <span
          style={{
            fontFamily: "var(--ds-font-heading)",
            fontWeight: "var(--ds-heading-weight)" as React.CSSProperties["fontWeight"],
            letterSpacing: "var(--ds-brand-tracking)",
            textTransform: "var(--ds-brand-transform)" as React.CSSProperties["textTransform"],
            fontSize: 11,
            lineHeight: 1,
          }}
        >
          Atelier
        </span>
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14, height: 2, background: "var(--foreground)", opacity: 0.45 }} />
          ))}
        </span>
      </div>

      <div className="px-3 pt-3">
        <div
          style={{
            fontFamily: "var(--ds-font-heading)",
            fontWeight: "var(--ds-heading-weight)" as React.CSSProperties["fontWeight"],
            fontStyle: "var(--ds-heading-style)" as React.CSSProperties["fontStyle"],
            letterSpacing: "var(--ds-heading-tracking)",
            fontSize: 20,
            lineHeight: 1.05,
          }}
        >
          Made to be loved
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--ds-font-body)",
            fontSize: 8,
            letterSpacing: "var(--ds-eyebrow-tracking)",
            textTransform: "var(--ds-eyebrow-transform)" as React.CSSProperties["textTransform"],
            opacity: 0.6,
          }}
        >
          New season
        </div>
      </div>

      <div className="flex gap-2 px-3 pt-2.5">{[tile("a"), tile("b")]}</div>

      <div className="px-3 pb-3 pt-2.5">
        <span
          className="ds-btn ds-btn-primary"
          style={{ minHeight: 22, paddingInline: 12, fontSize: 8, gap: 4 }}
        >
          Shop now
        </span>
      </div>
    </div>
  );
}

export function DesignThemeSelector({ theme, onUpdateTheme }: DesignThemeSelectorProps) {
  const groupName = useId();
  const active = normalizeDesignThemeId(theme?.designTheme);
  const appearance = getDefaultAppearance(theme);

  return (
    <fieldset className="space-y-3 pb-5 border-b border-border min-w-0">
      <legend className="sr-only">Storefront design theme</legend>
      <div className="flex items-center gap-2">
        <LayoutTemplate className="w-4 h-4 text-primary" aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Design theme</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        A complete visual system: typography, shapes, buttons, product cards, navigation and spacing.
        Switching themes never changes your sections, products, text or images.
      </p>

      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Design theme">
        {DESIGN_THEME_IDS.map((id: DesignThemeId) => {
          const definition = DESIGN_THEMES[id];
          const selected = active === id;
          const inputId = `${groupName}-${id}`;
          return (
            <label
              key={id}
              htmlFor={inputId}
              className={`block cursor-pointer rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-primary ${
                selected ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border hover:border-foreground/40"
              }`}
              data-testid={`design-theme-option-${id}`}
            >
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={id}
                checked={selected}
                onChange={() => onUpdateTheme(applyDesignThemeToTheme(theme, id))}
                className="sr-only"
              />
              <div className="mb-2.5">
                <DesignThemePreview definition={definition} theme={theme} appearance={appearance} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">{definition.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{definition.tagline}</span>
                </div>
                {selected && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary">
                    <Check className="w-3 h-3" aria-hidden="true" />
                    <span>Selected</span>
                  </span>
                )}
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-0.5 text-[11px] text-muted-foreground list-disc pl-4">
                {definition.preview.differences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Appearance is independent of the design theme: the merchant picks the default look
 * and decides whether visitors get a light/dark toggle.
 */
export function AppearanceSettings({ theme, onUpdateTheme }: DesignThemeSelectorProps) {
  const toggleId = useId();
  const groupName = useId();
  const enabled = theme?.appearanceToggle === true;
  const appearance = getDefaultAppearance(theme);

  return (
    <section className="space-y-3 pb-5 border-b border-border" aria-labelledby={`${toggleId}-title`}>
      <div className="flex items-center gap-2">
        <SunMoon className="w-4 h-4 text-primary" aria-hidden="true" />
        <h3 id={`${toggleId}-title`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Appearance
        </h3>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={toggleId} className="block text-xs font-semibold text-foreground cursor-pointer">
            Enable storefront appearance toggle
          </label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Shows a light/dark switch on your storefront. Visitors start in their system preference and
            their choice is remembered in their browser. When off, no switch is shown and the default below is used.
          </p>
        </div>
        <Switch
          id={toggleId}
          checked={enabled}
          onCheckedChange={(checked: boolean) => onUpdateTheme({ ...theme, appearanceToggle: checked })}
          aria-label="Enable storefront appearance toggle"
          data-testid="appearance-toggle-setting"
        />
      </div>

      <fieldset className="min-w-0">
        <legend className="text-[11px] font-semibold text-foreground mb-1.5">Default appearance</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Default appearance">
          {(["light", "dark"] as const).map((value) => {
            const id = `${groupName}-${value}`;
            const selected = appearance === value;
            return (
              <label
                key={value}
                htmlFor={id}
                className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors focus-within:ring-2 focus-within:ring-primary ${
                  selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={groupName}
                  value={value}
                  checked={selected}
                  onChange={() => onUpdateTheme(applyAppearanceToTheme(theme, value))}
                  className="sr-only"
                />
                {value}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
