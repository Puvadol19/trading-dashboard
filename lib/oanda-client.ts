import { OANDA_CONFIG } from "./config";

type OandaResponse<T> = T;

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class OandaClient {
  private baseUrl: string;
  private apiKey: string;
  private accountId: string;

  constructor() {
    this.baseUrl = OANDA_CONFIG.API_URL;
    this.apiKey = OANDA_CONFIG.API_KEY;
    this.accountId = OANDA_CONFIG.ACCOUNT_ID;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...init } = options;
    let url = `${this.baseUrl}/v3${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OANDA API Error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  // Account
  async getAccountSummary() {
    return this.request<{ account: any }>(`/accounts/${this.accountId}/summary`, {
      cache: "no-store",
    });
  }

  // Candles
  async getCandles(instrument: string, granularity: string, count: string) {
    return this.request<{ candles: any[]; instrument: string; granularity: string }>(
      `/instruments/${instrument}/candles`,
      {
        params: {
          granularity,
          count,
          price: "M",
        },
        cache: "no-store",
      }
    );
  }

  // Positions/Trades
  async getOpenTrades() {
    return this.request<{ trades: any[] }>(`/accounts/${this.accountId}/openTrades`, {
      cache: "no-store",
    });
  }

  async closeTrade(tradeId: string) {
    return this.request<{ orderFillTransaction: any }>(
      `/accounts/${this.accountId}/trades/${tradeId}/close`,
      {
        method: "PUT",
        body: JSON.stringify({ units: "ALL" }),
      }
    );
  }

  async createOrder(order: any) {
    return this.request<{ orderFillTransaction: any }>(
      `/accounts/${this.accountId}/orders`,
      {
        method: "POST",
        body: JSON.stringify({ order }),
      }
    );
  }
}

export const oanda = new OandaClient();
