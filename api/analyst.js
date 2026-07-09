/**
 * api/analyst.js — Analyst consensus + price targets via Finnhub (free tier)
 * Usage: /api/analyst?symbol=AAPL
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: "FINNHUB_API_KEY not set" });

  const base = `https://${req.headers.host || "localhost"}`;
  const { searchParams } = new URL(req.url, base);
  const symbol = searchParams.get("symbol");
  if (!symbol) return res.status(400).json({ error: "symbol required" });

  try {
    const [recRes, targetRes, metricsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${KEY}`, { signal: AbortSignal.timeout(7000) }),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${KEY}`,   { signal: AbortSignal.timeout(7000) }),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${KEY}`, { signal: AbortSignal.timeout(7000) }),
    ]);

    const [recs, target, metrics] = await Promise.all([
      recRes.ok   ? recRes.json()    : null,
      targetRes.ok ? targetRes.json() : null,
      metricsRes.ok ? metricsRes.json() : null,
    ]);

    // Derive consensus label from latest recommendation bucket counts
    const latest = Array.isArray(recs) && recs.length ? recs[0] : null;
    let recommendationKey = null;
    let numberOfAnalysts  = null;

    if (latest) {
      const { strongBuy=0, buy=0, hold=0, sell=0, strongSell=0 } = latest;
      numberOfAnalysts = strongBuy + buy + hold + sell + strongSell;
      const net = (strongBuy*2 + buy - sell - strongSell*2) / (numberOfAnalysts || 1);
      if      (net >  0.6) recommendationKey = "strong_buy";
      else if (net >  0.15) recommendationKey = "buy";
      else if (net > -0.15) recommendationKey = "hold";
      else if (net > -0.6)  recommendationKey = "underperform";
      else                  recommendationKey = "sell";
    }

    // Key metrics from Finnhub basic financials
    const m = metrics?.metric || {};

    return res.status(200).json({
      recommendationKey,
      numberOfAnalysts,
      targetMeanPrice:  target?.targetMean  || null,
      targetHighPrice:  target?.targetHigh  || null,
      targetLowPrice:   target?.targetLow   || null,
      // Key stats from Finnhub metrics
      peRatioTTM:       m["peTTM"]          || null,
      pbRatioTTM:       m["pbQuarterly"]     || null,
      beta:             m["beta"]            || null,
      week52High:       m["52WeekHigh"]      || null,
      week52Low:        m["52WeekLow"]       || null,
      // Raw bucket counts for display
      buckets: latest ? {
        strongBuy:  latest.strongBuy  || 0,
        buy:        latest.buy        || 0,
        hold:       latest.hold       || 0,
        sell:       latest.sell       || 0,
        strongSell: latest.strongSell || 0,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
