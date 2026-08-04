/**
 * api/daily-report.js — Daily AI stock brief via email (Vercel Cron)
 *
 * Setup:
 *  1. Add to vercel.json:  "crons": [{"path":"/api/daily-report","schedule":"0 13 * * 1-5"}]
 *     (runs 9 AM ET Mon-Fri = 13:00 UTC)
 *  2. Set env vars in Vercel dashboard:
 *     ANTHROPIC_API_KEY  — your Anthropic key
 *     FINNHUB_API_KEY    — your Finnhub key
 *     RESEND_API_KEY     — from resend.com (free: 3000 emails/month)
 *     REPORT_FROM_EMAIL  — e.g. "screener@yourdomain.com"
 *     REPORT_TO_EMAIL    — where to send (your email)
 *     WATCHLIST          — comma-separated symbols e.g. "AAPL,NVDA,MSFT,GOOGL"
 */
module.exports = async function handler(req, res) {
  // Vercel cron sends GET requests; protect against accidental public calls
  const isCron  = req.headers["x-vercel-cron"] === "1";
  const isLocal  = process.env.NODE_ENV === "development";
  if (!isCron && !isLocal && req.method !== "POST")
    return res.status(401).json({ error: "Cron only" });

  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  const FINNHUB   = process.env.FINNHUB_API_KEY;
  const RESEND    = process.env.RESEND_API_KEY;
  const TO        = process.env.REPORT_TO_EMAIL;
  const FROM      = process.env.REPORT_FROM_EMAIL || "onboarding@resend.dev";
  const symbols   = (process.env.WATCHLIST || "SPY,QQQ,AAPL,NVDA,MSFT").split(",").map(s => s.trim());

  if (!ANTHROPIC || !FINNHUB) return res.status(500).json({ error: "Missing API keys" });

  try {
    // 1. Fetch prices for all symbols
    const pricePromises = symbols.map(async sym => {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB}`).catch(() => null);
      const d = r?.ok ? await r.json() : null;
      return d ? { sym, p: d.c, pc: d.pc, ch: ((d.c - d.pc) / d.pc * 100).toFixed(2) } : { sym, p: 0, pc: 0, ch: "0" };
    });
    const prices = await Promise.all(pricePromises);

    // 2. Fetch top news headlines
    const newsRes = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB}`).catch(() => null);
    const news = newsRes?.ok ? (await newsRes.json()).slice(0, 5).map(n => n.headline).join("\n") : "No news";

    // 3. Build context for Claude
    const priceTable = prices.map(p => `${p.sym}: $${p.p} (${p.ch > 0 ? "+" : ""}${p.ch}%)`).join("\n");
    const movers = prices.sort((a, b) => Math.abs(+b.ch) - Math.abs(+a.ch)).slice(0, 3);

    const context = `Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

WATCHLIST PRICES:
${priceTable}

TOP MOVERS: ${movers.map(m => `${m.sym} ${m.ch > 0 ? "+" : ""}${m.ch}%`).join(", ")}

MARKET NEWS:
${news}`;

    // 4. Call Claude Haiku for daily summary
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `You are a concise financial analyst writing a daily morning brief. Use ONLY the data below.\n\n${context}\n\nWrite a professional 3-section daily brief:\n1. MARKET OVERVIEW (2 sentences, cite specific % moves)\n2. WATCHLIST HIGHLIGHTS (3 bullets with specific numbers)\n3. WHAT TO WATCH TODAY (2 bullets)\n\nBe specific, data-driven, and under 200 words total.`
        }]
      }),
    });

    const aiData = await aiRes.json();
    const brief = aiData.content?.[0]?.text || "Brief generation failed.";

    // 5. Send email via Resend (https://resend.com — free tier)
    if (RESEND && TO) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND}` },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          subject: `📊 Daily Market Brief — ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
          html: `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
            <div style="background:#08090E;padding:20px 24px;border-radius:12px;margin-bottom:16px">
              <h1 style="color:#F1F5F9;margin:0;font-size:18px">AI Market Screener</h1>
              <p style="color:#64748B;margin:4px 0 0;font-size:12px">Daily Brief · ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            </div>
            <div style="background:white;border-radius:12px;padding:20px 24px;margin-bottom:16px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#1C1C1E">${brief}</div>
            <div style="background:white;border-radius:12px;padding:16px 24px;margin-bottom:16px">
              <h3 style="margin:0 0 12px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.06em">Watchlist Snapshot</h3>
              ${prices.map(p => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                <span style="font-weight:700;font-family:monospace">${p.sym}</span>
                <span>$${p.p}</span>
                <span style="color:${+p.ch >= 0 ? "#00B386" : "#E74C3C"};font-weight:700">${+p.ch >= 0 ? "+" : ""}${p.ch}%</span>
              </div>`).join("")}
            </div>
            <p style="font-size:11px;color:#94A3B8;text-align:center">AI Market Screener · Not financial advice · <a href="https://vc-stockscreen-ivory.vercel.app" style="color:#6366F1">Open App</a></p>
          </body></html>`
        }),
      });
    }

    return res.status(200).json({ ok: true, sentTo: TO || "no email configured", previewBrief: brief.slice(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
