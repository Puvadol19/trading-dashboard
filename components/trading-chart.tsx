"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  LineStyle,
  type CandlestickData,
  type LineData,
  type Time,
} from "lightweight-charts";
import type { CandleData, SlopeAnalysis, TrendLine } from "@/lib/types";
import { MoLinearChart } from "@/components/mo-linear-chart";
import { MtfMoLinearView } from "@/components/mtf-mo-linear-view";

interface TradingChartProps {
  candles: CandleData[];
  m1Candles: CandleData[];
  m5Candles: CandleData[];
  slope: SlopeAnalysis | null;
  trendLines?: TrendLine[];
  instrument: string;
  slopePeriod: number;
}

type ChartMode = "candles" | "mo_linear" | "mtf_mo";

export function TradingChart({ candles, m1Candles, m5Candles, slope, trendLines = [], instrument, slopePeriod }: TradingChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [moPeriod, setMoPeriod] = useState(5);
  const [moDcPeriod, setMoDcPeriod] = useState(5);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const trendLineSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111827" },
        textColor: "#94a3b8",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: {
        vertLine: {
          color: "#3b82f6",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#3b82f6",
        },
        horzLine: {
          color: "#3b82f6",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#3b82f6",
        },
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 6,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const lineSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(chartContainerRef.current);
    handleResize();

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  // Update candle data
  const updateCandles = useCallback(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(chartData);
  }, [candles]);

  // Update regression line
  const updateRegressionLine = useCallback(() => {
    if (!lineSeriesRef.current || !slope) return;
    
    // Use the period from the slope analysis itself to ensure consistency
    // with the calculated intercept/slope values.
    // If slope.period is undefined (old analysis lib), fallback to slopePeriod.
    const periodToUse = slope.period || slopePeriod; 

    // Build regression line data points across the slope period
    const n = Math.min(periodToUse, candles.length);
    if (n < 5) return;

    const recentCandles = candles.slice(-n);
    const lineData: LineData[] = recentCandles.map((c, i) => ({
      time: c.time as Time,
      value: slope.intercept + slope.slope * i,
    }));

    // Set line color based on trend
    let lineColor = "#94a3b8"; // sideway
    if (slope.trend === "BULLISH") lineColor = "#22c55e";
    if (slope.trend === "BEARISH") lineColor = "#ef4444";

    lineSeriesRef.current.applyOptions({ color: lineColor });
    lineSeriesRef.current.setData(lineData);
  }, [candles, slope, slopePeriod]);

  // Update trendlines
  const updateTrendLines = useCallback(() => {
    if (!chartRef.current) return;

    // Clear old trendlines
    trendLineSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    trendLineSeriesRef.current = [];

    // Draw new trendlines
    trendLines.forEach((line) => {
      if (!chartRef.current) return;

      const series = chartRef.current.addLineSeries({
        color: line.type === "RESISTANCE" ? "#ef4444" : "#22c55e",
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Extend line to the latest candle time
      // Calculate slope m = (y2 - y1) / (x2 - x1)
      const lastCandle = candles[candles.length - 1];
      let p2 = line.p2;

      if (lastCandle && lastCandle.time > line.p2.time) {
        const timeDiff = line.p2.time - line.p1.time;
        if (timeDiff > 0) {
          const slope = (line.p2.price - line.p1.price) / timeDiff;
          const timeSinceP2 = lastCandle.time - line.p2.time;
          const extendedPrice = line.p2.price + slope * timeSinceP2;
          p2 = { time: lastCandle.time, price: extendedPrice };
        }
      }
      
      const lineData: LineData[] = [
        { time: line.p1.time as Time, value: line.p1.price },
        { time: p2.time as Time, value: p2.price },
      ];

      series.setData(lineData);
      trendLineSeriesRef.current.push(series);
    });
  }, [trendLines, candles]);

  useEffect(() => {
    updateCandles();
    updateRegressionLine();
    updateTrendLines();
  }, [updateCandles, updateRegressionLine, updateTrendLines]);

  const modes: { id: ChartMode; label: string }[] = [
    { id: "candles",   label: "CANDLES" },
    { id: "mo_linear", label: "MO LINEAR" },
    { id: "mtf_mo",    label: "MTF MO" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-semibold text-foreground">
            {instrument.replace("_", "/")}
          </span>
          <span className="text-xs text-muted-foreground">S5</span>
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 ml-2 bg-secondary rounded p-0.5">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setChartMode(m.id)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                  chartMode === m.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {/* MO period controls - visible when in mo_linear or mtf_mo mode */}
          {(chartMode === "mo_linear" || chartMode === "mtf_mo") && (
            <div className="flex items-center gap-2 ml-1">
              <span className="text-[10px] text-muted-foreground font-mono">P</span>
              <div className="flex items-center gap-0.5 bg-background border border-border rounded px-1 py-0.5">
                <button onClick={() => setMoPeriod(Math.max(2, moPeriod - 1))} className="text-[10px] text-muted-foreground hover:text-foreground w-3">-</button>
                <span className="text-[10px] font-mono w-4 text-center">{moPeriod}</span>
                <button onClick={() => setMoPeriod(Math.min(30, moPeriod + 1))} className="text-[10px] text-muted-foreground hover:text-foreground w-3">+</button>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">DC</span>
              <div className="flex items-center gap-0.5 bg-background border border-border rounded px-1 py-0.5">
                <button onClick={() => setMoDcPeriod(Math.max(2, moDcPeriod - 1))} className="text-[10px] text-muted-foreground hover:text-foreground w-3">-</button>
                <span className="text-[10px] font-mono w-4 text-center">{moDcPeriod}</span>
                <button onClick={() => setMoDcPeriod(Math.min(30, moDcPeriod + 1))} className="text-[10px] text-muted-foreground hover:text-foreground w-3">+</button>
              </div>
            </div>
          )}
        </div>
        {candles.length > 0 && (
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-muted-foreground">
              O{" "}
              <span className="text-foreground">
                {candles[candles.length - 1]?.open.toFixed(5)}
              </span>
            </span>
            <span className="text-muted-foreground">
              H{" "}
              <span className="text-foreground">
                {candles[candles.length - 1]?.high.toFixed(5)}
              </span>
            </span>
            <span className="text-muted-foreground">
              L{" "}
              <span className="text-foreground">
                {candles[candles.length - 1]?.low.toFixed(5)}
              </span>
            </span>
            <span className="text-muted-foreground">
              C{" "}
              <span className="text-foreground">
                {candles[candles.length - 1]?.close.toFixed(5)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Chart body */}
      <div className="flex-1 min-h-0 relative">
        {/* Candles view — keep mounted so lightweight-charts ResizeObserver stays active */}
        <div
          ref={chartContainerRef}
          className="absolute inset-0"
          style={{
            visibility: chartMode === "candles" ? "visible" : "hidden",
            pointerEvents: chartMode === "candles" ? "auto" : "none",
          }}
        />
        {/* MO Linear view */}
        {chartMode === "mo_linear" && (
          <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <MoLinearChart
              candles={candles}
              period={moPeriod}
              dcPeriod={moDcPeriod}
              instrument={instrument}
            />
          </div>
        )}

        {/* MTF MO view — S5 / M1 / M5 side-by-side */}
        {chartMode === "mtf_mo" && (
          <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <MtfMoLinearView
              s5Candles={candles}
              m1Candles={m1Candles}
              m5Candles={m5Candles}
              instrument={instrument}
            />
          </div>
        )}
      </div>
    </div>
  );
}
