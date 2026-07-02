/**
 * api/quotes.js — No dependencies, pure Node.js fetch
 * Gets a Yahoo Finance session + crumb first, then fetches quotes.
 * Endpoint: /api/quotes?symbols=AAPL,MSFT,^DJI
 */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function getYFSession() {
  // Step 1: Hit Yahoo Finance to get a session cookie
  const r1 = await fetch('https://finance.yahoo.com/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  const rawCookie = r1.headers.get('set-cookie') || '';
  // Extract cookie key=value pairs (strip attributes like Path, Expires, etc.)
  const cookie = rawCookie
    .split(',')
    .map(part => part.trim().split(';')[0])
    .filter(Boolean)
    .join('; ');

  // Step 2: Get crumb using that cookie
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/csrfToken', {
    headers: {
      'User-Agent': UA,
      Cookie: cookie,
      Referer: 'https://finance.yahoo.com/',
      Accept: 'application/json',
    },
  });
  const txt = await r2.text();
  const match = txt.match(/"csrfToken"\s*:\s*"([^"]+)"/);
  const crumb = match ? match[1] : '';

  return { cookie, crumb };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols param required' });

  try {
    const symList = symbols.split(',').filter(Boolean).slice(0, 25);

    // Get session + crumb
    const { cookie, crumb } = await getYFSession();

    // Fetch quotes with authentication
    const fields = 'regularMarketPrice,regularMarketPreviousClose,shortName,longName';
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symList.join(','))}&fields=${fields}&crumb=${encodeURIComponent(crumb)}`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Cookie: cookie,
        Referer: 'https://finance.yahoo.com/',
        Accept: 'application/json',
      },
    });

    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return res.status(r.status).json({ error: `Yahoo returned ${r.status}`, body });
    }

    const data = await r.json();
    const quotes = data?.quoteResponse?.result || [];

    const result = {};
    quotes.forEach(q => {
      const p  = Number(q.regularMarketPrice)         || 0;
      const pc = Number(q.regularMarketPreviousClose) || p;
      if (p > 0) {
        result[q.symbol] = {
          p,
          pc,
          name: q.shortName || q.longName || q.symbol,
        };
      }
    });

    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(result);

  } catch (err) {
    console.error('quotes error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
