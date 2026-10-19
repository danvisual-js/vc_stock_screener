/**
 * api/earnings-week.js — earnings calendar for one Mon-Fri week + how each watchlist
 * stock reacted to its last four reports.
 *
 * Usage: /api/earnings-week?from=2026-10-19&to=2026-10-23&symbols=AAPL,TSLA,...&watch=TSLA,META
 *   symbols  companies to always keep (watchlist + popular list). Other reports are
 *            kept only if their revenue estimate is >= $8B ("big reports").
 *   watch    companies to compute reaction history for (max 10).
 *
 * Source: Finnhub /calendar/earnings (free tier) + Yahoo daily chart for price reactions.
 * Estimates and dates are as published by companies/Finnhub and can change.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getJSON(url, headers, timeout) {
  try {
    const r = await fetch(url, { headers: headers || {}, signal: AbortSignal.timeout(timeout || 7000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
const iso = (d) => d.toISOString().split("T")[0];

function defaultWeek() {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 Sun .. 6 Sat
  const add = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
  const fri = new Date(mon.getTime() + 4 * 864e5);
  return { from: iso(mon), to: iso(fri) };
}

async function reactions(sym, KEY) {
  const today = new Date();
  const from = iso(new Date(today.getTime() - 800 * 864e5));
  const [cal, ch] = await Promise.all([
    getJSON(`https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(sym)}&from=${from}&to=${iso(today)}&token=${KEY}`),
    getJSON(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=2y&interval=1d`,
      { "User-Agent": UA, Accept: "application/json" },
      8000
    ),
  ]);
  const past = ((cal && cal.earningsCalendar) || [])
    .filter((e) => e.date && e.date < iso(today) && e.epsActual != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4);
  const res = ch && ch.chart && ch.chart.result && ch.chart.result[0];
  const q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
  if (!past.length || !res || !q || !q.close) return null;
  const dates = [];
  const closes = [];
  (res.timestamp || []).forEach((t, i) => {
    if (q.close[i] != null) {
      dates.push(iso(new Date(t * 1000)));
      closes.push(q.close[i]);
    }
  });
  const moves = [];
  past.forEach((e) => {
    let i = dates.findIndex((d) => d >= e.date);
    if (i < 1) return;
    let move = null;
    if (e.hour === "bmo") move = closes[i] / closes[i - 1] - 1;
    else if (i + 1 < closes.length) move = closes[i + 1] / closes[i] - 1;
    if (move !== null && isFinite(move)) moves.push({ date: e.date, pct: move * 100 });
  });
  if (!moves.length) return null;
  return {
    moves,
    avgAbsPct: moves.reduce((a, m) => a + Math.abs(m.pct), 0) / moves.length,
    lastPct: moves[0].pct,
    up: moves.filter((m) => m.pct > 0).length,
    n: moves.length,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
  if (req.method === "OPTIONS") return res.status(200).end();
  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: "FINNHUB_API_KEY not set in Vercel env vars" });

  const base = `https://${req.headers.host || "localhost"}`;
  const sp = new URL(req.url, base).searchParams;
  const def = defaultWeek();
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const from = ok(sp.get("from")) ? sp.get("from") : def.from;
  const to = ok(sp.get("to")) ? sp.get("to") : def.to;
  const list = (k) =>
    (sp.get(k) || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z.\-]{1,10}$/.test(s));
  const keep = new Set(list("symbols"));
  const watch = list("watch").slice(0, 10);

  try {
    const cal = await getJSON(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${KEY}`, {}, 9000);
    if (!cal) return res.status(502).json({ error: "Finnhub calendar unavailable" });
    const rows = (cal.earningsCalendar || [])
      .filter((e) => e.symbol && e.date)
      .filter((e) => keep.has(e.symbol.toUpperCase()) || (e.revenueEstimate || 0) >= 8e9)
      .map((e) => ({
        symbol: e.symbol.toUpperCase(),
        date: e.date,
        hour: e.hour || "",
        epsEstimate: e.epsEstimate != null ? e.epsEstimate : null,
        revenueEstimate: e.revenueEstimate != null ? e.revenueEstimate : null,
      }))
      .sort((a, b) => (b.revenueEstimate || 0) - (a.revenueEstimate || 0))
      .slice(0, 150);

    const reporting = new Set(rows.map((r) => r.symbol));
    const targets = watch.filter((s) => reporting.has(s));
    const moves = {};
    const out = await Promise.all(targets.map((s) => reactions(s, KEY).catch(() => null)));
    targets.forEach((s, i) => {
      if (out[i]) moves[s] = out[i];
    });
    return res.status(200).json({ from, to, events: rows, moves });
  } catch (err) {
    return res.status(500).json({ error: err.message || "earnings-week failed" });
  }
};
