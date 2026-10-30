"use client";

import React from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Button, EmptyState } from "@calcart/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { Plus, ExternalLink, ArrowRight, CheckCircle2, Info, Building2, Settings } from "lucide-react";

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
        <Link href="/merchant/stores/new" className="btn btn-primary btn-sm inline-flex items-center gap-1.5 h-8 text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />
          <span>Create Store</span>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Stores List Card */}
        <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Your Merchant Stores</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select an active store to scope all catalog products, orders, inventory, and promotions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
                  {stores.length} {stores.length === 1 ? "store" : "stores"}
                </Badge>
                <Link href="/merchant/stores/new" className="btn btn-primary btn-sm inline-flex items-center gap-1.5 h-7 text-xs font-semibold">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Store</span>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-4">
            <div className="space-y-2.5">
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
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-3 ${
                        isActive
                          ? "border-primary/60 bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card hover:border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground border border-border/50"
                          }`}
                        >
                          <span className="store-glyph" aria-hidden="true">
                            {store.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {store.name}
                            </span>
                            {isActive ? (
                              <Badge variant="success" size="sm" className="text-[10px] font-semibold">
                                Active Store
                              </Badge>
                            ) : (
                              store.status && (
                                <Badge variant="neutral" size="sm" className="text-[10px] font-semibold uppercase">
                                  {store.status}
                                </Badge>
                              )
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <span>Slug:</span>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-foreground font-medium">
                                {store.slug}
                              </code>
                            </span>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <span>Role:</span>
                              <strong className="text-foreground uppercase text-[11px]">
                                {store.role ? store.role.toUpperCase() : "OWNER"}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 items-center shrink-0 self-end sm:self-auto">
                        {!isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectStore(store.id)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <span>Switch to this Store</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Link
                              href="/merchant/settings"
                              className="btn btn-outline btn-sm h-8 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Settings</span>
                            </Link>
                            <a
                              href={`/stores/${encodeURIComponent(store.slug)}/products`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-sm h-8 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <span>View Storefront</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
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
        <Card className="rounded-xl border border-border/60 bg-card shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-semibold text-foreground">Organization &amp; Multi-Tenancy Architecture</CardTitle>
              </div>
              <Badge variant="info" size="sm" className="font-mono text-[10px]">Hierarchy Spec</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Domain relationship: <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">Organization &rarr; Stores &rarr; Store Members &rarr; Store Data</code>
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p className="m-0">
              Each store is owned by an <strong className="text-foreground">Organization</strong> in PostgreSQL. When a merchant creates a store, the backend
              automatically provisions or associates the organization and grants the creator <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">owner</code> status.
            </p>

            <div className="p-3.5 bg-muted/30 rounded-lg border border-border/50 space-y-2.5">
              <strong className="text-foreground text-xs block font-semibold">Architecture Status:</strong>
              <ul className="space-y-2 m-0 p-0 list-none">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div><strong className="text-foreground">Store Lifecycle APIs:</strong> <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded text-foreground">/api/v1/stores</code> (creation, listing, update, activate, suspend, archive) are fully operational.</div>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div><strong className="text-foreground">Store Membership APIs:</strong> <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded text-foreground">/api/v1/stores/[storeId]/members</code> supports adding staff, role updates, and member removal.</div>
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
