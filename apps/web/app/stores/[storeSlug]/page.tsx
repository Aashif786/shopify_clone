"use client";

import Link from "next/link";
import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ProductSummaryDTO } from "@calcart/products";
import type { StorefrontLandingPageConfig } from "@calcart/stores/landing-page";
import { StorefrontShell } from "../../../src/components/storefront/StorefrontShell";
import { useOptionalStorefrontIdentity } from "../../../src/components/storefront/storefront-providers";
import { ProductCard } from "../../../src/components/storefront/products/product-card";
import { StorefrontLandingRenderer } from "../../../src/components/storefront/landing-page/storefront-landing-renderer";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";

interface StorefrontPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface StorefrontCatalogResponse {
  items: ProductSummaryDTO[];
  store: { id: string; name: string; slug: string; currency: string };
}

export default function StorefrontRootPage({ params }: StorefrontPageProps) {
  const { storeSlug } = use(params);
  const [store, setStore] = useState<StorefrontCatalogResponse["store"] | null>(null);
  const [products, setProducts] = useState<ProductSummaryDTO[]>([]);
  const [landingConfig, setLandingConfig] = useState<StorefrontLandingPageConfig | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catalogRes, landingRes] = await Promise.allSettled([
        apiClient.get<StorefrontCatalogResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
          { params: { limit: 16 } },
        ),
        apiClient.get<{ store: StorefrontCatalogResponse["store"]; config: StorefrontLandingPageConfig | null }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/landing-page`,
        ),
      ]);

      if (catalogRes.status === "fulfilled") {
        setStore(catalogRes.value.store);
        setProducts(catalogRes.value.items);
      } else {
        setError(catalogRes.reason instanceof Error ? catalogRes.reason : new Error("Unable to load storefront"));
      }

      if (landingRes.status === "fulfilled") {
        setLandingConfig(landingRes.value?.config || null);
      } else {
        setLandingConfig(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unable to load storefront"));
    } finally {
      setIsLoading(false);
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const identity = useOptionalStorefrontIdentity();
  const storeName = store?.name || identity?.storeName || "";
  const isNotFound = error instanceof ApiClientError && error.status === 404;

  const announcementText = useMemo(() => {
    if (landingConfig?.sections) {
      const promo = landingConfig.sections.find((s) => s.type === "promotional_banner" && s.isVisible);
      const pcfg = (promo?.config || {}) as { bannerText?: string; highlightCode?: string };
      if (pcfg.bannerText) {
        return pcfg.highlightCode
          ? `${pcfg.bannerText} • Code: ${pcfg.highlightCode}`
          : pcfg.bannerText;
      }
    }
    return undefined;
  }, [landingConfig]);

  if (isNotFound) {
    return (
      <StorefrontShell storeName="Store Not Found" storeSlug={storeSlug} navLinks={[]}>
        <div className="storefront-home-error max-w-lg mx-auto py-24 px-4 text-center space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Store unavailable</h1>
          <p className="text-muted-foreground text-sm">We couldn&apos;t find this storefront.</p>
          <div className="pt-2">
            <Link className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold" href="/">
              Return home
            </Link>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  return (
        <StorefrontShell
          storeName={store?.name || "Online Store"}
          storeSlug={storeSlug}
          announcement={announcementText}
          fullBleed={true}
          theme={landingConfig?.theme}
        >
        {isLoading ? (
          <div className="at-container py-16 sm:py-24" aria-hidden="true">
            <div className="at-skeleton h-3 w-32" />
            <div className="at-skeleton mt-6 h-24 w-3/4 max-w-3xl" />
            <div className="at-skeleton mt-10 aspect-[16/9] w-full" />
          </div>
        ) : landingConfig && landingConfig.sections && landingConfig.sections.length > 0 ? (
          <StorefrontLandingRenderer
            config={landingConfig}
            storeSlug={storeSlug}
            storeName={store?.name}
            storeCurrency={store?.currency}
            products={products}
          />
        ) : (
          <div className="pb-24">
            {/* 00 Cover: the store name is the headline; the lead product is the picture. */}
            <section className="storefront-hero at-container pt-10 sm:pt-16 lg:pt-20" aria-labelledby="storefront-hero-title">
              <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-12 lg:gap-14">
                <div className="storefront-hero-copy lg:col-span-7">
                  <p className="storefront-eyebrow at-eyebrow text-muted-foreground">New in the shop</p>
                  <h1 id="storefront-hero-title" className="at-display-xl mt-4 text-foreground">
                    {storeName}
                  </h1>
                  <div className="storefront-hero-actions mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <Link
                      className="ds-btn ds-btn-primary"
                      href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                    >
                      <span>Shop all products</span>
                      <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
                    </Link>
                    <Link
                      className="storefront-text-link at-link text-sm text-foreground"
                      href={`/stores/${encodeURIComponent(storeSlug)}/about`}
                    >
                      About {storeName}
                    </Link>
                  </div>
                </div>

                {products[0] && (
                  <Link
                    href={`/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(products[0].slug)}`}
                    className={`storefront-hero-art group lg:col-span-5 lg:block ${products[0].primaryMediaUrl ? "block" : "hidden"}`}
                    aria-label={`View ${products[0].title}`}
                  >
                    <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                      {products[0].primaryMediaUrl ? (
                        <img
                          src={products[0].primaryMediaUrl}
                          alt={products[0].primaryMediaAlt || products[0].title}
                          className="h-full w-full object-cover transition-transform duration-[600ms] ease-[var(--at-ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-end p-6">
                          <span className="at-display-md text-foreground/80">{products[0].title}</span>
                        </div>
                      )}
                    </div>
                    <p className="at-num mt-3 flex items-baseline justify-between text-xs text-muted-foreground">
                      <span className="text-foreground">{products[0].title}</span>
                      <span aria-hidden="true">↗</span>
                    </p>
                  </Link>
                )}
              </div>
            </section>

            {/* 01 The edit */}
            <section className="storefront-featured at-container mt-24 sm:mt-32" aria-labelledby="featured-title">
              <div className="storefront-section-heading flex items-end justify-between gap-6 border-b border-[color:var(--at-hairline)] pb-5">
                <div>
                  <span className="storefront-eyebrow at-eyebrow at-num text-muted-foreground">01 — The edit</span>
                  <h2 id="featured-title" className="at-display-md mt-2 text-foreground">
                    Latest products
                  </h2>
                </div>
                <Link
                  className="storefront-text-link at-link inline-flex items-center gap-1.5 text-sm text-foreground"
                  href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                >
                  <span>View all</span>
                  <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </div>

              {error ? (
                <div className="storefront-home-error py-16 text-center">
                  <p className="at-title text-xl text-foreground">Products are taking a moment.</p>
                  <button
                    className="mt-6 ds-btn ds-btn-outline"
                    onClick={fetchCatalog}
                  >
                    Try again
                  </button>
                </div>
              ) : products.length > 0 ? (
                <div className="storefront-featured-grid mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
                  {products.slice(0, 4).map((product) => (
                    <ProductCard
                      key={product.variantId ? `${product.id}-${product.variantId}` : product.id}
                      product={product}
                      storeSlug={storeSlug}
                      storeCurrency={store?.currency}
                    />
                  ))}
                </div>
              ) : (
                <div className="storefront-empty-featured py-20 text-center">
                  <p className="at-lede text-muted-foreground">Your first collection is coming soon.</p>
                </div>
              )}
            </section>

            {/* 02 Browse */}
            <section className="at-container mt-24 sm:mt-32" aria-label="Browse the store">
              <span className="at-eyebrow at-num text-muted-foreground">02 — Browse</span>
              <ul className="mt-4 border-t border-[color:var(--at-hairline)]">
                {[
                  { label: "Collections", href: `/stores/${encodeURIComponent(storeSlug)}/collections` },
                  { label: "Gift cards", href: `/stores/${encodeURIComponent(storeSlug)}/gift-cards` },
                  { label: "Track an order", href: `/stores/${encodeURIComponent(storeSlug)}/account/orders` },
                ].map((item) => (
                  <li key={item.href} className="border-b border-[color:var(--at-hairline)]">
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:py-8"
                    >
                      <span className="at-display-md text-foreground transition-transform duration-300 ease-[var(--at-ease-out)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-2">
                        {item.label}
                      </span>
                      <ArrowUpRight size={22} strokeWidth={1.25} className="text-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
        </StorefrontShell>
  );
}
