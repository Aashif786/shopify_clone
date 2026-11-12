"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { NewsletterSubscriberDTO, NewsletterSubscriberListDTO } from "@calcart/customers";
import { Button, Card, EmptyState, Input, Spinner } from "@calcart/ui";
import {
  Download,
  Mail,
  Search,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Globe,
} from "lucide-react";
import { ApiClientError, apiClient } from "../../../lib/api-client";

export interface NewsletterSubscribersViewProps {
  storeId: string;
}

export function NewsletterSubscribersView({ storeId }: NewsletterSubscribersViewProps) {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriberDTO[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "SUBSCRIBED" | "UNSUBSCRIBED">("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscribers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status !== "ALL") params.set("status", status);
      params.set("limit", "100");

      const res = await apiClient.get<NewsletterSubscriberListDTO>(
        `/api/v1/stores/${encodeURIComponent(storeId)}/newsletter/subscribers?${params.toString()}`,
      );

      setSubscribers(res.items);
      setTotal(res.total);
      setActiveCount(res.activeCount);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to load subscribers");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load subscribers");
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeId, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSubscribers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadSubscribers]);

  const handleExportCsv = () => {
    const url = `/api/v1/stores/${encodeURIComponent(storeId)}/newsletter/subscribers?export=csv${
      status !== "ALL" ? `&status=${status}` : ""
    }${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`;
    window.open(url, "_blank");
  };

  const unsubscribedCount = Math.max(0, total - activeCount);

  return (
    <div className="space-y-6" data-testid="newsletter-subscribers-view">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Total Subscribers</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">{total}</span>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Active Subscriptions</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600">
              {activeCount}
            </span>
          </div>
        </Card>

        <Card className="p-4 rounded-xl border border-border/60 bg-card shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium block">Unsubscribed</span>
            <span className="text-2xl font-bold font-mono tracking-tight text-muted-foreground">
              {unsubscribedCount}
            </span>
          </div>
        </Card>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Input
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-medium"
              data-testid="subscriber-search-input"
            />
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setStatus("ALL")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === "ALL"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatus("SUBSCRIBED")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === "SUBSCRIBED"
                  ? "bg-background text-emerald-600 shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatus("UNSUBSCRIBED")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                status === "UNSUBSCRIBED"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubscribers}
            disabled={isLoading}
            className="h-8 text-xs gap-1.5"
            title="Refresh subscriber list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={total === 0}
            className="h-8 text-xs gap-1.5"
            title="Export subscribers as CSV"
            data-testid="export-subscribers-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Table Content */}
      <Card className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
        {isLoading && subscribers.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Spinner size="md" />
            <span className="text-xs">Loading subscribers...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={loadSubscribers}>
              Try Again
            </Button>
          </div>
        ) : subscribers.length === 0 ? (
          <EmptyState
            title="No Subscribers Found"
            description={
              search
                ? `No subscribers matching "${search}"`
                : "Customers who subscribe on your storefront landing page or checkout footer will appear here."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-border/60">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Subscriber Email</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Source</th>
                  <th className="py-2.5 px-4">Subscribed Date</th>
                  <th className="py-2.5 px-4">Unsubscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{sub.email}</span>
                    </td>
                    <td className="py-3 px-4">
                      {sub.status === "SUBSCRIBED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          Unsubscribed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      <span>{sub.source.replace(/_/g, " ")}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                      {new Date(sub.subscribedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                      {sub.unsubscribedAt
                        ? new Date(sub.unsubscribedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
