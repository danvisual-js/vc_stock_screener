// ai-proxy.example.js
// ───────────────────────────────────────────────────────────────────
// Minimal backend proxy so the screener's AI features (news /
// recommendations / insights) work on a REAL deployment, where the
// in-preview `window.claude.complete` bridge does not exist.
//
// The browser must never hold your Anthropic API key — this server does.
// Deploy this as a serverless function and point AI_PROXY_URL (top of
// stock_screener2.jsx) at its path, e.g. "/api/claude".
//
// Contract: accepts  POST { prompt: string }
//           returns  { text: string }
//
// Works as-is on Vercel (/api/claude.js) or Netlify (adapt the handler
// signature). Set ANTHROPIC_API_KEY in your hosting env vars.
// ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: "missing prompt" });
      return;
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        // Optional: give the model live data by enabling web search.
        // tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
