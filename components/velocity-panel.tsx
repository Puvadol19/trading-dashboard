"use client";

import { Zap, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { TickVelocity } from "@/lib/types";

interface VelocityPanelProps {
  velocity: TickVelocity;
}

export function VelocityPanel({ velocity }: VelocityPanelProps) {
  const momentumConfig = {
    HIGH: {
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      barColor: "bg-bullish",
      label: "HIGH",
    },
    MEDIUM: {
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      borderColor: "border-yellow-400/30",
      barColor: "bg-yellow-400",
      label: "MEDIUM",
    },
    LOW: {
      color: "text-sideway",
      bg: "bg-sideway/10",
      borderColor: "border-sideway/30",
      barColor: "bg-sideway",
      label: "LOW",
    },
  };

  const config = momentumConfig[velocity.momentum];

  const DirectionIcon =
    velocity.direction === "UP"
      ? ArrowUp
      : velocity.direction === "DOWN"
        ? ArrowDown
        : Minus;

  const directionColor =
    velocity.direction === "UP"
      ? "text-bullish"
      : velocity.direction === "DOWN"
        ? "text-bearish"
        : "text-sideway";

  // Normalize velocity for bar (0-5+ pips/sec range)
  const barWidth = Math.min(100, (velocity.velocity / 5) * 100);

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Tick Velocity
        </span>
        <div className="flex items-center gap-1.5">
          <Zap className={`w-4 h-4 ${config.color}`} />
          <span className={`text-sm font-semibold font-mono ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-2xl font-mono font-bold ${config.color}`}>
          {velocity.velocity.toFixed(2)}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          pips/sec
        </span>
        <DirectionIcon className={`w-4 h-4 ${directionColor}`} />
      </div>

      {/* Velocity bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full ${config.barColor} rounded-full transition-all duration-300`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {barWidth.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
