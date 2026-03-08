"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdate: number;
  candleCount: number;
}

export function ConnectionStatus({
  isConnected,
  lastUpdate,
  candleCount,
}: ConnectionStatusProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeSinceUpdate = lastUpdate
    ? Math.floor((now - lastUpdate) / 1000)
    : 0;

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-bullish" />
            <span className="text-bullish">LIVE</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-bearish" />
            <span className="text-bearish">OFFLINE</span>
          </>
        )}
      </div>
      <span className="text-muted-foreground">
        {candleCount} candles
      </span>
      {lastUpdate > 0 && (
        <span className="text-muted-foreground">
          {timeSinceUpdate}s ago
        </span>
      )}
    </div>
  );
}
