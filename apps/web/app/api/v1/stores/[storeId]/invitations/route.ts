import { StoreService } from "@shopify-clone/stores";
import { getEmailService } from "@shopify-clone/email";
import {
  apiSuccess,
  createStoreInvitationValidator,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateBody,
  validateUuid,
} from "@/lib/api";

const storeService = new StoreService();

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

    await requireStoreOrNotFound(ctx, storeId, "admin");

    const invitations = await storeService.listStoreInvitations(
      ctx.db,
      storeId,
      ctx.auth!.user.id
    );

    return apiSuccess({ items: invitations }, { status: 200, requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "admin");

    const body = await validateBody(req, createStoreInvitationValidator);

    const result = await storeService.createStoreInvitation(
      ctx.db,
      storeId,
      ctx.auth!.user.id,
      body
    );

    const store = await storeService.getStoreById(ctx.db, storeId);

    try {
      const emailService = getEmailService();
      await emailService.sendStaffInvitation({
        to: result.email,
        token: result.rawToken,
        storeName: store.name,
        inviterName: ctx.auth!.user.name || ctx.auth!.user.email,
        role: result.role,
        expiresAt: result.expiresAt,
      });
    } catch (emailErr) {
      console.error("[Stores:InviteStaff] Invitation email delivery failed:", emailErr);
    }

    const isProd = process.env.NODE_ENV === "production";
    return apiSuccess(
      {
        invitation: {
          id: result.id,
          storeId: result.storeId,
          email: result.email,
          role: result.role,
          status: result.status,
          expiresAt: result.expiresAt,
          createdAt: result.createdAt,
        },
        invitationToken: isProd ? undefined : result.rawToken,
        invitationUrl: isProd ? undefined : `/merchant/invitations/accept?token=${result.rawToken}`,
      },
      { status: 201, requestId }
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
