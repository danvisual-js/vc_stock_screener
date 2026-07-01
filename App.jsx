import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposedChart, BarChart, Line, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ════════════════════════════════════════════════════
   THEMES & CONSTANTS
════════════════════════════════════════════════════ */
const T = {
  bg: "#0D0D0F", surface: "#1A1A1E", surfaceB: "#242428",
  border: "#2C2C30", up: "#00D084", down: "#FF4560", accent: "#4F8EF7",
  text: "#F1F5F9", textSub: "#94A3B8", shadow: "0 1px 3px rgba(0,0,0,0.4)"
};
const STORAGE_KEY = "stock-screener-watchlist";
const BASE_NAMES = { AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA", TSLA: "Tesla", AMD: "AMD" };

/* ════════════════════════════════════════════════════
   DATA FETCHING
════════════════════════════════════════════════════ */
async function getLiveQuotes(symbols) {
  if (!symbols.length) return {};
  const toYF = s => (["DJI", "VIX", "GSPC"].includes(s) ? `^${s}` : s);
  const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.map(toYF).join(",")}`;
  try {
    const res = await fetch(url).then(r => r.json());
    const data = {};
    res.quoteResponse?.result?.forEach(q => {
      data[q.symbol.replace('^', '')] = { p: q.regularMarketPrice, pc: q.regularMarketPreviousClose, name: q.shortName };
    });
    return data;
  } catch { return {}; }
}

/* ════════════════════════════════════════════════════
   COMPONENTS
════════════════════════════════════════════════════ */
export default function App() {
  const [watchlist, setWatchlist] = useState(() => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  const [data, setData] = useState({});
  const [selected, setSelected] = useState(null);
  const baseSymbols = ["AAPL", "MSFT", "NVDA", "TSLA"];
  const allSymbols = useMemo(() => [...new Set([...baseSymbols, ...watchlist])], [watchlist]);

  const refresh = useCallback(async () => {
    const fresh = await getLiveQuotes(allSymbols);
    setData(prev => ({ ...prev, ...fresh }));
  }, [allSymbols]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist)), [watchlist]);

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", padding: 20, fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 20 }}>
        <h1>Stock Screener</h1>
        <input 
          placeholder="Add Symbol..." 
          onKeyDown={(e) => { 
            if(e.key === 'Enter') {
              const s = e.target.value.toUpperCase().trim();
              if(s && !allSymbols.includes(s)) setWatchlist([...watchlist, s]);
              e.target.value = "";
            } 
          }}
          style={{ padding: "8px", background: T.surface, border: `1px solid ${T.border}`, color: "#fff", borderRadius: 4 }}
        />
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        <div style={{ background: T.surface, borderRadius: 12, padding: 10 }}>
          {allSymbols.map(s => (
            <div 
              key={s} 
              onClick={() => setSelected(s)}
              style={{ padding: 12, cursor: "pointer", borderBottom: `1px solid ${T.border}`, background: selected === s ? T.surfaceB : "transparent" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{s}</span>
                <span>${data[s]?.p?.toFixed(2) || "---"}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: T.surface, borderRadius: 12, padding: 20 }}>
          {selected ? (
            <div>
              <h2>{selected} {BASE_NAMES[selected] || ""}</h2>
              <div style={{ height: 300 }}>
                 {/* Placeholder for your existing Chart component logic */}
                 <div style={{ color: T.textSub }}>Price tracking enabled for {selected}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: T.textSub, textAlign: "center", marginTop: 100 }}>Select a stock to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
