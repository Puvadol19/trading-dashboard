"use client";

import { useState, useCallback } from "react";
import { ArrowUpCircle, ArrowDownCircle, AlertTriangle, Calculator } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TradePanelProps {
  instrument: string;
  currentBid: number;
  currentAsk: number;
}

export function TradePanel({ instrument, currentBid, currentAsk }: TradePanelProps) {
  const [units, setUnits] = useState("1000");
  const [isTrading, setIsTrading] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState<"buy" | "sell" | null>(null);
  const [riskPercent, setRiskPercent] = useState("1");

  const { data: accountData } = useSWR("/api/oanda/account", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: false,
  });

  const balance = accountData?.balance ?? 0;
  const decimals = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;
  const pipSize = instrument.includes("JPY") ? 0.01 : instrument.includes("XAU") ? 0.1 : 0.0001;

  // Risk calculator: lot size = (balance * risk%) / (SL pips * pip value)
  const calculateRiskUnits = useCallback(() => {
    const risk = parseFloat(riskPercent) / 100;
    const slPips = 20; // default 20 pips SL
    const riskAmount = balance * risk;
    const pipValue = pipSize * parseFloat(units || "1000");
    if (pipValue === 0) return 0;
    return Math.floor(riskAmount / (slPips * pipSize));
  }, [balance, riskPercent, units, pipSize]);

  const executeTrade = useCallback(async (side: "buy" | "sell") => {
    setIsTrading(true);
    setLastResult(null);
    setShowConfirm(null);

    try {
      const response = await fetch("/api/oanda/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument,
          units: parseInt(units),
          side,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLastResult({
          success: true,
          message: `${side.toUpperCase()} ${units} ${instrument.replace("_", "/")} filled`,
        });
      } else {
        setLastResult({
          success: false,
          message: data.error || "Order failed",
        });
      }
    } catch {
      setLastResult({ success: false, message: "Network error" });
    } finally {
      setIsTrading(false);
    }
  }, [instrument, units]);

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
          Quick Trade
        </span>
        <span className="text-xs font-mono text-foreground font-semibold">
          {instrument.replace("_", "/")}
        </span>
      </div>

      {/* Units input */}
      <div className="mb-3">
        <label htmlFor="trade-units" className="text-[10px] text-muted-foreground font-mono block mb-1">
          Units
        </label>
        <div className="flex gap-1.5">
          <input
            id="trade-units"
            type="number"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="flex-1 bg-secondary border border-border rounded-md px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {[1000, 5000, 10000].map((preset) => (
            <button
              key={preset}
              onClick={() => setUnits(preset.toString())}
              className="px-2 py-1.5 bg-secondary border border-border rounded-md text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {preset >= 1000 ? `${preset / 1000}K` : preset}
            </button>
          ))}
        </div>
      </div>

      {/* Risk Calculator */}
      <div className="mb-3 p-2 bg-secondary/50 rounded-md">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Calculator className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-mono">Risk Calculator</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="risk-percent" className="text-[10px] font-mono text-muted-foreground">Risk %:</label>
          <input
            id="risk-percent"
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(e.target.value)}
            className="w-14 bg-secondary border border-border rounded px-1.5 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            step="0.5"
            min="0.1"
            max="10"
          />
          <span className="text-[10px] font-mono text-muted-foreground">
            = {calculateRiskUnits().toLocaleString()} units (20 pip SL)
          </span>
          <button
            onClick={() => setUnits(calculateRiskUnits().toString())}
            className="text-[10px] font-mono text-primary hover:underline"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Buy/Sell buttons */}
      {showConfirm ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 p-2 bg-yellow-400/10 border border-yellow-400/30 rounded-md">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-xs font-mono text-yellow-400">
              Confirm {showConfirm.toUpperCase()} {units} {instrument.replace("_", "/")} @ {showConfirm === "buy" ? currentAsk.toFixed(decimals) : currentBid.toFixed(decimals)}?
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => executeTrade(showConfirm)}
              disabled={isTrading}
              className={`py-2 rounded-md text-xs font-mono font-semibold transition-colors ${
                showConfirm === "buy"
                  ? "bg-bullish text-background hover:bg-bullish/90"
                  : "bg-bearish text-background hover:bg-bearish/90"
              } disabled:opacity-50`}
            >
              {isTrading ? "EXECUTING..." : "CONFIRM"}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="py-2 rounded-md text-xs font-mono bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowConfirm("buy")}
            disabled={!currentAsk || isTrading}
            className="flex flex-col items-center gap-0.5 py-2.5 rounded-md bg-bullish/10 border border-bullish/30 text-bullish hover:bg-bullish/20 transition-colors disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span className="text-xs font-mono font-bold">BUY</span>
            <span className="text-[10px] font-mono">{currentAsk ? currentAsk.toFixed(decimals) : "--"}</span>
          </button>
          <button
            onClick={() => setShowConfirm("sell")}
            disabled={!currentBid || isTrading}
            className="flex flex-col items-center gap-0.5 py-2.5 rounded-md bg-bearish/10 border border-bearish/30 text-bearish hover:bg-bearish/20 transition-colors disabled:opacity-50"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span className="text-xs font-mono font-bold">SELL</span>
            <span className="text-[10px] font-mono">{currentBid ? currentBid.toFixed(decimals) : "--"}</span>
          </button>
        </div>
      )}

      {/* Result message */}
      {lastResult && (
        <div
          className={`mt-2 p-2 rounded-md text-xs font-mono ${
            lastResult.success
              ? "bg-bullish/10 border border-bullish/30 text-bullish"
              : "bg-bearish/10 border border-bearish/30 text-bearish"
          }`}
        >
          {lastResult.message}
        </div>
      )}
    </div>
  );
}
