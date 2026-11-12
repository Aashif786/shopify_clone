import { WebhookRepository } from "@calcart/db";
import { ApiHttpError, apiSuccess, handleApiError, validateUuid } from "@/lib/api";
import { requireApiKey } from "@/lib/api/public-auth";
import { getDb } from "@/lib/db";

const webhookRepo = new WebhookRepository();

interface RouteContext {
  params: Promise<{ webhookId: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { storeId } = await requireApiKey(req, "write:webhooks");
    const { webhookId } = await Promise.resolve(context.params);
    validateUuid(webhookId, "webhookId");

    const db = getDb();
    const deleted = await webhookRepo.deleteSubscription(db, storeId, webhookId);

    if (!deleted) {
      throw new ApiHttpError(404, "NOT_FOUND", "Webhook subscription not found");
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
