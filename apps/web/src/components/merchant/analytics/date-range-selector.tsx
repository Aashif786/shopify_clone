"use client";

import React, { useState } from "react";
import type { AnalyticsPeriodPreset, AnalyticsQueryDto } from "@calcart/orders";
import { Button, Input, Select } from "@calcart/ui";

interface DateRangeSelectorProps {
  currentQuery: AnalyticsQueryDto;
  onRangeChange: (query: AnalyticsQueryDto) => void;
  isLoading?: boolean;
}

const PRESET_OPTIONS: { value: AnalyticsPeriodPreset; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "current_month", label: "This Month" },
  { value: "previous_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const QUICK_PRESETS: { value: AnalyticsPeriodPreset; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
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

  const handlePresetSelect = (preset: AnalyticsPeriodPreset) => {
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
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Quick Segmented Toggle for 7d, 30d, 90d */}
      <div className="inline-flex items-center p-0.5 rounded-lg border border-border/60 bg-muted/30">
        {QUICK_PRESETS.map((p) => {
          const isActive = selectedPreset === p.value;
          return (
            <button
              key={p.value}
              type="button"
              disabled={isLoading}
              onClick={() => handlePresetSelect(p.value)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                isActive
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Select Dropdown for Full List & Custom */}
      <div className="min-w-[130px]">
        <Select
          value={selectedPreset}
          onChange={(e) => handlePresetSelect(e.target.value as AnalyticsPeriodPreset)}
          disabled={isLoading}
          options={PRESET_OPTIONS}
        />
      </div>

      {/* Custom Date Form */}
      {selectedPreset === "custom" && (
        <form
          onSubmit={handleCustomApply}
          className="flex flex-wrap items-center gap-2 p-1.5 rounded-lg border border-border/60 bg-card shadow-xs"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">From:</span>
            <Input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              disabled={isLoading}
              className="h-7 w-[130px] font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">To:</span>
            <Input
              type="date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              disabled={isLoading}
              className="h-7 w-[130px] font-mono text-xs"
            />
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="h-7 px-2.5 text-xs">
            Apply
          </Button>
        </form>
      )}

      {validationError && (
        <span className="text-destructive text-xs font-medium ml-1">
          {validationError}
        </span>
      )}
    </div>
  );
}
