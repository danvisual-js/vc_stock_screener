/**
 * api/deepanalysis.js — AI stock analysis via Claude + Finnhub data
 * Generates: "Why it moved", Bull case, Bear case — grounded in real numbers
 * Usage: GET /api/deepanalysis?symbol=NVDA
 * Cached 12 hours (analyses don't need to refresh every visit)
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");

  const FINNHUB = process.env.FINNHUB_API_KEY;
  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  if (!FINNHUB || !ANTHROPIC)
    return res.status(500).json({ error: "Missing API keys" });

  const base = `https://${req.headers.host || "localhost"}`;
  const { searchParams } = new URL(req.url, base);
  const symbol = (searchParams.get("symbol") || "").toUpperCase();
  if (!symbol) return res.status(400).json({ error: "symbol required" });

  try {
    const today   = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];

    // ── Fetch all data in parallel ────────────────────────────────────────
    const [metricsRes, newsRes, earningsRes, recRes, targetRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB}`,       { signal: AbortSignal.timeout(6000) }),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${weekAgo}&to=${today}&token=${FINNHUB}`, { signal: AbortSignal.timeout(6000) }),
      fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=4&token=${FINNHUB}`,         { signal: AbortSignal.timeout(6000) }),
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FINNHUB}`,           { signal: AbortSignal.timeout(6000) }),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${FINNHUB}`,             { signal: AbortSignal.timeout(6000) }),
    ]);

    const [metrics, news, earnings, recs, target] = await Promise.all([
      metricsRes.ok  ? metricsRes.json()   : {},
      newsRes.ok     ? newsRes.json()       : [],
      earningsRes.ok ? earningsRes.json()   : [],
      recRes.ok      ? recRes.json()        : [],
      targetRes.ok   ? targetRes.json()     : {},
    ]);

    const m  = metrics?.metric || {};
    const r  = Array.isArray(recs) && recs.length ? recs[0] : {};
    const t  = target || {};

    // ── Build analyst consensus label ─────────────────────────────────────
    const totalAna = (r.strongBuy||0)+(r.buy||0)+(r.hold||0)+(r.sell||0)+(r.strongSell||0);
    const netScore = totalAna ? ((r.strongBuy||0)*2+(r.buy||0)-(r.sell||0)-(r.strongSell||0)*2)/totalAna : 0;
    const consensus = netScore>0.6?"Strong Buy":netScore>0.15?"Buy":netScore>-0.15?"Hold":netScore>-0.6?"Underperform":"Sell";

    // ── Build earnings summary ─────────────────────────────────────────────
    const earningsLines = (Array.isArray(earnings)?earnings:[]).slice(0,4).map(q=>{
      const beat = q.actual!=null&&q.estimate!=null ? (q.actual>=q.estimate?"BEAT":"MISS") : "N/A";
      const surp = q.surprisePercent!=null ? ` (${q.surprisePercent>0?"+":""}${q.surprisePercent.toFixed(1)}%)` : "";
      return `  Q${q.quarter||"?"} ${q.year||""}: ${beat}${surp} — Actual EPS $${q.actual??"-"} vs Est $${q.estimate??"-"}`;
    }).join("\n") || "  No earnings data available";

    const beatCount = (Array.isArray(earnings)?earnings:[]).slice(0,4)
      .filter(q=>q.actual!=null&&q.estimate!=null&&q.actual>=q.estimate).length;

    // ── Build news summary ────────────────────────────────────────────────
    const newsLines = (Array.isArray(news)?news:[]).slice(0,5)
      .map((n,i)=>`  ${i+1}. ${n.headline||n.title||""}`)
      .join("\n") || "  No recent news";

    // ── Assemble context ──────────────────────────────────────────────────
    const context = `
STOCK: ${symbol}

PRICE PERFORMANCE:
  13-week return:  ${m["13WeekPriceReturnDaily"]!=null ? m["13WeekPriceReturnDaily"].toFixed(1)+"%" : "N/A"}
  26-week return:  ${m["26WeekPriceReturnDaily"]!=null ? m["26WeekPriceReturnDaily"].toFixed(1)+"%" : "N/A"}
  52-week return:  ${m["52WeekPriceReturnDaily"]!=null ? m["52WeekPriceReturnDaily"].toFixed(1)+"%" : "N/A"}
  52-week range:   $${m["52WeekLow"]??"-"} – $${m["52WeekHigh"]??"-"}
  Beta:            ${m.beta!=null ? m.beta.toFixed(2) : "N/A"}

ANALYST CONSENSUS:
  Rating:          ${consensus} (${totalAna} analysts)
  Price target:    Avg $${t.targetMean!=null?t.targetMean.toFixed(2):"-"}, High $${t.targetHigh??"-"}, Low $${t.targetLow??"-"}
  Distribution:    StrongBuy ${r.strongBuy||0} · Buy ${r.buy||0} · Hold ${r.hold||0} · Sell ${r.sell||0} · StrongSell ${r.strongSell||0}

EARNINGS HISTORY (last 4 quarters, ${beatCount}/4 beats):
${earningsLines}

FUNDAMENTALS:
  Forward P/E:        ${m.peTTM!=null ? m.peTTM.toFixed(1)+"x" : "N/A"}
  Price/Book:         ${m.pbQuarterly!=null ? m.pbQuarterly.toFixed(2)+"x" : "N/A"}
  Revenue Growth QoQ: ${m.revenueGrowthQuarterlyYoy!=null ? (m.revenueGrowthQuarterlyYoy*100).toFixed(1)+"%" : "N/A"}
  Gross Margin:       ${m.grossMarginAnnual!=null ? m.grossMarginAnnual.toFixed(1)+"%" : "N/A"}
  Return on Equity:   ${m.roeTTM!=null ? (m.roeTTM*100).toFixed(1)+"%" : "N/A"}

RECENT NEWS (last 7 days):
${newsLines}
`.trim();

    // ── Call Claude ───────────────────────────────────────────────────────
    const prompt = `You are a concise financial analyst. Analyze ${symbol} using ONLY the data below — no outside knowledge.

Rules:
- Every bullet MUST include at least one specific number from the data
- No generic statements ("strong growth potential", "solid fundamentals") — be specific
- Keep each bullet under 20 words
- Be honest about risks in the bear case

${context}

Return ONLY valid JSON (no markdown, no explanation):
{
  "movement": ["<2-3 bullets: WHY the stock performed as it did — cite specific returns, earnings beats/misses, analyst moves>"],
  "bulls": ["<3 bullets: specific data-backed reasons to be optimistic>"],
  "bears": ["<3 bullets: specific risks using valuation, beta, news, or earnings data>"],
  "oneLiner": "<one sentence summary of the investment thesis>"
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
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
      signal: AbortSignal.timeout(20000),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      return res.status(500).json({ error: `Claude error: ${err.slice(0,200)}` });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || "{}";
    // Strip possible markdown fences
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({
      ...parsed,
      symbol,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
