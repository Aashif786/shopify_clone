import React from "react";
import { notFound } from "next/navigation";
import { StoreService } from "@calcart/stores";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import {
  GiftCardPurchaseView,
  type GiftCardDenomination,
} from "../../../../src/components/storefront/gift-cards/gift-card-purchase-view";
import { getDb } from "@/lib/db";

const storeService = new StoreService();

interface StoreGiftCardsPageProps {
  params: Promise<{ storeSlug: string }>;
}

const DEFAULT_DENOMINATIONS = [
  50000,   // 500
  100000,  // 1,000
  250000,  // 2,500
  500000,  // 5,000
];

export default async function StoreGiftCardsPage({ params }: StoreGiftCardsPageProps) {
  const { storeSlug } = await params;
  const db = getDb();

  let store;
  try {
    store = await storeService.getStoreBySlug(db, storeSlug);
  } catch {
    notFound();
  }

  if (store.status !== "ACTIVE") {
    notFound();
  }

  // Load existing variants if available
  const variantsRes = await db.query<{
    id: string;
    title: string;
    price: string | number;
    sku: string;
  }>(
    `SELECT pv.id, pv.title, pv.price, pv.sku
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
      WHERE pv.store_id = $1
        AND p.slug = 'digital-gift-card'
        AND pv.status = 'ACTIVE'
      ORDER BY pv.price ASC`,
    [store.id],
  );

  const denominations: GiftCardDenomination[] =
    variantsRes.rows.length > 0
      ? variantsRes.rows.map((r) => ({
          variantId: r.id,
          title: r.title,
          amount: Number(r.price),
          sku: r.sku,
        }))
      : DEFAULT_DENOMINATIONS.map((amount) => ({
          variantId: null,
          title: `${store.currency} ${(amount / 100).toLocaleString()}`,
          amount,
          sku: `GC-${amount}`,
        }));

  return (
    <StorefrontShell
      storeName={store.name}
      storeSlug={storeSlug}
    >
      <GiftCardPurchaseView
        storeSlug={storeSlug}
        storeName={store.name}
        currency={store.currency}
        denominations={denominations}
      />
    </StorefrontShell>
  );
}
