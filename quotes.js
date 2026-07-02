/**
 * api/quotes.js  —  Vercel Serverless Function
 *
 * Proxies any Yahoo Finance URL server-side so the browser
 * never has to deal with CORS. Called by the frontend as:
 *   /api/quotes?url=https%3A%2F%2Fquery1.finance.yahoo.com%2F...
 */
export default async function handler(req, res) {
  // Allow all origins (it's public market data)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param required" });

  try {
    const upstream = await fetch(decodeURIComponent(url), {
      headers: {
        // Mimic a real browser request — Yahoo blocks bare Node requests
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://finance.yahoo.com/",
        Origin: "https://finance.yahoo.com",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Yahoo Finance returned " + upstream.status });
    }

    const data = await upstream.json();
    // Cache for 15 seconds — real-time enough for a screener
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
    res.status(200).json(data);
  } catch (err) {
    console.error("Quote proxy error:", err.message);
    res.status(500).json({ error: "Proxy fetch failed" });
  }
}
