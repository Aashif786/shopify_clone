import {
  apiSuccess,
  getOpenApiDocument,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const doc = getOpenApiDocument();
    return apiSuccess(doc, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
