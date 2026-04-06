import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
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

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";

  if (!apiKey) {
    return new Response(
      `data: ${JSON.stringify({ error: "OPENROUTER_API_KEY ยังไม่ได้ตั้งค่า — ไปที่ Settings > Vars แล้วเพิ่ม OPENROUTER_API_KEY" })}\n\ndata: [DONE]\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Try models in order until one works
  const FREE_MODELS = [
    "stepfun/step-3-5-flash:free",
    "meta-llama/llama-4-maverick:free",
    "meta-llama/llama-4-scout:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "qwen/qwen3-235b-a22b:free",
    "mistralai/mistral-7b-instruct:free",
  ];

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://trading-dashboard.vercel.app",
    "X-Title": "Trading Dashboard AI",
  };

  let response: Response | null = null;
  let lastError = "";

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
      });

      if (res.ok) {
        response = res;
        break;
      }

      const errText = await res.text();
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message ?? errText; } catch { /* ok */ }

      // 404 = model not available, try next; other errors = stop
      if (res.status !== 404) {
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: `OpenRouter error ${res.status}: ${detail}` } }] })}\n\ndata: [DONE]\n\n`,
          { status: 200, headers: { "Content-Type": "text/event-stream" } }
        );
      }
      lastError = `${model}: ${detail}`;
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `เชื่อมต่อ OpenRouter ไม่ได้: ${msg}` } }] })}\n\ndata: [DONE]\n\n`,
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  }

  if (!response) {
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: `ไม่พบ model ที่ใช้งานได้: ${lastError}` } }] })}\n\ndata: [DONE]\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Stream SSE response directly to client
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
