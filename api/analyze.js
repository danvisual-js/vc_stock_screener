/**
 * api/analyze.js — AI stock analysis
 *
 * Supports two providers — set ONE (or both) in Vercel environment variables:
 *
 * Option A — Groq (FREE, recommended for getting started):
 *   GROQ_API_KEY = get a free key at console.groq.com
 *   Free tier: 14,400 requests/day, no credit card required
 *   Model used: llama-3.3-70b-versatile (fast, accurate, free)
 *
 * Option B — Anthropic (pay-as-you-go, ~$0.003/call):
 *   ANTHROPIC_API_KEY = from console.anthropic.com
 *   Requires credits added at console.anthropic.com/billing
 *
 * If both keys are set, Groq is used first (free). Groq has the same
 * quality output for structured JSON tasks at zero cost.
 *
 * POST /api/analyze  { symbol: string, context: string }
 * Returns: { movement[], bulls[], bears[], oneLiner, symbol, generatedAt }
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const GROQ      = process.env.GROQ_API_KEY;
  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;

  if (!GROQ && !ANTHROPIC) {
    return res.status(500).json({
      error: "No AI provider configured. Set GROQ_API_KEY (free) or ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.",
      setup: "Get a free Groq key at console.groq.com — no credit card needed, 14,400 requests/day free."
    });
  }

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
    `You are a concise financial analyst. Analyze ${symbol} using ONLY the data below — no outside knowledge.\n\n` +
    `DATA:\n${context}\n\n` +
    `Rules:\n` +
    `- Every bullet must cite at least one specific number from the data.\n` +
    `- No generic phrases ("strong growth", "solid fundamentals"). Be specific.\n` +
    `- Each bullet max 20 words.\n\n` +
    `Return ONLY valid JSON — no markdown, no code fences:\n` +
    `{"movement":["2-3 bullets: why price moved"],"bulls":["3 bull points"],"bears":["3 risk points"],"oneLiner":"one sentence thesis"}`;

  // ── Try Groq first (free tier, OpenAI-compatible) ──────────────────────────
  if (GROQ) {
    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 600,
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || "{}";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return res.status(200).json({
            ...parsed, symbol,
            provider: "groq",
            generatedAt: new Date().toISOString(),
          });
        }
      } else {
        const errData = await groqRes.json().catch(() => ({}));
        // If Groq fails and we have Anthropic, fall through to Anthropic
        if (!ANTHROPIC) {
          return res.status(groqRes.status).json({
            error: errData.error?.message || `Groq error ${groqRes.status}`,
            provider: "groq",
          });
        }
        console.warn("[analyze] Groq failed, trying Anthropic:", errData.error?.message);
      }
    } catch (groqErr) {
      console.warn("[analyze] Groq error:", groqErr.message);
      if (!ANTHROPIC) {
        return res.status(500).json({ error: groqErr.message, provider: "groq" });
      }
    }
  }

  // ── Try Anthropic (paid) ───────────────────────────────────────────────────
  if (ANTHROPIC) {
    try {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const anthropicData = await anthropicRes.json();

      if (!anthropicRes.ok) {
        const errMsg   = anthropicData?.error?.message || JSON.stringify(anthropicData).slice(0, 200);
        const errType  = anthropicData?.error?.type || "";
        const isCredit = errType === "credit_balance_too_low" || errMsg.toLowerCase().includes("credit balance");
        return res.status(anthropicRes.status).json({
          error: isCredit
            ? "Anthropic API credits required — add credits at console.anthropic.com/billing"
            : errMsg,
          anthropic_type: errType,
          provider: "anthropic",
        });
      }

      const text  = (anthropicData.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: "AI returned no JSON", raw: text.slice(0, 200) });

      const parsed = JSON.parse(match[0]);
      return res.status(200).json({
        ...parsed, symbol,
        provider: "anthropic",
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message, provider: "anthropic" });
    }
  }

  return res.status(500).json({ error: "No provider succeeded" });
};
