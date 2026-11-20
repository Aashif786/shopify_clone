"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { TaxSettingsDTO } from "@calcart/tax";
import { hasRoleAtLeast } from "@calcart/tenant";
import { Alert, Badge, Button } from "@calcart/ui";
import { Building2, FileText, RefreshCw, Split } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { useStore } from "../../../context/store-context";
import { ProductTaxEditor } from "./product-tax-editor";
import { TaxSettingsForm } from "./tax-settings-form";
import { GstProfilesManager } from "./gst-profiles-manager";

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tax settings">
      <div className="h-5 w-64 rounded bg-muted/60 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
            <div className="h-9 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaxView() {
  const { activeStore } = useStore();
  const storeId = activeStore?.id ?? null;
  const canEdit = hasRoleAtLeast(activeStore?.role ?? "staff", "admin");

  const [settings, setSettings] = useState<TaxSettingsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    setError(null);
    try {
      setSettings(
        await apiClient.get<TaxSettingsDTO>(
          `/api/v1/stores/${encodeURIComponent(storeId)}/tax/settings`,
        ),
      );
    } catch (err: unknown) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not load tax settings.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-10 max-w-5xl" data-testid="tax-view">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Tax and GST
        </h1>
        <p className="text-sm text-muted-foreground max-w-[65ch]">
          Charge GST at checkout, split into CGST and SGST for intra-state orders or IGST for inter-state
          orders, and issue a compliant tax invoice for every paid order.
        </p>
      </header>

      {/* GST Explanatory Banner: CGST, SGST & IGST Concept Guide */}
      <section
        className="rounded-xl border border-border/70 bg-gradient-to-r from-muted/30 via-muted/10 to-background p-4 sm:p-5 space-y-3"
        data-testid="gst-explanation-banner"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Split size={16} className="text-primary" aria-hidden="true" />
            <span>Understanding Indian GST: CGST, SGST &amp; IGST</span>
          </div>
          <Badge variant="neutral" size="sm">
            Dual GST Model
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          India follows a dual GST system where tax on goods and services is shared between the Central and State Governments.
          Cal Cart automatically categorizes supply destination at checkout based on customer shipping address:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Building2 size={14} className="text-primary shrink-0" aria-hidden="true" />
              <span>Intra-State Supply (Buyer in Same State)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Taxes are split into two equal halves:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">CGST (Central GST):</strong> 50% paid to Central Govt.
              </li>
              <li>
                <strong className="text-foreground">SGST (State GST):</strong> 50% paid to State Govt.
              </li>
            </ul>
            <div className="text-[11px] font-mono text-primary bg-primary/5 px-2 py-1 rounded inline-block">
              Example: 18% GST = 9% CGST + 9% SGST
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FileText size={14} className="text-primary shrink-0" aria-hidden="true" />
              <span>Inter-State Supply (Buyer in Different State)</span>
            </div>
            <p className="text-xs text-muted-foreground leading-normal">
              Single unified tax applied at full standard rate:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                <strong className="text-foreground">IGST (Integrated GST):</strong> 100% full rate.
              </li>
              <li>
                <strong className="text-foreground">Exports:</strong> Zero-rated supplies outside India.
              </li>
            </ul>
            <div className="text-[11px] font-mono text-primary bg-primary/5 px-2 py-1 rounded inline-block">
              Example: 18% GST = 18% IGST (0% CGST / 0% SGST)
            </div>
          </div>
        </div>
      </section>

      {!storeId && (
        <Alert variant="info" title="No store selected">
          Choose a store to manage its tax settings.
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title="Unable to load tax settings">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={load}
              icon={<RefreshCw size={14} />}
            >
              Try again
            </Button>
          </div>
        </Alert>
      )}

      {storeId && isLoading && <SettingsSkeleton />}

      {storeId && !isLoading && settings && (
        <>
          <TaxSettingsForm
            storeId={storeId}
            settings={settings}
            canEdit={canEdit}
            onSaved={setSettings}
          />
          {settings.isEnabled ? (
            <>
              <GstProfilesManager storeId={storeId} canEdit={canEdit} />
              <ProductTaxEditor
                storeId={storeId}
                canEdit={canEdit}
                defaultRateBps={settings.defaultGstRateBps}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground border-t border-border/50 pt-6 max-w-[65ch]">
              Product tax rates and GST profiles appear here once GST is switched on.
            </p>
          )}
        </>
      )}
    </div>
  );
}
