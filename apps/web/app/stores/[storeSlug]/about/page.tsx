import React from "react";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";

interface StoreAboutPageProps {
  params: Promise<{ storeSlug: string }>;
}

export default async function StoreAboutPage({ params }: StoreAboutPageProps) {
  const { storeSlug } = await params;

  return (
    <StorefrontShell
      storeName="Storefront"
      storeSlug={storeSlug}
    >
      <div style={{ maxWidth: "720px", margin: "var(--space-12) auto", padding: "0 var(--space-4)" }}>
        <h1 style={{ fontSize: "var(--font-size-3xl)", marginBottom: "var(--space-4)" }}>
          About Our Store
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-md)", lineHeight: 1.6 }}>
          Welcome to our online store! We are dedicated to providing the highest quality handcrafted products,
          fast and secure checkout, and exceptional customer satisfaction.
        </p>
        <div style={{ marginTop: "var(--space-8)" }}>
          <a
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-md"
          >
            ← Browse Products Catalog
          </a>
        </div>
      </div>
    </StorefrontShell>
  );
}
