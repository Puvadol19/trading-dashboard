import { NextRequest, NextResponse } from "next/server";
import type { OandaCandle, CandleData } from "@/lib/types";
import { oanda } from "@/lib/oanda-client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const instrument = searchParams.get("instrument") || "EUR_USD";
  const count = searchParams.get("count") || "200";
  const granularity = searchParams.get("granularity") || "S5";

  try {
    const data = await oanda.getCandles(instrument, granularity, count);

    const candles: CandleData[] = (data.candles || []).map(
      (c: OandaCandle) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000),
        open: parseFloat(c.mid.o),
        high: parseFloat(c.mid.h),
        low: parseFloat(c.mid.l),
        close: parseFloat(c.mid.c),
        volume: c.volume,
      })
    );

    return NextResponse.json({
      instrument: data.instrument,
      granularity: data.granularity,
      candles,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch candle data" },
      { status: 500 }
    );
  }
}
