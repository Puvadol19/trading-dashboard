"use client";

import { ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";

interface AdvicePanelProps {
  advice: string;
  level: "safe" | "caution" | "danger";
}

export function AdvicePanel({ advice, level }: AdvicePanelProps) {
  const levelConfig = {
    safe: {
      icon: ShieldCheck,
      color: "text-bullish",
      bg: "bg-bullish/10",
      borderColor: "border-bullish/30",
      pulseColor: "bg-bullish",
      label: "SAFE TO TRADE",
    },
    caution: {
      icon: AlertTriangle,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      borderColor: "border-yellow-400/30",
      pulseColor: "bg-yellow-400",
      label: "USE CAUTION",
    },
    danger: {
      icon: ShieldAlert,
      color: "text-bearish",
      bg: "bg-bearish/10",
      borderColor: "border-bearish/30",
      pulseColor: "bg-bearish",
      label: "DO NOT TRADE",
    },
  };

  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bg} p-3 md:p-4`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Trading Advice
        </span>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.pulseColor}`}
            />
          </span>
          <span className={`text-xs font-mono ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${config.color} shrink-0`} />
        <p className={`text-sm md:text-base font-semibold font-mono ${config.color} leading-tight`}>
          {advice}
        </p>
      </div>
    </div>
  );
}
