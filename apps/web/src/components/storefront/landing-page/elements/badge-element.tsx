"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";
import { Sparkles, Tag, Check, Flame, Shield, Award, Star } from "lucide-react";

interface BadgeElementProps {
  element: PageElement;
}

export function BadgeElement({ element }: BadgeElementProps) {
  const content = (element.content || {}) as {
    text?: string;
    icon?: "sparkles" | "tag" | "check" | "flame" | "shield" | "award" | "star" | "none";
    variant?: "default" | "outline" | "accent" | "subtle";
  };
  const style = element.style || {};

  const text = content.text || "Badge";
  const icon = content.icon || "sparkles";
  const variant = content.variant || "default";

  const variantClasses: Record<string, string> = {
    default: "bg-primary text-primary-foreground font-semibold",
    outline: "border border-primary/40 text-primary bg-primary/5",
    accent: "bg-secondary text-secondary-foreground font-semibold",
    subtle: "bg-muted text-foreground border border-border/60",
  };

  const renderIcon = () => {
    switch (icon) {
      case "sparkles":
        return <Sparkles className="w-3 h-3 text-primary animate-pulse" />;
      case "tag":
        return <Tag className="w-3 h-3" />;
      case "check":
        return <Check className="w-3 h-3 text-emerald-400" />;
      case "flame":
        return <Flame className="w-3 h-3 text-amber-500" />;
      case "shield":
        return <Shield className="w-3 h-3 text-sky-400" />;
      case "award":
        return <Award className="w-3 h-3 text-purple-400" />;
      case "star":
        return <Star className="w-3 h-3 text-amber-400 fill-amber-400" />;
      default:
        return null;
    }
  };

  const alignClasses: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  return (
    <div className={`flex w-full ${alignClasses[style.textAlign || "left"] || "justify-start"}`}>
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs tracking-wide transition-all ${
          variantClasses[variant] || variantClasses.default
        }`}
        style={{
          backgroundColor: style.backgroundColor || undefined,
          color: style.color || undefined,
        }}
      >
        {renderIcon()}
        <span>{text}</span>
      </span>
    </div>
  );
}
