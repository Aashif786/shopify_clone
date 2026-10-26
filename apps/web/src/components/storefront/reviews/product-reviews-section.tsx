"use client";

import React, { useEffect, useState, useCallback } from "react";
import type {
  ProductReviewDTO,
  ProductReviewSummaryDTO,
  ReviewEligibilityDTO,
  ReviewSortBy,
} from "@shopify-clone/products";
import { Card, Spinner } from "@shopify-clone/ui";
import {
  Star,
  CheckCircle2,
  Flag,
  Edit2,
  Trash2,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";
import { useOptionalAuth } from "../../../context/auth-context";

export interface ProductReviewsSectionProps {
  product: {
    id: string;
    slug: string;
    title: string;
  };
  storeSlug: string;
}

export function ProductReviewsSection({ product, storeSlug }: ProductReviewsSectionProps) {
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [reviews, setReviews] = useState<ProductReviewDTO[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummaryDTO>({
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [eligibility, setEligibility] = useState<ReviewEligibilityDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<ReviewSortBy>("newest");
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  // Modal states
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("Inappropriate Content");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Form states for write/edit
  const [formRating, setFormRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        sortBy,
      });
      if (selectedRatingFilter) {
        params.set("rating", selectedRatingFilter.toString());
      }

      const res = await fetch(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setReviews(data.data.items || []);
          setTotal(data.data.total || 0);
          if (data.data.summary) {
            setSummary(data.data.summary);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [storeSlug, product.slug, page, sortBy, selectedRatingFilter]);

  const fetchEligibility = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews/eligibility`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setEligibility(data.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch eligibility:", err);
    }
  }, [storeSlug, product.slug]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility, user]);

  const handleOpenWriteModal = (existing?: ProductReviewDTO | null) => {
    if (existing) {
      setIsEditing(true);
      setEditingReviewId(existing.id);
      setFormRating(existing.rating);
      setFormTitle(existing.title);
      setFormContent(existing.content);
    } else {
      setIsEditing(false);
      setEditingReviewId(null);
      setFormRating(5);
      setFormTitle("");
      setFormContent("");
    }
    setFormError(null);
    setIsWriteModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Please enter a review headline");
      return;
    }
    if (!formContent.trim()) {
      setFormError("Please write your review feedback");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && editingReviewId) {
        const res = await fetch(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews/${editingReviewId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rating: formRating,
              title: formTitle.trim(),
              content: formContent.trim(),
            }),
          },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to update review");
        }
      } else {
        const res = await fetch(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rating: formRating,
              title: formTitle.trim(),
              content: formContent.trim(),
              orderId: eligibility?.eligibleOrderId,
              variantId: eligibility?.eligibleVariantId,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || "Failed to submit review");
        }
      }

      setIsWriteModalOpen(false);
      await Promise.all([fetchReviews(), fetchEligibility()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete your review?")) return;

    try {
      const res = await fetch(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews/${reviewId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await Promise.all([fetchReviews(), fetchEligibility()]);
      }
    } catch (err) {
      console.error("Failed to delete review:", err);
    }
  };

  const handleOpenReportModal = (reviewId: string) => {
    setReportingReviewId(reviewId);
    setReportReason("Inappropriate Content");
    setReportDetails("");
    setReportSuccess(false);
    setIsReportModalOpen(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReviewId) return;

    try {
      const res = await fetch(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}/reviews/${reportingReviewId}/report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: reportReason,
            details: reportDetails.trim() || undefined,
          }),
        },
      );
      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setIsReportModalOpen(false);
          setReportingReviewId(null);
        }, 1200);
      }
    } catch (err) {
      console.error("Failed to report review:", err);
    }
  };

  const ratingLabels: Record<number, string> = {
    5: "5 Stars - Exceptional",
    4: "4 Stars - Very Good",
    3: "3 Stars - Average",
    2: "2 Stars - Poor",
    1: "1 Star - Terrible",
  };

  return (
    <section id="reviews-section" className="mt-16 pt-12 border-t border-border/60 space-y-10">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
              Verified Feedback
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Ratings & Reviews
          </h2>
        </div>

        {/* Action Button */}
        <div>
          {eligibility?.existingReview ? (
            <button
              type="button"
              onClick={() => handleOpenWriteModal(eligibility.existingReview)}
              className="btn btn-outline btn-md rounded-2xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted/50 cursor-pointer"
              data-testid="edit-review-btn"
            >
              <Edit2 size={14} />
              <span>Edit Your Review</span>
            </button>
          ) : eligibility?.canReview ? (
            <button
              type="button"
              onClick={() => handleOpenWriteModal(null)}
              className="btn btn-primary btn-md rounded-2xl text-xs font-bold gap-2 shadow-md shadow-primary/10 hover:shadow-primary/25 cursor-pointer"
              data-testid="write-review-btn"
            >
              <Sparkles size={14} />
              <span>Write a Review</span>
            </button>
          ) : !user ? (
            <a
              href={`/stores/${encodeURIComponent(storeSlug)}/login?returnUrl=/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(product.slug)}`}
              className="btn btn-outline btn-md rounded-2xl text-xs font-semibold gap-2 border-border/80 hover:bg-muted/50 inline-flex items-center"
            >
              <span>Sign in to Review</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
              <ShieldCheck size={14} className="text-primary" />
              <span>Verified buyers only</span>
            </span>
          )}
        </div>
      </div>

      {/* Aggregate Rating Summary & Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Left: Overall Score Card */}
        <div className="md:col-span-4 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center shadow-sm">
          <span className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-foreground">
            {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "—"}
          </span>
          <div className="flex items-center gap-1 text-amber-500 my-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                className={
                  star <= Math.round(summary.averageRating)
                    ? "fill-amber-400 text-amber-500"
                    : "text-muted-foreground/30 fill-transparent"
                }
              />
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground font-mono">
            {summary.totalReviews > 0
              ? `Based on ${summary.totalReviews} ${summary.totalReviews === 1 ? "review" : "reviews"}`
              : "No customer reviews yet"}
          </p>
        </div>

        {/* Right: 5-Star Distribution Bars */}
        <div className="md:col-span-8 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-center space-y-2.5 shadow-sm">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star as 1 | 2 | 3 | 4 | 5] || 0;
            const pct = summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0;
            const isSelected = selectedRatingFilter === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRatingFilter(isSelected ? null : star)}
                className={`flex items-center gap-3 text-xs w-full py-1 px-2 rounded-xl transition-colors cursor-pointer group text-left ${
                  isSelected ? "bg-primary/10 font-bold" : "hover:bg-muted/40"
                }`}
                title={`Filter by ${star} stars`}
              >
                <span className="w-12 font-mono font-medium text-foreground flex items-center gap-1 shrink-0">
                  <span>{star}</span>
                  <Star size={12} className="fill-amber-400 text-amber-500" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden relative">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-muted-foreground shrink-0 text-[11px]">
                  {pct}%
                </span>
                <span className="w-8 text-right font-mono text-muted-foreground/60 shrink-0 text-[11px]">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: Filter & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          {selectedRatingFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              <span>{selectedRatingFilter} Stars Only</span>
              <button
                type="button"
                onClick={() => setSelectedRatingFilter(null)}
                className="hover:text-primary/70 cursor-pointer"
                aria-label="Clear star filter"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            Showing {reviews.length} of {total} reviews
          </span>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="review-sort" className="text-xs text-muted-foreground font-medium">
            Sort by:
          </label>
          <select
            id="review-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as ReviewSortBy)}
            className="text-xs bg-muted/50 border border-border/70 rounded-xl px-3 py-1.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="highest_rated">Highest Rated</option>
            <option value="lowest_rated">Lowest Rated</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center items-center text-muted-foreground gap-2">
            <Spinner size="md" />
            <span className="text-sm">Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <Card className="rounded-3xl border border-dashed border-border/80 bg-card/40 p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Star size={24} className="stroke-1 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No Reviews Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {selectedRatingFilter
                ? `There are no ${selectedRatingFilter}-star reviews for this product yet.`
                : "Be the first verified customer to share your thoughts on this product!"}
            </p>
          </Card>
        ) : (
          reviews.map((rev) => {
            const isOwner = eligibility?.existingReview?.id === rev.id;

            return (
              <Card
                key={rev.id}
                className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 sm:p-7 space-y-4 transition-all hover:border-border"
                data-testid={`review-card-${rev.id}`}
              >
                {/* Review Header: User details, rating, date */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        {rev.customerName || "Customer"}
                      </span>

                      {rev.isVerifiedPurchase && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          title="Verified Purchaser"
                          data-testid="verified-purchase-badge"
                        >
                          <CheckCircle2 size={11} className="shrink-0" />
                          <span>Verified Purchase</span>
                        </span>
                      )}

                      {isOwner && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                          Your Review
                        </span>
                      )}
                    </div>

                    {rev.variantTitle && (
                      <span className="text-[11px] font-mono text-muted-foreground/80 block">
                        Purchased: {rev.variantTitle}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-amber-500" aria-label={`${rev.rating} out of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={15}
                          className={
                            s <= rev.rating
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground/25 fill-transparent"
                          }
                        />
                      ))}
                    </div>
                    <time
                      dateTime={rev.createdAt}
                      className="text-[11px] font-mono text-muted-foreground whitespace-nowrap"
                    >
                      {new Date(rev.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                </div>

                {/* Review Content */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-foreground tracking-tight">
                    {rev.title}
                  </h4>
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                    {rev.content}
                  </p>
                </div>

                {/* Merchant Reply if present */}
                {rev.merchantReply && (
                  <div className="mt-3 pl-4 border-l-2 border-primary bg-primary/5 rounded-r-2xl p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-primary inline-flex items-center gap-1.5">
                        <MessageSquare size={13} />
                        <span>Store Response</span>
                      </span>
                      {rev.merchantReplyAt && (
                        <time className="font-mono text-[10px] text-muted-foreground">
                          {new Date(rev.merchantReplyAt).toLocaleDateString()}
                        </time>
                      )}
                    </div>
                    <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {rev.merchantReply}
                    </p>
                  </div>
                )}

                {/* Bottom Card Actions: Edit/Delete for owner, Report for others */}
                <div className="flex items-center justify-end gap-3 pt-2 text-xs">
                  {isOwner ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenWriteModal(rev)}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                        data-testid="edit-own-review-btn"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                      <span className="text-border" aria-hidden="true">•</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev.id)}
                        className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 transition-colors cursor-pointer"
                        data-testid="delete-own-review-btn"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenReportModal(rev.id)}
                      className="text-muted-foreground/70 hover:text-muted-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
                      title="Report inappropriate review"
                    >
                      <Flag size={12} />
                      <span>Report</span>
                    </button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {total > 10 && (
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
            Page {page} of {Math.ceil(total / 10)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl border border-border/70 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* Write / Edit Review Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl space-y-6 relative">
            <button
              type="button"
              onClick={() => setIsWriteModalOpen(false)}
              className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
                {isEditing ? "Edit Feedback" : "Share Experience"}
              </span>
              <h3 className="text-xl font-bold text-foreground mt-0.5">
                {isEditing ? "Edit Your Review" : `Review ${product.title}`}
              </h3>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Star Rating Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Overall Rating
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFormRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        aria-label={`Select ${star} stars`}
                      >
                        <Star
                          size={24}
                          className={
                            star <= (hoverRating ?? formRating)
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground/30 fill-transparent"
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {ratingLabels[hoverRating ?? formRating]}
                  </span>
                </div>
              </div>

              {/* Review Headline / Title */}
              <div className="space-y-1.5">
                <label htmlFor="review-title" className="text-xs font-semibold text-foreground block">
                  Review Headline
                </label>
                <input
                  id="review-title"
                  type="text"
                  required
                  maxLength={150}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Exceptional craftsmanship and fit"
                  className="w-full text-sm bg-muted/30 border border-border/80 rounded-2xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  data-testid="review-title-input"
                />
              </div>

              {/* Review Written Feedback */}
              <div className="space-y-1.5">
                <label htmlFor="review-content" className="text-xs font-semibold text-foreground block">
                  Written Feedback
                </label>
                <textarea
                  id="review-content"
                  required
                  rows={4}
                  maxLength={3000}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="How does this item fit, feel, and perform? Any details that would help future buyers?"
                  className="w-full text-sm bg-muted/30 border border-border/80 rounded-2xl p-4 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                  data-testid="review-content-input"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="btn btn-outline btn-md rounded-2xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-md rounded-2xl text-xs font-bold gap-2 cursor-pointer"
                  data-testid="submit-review-btn"
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isEditing ? "Update Review" : "Submit Review"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Review Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-2xl space-y-5 relative">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-destructive">
                Flag Review
              </span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">
                Report Inappropriate Content
              </h3>
            </div>

            {reportSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span>Thank you. Your report has been submitted to moderators.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="report-reason" className="text-xs font-semibold text-foreground block">
                    Reason for report
                  </label>
                  <select
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-sm bg-muted/40 border border-border/80 rounded-2xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="Inappropriate Content">Inappropriate Content</option>
                    <option value="Spam or Advertising">Spam or Advertising</option>
                    <option value="Misleading Information">Misleading Information</option>
                    <option value="Offensive Language">Offensive Language</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="report-details" className="text-xs font-semibold text-foreground block">
                    Additional Details (Optional)
                  </label>
                  <textarea
                    id="report-details"
                    rows={3}
                    maxLength={1000}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide any additional context for moderators..."
                    className="w-full text-sm bg-muted/30 border border-border/80 rounded-2xl p-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="btn btn-outline btn-md rounded-2xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-md rounded-2xl text-xs font-bold cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
