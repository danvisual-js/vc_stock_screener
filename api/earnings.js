/**
 * api/earnings.js — Per-stock earnings history via Finnhub
 * Returns last 8 quarters: EPS estimate vs actual, surprise %, revenue
 * Usage: /api/earnings?symbol=AAPL
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
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&limit=8&token=${KEY}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return res.status(r.status).json({ error: `Finnhub ${r.status}` });
    const data = await r.json();
    // Normalise fields
    const out = (Array.isArray(data) ? data : []).slice(0, 8).map(q => ({
      period:          q.period || null,
      quarter:         q.quarter || null,
      year:            q.year || null,
      estimate:        q.estimate ?? null,
      actual:          q.actual   ?? null,
      surprise:        q.surprise ?? null,
      surprisePercent: q.surprisePercent ?? null,
      beat:            q.actual != null && q.estimate != null ? q.actual >= q.estimate : null,
    }));
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
