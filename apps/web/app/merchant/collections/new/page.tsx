"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { CollectionForm } from "@/components/merchant/collections/collection-form";
import { useStore } from "@/context/store-context";

export default function NewCollectionPage() {
  const { activeStore } = useStore();

  if (!activeStore) {
    return (
      <MerchantShell>
        <div className="p-8 text-center text-xs text-muted-foreground">
          Please select or activate a store to create a collection.
        </div>
      </MerchantShell>
    );
  }

  return (
    <MerchantShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Navigation Breadcrumb & Header */}
        <div className="space-y-2 pb-4 border-b border-border">
          <Link
            href="/merchant/collections"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={12} />
            <span>Back to Collections</span>
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              <span>Create Collection</span>
            </h1>
          </div>
        </div>

        {/* Creation Form */}
        <CollectionForm
          storeId={activeStore.id}
          storeSlug={activeStore.slug}
        />
      </div>
    </MerchantShell>
  );
}
