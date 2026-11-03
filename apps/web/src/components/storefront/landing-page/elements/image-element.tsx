"use client";

import React from "react";
import Link from "next/link";
import type { PageElement } from "@calcart/stores/landing-page";

interface ImageElementProps {
  element: PageElement;
  storeSlug: string;
  isPreview?: boolean;
}

export function ImageElement({ element, storeSlug, isPreview = false }: ImageElementProps) {
  const rawContent = (element.content || {}) as Record<string, unknown>;
  const content = rawContent as {
    imageUrl?: string;
    url?: string;
    alt?: string;
    aspectRatio?: "auto" | "1/1" | "4/3" | "16/9" | "21/9" | "portrait" | "16:9" | "4:3" | "1:1" | "21:9";
    fit?: "cover" | "contain";
    borderRadius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
    caption?: string;
    link?: string;
  };
  const style = element.style || {};

  const imageUrl =
    content.imageUrl ||
    content.url ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80";
  const alt = content.alt || "Storefront image";
  const fit = content.fit || "cover";
  const rawRatio = content.aspectRatio || "16/9";
  const ratio = rawRatio === "16:9" ? "16/9" : rawRatio === "4:3" ? "4/3" : rawRatio === "1:1" ? "1/1" : rawRatio === "21:9" ? "21/9" : rawRatio;
  const radius = content.borderRadius || style.borderRadius || "xl";

  const ratioClasses: Record<string, string> = {
    auto: "aspect-auto",
    "1/1": "aspect-square",
    "1:1": "aspect-square",
    "4/3": "aspect-[4/3]",
    "4:3": "aspect-[4/3]",
    "16/9": "aspect-video",
    "16:9": "aspect-video",
    "21/9": "aspect-[21/9]",
    "21:9": "aspect-[21/9]",
    portrait: "aspect-[3/4]",
  };

  const radiusClasses: Record<string, string> = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  };

  const alignClasses: Record<string, string> = {
    left: "mr-auto",
    center: "mx-auto",
    right: "ml-auto",
  };

  const imgComponent = (
    <div
      className={`relative overflow-hidden w-full ${ratioClasses[ratio] || ratioClasses["16/9"]} ${
        radiusClasses[radius] || radiusClasses.xl
      } shadow-md border border-border/40 group`}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={`w-full h-full object-${fit} transition-transform duration-500 group-hover:scale-[1.02]`}
        loading="lazy"
      />
    </div>
  );

  const rawLink = content.link;
  const href = rawLink
    ? rawLink.startsWith("http")
      ? rawLink
      : `/stores/${storeSlug}${rawLink.startsWith("/") ? rawLink : `/${rawLink}`}`
    : null;

  const textAlign = style.textAlign || "center";
  const alignClass = alignClasses[textAlign] || "mx-auto";

  return (
    <figure
      className={`w-full ${alignClass}`}
      style={{ maxWidth: style.maxWidth }}
    >
      {href && !isPreview ? (
        <Link href={href} className="block cursor-pointer">
          {imgComponent}
        </Link>
      ) : (
        imgComponent
      )}
      {content.caption && (
        <figcaption className="text-xs text-muted-foreground mt-2 text-center italic">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}
