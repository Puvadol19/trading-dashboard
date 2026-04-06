// OANDA candle data types
export interface OandaCandle {
  time: string;
  volume: number;
  mid: {
    o: string;
    h: string;
    l: string;
    c: string;
  };
  complete: boolean;
}

export interface CandleData {
  time: number; // unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickData {
  time: number;
  bid: number;
  ask: number;
  spread: number;
}

export interface SlopeAnalysis {
  slope: number;
  intercept: number;
  period: number;
  trend: "BULLISH" | "BEARISH" | "SIDEWAY";
  regressionStart: { time: number; price: number };
  regressionEnd: { time: number; price: number };
}

export interface TickVelocity {
  velocity: number; // pips per second
  direction: "UP" | "DOWN" | "FLAT";
  momentum: "HIGH" | "MEDIUM" | "LOW";
}

// RSI indicator
export interface RSIData {
  value: number;
  condition: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
}

// MACD indicator
export interface MACDData {
  macd: number;
  signal: number;
  histogram: number;
  crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE";
}

// Bollinger Bands
export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  position: "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE";
}

// Multi-timeframe slope
export interface MTFAnalysis {
  s5: SlopeAnalysis | null;
  m1: SlopeAnalysis | null;
  m5: SlopeAnalysis | null;
  confluence: "STRONG_BULL" | "STRONG_BEAR" | "MIXED" | "NO_DATA";
}

// Trendlines
export interface TrendLine {
  p1: { time: number; price: number };
  p2: { time: number; price: number };
  type: "RESISTANCE" | "SUPPORT";
  isValid: boolean;
}

// Alert types
export type AlertType = "SLOPE_CHANGE" | "VELOCITY_SPIKE" | "RSI_EXTREME" | "MACD_CROSS" | "BB_BREAKOUT";
export interface AlertEvent {
  id: string;
  type: AlertType;
  message: string;
  level: "info" | "warning" | "critical";
  timestamp: number;
  instrument: string;
}

// OANDA Account
export interface OandaAccount {
  balance: number;
  unrealizedPL: number;
  pl: number;
  openTradeCount: number;
  currency: string;
  marginUsed: number;
  marginAvailable: number;
}

// OANDA Position
export interface OandaPosition {
  tradeId: string;
  instrument: string;
  units: number;
  averagePrice: number;
  unrealizedPL: number;
  side: "long" | "short";
}

// Trade order
export interface TradeOrder {
  instrument: string;
  units: number;
  side: "buy" | "sell";
  type: "MARKET";
  stopLoss?: number;
  takeProfit?: number;
}

// MO_linear indicator result
export interface MOLinearResult {
  // Panel 1 lines
  midA: number[];
  midB: number[];
  k: number[];
  // Panel 1 fills
  upperDcA: number[];
  lowerDcA: number[];
  upperDcB: number[];
  lowerDcB: number[];
  upperDcK: number[];
  lowerDcK: number[];
  h: number[];
  g: number[];
  // Panel 2 normalized candles
  openK: number[];
  highK: number[];
  lowK: number[];
  closeK: number[];
  // Panel 2 lines
  midA1: number[];
  midB1: number[];
  k1: number[];
  // Panel 2 fills
  upperDcA1: number[];
  lowerDcA1: number[];
  upperDcB1: number[];
  lowerDcB1: number[];
  upperDcK1: number[];
  lowerDcK1: number[];
  h1: number[];
  g1: number[];
}

export interface DashboardState {
  candles: CandleData[];
  currentTick: TickData | null;
  slope: SlopeAnalysis | null;
  tickVelocity: TickVelocity;
  advice: string;
  adviceLevel: "safe" | "caution" | "danger";
  instrument: string;
  isConnected: boolean;
  lastUpdate: number;
  rsi: RSIData | null;
  macd: MACDData | null;
  bollinger: BollingerBands | null;
}

export const INSTRUMENTS = [
  "EUR_USD",
  "GBP_USD",
  "USD_JPY",
  "AUD_USD",
  "USD_CHF",
  "XAU_USD",
  "GBP_JPY",
  "EUR_JPY",
  "BTC_USD",
] as const;

export type Instrument = (typeof INSTRUMENTS)[number];
