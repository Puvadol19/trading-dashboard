"use client";

import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AccountPanel() {
  const { data } = useSWR("/api/oanda/account", fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
  });

  if (!data || data.error) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 md:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Account
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">Loading...</span>
      </div>
    );
  }

  const plColor = data.unrealizedPL >= 0 ? "text-bullish" : "text-bearish";
  const PLIcon = data.unrealizedPL >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Account ({data.currency})
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {data.openTradeCount} trades
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Balance</span>
          <span className="text-sm font-mono font-bold text-foreground">
            {data.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Unrealized P/L</span>
          <div className="flex items-center gap-1">
            <PLIcon className={`w-3 h-3 ${plColor}`} />
            <span className={`text-sm font-mono font-bold ${plColor}`}>
              {data.unrealizedPL >= 0 ? "+" : ""}{data.unrealizedPL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Margin Used</span>
          <span className="text-xs font-mono text-foreground">
            {data.marginUsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground font-mono block">Margin Available</span>
          <span className="text-xs font-mono text-foreground">
            {data.marginAvailable.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
