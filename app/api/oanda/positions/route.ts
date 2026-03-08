import { NextResponse } from "next/server";
import { oanda } from "@/lib/oanda-client";

export async function GET() {
  try {
    const data = await oanda.getOpenTrades();

    interface OandaTrade {
      id: string;
      instrument: string;
      currentUnits: string;
      price: string;
      unrealizedPL: string;
      initialUnits: string;
    }

    const positions = (data.trades || []).map((trade: OandaTrade) => ({
      tradeId: trade.id,
      instrument: trade.instrument,
      units: parseFloat(trade.currentUnits),
      averagePrice: parseFloat(trade.price),
      unrealizedPL: parseFloat(trade.unrealizedPL),
      side: parseFloat(trade.initialUnits) > 0 ? "long" : "short",
    }));

    return NextResponse.json({ positions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
