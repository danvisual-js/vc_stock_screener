/**
 * api/quotes.js
 * CommonJS serverless function (api/package.json forces CJS mode).
 * Endpoint: /api/quotes?symbols=AAPL,MSFT,^DJI
 */
const yahooFinance = require('yahoo-finance2').default;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  try {
    const symList = symbols.split(',').filter(Boolean).slice(0, 25);
    const quotes  = await yahooFinance.quote(symList, {}, { validateResult: false });
    const items   = Array.isArray(quotes) ? quotes : [quotes];

    const result = {};
    items.forEach(q => {
      if (!q?.symbol) return;
      const p  = Number(q.regularMarketPrice)         || 0;
      const pc = Number(q.regularMarketPreviousClose) || p;
      if (p > 0) result[q.symbol] = { p, pc, name: q.shortName || q.longName || q.symbol };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(result);
  } catch (err) {
    console.error('quotes error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
