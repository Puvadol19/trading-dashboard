"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import type { CandleData } from "@/lib/types";
import { calculateMOLinear } from "@/lib/analysis";

interface MoLinearChartProps {
  candles: CandleData[];
  period?: number;
  dcPeriod?: number;
  instrument: string;
}

// ── canvas helpers ─────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const COLORS = {
  bg:          "#0a0e17",
  grid:        "#1e293b",
  text:        "#94a3b8",
  up:          "#22c55e",
  down:        "#ef4444",
  mid:         "#21b190",   // teal – mid(a), mid(b) lines
  k:           "#3b82f6",   // blue  – k line
  fillA:       "#eab308",   // yellow fill a-band
  fillB:       "#22c55e",   // green  fill b-band
  fillHG:      "#ef4444",   // red    fill h-g
  fillK:       "#3b82f6",   // blue   fill k-band
  zero:        "#06b6d4",   // cyan   zero line (panel 2)
};

function getAlpha(base: string, a: number) {
  return base.startsWith("#") ? hexToRgba(base, a) : base;
}

// Map data index to canvas X pixel
function xPx(i: number, n: number, w: number, padL: number, padR: number) {
  const barW = (w - padL - padR) / n;
  return padL + (i + 0.5) * barW;
}

// Map price to canvas Y pixel
function yPx(price: number, min: number, max: number, h: number, padT: number, padB: number) {
  if (max === min) return (h - padT - padB) / 2 + padT;
  return padT + ((max - price) / (max - min)) * (h - padT - padB);
}

interface DrawCtx {
  ctx: CanvasRenderingContext2D;
  n: number;
  w: number;
  h: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  minP: number;
  maxP: number;
}

function drawGrid(dc: DrawCtx, label: (v: number) => string, steps = 5) {
  const { ctx, w, h, padL, padR, padT, padB, minP, maxP } = dc;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.text;
  ctx.font = "10px 'Geist Mono', monospace";
  ctx.textAlign = "right";

  for (let i = 0; i <= steps; i++) {
    const price = minP + (i / steps) * (maxP - minP);
    const y = yPx(price, minP, maxP, h, padT, padB);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(label(price), w - padR + 46, y + 3);
  }
  // vertical lines
  const n = dc.n;
  const step = Math.ceil(n / 8);
  for (let i = 0; i < n; i += step) {
    const x = xPx(i, n, w, padL, padR);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, h - padB);
    ctx.stroke();
  }
}

function fillBand(
  dc: DrawCtx,
  upper: number[],
  lower: number[],
  color: string,
  alpha: number
) {
  const { ctx, n, w, h, padL, padR, padT, padB, minP, maxP } = dc;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    const x = xPx(i, n, w, padL, padR);
    const y = yPx(upper[i], minP, maxP, h, padT, padB);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    const x = xPx(i, n, w, padL, padR);
    const y = yPx(lower[i], minP, maxP, h, padT, padB);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = getAlpha(color, alpha);
  ctx.fill();
}

function drawLine(
  dc: DrawCtx,
  series: number[],
  color: string,
  lineWidth = 1.5
) {
  const { ctx, n, w, h, padL, padR, padT, padB, minP, maxP } = dc;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  let started = false;
  for (let i = 0; i < n; i++) {
    if (isNaN(series[i])) continue;
    const x = xPx(i, n, w, padL, padR);
    const y = yPx(series[i], minP, maxP, h, padT, padB);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCandles(
  dc: DrawCtx,
  openArr: number[],
  highArr: number[],
  lowArr: number[],
  closeArr: number[]
) {
  const { ctx, n, w, h, padL, padR, padT, padB, minP, maxP } = dc;
  const barW = (w - padL - padR) / n;
  const bodyW = Math.max(1, barW * 0.75);

  for (let i = 0; i < n; i++) {
    const o = openArr[i], hi = highArr[i], lo = lowArr[i], c = closeArr[i];
    if (isNaN(o) || isNaN(c)) continue;
    const x = xPx(i, n, w, padL, padR);
    const isUp = c >= o;
    const col = isUp ? COLORS.up : COLORS.down;
    const yHi = yPx(hi, minP, maxP, h, padT, padB);
    const yLo = yPx(lo, minP, maxP, h, padT, padB);
    const yO  = yPx(o,  minP, maxP, h, padT, padB);
    const yC  = yPx(c,  minP, maxP, h, padT, padB);

    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yHi);
    ctx.lineTo(x, yLo);
    ctx.stroke();

    ctx.fillStyle = col;
    const bodyTop    = Math.min(yO, yC);
    const bodyHeight = Math.max(1, Math.abs(yC - yO));
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
  }
}

function drawTimeAxis(
  dc: DrawCtx,
  times: number[],
  n: number
) {
  const { ctx, w, h, padL, padR, padB } = dc;
  ctx.fillStyle = COLORS.text;
  ctx.font = "9px 'Geist Mono', monospace";
  ctx.textAlign = "center";

  const step = Math.ceil(n / 8);
  for (let i = 0; i < n; i += step) {
    const x = xPx(i, n, w, padL, padR);
    const d = new Date(times[i] * 1000);
    const label = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    ctx.fillText(label, x, h - padB + 13);
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export function MoLinearChart({
  candles,
  period = 5,
  dcPeriod = 5,
  instrument,
}: MoLinearChartProps) {
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const [resizeTick, setResizeTick] = useState(0);

  const result = useMemo(
    () => calculateMOLinear(candles, period, dcPeriod),
    [candles, period, dcPeriod]
  );

  // ── Draw panel 1 ──
  useEffect(() => {
    const canvas = canvas1Ref.current;
    if (!canvas || !result || candles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const padL = 8, padR = 56, padT = 16, padB = 22;
    const n = candles.length;

    // price range from candles
    const allP = candles.flatMap((c) => [c.high, c.low]);
    const rawMin = Math.min(...allP);
    const rawMax = Math.max(...allP);
    const pad = (rawMax - rawMin) * 0.08;
    const minP = rawMin - pad;
    const maxP = rawMax + pad;

    const dc: DrawCtx = { ctx, n, w, h, padL, padR, padT, padB, minP, maxP };

    // background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    const decimals = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;
    drawGrid(dc, (v) => v.toFixed(decimals));

    // fills
    fillBand(dc, result.upperDcA, result.lowerDcA, COLORS.fillA,  0.18);
    fillBand(dc, result.upperDcB, result.lowerDcB, COLORS.fillB,  0.18);
    fillBand(dc, result.h,        result.g,        COLORS.fillHG, 0.18);
    fillBand(dc, result.upperDcK, result.lowerDcK, COLORS.fillK,  0.10);

    // candles
    drawCandles(
      dc,
      candles.map((c) => c.open),
      candles.map((c) => c.high),
      candles.map((c) => c.low),
      candles.map((c) => c.close)
    );

    // lines
    drawLine(dc, result.midB, COLORS.mid, 1.4);
    drawLine(dc, result.midA, COLORS.mid, 1.4);
    drawLine(dc, result.k,    COLORS.k,   2.0);

    drawTimeAxis(dc, candles.map((c) => c.time), n);

    // Panel title
    ctx.fillStyle = COLORS.text;
    ctx.font = "11px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`MO_linear • ${instrument.replace("_", "/")} • period=${period} dc=${dcPeriod}`, padL + 4, padT - 2);
  }, [candles, result, period, dcPeriod, instrument, resizeTick]);

  // ── Draw panel 2 ──
  useEffect(() => {
    const canvas = canvas2Ref.current;
    if (!canvas || !result || candles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const padL = 8, padR = 56, padT = 16, padB = 22;
    const n = candles.length;

    const allK = [
      ...result.openK, ...result.highK, ...result.lowK, ...result.closeK,
      ...result.upperDcA1, ...result.lowerDcA1,
      ...result.h1, ...result.g1,
    ].filter((v) => !isNaN(v));

    const rawMin = Math.min(...allK);
    const rawMax = Math.max(...allK);
    const pad = Math.max(Math.abs(rawMax - rawMin) * 0.1, 0.0001);
    const minP = rawMin - pad;
    const maxP = rawMax + pad;

    const dc: DrawCtx = { ctx, n, w, h, padL, padR, padT, padB, minP, maxP };

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    drawGrid(dc, (v) => v.toFixed(4));

    // zero line
    const yZero = yPx(0, minP, maxP, h, padT, padB);
    ctx.strokeStyle = COLORS.zero;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yZero);
    ctx.lineTo(w - padR, yZero);
    ctx.stroke();
    ctx.setLineDash([]);

    // fills
    fillBand(dc, result.upperDcA1, result.lowerDcA1, COLORS.fillA,  0.18);
    fillBand(dc, result.upperDcB1, result.lowerDcB1, COLORS.fillB,  0.18);
    fillBand(dc, result.h1,        result.g1,        COLORS.fillHG, 0.18);
    fillBand(dc, result.upperDcK1, result.lowerDcK1, COLORS.fillK,  0.10);

    // normalized candles
    drawCandles(dc, result.openK, result.highK, result.lowK, result.closeK);

    // lines
    drawLine(dc, result.midB1, COLORS.mid, 1.2);
    drawLine(dc, result.midA1, COLORS.mid, 1.2);
    drawLine(dc, result.k1,    COLORS.k,   1.8);

    drawTimeAxis(dc, candles.map((c) => c.time), n);

    // Panel title
    ctx.fillStyle = COLORS.text;
    ctx.font = "11px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("Buy&Sell Candle (ΔPrice vs k)", padL + 4, padT - 2);
  }, [candles, result, resizeTick]);

  // ── Resize observer ──
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas1Ref.current) {
        canvas1Ref.current.width  = w;
        canvas1Ref.current.height = Math.round(h * 0.58);
      }
      if (canvas2Ref.current) {
        canvas2Ref.current.width  = w;
        canvas2Ref.current.height = Math.round(h * 0.38);
      }
      setResizeTick((t) => t + 1);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    return () => ro.disconnect();
  }, []);

  // Legend data
  const legendP1 = [
    { color: COLORS.mid,   label: "mid(a), mid(b)" },
    { color: COLORS.k,     label: "k = avg(mid_a, mid_b)" },
    { color: COLORS.fillA, label: "fill a-band",  alpha: 0.6 },
    { color: COLORS.fillB, label: "fill b-band",  alpha: 0.6 },
    { color: COLORS.fillHG,label: "fill h-g",     alpha: 0.6 },
    { color: COLORS.fillK, label: "fill k-band",  alpha: 0.4 },
  ];
  const legendP2 = [
    { color: COLORS.mid,   label: "mid(a1), mid(b1)" },
    { color: COLORS.k,     label: "k1" },
    { color: COLORS.fillA, label: "fill a1-band", alpha: 0.6 },
    { color: COLORS.fillB, label: "fill b1-band", alpha: 0.6 },
    { color: COLORS.fillHG,label: "fill h1-g1",   alpha: 0.6 },
  ];

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs font-mono">
        Not enough candle data (need {period + dcPeriod + 10}+)
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background gap-0.5 relative">
      {/* Panel 1 */}
      <div className="relative flex-[3]">
        <canvas ref={canvas1Ref} className="block w-full h-full" />
        {/* Legend */}
        <div className="absolute top-5 left-2 flex flex-wrap gap-x-3 gap-y-0.5 pointer-events-none">
          {legendP1.map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-[9px] font-mono" style={{ color: COLORS.text }}>
              <span
                className="inline-block w-3 h-2 rounded-sm"
                style={{ background: getAlpha(l.color, l.alpha ?? 1) }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border shrink-0" />

      {/* Panel 2 */}
      <div className="relative flex-[2]">
        <canvas ref={canvas2Ref} className="block w-full h-full" />
        {/* Legend */}
        <div className="absolute top-5 left-2 flex flex-wrap gap-x-3 gap-y-0.5 pointer-events-none">
          {legendP2.map((l) => (
            <span key={l.label} className="flex items-center gap-1 text-[9px] font-mono" style={{ color: COLORS.text }}>
              <span
                className="inline-block w-3 h-2 rounded-sm"
                style={{ background: getAlpha(l.color, l.alpha ?? 1) }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
