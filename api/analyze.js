/**
 * api/analyze.js — Simple AI stock analysis via Claude Haiku
 * Called client-side with pre-built context (no separate data fetching).
 * Uses Haiku: fast (~3s), cheap, sufficient for structured bullet analysis.
 * Usage: POST /api/analyze  { symbol, context }
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "POST only" });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables" });

  const { symbol = "STOCK", context = "" } = req.body || {};

  const prompt =
    `Analyze ${symbol} using ONLY this data (no outside knowledge):\n\n${context}\n\n` +
    `Rules: every bullet must cite a specific number from the data. Max 18 words per bullet.\n` +
    `Return ONLY valid JSON (no markdown):\n` +
    `{"movement":["why price moved — 2-3 bullets"],"bulls":["3 data-backed bull points"],"bears":["3 data-backed risk points"],"oneLiner":"one sentence investment thesis"}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",  // Fast + cheap for structured output
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "Anthropic error", details: data });

    const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No JSON in response", raw: txt.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    return res.status(200).json({ ...parsed, symbol, generatedAt: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
