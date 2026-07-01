/**
 * /pages/api/claude.js
 * Proxies all Anthropic API calls server-side so the API key
 * never ships to the client. Set ANTHROPIC_API_KEY in Vercel
 * Environment Variables (Settings → Environment Variables).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
        // Required for the web_search tool
        "anthropic-beta":  "web-search-2025-03-05",
      },
      body: JSON.stringify(req.body),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    res.status(500).json({ error: "Upstream API error" });
  }
}
