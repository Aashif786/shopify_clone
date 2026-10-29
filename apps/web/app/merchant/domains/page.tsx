"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { StoreDomainsResponseDTO } from "@shopify-clone/stores";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { useStore } from "@/context/store-context";
import { ApiClientError, apiClient } from "@/lib/api-client";

export default function MerchantDomainsPage() {
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [domainsData, setDomainsData] = useState<StoreDomainsResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const fetchDomains = useCallback(async (storeId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<StoreDomainsResponseDTO>(
        `/api/v1/stores/${storeId}/domains`,
      );
      setDomainsData(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to load store domains.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading domains.",
        );
      }
      setDomainsData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeStore?.id) {
      fetchDomains(activeStore.id);
    } else {
      setDomainsData(null);
      setError(null);
    }
  }, [activeStore?.id, fetchDomains]);

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedDomain(id);
      setTimeout(() => setCopiedDomain(null), 2000);
    }
  };

  const currentStoreOption = activeStore
    ? {
        id: activeStore.id,
        name: activeStore.name,
        slug: activeStore.slug,
        role: activeStore.role,
        status: activeStore.status,
      }
    : null;

  const storeOptions = stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    role: s.role,
    status: s.status,
  }));

  return (
    <MerchantShell
      activePath="/merchant/domains"
      title="Domains"
      subtitle="Manage your store addresses, assigned subdomains, and domain configuration"
      currentStore={currentStoreOption}
      stores={storeOptions}
      onSelectStore={selectStore}
      headerActions={
        activeStore?.id ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDomains(activeStore.id)}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        ) : null
      }
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {error && (
          <Alert variant="danger" title="Error Loading Domains">
            {error}
          </Alert>
        )}

        {isStoreLoading || (isLoading && !domainsData) ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Spinner size="lg" />
            <p className="text-sm">Loading domain configuration...</p>
          </div>
        ) : !activeStore ? (
          <EmptyState
            title="No store selected"
            description="Select an active store from the top navigation to view its domain configuration."
            icon={<Store className="w-8 h-8 text-muted-foreground" />}
          />
        ) : (
          <>
            {/* 1. Primary Assigned Subdomain Card */}
            <Card className="border border-border/80 shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/60 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Globe className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-base font-bold tracking-tight">
                        Platform Subdomain
                      </CardTitle>
                      <Badge variant="success" className="gap-1 text-[11px] py-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </Badge>
                      <Badge variant="neutral" className="text-[11px] py-0 font-mono">
                        Primary
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      Your store is publicly accessible at this dedicated hostname on Cal Cart.
                    </CardDescription>
                  </div>

                  {domainsData && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy(
                            domainsData.previewUrl,
                            "primary-url",
                          )
                        }
                        className="h-8 gap-1.5 text-xs"
                      >
                        {copiedDomain === "primary-url" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </Button>

                      <a
                        href={domainsData.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs gap-1.5"
                      >
                        <span>Visit Storefront</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4">
                {domainsData && (
                  <div className="rounded-xl border border-border/70 bg-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 font-mono text-sm sm:text-base font-bold text-foreground truncate">
                        <span className="text-primary">{domainsData.assignedSubdomain}</span>
                        <span className="text-muted-foreground">.{domainsData.basePlatformDomain}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-500" />
                          <span>HTTPS Secured</span>
                        </span>
                        <span>•</span>
                        <span>Direct Subdomain Routing</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                      <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2.5 py-1 rounded-md border border-border/50">
                        {domainsData.previewUrl}
                      </span>
                    </div>
                  </div>
                )}

                {/* Legacy Path Support Callout */}
                <div className="p-3.5 rounded-lg bg-muted/30 border border-border/60 text-xs text-muted-foreground flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      Seamless Routing & Backward Compatibility
                    </p>
                    <p>
                      Both your assigned subdomain{" "}
                      <code className="text-primary font-mono text-[11px]">
                        {domainsData?.assignedDomain}
                      </code>{" "}
                      and the standard path{" "}
                      <code className="text-foreground font-mono text-[11px]">
                        /stores/{activeStore.slug}
                      </code>{" "}
                      remain active and supported simultaneously. All products, shopping cart, and
                      checkout workflows operate across both addresses.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Registered Store Domains Table */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base font-bold tracking-tight">
                  Domain Names
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Hostnames associated with this store tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 text-muted-foreground border-b border-border font-medium">
                        <tr>
                          <th className="py-2.5 px-4 font-mono uppercase text-[11px]">Domain</th>
                          <th className="py-2.5 px-4 font-mono uppercase text-[11px]">Type</th>
                          <th className="py-2.5 px-4 font-mono uppercase text-[11px]">Status</th>
                          <th className="py-2.5 px-4 font-mono uppercase text-[11px]">Role</th>
                          <th className="py-2.5 px-4 text-right font-mono uppercase text-[11px]">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {domainsData?.domains && domainsData.domains.length > 0 ? (
                          domainsData.domains.map((dom) => (
                            <tr key={dom.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-foreground">
                                <div className="flex items-center gap-1.5">
                                  <span>{dom.domain}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="neutral" className="text-[10px] uppercase font-mono py-0">
                                  {dom.type}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {dom.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {dom.isPrimary ? (
                                  <Badge variant="neutral" className="text-[10px] font-mono border-primary/40 text-primary py-0">
                                    Primary
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">Secondary</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopy(`https://${dom.domain}`, dom.id)}
                                  className="h-7 px-2 text-xs"
                                  title="Copy URL"
                                >
                                  {copiedDomain === dom.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-muted-foreground">
                              No domain records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Custom Domains (Phase 2 Roadmap & Documentation) */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">
                      Custom Domains (Upcoming Phase 2)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Connect your own branded domain (e.g., store.yourbrand.com) directly to your storefront.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Custom domain connection with automated DNS validation and SSL certificate
                  provisioning will be available in an upcoming phase. Below is a preview of the DNS
                  records that will be required by your domain registrar:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-primary" />
                        <span>CNAME Record (Subdomain)</span>
                      </span>
                      <Badge variant="neutral" className="text-[10px] py-0 font-mono">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Points your branded subdomain (e.g. <code>shop</code>) to Cal Cart:
                    </p>
                    <div className="font-mono text-xs bg-background p-2 rounded border border-border mt-2 space-y-0.5">
                      <div className="text-muted-foreground">Host: <span className="text-foreground font-semibold">shop</span></div>
                      <div className="text-muted-foreground">Target: <span className="text-primary font-semibold">cname.calcart.com</span></div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 p-3.5 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>A Record (Apex Domain)</span>
                      </span>
                      <Badge variant="neutral" className="text-[10px] py-0 font-mono">
                        Alternative
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      For pointing your root domain (e.g. <code>yourbrand.com</code>):
                    </p>
                    <div className="font-mono text-xs bg-background p-2 rounded border border-border mt-2 space-y-0.5">
                      <div className="text-muted-foreground">Host: <span className="text-foreground font-semibold">@</span></div>
                      <div className="text-muted-foreground">Target: <span className="text-primary font-semibold">76.76.21.21</span></div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground bg-muted/20 rounded-md p-3 border border-border/40">
                  <p>
                    <strong>Note:</strong> Custom domain DNS verification and automated TLS renewal
                    will be enabled in Phase 2 once the production wildcard routing is live. Your store
                    is already fully operational on your platform subdomain.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MerchantShell>
  );
}
