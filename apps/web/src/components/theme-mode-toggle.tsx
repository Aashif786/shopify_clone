"use client";

import { Moon, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "calcart-theme";

type ThemeMode = "dark" | "light";

export function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const nextMode: ThemeMode = saved === "light" ? "light" : "dark";
    setMode(nextMode);
    document.documentElement.classList.toggle("light", nextMode === "light");
    document.documentElement.classList.toggle("dark", nextMode === "dark");
  }, []);

  function toggleMode() {
    const nextMode: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    document.documentElement.classList.toggle("light", nextMode === "light");
    document.documentElement.classList.toggle("dark", nextMode === "dark");
  }

  const isDark = mode === "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="theme-mode-toggle"
      onClick={toggleMode}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
    </Button>
  );
}
