"use client";

import { useState, useCallback, useEffect } from "react";
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
import { AiChatPanel } from "@/components/ai-chat-panel";
import { AccountPanel } from "@/components/account-panel";
import { PositionsPanel } from "@/components/positions-panel";
import { TradePanel } from "@/components/trade-panel";
import { useTradingData } from "@/hooks/use-trading-data";
import { calculateMOLinear } from "@/lib/analysis";
import { useAlerts } from "@/hooks/use-alerts";
import type { Instrument } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Layers,
  ShieldCheck,
  Wallet,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
} from "lucide-react";

type SidebarTab = "analysis" | "indicators" | "trade" | "alerts" | "ai";

export default function TradingDashboard() {
  const [instrument, setInstrument] = useState<Instrument>("XAU_USD");
  const [activeTab, setActiveTab] = useState<SidebarTab>("analysis");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [slopePeriod, setSlopePeriod] = useState(7);
  const [showTrendLines, setShowTrendLines] = useState(true);
  // Mobile panel state: "hidden" | "peek" | "full"
  const [mobilePanelState, setMobilePanelState] = useState<"hidden" | "peek" | "full">("peek");

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

  // Compute MO Linear for AI context (period=5, dcPeriod=5)
  const moLinear = candles.length >= 20 ? calculateMOLinear(candles, 5, 5) : null;

  const { triggerAlert, requestNotificationPermission } = useAlerts(
    soundEnabled,
    notificationsEnabled
  );

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
    { id: "ai", label: "AI", icon: Sparkles },
  ];

  // Mobile panel heights
  const peekHeight = 56; // just the drag handle + tab bar
  const fullHeight = "85dvh";

  const tabContent = (
    <div className="flex flex-col gap-3">
      {activeTab === "analysis" && (
        <>
          <TickInfo tick={currentTick} instrument={instrument} />
          <SlopePanel slope={slope} />
          <VelocityPanel velocity={tickVelocity} />
          <AdvicePanel advice={advice} level={adviceLevel} />
          <MTFPanel mtf={mtf} />
        </>
      )}
      {activeTab === "indicators" && (
        <>
          <RSIPanel rsi={rsi} />
          <MACDPanel macd={macd} />
          <BollingerPanel
            bb={bollinger}
            currentPrice={currentTick?.bid ?? candles[candles.length - 1]?.close ?? 0}
            instrument={instrument}
          />
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">Indicator Guide</h3>
            <div className="flex flex-col gap-2 text-[10px] font-mono text-muted-foreground">
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-bullish shrink-0 mt-1" /><span>RSI below 30 = Oversold, potential bounce</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-bearish shrink-0 mt-1" /><span>RSI above 70 = Overbought, potential drop</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" /><span>MACD cross = Trend change confirmation</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 mt-1" /><span>BB breakout = Volatility expansion</span></div>
            </div>
          </div>
        </>
      )}
      {activeTab === "trade" && (
        <>
          <AccountPanel />
          <TradePanel instrument={instrument} currentBid={currentTick?.bid ?? 0} currentAsk={currentTick?.ask ?? 0} />
          <PositionsPanel />
        </>
      )}
      {activeTab === "ai" && (
        <div className="flex flex-col h-full min-h-0" style={{ height: "calc(100vh - 220px)" }}>
          <AiChatPanel
            instrument={instrument}
            currentTick={currentTick}
            slope={slope}
            rsi={rsi}
            macd={macd}
            tickVelocity={tickVelocity}
            advice={advice}
            adviceLevel={adviceLevel}
            mtf={mtf}
            candles={candles}
            moLinear={moLinear}
          />
        </div>
      )}
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
          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-2">Strategy Guide</h3>
            <div className="flex flex-col gap-2 text-[10px] font-mono text-muted-foreground">
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-bullish shrink-0 mt-1" /><span>Slope green + High velocity = Safe to recover</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-bearish shrink-0 mt-1" /><span>Slope red + Low velocity = Sit on hands</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-sideway shrink-0 mt-1" /><span>Sideway = Wait for breakout confirmation</span></div>
              <div className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0 mt-1" /><span>MTF confluence = All timeframes agree</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <main className="h-dvh bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-border px-3 py-2 md:px-6 md:py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 shrink-0">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold font-mono text-foreground leading-tight">Slope Tick Visualizer</h1>
              <p className="text-[10px] text-muted-foreground font-mono">OANDA Real-Time Dashboard</p>
            </div>
          </div>
          <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} candleCount={candles.length} />
        </div>
      </header>

      {/* ── Instrument Selector ─────────────────────────────────── */}
      <div className="border-b border-border px-3 py-1.5 md:px-6 md:py-2 shrink-0">
        <InstrumentSelector value={instrument} onChange={setInstrument} />
      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">

        {/* Chart Area — full on mobile, partial on desktop */}
        <div
          className="flex-1 min-h-0 border-b lg:border-b-0 lg:border-r border-border"
          style={{
            // On mobile, leave room so the peeking panel doesn't cover chart controls
            paddingBottom: mobilePanelState === "hidden" ? 0 : 0,
          }}
        >
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

        {/* ── Desktop Sidebar ─────────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col min-h-0">
          {/* Controls Bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Slope Period</span>
              <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
                <button onClick={() => setSlopePeriod(Math.max(2, slopePeriod - 1))} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs">-</button>
                <span className="text-xs font-mono w-4 text-center">{slopePeriod}</span>
                <button onClick={() => setSlopePeriod(Math.min(50, slopePeriod + 1))} className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground text-xs">+</button>
              </div>
            </div>
            <button
              onClick={() => setShowTrendLines(!showTrendLines)}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${showTrendLines ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground border border-transparent hover:text-foreground"}`}
            >
              {showTrendLines ? "HIDE TRENDLINES" : "SHOW TRENDLINES"}
            </button>
          </div>

          {/* Tab Buttons */}
          <div className="flex border-b border-border shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors relative min-h-[44px] ${isActive ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === "alerts" && alerts.length > 0 && (
                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-bearish" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {tabContent}
          </div>
        </div>

        {/* ── Mobile Bottom Sheet ──────────────────────────────────── */}
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col bg-card border-t border-border transition-[height] duration-300 ease-in-out"
          style={{
            height: mobilePanelState === "full" ? fullHeight : mobilePanelState === "peek" ? `${peekHeight}px` : "0px",
          }}
        >
          {/* Drag Handle + Tab bar */}
          <div
            className="shrink-0 flex flex-col"
            onClick={() => setMobilePanelState(s => s === "full" ? "peek" : "full")}
          >
            {/* Pill */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
            </div>

            {/* Tab buttons row */}
            <div className="flex items-center border-b border-border">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(tab.id);
                      setMobilePanelState("full");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-mono transition-colors relative min-h-[36px] ${isActive ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{tab.label}</span>
                    {tab.id === "alerts" && alerts.length > 0 && (
                      <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-bearish" />
                    )}
                  </button>
                );
              })}

              {/* Collapse button */}
              {mobilePanelState === "full" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMobilePanelState("peek"); }}
                  className="px-3 py-2 text-muted-foreground"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content — only visible when expanded */}
          {mobilePanelState === "full" && (
            <div className="flex-1 overflow-y-auto p-3">
              {/* Controls */}
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Period</span>
                  <div className="flex items-center gap-1 bg-background border border-border rounded px-1.5 py-0.5">
                    <button onClick={() => setSlopePeriod(Math.max(2, slopePeriod - 1))} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground text-sm">-</button>
                    <span className="text-xs font-mono w-5 text-center">{slopePeriod}</span>
                    <button onClick={() => setSlopePeriod(Math.min(50, slopePeriod + 1))} className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground text-sm">+</button>
                  </div>
                </div>
                <button
                  onClick={() => setShowTrendLines(!showTrendLines)}
                  className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${showTrendLines ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground border border-transparent"}`}
                >
                  {showTrendLines ? "HIDE TRENDLINES" : "SHOW TRENDLINES"}
                </button>
              </div>
              {tabContent}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
