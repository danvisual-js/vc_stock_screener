/**
 * api/claude.js — Anthropic proxy for the in-app AI analysis (locked down).
 * It used to forward any request to your Anthropic key. Now it:
 *   - only answers requests from your own site / apps (see _access.js, env ALLOWED_ORIGINS),
 *   - counts each call against the caller's daily tier allowance (AI_LIMITS, default 5 / 30 / 100),
 *   - only allows approved models, caps output size, and only the web_search tool.
 */
const db = require("./_db");
const access = require("./_access");

const MODELS = (process.env.CLAUDE_ALLOWED_MODELS || "claude-sonnet-4-6,claude-haiku-4-5").split(",").map((x) => x.trim());
const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS) || 1500;

module.exports = async function handler(req, res) {
  const allowed = access.cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(allowed ? 200 : 403).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!allowed) return res.status(403).json({ error: "Not allowed from this site." });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  if (JSON.stringify(body).length > 30000) return res.status(413).json({ error: "Request too large." });
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-6) : [];
  if (!msgs.length) return res.status(400).json({ error: "No messages." });

  const day = new Date().toISOString().slice(0, 10);
  if (!(await db.limit("rl:ai:global:" + day, Number(process.env.AI_DAILY_CAP) || 800, 86400))) {
    return res.status(429).json({ error: "AI analysis is at capacity today. Please try again tomorrow." });
  }
  // price lookups and analysis share one allowance; each call counts once
  const plan = await access.charge(req, "ai", 4);
  if (!plan.ok) return res.status(429).json({ error: plan.reason, tier: plan.tier });

  const model = MODELS.includes(body.model) ? body.model : MODELS[0];
  const wantsSearch = Array.isArray(body.tools) && body.tools.some((t) => t && t.name === "web_search");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS),
        messages: msgs,
        ...(body.system ? { system: String(body.system).slice(0, 6000) } : {}),
        ...(wantsSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }] } : {}),
      }),
      signal: AbortSignal.timeout(55000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: (data.error && data.error.message) || "Anthropic error" });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.name === "TimeoutError" ? "That took too long." : err.message });
  }
};
