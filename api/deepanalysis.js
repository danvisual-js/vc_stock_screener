/**
 * api/deepanalysis.js — AI stock analysis via Claude + Finnhub
 * Fixed: Promise.allSettled, robust JSON extraction, better error messages
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");

  const FINNHUB  = process.env.FINNHUB_API_KEY;
  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;

  if (!FINNHUB)   return res.status(500).json({ error: "FINNHUB_API_KEY not set in Vercel environment variables" });
  if (!ANTHROPIC) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables" });

  const { symbol = "" } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol required" });
  const SYM = symbol.toUpperCase();

  try {
    const today   = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split("T")[0];

    const fh = (path) =>
      fetch(`https://finnhub.io/api/v1${path}&token=${FINNHUB}`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);

    // Parallel Finnhub fetches — allSettled so partial data still works
    const [mR, nR, eR, rR, tR] = await Promise.allSettled([
      fh(`/stock/metric?symbol=${SYM}&metric=all`),
      fh(`/company-news?symbol=${SYM}&from=${weekAgo}&to=${today}`),
      fh(`/stock/earnings?symbol=${SYM}&limit=4`),
      fh(`/stock/recommendation?symbol=${SYM}`),
      fh(`/stock/price-target?symbol=${SYM}`),
    ]);

    const m  = mR.status === "fulfilled" ? (mR.value?.metric || {}) : {};
    const news = nR.status === "fulfilled" ? (nR.value || []).slice(0, 5) : [];
    const earnings = eR.status === "fulfilled" ? (eR.value || []).slice(0, 4) : [];
    const rec = rR.status === "fulfilled" && Array.isArray(rR.value) && rR.value.length ? rR.value[0] : {};
    const tgt = tR.status === "fulfilled" ? (tR.value || {}) : {};

    const totalAna = (rec.strongBuy||0)+(rec.buy||0)+(rec.hold||0)+(rec.sell||0)+(rec.strongSell||0);
    const net = totalAna ? ((rec.strongBuy||0)*2+(rec.buy||0)-(rec.sell||0)-(rec.strongSell||0)*2)/totalAna : 0;
    const consensus = net>0.6?"Strong Buy":net>0.15?"Buy":net>-0.15?"Hold":net>-0.6?"Underperform":"Sell";

    const earningsText = earnings.length
      ? earnings.map(q=>`  Q${q.quarter||"?"} ${q.year||""}: ${q.actual!=null&&q.estimate!=null?(q.actual>=q.estimate?"BEAT":"MISS"):"N/A"}${q.surprisePercent!=null?` (${q.surprisePercent>0?"+":""}${q.surprisePercent.toFixed(1)}%)`:""}  EPS $${q.actual??"-"} vs Est $${q.estimate??"-"}`).join("\n")
      : "  Earnings data unavailable";

    const beatCount = earnings.filter(q=>q.actual!=null&&q.estimate!=null&&q.actual>=q.estimate).length;

    const newsText = news.length
      ? news.map((n,i)=>`  ${i+1}. ${n.headline||n.title||""}`.slice(0,120)).join("\n")
      : "  No recent news available";

    const fmt = (v, suf="") => v != null ? v.toFixed(2) + suf : "N/A";

    const context = `
STOCK: ${SYM}

PRICE PERFORMANCE:
  13-week return: ${fmt(m["13WeekPriceReturnDaily"],"%")}
  26-week return: ${fmt(m["26WeekPriceReturnDaily"],"%")}
  52-week return: ${fmt(m["52WeekPriceReturnDaily"],"%")}
  52-week range:  $${m["52WeekLow"]??"-"} – $${m["52WeekHigh"]??"-"}
  Beta: ${fmt(m.beta)}

ANALYST CONSENSUS:
  Rating: ${consensus} (${totalAna} analysts)
  Price target: Avg $${fmt(tgt.targetMean)}, High $${tgt.targetHigh??"-"}, Low $${tgt.targetLow??"-"}
  Breakdown: StrongBuy ${rec.strongBuy||0} · Buy ${rec.buy||0} · Hold ${rec.hold||0} · Sell ${rec.sell||0} · StrongSell ${rec.strongSell||0}

EARNINGS (${beatCount}/${earnings.length} beats):
${earningsText}

FUNDAMENTALS:
  Forward P/E: ${fmt(m.peTTM,"x")}
  Gross Margin: ${m.grossMarginAnnual != null ? (m.grossMarginAnnual).toFixed(1)+"%" : "N/A"}
  Rev Growth YoY: ${m.revenueGrowthQuarterlyYoy != null ? (m.revenueGrowthQuarterlyYoy*100).toFixed(1)+"%" : "N/A"}
  ROE: ${m.roeTTM != null ? (m.roeTTM*100).toFixed(1)+"%" : "N/A"}

RECENT NEWS:
${newsText}`.trim();

    // Call Claude
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: `Analyze ${SYM} using ONLY this data. Rules: every bullet must cite a specific number from the data; no generic phrases; each bullet max 20 words.\n\n${context}\n\nReturn ONLY valid JSON (no markdown, no code fences):\n{"movement":["bullet1","bullet2","bullet3"],"bulls":["bull1","bull2","bull3"],"bears":["bear1","bear2","bear3"],"oneLiner":"one sentence thesis"}`
        }]
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text().catch(()=>"");
      return res.status(500).json({ error: `Claude API error ${aiRes.status}: ${errTxt.slice(0,200)}` });
    }

    const aiData = await aiRes.json();
    const rawText = (aiData.content || []).filter(b=>b.type==="text").map(b=>b.text).join("") || "";

    // Robust JSON extraction — handles code fences and extra text
    let parsed;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "AI returned no JSON", raw: rawText.slice(0,300) });
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch { return res.status(500).json({ error: "Could not parse AI JSON", raw: rawText.slice(0,300) }); }

    return res.status(200).json({ ...parsed, symbol: SYM, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("deepanalysis error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
};
