"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type ThemeMode = "light" | "dark";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Determine initial theme from html class or localStorage
    const isLight = document.documentElement.classList.contains("light");
    const stored = localStorage.getItem("calcart-platform-theme");
    const initial: ThemeMode = stored === "light" || isLight ? "light" : "dark";
    setTheme(initial);
    setMounted(true);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode }>;
      if (customEvent.detail?.theme) {
        setTheme(customEvent.detail.theme);
      }
    };

    window.addEventListener("calcart-platform-theme-change", handleThemeChange);
    return () => {
      window.removeEventListener("calcart-platform-theme-change", handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);

    try {
      localStorage.setItem("calcart-platform-theme", next);
    } catch {
      // Ignore storage errors in restricted contexts
    }

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    document.documentElement.setAttribute("data-theme", next);

    window.dispatchEvent(
      new CustomEvent("calcart-platform-theme-change", { detail: { theme: next } })
    );
  };

  // Keyboard shortcut: Ctrl + Shift + D / Meta + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [theme]);

  if (!mounted) {
    return (
      <div
        className={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 opacity-60 ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Mode (Ctrl+Shift+D)" : "Switch to Dark Mode (Ctrl+Shift+D)"}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={`group relative flex items-center justify-center gap-2 p-2 rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isDark
          ? "bg-white/5 hover:bg-white/10 text-amber-400 hover:text-amber-300 border border-white/10 hover:border-white/20"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-xs"
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 transition-transform duration-300 group-hover:rotate-45 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 transition-transform duration-300 group-hover:-rotate-12 text-slate-700" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-medium font-sans">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}
