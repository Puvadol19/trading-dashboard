"use client";

import type { TickData } from "@/lib/types";

interface TickInfoProps {
  tick: TickData | null;
  instrument: string;
}

export function TickInfo({ tick, instrument }: TickInfoProps) {
  const decimals = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;

  if (!tick) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 md:p-4">
        <span className="text-xs text-muted-foreground font-mono">
          Waiting for tick data...
        </span>
      </div>
    );
  }

  const spread = tick.spread;

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Current Price
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          Spread: {(spread * (instrument.includes("JPY") ? 100 : instrument.includes("XAU") ? 10 : 10000)).toFixed(1)} pips
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-muted-foreground font-mono block mb-1">
            BID
          </span>
          <span className="text-xl font-mono font-bold text-bearish">
            {tick.bid.toFixed(decimals)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground font-mono block mb-1">
            ASK
          </span>
          <span className="text-xl font-mono font-bold text-bullish">
            {tick.ask.toFixed(decimals)}
          </span>
        </div>
      </div>
    </div>
  );
}
