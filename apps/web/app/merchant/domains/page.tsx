"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  StoreDomainDTO,
  StoreDomainsResponseDTO,
  VerifyDomainResultDTO,
} from "@calcart/stores";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  Input,
  Spinner,
} from "@calcart/ui";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { MerchantShell } from "@/components/merchant/MerchantShell";
import { useStore } from "@/context/store-context";
import { ApiClientError, apiClient } from "@/lib/api-client";

export default function MerchantDomainsPage() {
  const { activeStore, stores, selectStore, isLoading: isStoreLoading } = useStore();

  const [domainsData, setDomainsData] = useState<StoreDomainsResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form states
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Action states
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<StoreDomainDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Accordion & Copy states
  const [expandedDnsId, setExpandedDnsId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDomains = useCallback(async (storeId: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<StoreDomainsResponseDTO>(
        `/api/v1/stores/${storeId}/domains`,
      );
      setDomainsData(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setFetchError(err.message || "Failed to load store domains.");
      } else {
        setFetchError(
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
      setFetchError(null);
    }
  }, [activeStore?.id, fetchDomains]);

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Add Custom Domain
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore?.id || !customDomainInput.trim()) return;

    setIsAdding(true);
    setAddError(null);
    setActionSuccess(null);

    try {
      const created = await apiClient.post<StoreDomainDTO>(
        `/api/v1/stores/${activeStore.id}/domains`,
        { domain: customDomainInput.trim() },
      );

      setCustomDomainInput("");
      setActionSuccess(`Custom domain '${created.domain}' added. Please configure DNS records.`);
      // Auto-expand the DNS instructions for the new domain
      setExpandedDnsId(created.id);
      await fetchDomains(activeStore.id);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setAddError(err.message || "Failed to add custom domain.");
      } else {
        setAddError(
          err instanceof Error ? err.message : "An unexpected error occurred while adding domain.",
        );
      }
    } finally {
      setIsAdding(false);
    }
  };

  // Verify Domain
  const handleVerify = async (domain: StoreDomainDTO) => {
    if (!activeStore?.id) return;

    setVerifyingId(domain.id);
    setAddError(null);
    setActionSuccess(null);

    try {
      const result = await apiClient.post<VerifyDomainResultDTO>(
        `/api/v1/stores/${activeStore.id}/domains/${domain.id}/verify`,
        {},
      );

      if (result.verified) {
        setActionSuccess(`Domain '${domain.domain}' verified successfully! It is now active.`);
      } else {
        setAddError(
          result.error ||
            `Verification check for '${domain.domain}' is still pending. Ensure DNS records have propagated.`,
        );
        setExpandedDnsId(domain.id);
      }
      await fetchDomains(activeStore.id);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setAddError(err.message || "Domain verification failed.");
      } else {
        setAddError(err instanceof Error ? err.message : "Verification request failed.");
      }
    } finally {
      setVerifyingId(null);
    }
  };

  // Set Primary Domain
  const handleSetPrimary = async (domain: StoreDomainDTO) => {
    if (!activeStore?.id) return;

    setSettingPrimaryId(domain.id);
    setAddError(null);
    setActionSuccess(null);

    try {
      await apiClient.post<{ success: boolean; primaryDomain: string }>(
        `/api/v1/stores/${activeStore.id}/domains/${domain.id}/primary`,
        {},
      );

      setActionSuccess(`Primary storefront domain changed to '${domain.domain}'.`);
      await fetchDomains(activeStore.id);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setAddError(err.message || "Failed to set primary domain.");
      } else {
        setAddError(err instanceof Error ? err.message : "Failed to set primary domain.");
      }
    } finally {
      setSettingPrimaryId(null);
    }
  };

  // Disconnect Custom Domain
  const handleConfirmDelete = async () => {
    if (!activeStore?.id || !domainToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete(
        `/api/v1/stores/${activeStore.id}/domains/${domainToDelete.id}`,
      );

      setActionSuccess(`Domain '${domainToDelete.domain}' has been disconnected safely.`);
      setDomainToDelete(null);
      await fetchDomains(activeStore.id);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setDeleteError(err.message || "Failed to disconnect domain.");
      } else {
        setDeleteError(err instanceof Error ? err.message : "Failed to disconnect domain.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to detect apex vs subdomain
  const normalizedPreview = customDomainInput
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0] || "";
  const isInputApex =
    normalizedPreview.includes(".") && normalizedPreview.split(".").filter(Boolean).length <= 2;

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

  const primaryDomain = domainsData?.domains.find((d) => d.isPrimary);

  return (
    <MerchantShell
      title="Store Domains"
      currentStore={currentStoreOption}
      stores={storeOptions}
      onSelectStore={(storeId) => selectStore(storeId)}
    >
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header Title & Description */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Domain Management
              </h1>
              {domainsData && (
                <Badge variant="neutral" className="text-xs font-mono">
                  {domainsData.domains.length} {domainsData.domains.length === 1 ? "Domain" : "Domains"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your default platform subdomain, connect a branded custom domain, and configure DNS routing.
            </p>
          </div>

          {activeStore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDomains(activeStore.id)}
              disabled={isLoading}
              className="gap-1.5 h-8 text-xs self-start sm:self-auto shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Status</span>
            </Button>
          )}
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <Alert variant="success" className="text-xs">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          </Alert>
        )}

        {(fetchError || addError) && (
          <Alert variant="danger" className="text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Action Failed</p>
                <p className="text-muted-foreground">{fetchError || addError}</p>
              </div>
            </div>
          </Alert>
        )}

        {isStoreLoading || (isLoading && !domainsData) ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-muted-foreground animate-pulse">
              Loading domain configuration...
            </p>
          </div>
        ) : !activeStore ? (
          <EmptyState
            title="No Store Selected"
            description="Select or create a store to manage storefront domains."
          />
        ) : (
          <div className="space-y-6">
            {/* 1. Default Platform Subdomain Card */}
            <Card className="border border-border shadow-xs overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
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
                      {primaryDomain?.type === "SUBDOMAIN" && (
                        <Badge variant="neutral" className="text-[11px] py-0 font-mono text-primary border-primary/30">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      Assigned by default. Always available as a permanent fallback URL.
                    </CardDescription>
                  </div>

                  {domainsData && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopy(domainsData.previewUrl, "platform-url")
                        }
                        className="h-8 gap-1.5 text-xs active:scale-[0.98] transition-transform"
                      >
                        {copiedId === "platform-url" ? (
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
                        className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs gap-1.5 active:scale-[0.98]"
                      >
                        <span>Visit Storefront</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Assigned Hostname
                    </span>
                    <div className="font-mono font-semibold text-sm text-foreground flex items-center gap-2">
                      <span>{domainsData?.assignedDomain}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                        <Lock className="w-3 h-3" />
                        <span>SSL Active</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p>Subdomain slug: <code className="text-foreground font-semibold">{domainsData?.assignedSubdomain}</code></p>
                    <p className="text-[11px]">Direct App Router routing: <code className="text-muted-foreground">/stores/{domainsData?.assignedSubdomain}</code></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Connect Custom Domain Form Card */}
            <Card className="border border-border shadow-xs">
              <CardHeader className="bg-muted/10 border-b border-border/50 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">
                      Connect a Custom Domain
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Connect a custom domain you own (e.g. <code>shop.brand.com</code> or <code>brand.com</code>).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <form onSubmit={handleAddDomain} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="customDomain"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span>Domain Hostname</span>
                      {normalizedPreview && (
                        <span className="text-[11px] text-muted-foreground">
                          Detected:{" "}
                          <span className="font-semibold text-foreground">
                            {isInputApex ? "Apex Domain (A Record)" : "Subdomain (CNAME)"}
                          </span>
                        </span>
                      )}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="relative flex-1">
                        <Input
                          id="customDomain"
                          type="text"
                          value={customDomainInput}
                          onChange={(e) => setCustomDomainInput(e.target.value)}
                          placeholder="e.g. shop.yourbrand.com or yourbrand.com"
                          className="h-9 text-xs font-mono pr-8"
                          disabled={isAdding}
                        />
                        {normalizedPreview && (
                          <div className="absolute right-2.5 top-2 text-[10px] text-muted-foreground font-mono">
                            {isInputApex ? "Apex" : "Sub"}
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={isAdding || !customDomainInput.trim()}
                        className="h-9 px-4 text-xs gap-1.5 shrink-0 active:scale-[0.98]"
                      >
                        {isAdding ? (
                          <>
                            <Spinner size="sm" />
                            <span>Adding Domain...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Connect Domain</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Enter the domain without <code>http://</code> or <code>https://</code>. You will receive authoritative DNS records to add at your DNS registrar.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* 3. Configured Domains Table & Management */}
            <Card className="border border-border shadow-xs overflow-hidden">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight">
                      Configured Domains
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      All platform and custom domains associated with this store.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Domain</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Primary</th>
                        <th className="py-3 px-4">SSL</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {domainsData?.domains && domainsData.domains.length > 0 ? (
                        domainsData.domains.map((dom) => (
                          <React.Fragment key={dom.id}>
                            <tr className="hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-foreground">
                                <div className="flex items-center gap-2">
                                  <span>{dom.domain}</span>
                                  {dom.isPrimary && (
                                    <span title="Primary Domain">
                                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="neutral" className="text-[10px] uppercase font-mono py-0">
                                  {dom.type}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                {dom.status === "ACTIVE" ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Active
                                  </span>
                                ) : dom.status === "PENDING" ? (
                                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                                    <Clock className="w-3 h-3 animate-spin text-amber-500" />
                                    Pending DNS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {dom.isPrimary ? (
                                  <Badge variant="neutral" className="text-[10px] font-mono border-primary/40 text-primary py-0">
                                    Primary
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-[11px]">Secondary</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <ShieldCheck className={`w-3.5 h-3.5 ${dom.status === "ACTIVE" ? "text-emerald-500" : "text-muted-foreground/60"}`} />
                                  <span>{dom.status === "ACTIVE" ? "Active" : "Pending"}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Verification button for pending/failed custom domains */}
                                  {dom.type === "CUSTOM" && dom.status !== "ACTIVE" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleVerify(dom)}
                                      disabled={verifyingId === dom.id}
                                      className="h-7 px-2 text-[11px] gap-1"
                                      title="Check DNS Verification"
                                    >
                                      {verifyingId === dom.id ? (
                                        <Spinner size="sm" />
                                      ) : (
                                        <RefreshCw className="w-3 h-3" />
                                      )}
                                      <span>Verify</span>
                                    </Button>
                                  )}

                                  {/* Make Primary button */}
                                  {!dom.isPrimary && dom.status === "ACTIVE" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSetPrimary(dom)}
                                      disabled={settingPrimaryId === dom.id}
                                      className="h-7 px-2 text-[11px] gap-1"
                                      title="Set as Primary Domain"
                                    >
                                      {settingPrimaryId === dom.id ? (
                                        <Spinner size="sm" />
                                      ) : (
                                        <Star className="w-3 h-3 text-amber-500" />
                                      )}
                                      <span>Make Primary</span>
                                    </Button>
                                  )}

                                  {/* DNS Instructions Toggle */}
                                  {dom.type === "CUSTOM" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setExpandedDnsId(
                                          expandedDnsId === dom.id ? null : dom.id,
                                        )
                                      }
                                      className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                                      title="View DNS Records"
                                    >
                                      <span>DNS</span>
                                      {expandedDnsId === dom.id ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </Button>
                                  )}

                                  {/* Copy Link */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopy(`https://${dom.domain}`, dom.id)}
                                    className="h-7 px-2 text-xs"
                                    title="Copy Domain URL"
                                  >
                                    {copiedId === dom.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    )}
                                  </Button>

                                  {/* Disconnect Custom Domain */}
                                  {dom.type === "CUSTOM" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDomainToDelete(dom)}
                                      className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                      title="Disconnect Domain"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable DNS Instructions Row for Custom Domains */}
                            {dom.type === "CUSTOM" && expandedDnsId === dom.id && (
                              <tr className="bg-muted/10 border-b border-border/80">
                                <td colSpan={6} className="py-4 px-6 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Server className="w-4 h-4 text-primary" />
                                      <span className="font-semibold text-xs text-foreground">
                                        Required DNS Configuration for {dom.domain}
                                      </span>
                                    </div>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleVerify(dom)}
                                      disabled={verifyingId === dom.id}
                                      className="h-7 px-3 text-xs gap-1.5"
                                    >
                                      {verifyingId === dom.id ? (
                                        <>
                                          <Spinner size="sm" />
                                          <span>Verifying...</span>
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="w-3 h-3" />
                                          <span>Verify DNS Records</span>
                                        </>
                                      )}
                                    </Button>
                                  </div>

                                  {dom.errorReason && (
                                    <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                      <div className="space-y-0.5">
                                        <p className="font-semibold">Last Verification Status:</p>
                                        <p className="text-[11px] leading-relaxed">{dom.errorReason}</p>
                                      </div>
                                    </div>
                                  )}

                                  <div className="border border-border/70 rounded-lg overflow-hidden bg-background">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase">
                                        <tr>
                                          <th className="py-2 px-3">Type</th>
                                          <th className="py-2 px-3">Name / Host</th>
                                          <th className="py-2 px-3">Value / Points To</th>
                                          <th className="py-2 px-3">TTL</th>
                                          <th className="py-2 px-3 text-right">Copy</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                                        {dom.dnsInstructions && dom.dnsInstructions.length > 0 ? (
                                          dom.dnsInstructions.map((rec, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20">
                                              <td className="py-2 px-3 font-bold text-foreground">
                                                {rec.type}
                                              </td>
                                              <td className="py-2 px-3 text-foreground">
                                                {rec.name}
                                              </td>
                                              <td className="py-2 px-3 text-primary truncate max-w-[280px]">
                                                {rec.value}
                                              </td>
                                              <td className="py-2 px-3 text-muted-foreground">
                                                Auto
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleCopy(rec.value, `${dom.id}-rec-${idx}`)
                                                  }
                                                  className="h-6 px-1.5 text-[10px]"
                                                >
                                                  {copiedId === `${dom.id}-rec-${idx}` ? (
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                  ) : (
                                                    <Copy className="w-3 h-3 text-muted-foreground" />
                                                  )}
                                                </Button>
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={5} className="py-3 px-3 text-muted-foreground text-center">
                                              No specific DNS records required or available.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <p className="text-[11px] text-muted-foreground">
                                    Add these records in your domain registrar's DNS management panel (Cloudflare, GoDaddy, Namecheap, Route 53). DNS changes may take up to 24-48 hours to propagate globally.
                                  </p>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-muted-foreground">
                            No domain records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Disconnect Confirmation Modal */}
        <Dialog
          isOpen={Boolean(domainToDelete)}
          onClose={() => setDomainToDelete(null)}
          title="Disconnect Custom Domain"
          description="Are you sure you want to disconnect this domain from your storefront?"
        >
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Disconnecting <code>{domainToDelete?.domain}</code>
                </p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Traffic directed to this hostname will no longer resolve to your store. Storefront content, catalog, orders, and customer data will remain completely intact. If this was your primary domain, your store will revert to your default platform subdomain.
                </p>
              </div>
            </div>

            {deleteError && (
              <Alert variant="danger" className="text-xs">
                <span>{deleteError}</span>
              </Alert>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDomainToDelete(null)}
                disabled={isDeleting}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-8 text-xs gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Spinner size="sm" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect Domain</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </MerchantShell>
  );
}
