"use client";

import React from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";
import { ArrowRight, ShoppingBag, Sparkles, ExternalLink } from "lucide-react";

interface ButtonElementProps {
  element: PageElement;
  storeSlug: string;
  isPreview?: boolean;
}

export function ButtonElement({ element, storeSlug, isPreview = false }: ButtonElementProps) {
  const rawContent = (element.content || {}) as Record<string, unknown>;
  const content = rawContent as {
    text?: string;
    label?: string;
    link?: string;
    variant?: "solid" | "outline" | "soft" | "ghost";
    shape?: "pill" | "rounded" | "sharp";
    size?: "sm" | "md" | "lg";
    icon?: "none" | "arrow" | "cart" | "sparkles" | "external";
    showArrow?: boolean;
    isFullWidth?: boolean;
    openInNewTab?: boolean;
  };
  const style = element.style || {};

  const text = content.text || content.label || "Click Here";
  const rawLink = content.link || "/products";
  const href = rawLink.startsWith("http")
    ? rawLink
    : rawLink.startsWith("/")
      ? `/stores/${storeSlug}${rawLink}`
      : `/stores/${storeSlug}/${rawLink}`;

  const variant = content.variant || "solid";
  const shape = content.shape || "rounded";
  const size = content.size || "md";
  const icon = content.icon || (content.showArrow === false ? "none" : "arrow");

  const sizeClasses: Record<string, string> = {
    sm: "px-3.5 py-1.5 text-xs font-medium gap-1.5",
    md: "px-5 py-2.5 text-sm font-semibold gap-2",
    lg: "px-7 py-3.5 text-base font-semibold gap-2.5",
  };

  const shapeClasses: Record<string, string> = {
    sharp: "rounded-none",
    rounded: "rounded-[var(--landing-btn-radius,0.75rem)]",
    pill: "rounded-full",
  };

  const variantClasses: Record<string, string> = {
    solid: "bg-primary text-primary-foreground hover:opacity-95 shadow-xs hover:shadow-md",
    outline: "border-2 border-primary text-primary hover:bg-primary/10 shadow-xs",
    soft: "bg-primary/15 text-primary hover:bg-primary/25",
    ghost: "text-primary hover:bg-primary/10",
  };

  const alignClasses: Record<string, string> = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  };

  const renderIcon = () => {
    switch (icon) {
      case "arrow":
        return <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />;
      case "cart":
        return <ShoppingBag className="w-4 h-4" />;
      case "sparkles":
        return <Sparkles className="w-4 h-4" />;
      case "external":
        return <ExternalLink className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const buttonClass = `group inline-flex items-center justify-center transition-all duration-200 active:scale-[0.98] select-none ${
    content.isFullWidth ? "w-full" : "w-auto"
  } ${sizeClasses[size] || sizeClasses.md} ${shapeClasses[shape] || shapeClasses.rounded} ${
    variantClasses[variant] || variantClasses.solid
  }`;

  const customStyle: React.CSSProperties = {
    backgroundColor: style.backgroundColor || undefined,
    color: style.color || undefined,
  };

  return (
    <div className={`flex w-full ${alignClasses[style.textAlign || "left"] || "justify-start"}`}>
      {isPreview ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={text}
          className={`${buttonClass} cursor-pointer`}
          style={customStyle}
          onClick={(e) => {
            // Prevent browser navigation; event continues bubbling to ElementRenderer for selection
            e.preventDefault();
          }}
        >
          <span>{text}</span>
          {renderIcon()}
        </span>
      ) : (
        <Link
          href={href}
          target={content.openInNewTab ? "_blank" : undefined}
          rel={content.openInNewTab ? "noopener noreferrer" : undefined}
          className={buttonClass}
          style={customStyle}
        >
          <span>{text}</span>
          {renderIcon()}
        </Link>
      )}
    </div>
  );
}
