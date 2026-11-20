"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { GstProfileDTO, ProductTaxProfileDTO } from "@calcart/tax";
import { Alert, Badge, Button, EmptyState, Input } from "@calcart/ui";
import { Package, Search } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  bpsToPercentInput,
  formatRatePercent,
  getGstSplitBreakdown,
  percentInputToBps,
  validateProductTaxDraft,
  type ProductTaxDraft,
} from "../../../lib/merchant-tax-helpers";

interface ProductRow {
  id: string;
  title: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

interface ProductListResponse {
  items: ProductRow[];
  hasMore: boolean;
  nextCursor?: string;
}

interface RowState {
  isBusy: boolean;
  error: string | null;
}

export interface ProductTaxEditorProps {
  storeId: string;
  canEdit: boolean;
  /** Store-wide rate shown for products that have no profile of their own. */
  defaultRateBps: number;
}

const PAGE_SIZE = 25;

function statusVariant(status: ProductRow["status"]): "success" | "neutral" | "warning" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

export function ProductTaxEditor({
  storeId,
  canEdit,
  defaultRateBps,
}: ProductTaxEditorProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProductTaxProfileDTO>>({});
  const [gstProfiles, setGstProfiles] = useState<GstProfileDTO[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductTaxDraft>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftFor = useCallback(
    (profile: ProductTaxProfileDTO | undefined): ProductTaxDraft => ({
      hsnCode: profile?.hsnCode ?? "",
      ratePercent: profile ? bpsToPercentInput(profile.gstRateBps) : "",
      gstProfileId: profile?.gstProfileId ?? null,
    }),
    [],
  );

  const loadGstProfiles = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: GstProfileDTO[] }>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/tax/gst-profiles`,
      );
      setGstProfiles(res.items || []);
    } catch {
      // ignore
    }
  }, [storeId]);

  useEffect(() => {
    loadGstProfiles();
  }, [loadGstProfiles]);

  const loadPage = useCallback(
    async (after: string | undefined, query: string, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      try {
        const page = await apiClient.get<ProductListResponse>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/products`,
          {
            params: {
              limit: PAGE_SIZE,
              ...(after ? { cursor: after } : {}),
              ...(query ? { search: query } : {}),
            },
          },
        );

        let fetched: ProductTaxProfileDTO[] = [];
        if (page.items.length > 0) {
          const res = await apiClient.get<{ profiles: ProductTaxProfileDTO[] }>(
            `/api/v1/stores/${encodeURIComponent(storeId)}/tax/profiles`,
            { params: { productIds: page.items.map((p) => p.id).join(",") } },
          );
          fetched = res.profiles;
        }

        const byProduct = Object.fromEntries(fetched.map((p) => [p.productId, p]));
        setProfiles((prev) => ({ ...prev, ...byProduct }));
        setDrafts((prev) => ({
          ...prev,
          ...Object.fromEntries(
            page.items.map((p) => [p.id, draftFor(byProduct[p.id])]),
          ),
        }));
        setProducts((prev) => (append ? [...prev, ...page.items] : page.items));
        setHasMore(page.hasMore);
        setCursor(page.nextCursor);
      } catch (err: unknown) {
        setError(
          err instanceof ApiClientError ? err.message : "Could not load products.",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [storeId, draftFor],
  );

  useEffect(() => {
    loadPage(undefined, activeSearch, false);
  }, [loadPage, activeSearch]);

  const setRow = (productId: string, patch: Partial<RowState>) =>
    setRowState((prev) => ({
      ...prev,
      [productId]: { isBusy: false, error: null, ...prev[productId], ...patch },
    }));

  const updateDraft = (productId: string, patch: Partial<ProductTaxDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { hsnCode: "", ratePercent: "", ...prev[productId], ...patch },
    }));
    setRow(productId, { error: null });
  };

  const save = async (productId: string) => {
    const draft = drafts[productId];
    if (!draft) return;
    const problems = validateProductTaxDraft(draft);
    if (Object.keys(problems).length > 0) {
      setRow(productId, { error: Object.values(problems)[0] ?? "Invalid value" });
      return;
    }

    setRow(productId, { isBusy: true, error: null });
    try {
      const res = await apiClient.put<{ profile: ProductTaxProfileDTO }>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/tax`,
        {
          hsnCode: draft.hsnCode.trim() || undefined,
          gstRateBps: draft.ratePercent.trim() !== "" ? percentInputToBps(draft.ratePercent) : undefined,
          gstProfileId: draft.gstProfileId ?? undefined,
        },
      );
      setProfiles((prev) => ({ ...prev, [productId]: res.profile }));
      setDrafts((prev) => ({ ...prev, [productId]: draftFor(res.profile) }));
      setRow(productId, { isBusy: false });
    } catch (err: unknown) {
      setRow(productId, {
        isBusy: false,
        error: err instanceof ApiClientError ? err.message : "Could not save.",
      });
    }
  };

  const clear = async (productId: string) => {
    setRow(productId, { isBusy: true, error: null });
    try {
      await apiClient.delete(
        `/api/v1/stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}/tax`,
      );
      setProfiles((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setDrafts((prev) => ({ ...prev, [productId]: draftFor(undefined) }));
      setRow(productId, { isBusy: false });
    } catch (err: unknown) {
      setRow(productId, {
        isBusy: false,
        error: err instanceof ApiClientError ? err.message : "Could not clear.",
      });
    }
  };

  return (
    <section className="space-y-4" data-testid="product-tax-editor">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Product tax rates</h2>
            <Badge variant="neutral" size="sm">
              HSN / SAC &amp; CGST / SGST
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            Give each product its HSN/SAC code and GST rate. A product without
            one is charged the store default of{" "}
            <span className="font-mono text-foreground font-semibold">
              {formatRatePercent(defaultRateBps)}
            </span>{" "}
            ({(() => {
              const defSplit = getGstSplitBreakdown(defaultRateBps);
              return defSplit
                ? `${defSplit.formattedCgst} CGST + ${defSplit.formattedSgst} SGST`
                : "split in equal halves";
            })()}) and shows no HSN code on its invoice.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setActiveSearch(search.trim());
          }}
          role="search"
        >
          <label htmlFor="tax-product-search" className="sr-only">
            Search products
          </label>
          <Input
            id="tax-product-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="w-56"
          />
          <Button type="submit" variant="outline" size="sm" icon={<Search size={14} />}>
            Search
          </Button>
        </form>
      </div>

      {error && (
        <Alert variant="danger" title="Unable to load products">
          {error}
        </Alert>
      )}

      {isLoading && (
        <div className="divide-y divide-border/50 border-y border-border/50" aria-busy="true" aria-label="Loading products">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_9rem_7rem_8rem] gap-3 py-3 items-center">
              <div className="h-4 w-2/3 rounded bg-muted/60 animate-pulse" />
              <div className="h-9 rounded bg-muted/40 animate-pulse" />
              <div className="h-9 rounded bg-muted/40 animate-pulse" />
              <div className="h-9 rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <EmptyState
          icon={<Package size={20} />}
          title={activeSearch ? "No products match" : "No products yet"}
          description={
            activeSearch
              ? "Try a different search term."
              : "Add products to your catalog, then set their tax rates here."
          }
        />
      )}

      {!isLoading && products.length > 0 && (
        <>
          <div
            className="hidden md:grid grid-cols-[1fr_9rem_8rem_8rem] gap-3 text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground px-0.5"
            aria-hidden="true"
          >
            <span>Product</span>
            <span>HSN / SAC</span>
            <span>GST % (CGST / SGST)</span>
            <span />
          </div>
          <ul className="divide-y divide-border/50 border-y border-border/50" data-testid="product-tax-list">
            {products.map((product) => {
              const profile = profiles[product.id];
              const draft = drafts[product.id] ?? draftFor(profile);
              const state = rowState[product.id];
              const isDirty =
                draft.hsnCode !== (profile?.hsnCode ?? "") ||
                draft.ratePercent !==
                (profile ? bpsToPercentInput(profile.gstRateBps) : "") ||
                (draft.gstProfileId ?? null) !== (profile?.gstProfileId ?? null);
              const busy = state?.isBusy ?? false;

              // Current effective rate for breakdown display
              const effectiveRatePercent = draft.ratePercent.trim() !== ""
                ? draft.ratePercent
                : bpsToPercentInput(defaultRateBps);
              const split = getGstSplitBreakdown(effectiveRatePercent);

              return (
                <li key={product.id} className="py-3.5 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem_8rem_8rem] gap-3 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {product.title}
                        </span>
                        <Badge variant={statusVariant(product.status)}>
                          {product.status.toLowerCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground flex-wrap">
                        {profile?.gstProfileName ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                            Slab: {profile.gstProfileName}
                          </span>
                        ) : profile ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary font-medium">
                            Custom rate applied
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            Using store default
                          </span>
                        )}
                        {gstProfiles.length > 0 && canEdit && (
                          <select
                            value={draft.gstProfileId || ""}
                            onChange={(e) => {
                              const selectedId = e.target.value || null;
                              if (!selectedId) {
                                updateDraft(product.id, { gstProfileId: null });
                              } else {
                                const selected = gstProfiles.find((g) => g.id === selectedId);
                                if (selected) {
                                  updateDraft(product.id, {
                                    gstProfileId: selected.id,
                                    ratePercent: bpsToPercentInput(selected.gstRateBps),
                                    hsnCode: selected.hsnCode || draft.hsnCode,
                                  });
                                }
                              }
                            }}
                            className="text-[11px] py-0.5 px-1.5 rounded border border-border/60 bg-background text-foreground"
                            disabled={busy}
                          >
                            <option value="">-- Apply GST Slab --</option>
                            {gstProfiles.map((gp) => (
                              <option key={gp.id} value={gp.id}>
                                {gp.name} ({formatRatePercent(gp.gstRateBps)})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`hsn-${product.id}`} className="sr-only">
                        HSN or SAC code for {product.title}
                      </label>
                      <Input
                        id={`hsn-${product.id}`}
                        value={draft.hsnCode}
                        onChange={(e) =>
                          updateDraft(product.id, {
                            hsnCode: e.target.value.replace(/\D/g, "").slice(0, 8),
                          })
                        }
                        disabled={!canEdit || busy}
                        inputMode="numeric"
                        placeholder="6109"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor={`rate-${product.id}`} className="sr-only">
                        GST rate percent for {product.title}
                      </label>
                      <Input
                        id={`rate-${product.id}`}
                        value={draft.ratePercent}
                        onChange={(e) => updateDraft(product.id, { ratePercent: e.target.value })}
                        disabled={!canEdit || busy}
                        inputMode="decimal"
                        placeholder={bpsToPercentInput(defaultRateBps)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            loading={busy}
                            disabled={!isDirty || busy}
                            onClick={() => save(product.id)}
                            data-testid={`save-tax-${product.id}`}
                          >
                            Save
                          </Button>
                          {profile && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => clear(product.id)}
                              aria-label={`Remove tax profile for ${product.title}`}
                            >
                              Clear
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* CGST + SGST Rate Split Indicator */}
                  {split && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1 rounded border border-border/40 max-w-xl">
                      <span className="font-semibold text-foreground">GST Split:</span>
                      <span>
                        Intra-state:{" "}
                        <strong className="text-foreground">{split.formattedCgst} CGST</strong> +{" "}
                        <strong className="text-foreground">{split.formattedSgst} SGST</strong>
                      </span>
                      <span className="text-border">|</span>
                      <span>
                        Inter-state:{" "}
                        <strong className="text-foreground">{split.formattedIgst} IGST</strong>
                      </span>
                    </div>
                  )}

                  {state?.error && (
                    <p role="alert" className="text-xs text-destructive">
                      {state.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                loading={isLoadingMore}
                disabled={isLoadingMore}
                onClick={() => loadPage(cursor, activeSearch, true)}
              >
                Load more products
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
