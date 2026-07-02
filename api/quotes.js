/**
 * api/quotes.js — Uses Finnhub (free tier, real-time, no IP blocking)
 * Endpoint: /api/quotes?symbols=AAPL,MSFT,SPY,QQQ
 * Set FINNHUB_API_KEY in Vercel Environment Variables.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'FINNHUB_API_KEY env var not set in Vercel' });

  const symList = symbols.split(',').filter(Boolean).slice(0, 25);

  // Fetch all symbols in parallel (60 calls/min on free tier — plenty)
  const entries = await Promise.all(
    symList.map(async (sym) => {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${KEY}`,
          { signal: AbortSignal.timeout(6000) }
        );
        if (!r.ok) return [sym, null];
        const d = await r.json();
        // d.c = current price, d.pc = previous close
        if (!d.c || d.c === 0) return [sym, null];
        return [sym, { p: d.c, pc: d.pc || d.c, name: sym }];
      } catch {
        return [sym, null];
      }
    })
  );

  const result = Object.fromEntries(entries.filter(([, v]) => v !== null));
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
  return res.status(200).json(result);
};
