"use client";

import React, { useCallback, useEffect, useState } from "react";
import type {
  StoreCurrencyDTO,
  StoreCurrenciesResponseDTO,
  CurrencyRoundingRule,
} from "@calcart/types";
import { KNOWN_CURRENCIES, fetchFrankfurterRate } from "@calcart/types";
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
import {
  Coins,
  Plus,
  Trash2,
  Check,
  Globe,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { convertMinorUnits, formatCurrency } from "../../../lib/currency";

interface StoreCurrenciesManagerProps {
  storeId: string;
  storeCurrency: string;
  userRole?: string;
}

export function StoreCurrenciesManager({
  storeId,
  storeCurrency,
  userRole = "owner",
}: StoreCurrenciesManagerProps) {
  const isReadOnly = userRole === "staff";
  const [data, setData] = useState<StoreCurrenciesResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);

  // New currency modal / form state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState("USD");
  const [newExchangeRate, setNewExchangeRate] = useState("0.0119");
  const [newRoundingRule, setNewRoundingRule] = useState<CurrencyRoundingRule>("NONE");
  const [isFetchingLiveAdd, setIsFetchingLiveAdd] = useState(false);
  const [liveRateInfo, setLiveRateInfo] = useState<{ rate: number; date: string } | null>(null);

  // Interactive conversion tester
  const [testBaseAmount, setTestBaseAmount] = useState<number>(100000); // 1,000.00 base

  const loadCurrencies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<StoreCurrenciesResponseDTO>(
        `/api/v1/stores/${storeId}/currencies`
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load currencies");
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const fetchLiveRateForNew = useCallback(
    async (code: string) => {
      const base = data?.baseCurrency || storeCurrency;
      if (!code || code === base) return;
      setIsFetchingLiveAdd(true);
      try {
        const live = await fetchFrankfurterRate(base, code);
        setNewExchangeRate(String(live.rate));
        setLiveRateInfo({ rate: live.rate, date: live.date });
      } catch (err) {
        console.warn("Failed to fetch live rate from Frankfurter:", err);
      } finally {
        setIsFetchingLiveAdd(false);
      }
    },
    [data?.baseCurrency, storeCurrency]
  );

  const handleSyncAllLive = async () => {
    if (isReadOnly) return;
    setIsSyncingLive(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await apiClient.post<{
        synced: boolean;
        updatedCount: number;
        date?: string;
      }>(`/api/v1/stores/${storeId}/currencies/sync-live`, {}, { storeId });
      setSuccessMessage(
        `Successfully updated ${res.updatedCount} currencies to live Frankfurter exchange rates (as of ${res.date || "latest"}).`
      );
      await loadCurrencies();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sync currencies with Frankfurter API"
      );
    } finally {
      setIsSyncingLive(false);
    }
  };

  const handleUpdateCurrency = async (
    currency: string,
    exchangeRate: number,
    roundingRule: CurrencyRoundingRule,
    isEnabled: boolean
  ) => {
    if (isReadOnly) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.post(`/api/v1/stores/${storeId}/currencies`, {
        currency,
        exchangeRate,
        roundingRule,
        isEnabled,
      });
      setSuccessMessage(`Updated configuration for ${currency}`);
      await loadCurrencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${currency}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const rate = parseFloat(newExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      setError("Please enter a valid positive exchange rate");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/stores/${storeId}/currencies`, {
        currency: newCurrencyCode,
        exchangeRate: rate,
        roundingRule: newRoundingRule,
        isEnabled: true,
      });
      setSuccessMessage(`Added ${newCurrencyCode} to store currencies`);
      setIsAddOpen(false);
      await loadCurrencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to add ${newCurrencyCode}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrency = async (currency: string) => {
    if (isReadOnly) return;
    if (currency === storeCurrency) {
      setError("Cannot delete the store base settlement currency");
      return;
    }
    if (!window.confirm(`Are you sure you want to remove ${currency}?`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/stores/${storeId}/currencies/${currency}`);
      setSuccessMessage(`Removed ${currency}`);
      await loadCurrencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to remove ${currency}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Available currencies to add that are not already configured
  const existingCodes = new Set(data?.currencies.map((c) => c.currency) || []);
  const availableToAdd = Object.keys(KNOWN_CURRENCIES).filter((c) => !existingCodes.has(c));

  return (
    <Card className="border border-border/80 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-bold tracking-tight">
              Currencies & Multi-Market Presentment
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Display localized prices to international customers while authoritatively settling in{" "}
            <span className="font-semibold text-foreground font-mono">
              {data?.baseCurrency || storeCurrency}
            </span>
            .
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {!isReadOnly && data && data.currencies.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              disabled={isSyncingLive || isSaving}
              onClick={handleSyncAllLive}
              className="gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              title="Fetch latest exchange rates from Frankfurter API and update all configured store currencies"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingLive ? "animate-spin" : ""}`} />
              <span>{isSyncingLive ? "Syncing..." : "Sync Live Rates (Frankfurter)"}</span>
            </Button>
          )}

          {!isReadOnly && availableToAdd.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                const initialCode = availableToAdd[0] || "USD";
                setNewCurrencyCode(initialCode);
                fetchLiveRateForNew(initialCode);
                setIsAddOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Currency</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {error && (
          <Alert variant="danger" title="Error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" title="Success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spinner size="md" label="Loading currencies..." />
            <span className="text-xs text-muted-foreground">
              Fetching configured store exchange rates...
            </span>
          </div>
        ) : (
          <>
            {/* Currency List Table */}
            <div className="border border-border/70 rounded-xl overflow-hidden bg-card">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Currency</th>
                    <th className="py-3 px-4">Exchange Rate</th>
                    <th className="py-3 px-4">Rounding Rule</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data?.currencies.map((curr) => {
                    const isBase = curr.currency === (data?.baseCurrency || storeCurrency);
                    return (
                      <CurrencyRow
                        key={curr.currency}
                        currency={curr}
                        baseCurrency={data?.baseCurrency || storeCurrency}
                        isBase={isBase}
                        isReadOnly={isReadOnly}
                        onSave={(rate, rule, enabled) =>
                          handleUpdateCurrency(curr.currency, rate, rule, enabled)
                        }
                        onDelete={() => handleDeleteCurrency(curr.currency)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Interactive Live Conversion Previewer */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    Live Conversion Calculator
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Frankfurter FX Live
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Test Amount ({data?.baseCurrency || storeCurrency}):</span>
                  <input
                    type="number"
                    min="1"
                    value={testBaseAmount / 100}
                    onChange={(e) => setTestBaseAmount(Math.max(1, Math.round(Number(e.target.value) * 100)))}
                    className="w-24 px-2 py-0.5 text-xs rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {data?.currencies
                  .filter((c) => c.isEnabled)
                  .map((c) => {
                    const effectiveRate = c.liveRate || c.exchangeRate;
                    const converted = convertMinorUnits({
                      amountMinor: testBaseAmount,
                      exchangeRate: effectiveRate,
                      roundingRule: c.roundingRule,
                    });
                    return (
                      <div
                        key={c.currency}
                        className="p-2.5 rounded-lg border border-border/60 bg-background/80 flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                            {c.currency} ({c.name})
                          </span>
                          {c.liveRate && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono">
                              Live
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-mono font-bold text-foreground">
                          {formatCurrency(converted, c.currency)}
                        </span>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>1 {data?.baseCurrency || storeCurrency} = {effectiveRate}</span>
                          {c.roundingRule === "NINETY_NINE" && (
                            <span className="text-primary font-medium">.99 charm</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}

        {/* Add Currency Dialog */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Add Presentment Currency
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddCurrency} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Currency</label>
                  <select
                    value={newCurrencyCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setNewCurrencyCode(code);
                      fetchLiveRateForNew(code);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {availableToAdd.map((code) => {
                      const meta = KNOWN_CURRENCIES[code];
                      return (
                        <option key={code} value={code}>
                          {code} — {meta?.name} ({meta?.symbol})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Exchange Rate (1 {data?.baseCurrency || storeCurrency} =)
                    </label>
                    <button
                      type="button"
                      disabled={isFetchingLiveAdd}
                      onClick={() => fetchLiveRateForNew(newCurrencyCode)}
                      className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isFetchingLiveAdd ? "animate-spin" : ""}`} />
                      <span>Fetch Live Rate (Frankfurter)</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={newExchangeRate}
                    onChange={(e) => setNewExchangeRate(e.target.value)}
                    required
                    placeholder="e.g. 0.0119"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {liveRateInfo ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Live from Frankfurter API: 1 {data?.baseCurrency || storeCurrency} = {liveRateInfo.rate} {newCurrencyCode} (as of {liveRateInfo.date})</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Multiplier from base currency into {newCurrencyCode}.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Rounding Rule</label>
                  <select
                    value={newRoundingRule}
                    onChange={(e) =>
                      setNewRoundingRule(e.target.value as CurrencyRoundingRule)
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="NONE">Standard Exact Rounding</option>
                    <option value="NINETY_NINE">Charm Pricing (.99)</option>
                    <option value="INTEGER">Whole Integer (.00)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Add Currency"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CurrencyRow({
  currency,
  isBase,
  isReadOnly,
  onSave,
  onDelete,
}: {
  currency: StoreCurrencyDTO;
  baseCurrency?: string;
  isBase: boolean;
  isReadOnly: boolean;
  onSave: (rate: number, rule: CurrencyRoundingRule, enabled: boolean) => void;
  onDelete: () => void;
}) {
  const [rate, setRate] = useState(String(currency.exchangeRate));
  const [rule, setRule] = useState<CurrencyRoundingRule>(currency.roundingRule);
  const [enabled, setEnabled] = useState(currency.isEnabled);
  const [isDirty, setIsDirty] = useState(false);

  const handleRateChange = (val: string) => {
    setRate(val);
    setIsDirty(true);
  };

  const handleRuleChange = (val: CurrencyRoundingRule) => {
    setRule(val);
    setIsDirty(true);
  };

  const handleToggleEnabled = () => {
    if (isBase) return;
    const next = !enabled;
    setEnabled(next);
    onSave(parseFloat(rate) || currency.exchangeRate, rule, next);
  };

  const handleApply = () => {
    const parsed = parseFloat(rate);
    if (!isNaN(parsed) && parsed > 0) {
      onSave(parsed, rule, enabled);
      setIsDirty(false);
    }
  };

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="py-3 px-4 font-medium">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-foreground">{currency.currency}</span>
          <span className="text-xs text-muted-foreground">{currency.name}</span>
          {isBase && (
            <Badge variant="info" size="sm">
              Base Settlement
            </Badge>
          )}
        </div>
      </td>

      <td className="py-3 px-4 font-mono">
        {isBase ? (
          <span className="text-xs font-semibold text-muted-foreground">1.000000 (Authoritative)</span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.000001"
                min="0.000001"
                value={rate}
                onChange={(e) => handleRateChange(e.target.value)}
                disabled={isReadOnly}
                className="w-32 px-2.5 py-1 text-xs rounded border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {currency.liveRate && Math.abs(parseFloat(rate) - currency.liveRate) > 0.000001 && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setRate(String(currency.liveRate));
                    setIsDirty(true);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  title={`Use live Frankfurter rate (${currency.liveRate})`}
                >
                  Use Live
                </button>
              )}
            </div>
            {currency.liveRate ? (
              <span className="text-[10px] text-muted-foreground font-sans flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Live Frankfurter: <span className="font-mono font-medium">{currency.liveRate}</span>
              </span>
            ) : null}
          </div>
        )}
      </td>

      <td className="py-3 px-4">
        {isBase ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <select
            value={rule}
            onChange={(e) => handleRuleChange(e.target.value as CurrencyRoundingRule)}
            disabled={isReadOnly}
            className="px-2 py-1 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="NONE">Standard</option>
            <option value="NINETY_NINE">.99 Charm</option>
            <option value="INTEGER">Integer</option>
          </select>
        )}
      </td>

      <td className="py-3 px-4 text-center">
        {isBase ? (
          <Badge variant="success" size="sm">
            Active
          </Badge>
        ) : (
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isReadOnly}
            className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
              enabled
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {enabled ? "Active" : "Disabled"}
          </button>
        )}
      </td>

      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isDirty && (
            <Button size="sm" variant="primary" onClick={handleApply} className="h-7 px-2 text-xs">
              <Check className="w-3.5 h-3.5 mr-1" />
              Save
            </Button>
          )}
          {!isBase && !isReadOnly && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
              title={`Remove ${currency.currency}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
