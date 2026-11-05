"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { TaxSettingsDTO } from "@calcart/tax";
import { Alert, Button, FormField, Input } from "@calcart/ui";
import { CheckCircle2, ReceiptText, RotateCcw, Save } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  bpsToPercentInput,
  normalizeGstinInput,
  percentInputToBps,
  validateTaxSettingsForm,
  type TaxSettingsFormData,
} from "../../../lib/merchant-tax-helpers";

export interface TaxSettingsFormProps {
  storeId: string;
  settings: TaxSettingsDTO;
  canEdit: boolean;
  onSaved: (settings: TaxSettingsDTO) => void;
}

function toFormData(settings: TaxSettingsDTO): TaxSettingsFormData {
  return {
    isEnabled: settings.isEnabled,
    legalName: settings.legalName ?? "",
    gstin: settings.gstin ?? "",
    addressLine1: settings.addressLine1 ?? "",
    addressLine2: settings.addressLine2 ?? "",
    city: settings.city ?? "",
    postalCode: settings.postalCode ?? "",
    defaultRatePercent: bpsToPercentInput(settings.defaultGstRateBps),
  };
}

export function TaxSettingsForm({
  storeId,
  settings,
  canEdit,
  onSaved,
}: TaxSettingsFormProps) {
  const initial = useMemo(() => toFormData(settings), [settings]);
  const [data, setData] = useState<TaxSettingsFormData>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setData(initial);
    setFieldErrors({});
  }, [initial]);

  const isDirty = JSON.stringify(data) !== JSON.stringify(initial);

  const update = <K extends keyof TaxSettingsFormData>(
    key: K,
    value: TaxSettingsFormData[K],
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setApiError(null);
    if (fieldErrors[key as string]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;

    const errors = validateTaxSettingsForm(data);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setApiError(null);
    setSaved(false);
    try {
      const updated = await apiClient.patch<TaxSettingsDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/tax/settings`,
        {
          isEnabled: data.isEnabled,
          legalName: data.legalName,
          gstin: data.gstin || null,
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          postalCode: data.postalCode,
          defaultGstRateBps: percentInputToBps(data.defaultRatePercent) ?? 0,
        },
      );
      setSaved(true);
      onSaved(updated);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.fields && Object.keys(err.fields).length > 0) {
          setFieldErrors(err.fields);
        }
        setApiError(err.message);
      } else {
        setApiError("Could not save tax settings. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = !canEdit || isSaving;

  return (
    <form onSubmit={handleSave} className="space-y-8" data-testid="tax-settings-form" noValidate>
      {!canEdit && (
        <Alert variant="info" title="View only">
          Only a store admin or owner can change tax settings.
        </Alert>
      )}
      {apiError && (
        <Alert variant="danger" title="Could not save">
          {apiError}
        </Alert>
      )}
      {saved && (
        <Alert variant="success" title="Tax settings saved">
          New checkouts use these settings. Checkouts already in progress
          recalculate the next time they change.
        </Alert>
      )}

      {/* Switch */}
      <section className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.isEnabled}
            onChange={(e) => update("isEnabled", e.target.checked)}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-border accent-[var(--primary,currentColor)]"
            data-testid="tax-enabled-toggle"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-foreground">
              Charge GST on this store
            </span>
            <span className="block text-xs text-muted-foreground leading-relaxed max-w-[65ch]">
              When on, GST is calculated for every checkout from the buyer&apos;s
              shipping state and added to the price. Each paid order gets a
              numbered tax invoice. When off, nothing changes for your customers.
            </span>
          </span>
        </label>

        <p className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed max-w-[65ch] border-t border-border/50 pt-3">
          <ReceiptText size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Tax is added <strong className="text-foreground">on top of</strong>{" "}
            your listed prices (tax-exclusive). If your prices already include
            GST, lower them before turning this on, or customers will pay the
            tax twice.
          </span>
        </p>
      </section>

      {/* Registration */}
      <section className="space-y-5 border-t border-border/50 pt-6">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">GST registration</h2>
          <p className="text-xs text-muted-foreground">
            Printed on every invoice. Required before GST can be switched on.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Legal name"
            htmlFor="tax-legal-name"
            required={data.isEnabled}
            error={fieldErrors.legalName}
          >
            <Input
              id="tax-legal-name"
              value={data.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              disabled={disabled}
              maxLength={200}
              error={!!fieldErrors.legalName}
              placeholder="Acme Traders Pvt Ltd"
            />
          </FormField>

          <FormField
            label="GSTIN"
            htmlFor="tax-gstin"
            required={data.isEnabled}
            error={fieldErrors.gstin}
            helperText={
              settings.stateName
                ? `Registered in ${settings.stateName} (${settings.stateCode}). The first two digits set your state.`
                : "The first two digits are your state code."
            }
          >
            <Input
              id="tax-gstin"
              value={data.gstin}
              onChange={(e) => update("gstin", normalizeGstinInput(e.target.value))}
              disabled={disabled}
              error={!!fieldErrors.gstin}
              placeholder="27AAPFU0939F1ZV"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wide"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Address line 1"
            htmlFor="tax-address-1"
            required={data.isEnabled}
            error={fieldErrors.addressLine1}
          >
            <Input
              id="tax-address-1"
              value={data.addressLine1}
              onChange={(e) => update("addressLine1", e.target.value)}
              disabled={disabled}
              maxLength={200}
              error={!!fieldErrors.addressLine1}
            />
          </FormField>
          <FormField
            label="Address line 2"
            htmlFor="tax-address-2"
            error={fieldErrors.addressLine2}
          >
            <Input
              id="tax-address-2"
              value={data.addressLine2}
              onChange={(e) => update("addressLine2", e.target.value)}
              disabled={disabled}
              maxLength={200}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <FormField
            label="City"
            htmlFor="tax-city"
            required={data.isEnabled}
            error={fieldErrors.city}
          >
            <Input
              id="tax-city"
              value={data.city}
              onChange={(e) => update("city", e.target.value)}
              disabled={disabled}
              maxLength={100}
              error={!!fieldErrors.city}
            />
          </FormField>
          <FormField
            label="PIN code"
            htmlFor="tax-postal"
            required={data.isEnabled}
            error={fieldErrors.postalCode}
          >
            <Input
              id="tax-postal"
              value={data.postalCode}
              onChange={(e) => update("postalCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={disabled}
              inputMode="numeric"
              error={!!fieldErrors.postalCode}
              placeholder="400001"
              className="font-mono"
            />
          </FormField>
          <FormField
            label="Default GST rate (%)"
            htmlFor="tax-default-rate"
            error={fieldErrors.defaultRatePercent ?? fieldErrors.defaultGstRateBps}
            helperText="Used for any product without its own rate."
          >
            <Input
              id="tax-default-rate"
              value={data.defaultRatePercent}
              onChange={(e) => update("defaultRatePercent", e.target.value)}
              disabled={disabled}
              inputMode="decimal"
              error={!!(fieldErrors.defaultRatePercent ?? fieldErrors.defaultGstRateBps)}
              className="font-mono"
            />
          </FormField>
        </div>
      </section>

      {canEdit && (
        <div className="flex items-center gap-3 border-t border-border/50 pt-6">
          <Button
            type="submit"
            variant="primary"
            loading={isSaving}
            disabled={!isDirty || isSaving}
            icon={<Save size={14} />}
            data-testid="save-tax-settings"
          >
            Save tax settings
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || isSaving}
            onClick={() => {
              setData(initial);
              setFieldErrors({});
              setApiError(null);
              setSaved(false);
            }}
            icon={<RotateCcw size={14} />}
          >
            Discard changes
          </Button>
          {saved && !isDirty && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 size={14} aria-hidden="true" />
              Saved
            </span>
          )}
        </div>
      )}
    </form>
  );
}
