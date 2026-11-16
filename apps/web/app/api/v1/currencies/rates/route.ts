import { fetchFrankfurterRates, fetchFrankfurterRate } from "@calcart/types";
import { apiSuccess, handleApiError, resolveRequestContext } from "@/lib/api";

export async function GET(req: Request) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const url = new URL(req.url);
    const base = (url.searchParams.get("base") || "USD").toUpperCase();
    const quote = url.searchParams.get("quote")?.toUpperCase();

    if (quote) {
      const single = await fetchFrankfurterRate(base, quote);
      return apiSuccess(single, { requestId });
    }

    const rates = await fetchFrankfurterRates(base);
    return apiSuccess(rates, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
