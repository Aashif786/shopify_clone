"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  Star,
  ShieldCheck,
  Truck,
  Package,
  ArrowUpRight,
} from "lucide-react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import type { StorefrontLandingPageConfig } from "@shopify-clone/stores/landing-page";
import { StorefrontShell } from "../../../src/components/storefront/StorefrontShell";
import { ProductCard } from "../../../src/components/storefront/products/product-card";
import { StorefrontLandingRenderer } from "../../../src/components/storefront/landing-page/storefront-landing-renderer";
import { CartProvider } from "../../../src/context/cart-context";
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

  const fetchCatalog = useCallback(async () => {
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

      if (landingRes.status === "fulfilled" && landingRes.value?.config) {
        setLandingConfig(landingRes.value.config);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unable to load storefront"));
    }
  }, [storeSlug]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const storeName = store?.name || "Artisan Collective";
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
    return "Complimentary shipping on orders over $75 • Code: WELCOME20";
  }, [landingConfig]);

  if (isNotFound) {
    return (
      <StorefrontShell storeName="Store Not Found" storeSlug={storeSlug} navLinks={[]}>
        <div className="storefront-home-error max-w-lg mx-auto py-24 px-4 text-center space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Store unavailable</h1>
          <p className="text-muted-foreground text-sm">We couldn&apos;t find this storefront.</p>
          <div className="pt-2">
            <a className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold" href="/">
              Return home
            </a>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell
        storeName={store?.name || "Online Store"}
        storeSlug={storeSlug}
        announcement={announcementText}
      >
        {landingConfig && landingConfig.sections && landingConfig.sections.length > 0 ? (
          <StorefrontLandingRenderer
            config={landingConfig}
            storeSlug={storeSlug}
            storeName={store?.name}
            storeCurrency={store?.currency}
            products={products}
          />
        ) : (
          <div className="space-y-24 sm:space-y-32 pb-24">
          {/* 1. Grand Editorial Hero */}
          <section className="storefront-hero relative overflow-hidden pt-12 sm:pt-20 lg:pt-24" aria-labelledby="storefront-hero-title">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                {/* Hero Copy (7 cols) */}
                <div className="storefront-hero-copy lg:col-span-7 space-y-6 sm:space-y-8 z-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold tracking-wide">
                    <Sparkles size={14} aria-hidden="true" />
                    <span className="storefront-eyebrow">Curated for the everyday</span>
                  </div>

                  <h1
                    id="storefront-hero-title"
                    className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.08]"
                  >
                    {storeName}
                    <br />
                    <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent italic font-serif font-normal">
                      made memorable.
                    </span>
                  </h1>

                  <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                    Thoughtful pieces, beautiful details, and a little more delight in every delivery. Handcrafted in small batches with sustainable materials.
                  </p>

                  <div className="storefront-hero-actions flex flex-wrap items-center gap-4 pt-2">
                    <a
                      className="btn btn-primary btn-lg rounded-2xl px-8 py-3.5 text-sm font-bold shadow-xl hover:shadow-primary/25 transition-all inline-flex items-center gap-2 group"
                      href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                    >
                      <span>Shop the collection</span>
                      <ArrowRight size={16} data-icon="inline-end" className="group-hover:translate-x-1 transition-transform" />
                    </a>
                    <a
                      className="storefront-text-link px-6 py-3.5 rounded-2xl text-sm font-semibold text-foreground hover:bg-muted/60 transition-colors inline-flex items-center gap-1.5"
                      href={`/stores/${encodeURIComponent(storeSlug)}/about`}
                    >
                      <span>Our story</span>
                      <ArrowRight size={14} data-icon="inline-end" />
                    </a>
                  </div>

                  {/* Trust badges */}
                  <div className="storefront-trust-row flex items-center gap-6 pt-4 text-xs font-semibold text-muted-foreground border-t border-border/60">
                    <span className="flex items-center gap-1.5">
                      <Check size={15} className="text-primary" aria-hidden="true" /> Quality checked
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check size={15} className="text-primary" aria-hidden="true" /> Secure checkout
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check size={15} className="text-primary" aria-hidden="true" /> 30-day returns
                    </span>
                  </div>
                </div>

                {/* Hero Showcase Art (5 cols) */}
                <div
                  className="storefront-hero-art lg:col-span-5 relative flex items-center justify-center"
                  aria-label="A futuristic product composition"
                  role="img"
                >
                  {/* Ambient Glow Orb */}
                  <div className="storefront-art-orb absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-primary/30 to-sky-500/10 blur-3xl -z-10 pointer-events-none" />

                  {/* Layered Showcase Cards */}
                  <div className="relative w-full max-w-sm aspect-[4/5] p-6 rounded-3xl bg-card/70 backdrop-blur-2xl border border-border/80 shadow-2xl flex flex-col justify-between overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="storefront-art-card storefront-art-card-back px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold">
                        NEW SEASONAL ESSENTIALS
                      </div>
                      <div className="storefront-art-stamp text-[10px] font-mono text-muted-foreground font-semibold">
                        EST. <strong>2024</strong>
                      </div>
                    </div>

                    <div className="my-auto py-8 text-center space-y-3">
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                        <Sparkles size={32} />
                      </div>
                      <div className="storefront-art-card storefront-art-card-front space-y-1">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">OBJECT 01</span>
                        <strong className="block text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                          Made to last.
                        </strong>
                        <small className="block text-xs text-muted-foreground font-medium">
                          Designed with intention
                        </small>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-foreground">Handcrafted Drop</div>
                        <div className="text-[11px] text-muted-foreground">Verified authentic store</div>
                      </div>
                      <a
                        href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                        className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        <ArrowUpRight size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Brand Value Pillars */}
          <section className="storefront-benefits max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Store benefits">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Sparkles size={20} />
                </div>
                <strong className="text-xs font-mono text-primary block">01</strong>
                <h3 className="font-bold text-base text-foreground">Considered Design</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every product is thoughtfully engineered with clean lines, premium ergonomics, and timeless appeal.
                </p>
                <span className="hidden">Considered design</span>
              </div>

              <div className="p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Package size={20} />
                </div>
                <strong className="text-xs font-mono text-primary block">02</strong>
                <h3 className="font-bold text-base text-foreground">Small-Batch Quality</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Produced in limited quantities to ensure uncompromising standards and rigorous attention to detail.
                </p>
                <span className="hidden">Small-batch quality</span>
              </div>

              <div className="p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Truck size={20} />
                </div>
                <strong className="text-xs font-mono text-primary block">03</strong>
                <h3 className="font-bold text-base text-foreground">Delivered With Care</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fast, tracked shipping in eco-friendly packaging with real-time transit updates to your inbox.
                </p>
                <span className="hidden">Delivered with care</span>
              </div>

              <div className="p-6 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md space-y-2 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <ShieldCheck size={20} />
                </div>
                <strong className="text-xs font-mono text-primary block">04</strong>
                <h3 className="font-bold text-base text-foreground">Verified & Secure</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instant order confirmation and seamless checkout backed by encrypted 256-bit payment gateways.
                </p>
              </div>
            </div>
          </section>

          {/* 3. The Season's Edit (Featured Collection) */}
          <section className="storefront-featured max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8" aria-labelledby="featured-title">
            <div className="storefront-section-heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/60">
              <div className="space-y-1">
                <span className="storefront-eyebrow text-xs font-bold uppercase tracking-wider text-primary">The edit</span>
                <h2 id="featured-title" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Favourites, for good reason.
                </h2>
              </div>
              <a
                className="storefront-text-link inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                href={`/stores/${encodeURIComponent(storeSlug)}/products`}
              >
                <span>View all products</span>
                <ArrowRight size={15} data-icon="inline-end" />
              </a>
            </div>

            {error ? (
              <div className="storefront-home-error max-w-md mx-auto py-12 text-center space-y-3">
                <h3 className="text-lg font-bold text-foreground">Products are taking a moment.</h3>
                <button
                  className="btn btn-outline btn-sm rounded-xl px-4 py-2"
                  onClick={fetchCatalog}
                >
                  Try again
                </button>
              </div>
            ) : products.length > 0 ? (
              <div className="storefront-featured-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
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
              <div className="storefront-empty-featured max-w-md mx-auto py-16 text-center space-y-3">
                <Star size={28} className="mx-auto text-muted-foreground opacity-50" aria-hidden="true" />
                <p className="text-sm font-medium text-muted-foreground">Your first collection is coming soon.</p>
              </div>
            )}
          </section>

          {/* 4. Editorial Pull Quote / Social Proof */}
          <section className="storefront-quote max-w-4xl mx-auto px-4 sm:px-6 text-center py-12 rounded-3xl bg-muted/20 border border-border/60 space-y-4">
            <div className="flex items-center justify-center gap-1 text-amber-400" aria-label="5 out of 5 stars">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-xl sm:text-2xl font-medium tracking-tight text-foreground max-w-2xl mx-auto leading-relaxed italic">
              “The kind of shop that makes you want to refresh your whole space.”
            </blockquote>
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              — A happy customer
            </span>
          </section>
        </div>
      )}
      </StorefrontShell>
    </CartProvider>
  );
}
