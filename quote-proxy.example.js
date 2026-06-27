// quote-proxy.example.js
// ───────────────────────────────────────────────────────────────────
// OPTIONAL server-side quote proxy for the stock screener.
//
// WHY: Twelve Data's free tier allows only 8 credits/MINUTE and each
// symbol costs 1 credit. That budget is PER KEY — so on a deployed site
// it is shared across ALL your visitors. Two people loading a full tab
// at once will blow the limit and see stale/missing prices, even though
// the client already paces its own requests.
//
// This proxy fixes that by giving every visitor a SHARED 10-second
// server-side cache: the first request for a symbol spends a credit, and
// everyone else within 10s is served from memory for free. It also keeps
// your Twelve Data key off the client entirely.
//
// DEPLOY (Vercel): drop this at /api/quote.js, set TWELVE_DATA_KEY in env
// vars, then in stock_screener2.jsx change fetchQuotes/_rawQuotes to call
// `/api/quote?symbol=...` instead of api.twelvedata.com directly.
//
// Contract: GET /api/quote?symbol=AAPL,MSFT  ->  { "AAPL": {p,pc}, ... }
// ───────────────────────────────────────────────────────────────────

const CACHE = new Map(); // SYM -> { t, q:{p,pc} }
const TTL = 10000;

export default async function handler(req, res) {
  const symbols = String(req.query.symbol || "")
    .split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) { res.status(400).json({ error: "no symbol" }); return; }

  const out = {};
  const need = [];
  const now = Date.now();
  for (const s of symbols) {
    const c = CACHE.get(s);
    if (c && now - c.t < TTL) out[s] = c.q;
    else need.push(s);
  }

  if (need.length) {
    try {
      const r = await fetch(
        `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(need.join(","))}&apikey=${process.env.TWELVE_DATA_KEY}`
      );
      const d = await r.json();
      const rows = need.length === 1 ? { [need[0]]: d } : d;
      for (const s of need) {
        const row = rows && rows[s];
        const p = parseFloat(row && row.close);
        if (p > 0) {
          const pc = parseFloat(row.previous_close);
          const q = { p, pc: pc > 0 ? pc : p };
          out[s] = q;
          CACHE.set(s, { t: Date.now(), q });
        }
      }
    } catch (e) { /* leave missing symbols out; client keeps prior value */ }
  }

  // small CDN cache too, so bursts collapse to one origin hit
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
  res.status(200).json(out);
}
