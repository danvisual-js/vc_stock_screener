/**
 * api/yf.js — Generic Yahoo Finance proxy (news, summary, chart)
 * Unlike v7/quote, these endpoints work fine from Vercel servers.
 * Usage: /api/yf?url=https%3A%2F%2Fquery1.finance.yahoo.com%2F...
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const base = `https://${req.headers.host || 'localhost'}`;
  const { searchParams } = new URL(req.url, base);
  const url = searchParams.get('url');

  if (!url) return res.status(400).json({ error: 'url param required' });

  const decoded = decodeURIComponent(url);
  if (!decoded.includes('yahoo.com') && !decoded.includes('yahooapis.com')) {
    return res.status(400).json({ error: 'Only Yahoo Finance URLs allowed' });
  }

  try {
    const r = await fetch(decoded, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(r.status).json({ error: `Yahoo returned ${r.status}` });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
