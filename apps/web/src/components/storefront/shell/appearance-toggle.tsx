"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import type { StorefrontAppearance } from "@calcart/stores/landing-page";

export interface AppearanceToggleProps {
  appearance: StorefrontAppearance;
  onChange: (next: StorefrontAppearance) => void;
  className?: string;
}

/**
 * Light/dark switch shown only when the merchant enabled the storefront appearance
 * toggle. It is a real toggle button: its state is exposed with aria-pressed and the
 * accessible name states the action, not the current mode.
 */
export function AppearanceToggle({ appearance, onChange, className = "" }: AppearanceToggleProps) {
  const isDark = appearance === "dark";
  const next: StorefrontAppearance = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-pressed={isDark}
      aria-label={`Switch to ${next} appearance`}
      title={`Switch to ${next} appearance`}
      data-testid="storefront-appearance-toggle"
      className={`at-press inline-flex h-10 w-10 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {isDark ? (
        <Sun size={19} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Moon size={19} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
