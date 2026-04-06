"use client";

import { useState, useCallback } from "react";
import { TradingChart } from "@/components/trading-chart";
import { SlopePanel } from "@/components/slope-panel";
import { VelocityPanel } from "@/components/velocity-panel";
import { AdvicePanel } from "@/components/advice-panel";
import { ConnectionStatus } from "@/components/connection-status";
import { InstrumentSelector } from "@/components/instrument-selector";
import { TickInfo } from "@/components/tick-info";
import { RSIPanel } from "@/components/rsi-panel";
import { MACDPanel } from "@/components/macd-panel";
import { BollingerPanel } from "@/components/bollinger-panel";
import { MTFPanel } from "@/components/mtf-panel";
import { AlertsPanel } from "@/components/alerts-panel";
import { AccountPanel } from "@/components/account-panel";
import { PositionsPanel } from "@/components/positions-panel";
import { TradePanel } from "@/components/trade-panel";
import { useTradingData } from "@/hooks/use-trading-data";
import { useAlerts } from "@/hooks/use-alerts";
import type { Instrument } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Layers,
  ShieldCheck,
  Wallet,
} from "lucide-react";

type SidebarTab = "analysis" | "indicators" | "trade" | "alerts";

export default function TradingDashboard() {
  const [instrument, setInstrument] = useState<Instrument>("XAU_USD");
  const [activeTab, setActiveTab] = useState<SidebarTab>("analysis");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [slopePeriod, setSlopePeriod] = useState(7);
  const [showTrendLines, setShowTrendLines] = useState(true);

  const {
    candles,
    m1Candles,
    m5Candles,
    currentTick,
    slope,
    fastSlope,
    slowSlope,
    tickVelocity,
    advice,
    adviceLevel,
    isConnected,
    lastUpdate,
    rsi,
    macd,
    bollinger,
    mtf,
    trendLines,
    alerts,
    setAlerts,
  } = useTradingData(instrument, slopePeriod);

  const { triggerAlert, requestNotificationPermission } = useAlerts(
    soundEnabled,
    notificationsEnabled
  );

  // Trigger alerts when new ones arrive
  const lastAlertCount = alerts.length;
  if (lastAlertCount > 0) {
    const latestAlert = alerts[alerts.length - 1];
    if (latestAlert) {
      triggerAlert(latestAlert);
    }
  }

  const handleToggleNotifications = useCallback(async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    } else {
      setNotificationsEnabled(false);
    }
  }, [notificationsEnabled, requestNotificationPermission]);

  const tabs: { id: SidebarTab; label: string; icon: typeof Activity }[] = [
    { id: "analysis", label: "Analysis", icon: BarChart3 },
    { id: "indicators", label: "Indicators", icon: Layers },
    { id: "trade", label: "Trade", icon: Wallet },
    { id: "alerts", label: "Alerts", icon: ShieldCheck },
  ];

  return (
    <main className="h-dvh bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border px-3 py-2 md:px-6 md:py-3 shrink-0">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold font-mono text-foreground leading-tight">
                Slope Tick Visualizer
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono">
                OANDA Real-Time Dashboard
              </p>
            </div>
          </div>
          <ConnectionStatus
            isConnected={isConnected}
            lastUpdate={lastUpdate}
            candleCount={candles.length}
          />
        </div>
      </header>

      {/* Instrument Selector */}
      <div className="border-b border-border px-3 py-1.5 md:px-6 md:py-2 shrink-0">
        <InstrumentSelector value={instrument} onChange={setInstrument} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 min-h-[250px] lg:min-h-0 border-b lg:border-b-0 lg:border-r border-border">
          <TradingChart
            candles={candles}
            m1Candles={m1Candles}
            m5Candles={m5Candles}
            slope={slope}
            trendLines={showTrendLines ? trendLines : []}
            instrument={instrument}
            slopePeriod={slopePeriod}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:w-[380px] xl:w-[420px] flex flex-col min-h-0">
          {/* Controls Bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Slope Period</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
                <button 
                  onClick={() => setSlopePeriod(Math.max(2, slopePeriod - 1))}
                  className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                >-</button>
                <span className="text-xs font-mono w-4 text-center">{slopePeriod}</span>
                <button 
                  onClick={() => setSlopePeriod(Math.min(50, slopePeriod + 1))}
                  className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                >+</button>
              </div>
            </div>
            
            <button
              onClick={() => setShowTrendLines(!showTrendLines)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                showTrendLines 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"
              }`}
            >
              {showTrendLines ? "HIDE TRENDLINES" : "SHOW TRENDLINES"}
            </button>
          </div>

          {/* Tab Buttons */}
          <div className="flex border-b border-border shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasAlertBadge = tab.id === "alerts" && alerts.length > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors relative min-h-[44px] ${
                    isActive
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {hasAlertBadge && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-bearish" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            <div className="flex flex-col gap-3">
              {/* Analysis Tab */}
              {activeTab === "analysis" && (
                <>
                  <TickInfo tick={currentTick} instrument={instrument} />
                  <SlopePanel slope={slope} />
                  <VelocityPanel velocity={tickVelocity} />
                  <AdvicePanel advice={advice} level={adviceLevel} />
                  <MTFPanel mtf={mtf} />
                </>
              )}

              {/* Indicators Tab */}
              {activeTab === "indicators" && (
                <>
                  <RSIPanel rsi={rsi} />
                  <MACDPanel macd={macd} />
                  <BollingerPanel
                    bb={bollinger}
                    currentPrice={currentTick?.bid ?? candles[candles.length - 1]?.close ?? 0}
                    instrument={instrument}
                  />
                  {/* Strategy Guide */}
                  <div className="rounded-lg border border-border bg-card p-3 md:p-4">
                    <h3 className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                      Indicator Guide
                    </h3>
                    <div className="flex flex-col gap-2 text-[10px] font-mono text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bullish shrink-0 mt-1" />
                        <span>RSI below 30 = Oversold, potential bounce</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bearish shrink-0 mt-1" />
                        <span>RSI above 70 = Overbought, potential drop</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />
                        <span>MACD cross = Trend change confirmation</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 mt-1" />
                        <span>BB breakout = Volatility expansion</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Trade Tab */}
              {activeTab === "trade" && (
                <>
                  <AccountPanel />
                  <TradePanel
                    instrument={instrument}
                    currentBid={currentTick?.bid ?? 0}
                    currentAsk={currentTick?.ask ?? 0}
                  />
                  <PositionsPanel />
                </>
              )}

              {/* Alerts Tab */}
              {activeTab === "alerts" && (
                <>
                  <AlertsPanel
                    alerts={alerts}
                    soundEnabled={soundEnabled}
                    notificationsEnabled={notificationsEnabled}
                    onToggleSound={() => setSoundEnabled(!soundEnabled)}
                    onToggleNotifications={handleToggleNotifications}
                    onClearAlerts={() => setAlerts([])}
                  />
                  {/* Strategy Guide */}
                  <div className="rounded-lg border border-border bg-card p-3 md:p-4">
                    <h3 className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">
                      Strategy Guide
                    </h3>
                    <div className="flex flex-col gap-2 text-[10px] font-mono text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bullish shrink-0 mt-1" />
                        <span>
                          Slope green + High velocity = Safe to recover
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bearish shrink-0 mt-1" />
                        <span>
                          Slope red + Low velocity = Sit on hands
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sideway shrink-0 mt-1" />
                        <span>
                          Sideway = Wait for breakout confirmation
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 mt-1" />
                        <span>
                          MTF confluence = All timeframes agree
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
