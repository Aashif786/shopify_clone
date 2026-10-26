import { type DatabaseClient } from "@shopify-clone/db";
import type {
  ProductReview,
  ReviewModerationLog,
  ReviewRatingDistribution,
  ReviewReport,
  ReviewStatus,
} from "../domain/entities.js";
import { DuplicateReviewError } from "../domain/errors.js";
import type {
  ListMerchantReviewsFilterOptions,
  ListPublishedReviewsFilterOptions,
  MerchantReviewStatsDTO,
} from "../application/dtos.js";

interface ProductReviewRow {
  id: string;
  store_id: string;
  product_id: string;
  customer_id: string | null;
  order_id: string | null;
  variant_id: string | null;
  rating: number | string;
  title: string;
  content: string;
  status: string;
  is_verified_purchase: boolean;
  customer_name_snapshot: string;
  customer_email_snapshot: string | null;
  merchant_reply: string | null;
  merchant_reply_at: Date | string | null;
  merchant_reply_by_user_id: string | null;
  moderated_at: Date | string | null;
  moderated_by_user_id: string | null;
  moderation_reason: string | null;
  report_count: number | string;
  created_at: Date | string;
  updated_at: Date | string;
  variant_title?: string | null;
  product_title?: string | null;
  product_slug?: string | null;
}

interface ReviewModerationLogRow {
  id: string;
  review_id: string;
  store_id: string;
  user_id: string | null;
  previous_status: string;
  new_status: string;
  reason: string | null;
  created_at: Date | string;
}

function mapReviewRow(row: ProductReviewRow): ProductReview & {
  variantTitle?: string | null;
  productTitle: string;
  productSlug: string;
} {
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    customerId: row.customer_id,
    orderId: row.order_id,
    variantId: row.variant_id,
    rating: Number(row.rating),
    title: row.title,
    content: row.content,
    status: row.status as ReviewStatus,
    isVerifiedPurchase: Boolean(row.is_verified_purchase),
    customerNameSnapshot: row.customer_name_snapshot,
    customerEmailSnapshot: row.customer_email_snapshot,
    merchantReply: row.merchant_reply,
    merchantReplyAt: row.merchant_reply_at ? new Date(row.merchant_reply_at) : null,
    merchantReplyByUserId: row.merchant_reply_by_user_id,
    moderatedAt: row.moderated_at ? new Date(row.moderated_at) : null,
    moderatedByUserId: row.moderated_by_user_id,
    moderationReason: row.moderation_reason,
    reportCount: Number(row.report_count || 0),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    variantTitle: row.variant_title ?? null,
    productTitle: row.product_title ?? "",
    productSlug: row.product_slug ?? "",
  };
}

export class ReviewRepository {
  async insertReview(db: DatabaseClient, review: ProductReview): Promise<ProductReview> {
    try {
      const result = await db.query<ProductReviewRow>(
        `INSERT INTO product_reviews (
          id, store_id, product_id, customer_id, order_id, variant_id,
          rating, title, content, status, is_verified_purchase,
          customer_name_snapshot, customer_email_snapshot,
          merchant_reply, merchant_reply_at, merchant_reply_by_user_id,
          moderated_at, moderated_by_user_id, moderation_reason,
          report_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13,
          $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22
        ) RETURNING *`,
        [
          review.id,
          review.storeId,
          review.productId,
          review.customerId,
          review.orderId,
          review.variantId,
          review.rating,
          review.title,
          review.content,
          review.status,
          review.isVerifiedPurchase,
          review.customerNameSnapshot,
          review.customerEmailSnapshot,
          review.merchantReply,
          review.merchantReplyAt,
          review.merchantReplyByUserId,
          review.moderatedAt,
          review.moderatedByUserId,
          review.moderationReason,
          review.reportCount,
          review.createdAt,
          review.updatedAt,
        ],
      );

      if (!result.rows[0]) {
        throw new Error("Failed to insert product review");
      }
      return mapReviewRow(result.rows[0]);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === "23505") {
        throw new DuplicateReviewError("You have already submitted a review for this purchase");
      }
      throw error;
    }
  }

  async findReviewById(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
  ): Promise<(ProductReview & { productTitle: string; productSlug: string; variantTitle?: string | null }) | null> {
    const result = await db.query<ProductReviewRow>(
      `SELECT r.*, p.title AS product_title, p.slug AS product_slug, pv.title AS variant_title
       FROM product_reviews r
       JOIN products p ON r.product_id = p.id
       LEFT JOIN product_variants pv ON r.variant_id = pv.id
       WHERE r.store_id = $1 AND r.id = $2`,
      [storeId, reviewId],
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async findReviewByCustomerAndProduct(
    db: DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    orderId?: string | null,
  ): Promise<ProductReview | null> {
    let query = `
      SELECT r.*, pv.title AS variant_title
      FROM product_reviews r
      LEFT JOIN product_variants pv ON r.variant_id = pv.id
      WHERE r.store_id = $1 AND r.customer_id = $2 AND r.product_id = $3
    `;
    const params: unknown[] = [storeId, customerId, productId];

    if (orderId) {
      params.push(orderId);
      query += ` AND r.order_id = $${params.length}`;
    }

    query += ` ORDER BY r.created_at DESC LIMIT 1`;

    const result = await db.query<ProductReviewRow>(query, params);
    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async updateReview(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    customerId: string,
    updates: { rating?: number; title?: string; content?: string },
  ): Promise<ProductReview | null> {
    const fields: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [storeId, reviewId, customerId];

    if (updates.rating !== undefined) {
      params.push(updates.rating);
      fields.push(`rating = $${params.length}`);
    }
    if (updates.title !== undefined) {
      params.push(updates.title);
      fields.push(`title = $${params.length}`);
    }
    if (updates.content !== undefined) {
      params.push(updates.content);
      fields.push(`content = $${params.length}`);
    }

    const query = `
      UPDATE product_reviews
      SET ${fields.join(", ")}
      WHERE store_id = $1 AND id = $2 AND customer_id = $3
      RETURNING *
    `;

    const result = await db.query<ProductReviewRow>(query, params);
    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async deleteReview(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    customerId?: string,
  ): Promise<boolean> {
    const params: unknown[] = [storeId, reviewId];
    let query = `DELETE FROM product_reviews WHERE store_id = $1 AND id = $2`;

    if (customerId) {
      params.push(customerId);
      query += ` AND customer_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    return (result.rowCount ?? 0) > 0;
  }

  async listPublishedReviews(
    db: DatabaseClient,
    storeId: string,
    productId: string,
    options: ListPublishedReviewsFilterOptions = {},
  ): Promise<{ items: (ProductReview & { variantTitle?: string | null })[]; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(50, options.limit ?? 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [
      "r.store_id = $1",
      "r.product_id = $2",
      "r.status = 'PUBLISHED'",
    ];
    const params: unknown[] = [storeId, productId];

    if (options.rating && options.rating >= 1 && options.rating <= 5) {
      params.push(options.rating);
      whereClauses.push(`r.rating = $${params.length}`);
    }

    let orderClause = "ORDER BY r.created_at DESC";
    switch (options.sortBy) {
      case "oldest":
        orderClause = "ORDER BY r.created_at ASC";
        break;
      case "highest_rated":
        orderClause = "ORDER BY r.rating DESC, r.created_at DESC";
        break;
      case "lowest_rated":
        orderClause = "ORDER BY r.rating ASC, r.created_at DESC";
        break;
      case "newest":
      default:
        orderClause = "ORDER BY r.created_at DESC";
        break;
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM product_reviews r
      WHERE ${whereClauses.join(" AND ")}
    `;
    const countResult = await db.query<{ total: number }>(countQuery, params);
    const total = countResult.rows[0]?.total ?? 0;

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT r.*, pv.title AS variant_title
      FROM product_reviews r
      LEFT JOIN product_variants pv ON r.variant_id = pv.id
      WHERE ${whereClauses.join(" AND ")}
      ${orderClause}
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataResult = await db.query<ProductReviewRow>(dataQuery, dataParams);
    return {
      items: dataResult.rows.map(mapReviewRow),
      total,
    };
  }

  async getProductReviewSummary(
    db: DatabaseClient,
    storeId: string,
    productId: string,
  ): Promise<{
    averageRating: number;
    totalReviews: number;
    distribution: ReviewRatingDistribution;
  }> {
    const result = await db.query<{
      total_reviews: number;
      average_rating: number;
      count_5: number;
      count_4: number;
      count_3: number;
      count_2: number;
      count_1: number;
    }>(
      `SELECT
        COUNT(*)::int AS total_reviews,
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END)::int AS count_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END)::int AS count_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END)::int AS count_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END)::int AS count_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END)::int AS count_1
       FROM product_reviews
       WHERE store_id = $1 AND product_id = $2 AND status = 'PUBLISHED'`,
      [storeId, productId],
    );

    const row = result.rows[0];
    return {
      averageRating: row ? Number(row.average_rating) : 0,
      totalReviews: row ? Number(row.total_reviews) : 0,
      distribution: {
        5: row ? Number(row.count_5) : 0,
        4: row ? Number(row.count_4) : 0,
        3: row ? Number(row.count_3) : 0,
        2: row ? Number(row.count_2) : 0,
        1: row ? Number(row.count_1) : 0,
      },
    };
  }

  async listMerchantReviews(
    db: DatabaseClient,
    storeId: string,
    options: ListMerchantReviewsFilterOptions = {},
  ): Promise<{
    items: (ProductReview & { productTitle: string; productSlug: string; variantTitle?: string | null })[];
    total: number;
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["r.store_id = $1"];
    const params: unknown[] = [storeId];

    if (options.productId) {
      params.push(options.productId);
      whereClauses.push(`r.product_id = $${params.length}`);
    }

    if (options.status) {
      params.push(options.status);
      whereClauses.push(`r.status = $${params.length}`);
    }

    if (options.rating && options.rating >= 1 && options.rating <= 5) {
      params.push(options.rating);
      whereClauses.push(`r.rating = $${params.length}`);
    }

    if (options.search?.trim()) {
      params.push(`%${options.search.trim()}%`);
      whereClauses.push(
        `(r.title ILIKE $${params.length} OR r.content ILIKE $${params.length} OR r.customer_name_snapshot ILIKE $${params.length} OR p.title ILIKE $${params.length})`,
      );
    }

    let orderClause = "ORDER BY r.created_at DESC";
    switch (options.sortBy) {
      case "oldest":
        orderClause = "ORDER BY r.created_at ASC";
        break;
      case "highest_rated":
        orderClause = "ORDER BY r.rating DESC, r.created_at DESC";
        break;
      case "lowest_rated":
        orderClause = "ORDER BY r.rating ASC, r.created_at DESC";
        break;
      case "newest":
      default:
        orderClause = "ORDER BY r.created_at DESC";
        break;
    }

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      WHERE ${whereClauses.join(" AND ")}
    `;
    const countResult = await db.query<{ total: number }>(countQuery, params);
    const total = countResult.rows[0]?.total ?? 0;

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT r.*, p.title AS product_title, p.slug AS product_slug, pv.title AS variant_title
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      LEFT JOIN product_variants pv ON r.variant_id = pv.id
      WHERE ${whereClauses.join(" AND ")}
      ${orderClause}
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataResult = await db.query<ProductReviewRow>(dataQuery, dataParams);
    return {
      items: dataResult.rows.map(mapReviewRow),
      total,
    };
  }

  async getMerchantReviewStats(
    db: DatabaseClient,
    storeId: string,
    productId?: string,
  ): Promise<MerchantReviewStatsDTO> {
    const params: unknown[] = [storeId];
    let productFilter = "";
    if (productId) {
      params.push(productId);
      productFilter = `AND product_id = $${params.length}`;
    }

    const result = await db.query<{
      total: number;
      pending: number;
      published: number;
      rejected: number;
      hidden: number;
    }>(
      `SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending,
        COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END)::int AS published,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS rejected,
        COUNT(CASE WHEN status = 'HIDDEN' THEN 1 END)::int AS hidden
       FROM product_reviews
       WHERE store_id = $1 ${productFilter}`,
      params,
    );

    const row = result.rows[0];
    return {
      total: row ? Number(row.total) : 0,
      pending: row ? Number(row.pending) : 0,
      published: row ? Number(row.published) : 0,
      rejected: row ? Number(row.rejected) : 0,
      hidden: row ? Number(row.hidden) : 0,
    };
  }

  async updateReviewStatus(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    newStatus: ReviewStatus,
    userId?: string | null,
    reason?: string | null,
  ): Promise<ProductReview | null> {
    const result = await db.query<ProductReviewRow>(
      `UPDATE product_reviews
       SET status = $1,
           moderated_at = NOW(),
           moderated_by_user_id = $2,
           moderation_reason = $3,
           updated_at = NOW()
       WHERE store_id = $4 AND id = $5
       RETURNING *`,
      [newStatus, userId ?? null, reason ?? null, storeId, reviewId],
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async insertModerationLog(db: DatabaseClient, log: ReviewModerationLog): Promise<void> {
    await db.query(
      `INSERT INTO product_review_moderation_logs (
        id, review_id, store_id, user_id, previous_status, new_status, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        log.id,
        log.reviewId,
        log.storeId,
        log.userId,
        log.previousStatus,
        log.newStatus,
        log.reason,
        log.createdAt,
      ],
    );
  }

  async listModerationLogs(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
  ): Promise<ReviewModerationLog[]> {
    const result = await db.query<ReviewModerationLogRow>(
      `SELECT *
       FROM product_review_moderation_logs
       WHERE store_id = $1 AND review_id = $2
       ORDER BY created_at DESC`,
      [storeId, reviewId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      storeId: row.store_id,
      userId: row.user_id,
      previousStatus: row.previous_status as ReviewStatus,
      newStatus: row.new_status as ReviewStatus,
      reason: row.reason,
      createdAt: new Date(row.created_at),
    }));
  }

  async updateMerchantReply(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
    replyText: string,
    userId: string,
  ): Promise<ProductReview | null> {
    const result = await db.query<ProductReviewRow>(
      `UPDATE product_reviews
       SET merchant_reply = $1,
           merchant_reply_at = NOW(),
           merchant_reply_by_user_id = $2,
           updated_at = NOW()
       WHERE store_id = $3 AND id = $4
       RETURNING *`,
      [replyText, userId, storeId, reviewId],
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async deleteMerchantReply(
    db: DatabaseClient,
    storeId: string,
    reviewId: string,
  ): Promise<ProductReview | null> {
    const result = await db.query<ProductReviewRow>(
      `UPDATE product_reviews
       SET merchant_reply = NULL,
           merchant_reply_at = NULL,
           merchant_reply_by_user_id = NULL,
           updated_at = NOW()
       WHERE store_id = $1 AND id = $2
       RETURNING *`,
      [storeId, reviewId],
    );

    const row = result.rows[0];
    if (!row) return null;
    return mapReviewRow(row);
  }

  async insertReport(db: DatabaseClient, report: ReviewReport): Promise<void> {
    await db.query(
      `INSERT INTO product_review_reports (
        id, review_id, store_id, reporter_customer_id, reporter_ip, reason, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        report.id,
        report.reviewId,
        report.storeId,
        report.reporterCustomerId,
        report.reporterIp,
        report.reason,
        report.details,
        report.createdAt,
      ],
    );

    await db.query(
      `UPDATE product_reviews
       SET report_count = report_count + 1, updated_at = NOW()
       WHERE store_id = $1 AND id = $2`,
      [report.storeId, report.reviewId],
    );
  }

  async findCustomerPurchase(
    db: DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    options?: {
      orderId?: string | null;
      variantId?: string | null;
      unreviewedOnly?: boolean;
    },
  ): Promise<{ orderId: string; variantId: string | null } | null> {
    const params: unknown[] = [storeId, customerId, productId];
    let query = `
      SELECT o.id AS order_id, oi.variant_id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.store_id = $1
        AND o.customer_id = $2
        AND oi.product_id = $3
        AND o.payment_status = 'PAID'
        AND o.status NOT IN ('CANCELLED')
    `;

    if (options?.orderId) {
      params.push(options.orderId);
      query += ` AND o.id = $${params.length}`;
    }

    if (options?.variantId) {
      params.push(options.variantId);
      query += ` AND oi.variant_id = $${params.length}`;
    }

    if (options?.unreviewedOnly) {
      query += ` AND NOT EXISTS (
        SELECT 1 FROM product_reviews pr
        WHERE pr.store_id = o.store_id
          AND pr.customer_id = o.customer_id
          AND pr.order_id = o.id
          AND pr.product_id = oi.product_id
      )`;
    }

    query += ` ORDER BY o.created_at DESC LIMIT 1`;

    const result = await db.query<{ order_id: string; variant_id: string | null }>(query, params);
    const row = result.rows[0];
    if (!row) return null;
    return {
      orderId: row.order_id,
      variantId: row.variant_id,
    };
  }
}
