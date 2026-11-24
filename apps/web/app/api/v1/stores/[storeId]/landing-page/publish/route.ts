import { StoreService, type StorefrontLandingPageConfig } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
  validateUuid,
} from "@/lib/api";
import { landingPageDraftValidator } from "@/lib/api/landing-page-validator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const storeService = new StoreService();

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const auth = requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);
    validateUuid(storeId, "storeId");

    await requireStoreOrNotFound(ctx, storeId, "admin");

    let configToPublish: StorefrontLandingPageConfig | undefined = undefined;
    const text = await req.text();
    if (text && text.trim()) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiHttpError(400, "VALIDATION_ERROR", "Malformed JSON request body");
      }
      if (body && body.config !== undefined) {
        const validation = landingPageDraftValidator.validate({
          draftConfig: body.config,
        });
        if (!validation.success) {
          const fields: Record<string, string> = {};
          for (const err of validation.errors) {
            fields[err.field] = err.message;
          }
          throw new ApiHttpError(
            400,
            "VALIDATION_ERROR",
            validation.errors[0]?.message || "Invalid landing page configuration",
            { fields, details: { errors: validation.errors } },
          );
        }
        configToPublish = body.config as StorefrontLandingPageConfig;
      }
    }

    const updated = await storeService.publishLandingPage(
      ctx.db,
      storeId,
      auth.user.id,
      configToPublish,
    );

    return apiSuccess(updated, {
      requestId,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
