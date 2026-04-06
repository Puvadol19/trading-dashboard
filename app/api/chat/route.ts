export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    context,
  }: {
    messages: { role: "user" | "assistant"; content: string }[];
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
          .map(
            (c) =>
              `O:${c.open.toFixed(5)} H:${c.high.toFixed(5)} L:${c.low.toFixed(5)} C:${c.close.toFixed(5)}`
          )
          .join(" | ")
      : "No candle data";

  const systemPrompt = `You are an expert forex and gold trading analyst AI embedded in a real-time trading dashboard.

## Live Market Data for ${context.instrument.replace("_", "/")}
- Price: ${context.currentPrice.toFixed(5)} | Bid: ${context.bid.toFixed(5)} | Ask: ${context.ask.toFixed(5)} | Spread: ${context.spread.toFixed(1)} pips
- Slope: ${context.slope !== null ? context.slope.toFixed(6) : "N/A"} (${context.slopeDirection})
- RSI: ${context.rsi !== null ? context.rsi.toFixed(2) : "N/A"}
- MACD: ${context.macd ? `MACD=${context.macd.macd.toFixed(5)} Signal=${context.macd.signal.toFixed(5)} Hist=${context.macd.histogram.toFixed(5)}` : "N/A"}
- Tick Velocity: ${context.tickVelocity !== null ? `${context.tickVelocity.toFixed(2)} pips/sec` : "N/A"}
- System Advice: ${context.advice} (${context.adviceLevel})
- MTF Slope → S5: ${context.mtf?.s5?.toFixed(6) ?? "N/A"} | M1: ${context.mtf?.m1?.toFixed(6) ?? "N/A"} | M5: ${context.mtf?.m5?.toFixed(6) ?? "N/A"}
- Last 10 Candles: ${candleSummary}

Answer questions using this live data. Be concise. Respond in the same language the user uses (Thai or English). Always note this is analysis, not financial advice.`;

  const response = await fetch("https://gateway.ai.vercel.com/v1/gq8cqkfk3mgjwtgm6frge35w/v0-trading/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY ?? ""}`,
    },
    signal: req.signal,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream the OpenAI SSE response directly to the client
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
