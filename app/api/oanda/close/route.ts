import { NextRequest, NextResponse } from "next/server";
import { oanda } from "@/lib/oanda-client";

// Close a single trade by tradeId
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tradeId } = body;

    if (!tradeId) {
      return NextResponse.json(
        { error: "Missing required field: tradeId" },
        { status: 400 }
      );
    }

    const data = await oanda.closeTrade(tradeId);
    return NextResponse.json({
      success: true,
      orderFillTransaction: data.orderFillTransaction,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close trade" },
      { status: 500 }
    );
  }
}

// Close ALL open trades
export async function DELETE() {
  try {
    // First get all open trades
    const tradesData = await oanda.getOpenTrades();
    const trades: { id: string }[] = tradesData.trades || [];

    if (trades.length === 0) {
      return NextResponse.json({ success: true, closed: 0 });
    }

    // Close all trades in parallel
    const closeResults = await Promise.allSettled(
      trades.map((trade) => oanda.closeTrade(trade.id))
    );

    const closed = closeResults.filter((r) => r.status === "fulfilled").length;
    const failed = closeResults.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ success: true, closed, failed, total: trades.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to close all trades" },
      { status: 500 }
    );
  }
}
