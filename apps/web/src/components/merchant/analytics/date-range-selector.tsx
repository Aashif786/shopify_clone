"use client";

import React, { useState } from "react";
import type { AnalyticsPeriodPreset, AnalyticsQueryDto } from "@shopify-clone/orders";
import { Button, Input, Select } from "@shopify-clone/ui";

interface DateRangeSelectorProps {
  currentQuery: AnalyticsQueryDto;
  onRangeChange: (query: AnalyticsQueryDto) => void;
  isLoading?: boolean;
}

const PRESET_OPTIONS: { value: AnalyticsPeriodPreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "current_month", label: "This month" },
  { value: "previous_month", label: "Last month" },
  { value: "custom", label: "Custom date range" },
];

export function DateRangeSelector({
  currentQuery,
  onRangeChange,
  isLoading,
}: DateRangeSelectorProps) {
  const currentPeriod = currentQuery.period ?? "30d";
  const [selectedPreset, setSelectedPreset] = useState<AnalyticsPeriodPreset>(currentPeriod);
  const [startDateInput, setStartDateInput] = useState<string>(
    currentQuery.startDate ? currentQuery.startDate.split("T")[0]! : ""
  );
  const [endDateInput, setEndDateInput] = useState<string>(
    currentQuery.endDate ? currentQuery.endDate.split("T")[0]! : ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePresetChange = (value: string) => {
    const preset = value as AnalyticsPeriodPreset;
    setSelectedPreset(preset);
    setValidationError(null);

    if (preset !== "custom") {
      onRangeChange({ period: preset });
    }
  };

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDateInput || !endDateInput) {
      setValidationError("Both start and end dates are required.");
      return;
    }
    const startMs = Date.parse(startDateInput);
    const endMs = Date.parse(endDateInput);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      setValidationError("Please enter valid dates.");
      return;
    }
    if (startMs > endMs) {
      setValidationError("Start date cannot be after end date.");
      return;
    }

    setValidationError(null);
    onRangeChange({
      period: "custom",
      startDate: new Date(startDateInput + "T00:00:00.000Z").toISOString(),
      endDate: new Date(endDateInput + "T23:59:59.999Z").toISOString(),
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            color: "var(--color-text-muted)",
          }}
        >
          Date Range:
        </span>
        <div style={{ minWidth: "160px" }}>
          <Select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={isLoading}
            options={PRESET_OPTIONS}
          />
        </div>
      </div>

      {selectedPreset === "custom" && (
        <form
          onSubmit={handleCustomApply}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              From:
            </span>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              disabled={isLoading}
              style={{ width: "150px" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              To:
            </span>
            <Input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              disabled={isLoading}
              style={{ width: "150px" }}
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
            Apply
          </Button>
        </form>
      )}

      {validationError && (
        <span
          style={{
            color: "var(--color-danger, #ef4444)",
            fontSize: "var(--font-size-xs)",
            marginLeft: "var(--space-2)",
          }}
        >
          {validationError}
        </span>
      )}
    </div>
  );
}
