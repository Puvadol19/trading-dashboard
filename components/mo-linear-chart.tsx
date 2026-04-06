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
  bg:      "#0a0e17",
  grid:    "#1e293b",
  text:    "#94a3b8",
  up:      "#22c55e",
  down:    "#ef4444",
  midB:    "#2dd4bf",
  midA:    "#14b8a6",
  k:       "#3b82f6",
  fillA:   "#eab308",
  fillB:   "#22c55e",
  fillHG:  "#ef4444",
  fillK:   "#818cf8",
  zero:    "#06b6d4",
  cross:   "#e2e8f0",
};

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Viewport state ─────────────────────────────────────────────────────────
// startIdx and endIdx define the visible window into candles[]
interface Viewport { startIdx: number; endIdx: number }

// ── Coordinate helpers ─────────────────────────────────────────────────────
function xOf(i: number, start: number, end: number, w: number, pL: number, pR: number) {
  const n = end - start;
  if (n <= 0) return pL;
  return pL + ((i - start) + 0.5) * ((w - pL - pR) / n);
}

function xToIdx(x: number, start: number, end: number, w: number, pL: number, pR: number) {
  const n = end - start;
  if (n <= 0) return start;
  return Math.round(start + (x - pL) / ((w - pL - pR) / n) - 0.5);
}

function yOf(v: number, lo: number, hi: number, h: number, pT: number, pB: number) {
  if (hi === lo) return pT + (h - pT - pB) / 2;
  return pT + ((hi - v) / (hi - lo)) * (h - pT - pB);
}

// ── Draw context ───────────────────────────────────────────────────────────
interface DC {
  ctx: CanvasRenderingContext2D;
  start: number; end: number;
  w: number; h: number;
  pL: number; pR: number; pT: number; pB: number;
  lo: number; hi: number;
}

function drawBackground(dc: DC) {
  dc.ctx.fillStyle = C.bg;
  dc.ctx.fillRect(0, 0, dc.w, dc.h);
}

function drawGrid(dc: DC, fmt: (v: number) => string, steps = 6) {
  const { ctx, w, h, pL, pR, pT, pB, lo, hi, start, end } = dc;
  ctx.save();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 0.5;
  ctx.fillStyle = C.text;
  ctx.font = "9px monospace";
  ctx.setLineDash([]);

  // Horizontal price lines
  ctx.textAlign = "left";
  for (let i = 0; i <= steps; i++) {
    const v = lo + (i / steps) * (hi - lo);
    const y = yOf(v, lo, hi, h, pT, pB);
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(w - pR, y); ctx.stroke();
    ctx.fillText(fmt(v), w - pR + 4, y + 3);
  }

  // Vertical time lines
  const n = end - start;
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = start; i < end; i += step) {
    const x = xOf(i, start, end, w, pL, pR);
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, h - pB); ctx.stroke();
  }
  ctx.restore();
}

function fillBand(dc: DC, upper: number[], lower: number[], col: string, a: number) {
  const { ctx, start, end, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.save();
  ctx.beginPath();
  let first = -1;
  for (let i = start; i < end; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    const x = xOf(i, start, end, w, pL, pR);
    const y = yOf(upper[i], lo, hi, h, pT, pB);
    if (first < 0) { ctx.moveTo(x, y); first = i; } else ctx.lineTo(x, y);
  }
  for (let i = end - 1; i >= start; i--) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;
    ctx.lineTo(xOf(i, start, end, w, pL, pR), yOf(lower[i], lo, hi, h, pT, pB));
  }
  if (first >= 0) {
    ctx.closePath();
    ctx.fillStyle = rgba(col, a);
    ctx.fill();
  }
  ctx.restore();
}

function drawLine(dc: DC, arr: number[], col: string, lw = 1.5) {
  const { ctx, start, end, w, h, pL, pR, pT, pB, lo, hi } = dc;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  let started = false;
  for (let i = start; i < end; i++) {
    if (isNaN(arr[i])) continue;
    const x = xOf(i, start, end, w, pL, pR);
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
  const { ctx, start, end, w, h, pL, pR, pT, pB, lo, hi } = dc;
  const n = end - start;
  const bw = Math.max(1, ((w - pL - pR) / n) * 0.72);
  ctx.save();
  for (let i = start; i < end; i++) {
    if (isNaN(opens[i]) || isNaN(closes[i])) continue;
    const x   = xOf(i, start, end, w, pL, pR);
    const col = closes[i] >= opens[i] ? C.up : C.down;
    const yHi = yOf(highs[i],  lo, hi, h, pT, pB);
    const yLo = yOf(lows[i],   lo, hi, h, pT, pB);
    const yO  = yOf(opens[i],  lo, hi, h, pT, pB);
    const yC  = yOf(closes[i], lo, hi, h, pT, pB);
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yHi); ctx.lineTo(x, yLo); ctx.stroke();
    const top = Math.min(yO, yC);
    const bh  = Math.max(1, Math.abs(yC - yO));
    ctx.fillStyle = col;
    ctx.fillRect(x - bw / 2, top, bw, bh);
  }
  ctx.restore();
}

function drawTimeAxis(dc: DC, times: number[]) {
  const { ctx, start, end, w, h, pL, pR, pB } = dc;
  const n = end - start;
  ctx.save();
  ctx.fillStyle = C.text;
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(n / 8));
  for (let i = start; i < end; i += step) {
    const x = xOf(i, start, end, w, pL, pR);
    const d = new Date(times[i] * 1000);
    const lbl = `${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    ctx.fillText(lbl, x, h - pB + 12);
  }
  ctx.restore();
}

// Draw crosshair on a canvas (vertical + horizontal line + price label)
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  pL: number, pR: number, pT: number, pB: number,
  priceLabel: string
) {
  ctx.save();
  ctx.strokeStyle = rgba(C.cross, 0.5);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Vertical
  ctx.beginPath(); ctx.moveTo(cx, pT); ctx.lineTo(cx, h - pB); ctx.stroke();
  // Horizontal
  ctx.beginPath(); ctx.moveTo(pL, cy); ctx.lineTo(w - pR, cy); ctx.stroke();

  // Price label on right axis
  const lx = w - pR + 2;
  const ly = cy;
  ctx.fillStyle = C.cross;
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = 3;
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "left";
  ctx.setLineDash([]);
  ctx.strokeText(priceLabel, lx, ly + 3);
  ctx.fillText(priceLabel, lx, ly + 3);

  ctx.restore();
}

// ── Legend subcomponent ────────────────────────────────────────────────────
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
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9,
            color: C.text,
            whiteSpace: "nowrap",
          }}
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Logical pixel dimensions
  const dims = useRef({ w1: 0, h1: 0, w2: 0, h2: 0 });

  // Viewport: which candle indices are visible
  const vp = useRef<Viewport>({ startIdx: 0, endIdx: 0 });

  // Crosshair state
  const crosshair = useRef<{ x: number; barIdx: number } | null>(null);

  // Drag state for panning
  const drag = useRef<{ startX: number; startVp: Viewport } | null>(null);

  const result = useMemo(
    () => calculateMOLinear(candles, period, dcPeriod),
    [candles, period, dcPeriod]
  );

  // Init viewport to show all candles
  useEffect(() => {
    if (candles.length === 0) return;
    vp.current = { startIdx: 0, endIdx: candles.length };
  }, [candles.length]);

  // ── Core draw ──────────────────────────────────────────────────────────────
  const draw = useCallback((hoverBarIdx?: number) => {
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!c1 || !c2 || !result || candles.length === 0) return;

    const ctx1 = c1.getContext("2d");
    const ctx2 = c2.getContext("2d");
    if (!ctx1 || !ctx2) return;

    const { startIdx, endIdx } = vp.current;
    const start = Math.max(0, startIdx);
    const end   = Math.min(candles.length, endIdx);
    if (end <= start) return;

    const dec = instrument.includes("JPY")
      ? 3
      : instrument.includes("XAU") || instrument.includes("BTC")
      ? 2
      : 5;

    const pL = 8, pR = 62, pT = 24, pB = 28;

    // ── Panel 1 ─────────────────────────────────────────────────────────────
    {
      const w = dims.current.w1;
      const h = dims.current.h1;
      if (w === 0 || h === 0) return;

      const allP = candles
        .slice(start, end)
        .flatMap((c) => [c.high, c.low])
        .filter(isFinite);
      if (allP.length === 0) return;
      const raw0 = Math.min(...allP);
      const raw1 = Math.max(...allP);
      const pad  = (raw1 - raw0) * 0.10;
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx1, start, end, w, h, pL, pR, pT, pB, lo, hi };

      ctx1.clearRect(0, 0, w, h);
      drawBackground(dc);
      drawGrid(dc, (v) => v.toFixed(dec));

      fillBand(dc, result.upperDcA, result.lowerDcA, C.fillA,  0.25);
      fillBand(dc, result.upperDcB, result.lowerDcB, C.fillB,  0.20);
      fillBand(dc, result.h,        result.g,        C.fillHG, 0.20);
      fillBand(dc, result.upperDcK, result.lowerDcK, C.fillK,  0.15);

      drawCandles(dc,
        candles.map((c) => c.open),
        candles.map((c) => c.high),
        candles.map((c) => c.low),
        candles.map((c) => c.close),
      );

      drawLine(dc, result.midB, C.midB, 1.4);
      drawLine(dc, result.midA, C.midA, 1.4);
      drawLine(dc, result.k,   C.k,    2.0);

      drawTimeAxis(dc, candles.map((c) => c.time));

      // Title
      ctx1.save();
      ctx1.fillStyle = C.text;
      ctx1.font = "bold 10px monospace";
      ctx1.textAlign = "center";
      ctx1.fillText(
        `MO_linear \u2022 ${instrument.replace("_", "/")} tf=S5 \u2022 n=${end - start}`,
        w / 2, 14
      );
      ctx1.restore();

      // Crosshair panel 1
      if (hoverBarIdx !== undefined && hoverBarIdx >= start && hoverBarIdx < end) {
        const cx = xOf(hoverBarIdx, start, end, w, pL, pR);
        const price = candles[hoverBarIdx]?.close ?? NaN;
        const cy = yOf(price, lo, hi, h, pT, pB);
        drawCrosshair(ctx1, cx, cy, w, h, pL, pR, pT, pB, price.toFixed(dec));

        // OHLC tooltip top-right
        const c = candles[hoverBarIdx];
        if (c) {
          const d = new Date(c.time * 1000);
          const timeStr = `${d.getDate()} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
          const lines = [
            timeStr,
            `O ${c.open.toFixed(dec)}`,
            `H ${c.high.toFixed(dec)}`,
            `L ${c.low.toFixed(dec)}`,
            `C ${c.close.toFixed(dec)}`,
          ];
          ctx1.save();
          ctx1.font = "9px monospace";
          const tw = Math.max(...lines.map((l) => ctx1.measureText(l).width));
          const bx = w - pR - tw - 14;
          const by = pT + 4;
          const bh = lines.length * 13 + 6;
          ctx1.fillStyle = rgba(C.bg, 0.85);
          ctx1.fillRect(bx - 2, by, tw + 10, bh);
          ctx1.fillStyle = C.text;
          ctx1.textAlign = "left";
          lines.forEach((l, i) => ctx1.fillText(l, bx + 2, by + 12 + i * 13));
          ctx1.restore();
        }
      }
    }

    // ── Panel 2 ─────────────────────────────────────────────────────────────
    {
      const w = dims.current.w2;
      const h = dims.current.h2;
      if (w === 0 || h === 0) return;

      const allV = [
        ...result.highK.slice(start, end),
        ...result.lowK.slice(start, end),
        ...result.upperDcA1.slice(start, end),
        ...result.lowerDcA1.slice(start, end),
        ...result.h1.slice(start, end),
        ...result.g1.slice(start, end),
      ].filter(isFinite);

      if (allV.length === 0) return;
      const raw0 = Math.min(...allV);
      const raw1 = Math.max(...allV);
      const span = Math.max(Math.abs(raw1 - raw0), 0.0001);
      const pad  = span * 0.12;
      const lo = raw0 - pad, hi = raw1 + pad;

      const dc: DC = { ctx: ctx2, start, end, w, h, pL, pR, pT, pB, lo, hi };

      ctx2.clearRect(0, 0, w, h);
      drawBackground(dc);
      drawGrid(dc, (v) => v.toFixed(4));

      // Zero line
      const yZ = yOf(0, lo, hi, h, pT, pB);
      ctx2.save();
      ctx2.strokeStyle = C.zero;
      ctx2.lineWidth = 1;
      ctx2.setLineDash([4, 4]);
      ctx2.beginPath(); ctx2.moveTo(pL, yZ); ctx2.lineTo(w - pR, yZ); ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.restore();

      fillBand(dc, result.upperDcA1, result.lowerDcA1, C.fillA,  0.25);
      fillBand(dc, result.upperDcB1, result.lowerDcB1, C.fillB,  0.20);
      fillBand(dc, result.h1,        result.g1,        C.fillHG, 0.20);
      fillBand(dc, result.upperDcK1, result.lowerDcK1, C.fillK,  0.15);

      drawCandles(dc, result.openK, result.highK, result.lowK, result.closeK);

      drawLine(dc, result.midB1, C.midB, 1.2);
      drawLine(dc, result.midA1, C.midA, 1.2);
      drawLine(dc, result.k1,   C.k,    1.8);

      drawTimeAxis(dc, candles.map((c) => c.time));

      ctx2.save();
      ctx2.fillStyle = C.text;
      ctx2.font = "bold 10px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText("Buy&Sell Candle  (\u0394Price vs k)", w / 2, 14);
      ctx2.restore();

      // Crosshair panel 2 (same bar index)
      if (hoverBarIdx !== undefined && hoverBarIdx >= start && hoverBarIdx < end) {
        const cx = xOf(hoverBarIdx, start, end, w, pL, pR);
        const closeK = result.closeK[hoverBarIdx] ?? NaN;
        const cy = isFinite(closeK) ? yOf(closeK, lo, hi, h, pT, pB) : h / 2;
        drawCrosshair(ctx2, cx, cy, w, h, pL, pR, pT, pB, closeK.toFixed(4));
      }
    }
  }, [candles, result, instrument]);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const p1 = panel1Ref.current;
    const p2 = panel2Ref.current;
    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    if (!p1 || !p2 || !c1 || !c2) return;

    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w1 = p1.clientWidth;  const h1 = p1.clientHeight;
      if (w1 > 0 && h1 > 0) {
        dims.current.w1 = w1; dims.current.h1 = h1;
        c1.width  = Math.round(w1 * dpr);
        c1.height = Math.round(h1 * dpr);
        const ctx1 = c1.getContext("2d");
        if (ctx1) { ctx1.setTransform(1, 0, 0, 1, 0, 0); ctx1.scale(dpr, dpr); }
      }
      const w2 = p2.clientWidth;  const h2 = p2.clientHeight;
      if (w2 > 0 && h2 > 0) {
        dims.current.w2 = w2; dims.current.h2 = h2;
        c2.width  = Math.round(w2 * dpr);
        c2.height = Math.round(h2 * dpr);
        const ctx2 = c2.getContext("2d");
        if (ctx2) { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.scale(dpr, dpr); }
      }
      draw();
    };

    const ro = new ResizeObserver(applySize);
    ro.observe(p1); ro.observe(p2);
    const raf = requestAnimationFrame(applySize);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [draw]);

  // Redraw on data/params change
  useEffect(() => { draw(); }, [draw]);

  // ── Mouse interactions ─────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getBarIdxFromEvent = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const w = dims.current.w1;
      const pL = 8, pR = 62;
      return xToIdx(rawX, vp.current.startIdx, vp.current.endIdx, w, pL, pR);
    };

    // ── Mouse move → crosshair ──
    const onMouseMove = (e: MouseEvent) => {
      if (drag.current) {
        // Panning
        const dx = e.clientX - drag.current.startX;
        const w  = dims.current.w1;
        const pL = 8, pR = 62;
        const plotW = w - pL - pR;
        const n = drag.current.startVp.endIdx - drag.current.startVp.startIdx;
        const barsPerPx = n / plotW;
        const delta = -Math.round(dx * barsPerPx);
        const total = candles.length;
        let ns = drag.current.startVp.startIdx + delta;
        let ne = drag.current.startVp.endIdx + delta;
        if (ns < 0) { ne -= ns; ns = 0; }
        if (ne > total) { ns -= (ne - total); ne = total; }
        ns = Math.max(0, ns); ne = Math.min(total, ne);
        vp.current = { startIdx: ns, endIdx: ne };
        draw();
        return;
      }
      const idx = getBarIdxFromEvent(e);
      crosshair.current = { x: e.clientX, barIdx: idx };
      draw(idx);
    };

    const onMouseLeave = () => {
      crosshair.current = null;
      draw();
    };

    const onMouseDown = (e: MouseEvent) => {
      drag.current = { startX: e.clientX, startVp: { ...vp.current } };
      container.style.cursor = "grabbing";
    };

    const onMouseUp = () => {
      drag.current = null;
      container.style.cursor = "crosshair";
    };

    // ── Wheel → zoom ──
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const total = candles.length;
      if (total === 0) return;

      // Find bar under cursor as zoom anchor
      const rect = container.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const w  = dims.current.w1;
      const pL = 8, pR = 62;
      const plotW = w - pL - pR;
      const { startIdx, endIdx } = vp.current;
      const n = endIdx - startIdx;
      const ratio = Math.max(0, Math.min(1, (rawX - pL) / plotW));
      const anchorBar = startIdx + ratio * n;

      // Zoom factor
      const factor = e.deltaY < 0 ? 0.85 : 1.18;
      const newN = Math.max(10, Math.min(total, Math.round(n * factor)));

      let ns = Math.round(anchorBar - ratio * newN);
      let ne = ns + newN;
      if (ns < 0) { ne -= ns; ns = 0; }
      if (ne > total) { ns -= (ne - total); ne = total; }
      ns = Math.max(0, ns); ne = Math.min(total, ne);

      vp.current = { startIdx: ns, endIdx: ne };
      draw(crosshair.current?.barIdx);
    };

    container.addEventListener("mousemove",  onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("mousedown",  onMouseDown);
    container.addEventListener("mouseup",    onMouseUp);
    container.addEventListener("wheel",      onWheel,      { passive: false });

    return () => {
      container.removeEventListener("mousemove",  onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("mousedown",  onMouseDown);
      container.removeEventListener("mouseup",    onMouseUp);
      container.removeEventListener("wheel",      onWheel);
    };
  }, [candles, draw]);

  // ── Legends ────────────────────────────────────────────────────────────────
  const leg1 = [
    { col: C.midB,   a: 1,    lbl: "mid(b)=(U_b+L_b)/2" },
    { col: C.midA,   a: 1,    lbl: "mid(a)=(U_a+L_a)/2" },
    { col: C.k,      a: 1,    lbl: "k = avg(mid_a, mid_b)" },
    { col: C.fillA,  a: 0.55, lbl: "fill a-band" },
    { col: C.fillB,  a: 0.55, lbl: "fill b-band" },
    { col: C.fillHG, a: 0.55, lbl: "fill h-g" },
    { col: C.fillK,  a: 0.40, lbl: "fill k-band" },
  ];
  const leg2 = [
    { col: C.midB,   a: 1,    lbl: "mid(b1)" },
    { col: C.midA,   a: 1,    lbl: "mid(a1)" },
    { col: C.k,      a: 1,    lbl: "k1" },
    { col: C.fillA,  a: 0.55, lbl: "fill a1-band" },
    { col: C.fillB,  a: 0.55, lbl: "fill b1-band" },
    { col: C.fillHG, a: 0.55, lbl: "fill h1-g1" },
    { col: C.fillK,  a: 0.40, lbl: "fill k1-band" },
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
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: C.bg,
        overflow: "hidden",
        cursor: "crosshair",
        userSelect: "none",
      }}
    >
      {/* Panel 1: top 58% */}
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
      <div style={{ position: "absolute", top: "58%", left: 0, right: 0, height: 2, background: "#1e293b" }} />

      {/* Panel 2: bottom 41% */}
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
