/**
 * api/news.js — Market + company news via Finnhub (free tier)
 * General market:  /api/news
 * Company news:    /api/news?symbol=AAPL
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: "FINNHUB_API_KEY not set" });

  const base = `https://${req.headers.host || "localhost"}`;
  const { searchParams } = new URL(req.url, base);
  const symbol = searchParams.get("symbol");

  try {
    let url;
    if (symbol) {
      const today    = new Date().toISOString().split("T")[0];
      const weekAgo  = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];
      url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${weekAgo}&to=${today}&token=${KEY}`;
    } else {
      url = `https://finnhub.io/api/v1/news?category=general&minId=0&token=${KEY}`;
    }

    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(r.status).json({ error: `Finnhub ${r.status}` });

    const data = await r.json();
    const articles = (Array.isArray(data) ? data : []).slice(0, 8).map(n => ({
      title:     n.headline,
      link:      n.url,
      publisher: n.source,
      providerPublishTime: n.datetime,
    }));

    return res.status(200).json(articles);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
