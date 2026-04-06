"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Bot, User, Loader2, Sparkles, RotateCcw, Bell } from "lucide-react";
import type { CandleData, SlopeAnalysis, RSIData, MACDData, TickVelocity, MTFAnalysis, MOLinearResult } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

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
  moLinear: MOLinearResult | null;
}

type AlertType = "bullish_cross" | "bearish_cross" | "k_breakout" | "momentum_surge";

interface AiAlert {
  id: string;
  type: AlertType;
  message: string;
  timestamp: number;
  aiAnalysis: string;
}

const QUICK_PROMPTS = [
  "เทรนด์ตอนนี้เป็นยังไง?",
  "ควร Buy หรือ Sell?",
  "RSI บอกอะไร?",
  "MACD สัญญาณล่าสุด?",
  "MO Linear บอกอะไร? mid(a) vs k เป็นยังไง?",
  "จุด Support/Resistance อยู่ที่ไหน?",
];

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
  moLinear,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAlerts, setAiAlerts] = useState<AiAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevSignalRef = useRef<{ midAAboveK: boolean | null }>({ midAAboveK: null });

  // Extract latest MO Linear values
  const latestMO = moLinear
    ? {
        midA: moLinear.midA[moLinear.midA.length - 1] ?? null,
        midB: moLinear.midB[moLinear.midB.length - 1] ?? null,
        k: moLinear.k[moLinear.k.length - 1] ?? null,
        midA1: moLinear.midA1[moLinear.midA1.length - 1] ?? null,
        midB1: moLinear.midB1[moLinear.midB1.length - 1] ?? null,
        k1: moLinear.k1[moLinear.k1.length - 1] ?? null,
        // Previous bar for crossover detection
        prevMidA: moLinear.midA[moLinear.midA.length - 2] ?? null,
        prevK: moLinear.k[moLinear.k.length - 2] ?? null,
      }
    : null;

  // Auto-alert: detect MO Linear crossovers
  useEffect(() => {
    if (!latestMO || latestMO.midA === null || latestMO.k === null) return;
    if (latestMO.prevMidA === null || latestMO.prevK === null) return;

    const midAAboveK = latestMO.midA > latestMO.k;
    const prevMidAAboveK = latestMO.prevMidA > latestMO.prevK;

    if (prevSignalRef.current.midAAboveK === null) {
      prevSignalRef.current.midAAboveK = midAAboveK;
      return;
    }

    if (midAAboveK !== prevSignalRef.current.midAAboveK) {
      const isBullish = midAAboveK;
      const type: AlertType = isBullish ? "bullish_cross" : "bearish_cross";
      const message = isBullish
        ? `MO Linear: mid(a) ตัด k ขึ้น — สัญญาณ BULLISH`
        : `MO Linear: mid(a) ตัด k ลง — สัญญาณ BEARISH`;

      const newAlert: AiAlert = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: Date.now(),
        aiAnalysis: "",
      };

      setAiAlerts((prev) => [newAlert, ...prev].slice(0, 10));
      setShowAlerts(true);

      // Ask AI to analyze the crossover automatically
      const autoPrompt = isBullish
        ? `MO Linear เพิ่งเกิด Bullish Cross (mid(a) ตัด k ขึ้น) บน ${instrument.replace("_", "/")} midA=${latestMO.midA?.toFixed(5)} k=${latestMO.k?.toFixed(5)} วิเคราะห์สัญญาณนี้ให้หน่อย`
        : `MO Linear เพิ่งเกิด Bearish Cross (mid(a) ตัด k ลง) บน ${instrument.replace("_", "/")} midA=${latestMO.midA?.toFixed(5)} k=${latestMO.k?.toFixed(5)} วิเคราะห์สัญญาณนี้ให้หน่อย`;

      sendAutoAlert(autoPrompt, newAlert.id);
      prevSignalRef.current.midAAboveK = midAAboveK;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMO?.midA, latestMO?.k]);

  const buildContext = useCallback(() => ({
    instrument,
    currentPrice: currentTick?.bid ?? candles[candles.length - 1]?.close ?? 0,
    bid: currentTick?.bid ?? 0,
    ask: currentTick?.ask ?? 0,
    spread: currentTick ? (currentTick.ask - currentTick.bid) * 10000 : 0,
    slope: slope?.slope ?? null,
    slopeDirection: slope
      ? slope.slope > 0 ? "BULLISH" : slope.slope < 0 ? "BEARISH" : "SIDEWAYS"
      : "N/A",
    rsi: rsi?.rsi ?? null,
    macd: macd ? { macd: macd.macd, signal: macd.signal, histogram: macd.histogram } : null,
    tickVelocity: tickVelocity?.velocity ?? null,
    advice,
    adviceLevel,
    mtf: mtf
      ? { s5: mtf.s5?.slope ?? null, m1: mtf.m1?.slope ?? null, m5: mtf.m5?.slope ?? null }
      : null,
    recentCandles: candles.slice(-10).map((c) => ({
      open: c.open, high: c.high, low: c.low, close: c.close, time: c.time,
    })),
        moLinear: latestMO
      ? {
          midA: latestMO.midA,
          midB: latestMO.midB,
          k: latestMO.k,
          midA_vs_k: latestMO.midA !== null && latestMO.k !== null
            ? latestMO.midA > latestMO.k ? "mid(a) ABOVE k — bullish bias" : "mid(a) BELOW k — bearish bias"
            : "N/A",
          normalizedK1: latestMO.k1,
        }
      : null,
  }), [instrument, currentTick, slope, rsi, macd, tickVelocity, advice, adviceLevel, mtf, candles, latestMO]);

  const sendAutoAlert = useCallback(async (prompt: string, alertId: string) => {
    const assistantId = `alert-${alertId}`;
    setMessages((prev) => [
      ...prev,
      { id: `trigger-${alertId}`, role: "user" as const, content: `[AUTO ALERT] ${prompt}` },
      { id: assistantId, role: "assistant" as const, content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          context: buildContext(),
        }),
      });

      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m
                )
              );
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* silent fail for auto alerts */ }
  }, [buildContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setInput("");

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: buildContext(),
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m
                )
              );
            }
          } catch {
            // skip invalid JSON chunks
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const detail = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `เกิดข้อผิดพลาด: ${detail}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, buildContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  };

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
              Live: {instrument.replace("_", "/")} •{" "}
              {latestMO?.midA !== null && latestMO?.k !== null && latestMO?.midA !== undefined && latestMO?.k !== undefined ? (
                <span className={latestMO.midA > latestMO.k ? "text-green-400" : "text-red-400"}>
                  MO {latestMO.midA > latestMO.k ? "BULL" : "BEAR"}
                </span>
              ) : (
                <span className="text-muted-foreground">MO —</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Alert bell */}
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative text-muted-foreground hover:text-foreground transition-colors p-1"
            title="AI Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            {aiAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 text-[7px] flex items-center justify-center font-bold text-black">
                {aiAlerts.length > 9 ? "9" : aiAlerts.length}
              </span>
            )}
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Clear chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* AI Alert panel — always visible when Bell is toggled */}
      {showAlerts && (
        <div className="shrink-0 mb-3 rounded-lg border border-border bg-card/50 p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Bell className="w-3 h-3" /> AI Auto-Alerts
            </span>
            <div className="flex items-center gap-2">
              {aiAlerts.length > 0 && (
                <button
                  onClick={() => setAiAlerts([])}
                  className="text-[9px] font-mono text-muted-foreground hover:text-foreground"
                >
                  clear all
                </button>
              )}
              <button
                onClick={() => setShowAlerts(false)}
                className="text-[9px] font-mono text-muted-foreground hover:text-foreground"
              >
                close
              </button>
            </div>
          </div>
          {aiAlerts.length === 0 ? (
            <p className="text-[10px] font-mono text-muted-foreground text-center py-2">
              ยังไม่มี alert — ระบบจะแจ้งเตือนอัตโนมัติเมื่อ mid(a) ตัด k
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
              {aiAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-md border text-[10px] font-mono ${
                    alert.type === "bullish_cross"
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  <Bell className="w-3 h-3 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{alert.message}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString("th-TH")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono text-foreground mb-1">ถามอะไรเกี่ยวกับกราฟได้เลย</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                AI รู้ข้อมูล live ข���ง {instrument.replace("_", "/")} ทั้งหมด
              </p>
            </div>
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
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${isUser ? "bg-primary/20" : "bg-secondary"}`}>
                  {isUser ? <User className="w-3 h-3 text-primary" /> : <Bot className="w-3 h-3 text-muted-foreground" />}
                </div>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words ${
                  isUser
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                }`}>
                  {msg.content || (
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

        {error && (
          <div className="text-[10px] font-mono text-red-400 text-center px-2 py-1 bg-red-500/10 rounded-md border border-red-500/20">
            {error}
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
            onClick={() => sendMessage(input)}
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
