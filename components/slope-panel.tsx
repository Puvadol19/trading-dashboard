"use client";

import { TrendingUp, TrendingDown, Minus, Settings2 } from "lucide-react";
import type { SlopeAnalysis } from "@/lib/types";
import { useState } from "react";

interface SlopePanelProps {
  slope: SlopeAnalysis | null;
  fastSlope: SlopeAnalysis | null;
  slowSlope: SlopeAnalysis | null;
  period: number;
  onPeriodChange: (period: number) => void;
}

const PERIOD_OPTIONS = [8, 12, 16, 20, 30, 40];

export function SlopePanel({ slope, fastSlope, slowSlope, period, onPeriodChange }: SlopePanelProps) {
  const [showSettings, setShowSettings] = useState(false);

  const trend = slope?.trend || "SIDEWAY";
  const slopeValue = slope?.slope || 0;

  const trendConfig = {
    BULLISH: {
      icon: TrendingUp,
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      label: "BULLISH",
      barColor: "bg-bullish",
    },
    BEARISH: {
      icon: TrendingDown,
      color: "text-bearish",
      bg: "bg-bearish/10",
      borderColor: "border-bearish/30",
      label: "BEARISH",
      barColor: "bg-bearish",
    },
    SIDEWAY: {
      icon: Minus,
      color: "text-sideway",
      bg: "bg-sideway/10",
      borderColor: "border-sideway/30",
      label: "SIDEWAY",
      barColor: "bg-sideway",
    },
  };

  const config = trendConfig[trend];
  const Icon = config.icon;

  // Normalize slope for visual bar
  const normalizedSlope = Math.max(-1, Math.min(1, slopeValue / 0.0001));
  const barWidth = Math.abs(normalizedSlope) * 100;

  // Fast vs Slow divergence detection
  const fastTrend = fastSlope?.trend;
  const slowTrend = slowSlope?.trend;
  const isDiverging = fastTrend && slowTrend && fastTrend !== slowTrend;
  const divergenceMessage = isDiverging
    ? `Fast(12): ${fastTrend} vs Slow(40): ${slowTrend}`
    : null;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Slope Filter ({period})
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-secondary/50 transition-colors"
            title="Adjust period"
          >
            <Settings2 className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
        <div className={`flex items-center gap-1.5 ${config.color}`}>
          <Icon className="w-4 h-4" />
          <span className="text-sm font-semibold font-mono">{config.label}</span>
        </div>
      </div>

      {/* Period selector */}
      {showSettings && (
        <div className="mb-3 p-2 bg-secondary/30 rounded-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground font-mono">PERIOD</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Short = Fast react, Long = Smooth
            </span>
          </div>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`flex-1 py-1.5 text-xs font-mono rounded transition-colors min-h-[32px] ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2">
        <span className={`text-2xl font-mono font-bold ${config.color}`}>
          {slopeValue.toFixed(6)}
        </span>
      </div>

      {/* Slope strength bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} rounded-full transition-all duration-300`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">{barWidth.toFixed(0)}%</span>
      </div>

      {/* Fast vs Slow comparison */}
      <div className="border-t border-border/50 pt-2 mt-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Fast(12):</span>
            <span
              className={
                fastTrend === "BULLISH"
                  ? "text-bullish"
                  : fastTrend === "BEARISH"
                  ? "text-bearish"
                  : "text-sideway"
              }
            >
              {fastTrend || "---"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Slow(40):</span>
            <span
              className={
                slowTrend === "BULLISH"
                  ? "text-bullish"
                  : slowTrend === "BEARISH"
                  ? "text-bearish"
                  : "text-sideway"
              }
            >
              {slowTrend || "---"}
            </span>
          </div>
        </div>

        {/* Divergence warning */}
        {isDiverging && (
          <div className="mt-2 px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] font-mono text-yellow-400">
            {divergenceMessage} - Potential reversal
          </div>
        )}
      </div>
    </div>
  );
}
