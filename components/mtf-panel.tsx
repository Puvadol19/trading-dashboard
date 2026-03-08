"use client";

import { TrendingUp, TrendingDown, Minus, Layers } from "lucide-react";
import type { MTFAnalysis } from "@/lib/types";

interface MTFPanelProps {
  mtf: MTFAnalysis;
}

const trendIcon = {
  BULLISH: TrendingUp,
  BEARISH: TrendingDown,
  SIDEWAY: Minus,
};
const trendColor = {
  BULLISH: "text-bullish",
  BEARISH: "text-bearish",
  SIDEWAY: "text-sideway",
};

const confluenceConfig = {
  STRONG_BULL: {
    color: "text-bullish",
    bg: "bg-bullish/10",
    borderColor: "border-bullish/30",
    label: "STRONG BULLISH",
  },
  STRONG_BEAR: {
    color: "text-bearish",
    bg: "bg-bearish/10",
    borderColor: "border-bearish/30",
    label: "STRONG BEARISH",
  },
  MIXED: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    borderColor: "border-yellow-400/30",
    label: "MIXED SIGNALS",
  },
  NO_DATA: {
    color: "text-muted-foreground",
    bg: "bg-card",
    borderColor: "border-border",
    label: "LOADING...",
  },
};

interface TFRowProps {
  label: string;
  trend: "BULLISH" | "BEARISH" | "SIDEWAY" | null;
  slope: number | null;
}

function TFRow({ label, trend, slope }: TFRowProps) {
  if (!trend || slope === null) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
        <span className="text-xs font-mono text-muted-foreground">--</span>
      </div>
    );
  }

  const Icon = trendIcon[trend];
  const color = trendColor[trend];

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs font-mono text-muted-foreground w-8">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-mono ${color}`}>
          {slope.toFixed(6)}
        </span>
        <div className="flex items-center gap-1">
          <Icon className={`w-3 h-3 ${color}`} />
          <span className={`text-xs font-mono font-semibold ${color}`}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MTFPanel({ mtf }: MTFPanelProps) {
  const config = confluenceConfig[mtf.confluence];

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Multi-TF Slope
          </span>
        </div>
        <span className={`text-xs font-mono font-semibold ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="flex flex-col">
        <TFRow
          label="S5"
          trend={mtf.s5?.trend ?? null}
          slope={mtf.s5?.slope ?? null}
        />
        <TFRow
          label="M1"
          trend={mtf.m1?.trend ?? null}
          slope={mtf.m1?.slope ?? null}
        />
        <TFRow
          label="M5"
          trend={mtf.m5?.trend ?? null}
          slope={mtf.m5?.slope ?? null}
        />
      </div>
    </div>
  );
}
