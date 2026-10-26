"use client";

import React from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Button, EmptyState } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { Plus, ExternalLink, ArrowRight, CheckCircle2, Info, Building2 } from "lucide-react";

export default function MerchantStoresPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/stores"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Store Switcher & Organizations"
      subtitle="Switch active merchant stores and inspect multi-tenant organization context"
      headerActions={
        <Link href="/merchant/stores/new" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <span>Create Store</span>
        </Link>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold">Your Merchant Stores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select an active store to scope all products, orders, and promotions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/merchant/stores/new" className="btn btn-primary btn-sm inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Store</span>
                </Link>
                <Badge variant="success" size="sm">
                  Active Store Switching
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {stores.length === 0 ? (
                <EmptyState
                  title="No Stores Found"
                  description="You do not have any merchant stores yet. Create your first store to set up products, inventory, and promotions."
                  action={
                    <Link href="/merchant/stores/new" className="btn btn-primary btn-md inline-flex items-center gap-1.5">
                      <Plus className="w-4 h-4" />
                      <span>Create Store</span>
                    </Link>
                  }
                />
              ) : (
                stores.map((store) => {
                  const isActive = activeStore?.id === store.id;
                  return (
                    <div
                      key={store.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-3 ${
                        isActive
                          ? "border-primary/60 bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground border border-border/50"
                          }`}
                        >
                          <span className="store-glyph" aria-hidden="true">
                            {store.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm">
                              {store.name}
                            </span>
                            {isActive && (
                              <Badge variant="success" size="sm">
                                Active Store
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <span>Slug:</span>
                            <code className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono text-foreground font-medium">
                              {store.slug}
                            </code>
                            <span>&bull;</span>
                            <span>Role:</span>
                            <strong className="text-foreground uppercase text-[11px]">
                              {store.role ? store.role.toUpperCase() : "OWNER"}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 items-center self-end sm:self-auto">
                        {!isActive ? (
                          <Button size="sm" variant="outline" onClick={() => selectStore(store.id)} className="h-8 text-xs gap-1">
                            <span>Switch to this Store</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        ) : (
                          <a
                            href={`/stores/${encodeURIComponent(store.slug)}/products`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm h-8 text-xs inline-flex items-center gap-1.5"
                          >
                            <span>View Storefront</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organization Architecture & Multi-Tenancy Details */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-semibold">Organization &amp; Multi-Tenancy Architecture</CardTitle>
              </div>
              <Badge variant="info" size="sm">Hierarchy Spec</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Domain relationship: <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">Organization &rarr; Stores &rarr; Store Members &rarr; Store Data</code>
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p className="m-0">
              Each store is owned by an <strong className="text-foreground">Organization</strong> in PostgreSQL. When a merchant creates a store, the backend
              automatically provisions or associates the organization and grants the creator <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">owner</code> status.
            </p>

            <div className="p-3.5 bg-muted/40 rounded-lg border border-border/50 space-y-2.5">
              <strong className="text-foreground text-xs block font-semibold">Architecture Status:</strong>
              <ul className="space-y-2 m-0 p-0 list-none">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div><strong className="text-foreground">Store Lifecycle APIs:</strong> <code className="text-[11px] font-mono">/api/v1/stores</code> (creation, listing, update, activate, suspend, archive) are fully operational.</div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div><strong className="text-foreground">Store Membership APIs:</strong> <code className="text-[11px] font-mono">/api/v1/stores/[storeId]/members</code> supports adding staff, role updates, and member removal.</div>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <div><strong className="text-foreground">Organization Administration APIs:</strong> Dedicated HTTP routes for organization-level governance are fully scoped to PostgreSQL tenant boundaries.</div>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
