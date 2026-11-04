/**
 * api/fundamentals.js — batch fundamentals + technicals for health badges & playbooks
 *
 * Usage:
 *   /api/fundamentals?symbols=AAPL,MSFT,NVDA          (max 12 symbols per call)
 *   add &lite=1  to skip analyst/earnings calls (used by playbook scans)
 *   add &debug=1 to also return which Finnhub metric keys were found
 *
 * Sources
 *   Finnhub  /stock/metric, /stock/recommendation, /stock/earnings   (free tier)
 *   Yahoo    v8 chart (3 months of daily bars) -> price, RSI, volume, 20-day high
 *
 * Every field is optional. Anything the sources don't return comes back as null
 * and the client treats it as "no data" rather than guessing.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const first = (m, keys) => {
  for (const k of keys) {
    const v = num(m[k]);
    if (v !== null) return v;
  }
  return null;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, headers, timeout) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout || 6000) });
      if (r.status === 429 && attempt === 0) {
        await sleep(1200);
        continue;
      }
      if (!r.ok) return null;
      return await r.json();
    } catch {
      if (attempt === 1) return null;
    }
  }
  return null;
}

/* RSI(14), Wilder smoothing */
function rsi14(closes) {
  if (closes.length < 16) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= 14; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let ag = gain / 14,
    al = loss / 14;
  for (let i = 15; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * 13 + (d > 0 ? d : 0)) / 14;
    al = (al * 13 + (d < 0 ? -d : 0)) / 14;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

async function technicals(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym
  )}?range=3mo&interval=1d&includePrePost=false`;
  const d = await getJSON(url, { "User-Agent": UA, Accept: "application/json" }, 6500);
  const res = d && d.chart && d.chart.result && d.chart.result[0];
  if (!res) return null;
  const q = res.indicators && res.indicators.quote && res.indicators.quote[0];
  if (!q || !q.close) return null;
  const ts = res.timestamp || [];
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close[i] != null) {
      rows.push({
        t: ts[i],
        c: q.close[i],
        h: q.high && q.high[i] != null ? q.high[i] : q.close[i],
        v: q.volume && q.volume[i] != null ? q.volume[i] : null,
      });
    }
  }
  if (rows.length < 16) return null;

  const meta = res.meta || {};
  const last = rows[rows.length - 1];
  const price = num(meta.regularMarketPrice) !== null ? meta.regularMarketPrice : last.c;
  const prevClose =
    rows.length >= 2 ? rows[rows.length - 2].c : num(meta.chartPreviousClose) !== null ? meta.chartPreviousClose : null;

  // Is the last bar a session still in progress? (US market, New York time)
  let partial = false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    const mins = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
    const wk = get("weekday");
    partial = wk !== "Sat" && wk !== "Sun" && mins >= 570 && mins < 970;
  } catch {}

  const closes = rows.map((r) => r.c);
  // Prior 20 sessions (excluding the latest bar) for average volume & breakout level
  const prior = rows.slice(-21, -1);
  const vols = prior.map((r) => r.v).filter((v) => v != null && v > 0);
  const avgVol20 = vols.length >= 10 ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const highs20 = prior.map((r) => r.h);
  const high20 = highs20.length ? Math.max.apply(null, highs20) : null;

  return {
    price,
    prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    rsi: rsi14(closes),
    volume: last.v,
    avgVol20,
    relVol: avgVol20 && last.v != null ? last.v / avgVol20 : null,
    volumePartial: partial,
    high20,
    atHigh20: high20 ? price >= high20 * 0.998 : null,
    avgDollarVol20: avgVol20 ? avgVol20 * price : null,
  };
}

/* Analyst rating drift: net score now vs ~3 months ago (-2..+2 scale) */
function ratingDrift(recs) {
  if (!Array.isArray(recs) || recs.length < 2) return null;
  const score = (r) => {
    const n = (r.strongBuy || 0) + (r.buy || 0) + (r.hold || 0) + (r.sell || 0) + (r.strongSell || 0);
    if (!n) return null;
    return ((r.strongBuy || 0) * 2 + (r.buy || 0) - (r.sell || 0) - (r.strongSell || 0) * 2) / n;
  };
  const now = score(recs[0]);
  const then = score(recs[Math.min(3, recs.length - 1)]);
  if (now === null || then === null) return null;
  return {
    now,
    then,
    delta: now - then,
    analysts: (recs[0].strongBuy || 0) + (recs[0].buy || 0) + (recs[0].hold || 0) + (recs[0].sell || 0) + (recs[0].strongSell || 0),
  };
}

async function one(sym, KEY, lite, debug) {
  const fh = (path) => getJSON(`https://finnhub.io/api/v1${path}&token=${KEY}`, {}, 6500);
  const jobs = [fh(`/stock/metric?symbol=${sym}&metric=all`), technicals(sym)];
  if (!lite) {
    jobs.push(fh(`/stock/recommendation?symbol=${sym}`));
    jobs.push(fh(`/stock/earnings?symbol=${sym}&limit=4`));
  }
  const out = await Promise.all(jobs);
  const m = (out[0] && out[0].metric) || {};
  const tech = out[1];
  const recs = out[2];
  const earn = out[3];

  const peTTM = first(m, ["peTTM", "peExclExtraTTM", "peBasicExclExtraTTM", "peNormalizedAnnual"]);
  const epsGrowth = first(m, ["epsGrowth3Y", "epsGrowth5Y", "epsGrowthTTMYoy", "epsGrowthQuarterlyYoy"]);
  let peg = first(m, ["pegRatio", "pegTTM"]);
  if (peg === null && peTTM !== null && peTTM > 0 && epsGrowth !== null && epsGrowth > 0) {
    peg = peTTM / epsGrowth; // growth is reported in percent
  }

  // Latest EPS surprise (actual vs estimate), newest first
  let lastSurprisePct = null;
  if (Array.isArray(earn) && earn.length) {
    const e = earn[0];
    if (num(e.surprisePercent) !== null) lastSurprisePct = e.surprisePercent;
    else if (num(e.actual) !== null && num(e.estimate) !== null && e.estimate !== 0)
      lastSurprisePct = ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100;
  }

  const avgVolShares = first(m, ["10DayAverageTradingVolume", "3MonthAverageTradingVolume"]);
  const result = {
    symbol: sym,
    lite: !!lite,
    fetchedAt: Date.now(),
    hasMetrics: Object.keys(m).length > 0,
    marketCapM: first(m, ["marketCapitalization"]), // millions USD
    pe: peTTM,
    peg,
    epsGrowthPct: epsGrowth,
    revGrowthPct: first(m, ["revenueGrowthTTMYoy", "revenueGrowthQuarterlyYoy", "revenueGrowth3Y"]),
    netMarginPct: first(m, ["netProfitMarginTTM", "netProfitMarginAnnual"]),
    opMarginPct: first(m, ["operatingMarginTTM", "operatingMarginAnnual"]),
    debtToEquity: first(m, [
      "totalDebt/totalEquityQuarterly",
      "totalDebt/totalEquityAnnual",
      "longTermDebt/equityQuarterly",
      "longTermDebt/equityAnnual",
    ]),
    interestCoverage: first(m, ["netInterestCoverageTTM", "netInterestCoverageAnnual"]),
    currentRatio: first(m, ["currentRatioQuarterly", "currentRatioAnnual"]),
    fcfTTM: first(m, ["freeCashFlowTTM", "freeCashFlowAnnual"]), // millions USD
    fcfPerShare: first(m, ["freeCashFlowPerShareTTM", "cashFlowPerShareTTM"]),
    beta: first(m, ["beta"]),
    avgVolShares: avgVolShares !== null ? avgVolShares * 1e6 : null, // Finnhub reports millions of shares
    v: 2,
    divYieldPct: first(m, ["currentDividendYieldTTM", "dividendYieldIndicatedAnnual"]),
    ret5d: first(m, ["5DayPriceReturnDaily"]),
    ret13w: first(m, ["13WeekPriceReturnDaily"]),
    retYTD: first(m, ["yearToDatePriceReturnDaily"]),
    w52High: first(m, ["52WeekHigh"]),
    w52Low: first(m, ["52WeekLow"]),
    tech: tech || null,
    ratingDrift: ratingDrift(recs),
    lastSurprisePct,
  };
  if (debug) result._metricKeys = Object.keys(m).length;
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
  if (req.method === "OPTIONS") return res.status(200).end();

  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) return res.status(500).json({ error: "FINNHUB_API_KEY not set in Vercel env vars" });

  const base = `https://${req.headers.host || "localhost"}`;
  const { searchParams } = new URL(req.url, base);
  const syms = (searchParams.get("symbols") || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z.\-]{1,10}$/.test(s))
    .slice(0, 12);
  if (!syms.length) return res.status(400).json({ error: "symbols param required" });
  const lite = searchParams.get("lite") === "1";
  const debug = searchParams.get("debug") === "1";

  try {
    const list = await Promise.all(syms.map((s) => one(s, KEY, lite, debug).catch(() => null)));
    const data = {};
    list.forEach((r, i) => {
      if (r) data[syms[i]] = r;
    });
    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message || "fundamentals failed" });
  }
};
