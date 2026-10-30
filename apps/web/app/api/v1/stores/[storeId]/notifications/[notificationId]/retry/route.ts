import { NotificationOutboxRepository } from "@calcart/db";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const outboxRepo = new NotificationOutboxRepository();

interface RouteContext {
  params: Promise<{ storeId: string; notificationId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, notificationId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(notificationId, "notificationId");

    // Only store admin or owner can trigger manual retry
    await requireStoreOrNotFound(ctx, storeId, "admin");

    const existing = await outboxRepo.findByStoreAndId(ctx.db, storeId, notificationId);
    if (!existing) {
      throw new ApiHttpError(404, "NOT_FOUND", "Notification not found in this store");
    }

    if (existing.status !== "FAILED") {
      throw new ApiHttpError(
        400,
        "INVALID_STATE",
        `Only FAILED notifications can be manually retried (current status is '${existing.status}')`,
      );
    }

    const updated = await outboxRepo.retryNotification(ctx.db, storeId, notificationId);

    return apiSuccess(
      {
        message: "Notification reset to PENDING for immediate delivery retry",
        notification: updated,
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
