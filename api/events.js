/**
 * api/events.js — Live earnings calendar + EPS/revenue estimates via Finnhub
 * Usage: /api/events?symbols=AAPL,MSFT,NVDA
 */
const earningsHistory = require("./_earnings");

module.exports = async function handler(req, res) {
  // /api/events?kind=history&symbol=AAPL  -> per-stock earnings history (was /api/earnings; merged to stay within 12 functions)
  if (/[?&]kind=history\b/.test(req.url || "")) return earningsHistory(req, res);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: "FINNHUB_API_KEY not set" });

  const base = `https://${req.headers.host || "localhost"}`;
  const { searchParams } = new URL(req.url, base);
  const symbolsParam = searchParams.get("symbols") || "";

  try {
    const today = new Date();
    const from  = today.toISOString().split("T")[0];
    const to    = new Date(today.getTime() + 45 * 864e5).toISOString().split("T")[0];

    const watchlist = symbolsParam
      ? symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    // Fetch earnings calendar
    const calRes = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!calRes.ok) return res.status(calRes.status).json({ error: `Finnhub ${calRes.status}` });
    const calData = await calRes.json();

    let events = calData.earningsCalendar || [];
    if (watchlist.length) {
      events = events.filter(e => watchlist.includes((e.symbol || "").toUpperCase()));
    }

    // For each event in watchlist, fetch earnings estimates (surprise history)
    const enriched = await Promise.all(
      events.slice(0, 12).map(async e => {
        const sym = e.symbol;
        const d   = new Date(e.date + "T00:00:00");
        const mon = d.toLocaleString("en-US", { month: "short" });
        const day = d.getDate();

        // Try to get earnings history for beat/miss % and last actual
        let epsEst    = e.epsEstimate ?? null;
        let epsActual = e.epsActual   ?? null;  // null for future events
        let revEst    = e.revenueEstimate ?? null;
        let lastEPS   = null;
        let beatRate  = null;

        try {
          const histRes = await fetch(
            `https://finnhub.io/api/v1/stock/earnings?symbol=${sym}&limit=5&token=${KEY}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (histRes.ok) {
            const hist = await histRes.json();
            if (Array.isArray(hist) && hist.length > 0) {
              lastEPS = hist[0].actual ?? null;   // most recent quarter actual
              // Beat rate: how many of last 4 quarters beat estimate
              const last4 = hist.slice(0, 4).filter(q => q.estimate != null && q.actual != null);
              const beats  = last4.filter(q => q.actual >= q.estimate).length;
              beatRate = last4.length > 0 ? Math.round((beats / last4.length) * 100) : null;
            }
          }
        } catch {}

        return {
          s:      sym,
          date:   `${mon} ${day}`,
          when:   e.hour === "amc" ? "AMC" : e.hour === "bmo" ? "BMO" : "TBD",
          epsEst:    epsEst    != null ? +epsEst.toFixed(2)    : null,
          epsActual: epsActual != null ? +epsActual.toFixed(2) : null,
          revEst:    revEst    != null ? +(revEst / 1e9).toFixed(2) : null, // billions
          lastEPS:   lastEPS   != null ? +lastEPS.toFixed(2)   : null,
          beatRate,
        };
      })
    );

    return res.status(200).json(enriched);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
