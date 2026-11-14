"use client";

import React, { useEffect } from "react";
import { getGoogleFontsUrl } from "@/lib/font-library";

interface FontLoaderProps {
  fonts: Array<string | null | undefined>;
}

/**
 * Ensures Google Fonts selected for the landing page or storefront are loaded
 * by injecting stylesheet links into document.head and rendering link tags.
 */
export function FontLoader({ fonts }: FontLoaderProps) {
  const url = getGoogleFontsUrl(fonts);

  useEffect(() => {
    if (!url) return;
    const linkId = "calcart-dynamic-fonts";
    let existing = document.getElementById(linkId) as HTMLLinkElement | null;
    if (existing) {
      if (existing.href !== url) {
        existing.href = url;
      }
    } else {
      existing = document.createElement("link");
      existing.id = linkId;
      existing.rel = "stylesheet";
      existing.href = url;
      document.head.appendChild(existing);
    }
  }, [url]);

  if (!url) return null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={url} data-calcart-font-loader="true" />
    </>
  );
}
