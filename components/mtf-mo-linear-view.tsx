"use client";

import { useState, useEffect } from "react";
import { MoLinearChart } from "@/components/mo-linear-chart";
import type { CandleData } from "@/lib/types";

interface MtfMoLinearViewProps {
  s5Candles: CandleData[];
  m1Candles: CandleData[];
  m5Candles: CandleData[];
  instrument: string;
}

const TIMEFRAMES = [
  { key: "s5" as const, label: "S5",  description: "5 Second" },
  { key: "m1" as const, label: "M1",  description: "1 Minute" },
  { key: "m5" as const, label: "M5",  description: "5 Minute" },
];

export function MtfMoLinearView({
  s5Candles,
  m1Candles,
  m5Candles,
  instrument,
}: MtfMoLinearViewProps) {
  const [period, setPeriod] = useState(5);
  const [dcPeriod, setDcPeriod] = useState(5);
  const [activeTf, setActiveTf] = useState<"s5" | "m1" | "m5">("s5");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const candleMap: Record<"s5" | "m1" | "m5", CandleData[]> = {
    s5: s5Candles,
    m1: m1Candles,
    m5: m5Candles,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#111827",
        overflow: "hidden",
      }}
    >
      {/* Top controls bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 12px",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
          background: "#0f172a",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "#94a3b8",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          MO Linear — Multi-Timeframe
        </span>

        {/* Instrument */}
        <span
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "#3b82f6",
            fontWeight: 600,
          }}
        >
          {instrument.replace("_", "/")}
        </span>

        <div style={{ flex: 1 }} />

        {/* Period control */}
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b" }}>P</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: "2px 6px",
          }}
        >
          <button
            onClick={() => setPeriod((p) => Math.max(2, p - 1))}
            style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}
          >
            -
          </button>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#e2e8f0", minWidth: 16, textAlign: "center" }}>
            {period}
          </span>
          <button
            onClick={() => setPeriod((p) => Math.min(30, p + 1))}
            style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}
          >
            +
          </button>
        </div>

        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b" }}>DC</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 4,
            padding: "2px 6px",
          }}
        >
          <button
            onClick={() => setDcPeriod((p) => Math.max(2, p - 1))}
            style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}
          >
            -
          </button>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#e2e8f0", minWidth: 16, textAlign: "center" }}>
            {dcPeriod}
          </span>
          <button
            onClick={() => setDcPeriod((p) => Math.min(30, p + 1))}
            style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1, cursor: "pointer", background: "none", border: "none" }}
          >
            +
          </button>
        </div>
      </div>

      {/* Mobile: TF tab switcher */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #1e293b",
            background: "#0f172a",
            flexShrink: 0,
          }}
        >
          {TIMEFRAMES.map((tf) => {
            const isActive = activeTf === tf.key;
            const hasData = candleMap[tf.key].length > 0;
            return (
              <button
                key={tf.key}
                onClick={() => setActiveTf(tf.key)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: isActive ? "#3b82f6" : "#94a3b8" }}>{tf.label}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: hasData ? "#22c55e" : "#ef4444" }}>
                  {hasData ? `n=${candleMap[tf.key].length}` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Chart grid — desktop: 3 columns | mobile: single active TF */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          minHeight: 0,
          gap: 0,
        }}
      >
        {TIMEFRAMES.map((tf, idx) => {
          const tfCandles = candleMap[tf.key];
          const hasData = tfCandles.length > 0;
          // On mobile, only render the active tab
          if (isMobile && tf.key !== activeTf) return null;

          return (
            <div
              key={tf.key}
              style={{
                flex: "1 1 0px",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                borderRight: !isMobile && idx < TIMEFRAMES.length - 1 ? "1px solid #1e293b" : "none",
              }}
            >
              {/* Column header — only on desktop */}
              {!isMobile && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 10px",
                    borderBottom: "1px solid #1e293b",
                    background: "#0f172a",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#e2e8f0" }}>{tf.label}</span>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: "#64748b" }}>{tf.description}</span>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: "monospace", color: hasData ? "#22c55e" : "#ef4444" }}>
                    {hasData ? `n=${tfCandles.length}` : "NO DATA"}
                  </span>
                </div>
              )}

              {/* Chart area */}
              <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                {hasData ? (
                  <MoLinearChart
                    candles={tfCandles}
                    period={period}
                    dcPeriod={dcPeriod}
                    instrument={`${instrument} ${tf.label}`}
                  />
                ) : (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#111827",
                      color: "#334155",
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  >
                    Loading {tf.label} candles...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
