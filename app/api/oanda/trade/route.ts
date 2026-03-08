import { NextRequest, NextResponse } from "next/server";
import { oanda } from "@/lib/oanda-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instrument, units, side, stopLoss, takeProfit } = body;

    if (!instrument || !units || !side) {
      return NextResponse.json(
        { error: "Missing required fields: instrument, units, side" },
        { status: 400 }
      );
    }

    const orderUnits = side === "buy" ? Math.abs(units) : -Math.abs(units);

    interface OrderBody {
      type: string;
      instrument: string;
      units: string;
      timeInForce: string;
      positionFill: string;
      stopLossOnFill?: { price: string };
      takeProfitOnFill?: { price: string };
    }

    const orderConfig: OrderBody = {
      type: "MARKET",
      instrument,
      units: orderUnits.toString(),
      timeInForce: "FOK",
      positionFill: "DEFAULT",
    };

    if (stopLoss) {
      orderConfig.stopLossOnFill = { price: stopLoss.toString() };
    }
    if (takeProfit) {
      orderConfig.takeProfitOnFill = { price: takeProfit.toString() };
    }

    const data = await oanda.createOrder(orderConfig);
    return NextResponse.json({
      success: true,
      orderFillTransaction: data.orderFillTransaction,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place order" },
      { status: 500 }
    );
  }
}
