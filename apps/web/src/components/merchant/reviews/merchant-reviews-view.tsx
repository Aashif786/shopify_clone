"use client";

import React, { useEffect, useState, useCallback } from "react";
import type {
  MerchantReviewDTO,
  MerchantReviewStatsDTO,
  ReviewModerationLogDTO,
  ReviewSortBy,
  ReviewStatus,
} from "@shopify-clone/products";
import { Card, Spinner } from "@shopify-clone/ui";
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MessageSquare,
  Search,
  Check,
  X,
  EyeOff,
  RotateCcw,
  Flag,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "../../../context/store-context";

export function MerchantReviewsView() {
  const { activeStore } = useStore();
  const [reviews, setReviews] = useState<MerchantReviewDTO[]>([]);
  const [stats, setStats] = useState<MerchantReviewStatsDTO>({
    total: 0,
    pending: 0,
    published: 0,
    rejected: 0,
    hidden: 0,
  });
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState<ReviewStatus | "ALL">("ALL");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<ReviewSortBy>("newest");

  // Moderation Dialogs
  const [activeReview, setActiveReview] = useState<MerchantReviewDTO | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<ReviewModerationLogDTO[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!activeStore?.id) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sortBy,
      });

      if (statusTab !== "ALL") {
        params.set("status", statusTab);
      }
      if (ratingFilter) {
        params.set("rating", ratingFilter.toString());
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/v1/stores/${activeStore.id}/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setReviews(data.data.items || []);
          setTotal(data.data.total || 0);
          if (data.data.stats) {
            setStats(data.data.stats);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch merchant reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id, page, statusTab, ratingFilter, searchQuery, sortBy]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleUpdateStatus = async (
    reviewId: string,
    status: ReviewStatus,
    reason?: string,
  ) => {
    if (!activeStore?.id) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/stores/${activeStore.id}/reviews/${reviewId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) {
        setIsRejectDialogOpen(false);
        setRejectReason("");
        await fetchReviews();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReplyDialog = (review: MerchantReviewDTO) => {
    setActiveReview(review);
    setReplyText(review.merchantReply || "");
    setIsReplyDialogOpen(true);
  };

  const handleSaveReply = async () => {
    if (!activeStore?.id || !activeReview) return;
    try {
      setActionLoading(true);
      const res = await fetch(
        `/api/v1/stores/${activeStore.id}/reviews/${activeReview.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyText }),
        },
      );
      if (res.ok) {
        setIsReplyDialogOpen(false);
        setActiveReview(null);
        await fetchReviews();
      }
    } catch (err) {
      console.error("Failed to save reply:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    if (!activeStore?.id) return;
    if (!window.confirm("Remove your store response to this review?")) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/stores/${activeStore.id}/reviews/${reviewId}/reply`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchReviews();
      }
    } catch (err) {
      console.error("Failed to delete reply:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenHistory = async (review: MerchantReviewDTO) => {
    if (!activeStore?.id) return;
    setActiveReview(review);
    try {
      const res = await fetch(`/api/v1/stores/${activeStore.id}/reviews/${review.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setHistoryLogs(data.data.moderationLogs || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch review history:", err);
    }
    setIsHistoryDialogOpen(true);
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={11} />
            <span>Published</span>
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={11} />
            <span>Pending</span>
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            <X size={11} />
            <span>Rejected</span>
          </span>
        );
      case "HIDDEN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/60">
            <EyeOff size={11} />
            <span>Hidden</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 w-full pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
              Feedback & Moderation
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Product Reviews
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            Moderate customer reviews, inspect verified buyer purchases, and manage public store responses.
          </p>
        </div>
      </div>

      {/* KPI Metrics Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="rounded-2xl border border-border/70 bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Total Reviews
          </span>
          <div className="text-2xl font-black font-mono text-foreground">{stats.total}</div>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card p-4 space-y-1 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Queue
            </span>
            {stats.pending > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <div className="text-2xl font-black font-mono text-foreground">{stats.pending}</div>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Published
          </span>
          <div className="text-2xl font-black font-mono text-foreground">{stats.published}</div>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-destructive">
            Rejected
          </span>
          <div className="text-2xl font-black font-mono text-foreground">{stats.rejected}</div>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card p-4 space-y-1 shadow-sm">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Hidden
          </span>
          <div className="text-2xl font-black font-mono text-foreground">{stats.hidden}</div>
        </Card>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        {(
          [
            { id: "ALL", label: "All Reviews", count: stats.total },
            { id: "PENDING", label: "Pending Queue", count: stats.pending },
            { id: "PUBLISHED", label: "Published", count: stats.published },
            { id: "REJECTED", label: "Rejected", count: stats.rejected },
            { id: "HIDDEN", label: "Hidden", count: stats.hidden },
          ] as const
        ).map((tab) => {
          const isActive = statusTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusTab(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                  isActive ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar: Search, Rating, Sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, feedback, customer, product..."
            className="w-full text-xs bg-card border border-border/70 rounded-xl pl-9 pr-4 py-2 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Rating and Sort Dropdowns */}
        <div className="flex items-center gap-2.5">
          <select
            value={ratingFilter ?? ""}
            onChange={(e) => {
              setRatingFilter(e.target.value ? parseInt(e.target.value, 10) : null);
              setPage(1);
            }}
            className="text-xs bg-card border border-border/70 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ReviewSortBy)}
            className="text-xs bg-card border border-border/70 rounded-xl px-3 py-2 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="highest_rated">Highest Rating</option>
            <option value="lowest_rated">Lowest Rating</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Reviews Table / Card Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 flex justify-center items-center text-muted-foreground gap-2">
            <Spinner size="md" />
            <span className="text-sm">Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Star size={24} className="stroke-1 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No Reviews in Queue</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              There are no reviews matching your current filters.
            </p>
          </Card>
        ) : (
          reviews.map((rev) => (
            <Card
              key={rev.id}
              className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:border-border transition-all shadow-sm"
              data-testid={`merchant-review-row-${rev.id}`}
            >
              {/* Row Header: Product link, Status badge, Rating, Date */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-border/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                      Product:
                    </span>
                    <a
                      href={`/merchant/products`}
                      className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>{rev.productTitle}</span>
                      <ArrowUpRight size={12} />
                    </a>

                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={10} />
                        <span>Verified Buyer</span>
                      </span>
                    )}

                    {rev.reportCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
                        <Flag size={10} />
                        <span>{rev.reportCount} Reports</span>
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground font-mono">
                    Customer: <span className="text-foreground font-semibold">{rev.customerName}</span>
                    {rev.customerEmail && <span> ({rev.customerEmail})</span>}
                    {rev.variantTitle && <span> • Variant: {rev.variantTitle}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(rev.status)}

                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={
                          s <= rev.rating
                            ? "fill-amber-400 text-amber-500"
                            : "text-muted-foreground/30 fill-transparent"
                        }
                      />
                    ))}
                  </div>

                  <time className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </time>
                </div>
              </div>

              {/* Review Body */}
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">{rev.title}</h4>
                <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-wrap">
                  {rev.content}
                </p>
              </div>

              {/* Moderation note / Rejection reason if present */}
              {rev.moderationReason && (
                <div className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-[11px] flex items-center gap-2">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>
                    <strong>Moderator Note:</strong> {rev.moderationReason}
                  </span>
                </div>
              )}

              {/* Existing Merchant Reply if present */}
              {rev.merchantReply && (
                <div className="pl-3.5 border-l-2 border-primary bg-primary/5 rounded-r-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary inline-flex items-center gap-1.5 text-[11px]">
                      <MessageSquare size={12} />
                      <span>Your Store Response</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteReply(rev.id)}
                      className="text-muted-foreground hover:text-destructive text-[10px] font-mono cursor-pointer"
                    >
                      Delete Response
                    </button>
                  </div>
                  <p className="text-foreground/90 whitespace-pre-wrap text-[11px]">
                    {rev.merchantReply}
                  </p>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenHistory(rev)}
                    className="btn btn-ghost btn-sm text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Clock size={12} />
                    <span>Audit History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenReplyDialog(rev)}
                    className="btn btn-ghost btn-sm text-[11px] font-medium text-primary hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare size={12} />
                    <span>{rev.merchantReply ? "Edit Reply" : "Reply to Customer"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {rev.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, "PUBLISHED")}
                        className="btn btn-primary btn-sm rounded-xl text-[11px] font-bold gap-1 cursor-pointer"
                        data-testid="approve-review-btn"
                      >
                        <Check size={12} />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReview(rev);
                          setRejectReason("");
                          setIsRejectDialogOpen(true);
                        }}
                        className="btn btn-outline btn-sm rounded-xl text-[11px] font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1 cursor-pointer"
                        data-testid="reject-review-btn"
                      >
                        <X size={12} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {rev.status === "PUBLISHED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rev.id, "HIDDEN")}
                        className="btn btn-outline btn-sm rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                      >
                        <EyeOff size={12} />
                        <span>Hide</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReview(rev);
                          setRejectReason("");
                          setIsRejectDialogOpen(true);
                        }}
                        className="btn btn-outline btn-sm rounded-xl text-[11px] font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1 cursor-pointer"
                      >
                        <X size={12} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {(rev.status === "REJECTED" || rev.status === "HIDDEN") && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(rev.id, "PUBLISHED")}
                      className="btn btn-outline btn-sm rounded-xl text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>Restore to Published</span>
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-3 pt-6 font-mono text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-xl border border-border/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/40 cursor-pointer"
          >
            Previous
          </button>
          <span className="text-muted-foreground">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl border border-border/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectDialogOpen && activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-destructive">
                Moderation Action
              </span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">
                Reject Customer Review
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Please provide a reason for rejecting this review. This reason will be logged for auditing.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="text-xs font-semibold text-foreground block">
                Rejection Reason
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Inappropriate language, commercial solicitation, unrelated content..."
                className="w-full text-xs bg-muted/40 border border-border/80 rounded-xl p-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-destructive"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectDialogOpen(false)}
                className="btn btn-outline btn-sm rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectReason.trim()}
                onClick={() => handleUpdateStatus(activeReview.id, "REJECTED", rejectReason)}
                className="btn btn-primary btn-sm rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
              >
                {actionLoading ? <Spinner size="sm" /> : <span>Confirm Rejection</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Reply Modal */}
      {isReplyDialogOpen && activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                Store Communication
              </span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">
                Reply to Review
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your response will appear publicly directly below this review on your storefront.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-xs space-y-1">
              <div className="font-semibold text-foreground">
                {activeReview.customerName}: &ldquo;{activeReview.title}&rdquo;
              </div>
              <p className="text-muted-foreground italic text-[11px] line-clamp-2">
                &ldquo;{activeReview.content}&rdquo;
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reply-text" className="text-xs font-semibold text-foreground block">
                Public Response
              </label>
              <textarea
                id="reply-text"
                rows={4}
                required
                maxLength={2000}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Thank the customer, address their feedback, or explain resolution steps..."
                className="w-full text-xs bg-muted/40 border border-border/80 rounded-xl p-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReplyDialogOpen(false)}
                className="btn btn-outline btn-sm rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !replyText.trim()}
                onClick={handleSaveReply}
                className="btn btn-primary btn-sm rounded-xl text-xs font-bold cursor-pointer"
              >
                {actionLoading ? <Spinner size="sm" /> : <span>Publish Response</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Drawer / Modal */}
      {isHistoryDialogOpen && activeReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                  Audit Trail
                </span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">
                  Moderation History
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDialogOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {historyLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No moderation changes recorded for this review yet.
                </p>
              ) : (
                historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-muted/30 border border-border/60 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                      <span>Status Transition</span>
                      <time>{new Date(log.createdAt).toLocaleString()}</time>
                    </div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5 pt-0.5">
                      <span className="text-muted-foreground">{log.previousStatus}</span>
                      <ChevronRight size={12} className="text-border" />
                      <span className="text-primary">{log.newStatus}</span>
                    </div>
                    {log.reason && (
                      <p className="text-muted-foreground pt-1 text-[11px]">
                        <strong>Reason:</strong> {log.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsHistoryDialogOpen(false)}
                className="btn btn-outline btn-sm rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
