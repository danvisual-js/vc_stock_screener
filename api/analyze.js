/**
 * api/analyze.js — AI stock analysis via Claude Sonnet
 * POST /api/analyze  { symbol: string, context: string }
 *
 * Uses claude-sonnet-4-6 (same model as /api/claude — proven to work).
 * Context is built client-side (analyst data + earnings + news).
 * Returns: { movement[], bulls[], bears[], oneLiner, symbol, generatedAt }
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not set",
      fix: "Add ANTHROPIC_API_KEY in Vercel dashboard → Settings → Environment Variables"
    });
  }

  // Vercel parses JSON bodies automatically for application/json content-type.
  // Fallback: read raw body if req.body is unparsed.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { symbol = "STOCK", context = "" } = body;

  if (!context.trim()) {
    return res.status(400).json({ error: "context is required" });
  }

  const prompt =
    `You are a concise financial analyst. Analyze ${symbol} using ONLY the data below — ` +
    `no outside knowledge, no invented numbers.\n\n` +
    `DATA:\n${context}\n\n` +
    `Rules:\n` +
    `- Every bullet must include at least one specific number from the data above.\n` +
    `- No generic phrases like "strong growth potential" or "solid fundamentals".\n` +
    `- Each bullet max 20 words.\n\n` +
    `Return ONLY valid JSON — no markdown, no explanation, no code fences:\n` +
    `{"movement":["why the stock moved — 2-3 specific bullets"],"bulls":["3 bull points with numbers"],"bears":["3 risk points with numbers"],"oneLiner":"one-sentence thesis"}`;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",   // Same model as /api/claude — known to work
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();

    if (!anthropicRes.ok) {
      // Surface the actual Anthropic error to the client for debugging
      const errMsg = anthropicData?.error?.message || JSON.stringify(anthropicData).slice(0, 300);
      console.error(`[analyze] Anthropic ${anthropicRes.status}:`, errMsg);
      return res.status(anthropicRes.status).json({
        error: errMsg,
        anthropic_type: anthropicData?.error?.type,
      });
    }

    const text = (anthropicData.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    // Extract JSON from response (handles any preamble/postamble)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: "AI returned no JSON", raw: text.slice(0, 300) });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      return res.status(500).json({ error: "JSON parse failed", raw: match[0].slice(0, 300) });
    }

    return res.status(200).json({
      ...parsed,
      symbol,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[analyze] fetch error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
