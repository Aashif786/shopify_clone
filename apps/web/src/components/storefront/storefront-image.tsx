"use client";

import React, { useEffect, useState, type ReactNode } from "react";

export interface StorefrontImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Rendered instead of the image if it fails to load (blocked, 404, offline). */
  fallback: ReactNode;
}

/**
 * A plain <img> that swaps to a fallback when the browser cannot load it, so a broken
 * or blocked image never leaves bare alt text on the page. The surrounding container
 * owns the aspect ratio, so swapping causes no layout shift. It never substitutes a
 * generated or remote placeholder for a real merchant image.
 */
export function StorefrontImage({
  src,
  alt,
  className,
  loading = "lazy",
  fallback,
}: StorefrontImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // A new src gets a fresh chance to load.
  useEffect(() => {
    setFailedSrc((current) => (current === src ? current : null));
  }, [src]);

  if (failedSrc === src) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailedSrc(src)}
    />
  );
}
