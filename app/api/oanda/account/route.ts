import { NextResponse } from "next/server";
import { oanda } from "@/lib/oanda-client";

export async function GET() {
  try {
    const data = await oanda.getAccountSummary();
    const account = data.account;

    return NextResponse.json({
      balance: parseFloat(account.balance),
      unrealizedPL: parseFloat(account.unrealizedPL),
      pl: parseFloat(account.pl),
      openTradeCount: account.openTradeCount,
      currency: account.currency,
      marginUsed: parseFloat(account.marginUsed),
      marginAvailable: parseFloat(account.marginAvailable),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch account data" },
      { status: 500 }
    );
  }
}
