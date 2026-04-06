"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { CandleData } from "@/lib/types";
import { calculateMOLinear } from "@/lib/analysis";

interface MoLinearChartProps {
  candles: CandleData[];
  period?: number;
  dcPeriod?: number;
  instrument: string;
}

// ── palette ────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a0e17",
  grid:   "#1e293b",
  text:   "#94a3b8",
  up:     "#22c55e",
  down:   "#ef4444",
  mid:    "#2dd4bf",   // teal  – mid(a), mid(b)
  k:      "#3b82f6",   // blue  – k line
  fillA:  "#eab308",   // yellow – a-band
  fillB:  "#22c55e",   // green  – b-band
  fillHG: "#ef4444",   // red    – h-g band
  fillK:  "#3b82f6",   // blue   – k-band
  zero:   "#06b6d4",   // cyan   – zero line panel-2
};

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── coordinate helpers ────────────────────────────────────────────────────
function xOf(i: number, n: number, w: number, pL: number, pR: number) {
  return pL + (i + 0.5) * ((w - pL - pR) / n);
}
function yOf(v: number, lo: number, hi: number, h: number, pT: number, pB: number) {
  if (hi === lo) return (h - pT - pB) / 2 + pT;
  return pT + ((hi - v) / (hi - lo)) * (h - pT - pB);
}

// ── drawing primitives ────────────────────────────────────────────────────
interface DC {
  ctx: CanvasRenderingContext2D;
  n: number; w: number; h: number;
  pL: number; pR: number; pT: number; pB: number;
  lo: number; hi: number;
}

function drawGrid(dc: DC, fmt: (v: number) => string, steps = 6) {
  const { ctx, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = C.text;
  ctx.font = "9px 'Geist Mono', monospace";
  ctx.textAlign = "left";

  for (let i = 0; i <= steps; i++) {
    const v = lo + (i / steps) * (hi - lo);
    const y = yOf(v, lo, hi, h, pT, pB);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w - pR, y); ctx.stroke();
    ctx.fillText(fmt(v), w - pR + 4, y + 3);
  }

  const step = Math.ceil(dc.n / 8);
  for (let i = 0; i < dc.n; i += step) {
    const x = xOf(i, dc.n, w, pL, pR);
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, h - pB); ctx.stroke();
  }
}

function fillBand(dc: DC, upper: number[], lower: number[], col: string, a: number) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    const x = xOf(i, n, w, pL, pR);
    const y = yOf(upper[i], lo, hi, h, pT, pB);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    ctx.lineTo(xOf(i, n, w, pL, pR), yOf(lower[i], lo, hi, h, pT, pB));
  }
  ctx.closePath();
  ctx.fillStyle = rgba(col, a);
  ctx.fill();
}

function drawLine(dc: DC, arr: number[], col: string, lw = 1.5) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = lw;
  let s = false;
  for (let i = 0; i < n; i++) {
    if (isNaN(arr[i])) continue;
    const x = xOf(i, n, w, pL, pR);
    const y = yOf(arr[i], lo, hi, h, pT, pB);
    if (!s) { ctx.moveTo(x, y); s = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCandles(dc: DC, op: number[], hi2: number[], lo2: number[], cl: number[]) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  const bw = Math.max(1, ((w - pL - pR) / n) * 0.72);
  for (let i = 0; i < n; i++) {
    if (isNaN(op[i]) || isNaN(cl[i])) continue;
    const x    = xOf(i, n, w, pL, pR);
    const col  = cl[i] >= op[i] ? C.up : C.down;
    const yHi  = yOf(hi2[i], lo, hi, h, pT, pB);
    const yLo  = yOf(lo2[i], lo, hi, h, pT, pB);
    const yO   = yOf(op[i],  lo, hi, h, pT, pB);
    const yC   = yOf(cl[i],  lo, hi, h, pT, pB);

    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yHi); ctx.lineTo(x, yLo); ctx.stroke();

    const top = Math.min(yO, yC);
    const bh  = Math.max(1, Math.abs(yC - yO));
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, top, bw, bh);
  }
}

function drawTimeAxis(dc: DC, times: number[]) {
  const { ctx, n, w, h, pL, pR, pB } = dc;
  ctx.fillStyle = C.text;
  ctx.font = "9px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  const step = Math.ceil(n / 8);
  for (let i = 0; i < n; i += step) {
    const x = xOf(i, n, w, pL, pR);
    const d = new Date(times[i] * 1000);
    const lbl = `${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
    ctx.fillText(lbl, x, h - pB + 12);
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export function MoLinearChart({ candles, period = 5, dcPeriod = 5, instrument }: MoLinearChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas1Ref   = useRef<HTMLCanvasElement>(null);
  const canvas2Ref   = useRef<HTMLCanvasElement>(null);

  const result = useMemo(
    () => calculateMOLinear(candles, period, dcPeriod),
    [candles, period, dcPeriod]
  );

  // ── draw both panels ──────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!c1 || !c2 || !result || candles.length === 0) return;

    const ctx1 = c1.getContext("2d");
    const ctx2 = c2.getContext("2d");
    if (!ctx1 || !ctx2) return;

    const n = candles.length;
    const dec = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;

    // ── Panel 1 ──────────────────────────────────────────────────────────
    {
      const dpr = window.devicePixelRatio || 1;
      const w = c1.width / dpr; const h = c1.height / dpr;
      const pL = 8, pR = 62, pT = 20, pB = 24;

      const allP = candles.flatMap((c) => [c.high, c.low]);
      const raw0 = Math.min(...allP), raw1 = Math.max(...allP);
      const pad  = (raw1 - raw0) * 0.08;
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx1, n, w, h, pL, pR, pT, pB, lo, hi };

      ctx1.clearRect(0, 0, w, h);
      ctx1.fillStyle = C.bg; ctx1.fillRect(0, 0, w, h);

      drawGrid(dc, (v) => v.toFixed(dec));
      fillBand(dc, result.upperDcA, result.lowerDcA, C.fillA,  0.20);
      fillBand(dc, result.upperDcB, result.lowerDcB, C.fillB,  0.18);
      fillBand(dc, result.h,        result.g,        C.fillHG, 0.18);
      fillBand(dc, result.upperDcK, result.lowerDcK, C.fillK,  0.12);

      drawCandles(dc,
        candles.map((c) => c.open),
        candles.map((c) => c.high),
        candles.map((c) => c.low),
        candles.map((c) => c.close)
      );

      drawLine(dc, result.midB, C.mid, 1.4);
      drawLine(dc, result.midA, C.mid, 1.4);
      drawLine(dc, result.k,    C.k,   2.0);

      drawTimeAxis(dc, candles.map((c) => c.time));

      ctx1.fillStyle = C.text;
      ctx1.font = "10px 'Geist Mono', monospace";
      ctx1.textAlign = "left";
      ctx1.fillText(`MO_linear  ${instrument.replace("_","/")}  period=${period}  dc=${dcPeriod}`, pL + 4, 13);
    }

    // ── Panel 2 ──────────────────────────────────────────────────────────
    {
      const dpr = window.devicePixelRatio || 1;
      const w = c2.width / dpr; const h = c2.height / dpr;
      const pL = 8, pR = 62, pT = 20, pB = 24;

      const allV = [
        ...result.openK, ...result.highK, ...result.lowK, ...result.closeK,
        ...result.upperDcA1, ...result.lowerDcA1,
        ...result.h1, ...result.g1,
      ].filter((v) => !isNaN(v));

      const raw0 = Math.min(...allV), raw1 = Math.max(...allV);
      const pad  = Math.max(Math.abs(raw1 - raw0) * 0.12, 0.0001);
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx2, n, w, h, pL, pR, pT, pB, lo, hi };

      ctx2.clearRect(0, 0, w, h);
      ctx2.fillStyle = C.bg; ctx2.fillRect(0, 0, w, h);

      drawGrid(dc, (v) => v.toFixed(4));

      // zero line
      const yZ = yOf(0, lo, hi, h, pT, pB);
      ctx2.strokeStyle = C.zero; ctx2.lineWidth = 1;
      ctx2.setLineDash([4, 4]);
      ctx2.beginPath(); ctx2.moveTo(pL, yZ); ctx2.lineTo(w - pR, yZ); ctx2.stroke();
      ctx2.setLineDash([]);

      fillBand(dc, result.upperDcA1, result.lowerDcA1, C.fillA,  0.20);
      fillBand(dc, result.upperDcB1, result.lowerDcB1, C.fillB,  0.18);
      fillBand(dc, result.h1,        result.g1,        C.fillHG, 0.18);
      fillBand(dc, result.upperDcK1, result.lowerDcK1, C.fillK,  0.12);

      drawCandles(dc, result.openK, result.highK, result.lowK, result.closeK);

      drawLine(dc, result.midB1, C.mid, 1.2);
      drawLine(dc, result.midA1, C.mid, 1.2);
      drawLine(dc, result.k1,    C.k,   1.8);

      drawTimeAxis(dc, candles.map((c) => c.time));

      ctx2.fillStyle = C.text;
      ctx2.font = "10px 'Geist Mono', monospace";
      ctx2.textAlign = "left";
      ctx2.fillText("Buy&Sell Candle  (\u0394Price vs k)", pL + 4, 13);
    }
  }, [candles, result, period, dcPeriod, instrument]);

  // ── Resize + initial draw ─────────────────────────────────────────────────
  const panel1Ref = useRef<HTMLDivElement>(null);
  const panel2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p1 = panel1Ref.current;
    const p2 = panel2Ref.current;
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!p1 || !p2 || !c1 || !c2) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;

      const w1 = p1.clientWidth;
      const h1 = p1.clientHeight;
      if (w1 > 0 && h1 > 0) {
        // Assigning width/height resets the context (clears scale accumulation)
        c1.width  = Math.round(w1 * dpr);
        c1.height = Math.round(h1 * dpr);
        const ctx1 = c1.getContext("2d");
        if (ctx1) { ctx1.setTransform(1, 0, 0, 1, 0, 0); ctx1.scale(dpr, dpr); }
      }

      const w2 = p2.clientWidth;
      const h2 = p2.clientHeight;
      if (w2 > 0 && h2 > 0) {
        c2.width  = Math.round(w2 * dpr);
        c2.height = Math.round(h2 * dpr);
        const ctx2 = c2.getContext("2d");
        if (ctx2) { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.scale(dpr, dpr); }
      }

      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(p1);
    ro.observe(p2);
    // Use rAF for initial call so layout is complete
    const raf = requestAnimationFrame(resize);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [draw]);

  // redraw when data/params change
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Legend config ────────────────────────────────────────────────────────
  const leg1 = [
    { col: C.mid,   a: 1,   lbl: "mid(b)=(U_b+L_b)/2" },
    { col: C.mid,   a: 0.6, lbl: "mid(a)=(U_a+L_a)/2" },
    { col: C.k,     a: 1,   lbl: "k = avg(mid_a, mid_b)" },
    { col: C.fillA, a: 0.5, lbl: "fill a-band" },
    { col: C.fillB, a: 0.5, lbl: "fill b-band" },
    { col: C.fillHG,a: 0.5, lbl: "fill h-g" },
    { col: C.fillK, a: 0.35,lbl: "fill k-band" },
  ];
  const leg2 = [
    { col: C.mid,   a: 1,   lbl: "mid(b1)" },
    { col: C.mid,   a: 0.6, lbl: "mid(a1)" },
    { col: C.k,     a: 1,   lbl: "k1" },
    { col: C.fillA, a: 0.5, lbl: "fill a1-band" },
    { col: C.fillB, a: 0.5, lbl: "fill b1-band" },
    { col: C.fillHG,a: 0.5, lbl: "fill h1-g1" },
    { col: C.fillK, a: 0.35,lbl: "fill k1-band" },
  ];

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs font-mono">
        Not enough data (need {period + dcPeriod + 10}+ candles)
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col w-full h-full overflow-hidden" style={{ background: C.bg }}>
      {/* Panel 1 — takes 57% of the height */}
      <div ref={panel1Ref} className="relative overflow-hidden" style={{ flex: "57 57 0%", minHeight: 0 }}>
        <canvas
          ref={canvas1Ref}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {/* Legend */}
        <div className="absolute top-5 left-2 grid grid-cols-2 gap-x-3 gap-y-0 pointer-events-none" style={{ zIndex: 1 }}>
          {leg1.map((l) => (
            <span key={l.lbl} className="flex items-center gap-1" style={{ fontSize: 9, color: C.text }}>
              <span style={{ display: "inline-block", width: 12, height: 8, borderRadius: 2, background: rgba(l.col, l.a) }} />
              {l.lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: "#1e293b", flexShrink: 0 }} />

      {/* Panel 2 — takes 40% of the height */}
      <div ref={panel2Ref} className="relative overflow-hidden" style={{ flex: "40 40 0%", minHeight: 0 }}>
        <canvas
          ref={canvas2Ref}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {/* Legend */}
        <div className="absolute top-5 left-2 grid grid-cols-2 gap-x-3 gap-y-0 pointer-events-none" style={{ zIndex: 1 }}>
          {leg2.map((l) => (
            <span key={l.lbl} className="flex items-center gap-1" style={{ fontSize: 9, color: C.text }}>
              <span style={{ display: "inline-block", width: 12, height: 8, borderRadius: 2, background: rgba(l.col, l.a) }} />
              {l.lbl}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
