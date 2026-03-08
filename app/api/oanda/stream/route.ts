import { NextRequest } from "next/server";
import { OANDA_CONFIG } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const instrument = searchParams.get("instrument") || "EUR_USD";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false;

      request.signal.addEventListener("abort", () => {
        aborted = true;
        controller.close();
      });

      try {
        const url = `${OANDA_CONFIG.STREAM_URL}/v3/accounts/${OANDA_CONFIG.ACCOUNT_ID}/pricing/stream?instruments=${instrument}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${OANDA_CONFIG.API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok || !response.body) {
          const msg = JSON.stringify({
            error: `Stream error: ${response.status}`,
          });
          controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "PRICE") {
                const tick = {
                  type: "tick",
                  time: new Date(parsed.time).getTime(),
                  bid: parseFloat(parsed.bids?.[0]?.price || "0"),
                  ask: parseFloat(parsed.asks?.[0]?.price || "0"),
                  spread:
                    parseFloat(parsed.asks?.[0]?.price || "0") -
                    parseFloat(parsed.bids?.[0]?.price || "0"),
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(tick)}\n\n`)
                );
              }
            } catch {
              // skip non-JSON lines (heartbeats, etc)
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          const msg = JSON.stringify({
            error: `Stream failed: ${err instanceof Error ? err.message : "unknown"}`,
          });
          controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
        }
      } finally {
        if (!aborted) {
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
