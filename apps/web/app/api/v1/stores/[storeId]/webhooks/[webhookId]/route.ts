import { WebhookRepository } from "@calcart/db";
import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const webhookRepo = new WebhookRepository();

interface RouteContext {
  params: Promise<{ storeId: string; webhookId: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, webhookId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(webhookId, "webhookId");

    const member = await requireStoreOrNotFound(ctx, storeId, "admin");
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Admin permissions required to delete webhook subscriptions");
    }

    const deleted = await webhookRepo.deleteSubscription(ctx.db, storeId, webhookId);
    if (!deleted) {
      throw new ApiHttpError(404, "NOT_FOUND", "Webhook subscription not found");
    }

    return apiSuccess({ deleted: true }, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
