"use client";

import { useState } from "react";
import { ArrowUpCircle, ArrowDownCircle, X, XCircle, Loader2 } from "lucide-react";
import useSWR from "swr";
import type { OandaPosition } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PositionsPanel() {
  const { data, mutate } = useSWR("/api/oanda/positions", fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  });

  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);

  const positions: OandaPosition[] = data?.positions || [];
  const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

  async function handleCloseTrade(tradeId: string) {
    setClosingId(tradeId);
    try {
      const res = await fetch("/api/oanda/close", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId }),
      });
      const result = await res.json();
      if (result.success) {
        mutate();
      }
    } catch {
      // silently fail
    } finally {
      setClosingId(null);
    }
  }

  async function handleCloseAll() {
    setClosingAll(true);
    setConfirmCloseAll(false);
    try {
      const res = await fetch("/api/oanda/close", { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        mutate();
      }
    } catch {
      // silently fail
    } finally {
      setClosingAll(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Open Positions
        </span>
        <div className="flex items-center gap-3">
          {positions.length > 0 && (
            <span
              className={`text-xs font-mono font-bold ${totalPL >= 0 ? "text-bullish" : "text-bearish"}`}
            >
              Total: {totalPL >= 0 ? "+" : ""}
              {totalPL.toFixed(2)}
            </span>
          )}
          <span className="text-xs font-mono text-muted-foreground">
            {positions.length} open
          </span>
        </div>
      </div>

      {positions.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono">
          No open positions
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((pos) => {
            const isLong = pos.side === "long";
            const plColor =
              pos.unrealizedPL >= 0 ? "text-bullish" : "text-bearish";
            const isClosing = closingId === pos.tradeId;

            return (
              <div
                key={pos.tradeId}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group"
              >
                <div className="flex items-center gap-2">
                  {isLong ? (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-bullish" />
                  ) : (
                    <ArrowDownCircle className="w-3.5 h-3.5 text-bearish" />
                  )}
                  <div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {pos.instrument.replace("_", "/")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground block">
                      {Math.abs(pos.units).toLocaleString()} units @{" "}
                      {pos.averagePrice}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold ${plColor}`}>
                    {pos.unrealizedPL >= 0 ? "+" : ""}
                    {pos.unrealizedPL.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleCloseTrade(pos.tradeId)}
                    disabled={isClosing || closingAll}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                    title="Close this position"
                  >
                    {isClosing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Close All */}
          <div className="mt-2 pt-2 border-t border-border/50">
            {confirmCloseAll ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-destructive">
                  Close all {positions.length} positions?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCloseAll}
                    disabled={closingAll}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-destructive text-primary-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {closingAll ? "Closing..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmCloseAll(false)}
                    disabled={closingAll}
                    className="px-2 py-1 text-[10px] font-mono rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCloseAll(true)}
                disabled={closingAll}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-[10px] font-mono font-semibold uppercase tracking-wider hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                {closingAll ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {closingAll ? "Closing all..." : "Close All Positions"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
