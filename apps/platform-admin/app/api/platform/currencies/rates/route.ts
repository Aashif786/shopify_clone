import { NextResponse } from "next/server";
import { fetchFrankfurterRates, fetchFrankfurterRate } from "@calcart/types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const base = (url.searchParams.get("base") || "INR").toUpperCase();
    const quote = url.searchParams.get("quote")?.toUpperCase();

    if (quote) {
      const single = await fetchFrankfurterRate(base, quote);
      return NextResponse.json({ success: true, data: single });
    }

    const rates = await fetchFrankfurterRates(base);
    return NextResponse.json({ success: true, data: rates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch Frankfurter rates";
    return NextResponse.json(
      { success: false, error: { message, code: "FRANKFURTER_RATE_ERROR" } },
      { status: 500 }
    );
  }
}
