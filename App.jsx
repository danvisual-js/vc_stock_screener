import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart, BarChart, Line, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ════════════════════════════════════════════════════════════
   NAMES & SEED DATA
════════════════════════════════════════════════════════════ */
const BASE_NAMES = {
  NVDA:"NVIDIA",AAPL:"Apple",AMZN:"Amazon",ORCL:"Oracle",CRWD:"CrowdStrike",
  MSFT:"Microsoft",GOOGL:"Alphabet",PANW:"Palo Alto",AVGO:"Broadcom",
  NOW:"ServiceNow",MSTR:"MicroStrategy",TEM:"Tempus AI",VST:"Vistra",
  DRAM:"Memory ETF",SPCX:"SpaceX",SCHO:"T-Bond ETF",LHX:"L3Harris",
  IBP:"Installed Bldg",CDE:"Coeur Mining",HL:"Hecla Mining",VYX:"NCR Voyix",
  MRVL:"Marvell",NOK:"Nokia",SMCI:"Super Micro",ON:"ON Semi",
  AMD:"AMD",INTC:"Intel",QCOM:"Qualcomm",BOTZ:"Robotics ETF",
  AI:"C3.ai",UBER:"Uber",SPY:"S&P 500 ETF",QQQ:"Nasdaq ETF",
};

const INIT_PORT = [
  {s:"DRAM",qty:14,       avg:59.67, p:77.08, pc:69.95},
  {s:"MRVL",qty:0.164113, avg:274.20,p:325.34,pc:289.54},
  {s:"IBP", qty:0.083163, avg:208.87,p:220.82,pc:211.31},
  {s:"VST", qty:0.225151, avg:148.70,p:165.53,pc:158.83},
  {s:"AVGO",qty:0.184791, avg:381.24,p:407.85,pc:392.90},
  {s:"AMZN",qty:0.175037, avg:237.72,p:244.90,pc:237.50},
  {s:"VYX", qty:14,       avg:7.59,  p:7.72,  pc:7.52 },
  {s:"TEM", qty:0.586127, avg:48.01, p:49.617,pc:48.79 },
  {s:"NVDA",qty:0.134408, avg:205.94,p:210.37,pc:204.65},
  {s:"ORCL",qty:2,        avg:183.48,p:186.85,pc:183.53},
  {s:"GOOGL",qty:0.179201,avg:359.93,p:367.02,pc:363.79},
  {s:"PANW",qty:0.216974, avg:276.12,p:285.36,pc:282.13},
  {s:"AAPL",qty:0.084926, avg:294.26,p:298.14,pc:295.95},
  {s:"SCHO",qty:1.141450, avg:24.13, p:24.10, pc:24.08 },
  {s:"MSFT",qty:0.045942, avg:384.18,p:380.44,pc:378.91},
  {s:"CDE", qty:0.937238, avg:16.73, p:17.09, pc:17.53 },
  {s:"HL",  qty:0.761304, avg:14.97, p:15.74, pc:16.06 },
  {s:"NOK", qty:6.793524, avg:14.72, p:13.385,pc:13.83 },
  {s:"LHX", qty:0.071704, avg:307.93,p:295.52,pc:313.17},
  {s:"NOW", qty:4,        avg:102.74,p:95.33, pc:95.48 },
  {s:"SPCX",qty:6,        avg:185.59,p:179.18,pc:191.82},
  {s:"MSTR",qty:5,        avg:120.06,p:109.50,pc:116.56},
];

const INIT_AI = [
  {s:"MRVL",p:325.34,pc:289.54},{s:"AMD", p:522.20,pc:507.29},
  {s:"INTC",p:121.24,pc:117.05},{s:"AVGO",p:407.85,pc:392.90},
  {s:"NVDA",p:210.37,pc:204.65},{s:"QCOM",p:219.03,pc:214.07},
  {s:"ON",  p:115.92,pc:118.25},{s:"SMCI",p:29.105,pc:29.22 },
  {s:"BOTZ",p:38.29, pc:37.88 },{s:"UBER",p:73.10, pc:73.25 },
  {s:"AI",  p:10.64, pc:10.93 },
];

/* ════════════════════════════════════════════════════════════
   THEMES
════════════════════════════════════════════════════════════ */
const DARK = {
  bg:"#07080F",surface:"#0D1220",surfaceB:"#111827",
  border:"#1A2236",up:"#22D3A0",down:"#F43F5E",accent:"#818CF8",
  text:"#E2E8F0",textSub:"#64748B",textMute:"#1E293B",
  mono:"'JetBrains Mono','Courier New',monospace",
  ema9:"#F59E0B",ema20:"#60A5FA",ema50:"#A78BFA",
  chartGrid:"#1A2236",tickerBg:"#050810",
  insightBg:"#070C18",insightBorder:"#1E3560",insightText:"#93C5FD",
  shimmer:"#1A2236",
};
const LIGHT = {
  bg:"#F0F4F8",surface:"#FFFFFF",surfaceB:"#F8FAFC",
  border:"#DDE3EF",up:"#059669",down:"#DC2626",accent:"#6366F1",
  text:"#0F172A",textSub:"#64748B",textMute:"#E2E8F0",
  mono:"'JetBrains Mono','Courier New',monospace",
  ema9:"#D97706",ema20:"#2563EB",ema50:"#7C3AED",
  chartGrid:"#EEF2F7",tickerBg:"#EFF6FF",
  insightBg:"#EFF6FF",insightBorder:"#BFDBFE",insightText:"#1E40AF",
  shimmer:"#DDE3EF",
};

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
const pct  = (p, pc) => ((p - pc) / pc) * 100;
const f2   = n => Number(n).toFixed(2);
const fUSD = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);

function lcgRand(seed) {
  let s = ((seed * 9301 + 49297) % 233280 + 233280) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function genHistory(price, changePct, days = 365) {
  const rand = lcgRand(Math.floor(price * 73 + 19));
  let p = price * Math.pow(1 / (1 + changePct / 100 / Math.max(days, 1)), days) * (0.85 + rand() * 0.15);
  const data = [];
  for (let i = 0; i < days; i++) {
    const v = 0.013 + rand() * 0.012;
    const d = (rand() - 0.47) * v;
    const open  = p;
    const close = +(open * (1 + d)).toFixed(4);
    const high  = +(Math.max(open, close) * (1 + rand() * 0.006)).toFixed(4);
    const low   = +(Math.min(open, close) * (1 - rand() * 0.006)).toFixed(4);
    const volume = Math.floor(3e6 + rand() * 50e6);
    const dt = new Date("2026-06-18");
    dt.setDate(dt.getDate() - (days - i));
    data.push({ date: dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}), open, close, high, low, volume, isGreen: close >= open });
    p = close;
  }
  const scale = price / data[data.length - 1].close;
  return data.map(d => ({
    ...d,
    open:  +(d.open  * scale).toFixed(4),
    close: +(d.close * scale).toFixed(4),
    high:  +(d.high  * scale).toFixed(4),
    low:   +(d.low   * scale).toFixed(4),
    isGreen: (d.close * scale) >= (d.open * scale),
  }));
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  const res = [];
  let val = null, cnt = 0, sum = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) { res.push(null); continue; }
    if (cnt < period) {
      sum += arr[i]; cnt++;
      if (cnt === period) { val = sum / period; res.push(+val.toFixed(4)); }
      else res.push(null);
    } else { val = arr[i] * k + val * (1 - k); res.push(+val.toFixed(4)); }
  }
  return res;
}

function enrich(data) {
  const cl = data.map(d => d.close);
  const e9  = calcEMA(cl, 9),  e20 = calcEMA(cl, 20), e50 = calcEMA(cl, 50);
  const e12 = calcEMA(cl, 12), e26 = calcEMA(cl, 26);
  const mac = e12.map((v, i) => v != null && e26[i] != null ? +(v - e26[i]).toFixed(4) : null);
  const sig_raw = calcEMA(mac.filter(v => v != null), 9);
  let si = 0;
  const sig = mac.map(v => v != null ? (sig_raw[si++] ?? null) : null);
  const his = mac.map((v, i) => v != null && sig[i] != null ? +(v - sig[i]).toFixed(4) : null);
  return data.map((d, i) => ({ ...d, ema9: e9[i], ema20: e20[i], ema50: e50[i], macd: mac[i], signal: sig[i], histogram: his[i] }));
}

function findSR(data, lb = 10) {
  const z = [];
  for (let i = lb; i < data.length - lb; i++) {
    const wH = data.slice(i - lb, i + lb + 1).map(d => d.high);
    const wL  = data.slice(i - lb, i + lb + 1).map(d => d.low);
    if (data[i].high >= Math.max(...wH)) z.push({ price: data[i].high, type: "resistance" });
    if (data[i].low  <= Math.min(...wL))  z.push({ price: data[i].low,  type: "support" });
  }
  return z.reduce((a, x) => (!a.some(y => Math.abs(y.price - x.price) / x.price < 0.015) && a.push(x), a), []).slice(0, 5);
}

async function callClaude(userPrompt, systemPrompt) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: userPrompt }],
  };
  if (systemPrompt) body.system = systemPrompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
}

function parseJSON(raw) {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const TIMEFRAMES = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

/* ════════════════════════════════════════════════════════════
   MARKET HERO
════════════════════════════════════════════════════════════ */
const FALLBACK_MKT = {
  indices: [
    { s:"SPY", name:"S&P 500",  p:730.21, pc:721.80 },
    { s:"QQQ", name:"Nasdaq",   p:498.70, pc:492.10 },
    { s:"DJI", name:"Dow Jones",p:43215,  pc:42450  },
    { s:"VIX", name:"VIX",      p:16.23,  pc:18.20  },
  ],
  news: [],
};

function MarketHero({ T }) {
  const [mkt,  setMkt]  = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await callClaude(
          "Today June 18 2026: current prices for SPY, QQQ, DJI (Dow Jones), VIX and 4 top trending market news items with sentiment. JSON only.",
          `Return ONLY raw JSON, no markdown: {"indices":[{"s":"SPY","name":"S&P 500","p":730.21,"pc":725.50}],"news":[{"h":"headline","sentiment":"bullish|bearish|neutral","tickers":["SPY"]}]}`
        );
        setMkt(parseJSON(raw) || FALLBACK_MKT);
      } catch { setMkt(FALLBACK_MKT); }
      finally  { setBusy(false); }
    })();
  }, []);

  const sentColor = (s) => s === "bullish" ? T.up : s === "bearish" ? T.down : T.textSub;
  const sentIcon  = (s) => s === "bullish" ? "▲" : s === "bearish" ? "▼" : "→";

  return (
    <div style={{ marginBottom: 13 }}>
      {/* Index tiles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(busy ? FALLBACK_MKT.indices : (mkt?.indices || FALLBACK_MKT.indices)).map(idx => {
          const ch = pct(idx.p, idx.pc), isUp = ch >= 0;
          return (
            <div key={idx.s} style={{
              flex: 1, background: T.surface,
              border: `1px solid ${isUp ? T.up + "30" : T.down + "30"}`,
              borderTop: `2px solid ${isUp ? T.up : T.down}`,
              borderRadius: 10, padding: "9px 12px",
              opacity: busy ? 0.5 : 1,
              animation: busy ? "shimmer 1.4s ease-in-out infinite" : "none",
              transition: "opacity 0.3s",
            }}>
              <div style={{ fontSize: 9, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>{idx.name}</div>
              <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: T.text, marginTop: 2 }}>
                {idx.p >= 10000 ? idx.p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : `$${f2(idx.p)}`}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isUp ? T.up : T.down, marginTop: 1 }}>
                {isUp ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
      {/* News strip */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 8, padding: "7px 12px",
        display: "flex", gap: 18, overflowX: "auto", alignItems: "center",
      }}>
        <span style={{ fontSize: 9, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>TRENDING</span>
        {busy && <span style={{ fontSize: 10, color: T.textSub, animation: "pulse 1.2s infinite" }}>Loading market data…</span>}
        {!busy && (mkt?.news || []).map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 5, alignItems: "baseline", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: sentColor(n.sentiment), fontWeight: 700 }}>{sentIcon(n.sentiment)}</span>
            <span style={{ fontSize: 11, color: T.text, whiteSpace: "nowrap" }}>{n.h}</span>
            {n.tickers?.length > 0 && (
              <span style={{ fontSize: 9, color: T.accent, fontFamily: T.mono }}>{n.tickers.slice(0,3).join(" ")}</span>
            )}
          </div>
        ))}
        {!busy && !mkt?.news?.length && (
          <span style={{ fontSize: 10, color: T.textSub }}>No trending news loaded.</span>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   EVENTS STRIP (auto-loads)
════════════════════════════════════════════════════════════ */
function EventsStrip({ symbols, T }) {
  const [ev,   setEv]  = useState(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await callClaude(
          `Upcoming earnings June 18–July 10 2026 for any of: ${symbols.slice(0, 14).join(",")}. Plus FOMC, CPI, PCE, jobs events in that period. JSON only.`,
          `Return ONLY raw JSON, no markdown: {"earnings":[{"s":"NVDA","date":"Jun 25","when":"AMC"}],"macro":[{"event":"FOMC","date":"Jun 28","impact":"high"}]}`
        );
        const parsed = parseJSON(raw);
        setEv(parsed || { earnings: [], macro: [] });
      } catch { setEv({ earnings: [], macro: [] }); }
      finally  { setBusy(false); }
    })();
  }, []);

  const impC = (i) => i === "high" ? T.down : i === "med" ? T.ema9 : T.textSub;

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: "6px 12px", marginBottom: 11,
      display: "flex", gap: 6, overflowX: "auto", alignItems: "center",
    }}>
      <span style={{ fontSize: 9, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>EVENTS</span>
      {busy && <span style={{ fontSize: 10, color: T.textSub, animation: "pulse 1.2s infinite" }}>Loading calendar…</span>}
      {ev && (
        <>
          {(ev.earnings || []).map((e, i) => (
            <div key={`e${i}`} style={{
              background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "3px 9px", flexShrink: 0,
              display: "flex", gap: 5, alignItems: "center",
            }}>
              <span style={{ fontSize: 9 }}>📊</span>
              <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: T.text }}>{e.s}</span>
              <span style={{ fontSize: 9, color: T.textSub }}>{e.date}{e.when ? ` · ${e.when}` : ""}</span>
            </div>
          ))}
          {(ev.macro || []).map((m, i) => (
            <div key={`m${i}`} style={{
              background: T.bg, border: `1px solid ${impC(m.impact)}40`,
              borderRadius: 6, padding: "3px 9px", flexShrink: 0,
              display: "flex", gap: 5, alignItems: "center",
            }}>
              <span style={{ fontSize: 9 }}>🏦</span>
              <span style={{ fontSize: 10, color: T.text }}>{m.event}</span>
              <span style={{ fontSize: 9, color: impC(m.impact), fontWeight: 600 }}>{m.date}</span>
            </div>
          ))}
          {!ev.earnings?.length && !ev.macro?.length && (
            <span style={{ fontSize: 10, color: T.textSub }}>No events found for this period.</span>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   CANDLE CHART (SVG)
════════════════════════════════════════════════════════════ */
function CandleChart({ data, showEMA, showSupport, srLevels, T }) {
  const VW = 900, VH = 230, P = { t: 8, r: 46, b: 22, l: 56 };
  const W = VW - P.l - P.r, H = VH - P.t - P.b;
  if (!data.length) return null;
  const prices = data.flatMap(d => [d.high, d.low]);
  const minP = Math.min(...prices) * 0.997, maxP = Math.max(...prices) * 1.003, rng = maxP - minP;
  const sy = p => P.t + H * (1 - (p - minP) / rng);
  const sx = i => P.l + (i + 0.5) * (W / data.length);
  const cw = Math.max(3, (W / data.length) * 0.62);
  const step = Math.max(1, Math.round(data.length / 7));
  const yTicks = Array.from({ length: 5 }, (_, i) => minP + (rng / 4) * i);

  const eLine = (key, color, dash) => {
    let seg = [], segs = [];
    data.forEach((d, i) => {
      if (d[key] != null) seg.push(`${sx(i)},${sy(d[key])}`);
      else if (seg.length) { segs.push(seg.join(" ")); seg = []; }
    });
    if (seg.length) segs.push(seg.join(" "));
    return segs.map((pts, si) => (
      <polyline key={`${key}-${si}`} points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray={dash} opacity={0.88} />
    ));
  };

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", display: "block" }}>
      {yTicks.map((p, i) => (
        <g key={i}>
          <line x1={P.l} x2={P.l + W} y1={sy(p)} y2={sy(p)} stroke={T.chartGrid} strokeDasharray="3,4" strokeWidth={0.7} />
          <text x={P.l - 4} y={sy(p)} textAnchor="end" fill={T.textSub} fontSize={9} dominantBaseline="middle">
            {p >= 100 ? p.toFixed(0) : p < 1 ? p.toFixed(3) : p.toFixed(2)}
          </text>
        </g>
      ))}
      {showSupport && srLevels.map((z, i) => (
        <g key={i}>
          <line x1={P.l} x2={P.l + W} y1={sy(z.price)} y2={sy(z.price)} stroke={z.type === "support" ? T.up : T.down} strokeDasharray="6,3" strokeWidth={1} opacity={0.45} />
          <text x={P.l + W + 3} y={sy(z.price)} fill={z.type === "support" ? T.up : T.down} fontSize={8} dominantBaseline="middle">{z.type === "support" ? "S" : "R"}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const color = d.isGreen ? T.up : T.down;
        const bT = sy(Math.max(d.open, d.close)), bB = sy(Math.min(d.open, d.close));
        return (
          <g key={i}>
            <line x1={sx(i)} x2={sx(i)} y1={sy(d.high)} y2={sy(d.low)} stroke={color} strokeWidth={0.8} opacity={0.6} />
            <rect x={sx(i) - cw / 2} y={bT} width={cw} height={Math.max(bB - bT, 1)} fill={color} fillOpacity={d.isGreen ? 0.22 : 0.5} stroke={color} strokeWidth={0.8} />
          </g>
        );
      })}
      {showEMA && <>{eLine("ema9", T.ema9, "4,3")}{eLine("ema20", T.ema20, "")}{eLine("ema50", T.ema50, "")}</>}
      {data.map((d, i) => i % step === 0 && (
        <text key={i} x={sx(i)} y={VH - 3} textAnchor="middle" fill={T.textSub} fontSize={7}>{d.date}</text>
      ))}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════
   LINE CHART (recharts)
════════════════════════════════════════════════════════════ */
function LineChartView({ data, showEMA, showSupport, srLevels, T }) {
  const tt = { contentStyle: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11 }, labelStyle: { color: T.textSub }, itemStyle: { color: T.text } };
  return (
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={T.chartGrid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: T.textSub, fontSize: 8 }} interval="preserveStartEnd" />
        <YAxis domain={["auto", "auto"]} tick={{ fill: T.textSub, fontSize: 8 }} width={46} tickFormatter={v => v >= 100 ? v.toFixed(0) : v.toFixed(2)} />
        <Tooltip {...tt} />
        <Area type="monotone" dataKey="close" stroke={T.accent} fill={`${T.accent}14`} strokeWidth={1.5} dot={false} name="Price" />
        {showEMA && <>
          <Line type="monotone" dataKey="ema9"  stroke={T.ema9}  dot={false} strokeWidth={1} strokeDasharray="4 2" name="EMA 9"  connectNulls={false} />
          <Line type="monotone" dataKey="ema20" stroke={T.ema20} dot={false} strokeWidth={1} name="EMA 20" connectNulls={false} />
          <Line type="monotone" dataKey="ema50" stroke={T.ema50} dot={false} strokeWidth={1.5} name="EMA 50" connectNulls={false} />
        </>}
        {showSupport && srLevels.map((z, i) => (
          <ReferenceLine key={i} y={z.price} stroke={z.type === "support" ? T.up : T.down} strokeDasharray="6 3" strokeWidth={1} opacity={0.5} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function MACDPanel({ data, T }) {
  const d = data.filter(x => x.macd != null);
  const tt = { contentStyle: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 10 }, itemStyle: { color: T.text } };
  return (
    <ResponsiveContainer width="100%" height={80}>
      <ComposedChart data={d} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={T.chartGrid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="date" tick={false} />
        <YAxis tick={{ fill: T.textSub, fontSize: 7 }} width={42} tickFormatter={v => v.toFixed(2)} />
        <Tooltip {...tt} />
        <Bar dataKey="histogram" isAnimationActive={false}>
          {d.map((e, i) => <Cell key={i} fill={e.histogram >= 0 ? `${T.up}55` : `${T.down}55`} />)}
        </Bar>
        <Line type="monotone" dataKey="macd"   stroke={T.accent} dot={false} strokeWidth={1} name="MACD" />
        <Line type="monotone" dataKey="signal" stroke={T.ema9}   dot={false} strokeWidth={1} strokeDasharray="3 2" name="Signal" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function VolumePanel({ data, T }) {
  const tt = { contentStyle: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 10 }, formatter: v => `${(v / 1e6).toFixed(1)}M shares` };
  return (
    <ResponsiveContainer width="100%" height={60}>
      <BarChart data={data} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="date" tick={false} />
        <YAxis tick={{ fill: T.textSub, fontSize: 7 }} width={42} tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} />
        <Tooltip {...tt} />
        <Bar dataKey="volume" isAnimationActive={false}>
          {data.map((e, i) => <Cell key={i} fill={e.isGreen ? `${T.up}45` : `${T.down}45`} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════════
   STOCK CARDS
════════════════════════════════════════════════════════════ */
function GridCard({ stock, selected, onClick, showPL, removable, onRemove, names, T }) {
  const { s, p, pc, qty, avg, loading: ld, failed } = stock;
  const ch = pct(p || 0, pc || 1), isUp = ch >= 0;
  const pl   = showPL && qty && avg ? (p - avg) * qty : null;
  const plPct = pl != null ? ((p - avg) / avg) * 100 : null;
  return (
    <div onClick={onClick} style={{
      position: "relative", background: selected ? (T === DARK ? "#0F1A2E" : "#EEF2FF") : T.surface,
      border: `1px solid ${selected ? T.accent : isUp ? T.up + "28" : T.down + "28"}`,
      borderRadius: 10, padding: "10px 12px", cursor: "pointer",
      transition: "all 0.12s", opacity: ld ? 0.6 : 1,
    }}>
      <div style={{ height: 2, background: isUp ? `linear-gradient(90deg,${T.up},${T.up}20)` : `linear-gradient(90deg,${T.down},${T.down}20)`, borderRadius: 1, marginBottom: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "0.04em" }}>{s}</div>
          <div style={{ fontSize: 9, color: T.textSub, marginTop: 1 }}>
            {ld ? "Fetching…" : failed ? "No data" : (names[s] || s)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {ld
            ? <div style={{ width: 50, height: 24, background: T.border, borderRadius: 4, animation: "shimmer 1.2s infinite" }} />
            : <>
              <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text }}>{p < 1 ? `$${p.toFixed(4)}` : `$${f2(p)}`}</div>
              <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: isUp ? T.up : T.down, marginTop: 1 }}>
                {isUp ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%
              </div>
            </>
          }
        </div>
      </div>
      {pl != null && !ld && (
        <div style={{ marginTop: 6, fontSize: 9, fontFamily: T.mono, color: pl >= 0 ? T.up : T.down, textAlign: "right" }}>
          {pl >= 0 ? "+" : ""}{fUSD(pl)} ({plPct >= 0 ? "+" : ""}{f2(plPct)}%)
        </div>
      )}
      {removable && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ position: "absolute", top: 5, right: 5, padding: "1px 5px", borderRadius: 3, border: "none", background: T.border, color: T.textSub, fontSize: 9, cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}

function ListRow({ stock, selected, onClick, showPL, removable, onRemove, names, T }) {
  const { s, p, pc, qty, avg, loading: ld } = stock;
  const ch = pct(p || 0, pc || 1), isUp = ch >= 0;
  const pl = showPL && qty && avg ? (p - avg) * qty : null;
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
      borderBottom: `1px solid ${T.border}`,
      background: selected ? (T === DARK ? "#111B30" : "#EEF2FF") : "transparent",
      borderLeft: `2px solid ${selected ? T.accent : "transparent"}`,
      cursor: "pointer", transition: "all 0.1s",
    }}>
      <div style={{ width: 2, height: 22, background: isUp ? T.up : T.down, borderRadius: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: T.text }}>{s}</div>
        <div style={{ fontSize: 9, color: T.textSub }}>{ld ? "Fetching…" : (names[s] || s)}</div>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: T.text, minWidth: 52, textAlign: "right" }}>
        {p < 1 ? `$${p.toFixed(4)}` : `$${f2(p)}`}
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: isUp ? T.up : T.down, minWidth: 52, textAlign: "right" }}>
        {isUp ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%
      </div>
      {showPL && pl != null && (
        <div style={{ fontFamily: T.mono, fontSize: 9, color: pl >= 0 ? T.up : T.down, minWidth: 65, textAlign: "right" }}>
          {pl >= 0 ? "+" : ""}{fUSD(pl)}
        </div>
      )}
      {removable && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ padding: "1px 5px", borderRadius: 3, border: "none", background: "transparent", color: T.textSub, fontSize: 10, cursor: "pointer" }}>✕</button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════════ */
export default function StockScreener() {
  const [isDark,    setIsDark]    = useState(true);
  const T = isDark ? DARK : LIGHT;

  const [names,     setNames]     = useState({ ...BASE_NAMES });
  const [tabs,      setTabs]      = useState([
    { id: "portfolio", label: "Portfolio",    editable: false, stocks: INIT_PORT },
    { id: "ai",        label: "Driving / AI", editable: true,  stocks: INIT_AI  },
  ]);
  const [activeTab,  setActiveTab]  = useState("portfolio");
  const [selected,   setSelected]   = useState(null);
  const [viewMode,   setViewMode]   = useState("grid");
  const [chartMode,  setChartMode]  = useState("line");
  const [tf,         setTf]         = useState("3M");
  const [ind,        setInd]        = useState({ ema: false, macd: false, volume: false, support: false });
  const [sort,       setSort]       = useState("change_desc");
  const [newTicker,  setNewTicker]  = useState("");
  const [newTabName, setNewTabName] = useState("");
  const [addingTab,  setAddingTab]  = useState(false);
  const [insight,    setInsight]    = useState("");
  const [loadingAI,  setLoadingAI]  = useState(false);

  const curTab  = tabs.find(t => t.id === activeTab) || tabs[0];
  const isPort  = activeTab === "portfolio";

  const stocks = useMemo(() => [...curTab.stocks].sort((a, b) => {
    const ca = pct(a.p || 0, a.pc || 1), cb = pct(b.p || 0, b.pc || 1);
    if (sort === "change_desc") return cb - ca;
    if (sort === "change_asc")  return ca - cb;
    return a.s.localeCompare(b.s);
  }), [curTab, sort]);

  const rawChart  = useMemo(() => !selected ? [] : genHistory(selected.p, pct(selected.p, selected.pc), 365), [selected]);
  const fullChart = useMemo(() => enrich(rawChart), [rawChart]);
  const chartData = useMemo(() => fullChart.slice(-TIMEFRAMES[tf]), [fullChart, tf]);
  const srLevels  = useMemo(() => findSR(rawChart.slice(-TIMEFRAMES[tf])), [rawChart, tf]);

  // Portfolio stats
  const pv = INIT_PORT.reduce((s, x) => s + x.p * (x.qty || 0), 0);
  const py = INIT_PORT.reduce((s, x) => s + x.pc * (x.qty || 0), 0);
  const pd = pv - py, pp = (pd / py) * 100;
  const gn = INIT_PORT.filter(s => pct(s.p, s.pc) > 0).length;
  const ls = INIT_PORT.filter(s => pct(s.p, s.pc) < 0).length;

  // Add ticker with live data fetch
  const addTicker = async () => {
    const sym = newTicker.trim().toUpperCase();
    if (!sym || !curTab.editable || curTab.stocks.some(s => s.s === sym)) { setNewTicker(""); return; }
    setTabs(p => p.map(t => t.id === activeTab ? { ...t, stocks: [...t.stocks, { s: sym, p: 0, pc: 0, loading: true }] } : t));
    setNewTicker("");
    try {
      const raw = await callClaude(
        `Current stock price and previous close for ticker ${sym} on June 18 2026. JSON only.`,
        `Return ONLY raw JSON, no markdown: {"symbol":"${sym}","name":"Full Company Name","price":123.45,"prevClose":121.00}`
      );
      const parsed = parseJSON(raw);
      if (parsed?.price) {
        if (parsed.name) setNames(n => ({ ...n, [sym]: parsed.name }));
        setTabs(p => p.map(t => t.id === activeTab
          ? { ...t, stocks: t.stocks.map(s => s.s === sym ? { s: sym, p: parsed.price, pc: parsed.prevClose || parsed.price, loading: false } : s) }
          : t
        ));
      } else {
        setTabs(p => p.map(t => t.id === activeTab ? { ...t, stocks: t.stocks.map(s => s.s === sym ? { ...s, loading: false, failed: true } : s) } : t));
      }
    } catch {
      setTabs(p => p.map(t => t.id === activeTab ? { ...t, stocks: t.stocks.map(s => s.s === sym ? { ...s, loading: false, failed: true } : s) } : t));
    }
  };

  const addTab = () => {
    if (!newTabName.trim()) return;
    const id = newTabName.trim().toLowerCase().replace(/\s+/g, "-") + Date.now();
    setTabs(p => [...p, { id, label: newTabName.trim(), editable: true, stocks: [] }]);
    setActiveTab(id); setNewTabName(""); setAddingTab(false);
  };
  const removeTab     = id  => { setTabs(p => p.filter(t => t.id !== id)); if (activeTab === id) setActiveTab("portfolio"); };
  const removeTicker  = sym => { setTabs(p => p.map(t => t.id === activeTab ? { ...t, stocks: t.stocks.filter(s => s.s !== sym) } : t)); if (selected?.s === sym) { setSelected(null); setInsight(""); } };
  const toggleInd     = k   => setInd(p => ({ ...p, [k]: !p[k] }));

  // AI insight (short)
  const getInsight = useCallback(async () => {
    if (!selected) return;
    const ch = pct(selected.p, selected.pc);
    setLoadingAI(true); setInsight("");
    try {
      const raw = await callClaude(
        `In 2-3 sentences max, give a day trader brief on ${selected.s} (${names[selected.s] || selected.s}) June 18 2026, price $${f2(selected.p)} ${ch >= 0 ? "+" : ""}${f2(ch)}% today. Cover: main driver today, 2 key catalysts to watch, and a realistic price target range for this week. Be specific and concise — no preamble.`
      );
      setInsight(raw.trim() || "No insight available.");
    } catch { setInsight("Fetch failed — try again."); }
    finally { setLoadingAI(false); }
  }, [selected, names]);

  // Style helpers
  const tabS  = active => ({ padding: "6px 13px", borderRadius: 7, border: "none", background: active ? T.accent : "transparent", color: active ? "#fff" : T.textSub, fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.12s" });
  const chipS = (active, color) => ({ padding: "4px 8px", borderRadius: 5, border: `1px solid ${active ? color : T.border}`, background: active ? `${color}18` : "transparent", color: active ? color : T.textSub, fontSize: 10, cursor: "pointer", fontWeight: active ? 700 : 400, transition: "all 0.12s" });

  const allTicker = [...stocks, ...stocks];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: "14px 18px 36px", boxSizing: "border-box", transition: "background 0.2s, color 0.2s" }}>
      <style>{`
        @keyframes ticker  { 0%   { transform: translateX(0) }    100% { transform: translateX(-50%) } }
        @keyframes pulse   { 0%,100% { opacity: 1 }  50% { opacity: 0.3 } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes shimmer { 0%,100% { opacity: 0.4 } 50% { opacity: 0.8 } }
        .hov:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .hov { transition: transform 0.12s, box-shadow 0.12s; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
      `}</style>

      {/* ── HEADER ──────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em", color: T.text }}>Stock Screener</div>
          <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textSub, marginTop: 1 }}>Seeded from Robinhood · Jun 18 2026 · 1:22 PM ET</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.text }}>
            <span style={{ color: T.textSub }}>Port </span>
            <span style={{ fontWeight: 700 }}>{fUSD(pv)}</span>
            <span style={{ marginLeft: 8, fontWeight: 700, color: pd >= 0 ? T.up : T.down }}>{pd >= 0 ? "+" : ""}{fUSD(pd)} ({pp >= 0 ? "+" : ""}{f2(pp)}%)</span>
            <span style={{ marginLeft: 8 }}><span style={{ color: T.up }}>{gn}▲</span><span style={{ color: T.textSub }}>/</span><span style={{ color: T.down }}>{ls}▼</span></span>
          </div>
          <button onClick={() => setIsDark(v => !v)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </div>

      {/* ── MARKET HERO ─────────────────────────── */}
      <MarketHero T={T} />

      {/* ── EVENTS STRIP ────────────────────────── */}
      <EventsStrip symbols={INIT_PORT.map(s => s.s)} T={T} />

      {/* ── TICKER TAPE ─────────────────────────── */}
      <div style={{ overflow: "hidden", background: T.tickerBg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 0", marginBottom: 11 }}>
        <div style={{ display: "flex", gap: 24, animation: "ticker 65s linear infinite", width: "max-content", padding: "0 14px" }}>
          {allTicker.map((s, i) => { const ch = pct(s.p || 0, s.pc || 1); return (
            <span key={i} style={{ fontFamily: T.mono, fontSize: 10, color: T.textSub, display: "flex", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ color: T.text, fontWeight: 700 }}>{s.s}</span>
              <span>{s.p < 1 ? `$${s.p.toFixed(4)}` : `$${f2(s.p)}`}</span>
              <span style={{ color: ch >= 0 ? T.up : T.down }}>{ch >= 0 ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%</span>
            </span>
          ); })}
        </div>
      </div>

      {/* ── TABS ────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button style={tabS(activeTab === t.id)} onClick={() => { setActiveTab(t.id); setSelected(null); setInsight(""); }}>{t.label}</button>
            {t.editable && activeTab === t.id && (
              <button onClick={() => removeTab(t.id)} style={{ padding: "2px 5px", borderRadius: 4, border: "none", background: "transparent", color: T.textSub, fontSize: 10, cursor: "pointer" }}>✕</button>
            )}
          </div>
        ))}
        {!addingTab
          ? <button onClick={() => setAddingTab(true)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px dashed ${T.border}`, background: "transparent", color: T.textSub, fontSize: 10, cursor: "pointer" }}>+ Tab</button>
          : <div style={{ display: "flex", gap: 4 }}>
              <input value={newTabName} onChange={e => setNewTabName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addTab(); if (e.key === "Escape") setAddingTab(false); }}
                placeholder="Tab name…" autoFocus
                style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.accent}`, background: T.surface, color: T.text, fontSize: 11, width: 90, outline: "none" }} />
              <button onClick={addTab} style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: T.accent, color: "#fff", fontSize: 11, cursor: "pointer" }}>Add</button>
              <button onClick={() => setAddingTab(false)} style={{ padding: "4px 7px", borderRadius: 5, border: "none", background: "transparent", color: T.textSub, fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
        }
      </div>

      {/* ── CONTROLS ────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", gap: 5 }}>
          {curTab.editable && <>
            <input value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addTicker()}
              placeholder="Add ticker…"
              style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 11, width: 100, outline: "none", fontFamily: T.mono }} />
            <button onClick={addTicker} style={{ padding: "4px 9px", borderRadius: 5, border: "none", background: T.accent, color: "#fff", fontSize: 11, cursor: "pointer" }}>+</button>
          </>}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sort</span>
          {[["change_desc", "▲ Gain", T.up], ["change_asc", "▼ Loss", T.down], ["az", "A–Z", T.accent]].map(([k, l, col]) => (
            <button key={k} onClick={() => setSort(k)} style={chipS(sort === k, col)}>{l}</button>
          ))}
          <div style={{ width: 1, height: 12, background: T.border }} />
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, display: "flex", overflow: "hidden" }}>
            {[["grid", "▦"], ["list", "≡"]].map(([v, ic]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{ padding: "3px 9px", border: "none", background: viewMode === v ? T.accent : "transparent", color: viewMode === v ? "#fff" : T.textSub, fontSize: 13, cursor: "pointer" }}>{ic}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SPLIT VIEW ──────────────────────────── */}
      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>

        {/* Left: list */}
        <div style={{ width: selected ? 262 : "100%", flexShrink: 0, maxHeight: "58vh", overflowY: "auto", transition: "width 0.18s" }}>
          {viewMode === "grid"
            ? <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr" : "repeat(auto-fill,minmax(182px,1fr))", gap: 8 }}>
                {stocks.map(st => (
                  <div key={st.s} className="hov">
                    <GridCard stock={st} selected={selected?.s === st.s}
                      onClick={() => { setSelected(s => s?.s === st.s ? null : st); setInsight(""); }}
                      showPL={isPort} removable={curTab.editable} onRemove={() => removeTicker(st.s)} names={names} T={T} />
                  </div>
                ))}
              </div>
            : <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                {stocks.map(st => (
                  <ListRow key={st.s} stock={st} selected={selected?.s === st.s}
                    onClick={() => { setSelected(s => s?.s === st.s ? null : st); setInsight(""); }}
                    showPL={isPort} removable={curTab.editable} onRemove={() => removeTicker(st.s)} names={names} T={T} />
                ))}
              </div>
          }
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div style={{ flex: 1, minWidth: 0, animation: "fadeUp 0.18s ease" }}>

            {/* Stock header */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 13px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "0.04em" }}>{selected.s}</span>
                    <span style={{ fontSize: 10, color: T.textSub }}>{names[selected.s] || selected.s}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 1 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: T.text }}>{selected.p < 1 ? `$${selected.p.toFixed(4)}` : `$${f2(selected.p)}`}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: pct(selected.p, selected.pc) >= 0 ? T.up : T.down }}>
                      {pct(selected.p, selected.pc) >= 0 ? "▲" : "▼"} {Math.abs(pct(selected.p, selected.pc)).toFixed(2)}%
                    </span>
                  </div>
                  {isPort && selected.qty && selected.avg && (
                    <div style={{ fontSize: 9, fontFamily: T.mono, marginTop: 3 }}>
                      <span style={{ color: T.textSub }}>avg ${f2(selected.avg)} · {selected.qty.toFixed(4)} sh · </span>
                      <span style={{ color: (selected.p - selected.avg) >= 0 ? T.up : T.down, fontWeight: 700 }}>
                        {(selected.p - selected.avg) >= 0 ? "+" : ""}{fUSD((selected.p - selected.avg) * selected.qty)}&nbsp;
                        ({((selected.p - selected.avg) / selected.avg * 100) >= 0 ? "+" : ""}{f2((selected.p - selected.avg) / selected.avg * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelected(null); setInsight(""); }} style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${T.border}`, background: "transparent", color: T.textSub, fontSize: 10, cursor: "pointer" }}>✕</button>
              </div>
            </div>

            {/* Chart controls: timeframe + type + indicators */}
            <div style={{ display: "flex", gap: 5, marginBottom: 7, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 5, display: "flex", overflow: "hidden" }}>
                {Object.keys(TIMEFRAMES).map(k => (
                  <button key={k} onClick={() => setTf(k)} style={{ padding: "3px 8px", border: "none", background: tf === k ? T.accent : "transparent", color: tf === k ? "#fff" : T.textSub, fontSize: 10, cursor: "pointer", fontWeight: tf === k ? 700 : 400 }}>{k}</button>
                ))}
              </div>
              <div style={{ width: 1, height: 12, background: T.border }} />
              {[["line", "Line"], ["candle", "Candle"]].map(([m, l]) => (
                <button key={m} onClick={() => setChartMode(m)} style={chipS(chartMode === m, T.accent)}>{l}</button>
              ))}
              <div style={{ width: 1, height: 12, background: T.border }} />
              <button onClick={() => toggleInd("ema")}     style={chipS(ind.ema,     T.ema9)}>EMA</button>
              <button onClick={() => toggleInd("macd")}    style={chipS(ind.macd,    T.accent)}>MACD</button>
              <button onClick={() => toggleInd("volume")}  style={chipS(ind.volume,  "#60A5FA")}>Vol</button>
              <button onClick={() => toggleInd("support")} style={chipS(ind.support, T.up)}>S/R</button>
            </div>

            {/* Price chart */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 6px", marginBottom: 7 }}>
              {chartData.length > 0 && (
                chartMode === "candle"
                  ? <CandleChart data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={srLevels} T={T} />
                  : <LineChartView data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={srLevels} T={T} />
              )}
            </div>

            {/* Volume */}
            {ind.volume && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 6px 3px", marginBottom: 7 }}>
                <div style={{ fontSize: 8, color: T.textSub, paddingLeft: 4, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.07em" }}>Volume</div>
                <VolumePanel data={chartData} T={T} />
              </div>
            )}

            {/* MACD */}
            {ind.macd && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 6px 3px", marginBottom: 7 }}>
                <div style={{ fontSize: 8, color: T.textSub, paddingLeft: 4, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.07em" }}>MACD (12, 26, 9)</div>
                <MACDPanel data={chartData} T={T} />
              </div>
            )}

            {/* AI Insight — single, short panel */}
            <div style={{ background: T.insightBg, border: `1px solid ${T.insightBorder}`, borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: insight ? 8 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>✦ AI Insight — {selected.s}</div>
                <button onClick={getInsight} disabled={loadingAI} style={{
                  padding: "4px 12px", borderRadius: 6,
                  border: loadingAI ? `1px solid ${T.border}` : "none",
                  background: loadingAI ? "transparent" : "linear-gradient(135deg,#312E81,#4338CA)",
                  color: loadingAI ? T.textSub : "#C7D2FE",
                  fontSize: 10, fontWeight: 600, cursor: loadingAI ? "default" : "pointer",
                }}>
                  {loadingAI ? <span style={{ animation: "pulse 1.1s infinite" }}>Searching…</span> : "Generate"}
                </button>
              </div>
              {insight && <div style={{ fontSize: 12, color: T.insightText, lineHeight: 1.65, animation: "fadeUp 0.2s ease" }}>{insight}</div>}
              {!insight && !loadingAI && <div style={{ fontSize: 10, color: T.textSub, marginTop: 4 }}>Tap Generate — live AI brief on {selected.s}: driver, catalysts, weekly target range.</div>}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 22, textAlign: "center", fontSize: 9, color: T.textMute, letterSpacing: "0.04em" }}>
        PRICES SEEDED FROM ROBINHOOD API · AI INSIGHTS VIA CLAUDE + WEB SEARCH · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}
