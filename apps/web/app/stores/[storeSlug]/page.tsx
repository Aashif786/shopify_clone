"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles, Star } from "lucide-react";
import type { ProductSummaryDTO } from "@shopify-clone/products";
import { StorefrontShell } from "../../../src/components/storefront/StorefrontShell";
import { ProductCard } from "../../../src/components/storefront/products/product-card";
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
  const [error, setError] = useState<Error | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await apiClient.get<StorefrontCatalogResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products`,
        { params: { limit: 8 } },
      );
      setStore(data.store);
      setProducts(data.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unable to load storefront"));
    }
  }, [storeSlug]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  const storeName = store?.name || "Your everyday, elevated";
  const isNotFound = error instanceof ApiClientError && error.status === 404;

  if (isNotFound) {
    return <StorefrontShell storeName="Store Not Found" storeSlug={storeSlug} navLinks={[]}><div className="storefront-home-error"><h1>Store unavailable</h1><p>We couldn&apos;t find this storefront.</p><a className="btn btn-primary btn-md" href="/">Return home</a></div></StorefrontShell>;
  }

  return (
    <CartProvider storeSlug={storeSlug}>
      <StorefrontShell storeName={store?.name || "Online Store"} storeSlug={storeSlug} announcement="Complimentary shipping on orders over $75">
        <section className="storefront-hero" aria-labelledby="storefront-hero-title">
          <div className="storefront-hero-copy">
            <span className="storefront-eyebrow"><Sparkles aria-hidden="true" /> Curated for the everyday</span>
            <h1 id="storefront-hero-title">{storeName}<br /><em>made memorable.</em></h1>
            <p>Thoughtful pieces, beautiful details, and a little more delight in every delivery.</p>
            <div className="storefront-hero-actions"><a className="btn btn-primary btn-lg" href={`/stores/${encodeURIComponent(storeSlug)}/products`}>Shop the collection <ArrowRight data-icon="inline-end" /></a><a className="storefront-text-link" href={`/stores/${encodeURIComponent(storeSlug)}/about`}>Our story <ArrowRight data-icon="inline-end" /></a></div>
            <div className="storefront-trust-row"><span><Check aria-hidden="true" /> Quality checked</span><span><Check aria-hidden="true" /> Secure checkout</span></div>
          </div>
          <div className="storefront-hero-art" aria-label="A futuristic product composition" role="img"><div className="storefront-art-orb" /><div className="storefront-art-card storefront-art-card-back">NEW<br /><strong>Seasonal<br />essentials</strong></div><div className="storefront-art-card storefront-art-card-front"><span>OBJECT 01</span><strong>Made<br />to last.</strong><small>Designed with intention</small></div><div className="storefront-art-stamp">EST.<br /><strong>2024</strong></div></div>
        </section>

        <section className="storefront-benefits" aria-label="Store benefits"><div><strong>01</strong><span>Considered design</span></div><div><strong>02</strong><span>Small-batch quality</span></div><div><strong>03</strong><span>Delivered with care</span></div></section>

        <section className="storefront-featured" aria-labelledby="featured-title">
          <div className="storefront-section-heading"><div><span className="storefront-eyebrow">The edit</span><h2 id="featured-title">Favourites, for good reason.</h2></div><a className="storefront-text-link" href={`/stores/${encodeURIComponent(storeSlug)}/products`}>View all <ArrowRight data-icon="inline-end" /></a></div>
          {error ? <div className="storefront-home-error"><h3>Products are taking a moment.</h3><button className="btn btn-outline btn-sm" onClick={fetchCatalog}>Try again</button></div> : products.length ? <div className="storefront-featured-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} storeSlug={storeSlug} storeCurrency={store?.currency} />)}</div> : <div className="storefront-empty-featured"><Star aria-hidden="true" /><p>Your first collection is coming soon.</p></div>}
        </section>

        <section className="storefront-quote"><div className="storefront-quote-stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“The kind of shop that makes you want to refresh your whole space.”</blockquote><span>— A happy customer</span></section>
      </StorefrontShell>
    </CartProvider>
  );
}
