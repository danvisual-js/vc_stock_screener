/**
 * api/quotes.js — Finnhub real-time quotes
 * Set FINNHUB_API_KEY in Vercel → Settings → Environment Variables
 *
 * - up to 60 symbols per request (the client sends one batch for every list)
 * - a 8-second per-symbol memo on warm instances protects the free tier
 *   (60 calls/min) when auto-refresh and several tabs run at once
 * - if Finnhub rate-limits or times out, the last good price is returned
 *   marked stale:true instead of silently dropping the symbol
 * - t = Unix seconds of the last trade, so the app can show how old a price is
 */
const memo = new Map(); // sym -> { at, q }
const FRESH_MS = 8000;
const STALE_MAX_MS = 10 * 60 * 1000;

async function one(sym, KEY) {
  const hit = memo.get(sym);
  const now = Date.now();
  if (hit && now - hit.at < FRESH_MS) return hit.q;
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) {
      console.error(`Finnhub ${r.status} for ${sym}`);
      return stale(hit, now);
    }
    const d = await r.json();
    if (!d || typeof d.c !== 'number' || d.c === 0) return stale(hit, now) || null;
    const q = { p: d.c, pc: d.pc || d.c, name: sym, t: d.t || null };
    memo.set(sym, { at: now, q });
    if (memo.size > 400) memo.delete(memo.keys().next().value);
    return q;
  } catch (err) {
    console.error(`Fetch error for ${sym}:`, err.message);
    return stale(hit, now);
  }
}
function stale(hit, now) {
  if (hit && now - hit.at < STALE_MAX_MS) return Object.assign({}, hit.q, { stale: true });
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = `https://${req.headers.host || 'localhost'}`;
  const { searchParams } = new URL(req.url, base);
  const symbols = searchParams.get('symbols');
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not set in Vercel env vars' });

  const symList = [...new Set(symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean))].slice(0, 60);

  const entries = await Promise.all(symList.map(async sym => [sym, await one(sym, KEY)]));
  const result = Object.fromEntries(entries.filter(([, v]) => v));
  console.log(`Returned ${Object.keys(result).length}/${symList.length} symbols`);
  return res.status(200).json(result);
};
