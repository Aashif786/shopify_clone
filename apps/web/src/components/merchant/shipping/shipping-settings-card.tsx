"use client";

import React, { useEffect, useState } from "react";
import type { ShippingSettingsDTO } from "@calcart/shipping";
import { Alert, Button, FormField, Input } from "@calcart/ui";
import { Save } from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { formatGrams, parseGrams } from "../../../lib/merchant-shipping-helpers";

export interface ShippingSettingsCardProps {
  storeId: string;
  settings: ShippingSettingsDTO;
  canEdit: boolean;
  onSaved: (settings: ShippingSettingsDTO) => void;
}

export function ShippingSettingsCard({
  storeId,
  settings,
  canEdit,
  onSaved,
}: ShippingSettingsCardProps) {
  const [enabled, setEnabled] = useState(settings.isEnabled);
  const [weight, setWeight] = useState(String(settings.defaultWeightGrams));
  const [weightError, setWeightError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEnabled(settings.isEnabled);
    setWeight(String(settings.defaultWeightGrams));
  }, [settings]);

  const isDirty =
    enabled !== settings.isEnabled || weight.trim() !== String(settings.defaultWeightGrams);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;

    const grams = parseGrams(weight);
    if (grams === null) {
      setWeightError("Enter a whole number of grams, for example 500");
      return;
    }
    setWeightError(null);
    setApiError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<ShippingSettingsDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/shipping/settings`,
        { isEnabled: enabled, defaultWeightGrams: grams },
      );
      setSaved(true);
      onSaved(updated);
    } catch (err: unknown) {
      setApiError(
        err instanceof ApiClientError ? err.message : "Could not save shipping settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5" data-testid="shipping-settings-form" noValidate>
      {!canEdit && (
        <Alert variant="info" title="View only">
          Only a store admin or owner can change shipping settings.
        </Alert>
      )}
      {apiError && (
        <Alert variant="danger" title="Could not save">
          {apiError}
        </Alert>
      )}
      {saved && (
        <Alert variant="success" title="Shipping settings saved">
          New and updated checkouts use these settings.
        </Alert>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
          disabled={!canEdit || isSaving}
          className="mt-1 h-4 w-4 rounded border-border accent-[var(--primary,currentColor)]"
          data-testid="shipping-enabled-toggle"
        />
        <span className="space-y-1">
          <span className="block text-sm font-semibold text-foreground">
            Price shipping by rules
          </span>
          <span className="block text-xs text-muted-foreground leading-relaxed max-w-[65ch]">
            When on, checkout offers the delivery options from your zones and rates below, and
            a customer cannot pay for an address you have no option for. When off, shipping
            stays exactly as it is today.
          </span>
        </span>
      </label>

      <FormField
        label="Default parcel weight (grams)"
        htmlFor="shipping-default-weight"
        error={weightError}
        helperText={`Used for any product without its own weight. Currently ${formatGrams(settings.defaultWeightGrams)}.`}
        className="max-w-xs"
      >
        <Input
          id="shipping-default-weight"
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            setSaved(false);
          }}
          disabled={!canEdit || isSaving}
          inputMode="numeric"
          error={!!weightError}
          className="font-mono"
        />
      </FormField>

      {canEdit && (
        <Button
          type="submit"
          variant="primary"
          loading={isSaving}
          disabled={!isDirty || isSaving}
          icon={<Save size={14} />}
          data-testid="save-shipping-settings"
        >
          Save settings
        </Button>
      )}
    </form>
  );
}
