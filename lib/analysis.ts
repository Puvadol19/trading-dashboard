import type { CandleData, SlopeAnalysis, TickVelocity, RSIData, MACDData, BollingerBands, TrendLine, MOLinearResult } from "./types";

const SIDEWAY_THRESHOLD = 0.00002;
const HIGH_VELOCITY_THRESHOLD = 3.0;
const MEDIUM_VELOCITY_THRESHOLD = 1.0;

// ── Linear Regression Slope ──────────────────────────────────────────────

export function calculateSlope(candles: CandleData[], period: number = 12): SlopeAnalysis | null {
  const n = Math.min(period, candles.length);
  if (n < 5) return null;

  const recentCandles = candles.slice(-n);

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = recentCandles[i].close;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const priceStart = intercept;
  const priceEnd = slope * (n - 1) + intercept;

  let trend: "BULLISH" | "BEARISH" | "SIDEWAY";
  if (Math.abs(slope) < SIDEWAY_THRESHOLD) {
    trend = "SIDEWAY";
  } else if (slope > 0) {
    trend = "BULLISH";
  } else {
    trend = "BEARISH";
  }

  return {
    slope,
    intercept,
    period: n,
    trend,
    regressionStart: {
      time: recentCandles[0].time,
      price: priceStart,
    },
    regressionEnd: {
      time: recentCandles[n - 1].time,
      price: priceEnd,
    },
  };
}

// ── RSI (Relative Strength Index) ────────────────────────────────────────

export function calculateRSI(candles: CandleData[], period: number = 14): RSIData | null {
  if (candles.length < period + 1) return null;

  const closes = candles.map((c) => c.close);
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth with Wilder's method
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let condition: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (rsi >= 70) condition = "OVERBOUGHT";
  else if (rsi <= 30) condition = "OVERSOLD";
  else condition = "NEUTRAL";

  return { value: rsi, condition };
}

// ── MACD (Moving Average Convergence Divergence) ─────────────────────────

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    sum += data[i];
  }
  result.push(sum / Math.min(period, data.length));

  for (let i = period; i < data.length; i++) {
    result.push(data[i] * k + result[result.length - 1] * (1 - k));
  }

  return result;
}

export function calculateMACD(
  candles: CandleData[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData | null {
  if (candles.length < slowPeriod + signalPeriod) return null;

  const closes = candles.map((c) => c.close);
  const fastEMA = ema(closes, fastPeriod);
  const slowEMA = ema(closes, slowPeriod);

  // Align arrays
  const offset = fastPeriod < slowPeriod ? slowPeriod - fastPeriod : 0;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    const fastIdx = i + offset;
    if (fastIdx < fastEMA.length) {
      macdLine.push(fastEMA[fastIdx] - slowEMA[i]);
    }
  }

  if (macdLine.length < signalPeriod) return null;

  const signalLine = ema(macdLine, signalPeriod);
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  // Check for crossover
  let crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE" = "NONE";
  if (macdLine.length >= 2 && signalLine.length >= 2) {
    const prevMACD = macdLine[macdLine.length - 2];
    const prevSignalIdx = signalLine.length - 2;
    if (prevSignalIdx >= 0) {
      const prevSignal = signalLine[prevSignalIdx];
      if (prevMACD <= prevSignal && currentMACD > currentSignal) {
        crossover = "BULLISH_CROSS";
      } else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
        crossover = "BEARISH_CROSS";
      }
    }
  }

  return { macd: currentMACD, signal: currentSignal, histogram, crossover };
}

// ── Bollinger Bands ──────────────────────────────────────────────────────

export function calculateBollingerBands(
  candles: CandleData[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerBands | null {
  if (candles.length < period) return null;

  const recentCloses = candles.slice(-period).map((c) => c.close);
  const sma = recentCloses.reduce((a, b) => a + b, 0) / period;

  const variance =
    recentCloses.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + stdDevMultiplier * stdDev;
  const lower = sma - stdDevMultiplier * stdDev;
  const width = upper - lower;

  const currentClose = candles[candles.length - 1].close;
  let position: "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE";
  if (currentClose > upper) position = "ABOVE_UPPER";
  else if (currentClose < lower) position = "BELOW_LOWER";
  else position = "INSIDE";

  return { upper, middle: sma, lower, width, position };
}

// ── Tick Velocity ────────────────────────────────────────────────────────

export function calculateTickVelocity(
  currentBid: number,
  previousBid: number,
  timeDiffMs: number,
  pipSize: number = 0.0001
): TickVelocity {
  if (timeDiffMs <= 0) {
    return { velocity: 0, direction: "FLAT", momentum: "LOW" };
  }

  const priceDiff = currentBid - previousBid;
  const pipDiff = Math.abs(priceDiff) / pipSize;
  const velocity = (pipDiff / timeDiffMs) * 1000;

  let direction: "UP" | "DOWN" | "FLAT";
  if (Math.abs(priceDiff) < pipSize * 0.1) {
    direction = "FLAT";
  } else if (priceDiff > 0) {
    direction = "UP";
  } else {
    direction = "DOWN";
  }

  let momentum: "HIGH" | "MEDIUM" | "LOW";
  if (velocity >= HIGH_VELOCITY_THRESHOLD) {
    momentum = "HIGH";
  } else if (velocity >= MEDIUM_VELOCITY_THRESHOLD) {
    momentum = "MEDIUM";
  } else {
    momentum = "LOW";
  }

  return { velocity, direction, momentum };
}

// ── Trading Advice (enhanced with all indicators) ────────────────────────

export function generateAdvice(
  slope: SlopeAnalysis | null,
  velocity: TickVelocity,
  rsi: RSIData | null,
  macd: MACDData | null,
  bb: BollingerBands | null
): { advice: string; level: "safe" | "caution" | "danger" } {
  if (!slope) {
    return { advice: "WAITING FOR DATA...", level: "caution" };
  }

  // RSI extremes override
  if (rsi) {
    if (rsi.condition === "OVERBOUGHT" && slope.trend === "BEARISH") {
      return { advice: "RSI OVERBOUGHT + BEARISH - SELL PRESSURE", level: "danger" };
    }
    if (rsi.condition === "OVERSOLD" && slope.trend === "BULLISH") {
      return { advice: "RSI OVERSOLD + BULLISH - BUY OPPORTUNITY", level: "safe" };
    }
  }

  // MACD crossover signals
  if (macd) {
    if (macd.crossover === "BULLISH_CROSS" && slope.trend !== "BEARISH") {
      return { advice: "MACD BULLISH CROSS - TREND CONFIRMING UP", level: "safe" };
    }
    if (macd.crossover === "BEARISH_CROSS" && slope.trend !== "BULLISH") {
      return { advice: "MACD BEARISH CROSS - TREND CONFIRMING DOWN", level: "danger" };
    }
  }

  // BB breakout
  if (bb) {
    if (bb.position === "ABOVE_UPPER" && velocity.momentum === "HIGH") {
      return { advice: "BB BREAKOUT UP + HIGH VELOCITY", level: "safe" };
    }
    if (bb.position === "BELOW_LOWER" && velocity.momentum === "HIGH") {
      return { advice: "BB BREAKOUT DOWN + HIGH VELOCITY", level: "danger" };
    }
  }

  // Sideway market
  if (slope.trend === "SIDEWAY") {
    if (velocity.momentum === "HIGH") {
      return { advice: "BREAKOUT POSSIBLE - WATCH CLOSELY", level: "caution" };
    }
    return { advice: "SIDEWAY - DO NOTHING", level: "danger" };
  }

  // Trending market
  if (velocity.momentum === "HIGH") {
    return { advice: "HIGH MOMENTUM - RECOVERY OK", level: "safe" };
  }

  if (velocity.momentum === "MEDIUM") {
    return { advice: "MODERATE TREND - PROCEED WITH CAUTION", level: "caution" };
  }

  return { advice: "LOW MOMENTUM - SIT ON HANDS", level: "danger" };
}

// ── Pip Size ─────────────────────────────────────────────────────────────

export function getPipSize(instrument: string): number {
  if (instrument.includes("JPY")) return 0.01;
  if (instrument.includes("XAU")) return 0.1;
  return 0.0001;
}

// ── Trendline Analysis ───────────────────────────────────────────────────

export function calculateTrendLines(candles: CandleData[], lookback: number = 20): TrendLine[] {
  if (candles.length < lookback) return [];

  // Find pivot highs and lows
  const highs: { index: number; price: number }[] = [];
  const lows: { index: number; price: number }[] = [];

  // Simple pivot detection: a point is a pivot if it's higher/lower than 2 neighbors
  for (let i = 2; i < candles.length - 2; i++) {
    const current = candles[i];
    
    // Check for High
    if (
      current.high > candles[i - 1].high &&
      current.high > candles[i - 2].high &&
      current.high > candles[i + 1].high &&
      current.high > candles[i + 2].high
    ) {
      highs.push({ index: i, price: current.high });
    }

    // Check for Low
    if (
      current.low < candles[i - 1].low &&
      current.low < candles[i - 2].low &&
      current.low < candles[i + 1].low &&
      current.low < candles[i + 2].low
    ) {
      lows.push({ index: i, price: current.low });
    }
  }

  const lines: TrendLine[] = [];

  // Create Resistance Line (connect last 2 major highs)
  if (highs.length >= 2) {
    const lastHigh = highs[highs.length - 1];
    const prevHigh = highs[highs.length - 2];
    
    // Only draw if the line is somewhat meaningful (e.g., not too steep)
    lines.push({
      p1: { time: candles[prevHigh.index].time, price: prevHigh.price },
      p2: { time: candles[lastHigh.index].time, price: lastHigh.price },
      type: "RESISTANCE",
      isValid: true,
    });
  }

  // Create Support Line (connect last 2 major lows)
  if (lows.length >= 2) {
    const lastLow = lows[lows.length - 1];
    const prevLow = lows[lows.length - 2];

    lines.push({
      p1: { time: candles[prevLow.index].time, price: prevLow.price },
      p2: { time: candles[lastLow.index].time, price: lastLow.price },
      type: "SUPPORT",
      isValid: true,
    });
  }

  return lines;
}

// ── MO_linear Indicator ──────────────────────────────────────────────────

/**
 * Pine-like linreg(series, length, offset):
 * Fits OLS on a window of `length` bars, evaluates at x = (length-1) - offset.
 * Matches the TradingView linreg() behaviour.
 */
function linregPine(series: number[], length: number, offset: number): number[] {
  const n = series.length;
  const out = new Array(n).fill(NaN);
  if (length < 2) return out;

  const xArr = Array.from({ length }, (_, i) => i);
  const xMean = (length - 1) / 2;
  const denom = xArr.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const evalX = (length - 1) - offset;

  for (let i = length - 1; i < n; i++) {
    const yWin = series.slice(i - length + 1, i + 1);
    const yMean = yWin.reduce((a, b) => a + b, 0) / length;
    const slope = xArr.reduce((s, x, j) => s + (x - xMean) * (yWin[j] - yMean), 0) / denom;
    const intercept = yMean - slope * xMean;
    out[i] = slope * evalX + intercept;
  }
  return out;
}

function rollingMax(arr: number[], period: number): number[] {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - period + 1), i + 1).filter((v) => !isNaN(v));
    return slice.length ? Math.max(...slice) : NaN;
  });
}

function rollingMin(arr: number[], period: number): number[] {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - period + 1), i + 1).filter((v) => !isNaN(v));
    return slice.length ? Math.min(...slice) : NaN;
  });
}

function addArr(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}
function subArr(a: number[], b: number[]): number[] {
  return a.map((v, i) => v - b[i]);
}
function scaleArr(a: number[], s: number): number[] {
  return a.map((v) => v * s);
}
function avgArrs(...arrs: number[][]): number[] {
  const len = arrs[0].length;
  return Array.from({ length: len }, (_, i) => {
    const vals = arrs.map((a) => a[i]).filter((v) => !isNaN(v));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : NaN;
  });
}

export function calculateMOLinear(
  candles: CandleData[],
  period: number = 5,
  dcPeriod: number = 5
): MOLinearResult | null {
  if (candles.length < period + dcPeriod + 10) return null;

  const close = candles.map((c) => c.close);
  const high  = candles.map((c) => c.high);
  const low   = candles.map((c) => c.low);
  const open  = candles.map((c) => c.open);

  // Panel 1: a, b on real prices
  const a = linregPine(close, period, period);
  const b = linregPine(close, period, 0);
  const e = linregPine(high, 9, 9);
  const d = linregPine(low,  9, 9);
  const h = linregPine(e, period, 0);
  const g = linregPine(d, period, 0);

  // Donchian channels of a and b
  const upperDcA = rollingMax(a, dcPeriod);
  const lowerDcA = rollingMin(a, dcPeriod);
  const upperDcB = rollingMax(b, dcPeriod);
  const lowerDcB = rollingMin(b, dcPeriod);

  // k = avg(mid_a, mid_b)
  const midA = scaleArr(addArr(upperDcA, lowerDcA), 0.5);
  const midB = scaleArr(addArr(upperDcB, lowerDcB), 0.5);
  const k    = avgArrs(midA, midB);

  // Donchian of k
  const upperDcK = rollingMax(k, dcPeriod);
  const lowerDcK = rollingMin(k, dcPeriod);

  // Normalize prices by k (Panel 2)
  const openK  = subArr(open,  k);
  const highK  = subArr(high,  k);
  const lowK   = subArr(low,   k);
  const closeK = subArr(close, k);

  // Panel 2: a1, b1 on normalized prices
  const a1 = linregPine(closeK, period, period);
  const b1 = linregPine(closeK, period, 0);
  const e1 = linregPine(highK, 9, 9);
  const d1 = linregPine(lowK,  9, 9);
  const h1 = linregPine(e1, period, 0);
  const g1 = linregPine(d1, period, 0);

  const upperDcA1 = rollingMax(a1, dcPeriod);
  const lowerDcA1 = rollingMin(a1, dcPeriod);
  const upperDcB1 = rollingMax(b1, dcPeriod);
  const lowerDcB1 = rollingMin(b1, dcPeriod);

  const midA1 = scaleArr(addArr(upperDcA1, lowerDcA1), 0.5);
  const midB1 = scaleArr(addArr(upperDcB1, lowerDcB1), 0.5);
  const k1    = avgArrs(midA1, midB1);

  const upperDcK1 = rollingMax(k1, dcPeriod);
  const lowerDcK1 = rollingMin(k1, dcPeriod);

  return {
    // Panel 1 lines
    midA, midB, k,
    // Panel 1 fills
    upperDcA, lowerDcA,
    upperDcB, lowerDcB,
    upperDcK, lowerDcK,
    h, g,
    // Panel 2 candles (normalized)
    openK, highK, lowK, closeK,
    // Panel 2 lines
    midA1, midB1, k1,
    // Panel 2 fills
    upperDcA1, lowerDcA1,
    upperDcB1, lowerDcB1,
    upperDcK1, lowerDcK1,
    h1, g1,
  };
}

// ── Breakout Detection ───────────────────────────────────────────────────

export function checkTrendLineBreakout(trendLines: TrendLine[], currentCandle: CandleData): { type: "BREAKOUT_UP" | "BREAKOUT_DOWN"; line: TrendLine } | null {
  for (const line of trendLines) {
    if (!line.isValid) continue;

    // Calculate expected price at current time
    // m = (y2 - y1) / (x2 - x1)
    const timeDiff = line.p2.time - line.p1.time;
    if (timeDiff === 0) continue;

    const slope = (line.p2.price - line.p1.price) / timeDiff;
    const timeSinceP2 = currentCandle.time - line.p2.time;
    
    // Only check if we are somewhat close in time (e.g. within 100 periods) to avoid stale lines
    if (timeSinceP2 < 0 || timeSinceP2 > timeDiff * 5) continue;

    const expectedPrice = line.p2.price + slope * timeSinceP2;

    // Check breakout
    // Resistance: Price was below, now above
    if (line.type === "RESISTANCE") {
      if (currentCandle.close > expectedPrice && currentCandle.open <= expectedPrice) {
        return { type: "BREAKOUT_UP", line };
      }
    }

    // Support: Price was above, now below
    if (line.type === "SUPPORT") {
      if (currentCandle.close < expectedPrice && currentCandle.open >= expectedPrice) {
        return { type: "BREAKOUT_DOWN", line };
      }
    }
  }
  return null;
}
