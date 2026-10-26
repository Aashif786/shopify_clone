import { generateUuidV7, type DatabaseClient } from "@shopify-clone/db";
import type {
  ProductReview,
  ReviewModerationLog,
  ReviewReport,
  ReviewStatus,
} from "../domain/entities.js";
import {
  DuplicateReviewError,
  InvalidRatingError,
  ProductNotFoundError,
  ReviewEligibilityError,
  ReviewForbiddenError,
  ReviewNotFoundError,
} from "../domain/errors.js";
import { ReviewRepository } from "../infrastructure/review-repository.js";
import { ProductRepository } from "../infrastructure/product-repository.js";
import type {
  CreateReviewInput,
  ListMerchantReviewsFilterOptions,
  ListPublishedReviewsFilterOptions,
  MerchantReviewDTO,
  MerchantReviewStatsDTO,
  ModerateReviewInput,
  ProductReviewDTO,
  ProductReviewSummaryDTO,
  ReviewEligibilityDTO,
  ReviewReportInput,
  UpdateReviewInput,
} from "./dtos.js";

function toReviewDTO(
  review: ProductReview & { variantTitle?: string | null },
): ProductReviewDTO {
  return {
    id: review.id,
    storeId: review.storeId,
    productId: review.productId,
    customerId: review.customerId,
    orderId: review.orderId,
    variantId: review.variantId,
    variantTitle: review.variantTitle ?? undefined,
    rating: review.rating,
    title: review.title,
    content: review.content,
    status: review.status,
    isVerifiedPurchase: review.isVerifiedPurchase,
    customerName: review.customerNameSnapshot,
    merchantReply: review.merchantReply,
    merchantReplyAt: review.merchantReplyAt?.toISOString() ?? null,
    reportCount: review.reportCount,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

function toMerchantReviewDTO(
  review: ProductReview & {
    productTitle?: string | null;
    productSlug?: string | null;
    variantTitle?: string | null;
  },
  logs: ReviewModerationLog[] = [],
): MerchantReviewDTO {
  return {
    ...toReviewDTO(review),
    customerEmail: review.customerEmailSnapshot,
    productTitle: review.productTitle ?? "",
    productSlug: review.productSlug ?? "",
    moderatedAt: review.moderatedAt?.toISOString() ?? null,
    moderatedByUserId: review.moderatedByUserId,
    moderationReason: review.moderationReason,
    moderationLogs: logs.map((log) => ({
      id: log.id,
      reviewId: log.reviewId,
      userId: log.userId,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      reason: log.reason,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export class ReviewService {
  constructor(
    private readonly reviewRepo: ReviewRepository = new ReviewRepository(),
    private readonly productRepo: ProductRepository = new ProductRepository(),
  ) {}

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new InvalidRatingError("Rating must be an integer between 1 and 5");
    }
  }

  private validateReviewContent(title: string, content: string): void {
    const trimmedTitle = title?.trim() ?? "";
    const trimmedContent = content?.trim() ?? "";
    if (trimmedTitle.length < 1 || trimmedTitle.length > 150) {
      throw new Error("Review title must be between 1 and 150 characters");
    }
    if (trimmedContent.length < 1 || trimmedContent.length > 3000) {
      throw new Error("Review content must be between 1 and 3000 characters");
    }
  }

  async checkEligibility(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    customerId?: string | null,
    orderId?: string | null,
  ): Promise<ReviewEligibilityDTO> {
    const product = await this.productRepo.findProductById(db, storeId, productId);
    if (!product) {
      throw new ProductNotFoundError(`Product not found: ${productId}`);
    }

    if (!customerId) {
      return {
        canReview: false,
        isVerified: false,
        eligibleOrderId: null,
        eligibleVariantId: null,
        existingReview: null,
        message: "Please sign in to write a review.",
      };
    }

    if (orderId) {
      const specificPurchase = await this.reviewRepo.findCustomerPurchase(
        db,
        storeId,
        customerId,
        productId,
        { orderId },
      );

      if (!specificPurchase) {
        return {
          canReview: false,
          isVerified: false,
          eligibleOrderId: null,
          eligibleVariantId: null,
          existingReview: null,
          message: "No eligible purchase of this product was found in the specified order.",
        };
      }

      const existingReview = await this.reviewRepo.findReviewByCustomerAndProduct(
        db,
        storeId,
        customerId,
        productId,
        specificPurchase.orderId,
      );

      if (existingReview) {
        return {
          canReview: false,
          isVerified: existingReview.isVerifiedPurchase,
          eligibleOrderId: existingReview.orderId,
          eligibleVariantId: existingReview.variantId,
          existingReview: toReviewDTO(existingReview),
          message: "You have already reviewed this purchase.",
        };
      }

      return {
        canReview: true,
        isVerified: true,
        eligibleOrderId: specificPurchase.orderId,
        eligibleVariantId: specificPurchase.variantId,
        existingReview: null,
        message: "Verified buyer. You are eligible to review this product.",
      };
    }

    const unreviewedPurchase = await this.reviewRepo.findCustomerPurchase(
      db,
      storeId,
      customerId,
      productId,
      { unreviewedOnly: true },
    );

    if (unreviewedPurchase) {
      return {
        canReview: true,
        isVerified: true,
        eligibleOrderId: unreviewedPurchase.orderId,
        eligibleVariantId: unreviewedPurchase.variantId,
        existingReview: null,
        message: "Verified buyer. You are eligible to review this product.",
      };
    }

    const anyPurchase = await this.reviewRepo.findCustomerPurchase(
      db,
      storeId,
      customerId,
      productId,
    );

    if (anyPurchase) {
      const existingReview = await this.reviewRepo.findReviewByCustomerAndProduct(
        db,
        storeId,
        customerId,
        productId,
        anyPurchase.orderId,
      );

      return {
        canReview: false,
        isVerified: existingReview?.isVerifiedPurchase ?? true,
        eligibleOrderId: anyPurchase.orderId,
        eligibleVariantId: anyPurchase.variantId,
        existingReview: existingReview ? toReviewDTO(existingReview) : null,
        message: "You have already reviewed this purchase.",
      };
    }

    return {
      canReview: false,
      isVerified: false,
      eligibleOrderId: null,
      eligibleVariantId: null,
      existingReview: null,
      message: "Only verified buyers who completed a purchase of this product can submit a review.",
    };
  }

  async submitReview(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    customerId: string,
    input: CreateReviewInput,
    options: { autoPublish?: boolean } = {},
  ): Promise<ProductReviewDTO> {
    this.validateRating(input.rating);
    this.validateReviewContent(input.title, input.content);

    const product = await this.productRepo.findProductById(db, storeId, productId);
    if (!product) {
      throw new ProductNotFoundError(`Product not found: ${productId}`);
    }

    // Resolve customer identity and purchase eligibility
    let purchase: { orderId: string; variantId: string | null } | null = null;

    if (input.orderId) {
      purchase = await this.reviewRepo.findCustomerPurchase(
        db,
        storeId,
        customerId,
        productId,
        {
          orderId: input.orderId,
          variantId: input.variantId,
        },
      );

      if (!purchase) {
        throw new ReviewEligibilityError(
          "Product was not purchased in the specified order.",
        );
      }
    } else {
      purchase = await this.reviewRepo.findCustomerPurchase(
        db,
        storeId,
        customerId,
        productId,
        {
          unreviewedOnly: true,
          variantId: input.variantId,
        },
      );

      if (!purchase) {
        const anyPurchase = await this.reviewRepo.findCustomerPurchase(
          db,
          storeId,
          customerId,
          productId,
        );

        if (!anyPurchase) {
          throw new ReviewEligibilityError(
            "Only customers who have completed a purchase of this product can submit a review.",
          );
        }

        throw new DuplicateReviewError(
          "You have already submitted a review for this purchase",
        );
      }
    }

    // Prevent duplicate review if already reviewed for this specific purchase
    const existing = await this.reviewRepo.findReviewByCustomerAndProduct(
      db,
      storeId,
      customerId,
      productId,
      purchase.orderId,
    );
    if (existing) {
      throw new DuplicateReviewError("You have already submitted a review for this purchase");
    }

    const orderId = purchase.orderId;
    const variantId = input.variantId ?? purchase.variantId;

    // Fetch customer details for snapshot
    const customerRes = await db.query<{
      first_name: string | null;
      last_name: string | null;
      email: string;
    }>(
      `SELECT first_name, last_name, email FROM customers WHERE store_id = $1 AND id = $2`,
      [storeId, customerId],
    );
    const customer = customerRes.rows[0];
    const customerName = customer
      ? `${customer.first_name || ""} ${customer.last_name ? customer.last_name.charAt(0) + "." : ""}`.trim() ||
        "Verified Customer"
      : "Verified Customer";
    const customerEmail = customer?.email ?? null;

    const initialStatus: ReviewStatus = options.autoPublish ? "PUBLISHED" : "PENDING";

    const review: ProductReview = {
      id: generateUuidV7(),
      storeId,
      productId,
      customerId,
      orderId,
      variantId,
      rating: input.rating,
      title: input.title.trim(),
      content: input.content.trim(),
      status: initialStatus,
      isVerifiedPurchase: true,
      customerNameSnapshot: customerName,
      customerEmailSnapshot: customerEmail,
      merchantReply: null,
      merchantReplyAt: null,
      merchantReplyByUserId: null,
      moderatedAt: null,
      moderatedByUserId: null,
      moderationReason: null,
      reportCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await this.reviewRepo.insertReview(db, review);
    return toReviewDTO(inserted);
  }

  async updateCustomerReview(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    reviewId: string,
    customerId: string,
    input: UpdateReviewInput,
  ): Promise<ProductReviewDTO> {
    if (input.rating !== undefined) {
      this.validateRating(input.rating);
    }
    if (input.title !== undefined || input.content !== undefined) {
      this.validateReviewContent(input.title ?? "Title", input.content ?? "Content");
    }

    const existing = await this.reviewRepo.findReviewById(db, storeId, reviewId);
    if (!existing || existing.productId !== productId) {
      throw new ReviewNotFoundError("Review not found");
    }

    if (existing.customerId !== customerId) {
      throw new ReviewForbiddenError("You can only edit your own reviews");
    }

    const updated = await this.reviewRepo.updateReview(
      db,
      storeId,
      reviewId,
      customerId,
      {
        rating: input.rating,
        title: input.title?.trim(),
        content: input.content?.trim(),
      },
    );

    if (!updated) {
      throw new ReviewNotFoundError("Failed to update review");
    }

    return toReviewDTO(updated);
  }

  async deleteCustomerReview(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    reviewId: string,
    customerId: string,
  ): Promise<void> {
    const existing = await this.reviewRepo.findReviewById(db, storeId, reviewId);
    if (!existing || existing.productId !== productId) {
      throw new ReviewNotFoundError("Review not found");
    }

    if (existing.customerId !== customerId) {
      throw new ReviewForbiddenError("You can only delete your own reviews");
    }

    await this.reviewRepo.deleteReview(db, storeId, reviewId, customerId);
  }

  async reportReview(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    reviewId: string,
    reporterCustomerId: string | null,
    reporterIp: string | null,
    input: ReviewReportInput,
  ): Promise<void> {
    const existing = await this.reviewRepo.findReviewById(db, storeId, reviewId);
    if (!existing || existing.productId !== productId) {
      throw new ReviewNotFoundError("Review not found");
    }

    const report: ReviewReport = {
      id: generateUuidV7(),
      reviewId,
      storeId,
      reporterCustomerId,
      reporterIp,
      reason: input.reason.trim(),
      details: input.details?.trim() ?? null,
      createdAt: new Date(),
    };

    await this.reviewRepo.insertReport(db, report);
  }

  async listPublishedReviews(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    options: ListPublishedReviewsFilterOptions = {},
  ): Promise<{ items: ProductReviewDTO[]; total: number }> {
    const { items, total } = await this.reviewRepo.listPublishedReviews(
      db,
      storeId,
      productId,
      options,
    );
    return {
      items: items.map(toReviewDTO),
      total,
    };
  }

  async getProductReviewSummary(
    db: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<ProductReviewSummaryDTO> {
    return await this.reviewRepo.getProductReviewSummary(db, storeId, productId);
  }

  async listMerchantReviews(
    db: DatabaseClient,
    storeId: string,
    options: ListMerchantReviewsFilterOptions = {},
  ): Promise<{
    items: MerchantReviewDTO[];
    total: number;
    stats: MerchantReviewStatsDTO;
  }> {
    const [{ items, total }, stats] = await Promise.all([
      this.reviewRepo.listMerchantReviews(db, storeId, options),
      this.reviewRepo.getMerchantReviewStats(db, storeId, options.productId),
    ]);

    return {
      items: items.map((r) => toMerchantReviewDTO(r)),
      total,
      stats,
    };
  }

  async getMerchantReviewById(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
  ): Promise<MerchantReviewDTO> {
    const review = await this.reviewRepo.findReviewById(db, storeId, reviewId);
    if (!review) {
      throw new ReviewNotFoundError("Review not found");
    }

    const logs = await this.reviewRepo.listModerationLogs(db, storeId, reviewId);
    return toMerchantReviewDTO(review, logs);
  }

  async moderateReview(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    userId: string,
    input: ModerateReviewInput,
  ): Promise<MerchantReviewDTO> {
    const existing = await this.reviewRepo.findReviewById(db, storeId, reviewId);
    if (!existing) {
      throw new ReviewNotFoundError("Review not found");
    }

    const validStatuses: ReviewStatus[] = ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN"];
    if (!validStatuses.includes(input.status)) {
      throw new Error(`Invalid review status: ${input.status}`);
    }

    const updated = await this.reviewRepo.updateReviewStatus(
      db,
      storeId,
      reviewId,
      input.status,
      userId,
      input.reason,
    );

    if (!updated) {
      throw new ReviewNotFoundError("Review not found");
    }

    const log: ReviewModerationLog = {
      id: generateUuidV7(),
      reviewId,
      storeId,
      userId,
      previousStatus: existing.status,
      newStatus: input.status,
      reason: input.reason?.trim() ?? null,
      createdAt: new Date(),
    };
    await this.reviewRepo.insertModerationLog(db, log);

    const logs = await this.reviewRepo.listModerationLogs(db, storeId, reviewId);
    return toMerchantReviewDTO(
      {
        ...updated,
        productTitle: existing.productTitle,
        productSlug: existing.productSlug,
      },
      logs,
    );
  }

  async replyToReview(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    userId: string,
    replyText: string,
  ): Promise<MerchantReviewDTO> {
    const trimmed = replyText?.trim() ?? "";
    if (trimmed.length < 1 || trimmed.length > 2000) {
      throw new Error("Merchant reply must be between 1 and 2000 characters");
    }

    const updated = await this.reviewRepo.updateMerchantReply(
      db,
      storeId,
      reviewId,
      trimmed,
      userId,
    );

    if (!updated) {
      throw new ReviewNotFoundError("Review not found");
    }

    return this.getMerchantReviewById(db, storeId, reviewId);
  }

  async deleteMerchantReply(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
  ): Promise<MerchantReviewDTO> {
    const updated = await this.reviewRepo.deleteMerchantReply(db, storeId, reviewId);
    if (!updated) {
      throw new ReviewNotFoundError("Review not found");
    }

    return this.getMerchantReviewById(db, storeId, reviewId);
  }
}
