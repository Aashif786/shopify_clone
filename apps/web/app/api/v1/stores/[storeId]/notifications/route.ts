import { NotificationOutboxRepository } from "@calcart/db";
import { maskEmail } from "@calcart/email";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const outboxRepo = new NotificationOutboxRepository();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    // Staff or admin access required for store operational visibility
    await requireStoreOrNotFound(ctx, storeId, "staff");

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const result = await outboxRepo.listByStore(ctx.db, storeId, {
      status,
      limit,
      offset,
    });

    const sanitizedItems = result.items.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      notificationType: row.notification_type,
      recipientEmail: row.recipient_email ? maskEmail(row.recipient_email) : null,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastAttemptAt: row.last_attempt_at,
      nextRetryAt: row.next_retry_at,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      errorCategory: row.error_category,
      providerMessageId: row.provider_message_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return apiSuccess(
      {
        items: sanitizedItems,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
      {
        status: 200,
        requestId,
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
