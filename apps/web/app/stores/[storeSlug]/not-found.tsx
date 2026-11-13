"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StorefrontThemeScope } from "../../../src/components/storefront/storefront-theme-root";

export default function StorefrontNotFound() {
  const params = useParams<{ storeSlug?: string }>();
  const slug = params?.storeSlug;
  const home = slug ? `/stores/${slug}` : "/";
  const products = slug ? `/stores/${slug}/products` : "/";

  return (
    <StorefrontThemeScope as="main" storeSlug={slug} className="flex min-h-[100dvh] items-center">
      <div className="at-container py-24">
        <p className="at-eyebrow">404</p>
        <h1 className="at-display-xl mt-4 max-w-3xl">Nothing here.</h1>
        <p className="at-lede mt-6">
          The page may have moved, or the product may no longer be available.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href={products}
            className="at-press inline-flex h-12 items-center bg-foreground px-7 text-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Browse products
          </Link>
          <Link href={home} className="at-link text-sm text-foreground">
            Back to the store
          </Link>
        </div>
      </div>
    </StorefrontThemeScope>
  );
}
