"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader2, Sparkles, RotateCcw } from "lucide-react";
import type { CandleData, SlopeAnalysis, RSIData, MACDData, TickVelocity, MTFAnalysis } from "@/lib/types";

interface AiChatPanelProps {
  instrument: string;
  currentTick: { bid: number; ask: number } | null;
  slope: SlopeAnalysis | null;
  rsi: RSIData | null;
  macd: MACDData | null;
  tickVelocity: TickVelocity | null;
  advice: string;
  adviceLevel: string;
  mtf: MTFAnalysis | null;
  candles: CandleData[];
}

const QUICK_PROMPTS = [
  "เทรนด์ตอนนี้เป็นยังไง?",
  "ควร Buy หรือ Sell?",
  "RSI บอกอะไร?",
  "MACD สัญญาณล่าสุด?",
  "จุด Support/Resistance อยู่ที่ไหน?",
  "What is the current trend?",
];

function getMessageText(msg: { parts?: { type: string; text?: string }[] }): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return "";
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function AiChatPanel({
  instrument,
  currentTick,
  slope,
  rsi,
  macd,
  tickVelocity,
  advice,
  adviceLevel,
  mtf,
  candles,
}: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build live context to send with every message
  const buildContext = () => ({
    instrument,
    currentPrice: currentTick?.bid ?? candles[candles.length - 1]?.close ?? 0,
    bid: currentTick?.bid ?? 0,
    ask: currentTick?.ask ?? 0,
    spread: currentTick ? (currentTick.ask - currentTick.bid) * 10000 : 0,
    slope: slope?.slope ?? null,
    slopeDirection: slope ? (slope.slope > 0 ? "BULLISH" : slope.slope < 0 ? "BEARISH" : "SIDEWAYS") : "N/A",
    rsi: rsi?.rsi ?? null,
    macd: macd ? { macd: macd.macd, signal: macd.signal, histogram: macd.histogram } : null,
    tickVelocity: tickVelocity?.velocity ?? null,
    advice,
    adviceLevel,
    mtf: mtf
      ? {
          s5: mtf.s5?.slope ?? null,
          m1: mtf.m1?.slope ?? null,
          m5: mtf.m5?.slope ?? null,
        }
      : null,
    recentCandles: candles.slice(-10).map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      time: c.time,
    })),
  });

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: {
          id,
          messages: msgs,
          context: buildContext(),
        },
      }),
    }),
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "transparent" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-mono font-semibold text-foreground">AI Trading Analyst</p>
            <p className="text-[9px] text-muted-foreground font-mono">
              Live context: {instrument.replace("_", "/")} •{" "}
              <span className={adviceLevel === "safe" ? "text-bullish" : adviceLevel === "danger" ? "text-bearish" : "text-yellow-400"}>
                {adviceLevel.toUpperCase()}
              </span>
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => window.location.reload()}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Clear chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-foreground mb-1">ถามอะไรเกี่ยวกับกราฟได้เลย</p>
              <p className="text-[10px] text-muted-foreground font-mono">AI รู้ข้อมูล live ของ {instrument.replace("_", "/")} ทั้งหมด</p>
            </div>
            {/* Quick prompts */}
            <div className="flex flex-col gap-1.5 w-full">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="text-left text-[10px] font-mono px-3 py-1.5 rounded-md border border-border bg-card hover:bg-primary/5 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const text = getMessageText(msg as Parameters<typeof getMessageText>[0]);
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                    isUser ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  {isUser ? (
                    <User className="w-3 h-3 text-primary" />
                  ) : (
                    <Bot className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}
                >
                  {text || (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      กำลังวิเคราะห์...
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Streaming indicator */}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-secondary shrink-0 flex items-center justify-center mt-0.5">
              <Bot className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="bg-card border border-border rounded-xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-[10px] font-mono text-bearish text-center px-2 py-1 bg-bearish/10 rounded-md border border-bearish/20">
            เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 pt-3 border-t border-border mt-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ถามเกี่ยวกับกราฟ... (Enter เพื่อส่ง)"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-card border border-border rounded-lg px-3 py-2 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 transition-colors"
            style={{ maxHeight: 80, overflowY: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-primary/80 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-primary-foreground animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-primary-foreground" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground font-mono mt-1.5 text-center">
          AI วิเคราะห์จากข้อมูล live — ไม่ใช่คำแนะนำทางการเงิน
        </p>
      </div>
    </div>
  );
}
