import { StoreService } from "@calcart/stores";
import {
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  ApiHttpError,
} from "@/lib/api";
import { landingPageDraftValidator } from "@/lib/api/landing-page-validator";

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId);
    const landingPage = await storeService.getLandingPage(
      ctx.db,
      storeId,
      auth.user.id,
    );

    return apiSuccess(landingPage, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function PUT(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

    await requireStoreOrNotFound(ctx, storeId, "admin");

    let parsedBody: unknown;
    try {
      const text = await req.text();
      if (!text.trim()) {
        throw new Error("Empty body");
      }
      parsedBody = JSON.parse(text);
    } catch {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Malformed JSON request body");
    }

    const validation = landingPageDraftValidator.validate(parsedBody);
    if (!validation.success) {
      const fields: Record<string, string> = {};
      for (const err of validation.errors) {
        fields[err.field] = err.message;
      }
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        validation.errors[0]?.message || "Validation failed",
        { fields, details: { errors: validation.errors } },
      );
    }

    const updated = await storeService.saveLandingPageDraft(
      ctx.db,
      storeId,
      auth.user.id,
      validation.data.draftConfig,
    );

    return apiSuccess(updated, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
