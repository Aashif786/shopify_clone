import { NextResponse } from "next/server";
import { fetchFrankfurterRates, fetchFrankfurterRate } from "@calcart/types";
import { requirePlatformAdmin, formatAuthErrorResponse } from "@/lib/platform-auth";

const ISO_CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin("dashboard:read");

    const url = new URL(req.url);
    const rawBase = url.searchParams.get("base") || "INR";
    const base = rawBase.toUpperCase();
    const rawQuote = url.searchParams.get("quote");
    const quote = rawQuote ? rawQuote.toUpperCase() : undefined;

    if (!ISO_CURRENCY_CODE_REGEX.test(base)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid base currency code. Must be a 3-letter uppercase ISO currency code.",
          },
        },
        { status: 400 }
      );
    }

    if (quote && !ISO_CURRENCY_CODE_REGEX.test(quote)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid quote currency code. Must be a 3-letter uppercase ISO currency code.",
          },
        },
        { status: 400 }
      );
    }

    if (quote) {
      const single = await fetchFrankfurterRate(base, quote);
      return NextResponse.json({ success: true, data: single });
    }

    const rates = await fetchFrankfurterRates(base);
    return NextResponse.json({ success: true, data: rates });
  } catch (error) {
    return formatAuthErrorResponse(error);
  }
}
