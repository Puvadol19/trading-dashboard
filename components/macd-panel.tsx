"use client";

import type { MACDData } from "@/lib/types";

interface MACDPanelProps {
  macd: MACDData | null;
}

export function MACDPanel({ macd }: MACDPanelProps) {
  const histogram = macd?.histogram ?? 0;
  const macdValue = macd?.macd ?? 0;
  const signalValue = macd?.signal ?? 0;
  const crossover = macd?.crossover ?? "NONE";

  const crossConfig = {
    BULLISH_CROSS: {
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      label: "BULLISH CROSS",
    },
    BEARISH_CROSS: {
      color: "text-bearish",
      bg: "bg-bearish/10",
      borderColor: "border-bearish/30",
      label: "BEARISH CROSS",
    },
    NONE: {
      color: "text-muted-foreground",
      bg: "bg-card",
      borderColor: "border-border",
      label: histogram >= 0 ? "POSITIVE" : "NEGATIVE",
    },
  };

  const config = crossConfig[crossover];
  const histColor = histogram >= 0 ? "text-bullish" : "text-bearish";
  const histBarColor = histogram >= 0 ? "bg-bullish" : "bg-bearish";
  const histWidth = Math.min(100, Math.abs(histogram) / 0.0005 * 100);

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          MACD (12,26,9)
        </span>
        {crossover !== "NONE" && (
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${histogram >= 0 ? "bg-bullish" : "bg-bearish"} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${histogram >= 0 ? "bg-bullish" : "bg-bearish"}`} />
          </span>
        )}
        <span className={`text-xs font-mono font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* MACD / Signal values */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">MACD</span>
          <span className="text-sm font-mono font-bold text-foreground">
            {macdValue.toFixed(5)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Signal</span>
          <span className="text-sm font-mono font-bold text-foreground">
            {signalValue.toFixed(5)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Histogram</span>
          <span className={`text-sm font-mono font-bold ${histColor}`}>
            {histogram >= 0 ? "+" : ""}{histogram.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Histogram bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full ${histBarColor} rounded-full transition-all duration-300`}
            style={{ width: `${histWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}
