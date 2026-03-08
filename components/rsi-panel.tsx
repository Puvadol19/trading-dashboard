"use client";

import type { RSIData } from "@/lib/types";

interface RSIPanelProps {
  rsi: RSIData | null;
}

export function RSIPanel({ rsi }: RSIPanelProps) {
  const value = rsi?.value ?? 50;
  const condition = rsi?.condition ?? "NEUTRAL";

  const conditionConfig = {
    OVERBOUGHT: {
      color: "text-bearish",
      bg: "bg-bearish/10",
      borderColor: "border-bearish/30",
      barColor: "bg-bearish",
      label: "OVERBOUGHT",
    },
    OVERSOLD: {
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      barColor: "bg-bullish",
      label: "OVERSOLD",
    },
    NEUTRAL: {
      color: "text-muted-foreground",
      bg: "bg-card",
      borderColor: "border-border",
      barColor: "bg-primary",
      label: "NEUTRAL",
    },
  };

  const config = conditionConfig[condition];

  // RSI gauge position (0-100)
  const gaugePosition = Math.min(100, Math.max(0, value));

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          RSI (14)
        </span>
        <span className={`text-xs font-mono font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="mb-2">
        <span className={`text-2xl font-mono font-bold ${config.color}`}>
          {value.toFixed(1)}
        </span>
      </div>

      {/* RSI gauge bar */}
      <div className="relative">
        <div className="flex h-2 bg-secondary rounded-full overflow-hidden">
          <div className="w-[30%] bg-bullish/30" />
          <div className="w-[40%] bg-muted-foreground/20" />
          <div className="w-[30%] bg-bearish/30" />
        </div>
        {/* Pointer */}
        <div
          className="absolute top-[-2px] w-1 h-3 bg-foreground rounded-full transition-all duration-300"
          style={{ left: `${gaugePosition}%`, transform: "translateX(-50%)" }}
        />
        {/* Labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-mono text-bullish">30</span>
          <span className="text-[10px] font-mono text-muted-foreground">50</span>
          <span className="text-[10px] font-mono text-bearish">70</span>
        </div>
      </div>
    </div>
  );
}
