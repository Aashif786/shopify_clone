import { StoreService } from "@shopify-clone/stores";
import { getEmailService } from "@shopify-clone/email";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string; invitationId: string }>;
}

export async function DELETE(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId, invitationId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");
    validateUuid(invitationId, "invitationId");

    await requireStoreOrNotFound(ctx, storeId, "admin");

    const revoked = await storeService.revokeStoreInvitation(
      ctx.db,
      storeId,
      ctx.auth!.user.id,
      invitationId
    );

    try {
      const store = await storeService.getStoreById(ctx.db, storeId);
      const emailService = getEmailService();
      await emailService.sendStaffInvitationRevoked({
        to: revoked.email,
        storeName: store.name,
      });
    } catch (emailErr) {
      console.error("[Stores:RevokeInvitation] Notification delivery failed:", emailErr);
    }

    return apiSuccess({ invitation: revoked }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
