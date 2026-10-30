"use client";

import React from "react";
import type { StorefrontLandingSectionProps } from "../types";
import { SectionElementsLayout } from "../elements/section-elements-layout";

export function CustomContainerSection({
  section,
  storeSlug,
  storeName,
  storeCurrency = "USD",
  products = [],
  collections = [],
  isPreview = false,
  theme,
}: StorefrontLandingSectionProps) {
  return (
    <SectionElementsLayout
      section={section}
      storeSlug={storeSlug}
      storeName={storeName}
      storeCurrency={storeCurrency}
      products={products}
      collections={collections}
      isPreview={isPreview}
      theme={theme}
    />
  );
}
