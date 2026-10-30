import { resolveStoreFromHostname } from "@shopify-clone/tenant";
import {
  apiError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { searchParams } = new URL(req.url);
    const hostname = searchParams.get("hostname")?.trim();

    if (!hostname) {
      return apiError(
        "VALIDATION_ERROR",
        "Missing required query parameter: hostname",
        400,
        { requestId },
      );
    }

    const platformDomain =
      process.env.PLATFORM_DOMAIN ||
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ||
      "calcart.com";

    const resolved = await resolveStoreFromHostname(
      ctx.db,
      hostname,
      platformDomain,
    );

    if (!resolved) {
      return apiError(
        "DOMAIN_NOT_FOUND",
        `No active store mapped to domain '${hostname}'`,
        404,
        { requestId },
      );
    }

    return apiSuccess(resolved, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
