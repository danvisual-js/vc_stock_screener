/**
 * api/claude.js — Anthropic Claude proxy
 * Handles messages API calls with optional tools (web_search)
 * Used for: price lookups, AI analysis, and other Claude features
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables" });
  }

  try {
    const body = req.body || {};
    // Pass through to Anthropic, merging in our auth
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        // Enable web search beta if tools are requested
        ...(body.tools?.length ? { "anthropic-beta": "web-search-2025-03-05" } : {}),
      },
      body: JSON.stringify({
        model:      body.model      || "claude-sonnet-4-6",
        max_tokens: body.max_tokens || 1000,
        messages:   body.messages   || [],
        ...(body.tools?.length ? { tools: body.tools } : {}),
        ...(body.system ? { system: body.system } : {}),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Anthropic error", details: data });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
