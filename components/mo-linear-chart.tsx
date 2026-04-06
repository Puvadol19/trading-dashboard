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

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg:     "#0a0e17",
  grid:   "#1e293b",
  text:   "#94a3b8",
  up:     "#22c55e",
  down:   "#ef4444",
  midB:   "#2dd4bf",   // teal  – mid(b), brighter
  midA:   "#14b8a6",   // teal  – mid(a), slightly dimmer
  k:      "#3b82f6",   // blue  – k line
  fillA:  "#eab308",   // yellow – a-band (Donchian of a)
  fillB:  "#22c55e",   // green  – b-band (Donchian of b)
  fillHG: "#ef4444",   // red    – h-g band
  fillK:  "#818cf8",   // indigo – k-band
  zero:   "#06b6d4",   // cyan   – zero line panel 2
};

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Coordinate helpers ────────────────────────────────────────────────────
function xOf(i: number, n: number, w: number, pL: number, pR: number) {
  return pL + (i + 0.5) * ((w - pL - pR) / n);
}
function yOf(v: number, lo: number, hi: number, h: number, pT: number, pB: number) {
  if (hi === lo) return pT + (h - pT - pB) / 2;
  return pT + ((hi - v) / (hi - lo)) * (h - pT - pB);
}

// ── Drawing primitives ────────────────────────────────────────────────────
interface DC {
  ctx: CanvasRenderingContext2D;
  n: number; w: number; h: number;
  pL: number; pR: number; pT: number; pB: number;
  lo: number; hi: number;
}

function drawBackground(dc: DC) {
  dc.ctx.fillStyle = C.bg;
  dc.ctx.fillRect(0, 0, dc.w, dc.h);
}

function drawGrid(dc: DC, fmt: (v: number) => string, steps = 6) {
  const { ctx, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.save();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = C.text;
  ctx.font = "9px monospace";
  ctx.textAlign = "left";
  ctx.setLineDash([]);

  for (let i = 0; i <= steps; i++) {
    const v = lo + (i / steps) * (hi - lo);
    const y = yOf(v, lo, hi, h, pT, pB);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w - pR, y); ctx.stroke();
    ctx.fillText(fmt(v), w - pR + 4, y + 3);
  }

  const step = Math.max(1, Math.ceil(dc.n / 8));
  for (let i = 0; i < dc.n; i += step) {
    const x = xOf(i, dc.n, w, pL, pR);
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, h - pB); ctx.stroke();
  }
  ctx.restore();
}

function fillBand(dc: DC, upper: number[], lower: number[], col: string, a: number) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.save();
  ctx.beginPath();
  let first = -1;
  for (let i = 0; i < n; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    const x = xOf(i, n, w, pL, pR);
    const y = yOf(upper[i], lo, hi, h, pT, pB);
    if (first < 0) { ctx.moveTo(x, y); first = i; } else ctx.lineTo(x, y);
  }
  for (let i = n - 1; i >= 0; i--) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    ctx.lineTo(xOf(i, n, w, pL, pR), yOf(lower[i], lo, hi, h, pT, pB));
  }
  if (first >= 0) {
    ctx.closePath();
    ctx.fillStyle = rgba(col, a);
    ctx.fill();
  }
  ctx.restore();
}

function drawLine(dc: DC, arr: number[], col: string, lw = 1.5) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  let started = false;
  for (let i = 0; i < n; i++) {
    if (isNaN(arr[i])) continue;
    const x = xOf(i, n, w, pL, pR);
    const y = yOf(arr[i], lo, hi, h, pT, pB);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCandles(
  dc: DC,
  opens: number[], highs: number[], lows: number[], closes: number[]
) {
  const { ctx, n, w, h, pL, pR, pT, pB, lo, hi } = dc;
  const bw = Math.max(1, ((w - pL - pR) / n) * 0.72);
  ctx.save();
  for (let i = 0; i < n; i++) {
    if (isNaN(opens[i]) || isNaN(closes[i])) continue;
    const x   = xOf(i, n, w, pL, pR);
    const col = closes[i] >= opens[i] ? C.up : C.down;
    const yHi = yOf(highs[i],  lo, hi, h, pT, pB);
    const yLo = yOf(lows[i],   lo, hi, h, pT, pB);
    const yO  = yOf(opens[i],  lo, hi, h, pT, pB);
    const yC  = yOf(closes[i], lo, hi, h, pT, pB);

    // Wick
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yHi); ctx.lineTo(x, yLo); ctx.stroke();

    // Body
    const top = Math.min(yO, yC);
    const bh  = Math.max(1, Math.abs(yC - yO));
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, top, bw, bh);
  }
  ctx.restore();
}

function drawTimeAxis(dc: DC, times: number[]) {
  const { ctx, n, w, h, pL, pR, pB } = dc;
  ctx.save();
  ctx.fillStyle = C.text;
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += step) {
    const x = xOf(i, n, w, pL, pR);
    const d = new Date(times[i] * 1000);
    const lbl = `${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    ctx.fillText(lbl, x, h - pB + 12);
  }
  ctx.restore();
}

// ── Legend subcomponent ───────────────────────────────────────────────────
function Legend({ items }: { items: { col: string; a: number; lbl: string }[] }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 22,
        left: 6,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1px 10px",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {items.map((l) => (
        <span
          key={l.lbl}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.text, whiteSpace: "nowrap" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 7,
              borderRadius: 2,
              background: rgba(l.col, l.a),
              flexShrink: 0,
            }}
          />
          {l.lbl}
        </span>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function MoLinearChart({
  candles,
  period = 5,
  dcPeriod = 5,
  instrument,
}: MoLinearChartProps) {
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const panel1Ref  = useRef<HTMLDivElement>(null);
  const panel2Ref  = useRef<HTMLDivElement>(null);

  // Store logical pixel dimensions so draw() always has fresh values
  const dims = useRef({ w1: 0, h1: 0, w2: 0, h2: 0 });

  const result = useMemo(
    () => calculateMOLinear(candles, period, dcPeriod),
    [candles, period, dcPeriod]
  );

  // ── draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!c1 || !c2 || !result || candles.length === 0) return;

    const ctx1 = c1.getContext("2d");
    const ctx2 = c2.getContext("2d");
    if (!ctx1 || !ctx2) return;

    const n   = candles.length;
    const dec = instrument.includes("JPY") ? 3 : instrument.includes("XAU") ? 2 : 5;

    // ── Panel 1: Price ─────────────────────────────────────────────────────
    {
      const w = dims.current.w1;
      const h = dims.current.h1;
      if (w === 0 || h === 0) return;
      const pL = 8, pR = 62, pT = 22, pB = 26;

      const allP = candles.flatMap((c) => [c.high, c.low]).filter(v => isFinite(v));
      const raw0 = Math.min(...allP);
      const raw1 = Math.max(...allP);
      const pad  = (raw1 - raw0) * 0.08;
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx1, n, w, h, pL, pR, pT, pB, lo, hi };

      ctx1.clearRect(0, 0, w, h);
      drawBackground(dc);
      drawGrid(dc, (v) => v.toFixed(dec));

      // fills (back to front)
      fillBand(dc, result.upperDcA, result.lowerDcA, C.fillA,  0.25);
      fillBand(dc, result.upperDcB, result.lowerDcB, C.fillB,  0.20);
      fillBand(dc, result.h,        result.g,        C.fillHG, 0.20);
      fillBand(dc, result.upperDcK, result.lowerDcK, C.fillK,  0.15);

      // candles
      drawCandles(dc,
        candles.map((c) => c.open),
        candles.map((c) => c.high),
        candles.map((c) => c.low),
        candles.map((c) => c.close),
      );

      // lines
      drawLine(dc, result.midB, C.midB, 1.4);
      drawLine(dc, result.midA, C.midA, 1.4);
      drawLine(dc, result.k,   C.k,    2.0);

      drawTimeAxis(dc, candles.map((c) => c.time));

      // title
      ctx1.save();
      ctx1.fillStyle = C.text;
      ctx1.font = "bold 10px monospace";
      ctx1.textAlign = "center";
      ctx1.fillText(
        `MO_linear  \u2022  ${instrument.replace("_", "/")}  tf=S5  \u2022  n=${n}`,
        w / 2, 14
      );
      ctx1.restore();
    }

    // ── Panel 2: Normalized (ΔPrice vs k) ──────────────────────────────────
    {
      const w = dims.current.w2;
      const h = dims.current.h2;
      if (w === 0 || h === 0) return;
      const pL = 8, pR = 62, pT = 22, pB = 26;

      const allV = [
        ...result.highK, ...result.lowK,
        ...result.upperDcA1, ...result.lowerDcA1,
        ...result.h1, ...result.g1,
      ].filter((v) => isFinite(v));

      if (allV.length === 0) return;
      const raw0 = Math.min(...allV);
      const raw1 = Math.max(...allV);
      const span = Math.max(Math.abs(raw1 - raw0), 0.0001);
      const pad  = span * 0.12;
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx2, n, w, h, pL, pR, pT, pB, lo, hi };

      ctx2.clearRect(0, 0, w, h);
      drawBackground(dc);
      drawGrid(dc, (v) => v.toFixed(4));

      // zero line
      const yZ = yOf(0, lo, hi, h, pT, pB);
      ctx2.save();
      ctx2.strokeStyle = C.zero;
      ctx2.lineWidth = 1;
      ctx2.setLineDash([4, 4]);
      ctx2.beginPath();
      ctx2.moveTo(pL, yZ);
      ctx2.lineTo(w - pR, yZ);
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.restore();

      // fills
      fillBand(dc, result.upperDcA1, result.lowerDcA1, C.fillA,  0.25);
      fillBand(dc, result.upperDcB1, result.lowerDcB1, C.fillB,  0.20);
      fillBand(dc, result.h1,        result.g1,        C.fillHG, 0.20);
      fillBand(dc, result.upperDcK1, result.lowerDcK1, C.fillK,  0.15);

      // normalized candles
      drawCandles(dc, result.openK, result.highK, result.lowK, result.closeK);

      // lines
      drawLine(dc, result.midB1, C.midB, 1.2);
      drawLine(dc, result.midA1, C.midA, 1.2);
      drawLine(dc, result.k1,   C.k,    1.8);

      drawTimeAxis(dc, candles.map((c) => c.time));

      // axis label
      ctx2.save();
      ctx2.fillStyle = C.text;
      ctx2.font = "bold 10px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText("Buy&Sell Candle  (\u0394Price vs k)", w / 2, 14);
      ctx2.restore();
    }
  }, [candles, result, period, dcPeriod, instrument]);

  // ── Resize observer — sets canvas buffer size then calls draw() ────────────
  useEffect(() => {
    const p1 = panel1Ref.current;
    const p2 = panel2Ref.current;
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!p1 || !p2 || !c1 || !c2) return;

    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;

      const w1 = p1.clientWidth;
      const h1 = p1.clientHeight;
      if (w1 > 0 && h1 > 0) {
        dims.current.w1 = w1;
        dims.current.h1 = h1;
        c1.width  = Math.round(w1 * dpr);
        c1.height = Math.round(h1 * dpr);
        const ctx1 = c1.getContext("2d");
        if (ctx1) ctx1.scale(dpr, dpr); // reset by width/height assignment, safe to call once
      }

      const w2 = p2.clientWidth;
      const h2 = p2.clientHeight;
      if (w2 > 0 && h2 > 0) {
        dims.current.w2 = w2;
        dims.current.h2 = h2;
        c2.width  = Math.round(w2 * dpr);
        c2.height = Math.round(h2 * dpr);
        const ctx2 = c2.getContext("2d");
        if (ctx2) ctx2.scale(dpr, dpr);
      }

      draw();
    };

    const ro = new ResizeObserver(applySize);
    ro.observe(p1);
    ro.observe(p2);

    // Defer first call with rAF so the flex layout has settled
    const raf = requestAnimationFrame(applySize);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [draw]);

  // Redraw whenever data / params change (ResizeObserver already covers resize)
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Legends ────────────────────────────────────────────────────────────────
  const leg1 = [
    { col: C.midB,  a: 1,    lbl: "mid(b)=(U_b+L_b)/2" },
    { col: C.midA,  a: 1,    lbl: "mid(a)=(U_a+L_a)/2" },
    { col: C.k,     a: 1,    lbl: "k = avg(mid_a, mid_b)" },
    { col: C.fillA, a: 0.55, lbl: "fill a-band" },
    { col: C.fillB, a: 0.55, lbl: "fill b-band" },
    { col: C.fillHG,a: 0.55, lbl: "fill h-g" },
    { col: C.fillK, a: 0.40, lbl: "fill k-band" },
  ];
  const leg2 = [
    { col: C.midB,  a: 1,    lbl: "mid(b1)" },
    { col: C.midA,  a: 1,    lbl: "mid(a1)" },
    { col: C.k,     a: 1,    lbl: "k1" },
    { col: C.fillA, a: 0.55, lbl: "fill a1-band" },
    { col: C.fillB, a: 0.55, lbl: "fill b1-band" },
    { col: C.fillHG,a: 0.55, lbl: "fill h1-g1" },
    { col: C.fillK, a: 0.40, lbl: "fill k1-band" },
  ];

  if (!result) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs font-mono"
        style={{ background: C.bg, color: C.text }}
      >
        Not enough candles (need {period + dcPeriod + 12}+)
      </div>
    );
  }

  return (
    // Outer wrapper: position relative so children can use absolute positioning
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: C.bg,
        overflow: "hidden",
      }}
    >
      {/* ── Panel 1: top 58% ── */}
      <div
        ref={panel1Ref}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "58%" }}
      >
        <canvas
          ref={canvas1Ref}
          style={{ display: "block", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
        <Legend items={leg1} />
      </div>

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          left: 0,
          right: 0,
          height: 2,
          background: "#1e293b",
        }}
      />

      {/* ── Panel 2: bottom 41% ── */}
      <div
        ref={panel2Ref}
        style={{ position: "absolute", top: "calc(58% + 2px)", left: 0, right: 0, bottom: 0 }}
      >
        <canvas
          ref={canvas2Ref}
          style={{ display: "block", position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
        <Legend items={leg2} />
      </div>
    </div>
  );
}
