export const OANDA_CONFIG = {
  API_URL: process.env.OANDA_API_URL || "https://api-fxpractice.oanda.com",
  STREAM_URL: process.env.OANDA_STREAM_URL || "https://stream-fxpractice.oanda.com",
  API_KEY: process.env.OANDA_API_KEY || "",
  ACCOUNT_ID: process.env.OANDA_ACCOUNT_ID || "",
};

if (!OANDA_CONFIG.API_KEY) {
  console.warn("Missing OANDA_API_KEY environment variable");
}

if (!OANDA_CONFIG.ACCOUNT_ID) {
  console.warn("Missing OANDA_ACCOUNT_ID environment variable");
}
