"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { StoreClassificationDTO, StoreTypeDTO } from "@calcart/stores";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from "@calcart/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";

export interface StoreClassificationCardProps {
  storeId: string;
  userRole?: "owner" | "admin" | "staff";
}

interface ClassificationResponse {
  classification: StoreClassificationDTO;
  availableTypes: StoreTypeDTO[];
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) return err.message || fallback;
  return err instanceof Error ? err.message : fallback;
}

export function StoreClassificationCard({
  storeId,
  userRole = "owner",
}: StoreClassificationCardProps) {
  const [classification, setClassification] = useState<StoreClassificationDTO | null>(null);
  const [types, setTypes] = useState<StoreTypeDTO[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canEdit = userRole === "owner" || userRole === "admin";

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ClassificationResponse>(
        `/api/v1/stores/${storeId}/classification`,
      );
      setClassification(data.classification);
      setTypes(data.availableTypes);
      setSelectedTypeId(data.classification.storeType.id);
    } catch (err) {
      setError(messageOf(err, "Failed to load store classification."));
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedType = types.find((t) => t.id === selectedTypeId);
  const typeChanged = !!classification && selectedTypeId !== classification.storeType.id;
  const needsConfirmation =
    typeChanged && !!classification?.fitCheckEnabled && selectedType?.isFashion === false;

  const saveType = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.patch<
        StoreClassificationDTO & { fitCheckDisabled: boolean }
      >(`/api/v1/stores/${storeId}/classification`, {
        storeTypeId: selectedTypeId,
        confirmDisableFitCheck: needsConfirmation,
      });
      setClassification(result);
      setNotice(
        result.fitCheckDisabled
          ? "Store type updated. Fit Check was disabled because the new type is not eligible."
          : "Store type updated.",
      );
    } catch (err) {
      setError(messageOf(err, "Failed to update store type."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFitCheck = async (enabled: boolean) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.patch<{ classification: StoreClassificationDTO }>(
        `/api/v1/stores/${storeId}/fit-check`,
        { enabled },
      );
      setClassification(result.classification);
      setNotice(enabled ? "Fit Check enabled." : "Fit Check disabled.");
    } catch (err) {
      setError(messageOf(err, "Failed to update Fit Check."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store type &amp; Fit Check</CardTitle>
        <CardDescription>
          Classify your store. Clothing / fashion stores can offer customers a 3D virtual try-on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && <Spinner size="sm" label="Loading classification..." />}

        {error && (
          <Alert
            variant="danger"
            title="Something went wrong"
            action={
              !classification ? (
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            {error}
          </Alert>
        )}
        {notice && <Alert variant="success">{notice}</Alert>}

        {classification && (
          <>
            <div className="space-y-2">
              <label htmlFor="store-type-select" className="text-sm font-medium">
                Store type
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  id="store-type-select"
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  disabled={!canEdit || isSaving}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => void saveType()}
                  disabled={!canEdit || !typeChanged || isSaving}
                >
                  {needsConfirmation ? "Change and disable Fit Check" : "Save store type"}
                </Button>
              </div>
              {selectedType?.description && (
                <p className="text-xs text-muted-foreground">{selectedType.description}</p>
              )}
              {needsConfirmation && (
                <Alert variant="warning" title="Fit Check will be disabled">
                  The selected type is not clothing / fashion. Saving turns Fit Check off for your
                  storefront.
                </Alert>
              )}
              {!canEdit && (
                <p className="text-xs text-muted-foreground">
                  Only store owners and admins can change this setting.
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-border/60 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Fit Check (3D virtual try-on)</p>
                  <p className="text-xs text-muted-foreground">
                    {classification.fitCheckEligible
                      ? "Supported for your store type. It stays off until you enable it."
                      : "Not supported for this store type. Choose a clothing / fashion type to use it."}
                  </p>
                </div>
                <Badge variant={classification.fitCheckEnabled ? "success" : "neutral"}>
                  {classification.fitCheckEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <Button
                variant={classification.fitCheckEnabled ? "outline" : "primary"}
                disabled={
                  !canEdit ||
                  isSaving ||
                  (!classification.fitCheckEnabled && !classification.fitCheckEligible)
                }
                onClick={() => void toggleFitCheck(!classification.fitCheckEnabled)}
              >
                {classification.fitCheckEnabled ? "Disable Fit Check" : "Enable Fit Check"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
