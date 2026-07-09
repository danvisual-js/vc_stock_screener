/**
 * api/events.js — Live earnings calendar via Finnhub
 * Returns upcoming earnings for the next 45 days
 * Usage: /api/events  or  /api/events?symbols=AAPL,MSFT,NVDA
 */
module.exports = async function handler(req, res) {
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

    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return res.status(r.status).json({ error: `Finnhub ${r.status}` });

    const data = await r.json();
    let events = (data.earningsCalendar || []);

    // Filter to watchlist symbols when provided
    const watchlist = symbolsParam
      ? symbolsParam.split(",").map(s => s.trim().toUpperCase())
      : [];

    if (watchlist.length) {
      events = events.filter(e => watchlist.includes((e.symbol || "").toUpperCase()));
    }

    // Format for the UI
    const formatted = events.slice(0, 20).map(e => {
      const d = new Date(e.date + "T00:00:00");
      const mon = d.toLocaleString("en-US", { month: "short" });
      const day = d.getDate();
      return {
        s:    e.symbol,
        date: `${mon} ${day}`,
        when: e.hour === "amc" ? "AMC" : e.hour === "bmo" ? "BMO" : "TBD",
        epsEstimate: e.epsEstimate,
      };
    });

    return res.status(200).json(formatted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
