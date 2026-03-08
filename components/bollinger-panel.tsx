"use client";

import type { BollingerBands } from "@/lib/types";

interface BollingerPanelProps {
  bb: BollingerBands | null;
  currentPrice: number;
  instrument: string;
}

export function BollingerPanel({ bb, currentPrice, instrument }: BollingerPanelProps) {
  const decimals = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;
  const position = bb?.position ?? "INSIDE";

  const posConfig = {
    ABOVE_UPPER: {
      color: "text-bearish",
      bg: "bg-bearish/10",
      borderColor: "border-bearish/30",
      label: "ABOVE UPPER",
    },
    BELOW_LOWER: {
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      label: "BELOW LOWER",
    },
    INSIDE: {
      color: "text-muted-foreground",
      bg: "bg-card",
      borderColor: "border-border",
      label: "INSIDE BANDS",
    },
  };

  const config = posConfig[position];

  // Calculate price position within bands for visual
  let pricePercent = 50;
  if (bb) {
    pricePercent = ((currentPrice - bb.lower) / (bb.upper - bb.lower)) * 100;
    pricePercent = Math.min(105, Math.max(-5, pricePercent));
  }

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Bollinger Bands (20,2)
        </span>
        <span className={`text-xs font-mono font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      {bb ? (
        <>
          {/* Band values */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <span className="text-[10px] text-muted-foreground font-mono block">Upper</span>
              <span className="text-xs font-mono font-bold text-bearish">
                {bb.upper.toFixed(decimals)}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-muted-foreground font-mono block">Middle</span>
              <span className="text-xs font-mono font-bold text-foreground">
                {bb.middle.toFixed(decimals)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-mono block">Lower</span>
              <span className="text-xs font-mono font-bold text-bullish">
                {bb.lower.toFixed(decimals)}
              </span>
            </div>
          </div>

          {/* Visual band with price position */}
          <div className="relative">
            <div className="flex h-3 rounded-full overflow-hidden">
              <div className="w-full bg-gradient-to-r from-bullish/30 via-muted/20 to-bearish/30" />
            </div>
            {/* Price marker */}
            <div
              className="absolute top-[-1px] w-2 h-4 bg-foreground rounded-sm transition-all duration-300"
              style={{ left: `${pricePercent}%`, transform: "translateX(-50%)" }}
            />
          </div>

          {/* Band width */}
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              Width: {(bb.width * (instrument.includes("JPY") ? 100 : instrument.includes("XAU") ? 10 : 10000)).toFixed(1)} pips
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {pricePercent.toFixed(0)}%
            </span>
          </div>
        </>
      ) : (
        <span className="text-xs text-muted-foreground font-mono">Calculating...</span>
      )}
    </div>
  );
}
