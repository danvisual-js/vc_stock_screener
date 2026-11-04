/**
 * api/test-ai.js — Diagnostic endpoint
 * Visit: https://your-app.vercel.app/api/test-ai
 * Shows exactly what's happening with your AI provider keys
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const GROQ      = process.env.GROQ_API_KEY;
  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;

  const results = {
    env: {
      GROQ_API_KEY:      GROQ      ? `set (${GROQ.slice(0,8)}...)` : "NOT SET",
      ANTHROPIC_API_KEY: ANTHROPIC ? `set (${ANTHROPIC.slice(0,10)}...)` : "NOT SET",
    },
    tests: {}
  };

  // Test Groq
  if (GROQ) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: 'Say "Groq works!" and nothing else.' }],
          max_tokens: 20,
        }),
      });
      const d = await r.json();
      results.tests.groq = r.ok
        ? { status: "✅ Working", response: d.choices?.[0]?.message?.content }
        : { status: "❌ Failed", error: d.error?.message, code: r.status };
    } catch (e) {
      results.tests.groq = { status: "❌ Error", error: e.message };
    }
  } else {
    results.tests.groq = { status: "⚠️ Not configured", tip: "Get free key at console.groq.com" };
  }

  // Test Anthropic
  if (ANTHROPIC) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 20,
          messages: [{ role: "user", content: 'Say "Anthropic works!" and nothing else.' }],
        }),
      });
      const d = await r.json();
      results.tests.anthropic = r.ok
        ? { status: "✅ Working", response: d.content?.[0]?.text }
        : { status: "❌ Failed", error: d.error?.message, type: d.error?.type, http: r.status };
    } catch (e) {
      results.tests.anthropic = { status: "❌ Error", error: e.message };
    }
  } else {
    results.tests.anthropic = { status: "⚠️ Not configured" };
  }

  results.recommendation = !GROQ && !ANTHROPIC
    ? "Set at least one key in Vercel → Settings → Environment Variables"
    : results.tests.groq?.status?.includes("✅")
    ? "Groq is working — AI analysis should work fine"
    : results.tests.anthropic?.status?.includes("✅")
    ? "Anthropic is working — AI analysis should work fine"
    : "Both providers have issues — check errors above";

  return res.status(200).json(results);
};
