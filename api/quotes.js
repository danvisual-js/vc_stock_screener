/**
 * api/quotes.js — Finnhub, no caching, WHATWG URL parsing
 * Set FINNHUB_API_KEY in Vercel → Settings → Environment Variables
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Never cache — prices must be fresh on every request
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Use WHATWG URL API (avoids the url.parse deprecation warning)
  const base = `https://${req.headers.host || 'localhost'}`;
  const { searchParams } = new URL(req.url, base);
  const symbols = searchParams.get('symbols');

  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY not set in Vercel env vars' });

  const symList = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 25);

  // Fetch all in parallel — 60 calls/min on free tier
  const entries = await Promise.all(
    symList.map(async (sym) => {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`,
          { signal: AbortSignal.timeout(7000) }
        );
        if (!r.ok) {
          console.error(`Finnhub ${r.status} for ${sym}`);
          return [sym, null];
        }
        const d = await r.json();
        // d.c = current price, d.pc = previous close
        // Finnhub returns 0 for unknown/delisted symbols
        if (!d || typeof d.c !== 'number' || d.c === 0) {
          console.warn(`No price data for ${sym}:`, JSON.stringify(d));
          return [sym, null];
        }
        return [sym, { p: d.c, pc: d.pc || d.c, name: sym }];
      } catch (err) {
        console.error(`Fetch error for ${sym}:`, err.message);
        return [sym, null];
      }
    })
  );

  const result = Object.fromEntries(entries.filter(([, v]) => v !== null));
  console.log(`Returned ${Object.keys(result).length}/${symList.length} symbols`);
  return res.status(200).json(result);
};
