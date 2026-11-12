import { NewsletterService } from "@calcart/customers";
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

const newsletterService = new NewsletterService();

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

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "staff")) {
      throw new ApiHttpError(403, "FORBIDDEN", "Operation requires at least staff role in this store");
    }

    const url = new URL(req.url);
    const isExport = url.searchParams.get("export") === "csv";
    const search = url.searchParams.get("search") || undefined;
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus === "SUBSCRIBED" || rawStatus === "UNSUBSCRIBED" ? rawStatus : "ALL";
    const limit = parseInt(url.searchParams.get("limit") || (isExport ? "1000" : "50"), 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const result = await newsletterService.listSubscribers(ctx.db, storeId, {
      search,
      status,
      limit,
      offset,
    });

    if (isExport) {
      const escapeCsv = (str: string | null | undefined): string => {
        if (!str) return '""';
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvRows = [
        ["ID", "Email", "Status", "Source", "Subscribed At", "Unsubscribed At"].join(","),
        ...result.items.map((sub) =>
          [
            escapeCsv(sub.id),
            escapeCsv(sub.email),
            escapeCsv(sub.status),
            escapeCsv(sub.source),
            escapeCsv(sub.subscribedAt),
            escapeCsv(sub.unsubscribedAt),
          ].join(","),
        ),
      ];

      const csvContent = csvRows.join("\n");
      const dateStr = new Date().toISOString().split("T")[0];

      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="newsletter-subscribers-${dateStr}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
