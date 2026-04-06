import { convertToModelMessages, streamText, UIMessage } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    context,
  }: {
    messages: UIMessage[];
    context: {
      instrument: string;
      currentPrice: number;
      bid: number;
      ask: number;
      spread: number;
      slope: number | null;
      slopeDirection: string;
      rsi: number | null;
      macd: { macd: number; signal: number; histogram: number } | null;
      tickVelocity: number | null;
      advice: string;
      adviceLevel: string;
      mtf: { s5: number | null; m1: number | null; m5: number | null } | null;
      recentCandles: { open: number; high: number; low: number; close: number; time: number }[];
    };
  } = await req.json();

  const candleSummary =
    context.recentCandles.length > 0
      ? context.recentCandles
          .slice(-10)
          .map(
            (c) =>
              `O:${c.open.toFixed(5)} H:${c.high.toFixed(5)} L:${c.low.toFixed(5)} C:${c.close.toFixed(5)}`
          )
          .join(" | ")
      : "No candle data available";

  const systemPrompt = `You are an expert forex and gold trading analyst AI assistant embedded inside a real-time trading dashboard. You have access to live market data for ${context.instrument}.

## Current Market Snapshot
- Instrument: ${context.instrument.replace("_", "/")}
- Current Price: ${context.currentPrice.toFixed(5)}
- Bid: ${context.bid.toFixed(5)} | Ask: ${context.ask.toFixed(5)}
- Spread: ${context.spread.toFixed(1)} pips

## Technical Indicators (Live)
- Slope: ${context.slope !== null ? context.slope.toFixed(6) : "N/A"} (${context.slopeDirection})
- RSI: ${context.rsi !== null ? context.rsi.toFixed(2) : "N/A"}
- MACD: ${context.macd ? `MACD=${context.macd.macd.toFixed(5)} Signal=${context.macd.signal.toFixed(5)} Hist=${context.macd.histogram.toFixed(5)}` : "N/A"}
- Tick Velocity: ${context.tickVelocity !== null ? `${context.tickVelocity.toFixed(2)} pips/sec` : "N/A"}

## System Advice
- Advice: ${context.advice}
- Level: ${context.adviceLevel}

## Multi-Timeframe Slope
- S5: ${context.mtf?.s5 !== null ? context.mtf?.s5?.toFixed(6) : "N/A"}
- M1: ${context.mtf?.m1 !== null ? context.mtf?.m1?.toFixed(6) : "N/A"}
- M5: ${context.mtf?.m5 !== null ? context.mtf?.m5?.toFixed(6) : "N/A"}

## Last 10 Candles (S5)
${candleSummary}

## Your Role
- Answer questions about the current market conditions using the live data above.
- Provide analysis on trend direction, momentum, and potential trade setups.
- Explain what the indicators mean in plain language if asked.
- Be concise and direct — traders need fast answers.
- Always remind users that this is analysis only, not financial advice.
- Respond in the same language the user writes in (Thai or English).`;

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}
