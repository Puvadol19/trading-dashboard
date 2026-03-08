"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import type {
  CandleData,
  TickData,
  SlopeAnalysis,
  TickVelocity,
  Instrument,
  RSIData,
  MACDData,
  BollingerBands,
  MTFAnalysis,
  AlertEvent,
  TrendLine,
} from "@/lib/types";
import {
  calculateSlope,
  calculateTickVelocity,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  generateAdvice,
  getPipSize,
  calculateTrendLines,
  checkTrendLineBreakout,
} from "@/lib/analysis";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const POLL_INTERVAL = 5000;

export function useTradingData(instrument: Instrument, slopePeriod: number = 7) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [currentTick, setCurrentTick] = useState<TickData | null>(null);
  const [slope, setSlope] = useState<SlopeAnalysis | null>(null);
  const [fastSlope, setFastSlope] = useState<SlopeAnalysis | null>(null);
  const [slowSlope, setSlowSlope] = useState<SlopeAnalysis | null>(null);
  const [tickVelocity, setTickVelocity] = useState<TickVelocity>({
    velocity: 0,
    direction: "FLAT",
    momentum: "LOW",
  });
  const [advice, setAdvice] = useState("WAITING FOR DATA...");
  const [adviceLevel, setAdviceLevel] = useState<"safe" | "caution" | "danger">("caution");
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);

  // New indicators
  const [rsi, setRsi] = useState<RSIData | null>(null);
  const [macd, setMacd] = useState<MACDData | null>(null);
  const [bollinger, setBollinger] = useState<BollingerBands | null>(null);
  const [mtf, setMtf] = useState<MTFAnalysis>({
    s5: null,
    m1: null,
    m5: null,
    confluence: "NO_DATA",
  });
  const [trendLines, setTrendLines] = useState<TrendLine[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);

  const previousTickRef = useRef<{ bid: number; time: number } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const prevSlopeRef = useRef<SlopeAnalysis | null>(null);
  const prevMACDRef = useRef<MACDData | null>(null);

  // Fetch S5 candles
  const { data: candleResponse, error: candleError } = useSWR(
    `/api/oanda/candles?instrument=${instrument}&count=200&granularity=S5`,
    fetcher,
    { refreshInterval: POLL_INTERVAL, revalidateOnFocus: false, dedupingInterval: 3000 }
  );

  // Fetch M1 candles for MTF
  const { data: m1Response } = useSWR(
    `/api/oanda/candles?instrument=${instrument}&count=100&granularity=M1`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  // Fetch M5 candles for MTF
  const { data: m5Response } = useSWR(
    `/api/oanda/candles?instrument=${instrument}&count=100&granularity=M5`,
    fetcher,
    { refreshInterval: 30000, revalidateOnFocus: false, dedupingInterval: 20000 }
  );

  // Helper to add alert
  const addAlert = useCallback((type: AlertEvent["type"], message: string, level: AlertEvent["level"]) => {
    const alert: AlertEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      level,
      timestamp: Date.now(),
      instrument,
    };
    setAlerts((prev) => [...prev.slice(-50), alert]);
    return alert;
  }, [instrument]);

  // Update candles and run all analysis
  useEffect(() => {
    if (candleResponse?.candles) {
      const newCandles: CandleData[] = candleResponse.candles;
      setCandles(newCandles);
      setIsConnected(true);
      setLastUpdate(Date.now());

      // Slope (configurable period)
      const newSlope = calculateSlope(newCandles, slopePeriod);
      setSlope(newSlope);

      // Fast/Slow slopes for comparison
      const newFastSlope = calculateSlope(newCandles, 12);
      const newSlowSlope = calculateSlope(newCandles, 40);
      setFastSlope(newFastSlope);
      setSlowSlope(newSlowSlope);

      // RSI
      const newRSI = calculateRSI(newCandles);
      setRsi(newRSI);

      // MACD
      const newMACD = calculateMACD(newCandles);
      setMacd(newMACD);

      // Bollinger Bands
      const newBB = calculateBollingerBands(newCandles);
      setBollinger(newBB);

      // Trendlines (new)
      const newTrendLines = calculateTrendLines(newCandles, 50); // Lookback 50 candles
      setTrendLines(newTrendLines);

      // Check breakout
      const lastCandle = newCandles[newCandles.length - 1];
      if (lastCandle) {
        const breakout = checkTrendLineBreakout(newTrendLines, lastCandle);
        if (breakout) {
          addAlert(
            "BB_BREAKOUT", // Reusing type for now, or add new type
            `Trendline Breakout: ${breakout.type === "BREAKOUT_UP" ? "BULLISH" : "BEARISH"}`,
            "critical"
          );
        }
      }

      // Advice (enhanced)
      const adviceResult = generateAdvice(newSlope, tickVelocity, newRSI, newMACD, newBB);
      setAdvice(adviceResult.advice);
      setAdviceLevel(adviceResult.level);

      // Alert: slope trend change
      if (prevSlopeRef.current && newSlope &&
          prevSlopeRef.current.trend !== newSlope.trend) {
        addAlert(
          "SLOPE_CHANGE",
          `Slope changed: ${prevSlopeRef.current.trend} -> ${newSlope.trend}`,
          newSlope.trend === "SIDEWAY" ? "warning" : "critical"
        );
      }
      prevSlopeRef.current = newSlope;

      // Alert: MACD crossover
      if (newMACD && newMACD.crossover !== "NONE" &&
          (!prevMACDRef.current || prevMACDRef.current.crossover !== newMACD.crossover)) {
        addAlert(
          "MACD_CROSS",
          `MACD ${newMACD.crossover === "BULLISH_CROSS" ? "Bullish" : "Bearish"} crossover detected`,
          newMACD.crossover === "BULLISH_CROSS" ? "info" : "warning"
        );
      }
      prevMACDRef.current = newMACD;

      // Alert: RSI extreme
      if (newRSI && (newRSI.condition === "OVERBOUGHT" || newRSI.condition === "OVERSOLD")) {
        addAlert(
          "RSI_EXTREME",
          `RSI ${newRSI.value.toFixed(1)} - ${newRSI.condition}`,
          "warning"
        );
      }

      // Alert: BB breakout
      if (newBB && newBB.position !== "INSIDE") {
        addAlert(
          "BB_BREAKOUT",
          `Price ${newBB.position === "ABOVE_UPPER" ? "above upper" : "below lower"} Bollinger Band`,
          "critical"
        );
      }
    }
  }, [candleResponse, tickVelocity, addAlert, slopePeriod]);

  // MTF analysis
  useEffect(() => {
    const s5Slope = slope;
    const m1Slope = m1Response?.candles ? calculateSlope(m1Response.candles, slopePeriod) : null;
    const m5Slope = m5Response?.candles ? calculateSlope(m5Response.candles, slopePeriod) : null;

    let confluence: MTFAnalysis["confluence"] = "NO_DATA";
    const trends = [s5Slope?.trend, m1Slope?.trend, m5Slope?.trend].filter(Boolean);

    if (trends.length >= 2) {
      const bullCount = trends.filter((t) => t === "BULLISH").length;
      const bearCount = trends.filter((t) => t === "BEARISH").length;

      if (bullCount >= 2) confluence = "STRONG_BULL";
      else if (bearCount >= 2) confluence = "STRONG_BEAR";
      else confluence = "MIXED";
    }

    setMtf({ s5: s5Slope, m1: m1Slope, m5: m5Slope, confluence });
  }, [slope, m1Response, m5Response, slopePeriod]);

  // Handle errors
  useEffect(() => {
    if (candleError) setIsConnected(false);
  }, [candleError]);

  // Connect to price stream
  const connectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/oanda/stream?instrument=${instrument}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) return;

        if (data.type === "tick") {
          const tick: TickData = {
            time: data.time,
            bid: data.bid,
            ask: data.ask,
            spread: data.spread,
          };

          setCurrentTick(tick);
          setLastUpdate(Date.now());

          if (previousTickRef.current) {
            const timeDiff = tick.time - previousTickRef.current.time;
            const pipSize = getPipSize(instrument);
            const vel = calculateTickVelocity(
              tick.bid,
              previousTickRef.current.bid,
              timeDiff,
              pipSize
            );
            setTickVelocity(vel);

            // Alert: velocity spike
            if (vel.momentum === "HIGH" && vel.velocity > 5) {
              setAlerts((prev) => {
                const recentSpike = prev.find(
                  (a) => a.type === "VELOCITY_SPIKE" && Date.now() - a.timestamp < 10000
                );
                if (recentSpike) return prev;
                return [...prev.slice(-50), {
                  id: `${Date.now()}-vel`,
                  type: "VELOCITY_SPIKE" as const,
                  message: `Tick velocity spike: ${vel.velocity.toFixed(1)} pips/sec ${vel.direction}`,
                  level: "critical" as const,
                  timestamp: Date.now(),
                  instrument,
                }];
              });
            }
          }

          previousTickRef.current = { bid: tick.bid, time: tick.time };
        }
      } catch {
        // Skip parse errors
      }
    };

    es.onerror = () => setIsConnected(false);
    es.onopen = () => setIsConnected(true);
    eventSourceRef.current = es;
  }, [instrument]);

  useEffect(() => {
    connectStream();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connectStream]);

  // Reset on instrument change
  useEffect(() => {
    previousTickRef.current = null;
    prevSlopeRef.current = null;
    prevMACDRef.current = null;
    setCurrentTick(null);
    setTickVelocity({ velocity: 0, direction: "FLAT", momentum: "LOW" });
    setAlerts([]);
  }, [instrument]);

  return {
    candles,
    currentTick,
    slope,
    fastSlope,
    slowSlope,
    tickVelocity,
    advice,
    adviceLevel,
    instrument,
    isConnected,
    lastUpdate,
    rsi,
    macd,
    bollinger,
    mtf,
    trendLines,
    alerts,
    setAlerts,
  };
}
