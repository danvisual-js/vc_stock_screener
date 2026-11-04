import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ComposedChart, BarChart, Line, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush
} from "recharts";

/* Desktop / mobile builds load the UI from local files, so relative /api calls need the server's address.
   window.__API_BASE__ comes from public/config.js (empty for the normal web build, so nothing changes there). */
const DONATE_URL="https://buymeacoffee.com/YOUR_NAME"; // set to your Ko-fi / Buy Me a Coffee / GitHub Sponsors link
const LANDER_URL="/welcome/";
(function(){
  try{
    if(typeof window==="undefined"||window.__apiPatched)return;
    window.__apiPatched=true;
    const base=String(window.__API_BASE__||"").replace(/\/$/,"");
    const orig=window.fetch.bind(window);
    window.fetch=(input,init)=>{
      if(typeof input!=="string"||input.indexOf("/api/")!==0)return orig(input,init);
      let code="";try{code=localStorage.getItem("screener_code")||"";}catch{}
      const i=Object.assign({},init||{});
      if(code)i.headers=Object.assign({},i.headers||{},{"X-Access-Code":code});
      return orig(base+input,i);
    };
  }catch{}
})();

/* ════════════════════════════════════════════════════
   NAMES
════════════════════════════════════════════════════ */
const BASE_NAMES = {
  AAPL:"Apple",MSFT:"Microsoft",GOOGL:"Alphabet",AMZN:"Amazon",META:"Meta",
  NVDA:"NVIDIA",AMD:"AMD",INTC:"Intel",AVGO:"Broadcom",QCOM:"Qualcomm",
  MRVL:"Marvell",SMCI:"Super Micro",ON:"ON Semi",TSLA:"Tesla",
  NFLX:"Netflix",DIS:"Disney",UBER:"Uber",CRM:"Salesforce",
  ORCL:"Oracle",NOW:"ServiceNow",PANW:"Palo Alto",CRWD:"CrowdStrike",
  AI:"C3.ai",BOTZ:"Robotics ETF",NOK:"Nokia",MSTR:"MicroStrategy",
};

const INDICES = [
  {s:"SPY", name:"S&P 500",    p:730.21, pc:721.80},
  {s:"QQQ", name:"Nasdaq 100", p:498.70, pc:492.10},
  {s:"DIA",  name:"Dow Jones",  p:432.15, pc:424.50},
  {s:"VIXY", name:"Volatility", p:16.23,  pc:18.20 },
];

const DEFAULT_TABS = [
  {id:"tech", label:"Tech Giants", stocks:[
    {s:"AAPL",p:298.14,pc:295.95},{s:"MSFT",p:380.44,pc:378.91},
    {s:"GOOGL",p:367.02,pc:363.79},{s:"AMZN",p:244.90,pc:237.50},
    {s:"META",p:642.50,pc:635.80},{s:"NVDA",p:210.37,pc:204.65},
    {s:"TSLA",p:315.20,pc:308.90},{s:"NFLX",p:1120.50,pc:1105.30},
  ]},
  {id:"ai", label:"AI & Chips", stocks:[
    {s:"NVDA",p:210.37,pc:204.65},{s:"AMD",p:522.20,pc:507.29},
    {s:"AVGO",p:407.85,pc:392.90},{s:"MRVL",p:325.34,pc:289.54},
    {s:"INTC",p:121.24,pc:117.05},{s:"QCOM",p:219.03,pc:214.07},
    {s:"ON",p:115.92,pc:118.25},{s:"SMCI",p:29.105,pc:29.22},
    {s:"AI",p:10.64,pc:10.93},
  ]},
  {id:"watch", label:"Watchlist", stocks:[]},
];

// Fallback events derived from known Q3 2026 earnings calendars
// Dynamic fallback dates so upcoming events never show past dates
function mkDate(daysAhead){
  const d=new Date(Date.now()+daysAhead*864e5);
  return d.toLocaleString("en-US",{month:"short",day:"numeric"});
}
const KNOWN_EVENTS={
  earnings:[
    {s:"NFLX",date:mkDate(7), when:"AMC"},{s:"TSLA",date:mkDate(9), when:"AMC"},
    {s:"NOW", date:mkDate(9), when:"AMC"},{s:"MSFT",date:mkDate(16),when:"AMC"},
    {s:"GOOGL",date:mkDate(16),when:"AMC"},{s:"META",date:mkDate(17),when:"AMC"},
    {s:"AMD", date:mkDate(16),when:"AMC"},{s:"AAPL",date:mkDate(18),when:"AMC"},
    {s:"AMZN",date:mkDate(19),when:"AMC"},{s:"NVDA",date:mkDate(44),when:"AMC"},
    {s:"MRVL",date:mkDate(43),when:"AMC"},{s:"CRM", date:mkDate(44),when:"AMC"},
    {s:"CRWD",date:mkDate(43),when:"AMC"},{s:"AVGO",date:mkDate(51),when:"AMC"},
    {s:"INTC",date:mkDate(11),when:"AMC"},{s:"QCOM",date:mkDate(17),when:"AMC"},
  ],
  macro:[
    {event:"Fed Rate Decision",date:mkDate(12),impact:"high"},
    {event:"CPI Report",      date:mkDate(5), impact:"high"},
    {event:"Jobs Report",     date:mkDate(3), impact:"high"},
    {event:"PCE Inflation",   date:mkDate(19),impact:"high"},
    {event:"FOMC Minutes",    date:mkDate(26),impact:"med"},
  ],
};


/* ════════════════════════════════════════════════════
   PRICE ALERTS
════════════════════════════════════════════════════ */
function getAlerts(){try{return JSON.parse(localStorage.getItem("screener_alerts")||"[]");}catch{return[];}}
function saveAlerts(a){try{localStorage.setItem("screener_alerts",JSON.stringify(a));}catch{}}
function addAlert(sym,price,cond){const a=getAlerts();a.push({id:Date.now(),symbol:sym,price:Number(price),condition:cond,created:Date.now(),triggered:false});saveAlerts(a);}
function deleteAlert(id){saveAlerts(getAlerts().filter(a=>a.id!==id));}
function checkAndFireAlerts(stocks){
  const alerts=getAlerts();let changed=false;
  alerts.forEach(a=>{
    if(a.triggered)return;
    const s=stocks.find(x=>x.s===a.symbol);
    if(!s||!s.p)return;
    const hit=a.condition==="above"?s.p>=a.price:s.p<=a.price;
    if(hit){a.triggered=true;changed=true;
      if("Notification"in window&&Notification.permission==="granted"){
        try{new Notification(a.symbol+" Alert",{body:`${a.symbol} ${a.condition==="above"?"above":"below"} $${a.price.toFixed(2)} — now $${s.p.toFixed(2)}`});}catch{}
      }
    }
  });
  if(changed)saveAlerts(alerts);
}
function AlertModal({symbol,currentPrice,T,onClose}){
  const [price,setPrice]=React.useState(currentPrice?(currentPrice*1.05).toFixed(2):"");
  const [cond,setCond]=React.useState("above");
  const [saved,setSaved]=React.useState(false);
  const submit=()=>{
    const p=parseFloat(price);if(!p||p<=0)return;
    if("Notification"in window&&Notification.permission==="default")Notification.requestPermission();
    addAlert(symbol,p,cond);setSaved(true);setTimeout(onClose,900);
  };
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24,width:300,boxShadow:"0 16px 40px rgba(0,0,0,0.5)"}}>
        <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:4,display:"flex",alignItems:"center",gap:7}}><I.Bell s={14} c={T.accent}/> Price Alert — {symbol}</div>
        <div style={{fontSize:12,color:T.textSub,marginBottom:16,fontFamily:T.sans}}>Current ${currentPrice?.toFixed(2)||"—"}</div>
        <select value={cond} onChange={e=>setCond(e.target.value)} style={{width:"100%",background:T.surfaceB,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,marginBottom:10,outline:"none"}}>
          <option value="above">Notify when price rises ABOVE</option>
          <option value="below">Notify when price falls BELOW</option>
        </select>
        <input type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Target price…"
          style={{width:"100%",background:T.surfaceB,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"8px 10px",fontSize:16,outline:"none",marginBottom:16}}/>
        {saved&&<div style={{color:T.up,fontSize:12,textAlign:"center",marginBottom:8}}>✓ Alert saved!</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={submit} style={{flex:1,background:T.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Set Alert</button>
          <button onClick={onClose} style={{padding:"9px 14px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,color:T.textSub,fontSize:12,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
function AlertListModal({T,onClose}){
  const [alerts,setAlerts]=React.useState(getAlerts());
  const remove=(id)=>{deleteAlert(id);setAlerts(getAlerts());};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24,width:320,maxHeight:"70vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,fontSize:15,fontWeight:700,color:T.text,marginBottom:16}}><I.Bell s={14} c={T.accent}/> Price Alerts</div>
        {alerts.length===0&&<div style={{fontSize:12,color:T.textSub}}>No alerts set. Click the bell icon on any stock card.</div>}
        {alerts.map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
          <div><span style={{fontFamily:"monospace",fontWeight:700,color:T.text,fontSize:13}}>{a.symbol}</span>
            <span style={{fontSize:11,color:T.textSub,marginLeft:8}}>{a.condition==="above"?"above":"below"} ${a.price.toFixed(2)}</span>
            {a.triggered&&<span style={{fontSize:9,color:T.up,marginLeft:6,fontWeight:700}}>FIRED</span>}
          </div>
          <button onClick={()=>remove(a.id)} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontSize:14,padding:"2px 6px"}}><I.X s={10}/></button>
        </div>))}
        <button onClick={onClose} style={{marginTop:16,width:"100%",background:"transparent",border:`1px solid ${T.border}`,borderRadius:8,padding:"8px",color:T.textSub,fontSize:12,cursor:"pointer"}}>Close</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MARKET SESSION DETECTION
════════════════════════════════════════════════════ */
function getMarketSession(){
  const et=new Date(Date.now()+(-4)*3600000+new Date().getTimezoneOffset()*60000);
  const d=et.getDay(),h=et.getHours(),m=et.getMinutes(),mins=h*60+m;
  if(d===0||d===6)return"closed";
  if(mins<4*60)return"closed";
  if(mins<9*60+30)return"pre";
  if(mins<16*60)return"open";
  if(mins<20*60)return"after";
  return"closed";
}
const SESSION_CFG={open:{label:"Market Open",color:"#00D084"},pre:{label:"Pre-Market",color:"#F59E0B"},after:{label:"After Hours",color:"#60A5FA"},closed:{label:"Market Closed",color:"#64748B"}};

/* ════════════════════════════════════════════════════
   SVG ICON LIBRARY — consistent 24px Lucide-style
════════════════════════════════════════════════════ */
const I={
  Bell:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  BellOff:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  BellAlert:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><circle cx="19" cy="5" r="3" fill={c} stroke="none"/></svg>,
  Refresh:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Moon:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Sun:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Grid:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  List:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Filter:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  BarChart:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  TrendUp:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  X:({s=11,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ChevronDown:({s=12,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ChevronUp:({s=12,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>,
  Plus:({s=13,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  News:({s=14,c="currentColor"})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
};


/* ════════════════════════════════════════════════════════
   PHASE 2 HELPERS
════════════════════════════════════════════════════════ */
// Time-since label for feed items (compact)
function tAgo(ts){
  if(!ts)return"";
  const d=(Date.now()/1000)-ts;
  if(d<3600)return`${Math.round(d/60)}m`;
  if(d<86400)return`${Math.round(d/3600)}h`;
  return`${Math.round(d/86400)}d`;
}

// Fetch named analyst upgrade/downgrade history from Yahoo Finance
async function fetchUpgradesHistory(symbol){
  try{
    const url=`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${toYF(symbol)}?modules=upgradesDowngradesHistory`;
    const d=await yfFetch(url);
    const hist=d?.quoteSummary?.result?.[0]?.upgradesDowngradesHistory?.history||[];
    return hist.slice(0,6).map(h=>({
      firm:h.firm||"",
      action:h.action||"main",
      toGrade:h.toGrade||"",
      fromGrade:h.fromGrade||"",
      date:new Date((h.epochGradeDate||0)*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}),
    }));
  }catch{return[];}
}

// Fetch earnings beat/miss history from /api/earnings
async function fetchEarningsHistory(symbol){
  try{
    const r=await fetch(`/api/events?kind=history&symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.timeout(7000)});
    if(!r.ok)return[];
    return await r.json();
  }catch{return[];}
}

// Build intelligence feed items from stocks + news + events
function buildWatchlistItems(stocks,events,T){
  const items=[];
  (stocks||[]).forEach(s=>{
    if(!s.p||!s.pc||s.loading)return;
    const ch=pct(s.p,s.pc);
    if(Math.abs(ch)<1.5)return;
    items.push({id:`mv-${s.s}`,color:ch>0?T.up:T.down,icon:ch>0?"▲":"▼",sym:s.s,
      title:`${s.s} ${ch>0?"+":""}${ch.toFixed(2)}%`,
      detail:`$${f2(s.p)}`,time:"Live",priority:Math.min(Math.abs(ch)*12,100)});
  });
  (events?.earnings||[]).slice(0,5).forEach(e=>{
    const parts=[e.epsEst!=null?`Est. EPS $${e.epsEst}`:null,e.revEst!=null?`Rev $${e.revEst}B`:null,e.when,e.beatRate!=null?`${e.beatRate}% beat rate`:null].filter(Boolean);
    const dp=e.date?e.date.split(" "):[];
    const dTs=dp.length>=2?new Date(`${dp[0]} ${dp[1]} ${new Date().getFullYear()}`).getTime():Date.now()+1e12;
    items.push({id:`earn-${e.s}`,color:"#F59E0B",icon:"📅",sym:e.s,
      title:`${e.s} earnings · ${e.date}`,detail:parts.join(" · "),time:e.date,priority:55,dateTs:dTs});
  });
  (events?.macro||[]).slice(0,2).forEach(e=>{
    items.push({id:`mac-${e.event}`,color:"#A78BFA",icon:"◎",
      title:e.event,detail:`${e.impact==="high"?"High impact":"Market event"} · ${e.date}`,time:e.date,priority:25});
  });
  return items.sort((a,b)=>{
    // Movers always top; earnings sorted by date ascending; macro last
    if(a.id.startsWith("mv-")&&!b.id.startsWith("mv-"))return -1;
    if(!a.id.startsWith("mv-")&&b.id.startsWith("mv-"))return 1;
    if(a.id.startsWith("earn-")&&b.id.startsWith("earn-")){
      return(a.dateTs||0)-(b.dateTs||0); // earliest first
    }
    if(a.id.startsWith("earn-")&&!b.id.startsWith("earn-"))return -1;
    if(!a.id.startsWith("earn-")&&b.id.startsWith("earn-"))return 1;
    return b.priority-a.priority;
  });
}

/* ════════════════════════════════════════════════════
   DAILY MARKET BRIEF — AI-generated daily dashboard summary
════════════════════════════════════════════════════ */
function DailyBrief({indices,stocks,news,T}){
  const KEY=`daily_brief_${new Date().toDateString()}`;
  const [brief,setBrief]=useState(()=>{try{const c=localStorage.getItem(KEY);return c?JSON.parse(c):null;}catch{return null;}});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [open,setOpen]=useState(true);
  const hasPrices=stocks.some(s=>s.p>0);

  const generate=async()=>{
    setLoading(true);setError(null);
    try{
      const idx=indices.filter(i=>i.p>0).map(i=>{const ch=pct(i.p,i.pc);return `${i.name} ${ch>=0?"+":""}${ch.toFixed(2)}%`;}).join(", ");
      const movers=[...stocks].filter(s=>s.p>0).map(s=>({s:s.s,ch:pct(s.p,s.pc)})).sort((a,b)=>Math.abs(b.ch)-Math.abs(a.ch)).slice(0,5);
      const topNews=(news||[]).slice(0,3).map(n=>n.h||n.title||"").filter(Boolean).join("; ");
      const ctx=`DATE: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
MARKET INDICES: ${idx||"No data"}
WATCHLIST TOP MOVERS: ${movers.map(m=>`${m.s} ${m.ch>=0?"+":""}${m.ch.toFixed(2)}%`).join(", ")||"No data"}
HEADLINES: ${topNews||"No headlines"}
---
Write 3 concise bullets: (1) overall market direction with specific %, (2) standout mover with context, (3) one thing to watch today. Max 20 words each, cite numbers.`;
      const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({symbol:"Daily Market",context:ctx})});
      // Guard against HTML error pages before calling .json()
      const rct=r.headers.get("content-type")||"";
      if(!rct.includes("application/json")){
        if(r.status===404)throw new Error("api/analyze.js not found — commit it to your GitHub repo and redeploy");
        throw new Error(`Server returned ${r.status} (non-JSON). Check Vercel deployment.`);
      }
      if(!r.ok){
        const ed=await r.json().catch(()=>({}));
        const msg=ed.error||`API error ${r.status}`;
        setError(msg.toLowerCase().includes("credit")||msg.toLowerCase().includes("billing")
          ?"Anthropic API credits required. Add credits at console.anthropic.com/billing"
          :msg);
        return;
      }
      const d=await r.json();
      const briefData={bullets:d.movement||[],headline:d.oneLiner||"",ts:Date.now()};
      setBrief(briefData);
      try{localStorage.setItem(KEY,JSON.stringify(briefData));}catch{}
    }catch(e){setError(e.message||"Generation failed");}
    finally{setLoading(false);}
  };

  // Auto-generate once per day — checks cache first so only fires once
  useEffect(()=>{
    if(!brief&&!loading)generate();
  },[]);// eslint-disable-line

  if(!open)return(
    <div onClick={()=>setOpen(true)} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 14px",marginBottom:10,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:11,fontWeight:600,color:T.text,display:"flex",alignItems:"center",gap:6}}>
        <span style={{color:T.accent}}>✦</span> Daily Market Brief
        {brief&&<span style={{fontSize:9,color:T.textSub,fontWeight:400,marginLeft:4}}>{new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
      </span>
      <span style={{fontSize:10,color:T.textSub}}>▼ expand</span>
    </div>
  );

  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:10,boxShadow:T.shadow}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surfaceB}}>
        <span style={{fontSize:11,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:T.accent}}>✦</span> Daily Market Brief
          <span style={{fontSize:9,color:T.textSub,fontWeight:400}}>
            {brief?.ts?`· ${new Date(brief.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}`:"· AI-powered"}
          </span>
        </span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {brief&&!loading&&<button onClick={()=>{setBrief(null);setError(null);try{localStorage.removeItem(KEY);}catch{}}} style={{fontSize:9,color:T.textSub,background:"none",border:"none",cursor:"pointer",padding:"2px 6px"}}>↻</button>}
          <button onClick={()=>setOpen(false)} style={{fontSize:9,color:T.textSub,background:"none",border:"none",cursor:"pointer"}}>▲ hide</button>
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>
        {/* Error */}
        {error&&<div style={{fontSize:11,color:T.down,marginBottom:10,padding:"8px 10px",background:`${T.down}10`,borderRadius:6,lineHeight:1.5}}>⚠ {error}</div>}
        {/* Loading */}
        {loading&&<LoadTimer T={T} label="Writing your brief" expected={15}/>}
        {/* Generate button — shown when no brief and not loading */}
        {!brief&&!loading&&(
          <div style={{textAlign:"center",padding:"4px 0 8px"}}>
            <div style={{fontSize:11,color:T.textSub,marginBottom:12,lineHeight:1.5}}>
              AI-written summary of your watchlist and market conditions.<br/>
              <span style={{fontSize:9}}>Requires Anthropic API credits · Cached until midnight</span>
            </div>
            <button onClick={generate} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",background:T.accent,color:T.accentInk,fontSize:12,fontWeight:700}}>
              ✦ Generate Today's Brief
            </button>
          </div>
        )}
        {/* Brief content */}
        {brief?.headline&&<div style={{fontSize:13,color:T.text,fontWeight:500,lineHeight:1.55,marginBottom:brief.bullets?.length?10:0,borderLeft:`3px solid ${T.accent}`,paddingLeft:10}}>{brief.headline}</div>}
        {(brief?.bullets||[]).map((b,i)=>(
          <div key={i} style={{display:"flex",gap:8,padding:"5px 0",borderBottom:i<(brief.bullets.length-1)?`1px solid ${T.border}`:"none"}}>
            <span style={{color:T.accent,fontWeight:700,fontSize:11,flexShrink:0,paddingTop:1}}>{"①②③"[i]||"•"}</span>
            <span style={{fontSize:11,color:T.textSub,lineHeight:1.5}}>{b}</span>
          </div>
        ))}
        {brief&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><button onClick={()=>{setBrief(null);setError(null);try{localStorage.removeItem(KEY);}catch{}}} style={{fontSize:10,color:T.accent,background:"none",border:"none",cursor:"pointer"}}>Regenerate ↻</button></div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   INTELLIGENCE FEED — 2-col: Watchlist | News Articles
════════════════════════════════════════════════════ */
function IntelligenceFeed({stocks,news,symbols,T}){
  const [events,setEvents]=useState(null);
  useEffect(()=>{
    setEvents({earnings:[],macro:KNOWN_EVENTS.macro.slice(0,3)});
    fetch(`/api/events?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then(r=>r.ok?r.json():[]).then(live=>{
        setEvents({
          earnings:(live.length?live:KNOWN_EVENTS.earnings.filter(e=>symbols.includes(e.s))).slice(0,6),
          macro:KNOWN_EVENTS.macro.slice(0,3),
        });
      }).catch(()=>setEvents({
        earnings:KNOWN_EVENTS.earnings.filter(e=>symbols.includes(e.s)).slice(0,4),
        macro:KNOWN_EVENTS.macro.slice(0,3),
      }));
  },[symbols.join(",")]);// eslint-disable-line

  const watchlist=useMemo(()=>buildWatchlistItems(stocks,events,T),[stocks,events,T]);
  const articles=(news||[]).filter(n=>n.h||n.title);
  const [showAllNews,setShowAllNews]=useState(false);
  const visNews=showAllNews?articles:articles.slice(0,5);

  const ROW=(item,i,arr)=>(
    <div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 12px",
      borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
      <div style={{width:3,height:3,borderRadius:"50%",background:item.color,marginTop:6,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color:T.text,fontWeight:600,lineHeight:1.35,marginBottom:1}}>
          {item.sym&&<span style={{fontFamily:"monospace",color:T.accent,marginRight:5}}>{item.sym}</span>}
          {item.title.replace(item.sym+" ","").replace(item.sym+"·","").trim()}
        </div>
        {item.detail&&<div style={{fontSize:10,color:T.textSub}}>{item.detail}</div>}
      </div>
      <span style={{fontSize:9,color:T.textSub,flexShrink:0,paddingTop:2}}>{item.time}</span>
    </div>
  );

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {/* Left: Watchlist movers + earnings */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.shadow}}>
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:`${T.accent}08`}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:5}}>
            <I.TrendUp s={11} c={T.accent}/>Watchlist
          </span>
          <span style={{fontSize:9,color:T.textSub,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em"}}>Live</span>
        </div>
        <div style={{maxHeight:340,overflowY:"auto"}}>
          {!watchlist.length
            ?<div style={{padding:"4px 12px"}}><LoadTimer T={T} compact label="Loading your watchlist" expected={6}/></div>
            :watchlist.map((item,i)=>ROW(item,i,watchlist))
          }
        </div>
      </div>

      {/* Right: News articles */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.shadow}}>
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:`${T.accent}08`}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:5}}>
            <I.News s={11} c={T.accent}/>Market News
          </span>
          <span style={{fontSize:9,color:T.textSub,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em"}}>Today</span>
        </div>
        <div>
          {!articles.length
            ?<div style={{padding:"4px 12px"}}><LoadTimer T={T} compact label="Loading news" expected={6}/></div>
            :visNews.map((n,i)=>(
              <a key={i} href={n.url||n.link||"#"} target="_blank" rel="noreferrer"
                style={{display:"flex",gap:8,padding:"9px 12px",borderBottom:i<visNews.length-1?`1px solid ${T.border}`:"none",textDecoration:"none",cursor:"pointer"}}>
                <span style={{fontSize:11,color:n.sentiment==="positive"?T.up:n.sentiment==="negative"?T.down:T.textSub,flexShrink:0,paddingTop:2}}>
                  {n.sentiment==="positive"?"↑":n.sentiment==="negative"?"↓":"·"}
                </span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:T.text,lineHeight:1.4,marginBottom:2}}>{n.h||n.title}</div>
                  <div style={{fontSize:9,color:T.textSub}}>{n.publisher} {n.time?`· ${tAgo(n.time)}`:""}</div>
                </div>
              </a>
            ))
          }
          {articles.length>5&&(
            <button onClick={()=>setShowAllNews(v=>!v)}
              style={{display:"block",width:"100%",padding:"8px",fontSize:11,fontWeight:600,
                color:T.accent,background:"transparent",border:"none",
                borderTop:`1px solid ${T.border}`,cursor:"pointer"}}>
              {showAllNews?`↑ Show less`:`View ${articles.length-5} more articles →`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════
   THEMES — Yahoo Finance / iOS Finance aesthetic
════════════════════════════════════════════════════ */
const DARK = {
  // Job-tracker look: deep green-black surfaces, teal accent, flat bordered cards
  bg:"#0C1311", surface:"#141C19", surfaceB:"#1A2420", border:"#26332E",
  accent:"#4CC3A7", accentInk:"#06201A",
  up:"#5CCB8A", down:"#F0877F", warn:"#E7B15A",
  text:"#E4ECE8", textSub:"#8FA19A", textTert:"#3A4A44",
  display:   "'Bricolage Grotesque','Avenir Next','Segoe UI',system-ui,sans-serif",
  mono:      "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  sans:      "'IBM Plex Sans','Segoe UI',system-ui,-apple-system,sans-serif",
  ema9:"#E7B15A", ema20:"#8DB0F2", ema50:"#C9A7F0",
  chartGrid:"#1E2925",
  insightBg:"#141C19", insightBorder:"#26332E", insightText:"#4CC3A7",
  upBg:"#163524", downBg:"#41201D", accentBg:"#143B32",
  shadow:"none", accentGlow:"0 0 0 1px #4CC3A7",
  headerGrad:"#0C1311",
};
const LIGHT = {
  bg:"#EEF2F0", surface:"#FFFFFF", surfaceB:"#F5F8F6", border:"#D5DDD9",
  accent:"#0E6655", accentInk:"#FFFFFF",
  up:"#1C7A47", down:"#A8312A", warn:"#9A5B00",
  text:"#14201C", textSub:"#586862", textTert:"#9AA8A2",
  display:   "'Bricolage Grotesque','Avenir Next','Segoe UI',system-ui,sans-serif",
  mono:      "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  sans:      "'IBM Plex Sans','Segoe UI',system-ui,-apple-system,sans-serif",
  ema9:"#9A5B00", ema20:"#2A56B0", ema50:"#7C4DBA",
  chartGrid:"#E3EAE7",
  insightBg:"#FFFFFF", insightBorder:"#D5DDD9", insightText:"#0E6655",
  upBg:"#DDF0E4", downBg:"#F8DEDB", accentBg:"#DCEFE9",
  shadow:"none", accentGlow:"0 0 0 1px #0E6655",
  headerGrad:"#EEF2F0",
};

/* ════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */
const pct  = (p,pc)=>((p-pc)/pc)*100;
const f2   = n=>Number(n).toFixed(2);
const fN   = n=>n>=10000?n.toLocaleString("en-US",{maximumFractionDigits:0}):`$${f2(n)}`;

function lcgRand(seed){
  let s=((seed*9301+49297)%233280+233280)%233280;
  return()=>{s=(s*9301+49297)%233280;return s/233280;};
}
function genHistory(price,changePct,days=365){
  const rand=lcgRand(Math.floor(price*73+19));
  let p=price*Math.pow(1/(1+changePct/100/Math.max(days,1)),days)*(0.85+rand()*0.15);
  const data=[];
  for(let i=0;i<days;i++){
    const v=0.013+rand()*0.012,d=(rand()-0.47)*v;
    const open=p,close=+(open*(1+d)).toFixed(4);
    const high=+(Math.max(open,close)*(1+rand()*0.006)).toFixed(4);
    const low=+(Math.min(open,close)*(1-rand()*0.006)).toFixed(4);
    const volume=Math.floor(3e6+rand()*50e6);
    const dt=new Date("2026-06-18");dt.setDate(dt.getDate()-(days-i));
    data.push({date:dt.toLocaleDateString("en-US",{month:"short",day:"numeric"}),open,close,high,low,volume,isGreen:close>=open});
    p=close;
  }
  const sc=price/data[data.length-1].close;
  return data.map(d=>({...d,open:+(d.open*sc).toFixed(4),close:+(d.close*sc).toFixed(4),high:+(d.high*sc).toFixed(4),low:+(d.low*sc).toFixed(4),isGreen:(d.close*sc)>=(d.open*sc)}));
}
function calcEMA(arr,period){
  const k=2/(period+1),res=[];let val=null,cnt=0,sum=0;
  for(let i=0;i<arr.length;i++){
    if(arr[i]==null){res.push(null);continue;}
    if(cnt<period){sum+=arr[i];cnt++;if(cnt===period){val=sum/period;res.push(+val.toFixed(4));}else res.push(null);}
    else{val=arr[i]*k+val*(1-k);res.push(+val.toFixed(4));}
  }
  return res;
}
function enrich(data){
  const cl=data.map(d=>d.close);
  const e9=calcEMA(cl,9),e20=calcEMA(cl,20),e50=calcEMA(cl,50);
  const e12=calcEMA(cl,12),e26=calcEMA(cl,26);
  const mac=e12.map((v,i)=>v!=null&&e26[i]!=null?+(v-e26[i]).toFixed(4):null);
  const sr=calcEMA(mac.filter(v=>v!=null),9);let si=0;
  const sig=mac.map(v=>v!=null?(sr[si++]??null):null);
  const his=mac.map((v,i)=>v!=null&&sig[i]!=null?+(v-sig[i]).toFixed(4):null);
  const vwap=calcVWAP(data);
  const bb=calcBollinger(cl);
  const rsi14=calcRSI(cl);
  return data.map((d,i)=>({...d,ema9:e9[i],ema20:e20[i],ema50:e50[i],macd:mac[i],signal:sig[i],histogram:his[i],
    vwap:vwap[i],bbUpper:bb.upper[i],bbMiddle:bb.middle[i],bbLower:bb.lower[i],rsi:rsi14[i]}));
}
function findSR(data,lb=10){
  const z=[];
  for(let i=lb;i<data.length-lb;i++){
    const wH=data.slice(i-lb,i+lb+1).map(d=>d.high);
    const wL=data.slice(i-lb,i+lb+1).map(d=>d.low);
    if(data[i].high>=Math.max(...wH))z.push({price:data[i].high,type:"resistance"});
    if(data[i].low<=Math.min(...wL))z.push({price:data[i].low,type:"support"});
  }
  return z.reduce((a,x)=>(!a.some(y=>Math.abs(y.price-x.price)/x.price<0.015)&&a.push(x),a),[]).slice(0,5);
}

/* ══════════════════════════════════════════════════
   PHASE 1A — VWAP · Bollinger Bands · RSI
══════════════════════════════════════════════════ */
function calcVWAP(data){
  const isIntra=data.length>0&&String(data[0].date).includes(":");
  if(isIntra){let cv=0,cV=0;return data.map(d=>{const tp=(d.high+d.low+d.close)/3,v=d.volume||1;cv+=tp*v;cV+=v;return cV?+(cv/cV).toFixed(4):null;});}
  return data.map(d=>+((d.high+d.low+d.close)/3).toFixed(4));
}
function calcBollinger(cl,p=20,m=2){
  // Adaptive period — renders sooner on short/zoomed data
  p=Math.min(p,Math.max(5,Math.floor(cl.length/3)));
  const up=[],mid=[],lo=[];
  for(let i=0;i<cl.length;i++){
    if(i<p-1){up.push(null);mid.push(null);lo.push(null);continue;}
    const sl=cl.slice(i-p+1,i+1),sma=sl.reduce((a,b)=>a+b,0)/p;
    const std=Math.sqrt(sl.reduce((a,b)=>a+(b-sma)**2,0)/p);
    mid.push(+sma.toFixed(4));up.push(+(sma+m*std).toFixed(4));lo.push(+(sma-m*std).toFixed(4));
  }
  return{upper:up,middle:mid,lower:lo};
}
function calcRSI(cl,p=14){
  const r=new Array(cl.length).fill(null);
  if(cl.length<p+1)return r;
  let ag=0,al=0;
  for(let i=1;i<=p;i++){const c=cl[i]-cl[i-1];if(c>0)ag+=c;else al+=Math.abs(c);}
  ag/=p;al/=p;
  r[p]=al===0?100:+(100-100/(1+ag/al)).toFixed(2);
  for(let i=p+1;i<cl.length;i++){const c=cl[i]-cl[i-1];ag=(ag*(p-1)+(c>0?c:0))/p;al=(al*(p-1)+(c<0?Math.abs(c):0))/p;r[i]=al===0?100:+(100-100/(1+ag/al)).toFixed(2);}
  return r;
}

/* ══════════════════════════════════════════════════
   PHASE 1B — BUY / SELL SIGNAL DETECTION
══════════════════════════════════════════════════ */
function detectSignals(data){
  const s=[];
  for(let i=1;i<data.length;i++){
    const p=data[i-1],c=data[i];
    if(p.ema9!=null&&p.ema20!=null&&c.ema9!=null&&c.ema20!=null){
      if(p.ema9<=p.ema20&&c.ema9>c.ema20)s.push({i,dir:"buy", type:"EMA",label:"EMA 9×20 ↑"});
      else if(p.ema9>=p.ema20&&c.ema9<c.ema20)s.push({i,dir:"sell",type:"EMA",label:"EMA 9×20 ↓"});
    }
    if(p.macd!=null&&p.signal!=null&&c.macd!=null&&c.signal!=null){
      if(p.macd<=p.signal&&c.macd>c.signal)s.push({i,dir:"buy", type:"MACD",label:"MACD Bull Cross"});
      else if(p.macd>=p.signal&&c.macd<c.signal)s.push({i,dir:"sell",type:"MACD",label:"MACD Bear Cross"});
    }
    if(p.rsi!=null&&c.rsi!=null){
      if(p.rsi<=30&&c.rsi>30)s.push({i,dir:"buy", type:"RSI",label:"RSI Exit Oversold"});
      if(p.rsi>=70&&c.rsi<70)s.push({i,dir:"sell",type:"RSI",label:"RSI Exit Overbought"});
    }
    if(p.vwap!=null&&c.vwap!=null){
      if(p.close<=p.vwap&&c.close>c.vwap)s.push({i,dir:"buy", type:"VWAP",label:"Price × VWAP ↑"});
      else if(p.close>=p.vwap&&c.close<c.vwap)s.push({i,dir:"sell",type:"VWAP",label:"Price × VWAP ↓"});
    }
    if(p.bbLower!=null&&c.bbLower!=null&&p.close<=p.bbLower&&c.close>c.bbLower)
      s.push({i,dir:"buy", type:"BB",label:"BB Lower Bounce"});
    if(p.bbUpper!=null&&c.bbUpper!=null&&p.close>=p.bbUpper&&c.close<c.bbUpper)
      s.push({i,dir:"sell",type:"BB",label:"BB Upper Reject"});
  }
  return s;
}

async function callClaude(userMsg,system){
  const body={model:"claude-sonnet-4-6",max_tokens:1000,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:userMsg}]};
  if(system)body.system=system;
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();
  return data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
}
function parseJSON(raw){
  if(!raw)return null;
  try{return JSON.parse(raw.trim());}catch{}
  try{return JSON.parse(raw.replace(/```json\n?|```/g,"").trim());}catch{}
  // Greedy match first { to last }
  const m=raw.match(/\{[\s\S]*\}/);
  if(m){try{return JSON.parse(m[0]);}catch{}}
  // Try any nested JSON objects largest-first
  const all=[...raw.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
  for(const match of all.reverse()){try{const p=JSON.parse(match[0]);if(Object.keys(p).length>0)return p;}catch{}}
  return null;
}

// Extract a price number from freeform text as fallback
function extractPrice(text){
  const m=text.match(/\$\s*([\d,]+\.?\d{0,2})/);
  if(m){const n=parseFloat(m[1].replace(/,/g,""));if(n>0.01&&n<1000000)return n;}
  return null;
}

/* ══════════════════════════════════════════════════════
   YAHOO FINANCE — real-time price & chart data
   Uses a CORS proxy since browser can't call YF directly
══════════════════════════════════════════════════════ */
// Some display symbols differ from Yahoo Finance symbols
// Finnhub uses standard tickers — no mapping needed
const toYF   = s => s;
const fromYF = s => s;

// Fetch through a CORS proxy — tries two services for reliability
async function yfFetch(url){
  try{
    const r=await fetch("/api/yf?url="+encodeURIComponent(url),{signal:AbortSignal.timeout(9000)});
    if(r.ok){
      const d=await r.json();
      // Reject YF error responses (chart error or top-level error)
      if(d&&!d.error&&!d.chart?.error)return d;
    }
  }catch{}
  for(const p of["https://corsproxy.io/?"+encodeURIComponent(url),"https://api.allorigins.win/raw?url="+encodeURIComponent(url)]){
    try{
      const r=await fetch(p,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(7000)});
      if(!r.ok)continue;
      const txt=await r.text();
      if(txt&&txt.length>20){const d=JSON.parse(txt);if(!d.chart?.error)return d;}
    }catch{}
  }
  return null;
}

// Batch real-time quotes — returns {SYM:{p,pc,name,change,changePct}}
async function fetchYFQuotes(symbols){
  if(!symbols.length)return{};
  try{
    const r=await fetch("/api/quotes?symbols="+encodeURIComponent(symbols.join(",")),{
      signal:AbortSignal.timeout(15000),
    });
    if(!r.ok)return{};
    const data=await r.json();
    if(!data||data.error)return{};
    const result={};
    Object.entries(data).forEach(([sym,q])=>{
      if(q&&q.p>0)result[sym]={p:q.p,pc:q.pc||q.p,name:q.name||sym,t:q.t||null,stale:!!q.stale};
    });
    return result;
  }catch{return{};}
}

// Timeframe → Yahoo Finance interval + range
const YF_TF={
  // intraday: prePost=true extends hours 4am–8pm ET
  // Only valid YF ranges: 1d 5d 1mo 3mo 6mo 1y 2y 5y 10y ytd max
  "1m": {interval:"1m",  range:"1d",  prePost:true,  barMin:1},
  "5m": {interval:"5m",  range:"5d",  prePost:true,  barMin:5},
  "15m":{interval:"15m", range:"1mo", prePost:true,  barMin:15},
  "30m":{interval:"30m", range:"1mo", prePost:true,  barMin:30},
  "1h": {interval:"60m", range:"3mo", prePost:true,  barMin:60},
  "4h": {interval:"60m", range:"3mo", prePost:false, barMin:60},
  // daily / historical
  "1W": {interval:"1d",  range:"5d",  prePost:false, barMin:1440},
  "1M": {interval:"1d",  range:"1mo", prePost:false, barMin:1440},
  "3M": {interval:"1d",  range:"3mo", prePost:false, barMin:1440},
  "6M": {interval:"1d",  range:"6mo", prePost:false, barMin:1440},
  "1Y": {interval:"1d",  range:"1y",  prePost:false, barMin:1440},
};

// Real OHLCV chart bars from Yahoo Finance
async function fetchYFChart(symbol, tf){
  const cfg=YF_TF[tf]||YF_TF["5m"];
  const {interval,range,prePost,barMin}=cfg;
  const base=`https://query1.finance.yahoo.com/v8/finance/chart/${toYF(symbol)}?interval=${interval}&range=${range}`;
  // Try regular session first (most reliable from Vercel IPs)
  // Then try with pre/post market if supported
  const urls=[base];
  if(prePost)urls.push(base+"&includePrePost=true"); // appended as fallback
  const processChart=async(url)=>{
    const data=await yfFetch(url);
    const res=data?.chart?.result?.[0];
    if(!res)throw new Error("no result");
  const ts=res.timestamp||[];
  const q=res.indicators?.quote?.[0]||{};
  const isIntra=barMin<1440;
  const multiDay=range!=="1d";
  const ET_OFF=4*3600;
  let prevDayStr="";
  const bars=ts.map((t,i)=>{
    const open=q.open?.[i]||0,close=q.close?.[i]||0;
    const high=q.high?.[i]||0,low=q.low?.[i]||0;
    const volume=q.volume?.[i]||0;
    if(!close||!high)return null;
    const etTs=t-ET_OFF;
    const etH=Math.floor((etTs%86400)/3600);
    const etM=Math.floor((etTs%3600)/60);
    const etMins=etH*60+etM;
    const isExtended=isIntra&&(etMins<570||etMins>=960);
    const d=new Date(t*1000);
    const dayLabel=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    const timeLabel=`${etH===0||etH===12?12:etH%12}:${String(etM).padStart(2,"0")} ${etH<12?"AM":"PM"}`;
    let label;
    if(!isIntra){label=dayLabel;}
    else if(multiDay&&!isExtended&&dayLabel!==prevDayStr){label=dayLabel;}
    else{label=timeLabel;}
    if(!isExtended)prevDayStr=dayLabel;
    return{ts:t,date:label,open:+open.toFixed(4),close:+close.toFixed(4),high:+high.toFixed(4),low:+low.toFixed(4),volume,isGreen:close>=open,isExtended};
  }).filter(Boolean);
  if(bars.length<=5)throw new Error("too few bars");
  return bars;
  };
  // Promise.any: try all URLs in parallel, use first success
  try{
    // One request in the normal case (fewer hits on Yahoo's rate limit); fall back to the plain URL
    if(prePost){try{return await processChart(base+"&includePrePost=true");}catch{}}
    return await processChart(base);
  }catch{return null;}
}
/* ── Chart cache: instant timeframe switching ───────────────────────────
   Daily ranges (1W…1Y) share ONE 1-year daily fetch and are sliced locally.
   Fresh hits return instantly, stale hits are shown immediately and refreshed
   in the background, and concurrent requests for the same key are de-duplicated. */
const CH_CACHE=new Map(),CH_INFLIGHT=new Map();
const DAILY_TFS=["1W","1M","3M","6M","1Y"];
const DAILY_N={"1W":5,"1M":21,"3M":63,"6M":126,"1Y":9999};
const chKey=(sym,tf)=>sym+"|"+(DAILY_TFS.includes(tf)?"D":tf);
const chTTL=tf=>(YF_TF[tf]?.barMin||5)<1440?20000:240000;
const chCut=(bars,tf)=>DAILY_TFS.includes(tf)?bars.slice(-DAILY_N[tf]):bars;
function peekChart(sym,tf){
  const h=CH_CACHE.get(chKey(sym,tf));if(!h)return null;
  return{bars:chCut(h.bars,tf),fresh:Date.now()-h.at<chTTL(tf)};
}
async function getChart(sym,tf,opt){
  const force=!!(opt&&opt.force);
  const key=chKey(sym,tf);const hit=CH_CACHE.get(key);
  if(hit&&!force&&Date.now()-hit.at<chTTL(tf))return chCut(hit.bars,tf);
  let pr=CH_INFLIGHT.get(key);
  if(!pr){
    pr=fetchYFChart(sym,DAILY_TFS.includes(tf)?"1Y":tf).then(b=>{
      if(b&&b.length>5){
        CH_CACHE.set(key,{bars:b,at:Date.now()});
        if(CH_CACHE.size>70)CH_CACHE.delete(CH_CACHE.keys().next().value);
      }
      return b;
    }).finally(()=>CH_INFLIGHT.delete(key));
    CH_INFLIGHT.set(key,pr);
  }
  const b=await pr;
  if(b&&b.length>5)return chCut(b,tf);
  return hit?chCut(hit.bars,tf):null;
}
let PF_TOK=0;
function prefetchCharts(sym){
  const tok=++PF_TOK;
  const q=["1Y","15m","1m","1h"];
  const worker=async()=>{while(q.length&&tok===PF_TOK){const t=q.shift();let ok=null;try{ok=await getChart(sym,t);}catch{}if(!ok)break;await new Promise(r=>setTimeout(r,500));}};
  worker();
}
const sameBars=(a,b)=>{
  if(a===b)return true;if(!a||!b||a.length!==b.length||!a.length)return false;
  const x=a[a.length-1],y=b[b.length-1];
  return x.ts===y.ts&&x.close===y.close&&x.high===y.high&&x.low===y.low&&x.volume===y.volume&&a[0].ts===b[0].ts;
};
// Zoom-driven resolution ladder (TradingView / Robinhood style)
function nextRes(tf,dir){
  if(DAILY_TFS.includes(tf)){
    if(dir==="in")return"1h";
    return DAILY_TFS[DAILY_TFS.indexOf(tf)+1]||null;
  }
  if(tf==="4h")return dir==="in"?"30m":"6M";
  const L=["1m","5m","15m","30m","1h"];const i=L.indexOf(tf);if(i<0)return null;
  return dir==="in"?(L[i-1]||null):(L[i+1]||"6M");
}
const tfName=t=>DAILY_TFS.includes(t)?"daily":t;
async function fetchPrices(symbols){
  if(!symbols.length)return{};
  // Use today's actual date so Claude knows it must search, not use training data
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  // Zero-placeholder template — Claude must replace zeros with real values
  const template=Object.fromEntries(symbols.map(s=>[s,{p:0,pc:0}]));

  try{
    const res=await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:1200,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:
`Today is ${today}. Search the web RIGHT NOW for the latest trading prices of these tickers: ${symbols.join(", ")}.

These are ${new Date().getFullYear()} prices — your training data is too old. You MUST search the web to get current values.

After searching, output ONLY this JSON with the zeros replaced by real prices. No explanation, no markdown:
${JSON.stringify(template)}

p = current/last trade price, pc = previous session close.`
        }]
      })
    });
    const d=await res.json();
    const txt=d.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";

    // ── Strategy 1: parse JSON ──────────────────────────────────────
    const parsed=parseJSON(txt);
    if(parsed){
      const result={};
      symbols.forEach(sym=>{
        const e=parsed[sym]||parsed[sym.toLowerCase()];
        if(e){
          const p=Number(e.p||e.price||e.last||0);
          const pc=Number(e.pc||e.prevClose||e.previousClose||0)||p*0.99;
          if(p>0)result[sym]={p,pc};       // only keep if non-zero
        }
      });
      if(Object.keys(result).length>0)return result;
    }

    // ── Strategy 2: per-symbol line scan ───────────────────────────
    const result={};
    const lines=txt.split(/\n|,|\|/);
    symbols.forEach(sym=>{
      if(result[sym])return;
      for(const line of lines){
        if(!line.toUpperCase().includes(sym))continue;
        // Find all price-shaped numbers on this line
        const nums=[...line.matchAll(/\$?([\d]{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/g)]
          .map(m=>parseFloat(m[1].replace(/,/g,"")))
          .filter(n=>n>0.5&&n<100000);
        if(nums.length){result[sym]={p:nums[0],pc:nums[1]??nums[0]*0.99};break;}
      }
    });
    return result;
  }catch{return{};}
}

// Sorted date helper for events
const MONTHS={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function parseDate(str){const[mon,day]=(str||"").split(" ");return new Date(2026,MONTHS[mon]??6,parseInt(day)||1);}

// Yahoo Finance analyst summary (kept as fallback)
async function fetchYFSummary(symbol){
  const url=`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${toYF(symbol)}?modules=financialData,defaultKeyStatistics,upgradesDowngradesHistory`;
  try{const d=await yfFetch(url);return d?.quoteSummary?.result?.[0]||null;}catch{return null;}
}

// Finnhub analyst consensus + price targets (primary — no auth needed)
async function fetchAnalystData(symbol){
  try{
    const r=await fetch(`/api/analyst?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)return null;
    return await r.json();
  }catch{return null;}
}

// Dual-source: Finnhub first, Yahoo Finance quoteSummary as fallback
async function fetchBestAnalystData(symbol){
  // 1. Try Finnhub
  const a=await fetchAnalystData(symbol);
  if(a?.recommendationKey)return a;
  // 2. Fallback to Yahoo Finance
  const yf=await fetchYFSummary(symbol);
  if(!yf?.financialData?.recommendationKey)return null;
  const fd=yf.financialData,ks=yf.defaultKeyStatistics||{};
  return{
    recommendationKey: fd.recommendationKey,
    numberOfAnalysts:  fd.numberOfAnalystOpinions?.raw||null,
    targetMeanPrice:   fd.targetMeanPrice?.raw||null,
    targetLowPrice:    fd.targetLowPrice?.raw||null,
    targetHighPrice:   fd.targetHighPrice?.raw||null,
    peRatioTTM:        ks.forwardPE?.raw||ks.trailingPE?.raw||null,
    beta:              ks.beta?.raw||null,
    week52High:        ks.fiftyTwoWeekHigh?.raw||null,
    week52Low:         ks.fiftyTwoWeekLow?.raw||null,
  };
}

// Finnhub news via server proxy
async function fetchYFNews(query,count=6){
  try{
    // If query looks like a ticker symbol use company-news; otherwise general market news
    const isSymbol=/^[A-Z]{1,5}$/.test(query.trim());
    const url=isSymbol?`/api/news?symbol=${encodeURIComponent(query)}`:`/api/news`;
    const r=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)return[];
    const d=await r.json();
    return Array.isArray(d)?d.slice(0,count):[];
  }catch{return[];}
}

// Simple keyword-based sentiment for news headlines
function inferSentiment(title){
  const t=title.toLowerCase();
  const bull=["rises","gains","jumps","surges","rallies","beats","record","strong","high","bull","up","growth","profit","positive"];
  const bear=["falls","drops","slips","tumbles","misses","weak","low","bear","down","recession","inflation","loss","warning","sell-off","plunge"];
  const b=bull.filter(w=>t.includes(w)).length, s=bear.filter(w=>t.includes(w)).length;
  return b>s?"bullish":s>b?"bearish":"neutral";
}

// 20-point sparkline for card thumbnails
function genSparkline(price,chPct,n=22){
  const rand=lcgRand(Math.floor(price*31+7));
  const open=price/(1+chPct/100);
  let p=open;const pts=[open];
  for(let i=1;i<n;i++){p=p*(1+(rand()-0.47)*0.004);pts.push(p);}
  const sc=price/pts[pts.length-1];
  return pts.map(v=>v*sc);
}

// Universal bar generator — works for any candle resolution
// barMin: minutes per bar (1, 5, 15, 60, 1440=daily)
// n: number of bars
function genBars(price, chPct, barMin, n){
  const rand=lcgRand(Math.floor(price*73+barMin*31));
  const open=price/(1+chPct/100);
  let p=open;
  const data=[];
  const isIntraday=barMin<1440;
  for(let i=0;i<n;i++){
    let label;
    if(isIntraday){
      const totalMins=i*barMin+9*60+30; // Start 9:30 AM
      const h=Math.floor(totalMins/60);
      const m=totalMins%60;
      label=`${h}:${String(m).padStart(2,"0")}`;
    }else{
      const dt=new Date("2026-06-18");dt.setDate(dt.getDate()-(n-i));
      label=dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    }
    const vol=0.0008*Math.sqrt(barMin); // Volatility scales with √barMin
    const d=(rand()-0.475)*vol;
    const o=p, c=+(o*(1+d)).toFixed(4);
    const h2=+(Math.max(o,c)*(1+rand()*0.0003*Math.sqrt(barMin))).toFixed(4);
    const l =+(Math.min(o,c)*(1-rand()*0.0003*Math.sqrt(barMin))).toFixed(4);
    const volume=Math.floor(barMin*500+rand()*barMin*3000);
    data.push({date:label,open:+o.toFixed(4),close:c,high:h2,low:l,volume,isGreen:c>=o});
    p=c;
  }
  const sc=price/data[data.length-1].close;
  return data.map(d=>({...d,
    open:+(d.open*sc).toFixed(4),close:+(d.close*sc).toFixed(4),
    high:+(d.high*sc).toFixed(4),low:+(d.low*sc).toFixed(4),
    isGreen:(d.close*sc)>=(d.open*sc)
  }));
}

// Timeframe config — barMin used for findSR threshold + ChartControls grouping
const TIMEFRAMES={
  "1m": {barMin:1,   group:"Intraday"},
  "5m": {barMin:5,   group:"Intraday"},
  "15m":{barMin:15,  group:"Intraday"},
  "30m":{barMin:30,  group:"Intraday"},
  "1h": {barMin:60,  group:"Intraday"},
  "4h": {barMin:60,  group:"Intraday"}, // 60m bars, 3mo range
  "1W": {barMin:1440,group:"History"},
  "1M": {barMin:1440,group:"History"},
  "3M": {barMin:1440,group:"History"},
  "6M": {barMin:1440,group:"History"},
  "1Y": {barMin:1440,group:"History"},
};

function getChartData(price,chPct,tf){
  const {barMin}=TIMEFRAMES[tf]||TIMEFRAMES["5m"];
  const n={"1m":390,"5m":78,"15m":26,"30m":13,"1h":7,"4h":7}[tf]||30;
  return enrich(genBars(price,chPct,barMin,n));
}



/* ════════════════════════════════════════════════════
   CHANGE BADGE
════════════════════════════════════════════════════ */
function ChangeBadge({p,pc,T,size="sm"}){
  const ch=(!p||!pc||pc<=0)?null:pct(p,pc);
  if(ch===null||!isFinite(ch)||isNaN(ch))return null;
  const isUp=ch>=0;
  const fs=size==="lg"?14:size==="md"?12:11;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:6,background:isUp?T.upBg:T.downBg,color:isUp?T.up:T.down,fontSize:fs,fontWeight:600,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
      {isUp?"▲":"▼"} {Math.abs(ch).toFixed(2)}%
    </span>
  );
}

function DailyChange({p,pc,T,size="sm"}){
  if(!p||!pc||pc<=0||!isFinite(p/pc))return null;
  const ch=pct(p,pc);
  if(!isFinite(ch)||isNaN(ch))return null;
  const isUp=ch>=0, diff=p-pc;
  const fs=size==="lg"?13:size==="md"?11:10;
  return(
    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:6,background:isUp?T.upBg:T.downBg,color:isUp?T.up:T.down,fontSize:fs,fontWeight:600,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
        {isUp?"▲":"▼"} {Math.abs(ch).toFixed(2)}%
      </span>
      <span style={{fontSize:fs-1,color:isUp?T.up:T.down,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap",fontWeight:500}}>
        {isUp?"+":""}{diff.toFixed(2)}
      </span>
    </div>
  );
}


function Sparkline({price,changePct,T,w=80,h=28}){
  const isUp=changePct>=0;
  const pts=useMemo(()=>genSparkline(price,changePct),[price,changePct]);
  const min=Math.min(...pts),max=Math.max(...pts),rng=max-min||1;
  const pad=2;
  const sx=i=>pad+(i/(pts.length-1))*(w-pad*2);
  const sy=v=>h-pad-((v-min)/rng)*(h-pad*2);
  const d=pts.map((v,i)=>`${i===0?"M":"L"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const color=isUp?T.up:T.down;
  return(
    <svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id={`sp-${Math.floor(price*10)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={color} stopOpacity={0.18}/>
          <stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <path d={`${d} L${sx(pts.length-1)},${h} L${sx(0)},${h} Z`} fill={`url(#sp-${Math.floor(price*10)})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}



// Volume profile — groups bars into price buckets, returns histogram
function buildVolumeProfile(data, buckets=30){
  if(!data.length)return[];
  const prices=data.flatMap(d=>[d.high,d.low]);
  const minP=Math.min(...prices),maxP=Math.max(...prices),rng=maxP-minP||1;
  const bktSz=rng/buckets;
  const profile=Array.from({length:buckets},(_,i)=>({
    priceMid:minP+(i+0.5)*bktSz,priceMin:minP+i*bktSz,priceMax:minP+(i+1)*bktSz,
    volUp:0,volDn:0,vol:0,
  }));
  data.forEach(bar=>{
    const mid=(bar.high+bar.low)/2;
    const idx=Math.min(Math.floor((mid-minP)/bktSz),buckets-1);
    const v=bar.volume||0;
    profile[idx].vol+=v;
    if(bar.isGreen)profile[idx].volUp+=v;else profile[idx].volDn+=v;
  });
  return profile;
}

// CandleChart SVG geometry — module-level so hooks can reference them
const CC_VW=900,CC_VH=210,CC_PAD={t:8,r:44,b:22,l:54};
const CC_W=CC_VW-CC_PAD.l-CC_PAD.r, CC_H=CC_VH-CC_PAD.t-CC_PAD.b;

function CandleChart({data,showEMA,showSupport,srLevels,showVWAP,showBB,signals,showSignals,showVolProfile,symbol,tf,T,chartH=CC_VH,fs=1,big=false,onHover,hideTip,onRes,initWin,canFiner=true,canCoarser=true}){
  // 1:1 pixel SVG: width follows the container, height is chartH px, so text stays crisp and readable
  const [boxW,setBoxW]=useState(0);
  const bandH=big?(boxW>0&&boxW<560?82:44):0;
  const Pad=big?{t:10,r:52,b:26+bandH,l:64}:CC_PAD;
  const VW=boxW>50?boxW:CC_VW, VH=chartH;
  const W=VW-Pad.l-Pad.r, H=VH-Pad.t-Pad.b;
  const F=n=>Math.round(n*1.15*fs*10)/10;
  const [vS,setVS]=useState(0);
  const [vE,setVE]=useState(()=>data.length);
  const drag=useRef({on:false,x0:0,s0:0,e0:0});
  // Pinch-to-zoom state (pointer-based, cross-platform)
  const activePtr=useRef(new Map()); // pointerId → {x,y}
  const pinchRef=useRef(null);       // {startDist, startVS, startVE}
  const divRef=useRef(null);
  useEffect(()=>{
    const el=divRef.current;if(!el)return undefined;
    setBoxW(Math.round(el.getBoundingClientRect().width));
    if(typeof ResizeObserver==="undefined")return undefined;
    const ro=new ResizeObserver(en=>{const w=Math.round(en[0].contentRect.width);setBoxW(p=>Math.abs(p-w)>1?w:p);});
    ro.observe(el);return()=>ro.disconnect();
  },[]);
  const vStart=Math.max(0,Math.min(vS,data.length-5));
  const vEnd=Math.max(vStart+5,Math.min(vE,data.length));
  const visData=data.slice(vStart,vEnd);
  const isZoomed=vStart>0||vEnd<data.length;
  // Zoom survives live updates: only a new symbol / timeframe resets (or re-targets) the view
  const ident=symbol+"|"+tf;
  const prevId=useRef(ident),prevLen=useRef(data.length);
  useEffect(()=>{
    const idChanged=prevId.current!==ident,pl=prevLen.current;
    prevId.current=ident;prevLen.current=data.length;
    if(idChanged||pl<=6){
      if(initWin&&data[0]&&data[0].ts){
        let si=data.findIndex(d=>d.ts>=initWin.t0);if(si<0)si=0;
        let ei=data.length;for(let i=data.length-1;i>=0;i--){if(data[i].ts<=initWin.t1){ei=i+1;break;}}
        if(ei-si>=6){setVS(si);setVE(ei);return;}
      }
      setVS(0);setVE(data.length);return;
    }
    if(data.length!==pl){
      if(vEnd>=pl){ // pinned to the live edge → follow it
        const nv=vEnd-vStart;
        if(vStart===0&&vEnd>=pl){setVS(0);setVE(data.length);}
        else{setVS(Math.max(0,data.length-nv));setVE(data.length);}
      }
    }
  },[ident,data.length]);// eslint-disable-line
  // Auto-resolution: asking the chart to zoom past its detail → request finer / coarser candles
  const resRef=useRef({});resRef.current={onRes,canCoarser};
  const outAt=useRef(0);
  const tryOut=()=>{const r=resRef.current;if(!r.onRes||!r.canCoarser)return;const n=Date.now();if(n-outAt.current<1200)return;outAt.current=n;r.onRes("out",null);};
  const visN=vEnd-vStart;
  useEffect(()=>{
    if(!onRes||!canFiner||!data[0]||!data[0].ts)return undefined;
    if(visN>24||visN>=data.length*0.6)return undefined;
    const id=setTimeout(()=>{
      let step=0;for(let i=vStart+1;i<vEnd;i++){const d=data[i].ts-data[i-1].ts;if(d>0&&(!step||d<step))step=d;}
      onRes("in",{t0:data[vStart].ts,t1:data[vEnd-1].ts+(step||60)});
    },280);
    return()=>clearTimeout(id);
  },[visN,vStart,vEnd,canFiner,data,onRes]);
  const onWheel=useCallback((e)=>{
    e.preventDefault();
    const vis=vEnd-vStart,dir=e.deltaY<0?1:-1;
    if(dir<0&&vis>=data.length){tryOut();return;}
    const amt=Math.max(1,Math.floor(vis*0.12));
    const rect=divRef.current?.getBoundingClientRect();
    const ratio=rect?(e.clientX-rect.left)/rect.width:0.5;
    const dl=Math.round(amt*ratio),dr=amt-dl;
    let ns=vStart+dir*dl,ne=vEnd-dir*dr;
    if(dir<0){ // zooming out: if one edge is already at the limit, give the shortfall to the other side
      if(ns<0){ne-=ns;ns=0;}
      if(ne>data.length){ns-=ne-data.length;ne=data.length;}
      ns=Math.max(0,ns);ne=Math.min(data.length,ne);
    }else{ns=Math.max(0,ns);ne=Math.min(data.length,ne);}
    if(ne-ns>=5){setVS(ns);setVE(ne);}
  },[vStart,vEnd,data.length]);
  useEffect(()=>{const el=divRef.current;if(!el)return;el.addEventListener("wheel",onWheel,{passive:false});return()=>el.removeEventListener("wheel",onWheel);},[onWheel]);
  const onMD=(e)=>{if(e.button!==0)return;drag.current={on:true,x0:e.clientX,s0:vStart,e0:vEnd};e.currentTarget.style.cursor="grabbing";};
  const onMM=(e)=>{if(!drag.current.on)return;const rect=divRef.current?.getBoundingClientRect();if(!rect)return;const vis=drag.current.e0-drag.current.s0;const sh=Math.round((drag.current.x0-e.clientX)/(rect.width/vis));const ns=Math.max(0,drag.current.s0+sh);const ne=Math.min(data.length,drag.current.e0+sh);if(ne-ns===vis){setVS(ns);setVE(ne);}};
  const onMU=(e)=>{drag.current.on=false;if(e.currentTarget)e.currentTarget.style.cursor="default";};
  const resetZoom=()=>{setVS(0);setVE(data.length);};
  const zoomBy=(f)=>{const vis=vEnd-vStart;if(f>1&&vis>=data.length){tryOut();return;}const nv=Math.max(6,Math.min(data.length,Math.round(vis*f)));let ns=Math.round((vStart+vEnd)/2-nv/2);ns=Math.max(0,Math.min(data.length-nv,ns));setVS(ns);setVE(ns+nv);};
  const panBy=(f)=>{const vis=vEnd-vStart;const sh=Math.round(vis*f);const ns=Math.max(0,Math.min(data.length-vis,vStart+sh));setVS(ns);setVE(ns+vis);};



  // ── Drawing state (must be before onChartClick useCallback) ─────────────
  const DRAW_KEY=`drawings_${symbol||"x"}_${tf||"5m"}`;
  const [drawings,setDrawings]=useState(()=>{try{return JSON.parse(localStorage.getItem(DRAW_KEY)||"[]");}catch{return[];}});
  useEffect(()=>{try{localStorage.setItem(DRAW_KEY,JSON.stringify(drawings));}catch{}},[drawings,DRAW_KEY]);
  const [drawMode,setDrawMode]=useState(null);
  const [drawStart,setDrawStart]=useState(null);
  const [selDraw,setSelDraw]=useState(null);
  const [measure,setMeasure]=useState(null);
  const [draggingDraw,setDraggingDraw]=useState(null); // {id,startSvgX,startSvgY,orig}
  const chartRange=useRef({minP:0,rng:1}); // updated after minP computed

  // Convert pointer/touch/mouse event → SVG position + bar index + price
  const svgPos=useCallback((e)=>{
    const rect=divRef.current?.getBoundingClientRect();
    if(!rect)return null;
    // Support mouse, pointer, and touch events
    const clientX=e.touches?.[0]?.clientX??e.changedTouches?.[0]?.clientX??e.clientX;
    const clientY=e.touches?.[0]?.clientY??e.changedTouches?.[0]?.clientY??e.clientY;
    // Convert screen px → SVG units using actual chartH (not the 210 constant)
    const svgX=(clientX-rect.left)/rect.width*VW;
    const svgY=(clientY-rect.top)/rect.height*chartH; // chartH not @@VH@@ — critical for mobile
    const barAbsIdx=Math.round((svgX-Pad.l)/W*visData.length)+vStart;
    const svgH=chartH-Pad.t-Pad.b;
    const price=chartRange.current.minP+(1-(svgY-Pad.t)/svgH)*chartRange.current.rng;
    return{svgX,svgY,barAbsIdx,price};
  },[vStart,visData.length,chartH,VW]);

  const onChartClick=useCallback((e)=>{
    if(!drawMode){if(measure)setMeasure(null);return;}
    const pos=svgPos(e);if(!pos||isNaN(pos.price)||pos.price<=0)return;
    if(drawMode==='hline'){
      setDrawings(prev=>[...prev,{id:Date.now(),type:'hline',price:pos.price,color:'#A78BFA'}]);
      setDrawMode(null);
    } else if(drawMode==='trend'){
      if(!drawStart)setDrawStart({barIdx:pos.barAbsIdx,price:pos.price});
      else{setDrawings(prev=>[...prev,{id:Date.now(),type:'trend',p1:drawStart,p2:{barIdx:pos.barAbsIdx,price:pos.price},color:'#6366F1'}]);setDrawStart(null);setDrawMode(null);}
    } else if(drawMode==='measure'){
      if(!drawStart)setDrawStart({barIdx:pos.barAbsIdx,price:pos.price});
      else{setMeasure({p1:drawStart,p2:{barIdx:pos.barAbsIdx,price:pos.price}});setDrawStart(null);setDrawMode(null);}
    }
  },[drawMode,drawStart,svgPos,measure]);

  // Drag-to-move handlers (TradingView-style)
  const onDrawingMouseDown=useCallback((e,drawing)=>{
    if(drawMode)return;
    e.stopPropagation();
    const pos=svgPos(e);if(!pos)return;
    setSelDraw(drawing.id);
    setDraggingDraw({id:drawing.id,startSvgX:pos.svgX,startSvgY:pos.svgY,orig:JSON.parse(JSON.stringify(drawing))});
  },[drawMode,svgPos]);

  const onDrawingMouseMove=useCallback((e)=>{
    if(!draggingDraw)return;
    const pos=svgPos(e);if(!pos)return;
    const vhRef=chartH-Pad.t-Pad.b;const dprice=(draggingDraw.startSvgY-pos.svgY)/vhRef*chartRange.current.rng;
    const dbar=Math.round((pos.svgX-draggingDraw.startSvgX)/W*visData.length);
    const{orig}=draggingDraw;
    setDrawings(prev=>prev.map(d=>{
      if(d.id!==draggingDraw.id)return d;
      if(d.type==='hline')return{...d,price:orig.price+dprice};
      if(d.type==='trend')return{...d,p1:{barIdx:orig.p1.barIdx+dbar,price:orig.p1.price+dprice},p2:{barIdx:orig.p2.barIdx+dbar,price:orig.p2.price+dprice}};
      return d;
    }));
  },[draggingDraw,svgPos,visData.length,VW]);

  const onDrawingMouseUp=useCallback(()=>setDraggingDraw(null),[]);

  // ── Crosshair state + RAF handler ────────────────────────────────────────
  const [hoverI,setHoverI]=useState(null);
  const rafRef=useRef(null);
  const onSVGMove=useCallback((e)=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(()=>{
      const rect=divRef.current?.getBoundingClientRect();
      if(!rect)return;
      const svgX=(e.clientX-rect.left)/rect.width*VW;
      const idx=Math.floor((svgX-Pad.l)/W*visData.length);
      setHoverI(idx>=0&&idx<visData.length?idx:null);
    });
  },[visData.length,VW]);
  useEffect(()=>{if(onHover)onHover(hoverI!=null&&visData[hoverI]?visData[hoverI]:null);},[hoverI]);// eslint-disable-line
  const onSVGLeave=()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);setHoverI(null);};

  // ── Pinch-to-zoom + touch-drag (pointer-based, works on all devices) ─────
  const onPtrDown=useCallback((e)=>{
    activePtr.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const ptrs=[...activePtr.current.values()];
    if(ptrs.length===2){
      // Two fingers — start pinch
      const d=Math.hypot(ptrs[1].x-ptrs[0].x,ptrs[1].y-ptrs[0].y);
      pinchRef.current={startDist:d,startVS:vStart,startVE:vEnd};
      drag.current.on=false; // cancel single-drag mode
    } else {
      // One finger — start drag (same as mouse)
      onMD(e);
    }
  },[vStart,vEnd,onMD]);

  const onPtrMove=useCallback((e)=>{
    activePtr.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const ptrs=[...activePtr.current.values()];
    if(ptrs.length===2&&pinchRef.current){
      // Pinch zoom — scale visible range around the pinch midpoint
      const d=Math.hypot(ptrs[1].x-ptrs[0].x,ptrs[1].y-ptrs[0].y);
      const scale=pinchRef.current.startDist/Math.max(d,1);
      const vis0=pinchRef.current.startVE-pinchRef.current.startVS;
      const newVis=Math.min(data.length,Math.max(6,Math.round(vis0*scale)));
      if(scale>1.12&&newVis>=data.length)tryOut();
      const mid=Math.round((pinchRef.current.startVS+pinchRef.current.startVE)/2);
      const ns=Math.max(0,mid-Math.floor(newVis/2));
      const ne=Math.min(data.length,ns+newVis);
      setVS(ne-newVis);setVE(ne);
    } else if(ptrs.length<=1){
      // Single pointer — drag pan + crosshair
      onMM(e);onSVGMove(e);onDrawingMouseMove(e);
    }
  },[data.length,onMM,onSVGMove,onDrawingMouseMove]);

  const onPtrUp=useCallback((e)=>{
    activePtr.current.delete(e.pointerId);
    if(activePtr.current.size===0){pinchRef.current=null;onMU(e);onDrawingMouseUp();}
    else if(activePtr.current.size===1){pinchRef.current=null;} // went from 2→1 finger
  },[onMU,onDrawingMouseUp]);

  const onPtrLeave=useCallback((e)=>{
    activePtr.current.delete(e.pointerId);
    if(activePtr.current.size===0){pinchRef.current=null;onMU(e);onSVGLeave();onDrawingMouseUp();}
  },[onMU,onSVGLeave,onDrawingMouseUp]);

  // ── Chart geometry (after all hooks) ────────────────────────────────────
  if(!visData.length)return null;
  const prices=visData.flatMap(d=>[d.high,d.low]);
  const minP=Math.min(...prices)*0.997,maxP=Math.max(...prices)*1.003,rng=maxP-minP||1;
  // Update chart range ref for click handler
  // Pre-compute visible extended-hours bands for shading (avoids IIFE in SVG)
  const visExtBands=(()=>{
    const bands=[];let s=null;
    visData.forEach((d,i)=>{
      if(d.isExtended&&s===null)s=i;
      else if(!d.isExtended&&s!==null){
        // Pre-market = before 9:30 ET; after-market = after 16:00 ET
        const t=visData[s]?._ts;
        const etH=t?Math.floor(((t-4*3600)%86400)/3600):12;
        bands.push({s,e:i-1,pre:etH<9});s=null;
      }
    });
    if(s!==null)bands.push({s,e:visData.length-1,pre:false});
    return bands;
  })();
  chartRange.current={minP,rng};
  const sy=p=>Pad.t+H*(1-(p-minP)/rng);
  const sx=i=>Pad.l+(i+0.5)*(W/visData.length);
  const cw=Math.max(2,(W/visData.length)*0.62);
  const step=Math.max(1,Math.round(visData.length/7));

  // Pre-compute drawing previews (avoids IIFE-inside-JSX Babel issues)
  const trendPrev=((drawMode==='trend'||drawMode==='measure')&&drawStart&&hoverI!=null&&visData[hoverI])?{
    x1:Pad.l+(drawStart.barIdx-vStart+0.5)*(W/visData.length),
    y1:sy(drawStart.price),
    x2:sx(hoverI),y2:sy(visData[hoverI].close)
  }:null;
  const hlinePrevY=(drawMode==='hline'&&hoverI!=null&&visData[hoverI])?sy(visData[hoverI].close):null;
  const nT=Math.max(4,Math.round(H/(big?58:52)));const yTicks=Array.from({length:nT},(_,i)=>minP+(rng/(nT-1))*i);
  const fY=p=>p>=10000?(p/1000).toFixed(big?1:0)+"K":p>=100?p.toFixed(big?2:0):p<1?p.toFixed(3):p.toFixed(2);
  const eLine=(key,color,dash,w=1.2)=>{let seg=[],segs=[];visData.forEach((d,i)=>{if(d[key]!=null)seg.push(`${sx(i)},${sy(d[key])}`);else if(seg.length){segs.push(seg.join(" "));seg=[];}});if(seg.length)segs.push(seg.join(" "));return segs.map((pts,si)=><polyline key={`${key}-${si}`} points={pts} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash} opacity={0.9}/>);};
  return(
    <div ref={divRef}
      style={{position:"relative",cursor:drawMode?"crosshair":"default",userSelect:"none",touchAction:"none"}}
      onPointerDown={onPtrDown} onPointerMove={onPtrMove}
      onPointerUp={onPtrUp} onPointerLeave={onPtrLeave} onPointerCancel={onPtrUp}
      onDoubleClick={resetZoom} onClick={onChartClick}>
      {isZoomed&&<div onClick={resetZoom} style={{position:"absolute",top:6,right:50,zIndex:10,background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 8px",fontSize:9,color:"#00D4AA",cursor:"pointer",fontWeight:700,fontFamily:"monospace"}}>↺ {visData.length}/{data.length}</div>}
      {big&&<div onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} style={{position:"absolute",top:6,left:Pad.l+4,zIndex:10,display:"flex",gap:4}}>
        {[["−",()=>zoomBy(1.4),"Zoom out"],["+",()=>zoomBy(0.7),"Zoom in"],["‹",()=>panBy(-0.3),"Pan left"],["›",()=>panBy(0.3),"Pan right"],["↺",resetZoom,"Reset"]].map(([l,fn,t])=>(
          <button key={t} onClick={fn} title={t} aria-label={t} style={{minWidth:36,height:36,borderRadius:8,border:`1px solid ${T.border}`,background:`${T.surface}F2`,color:T.text,fontSize:16,fontWeight:700,cursor:"pointer",backdropFilter:"blur(4px)"}}>{l}</button>
        ))}
      </div>}
      {/* Drawing toolbar — always visible, prominent placement */}
      <div style={{position:"absolute",bottom:big?6:28,left:big?8:Pad.l+4,zIndex:10,display:"flex",flexWrap:"wrap",gap:4,pointerEvents:"all",maxWidth:big?Math.max(160,VW-16):Math.max(160,VW-Pad.l-Pad.r-8)}}>
        {(()=>{
          const mob=typeof window!=="undefined"&&window.innerWidth<640;
          const bsz={padding:mob?"6px 10px":"4px 10px",fontSize:mob?12:11,minHeight:mob?34:undefined};
          return [['trend','/','Trend','#6366F1'],['hline','─','H-Line','#A78BFA'],['measure','↔','Measure','#F59E0B']].map(([mode,ico,lbl,col])=>(
            <button key={mode} onClick={e=>{e.stopPropagation();setDrawMode(m=>m===mode?null:mode);setDrawStart(null);}}
              title={drawStart&&drawMode===mode?"Tap the second point to finish":lbl}
              style={{...bsz,fontWeight:700,borderRadius:8,border:`1.5px solid ${drawMode===mode?col:T.border}`,
                background:drawMode===mode?`${col}22`:`${T.surface}F2`,
                color:drawMode===mode?col:T.text,cursor:"pointer",
                boxShadow:drawMode===mode?`0 0 0 1px ${col}40`:"none",
                backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              <span style={{fontSize:mob?16:13,lineHeight:1}}>{ico}</span>
              <span>{drawMode===mode?(mode!=='hline'&&drawStart?"pt 2…":lbl+" ✓"):lbl}</span>
            </button>
          ));
        })()}
        {drawings.length>0&&(()=>{
          const mob=typeof window!=="undefined"&&window.innerWidth<640;
          return(<button onClick={e=>{e.stopPropagation();setDrawings(p=>p.slice(0,-1));setSelDraw(null);}}
            title="Undo last drawing"
            style={{padding:mob?"6px 10px":"4px 10px",fontSize:mob?12:11,fontWeight:700,borderRadius:8,border:`1.5px solid ${T.border}`,background:`${T.surface}F2`,color:T.text,cursor:"pointer",backdropFilter:"blur(4px)",minHeight:mob?34:undefined}}>↶ Undo</button>);
        })()}
        {drawings.length>0&&(()=>{
          const mob=typeof window!=="undefined"&&window.innerWidth<640;
          return(<button onClick={e=>{e.stopPropagation();setDrawings([]);setDrawMode(null);setDrawStart(null);setSelDraw(null);}}
            title="Clear all drawings"
            style={{padding:mob?"6px 10px":"4px 10px",fontSize:mob?12:10,fontWeight:700,borderRadius:8,
              border:`1.5px solid ${T.border}`,background:`${T.surface}F2`,
              color:T.down,cursor:"pointer",backdropFilter:"blur(4px)",minHeight:mob?34:undefined}}>
            ✕ Clear all
          </button>);
        })()}
      </div>

      {/* Selected drawing delete button — persistent HTML overlay (not in SVG) */}
      {selDraw&&(()=>{
        const d=drawings.find(x=>x.id===selDraw);
        if(!d)return null;
        // Position delete button near top-right of chart
        return(
          <div onClick={e=>{e.stopPropagation();setDrawings(prev=>prev.filter(x=>x.id!==selDraw));setSelDraw(null);}}
            style={{position:"absolute",top:30,right:Pad.r+6,zIndex:20,
              padding:"4px 10px",fontSize:11,fontWeight:700,borderRadius:6,
              border:`1.5px solid ${T.down}`,background:`${T.down}22`,
              color:T.down,cursor:"pointer",pointerEvents:"all",
              display:"flex",alignItems:"center",gap:5,backdropFilter:"blur(4px)"}}>
            <I.X s={11} c={T.down}/> Delete line
          </div>
        );
      })()}
      <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} style={{display:"block"}}>
        {yTicks.map((p,i)=>(<g key={i}><line x1={Pad.l} x2={Pad.l+W} y1={sy(p)} y2={sy(p)} stroke={T.chartGrid} strokeDasharray="2,5" strokeWidth={0.8}/><text x={Pad.l-4} y={sy(p)} textAnchor="end" fill={T.textSub} fontSize={F(9)} dominantBaseline="middle">{fY(p)}</text></g>))}
        {/* Pre/after-hours shading — pre-computed, no IIFE */}
        {visExtBands.map((b,i)=>(
          <rect key={i}
            x={Pad.l+b.s*(W/visData.length)} y={Pad.t}
            width={(b.e-b.s+1)*(W/visData.length)} height={H}
            fill={b.pre?"#6366F1":"#94A3B8"} opacity={0.07}/>
        ))}
        {showSupport&&srLevels.map((z,i)=>(<g key={i}><line x1={Pad.l} x2={Pad.l+W} y1={sy(z.price)} y2={sy(z.price)} stroke={z.type==="support"?T.up:T.down} strokeDasharray="5,3" strokeWidth={1} opacity={0.4}/><text x={Pad.l+W+3} y={sy(z.price)} fill={z.type==="support"?T.up:T.down} fontSize={F(8)} dominantBaseline="middle">{z.type==="support"?"S":"R"}</text></g>))}
        {/* Session boundary lines + candles */}
        {visData.map((d,i)=>{
          const color=d.isGreen?T.up:T.down;
          const bT=sy(Math.max(d.open,d.close)),bB=sy(Math.min(d.open,d.close));
          const ext=d.isExtended;
          const prevExt=i>0?visData[i-1].isExtended:d.isExtended;
          return(<g key={i}>
            {/* Vertical session-boundary marker */}
            {i>0&&prevExt!==ext&&(
              <line x1={sx(i)-cw} x2={sx(i)-cw} y1={Pad.t} y2={Pad.t+H}
                stroke={T.border} strokeWidth={0.8} strokeDasharray="2,3" opacity={0.7}/>
            )}
            {/* Candle wick — dimmed + grey tint in extended hours */}
            <line x1={sx(i)} x2={sx(i)} y1={sy(d.high)} y2={sy(d.low)}
              stroke={ext?"#6B7099":color} strokeWidth={0.8} opacity={ext?0.4:0.65}/>
            {/* Candle body — grey fill in extended hours */}
            <rect x={sx(i)-cw/2} y={bT} width={cw} height={Math.max(bB-bT,1)}
              fill={ext?"#6B7099":color} fillOpacity={ext?0.15:d.isGreen?0.22:0.5}
              stroke={ext?"#6B7099":color} strokeWidth={0.8} opacity={ext?0.55:1}/>
          </g>);
        })}
        {showEMA&&[...eLine("ema9",T.ema9,"4,3"),...eLine("ema20",T.ema20,""),...eLine("ema50",T.ema50,"")]}
        {showBB&&(()=>{const pts=(k)=>visData.map((d,i)=>d[k]!=null?`${sx(i).toFixed(1)},${sy(d[k]).toFixed(1)}`:null).filter(Boolean);const up=pts("bbUpper"),lo=pts("bbLower");if(!up.length)return null;return(<g><path d={`M${up.join(" L")} L${lo.slice().reverse().join(" L")} Z`} fill="#A78BFA" fillOpacity={0.07}/>{[["bbUpper","#A78BFA","3,2"],["bbMiddle","#A78BFA50",""],["bbLower","#A78BFA","3,2"]].map(([k,c,dash])=>(<polyline key={k} points={visData.map((d,i)=>d[k]!=null?`${sx(i).toFixed(1)},${sy(d[k]).toFixed(1)}`:null).filter(Boolean).join(" ")} fill="none" stroke={c} strokeWidth={1} strokeDasharray={dash} opacity={0.9}/>))}</g>);})()}
        {showVWAP&&eLine("vwap","#60A5FA","",1.5)}
        {showSignals&&signals&&signals.map((sig,idx)=>{const vi=sig.i-vStart;if(vi<0||vi>=visData.length)return null;const bar=visData[vi];const cx=sx(vi);const isBuy=sig.dir==="buy";const stack=signals.filter(s=>s.i===sig.i&&s.dir===sig.dir).indexOf(sig);const sz=5,gap=10;const ty=isBuy?sy(bar.low)+gap+(stack*gap):sy(bar.high)-gap-(stack*gap);const tri=isBuy?`M${cx},${ty-sz} L${cx+sz},${ty+sz} L${cx-sz},${ty+sz} Z`:`M${cx},${ty+sz} L${cx+sz},${ty-sz} L${cx-sz},${ty-sz} Z`;const fill=isBuy?T.up:T.down;return(<g key={`sig-${idx}`}><path d={tri} fill={fill} opacity={0.9}><title>{sig.label}</title></path><line x1={cx} x2={cx} y1={isBuy?ty-sz-1:ty+sz+1} y2={isBuy?sy(bar.low)+2:sy(bar.high)-2} stroke={fill} strokeWidth={0.6} opacity={0.35} strokeDasharray="2,2"/></g>);})}
        {showVolProfile&&(()=>{const profile=buildVolumeProfile(visData,28);const maxV=Math.max(...profile.map(b=>b.vol),1);const POC=profile.reduce((a,b)=>b.vol>a.vol?b:a,profile[0]);const vpW=48,vpX=Pad.l+W-vpW;return profile.map((b,i)=>{const y1=sy(b.priceMax),y2=sy(b.priceMin),bh=Math.max(1,y2-y1),bw=(b.vol/maxV)*vpW,isPOC=b.vol===POC.vol;const color=isPOC?"#F59E0B":b.volUp>=b.volDn?T.up:T.down;return(<rect key={i} x={vpX+(vpW-bw)} y={y1} width={bw} height={bh} fill={color} opacity={isPOC?0.85:0.3}/>);}).concat(<line key="poc" x1={Pad.l} x2={Pad.l+W} y1={sy(POC.priceMid)} y2={sy(POC.priceMid)} stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.6}/>,<text key="poc-l" x={Pad.l+2} y={sy(POC.priceMid)-3} fill="#F59E0B" fontSize={F(7)}>POC</text>);})()}
        {visData.map((d,i)=>i%step===0&&<text key={i} x={sx(i)} y={Pad.t+H+F(13)} textAnchor="middle" fill={T.textSub} fontSize={F(7)}>{d.date}</text>)}


        {/* ── Saved drawings ──────────────────────────────────────── */}
        {drawings.map(d=>{
          const isSel=selDraw===d.id;
          if(d.type==='hline'){
            const y=sy(d.price);
            if(y<Pad.t||y>Pad.t+H)return null;
            return(<g key={d.id} onPointerDown={e=>onDrawingMouseDown(e,d)}
              onClick={e=>{e.stopPropagation();if(!draggingDraw)setSelDraw(isSel?null:d.id);}}
              style={{cursor:draggingDraw?.id===d.id?'grabbing':'grab'}}>
              {/* Hit zone — wider invisible line for easier clicking */}
              <line x1={Pad.l} x2={Pad.l+W} y1={y} y2={y} stroke="transparent" strokeWidth={12}/>
              <line x1={Pad.l} x2={Pad.l+W} y1={y} y2={y} stroke={d.color} strokeWidth={isSel?2:1.2} strokeDasharray="6,3" opacity={isSel?1:0.85}/>
              <text x={Pad.l+W+3} y={y+1} fontSize={F(7.5)} fill={d.color} dominantBaseline="middle">{fY(d.price)}</text>
              {isSel&&<circle cx={Pad.l} cy={y} r={4} fill={d.color} opacity={0.8}/>}
              {isSel&&<circle cx={Pad.l+W} cy={y} r={4} fill={d.color} opacity={0.8}/>}
            </g>);
          }
          if(d.type==='trend'){
            const vi1=d.p1.barIdx-vStart,vi2=d.p2.barIdx-vStart;
            if(vi1<-20||vi2<-20||vi1>visData.length+20||vi2>visData.length+20)return null;
            const x1=Pad.l+(vi1+0.5)*(W/visData.length),y1=sy(d.p1.price);
            const x2=Pad.l+(vi2+0.5)*(W/visData.length),y2=sy(d.p2.price);
            return(<g key={d.id} onPointerDown={e=>onDrawingMouseDown(e,d)}
              onClick={e=>{e.stopPropagation();if(!draggingDraw)setSelDraw(isSel?null:d.id);}}
              style={{cursor:draggingDraw?.id===d.id?'grabbing':'grab'}}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14}/>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d.color} strokeWidth={isSel?2.5:1.5} opacity={isSel?1:0.9}/>
              {isSel&&<circle cx={x1} cy={y1} r={4} fill={d.color}/>}
              {isSel&&<circle cx={x2} cy={y2} r={4} fill={d.color}/>}
            </g>);
          }
          return null;
        })}

        {/* Preview line while drawing */}
        {hlinePrevY!==null&&<line x1={Pad.l} x2={Pad.l+W} y1={hlinePrevY} y2={hlinePrevY}
          stroke="#A78BFA" strokeWidth={0.8} strokeDasharray="4,2" opacity={0.5} style={{pointerEvents:"none"}}/>}
        {trendPrev&&drawStart&&<line x1={trendPrev.x1} y1={trendPrev.y1} x2={trendPrev.x2} y2={trendPrev.y2}
          stroke="#6366F1" strokeWidth={1} strokeDasharray="4,2" opacity={0.7} style={{pointerEvents:"none"}}/>}
        {trendPrev&&drawStart&&<circle cx={trendPrev.x1} cy={trendPrev.y1} r={4} fill="#6366F1" opacity={0.7} style={{pointerEvents:"none"}}/>}

        {/* ── Crosshair — Google Finance style ─────────────────── */}
        {hoverI!=null&&visData[hoverI]&&(()=>{
          const bar=visData[hoverI];
          const cx=sx(hoverI);
          const cy=sy(bar.close);
          const col=bar.isGreen?T.up:T.down;
          const sc=1.15*fs,tipW=168*sc,tipH=58*sc;
          const tipX=cx+12+tipW>VW-Pad.r?cx-tipW-12:cx+12;
          const tipY=Math.max(Pad.t+2,Math.min(cy-tipH/2,Pad.t+H-tipH-2));
          return(<g style={{pointerEvents:"none"}}>
            {/* Vertical crosshair line */}
            <line x1={cx} x2={cx} y1={Pad.t} y2={Pad.t+H}
              stroke={T.textSub} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.5}/>
            {/* Horizontal guide to Y-axis */}
            <line x1={Pad.l} x2={cx} y1={cy} y2={cy}
              stroke={col} strokeWidth={0.5} strokeDasharray="2,3" opacity={0.35}/>
            {/* Price dot on close */}
            <circle cx={cx} cy={cy} r={4.5} fill={col} stroke={T.bg} strokeWidth={1.5}/>
            {/* Price label on left Y-axis */}
            <rect x={1} y={cy-9} width={Pad.l-3} height={18} rx={3} fill={col}/>
            <text x={(Pad.l-3)/2+1} y={cy+1} textAnchor="middle" fill="#fff"
              fontSize={F(8)} fontWeight={700} dominantBaseline="middle">{fY(bar.close)}</text>
            {/* OHLCV tooltip */}
            {!hideTip&&<g transform={`translate(${tipX},${tipY}) scale(${sc})`}>
            <rect x={0} y={0} width={168} height={58} rx={6}
              fill={T.surface} stroke={T.border} strokeWidth={0.8} opacity={0.97}/>
            <text x={10} y={13} fill={T.textSub} fontSize={8.5} fontFamily="monospace">{bar.date}</text>
            {[["O",bar.open,"#94A3B8"],["H",bar.high,T.up],["L",bar.low,T.down],["C",bar.close,col]].map(([l,v,c],i)=>(
              <g key={l}>
                <text x={10+i*40} y={30} fill={T.textSub} fontSize={8} fontFamily="monospace">{l}</text>
                <text x={18+i*40} y={30} fill={c} fontSize={8} fontWeight={700} fontFamily="monospace">{fY(v)}</text>
              </g>
            ))}
            {bar.volume>0&&<text x={10} y={47} fill={T.textSub} fontSize={8} fontFamily="monospace">
              Vol <tspan fill={T.text} fontWeight={700}>{bar.volume>1e9?(bar.volume/1e9).toFixed(1)+"B":bar.volume>1e6?(bar.volume/1e6).toFixed(1)+"M":bar.volume>1e3?(bar.volume/1e3).toFixed(0)+"K":bar.volume}</tspan>
            </text>}
            </g>}
          </g>);
        })()}
        {measure&&(()=>{
          const x1=Pad.l+(measure.p1.barIdx-vStart+0.5)*(W/visData.length),y1=sy(measure.p1.price);
          const x2=Pad.l+(measure.p2.barIdx-vStart+0.5)*(W/visData.length),y2=sy(measure.p2.price);
          const dP=measure.p2.price-measure.p1.price,dPct=measure.p1.price?dP/measure.p1.price*100:0,bars=Math.abs(measure.p2.barIdx-measure.p1.barIdx);
          const col=dP>=0?T.up:T.down;const txt=`${dP>=0?"+":""}${dP.toFixed(2)}  (${dP>=0?"+":""}${dPct.toFixed(2)}%)  ·  ${bars} bars`;
          const tw=txt.length*F(6.2)+16,mx=Math.max(Pad.l+2,Math.min(VW-Pad.r-tw-2,(x1+x2)/2-tw/2)),my=Math.max(Pad.t+2,Math.min(y1,y2)-F(26));
          return(<g style={{pointerEvents:"none"}}>
            <rect x={Math.min(x1,x2)} y={Math.min(y1,y2)} width={Math.abs(x2-x1)} height={Math.abs(y2-y1)} fill={col} opacity={0.08}/>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={1.4} strokeDasharray="5,3"/>
            <circle cx={x1} cy={y1} r={3.5} fill={col}/><circle cx={x2} cy={y2} r={3.5} fill={col}/>
            <rect x={mx} y={my} width={tw} height={F(20)} rx={5} fill={T.surface} stroke={col} strokeWidth={1}/>
            <text x={mx+8} y={my+F(14)} fill={col} fontSize={F(10)} fontWeight={700} fontFamily="monospace">{txt}</text>
          </g>);
        })()}
      </svg>
    </div>
  );
}


/* ════════════════════════════════════════════════════
   FULL-SCREEN CHART SHELL — portal overlay, native fullscreen when the browser allows it
════════════════════════════════════════════════════ */
function useWinSize(){
  const get=()=>({w:typeof window!=="undefined"?window.innerWidth:1024,h:typeof window!=="undefined"?(window.visualViewport?window.visualViewport.height:window.innerHeight):768});
  const [sz,setSz]=useState(get);
  useEffect(()=>{
    const f=()=>setSz(get());
    window.addEventListener("resize",f);window.addEventListener("orientationchange",f);
    if(window.visualViewport)window.visualViewport.addEventListener("resize",f);
    return()=>{window.removeEventListener("resize",f);window.removeEventListener("orientationchange",f);if(window.visualViewport)window.visualViewport.removeEventListener("resize",f);};
  },[]);
  return sz;
}
let UI_ZOOM=1; // set by StockScreener so overlays can cancel the text-size zoom
function FullChartShell({T,onClose,children}){
  const ref=useRef(null);
  useEffect(()=>{
    const prev=document.body.style.overflow;document.body.style.overflow="hidden";
    const key=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",key);
    let native=false;
    try{
      const el=ref.current;
      if(el&&el.requestFullscreen){
        el.requestFullscreen().then(()=>{native=true;try{if(screen.orientation&&screen.orientation.lock&&window.innerWidth<900)screen.orientation.lock("landscape").catch(()=>{});}catch{}}).catch(()=>{});
      }
    }catch{}
    const fsc=()=>{if(!document.fullscreenElement&&native){native=false;onClose();}};
    document.addEventListener("fullscreenchange",fsc);
    return()=>{
      document.body.style.overflow=prev;window.removeEventListener("keydown",key);document.removeEventListener("fullscreenchange",fsc);
      try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock();}catch{}
      try{if(document.fullscreenElement)document.exitFullscreen();}catch{}
    };
  },[]);// eslint-disable-line
  const node=(
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Full screen chart" style={{position:"fixed",top:0,left:0,width:UI_ZOOM===1?"100vw":`${100/UI_ZOOM}vw`,height:UI_ZOOM===1?"100dvh":`${100/UI_ZOOM}dvh`,zIndex:1000,background:T.bg,color:T.text,fontFamily:T.sans,display:"flex",flexDirection:"column",paddingTop:"env(safe-area-inset-top,0px)",paddingBottom:"env(safe-area-inset-bottom,0px)",paddingLeft:"env(safe-area-inset-left,0px)",paddingRight:"env(safe-area-inset-right,0px)",boxSizing:"border-box"}}>
      {children}
    </div>
  );
  return node;
}
const fmtVol=v=>v>1e9?(v/1e9).toFixed(2)+"B":v>1e6?(v/1e6).toFixed(2)+"M":v>1e3?(v/1e3).toFixed(1)+"K":String(v||0);
function ReadoutBar({bar,last,T,compact}){
  const b=bar||last;if(!b)return null;
  const col=b.close>=b.open?T.up:T.down;
  const chg=b.open?(b.close-b.open)/b.open*100:0;
  const cell=(l,v,c)=>(<div style={{display:"flex",flexDirection:"column",gap:1,minWidth:compact?54:70}}><span style={{fontSize:10,color:T.textSub,letterSpacing:".06em",textTransform:"uppercase"}}>{l}</span><span style={{fontFamily:T.mono,fontSize:compact?14:18,fontWeight:700,color:c||T.text,fontVariantNumeric:"tabular-nums"}}>{v}</span></div>);
  return(
    <div aria-live="off" style={{display:"flex",gap:compact?12:22,flexWrap:"wrap",alignItems:"flex-end",padding:compact?"6px 12px":"8px 16px",borderBottom:`1px solid ${T.border}`,background:T.surface}}>
      <div style={{display:"flex",flexDirection:"column",gap:1,minWidth:compact?80:110}}><span style={{fontSize:10,color:T.textSub,letterSpacing:".06em",textTransform:"uppercase"}}>{bar?"Bar":"Latest bar"}</span><span style={{fontFamily:T.mono,fontSize:compact?12:14,color:T.text}}>{b.date}</span></div>
      {cell("Open",b.open.toFixed(2))}{cell("High",b.high.toFixed(2),T.up)}{cell("Low",b.low.toFixed(2),T.down)}{cell("Close",b.close.toFixed(2),col)}
      {cell("Chg",(chg>=0?"+":"")+chg.toFixed(2)+"%",col)}
      {b.volume>0&&cell("Vol",fmtVol(b.volume))}
      {b.rsi!=null&&cell("RSI",b.rsi.toFixed(1),b.rsi>=70?T.down:b.rsi<=30?T.up:T.text)}
      {b.vwap!=null&&cell("VWAP",b.vwap.toFixed(2),"#60A5FA")}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   LINE CHART
════════════════════════════════════════════════════ */
// Stable signal dot renderers — outside component to prevent reference churn
const SigBuyDot=({cx,cy,payload})=>{if(!payload?._buy)return null;return(<g><polygon points={`${cx},${cy-9} ${cx+6},${cy} ${cx-6},${cy}`} fill="#00D084" opacity={0.92}><title>Buy: {payload._buyLbl}</title></polygon><line x1={cx} y1={cy} x2={cx} y2={cy+12} stroke="#00D084" strokeWidth={0.7} strokeDasharray="2,2" opacity={0.4}/></g>);};
const SigSellDot=({cx,cy,payload})=>{if(!payload?._sell)return null;return(<g><polygon points={`${cx},${cy+9} ${cx+6},${cy} ${cx-6},${cy}`} fill="#FF4560" opacity={0.92}><title>Sell: {payload._sellLbl}</title></polygon><line x1={cx} y1={cy} x2={cx} y2={cy-12} stroke="#FF4560" strokeWidth={0.7} strokeDasharray="2,2" opacity={0.4}/></g>);};

function LineChartView({data,showEMA,showSupport,srLevels,showVWAP,showBB,signals,showSignals,T,height=200,accent}){
  const [brushS,setBrushS]=useState(0);
  const [brushE,setBrushE]=useState(()=>Math.max(0,data.length-1));
  const divRef=useRef(null);
  const dsKey=`${data.length}|${data[0]?.date}`;
  useEffect(()=>{setBrushS(0);setBrushE(Math.max(0,data.length-1));},[dsKey]);// eslint-disable-line
  const isZoomed=brushS>0||brushE<data.length-1;
  const sigChartData=useMemo(()=>{
    // Always augment data regardless of showSignals — prevents chart resize on toggle
    if(!signals?.length)return{d:data,hasSigs:false};
    const m={};signals.forEach(s=>{if(!m[s.i])m[s.i]={buy:[],sell:[]};m[s.i][s.dir].push(s);});
    return{hasSigs:true,d:data.map((row,i)=>({...row,_buy:m[i]?.buy?.length?row.close:undefined,_buyLbl:m[i]?.buy?.map(s=>s.label).join(" · ")||"",_sell:m[i]?.sell?.length?row.close:undefined,_sellLbl:m[i]?.sell?.map(s=>s.label).join(" · ")||""}))};
  },[data,signals]); // ← no showSignals — data ref stays stable when toggle changes
  const onWheel=useCallback((e)=>{e.preventDefault();const vis=brushE-brushS,dir=e.deltaY>0?1:-1;const amt=Math.max(1,Math.floor(vis*0.12));const rect=divRef.current?.getBoundingClientRect();const ratio=rect?(e.clientX-rect.left)/rect.width:0.5;const dl=Math.round(amt*ratio),dr=amt-dl;const ns=Math.max(0,brushS+dir*dl),ne=Math.min(data.length-1,brushE-dir*dr);if(ne-ns>=4){setBrushS(ns);setBrushE(ne);}},[brushS,brushE,data.length]);
  useEffect(()=>{const el=divRef.current;if(!el)return;el.addEventListener("wheel",onWheel,{passive:false});return()=>el.removeEventListener("wheel",onWheel);},[onWheel]);
  const resetZoom=()=>{setBrushS(0);setBrushE(Math.max(0,data.length-1));};
  const col=accent||T.accent;
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11},labelStyle:{color:T.textSub},itemStyle:{color:T.text}};
  const fY=v=>v>=10000?(v/1000).toFixed(0)+"K":v>=100?v.toFixed(0):v.toFixed(2);
  return(
    <div ref={divRef} style={{position:"relative"}} onDoubleClick={resetZoom}>
      {isZoomed&&<div onClick={resetZoom} style={{position:"absolute",top:4,right:8,zIndex:10,background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 8px",fontSize:9,color:"#00D4AA",cursor:"pointer",fontWeight:700,fontFamily:"monospace",lineHeight:1.6}}>↺ {brushE-brushS+1}/{data.length}</div>}
      <ResponsiveContainer width="100%" height={height+20}>
        <ComposedChart data={sigChartData.d} margin={{top:6,right:8,left:0,bottom:0}}>
          <defs><linearGradient id={`grad-${col.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={col} stopOpacity={0.15}/><stop offset="95%" stopColor={col} stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke={T.chartGrid} strokeDasharray="2 5" vertical={false}/>
          <XAxis dataKey="date" tick={{fill:T.textSub,fontSize:8}} interval="preserveStartEnd"/>
          <YAxis domain={[(dMin)=>(dMin*0.998),(dMax)=>(dMax*1.002)]} tick={{fill:T.textSub,fontSize:8}} width={44} tickFormatter={fY}/>
          <Tooltip {...tt}/>
          <Area type="monotone" dataKey="close" stroke={col} fill={`url(#grad-${col.replace("#","")})`} strokeWidth={2} dot={false} name="Price"/>
          {showEMA&&<><Line type="monotone" dataKey="ema9" stroke={T.ema9} dot={false} strokeWidth={1} strokeDasharray="4 2" name="EMA 9" connectNulls={false}/><Line type="monotone" dataKey="ema20" stroke={T.ema20} dot={false} strokeWidth={1} name="EMA 20" connectNulls={false}/><Line type="monotone" dataKey="ema50" stroke={T.ema50} dot={false} strokeWidth={1.5} name="EMA 50" connectNulls={false}/></>}
          {showBB&&<><Line type="monotone" dataKey="bbUpper" stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="3 2" name="BB Upper" connectNulls={false} opacity={0.85}/><Line type="monotone" dataKey="bbMiddle" stroke="#A78BFA" dot={false} strokeWidth={1} name="BB Mid" connectNulls={false} opacity={0.45}/><Line type="monotone" dataKey="bbLower" stroke="#A78BFA" dot={false} strokeWidth={1} strokeDasharray="3 2" name="BB Lower" connectNulls={false} opacity={0.85}/></>}
          {showVWAP&&<Line type="monotone" dataKey="vwap" stroke="#60A5FA" dot={false} strokeWidth={1.8} name="VWAP" connectNulls={false}/>}
          {showSupport&&srLevels&&srLevels.map((z,i)=>(<ReferenceLine key={i} y={z.price} stroke={z.type==="support"?T.up:T.down} strokeDasharray="5 3" strokeWidth={1} opacity={0.45}/>))}
          {showSignals&&sigChartData&&sigChartData.hasSigs&&(
            <Line data={sigChartData.d} dataKey="_buy"  stroke="none" dot={SigBuyDot}  activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none"/>
          )}
          {showSignals&&sigChartData&&sigChartData.hasSigs&&(
            <Line data={sigChartData.d} dataKey="_sell" stroke="none" dot={SigSellDot} activeDot={false} isAnimationActive={false} connectNulls={false} legendType="none"/>
          )}
          <Brush dataKey="date" height={18} stroke={T.border} fill={T.surfaceB||T.surface} travellerWidth={8} startIndex={brushS} endIndex={brushE} onChange={({startIndex,endIndex})=>{if(startIndex!=null)setBrushS(startIndex);if(endIndex!=null)setBrushE(endIndex);}} tickFormatter={()=>""}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MACDPanel({data,T,h=70,fs=0}){
  const d=data.filter(x=>x.macd!=null);
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10},itemStyle:{color:T.text}};
  return(
    <ResponsiveContainer width="100%" height={h}>
      <ComposedChart data={d} margin={{top:2,right:8,left:0,bottom:0}}>
        <CartesianGrid stroke={T.chartGrid} strokeDasharray="2 5" vertical={false}/>
        <XAxis dataKey="date" tick={false}/>
        <YAxis tick={{fill:T.textSub,fontSize:fs||7}} width={fs?52:40} tickFormatter={v=>v.toFixed(2)}/>
        <Tooltip {...tt}/>
        <Bar dataKey="histogram" isAnimationActive={false}>{d.map((e,i)=><Cell key={i} fill={e.histogram>=0?`${T.up}55`:`${T.down}55`}/>)}</Bar>
        <Line type="monotone" dataKey="macd"   stroke={T.accent} dot={false} strokeWidth={1} name="MACD"/>
        <Line type="monotone" dataKey="signal" stroke={T.ema9}   dot={false} strokeWidth={1} strokeDasharray="3 2" name="Signal"/>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
function RSIPanel({data,T,h=80,fs=0}){
  const d=data.filter(x=>x.rsi!=null);
  const last=d.length?d[d.length-1].rsi:null;
  const rc=last>=70?T.down:last<=30?T.up:T.ema9;
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,fontSize:10},itemStyle:{color:T.text}};
  return(<ResponsiveContainer width="100%" height={h}><ComposedChart data={d} margin={{top:2,right:8,left:0,bottom:0}}>
    <CartesianGrid stroke={T.chartGrid} strokeDasharray="3 4" vertical={false}/>
    <XAxis dataKey="date" tick={false}/>
    <YAxis domain={[0,100]} tick={{fill:T.textSub,fontSize:fs||7}} width={fs?36:28} ticks={[30,50,70]}/>
    <Tooltip {...tt} formatter={v=>[v?.toFixed(1),"RSI(14)"]}/>
    <ReferenceLine y={70} stroke={T.down} strokeDasharray="3 3" strokeWidth={1} opacity={0.5}/>
    <ReferenceLine y={30} stroke={T.up}   strokeDasharray="3 3" strokeWidth={1} opacity={0.5}/>
    <ReferenceLine y={50} stroke={T.border} strokeWidth={0.8} opacity={0.6}/>
    <Area type="monotone" dataKey="rsi" stroke={rc} fill={`${rc}18`} strokeWidth={1.5} dot={false} isAnimationActive={false} name="RSI"/>
  </ComposedChart></ResponsiveContainer>);
}

function VolumePanel({data,T,h=50,fs=0}){
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10},formatter:v=>fmtVol(v)};
  return(
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{top:2,right:8,left:0,bottom:0}}>
        <XAxis dataKey="date" tick={false}/>
        <YAxis tick={{fill:T.textSub,fontSize:fs||7}} width={fs?52:40} tickFormatter={v=>v>=1e6?`${(v/1e6).toFixed(1)}M`:v>=1e3?`${(v/1e3).toFixed(0)}K`:String(v)}/>
        <Tooltip {...tt}/>
        <Bar dataKey="volume" isAnimationActive={false}>{data.map((e,i)=><Cell key={i} fill={e.isGreen?`${T.up}40`:`${T.down}40`}/>)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════
   TOOLTIP — hover-delayed on desktop, tap on mobile
════════════════════════════════════════════════════ */
function HelpTip({tip,children,T}){
  const [show,setShow]=useState(false);
  const timer=React.useRef(null);
  const mob=typeof window!=="undefined"&&window.innerWidth<640;
  const onEnter=()=>{if(mob)return;timer.current=setTimeout(()=>setShow(true),600);};
  const onLeave=()=>{clearTimeout(timer.current);setShow(false);};
  const onTap=e=>{if(!mob)return;e.stopPropagation();setShow(v=>!v);};
  return(
    <div style={{position:"relative",display:"inline-flex"}} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onTap}>
      {children}
      {show&&(
        <div style={{position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",
          background:T.surface,border:`1px solid ${T.accent}35`,borderRadius:8,padding:"8px 10px",
          fontSize:10,color:T.textSub,lineHeight:1.55,whiteSpace:"normal",width:190,zIndex:500,
          boxShadow:"0 4px 20px rgba(0,0,0,0.45)",pointerEvents:"none",textAlign:"left",
          animation:"fadeUp 0.1s ease"}}>
          {tip}
          {mob&&<div style={{fontSize:9,color:T.textSub,marginTop:4,borderTop:`1px solid ${T.border}`,paddingTop:4}}>Tap elsewhere to dismiss</div>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   TRADER'S GLOSSARY — one dictionary, used by hover/tap
   explainers (HelpTerm) and the searchable glossary sheet
════════════════════════════════════════════════════ */
const GLOSSARY={
  pe:{term:"P/E Ratio",cat:"Valuation",
    short:"How many dollars investors pay for $1 of the company's yearly profit.",
    why:"Pros compare P/E with the company's own history and with its peers. A high P/E means the market expects fast growth; a low one can mean cheap, or it can mean trouble."},
  peg:{term:"PEG Ratio",cat:"Valuation",
    short:"P/E divided by expected earnings growth. Around 1 means you pay a fair price for the growth.",
    why:"It fixes P/E's blind spot: a P/E of 40 can be cheap for a company growing 50% a year and pricey for one growing 5%. Under about 1.5 is the usual 'reasonable price' zone in growth-at-a-reasonable-price scans."},
  mktcap:{term:"Market Cap",cat:"Valuation",
    short:"Share price times number of shares: the total stock-market value of the company.",
    why:"It sets the size class. Large caps ('blue chips', roughly $10B and up) tend to move more steadily; small caps swing harder and are easier to get trapped in."},
  fcf:{term:"Free Cash Flow (FCF)",cat:"Financial health",
    short:"Cash left over after the company pays to run the business and buy equipment. It is what can fund dividends, buybacks, debt payments or growth.",
    why:"Profits can be shaped by accounting; cash is much harder to fake. Pros watch for companies that report profits but burn cash. Negative FCF is not always fatal (young growth companies often have it) but it means the business depends on outside funding."},
  de:{term:"Debt-to-Equity",cat:"Financial health",
    short:"Total debt divided by shareholders' equity. 1.0 means debt equals what owners have put in.",
    why:"Debt magnifies gains and losses and can sink a company when rates rise or sales dip. 'High' depends on the industry: banks and utilities run higher, software companies rarely need much."},
  intcov:{term:"Interest Coverage",cat:"Financial health",
    short:"How many times over the company's earnings could pay its interest bill.",
    why:"Under about 3x, one bad quarter could make debt payments a struggle. Above about 10x, even a large debt is comfortable."},
  margin:{term:"Net Profit Margin",cat:"Financial health",
    short:"Cents of profit the company keeps from each dollar of sales.",
    why:"It shows pricing power and cushion. Thin or negative margins leave little room for error when costs rise or demand slows."},
  revgrowth:{term:"Revenue Growth",cat:"Financial health",
    short:"How much sales grew compared with the same period a year earlier.",
    why:"Sales are the hardest number to dress up. Shrinking revenue while the stock looks cheap is a classic value-trap pattern."},
  liquidity:{term:"Daily Liquidity",cat:"Trading",
    short:"How much money changes hands in the stock on a typical day (average shares traded times price).",
    why:"In thinly traded stocks you may not be able to sell at the price you see, and a handful of orders can move the price. Many pros avoid or size down below roughly $10-20M traded per day."},
  relvol:{term:"Relative Volume",cat:"Trading",
    short:"Today's trading volume compared with the stock's normal volume. 2x means twice as many shares as usual.",
    why:"Big moves on big volume are more believable; breakouts on thin volume often fail. Early in the trading day this reads low because the day is not finished."},
  breakout:{term:"Breakout",cat:"Trading",
    short:"Price pushing above a recent high, the level where sellers previously stepped in.",
    why:"A breakout shows buyers overpowering sellers. Pros want it on strong volume and then watch whether price holds above the old high; many breakouts fail and fall back."},
  rs:{term:"Relative Strength",cat:"Trading",
    short:"How a stock performs compared with the market or its peers: beating them or lagging.",
    why:"Leaders tend to keep leading for a while (momentum), and strong stocks often hold up better when the market falls. Not the same thing as RSI, which measures speed of the stock's own moves."},
  rsi:{term:"RSI (Relative Strength Index)",cat:"Technicals",
    short:"A 0 to 100 gauge of how fast price rose or fell over the last 14 days. Under 30 is called oversold, over 70 overbought.",
    why:"It flags stretched moves. Oversold in a healthy company can precede a bounce; oversold in a failing one is just a falling knife, which is why health checks matter."},
  ema:{term:"EMA (Exponential Moving Average)",cat:"Technicals",
    short:"A smoothed average of recent prices that reacts faster to new moves than a simple average.",
    why:"Price above a rising EMA suggests an uptrend; a short EMA crossing above a longer one is read as growing momentum."},
  macd:{term:"MACD",cat:"Technicals",
    short:"Compares two moving averages to show whether momentum is building or fading.",
    why:"Pros watch for the MACD line crossing its signal line and for divergence from price as an early hint that a trend is tiring."},
  bb:{term:"Bollinger Bands",cat:"Technicals",
    short:"A channel drawn around a moving average that widens when prices are volatile.",
    why:"Price hugging the upper band shows strength, a squeeze (narrow bands) often comes before a big move, and a close outside the bands signals an unusually stretched move."},
  vwap:{term:"VWAP",cat:"Technicals",
    short:"The average price of the day weighted by volume: what the typical share actually traded at.",
    why:"Institutions use it as a benchmark. Price above VWAP means buyers are in control for the day, below means sellers."},
  beta:{term:"Beta",cat:"Risk",
    short:"How much the stock tends to swing compared with the overall market. 1.5 means about 50% more.",
    why:"It tells you how bumpy the ride may be. High-beta stocks magnify market moves both ways."},
  w52:{term:"52-Week Range",cat:"Risk",
    short:"The lowest and highest prices over the past year.",
    why:"Near the high suggests strong momentum; near the low can mean opportunity or continued weakness. Context decides which."},
  consensus:{term:"Analyst Consensus",cat:"Analysts",
    short:"The combined Buy / Hold / Sell stance of Wall Street analysts covering the stock.",
    why:"Always check how many analysts: 3 and 30 are very different signals. Analysts lean optimistic, so 'Hold' is often a quiet warning."},
  target:{term:"Price Target",cat:"Analysts",
    short:"Where analysts think the stock will trade in about 12 months (average of their estimates).",
    why:"Useful for gauging sentiment, not a promise. Targets are revised after the price moves, and analysts can be wrong or conflicted."},
  upside:{term:"Upside to Target",cat:"Analysts",
    short:"Percent gain needed to reach the average analyst price target from today's price.",
    why:"Large upside with few analysts, or with falling estimates, deserves skepticism."},
  revisions:{term:"Earnings Revisions",cat:"Analysts",
    short:"Analysts raising or cutting their profit forecasts after new information.",
    why:"Forecast changes tend to come in streaks, and cuts often precede disappointing results. This app's free data does not include estimate changes directly, so it tracks two proxies: drift in analyst ratings over about 3 months, and the last earnings surprise."},
  surprise:{term:"EPS Surprise",cat:"Analysts",
    short:"How far actual earnings per share came in above or below what analysts expected.",
    why:"Companies that keep missing tend to see forecasts cut. Repeated beats build trust, though a beat can still sell off if guidance disappoints."},
  valuetrap:{term:"Value Trap",cat:"Playbooks",
    short:"A stock that looks cheap (low P/E, big drop) but is cheap for a good reason: a shrinking business, heavy debt or cash burn.",
    why:"This is the beginner's most expensive mistake. The health flags in this app (debt, cash flow, falling expectations, thin trading) are the usual tells to check before buying a dip."},
  bluechip:{term:"Blue Chip",cat:"Playbooks",
    short:"A large, established company with a long record of stable operations.",
    why:"Blue chips rarely go to zero, so a sharp dip in one is more likely to be temporary than in a small speculative name. Rarely is not never."},
  garp:{term:"GARP",cat:"Playbooks",
    short:"Growth At a Reasonable Price: companies growing quickly that are not wildly expensive.",
    why:"It blends growth investing with value discipline: you want growth, but not at any price. Typical filters are a PEG under about 1.5, solid revenue growth, real profits and manageable debt."},
  oversold:{term:"Oversold Blue Chips",cat:"Playbooks",
    short:"Large, established companies whose recent fall pushed RSI low.",
    why:"Pros hunt for panic dips in quality names, then check that nothing is actually broken in the business."},
  quality:{term:"Quality Compounders",cat:"Playbooks",
    short:"Highly profitable companies that keep growing without piling on debt.",
    why:"Long-term investors like businesses that turn sales into real profit and cash, and reinvest at high returns. These are rarely cheap, so the price still matters."},
  dividend:{term:"Dividend Defenders",cat:"Playbooks",
    short:"Steady, profitable companies that pay you a regular dividend.",
    why:"A decent yield is only safe if the company is profitable and not overloaded with debt. A very high yield can be a warning sign, not a bargain."},
  momentum:{term:"Momentum Leaders",cat:"Playbooks",
    short:"Stocks that have been rising steadily and are still near their highs.",
    why:"Strong trends tend to persist for a while, but they can reverse quickly. Momentum is about the trend, not about value."},
  value:{term:"Deep Value",cat:"Playbooks",
    short:"Profitable companies priced low compared with their earnings.",
    why:"A low P/E can mean a bargain or a business in trouble. Checking profits, debt and sales growth helps tell the two apart."},
  opmargin:{term:"Operating Margin",cat:"Financial health",
    short:"The share of each sales dollar left after running costs, before interest and tax.",
    why:"High and stable operating margins usually signal pricing power or an efficient business."},
  divyield:{term:"Dividend Yield",cat:"Valuation",
    short:"Yearly dividend divided by the share price.",
    why:"A 3% yield pays $3 a year per $100 invested. Yields that are far above peers often mean the market expects a cut."},
  ret13w:{term:"13-week Return",cat:"Trading",
    short:"How much the price changed over about three months.",
    why:"Pros use it to see the medium-term trend. Large drops and large gains both tell you what the crowd has been doing."},
};
const GLOSSARY_CATS=["Valuation","Financial health","Trading","Technicals","Risk","Analysts","Playbooks"];
function openGlossary(k){
  try{window.dispatchEvent(new CustomEvent("open-glossary",{detail:k||null}));}catch{}
}

/* HelpTerm — wraps a label. Desktop: pause the cursor for ~0.5s. Mobile / keyboard: tap or Enter. */
function HelpTerm({k,T,children}){
  const g=GLOSSARY[k];
  const [open,setOpen]=useState(false);
  const [pos,setPos]=useState({x:0,y:0,up:true});
  const ref=useRef(null);
  const timer=useRef(null);
  const coarse=typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(hover: none)").matches;
  const show=()=>{
    if(ref.current){
      const r=ref.current.getBoundingClientRect();
      const w=Math.min(280,window.innerWidth-24);
      const x=Math.max(12,Math.min(window.innerWidth-w-12,r.left+r.width/2-w/2));
      const up=r.top>200;
      setPos({x,y:up?r.top-8:r.bottom+8,up,w});
    }
    setOpen(true);
  };
  const hide=()=>{clearTimeout(timer.current);setOpen(false);};
  useEffect(()=>{
    if(!open)return undefined;
    const onKey=e=>{if(e.key==="Escape")hide();};
    const onScroll=()=>{if(!coarse)hide();};
    window.addEventListener("keydown",onKey);
    window.addEventListener("scroll",onScroll,true);
    return()=>{window.removeEventListener("keydown",onKey);window.removeEventListener("scroll",onScroll,true);};
  },[open]);// eslint-disable-line
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  if(!g)return children;
  const id="gt-"+k;
  const toggle=e=>{e.stopPropagation();if(open)hide();else show();};
  const body=(
    <div>
      <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:4}}>{g.term}</div>
      <div style={{fontSize:11,color:T.text,lineHeight:1.5}}>{g.short}</div>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:T.textSub,marginTop:8,marginBottom:3}}>Why pros care</div>
      <div style={{fontSize:11,color:T.textSub,lineHeight:1.5}}>{g.why}</div>
      <button onClick={e=>{e.stopPropagation();hide();openGlossary(k);}} style={{marginTop:8,padding:0,border:"none",background:"transparent",color:T.accent,fontSize:11,cursor:"pointer",fontFamily:T.sans}}>Open glossary</button>
    </div>
  );
  const pop=open?(
    coarse
      ?(
        <div onClick={hide} style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,0.35)"}}>
          <div id={id} role="dialog" aria-label={g.term} onClick={e=>e.stopPropagation()}
            style={{position:"absolute",left:0,right:0,bottom:0,background:T.surface,borderTop:`1px solid ${T.border}`,borderRadius:"14px 14px 0 0",padding:"16px 16px 22px",maxHeight:"70vh",overflowY:"auto",boxShadow:"0 -8px 30px rgba(0,0,0,0.4)"}}>
            {body}
            <button onClick={hide} style={{marginTop:14,width:"100%",padding:"10px",borderRadius:10,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:12,cursor:"pointer",fontFamily:T.sans}}>Close</button>
          </div>
        </div>
      )
      :(
        <div id={id} role="tooltip"
          style={{position:"fixed",left:pos.x,top:pos.y,width:pos.w||280,transform:pos.up?"translateY(-100%)":"none",zIndex:3000,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",boxShadow:"0 8px 28px rgba(0,0,0,0.45)",textAlign:"left",fontFamily:T.sans,fontWeight:400,textTransform:"none",letterSpacing:0}}
          onClick={e=>e.stopPropagation()} onMouseEnter={()=>clearTimeout(timer.current)} onMouseLeave={hide}>
          {body}
        </div>
      )
  ):null;
  return(
    <span ref={ref} role="button" tabIndex={0} aria-describedby={open?id:undefined}
      onMouseEnter={()=>{if(coarse)return;clearTimeout(timer.current);timer.current=setTimeout(show,500);}}
      onMouseLeave={()=>{if(coarse)return;clearTimeout(timer.current);timer.current=setTimeout(hide,150);}}
      onFocus={()=>{if(!coarse)show();}}
      onBlur={()=>{if(!coarse)hide();}}
      onClick={toggle}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle(e);}}}
      style={{borderBottom:`1px dotted ${T.textSub}`,cursor:"help",outline:"none"}}>
      {children}
      {pop}
    </span>
  );
}

/* Searchable glossary sheet */
function GlossarySheet({T,focus,onClose}){
  const [q,setQ]=useState("");
  const focusRef=useRef(null);
  useEffect(()=>{
    const onKey=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[onClose]);
  useEffect(()=>{
    if(focus&&focusRef.current&&focusRef.current.scrollIntoView)focusRef.current.scrollIntoView({block:"center"});
  },[focus]);
  const ql=q.trim().toLowerCase();
  const keys=Object.keys(GLOSSARY).filter(k=>{
    if(!ql)return true;
    const g=GLOSSARY[k];
    return (g.term+" "+g.short+" "+g.why).toLowerCase().indexOf(ql)>=0;
  });
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:2500,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:12}}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-label="Trader's Glossary"
        style={{width:"100%",maxWidth:620,maxHeight:"88vh",display:"flex",flexDirection:"column",background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:"0 12px 40px rgba(0,0,0,0.5)",fontFamily:T.sans}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:15,fontWeight:700,color:T.text,flex:1}}>Trader's Glossary</div>
          <button onClick={onClose} aria-label="Close glossary" style={{padding:"4px 8px",borderRadius:6,border:"none",background:T.border,color:T.textSub,cursor:"pointer"}}><I.X s={11}/></button>
        </div>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search terms (e.g. cash flow, RSI, debt)" autoFocus={!focus}
            style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:13,outline:"none",fontFamily:T.sans}}/>
        </div>
        <div style={{overflowY:"auto",padding:"4px 16px 16px"}}>
          {GLOSSARY_CATS.map(cat=>{
            const items=keys.filter(k=>GLOSSARY[k].cat===cat);
            if(!items.length)return null;
            return(
              <div key={cat}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,margin:"16px 0 6px"}}>{cat}</div>
                {items.map(k=>{
                  const g=GLOSSARY[k];
                  const isF=focus===k;
                  return(
                    <div key={k} ref={isF?focusRef:null} style={{padding:"10px 12px",marginBottom:6,borderRadius:10,border:`1px solid ${isF?T.accent:T.border}`,background:isF?T.accentBg:T.surfaceB}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:3}}>{g.term}</div>
                      <div style={{fontSize:12,color:T.text,lineHeight:1.55}}>{g.short}</div>
                      <div style={{fontSize:12,color:T.textSub,lineHeight:1.55,marginTop:5}}><b style={{color:T.textSub}}>Why pros care: </b>{g.why}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {keys.length===0&&<div style={{padding:"24px 0",textAlign:"center",fontSize:12,color:T.textSub}}>No terms match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   FUNDAMENTALS CLIENT — cached batch fetch from /api/fundamentals
════════════════════════════════════════════════════ */
const FUND_KEY="screener_fund_v2";
function readFundCache(){try{return JSON.parse(localStorage.getItem(FUND_KEY)||"{}")||{};}catch{return {};}}
function writeFundCache(c){try{localStorage.setItem(FUND_KEY,JSON.stringify(c));}catch{}}
async function fetchFundamentals(syms,opts){
  const o=opts||{};
  const lite=!!o.lite;
  const maxAge=o.maxAge!=null?o.maxAge:6*3600e3;
  const cache=readFundCache();
  const now=Date.now();
  const out={};
  const need=[];
  syms.forEach(s=>{
    const c=cache[s];
    if(!o.force&&c&&c.v===2&&now-c.fetchedAt<maxAge&&(lite||!c.lite))out[s]=c;else need.push(s);
  });
  if(o.onBatch&&Object.keys(out).length)o.onBatch(Object.assign({},out));
  const batches=[];
  for(let i=0;i<need.length;i+=8)batches.push(need.slice(i,i+8));
  const fresh={};
  let idx=0;
  const worker=async()=>{
    while(idx<batches.length){
      const b=batches[idx++];
      try{
        const r=await fetch(`/api/fundamentals?symbols=${b.join(",")}${lite?"&lite=1":""}`,{signal:AbortSignal.timeout(25000)});
        if(!r.ok||(r.headers.get("content-type")||"").indexOf("json")<0)continue;
        const j=await r.json();
        const d=j.data||{};
        const got={};
        Object.keys(d).forEach(s=>{
          if(d[s]&&(d[s].hasMetrics||d[s].tech)){out[s]=d[s];fresh[s]=d[s];got[s]=d[s];}
        });
        if(o.onBatch&&Object.keys(got).length)o.onBatch(got);
      }catch{}
    }
  };
  await Promise.all([worker(),worker()]);
  // one gentle retry for tickers the data provider skipped (rate limits, slow responses)
  const lost=need.filter(x=>!out[x]);
  if(lost.length&&lost.length<need.length+1){
    await new Promise(r=>setTimeout(r,1500));
    for(let i=0;i<lost.length;i+=6){
      const b=lost.slice(i,i+6);
      try{
        const r=await fetch(`/api/fundamentals?symbols=${b.join(",")}${lite?"&lite=1":""}`,{signal:AbortSignal.timeout(25000)});
        if(!r.ok||(r.headers.get("content-type")||"").indexOf("json")<0)continue;
        const j=await r.json();
        const d=j.data||{};
        const got={};
        Object.keys(d).forEach(x=>{if(d[x]&&(d[x].hasMetrics||d[x].tech)){out[x]=d[x];fresh[x]=d[x];got[x]=d[x];}});
        if(o.onBatch&&Object.keys(got).length)o.onBatch(got);
      }catch{}
    }
  }
  if(Object.keys(fresh).length){
    const latest=readFundCache();
    Object.assign(latest,fresh);
    writeFundCache(latest);
  }
  return out;
}

/* ════════════════════════════════════════════════════
   HEALTH CHECK — red-flag engine (runs in the browser so
   thresholds can be tuned without redeploying the API)
════════════════════════════════════════════════════ */
const SECTOR_OF={
  AAPL:"tech",MSFT:"tech",NVDA:"tech",AVGO:"tech",ORCL:"tech",AMD:"tech",CRM:"tech",ADBE:"tech",INTC:"tech",CSCO:"tech",QCOM:"tech",PLTR:"tech",
  GOOGL:"comm",META:"comm",NFLX:"comm",DIS:"comm",T:"comm",VZ:"comm",
  AMZN:"disc",TSLA:"disc",HD:"disc",NKE:"disc",MCD:"disc",LOW:"disc",
  WMT:"staples",COST:"staples",PG:"staples",KO:"staples",PEP:"staples",
  JPM:"fin",BAC:"fin",GS:"fin",V:"fin",MA:"fin",WFC:"fin",AXP:"fin",
  UNH:"health",JNJ:"health",LLY:"health",PFE:"health",MRK:"health",ABBV:"health",TMO:"health",
  XOM:"energy",CVX:"energy",CAT:"ind",BA:"ind",GE:"ind",UPS:"ind",NEE:"util",
};
const POPULAR_50=Object.keys(SECTOR_OF);
const fmtMoneyM=n=>{
  const a=Math.abs(n);
  const s=a>=1e6?(a/1e6).toFixed(1)+"T":a>=1e3?(a/1e3).toFixed(1)+"B":a.toFixed(0)+"M";
  return (n<0?"-$":"$")+s;
};
const fmtMoney=n=>{
  const a=Math.abs(n);
  return "$"+(a>=1e9?(a/1e9).toFixed(1)+"B":a>=1e6?(a/1e6).toFixed(1)+"M":a>=1e3?(a/1e3).toFixed(0)+"K":a.toFixed(0));
};
function computeHealth(f,sector){
  const flags=[];
  let checks=0;
  if(!f)return {level:"nodata",label:"No data",flags:[],checks:0};
  const tech=f.tech||{};

  // 1. Debt load (not meaningful for banks / payment companies)
  if(sector!=="fin"&&f.debtToEquity!=null){
    checks++;
    const de=f.debtToEquity;
    const lim=sector==="util"?{w:2.5,c:4}:{w:1.5,c:3};
    const cov=f.interestCoverage;
    if(de<0){
      flags.push({id:"debt",sev:"info",title:"Negative shareholder equity",term:"de",
        detail:"Shareholders' equity is negative, which often happens after big buybacks. The debt ratio is not meaningful here, so look at total debt and interest coverage instead."});
    }else if(de>=lim.w){
      let sev=de>=lim.c?"caution":"watch";
      let extra="";
      if(cov!=null&&cov>=10){
        sev=sev==="caution"?"watch":"info";
        extra=` Earnings cover interest about ${cov.toFixed(0)}x, which makes it much more manageable.`;
      }else if(cov!=null&&cov<3){
        sev="caution";
        extra=` Earnings cover interest only ${cov.toFixed(1)}x, which is thin.`;
      }
      flags.push({id:"debt",sev,title:"High debt load",term:"de",
        detail:`Debt is ${de.toFixed(1)}x shareholders' equity (typical comfort level here is under ${lim.w}).${extra}`});
    }
  }

  // 2. Free cash flow
  if(f.fcfTTM!=null){
    checks++;
    if(f.fcfTTM<0){
      flags.push({id:"fcf",sev:"caution",title:"Negative free cash flow",term:"fcf",
        detail:`Free cash flow over the last 12 months is ${fmtMoneyM(f.fcfTTM)}: the business spent more cash than it brought in, so it relies on cash reserves, borrowing or selling new shares.`});
    }
  }

  // 3. Profitability
  if(f.netMarginPct!=null){
    checks++;
    if(f.netMarginPct<0){
      flags.push({id:"margin",sev:"watch",title:"Losing money",term:"margin",
        detail:`Net profit margin is ${f.netMarginPct.toFixed(1)}%: the company lost money over the last 12 months.`});
    }
  }

  // 4. Shrinking sales
  if(f.revGrowthPct!=null){
    checks++;
    if(f.revGrowthPct<0){
      flags.push({id:"rev",sev:f.revGrowthPct<-10?"caution":"watch",title:"Shrinking revenue",term:"revgrowth",
        detail:`Revenue is ${f.revGrowthPct.toFixed(1)}% versus a year ago. A cheap-looking stock with falling sales is a classic value trap.`});
    }
  }

  // 5. Falling expectations (proxy for negative earnings revisions)
  const d=f.ratingDrift;
  const sp=f.lastSurprisePct;
  if(d||sp!=null){
    checks++;
    const lines=[];
    let sev=null;
    if(d&&d.delta<=-0.25){
      sev=d.delta<=-0.5?"caution":"watch";
      lines.push(`Analyst ratings have cooled over about 3 months (net score ${d.then.toFixed(2)} to ${d.now.toFixed(2)} on a -2 to +2 scale).`);
    }
    if(sp!=null&&sp<=-5){
      if(sev!=="caution")sev="watch";
      lines.push(`The last earnings report missed estimates by ${Math.abs(sp).toFixed(1)}%.`);
    }
    if(sev){
      flags.push({id:"rev-est",sev,title:"Falling analyst expectations",term:"revisions",detail:lines.join(" ")});
    }
  }

  // 6. Liquidity
  const px=tech.price;
  const dollarVol=tech.avgDollarVol20!=null?tech.avgDollarVol20:(f.avgVolShares!=null&&px?f.avgVolShares*px:null);
  if(dollarVol!=null){
    checks++;
    if(dollarVol<5e6){
      flags.push({id:"liq",sev:"caution",title:"Very thin trading",term:"liquidity",
        detail:`Only about ${fmtMoney(dollarVol)} changes hands on a typical day. You may struggle to sell at the price you see, and small orders can move the price.`});
    }else if(dollarVol<2e7){
      flags.push({id:"liq",sev:"watch",title:"Low daily liquidity",term:"liquidity",
        detail:`About ${fmtMoney(dollarVol)} trades on a typical day. Fine for small orders, but exits can be bumpy in a sell-off.`});
    }
  }

  const cautions=flags.filter(x=>x.sev==="caution").length;
  const watches=flags.filter(x=>x.sev==="watch").length;
  const sevRank={caution:0,watch:1,info:2};
  flags.sort((a,b)=>sevRank[a.sev]-sevRank[b.sev]);
  let level="ok";
  if(checks<2)level="nodata";
  else if(cautions>0||watches>=3)level="caution";
  else if(watches>0)level="watch";
  const label={ok:"No flags",watch:"Watch",caution:"Caution",nodata:"No data"}[level];
  return {level,label,flags,checks,lite:!!f.lite};
}
const HEALTH_COLOR=T=>({ok:T.up,watch:"#F59E0B",caution:T.down,nodata:T.textSub});

function HealthBadge({h,T}){
  if(!h||h.level==="nodata")return null;
  const c=HEALTH_COLOR(T)[h.level];
  const n=h.flags.filter(x=>x.sev!=="info").length;
  const tip=h.level==="ok"?"No red flags found in debt, cash flow, profits, sales, analyst trend or liquidity":h.flags.filter(x=>x.sev!=="info").map(x=>x.title).join(", ");
  return(
    <span title={tip} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"1px 7px",borderRadius:10,background:`${c}18`,border:`1px solid ${c}40`,color:c,fontSize:9,fontWeight:700,letterSpacing:".04em",whiteSpace:"nowrap",fontFamily:T.sans}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c}}/>
      {h.label}{n>0&&h.level!=="ok"?` · ${n}`:""}
    </span>
  );
}

function HealthPanel({h,loading,T}){
  const colors=HEALTH_COLOR(T);
  const sevColor={caution:T.down,watch:"#F59E0B",info:T.textSub};
  const sevLabel={caution:"Caution",watch:"Watch",info:"Note"};
  return(
    <div style={{background:T.insightBg,border:`1px solid ${T.insightBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:h&&h.flags.length?10:0,flexWrap:"wrap"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Health Check</div>
        {h&&h.level!=="nodata"&&<HealthBadge h={h} T={T}/>}
        <HelpTerm k="valuetrap" T={T}><span style={{fontSize:10,color:T.textSub}}>Avoid value traps</span></HelpTerm>
      </div>
      {loading&&!h&&<div style={{fontSize:11,color:T.textSub,animation:"pulse 1.2s infinite"}}>Checking debt, cash flow, margins and liquidity…</div>}
      {!loading&&(!h||h.level==="nodata")&&(
        <div style={{fontSize:11,color:T.textSub,lineHeight:1.5,marginTop:6}}>Not enough fundamentals data to run the check. This is normal for ETFs, funds and very new listings.</div>
      )}
      {h&&h.level==="ok"&&(
        <div style={{fontSize:11,color:T.textSub,lineHeight:1.5,marginTop:6}}>
          <span style={{color:colors.ok,fontWeight:700}}>No red flags</span> in debt, free cash flow, profits, sales, analyst trend or daily liquidity. That does not make it a good buy; it only means the usual value-trap warning signs are absent.
        </div>
      )}
      {h&&h.flags.map(fl=>(
        <div key={fl.id} style={{display:"flex",gap:10,padding:"8px 0",borderTop:`1px solid ${T.insightBorder}`}}>
          <span style={{marginTop:5,width:7,height:7,borderRadius:"50%",background:sevColor[fl.sev],flexShrink:0}}/>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:T.text}}>
              <HelpTerm k={fl.term} T={T}>{fl.title}</HelpTerm>
              <span style={{marginLeft:8,fontSize:9,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:sevColor[fl.sev]}}>{sevLabel[fl.sev]}</span>
            </div>
            <div style={{fontSize:11,color:T.textSub,lineHeight:1.55,marginTop:2}}>{fl.detail}</div>
          </div>
        </div>
      ))}
      {h&&h.level!=="nodata"&&(
        <div style={{fontSize:9,color:T.textSub,lineHeight:1.5,marginTop:8,borderTop:`1px solid ${T.insightBorder}`,paddingTop:8}}>
          Flags are prompts to research, not buy or sell signals. Based on public financial data that can be delayed or incomplete.
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   TRADER PLAYBOOKS — ready-made scans over ~50 popular stocks
════════════════════════════════════════════════════ */
const okc=(pass,close)=>pass===true?"pass":pass===false?(close?"close":"fail"):"nodata";
const dipOf=f=>{
  const rsi=f.tech&&f.tech.rsi!=null?f.tech.rsi:null;
  if(rsi!=null)return{kind:"rsi",v:rsi};
  if(f.ret5d!=null)return{kind:"ret",v:f.ret5d};
  return null;
};
const sgn=n=>(n>=0?"+":"")+n.toFixed(1)+"%";
const PLAYBOOKS=[
  {id:"garp",name:"GARP",tagline:"Growth at a reasonable price",term:"garp",
    blurb:"Companies growing fast that are not wildly expensive, are actually profitable and do not carry heavy debt.",
    sortLabel:"Lowest PEG first",
    rank:(f)=>f.peg!=null?f.peg:99,
    criteria:(f,sector)=>{
      const peg=f.peg;
      const profitable=f.netMarginPct!=null?f.netMarginPct>0:(f.pe!=null?f.pe>0:null);
      const de=f.debtToEquity;
      const deNA=sector==="fin";
      return [
        {id:"peg",term:"peg",label:"PEG under 1.5",got:peg!=null?"PEG "+peg.toFixed(2):"no data",
          state:peg==null?"nodata":okc(peg>0&&peg<1.5,peg>0&&peg<2)},
        {id:"rev",term:"revgrowth",label:"Revenue growth over 10%",got:f.revGrowthPct!=null?"Sales "+sgn(f.revGrowthPct).replace(".0%","%"):"no data",
          state:f.revGrowthPct==null?"nodata":okc(f.revGrowthPct>10,f.revGrowthPct>7)},
        {id:"prof",term:"margin",label:"Profitable",got:profitable==null?"no data":profitable?"Profitable"+(f.netMarginPct!=null?" ("+f.netMarginPct.toFixed(0)+"% margin)":""):"Not profitable",
          state:profitable==null?"nodata":okc(profitable,false)},
        {id:"debt",term:"de",label:"Debt-to-equity under 1",got:deNA?"n/a for financials":de!=null?(de<0?"Negative equity":"D/E "+de.toFixed(2)):"no data",
          state:deNA?"pass":de==null?"nodata":okc(de>=0&&de<1,de>=0&&de<1.5)},
      ];
    }},
  {id:"oversold",name:"Oversold Blue Chips",tagline:"Big, established names on a sharp dip",term:"oversold",
    blurb:"Companies worth over $50B that have pulled back hard (RSI under 35, or down 4% or more in 5 days when price history is unavailable), without being in a free fall. Check the health badge before trusting a dip.",
    sortLabel:"Deepest dip first",
    rank:(f)=>{const d=dipOf(f);return d?(d.kind==="rsi"?d.v:50+d.v*3):99;},
    criteria:(f)=>{
      const cap=f.marketCapM;
      const d=dipOf(f);
      const r13=f.ret13w;
      return [
        {id:"cap",term:"mktcap",label:"Market cap over $50B",got:cap!=null?"Cap "+fmtMoneyM(cap):"no data",
          state:cap==null?"nodata":okc(cap>50000,cap>30000)},
        d&&d.kind==="ret"
          ?{id:"dip",term:"ret13w",label:"5-day return of -4% or worse",got:"5-day "+sgn(d.v),state:okc(d.v<=-4,d.v<=-2)}
          :{id:"dip",term:"rsi",label:"RSI under 35",got:d?"RSI "+d.v.toFixed(0):"no data",state:d?okc(d.v<35,d.v<45):"nodata"},
        {id:"free",term:"ret13w",opt:true,label:"Down less than 30% in 13 weeks",got:r13!=null?"13-wk "+sgn(r13):"no data",
          state:r13==null?"nodata":okc(r13>-30,r13>-40)},
      ];
    }},
  {id:"breakout",name:"High Relative Volume Breakouts",tagline:"Momentum with real participation",term:"breakout",
    blurb:"Stocks trading at 2x or more of their normal volume, pushing to a 20-day high and up on the day. These are rare on quiet days, so near-misses are shown too.",
    sortLabel:"Highest relative volume first",
    rank:(f)=>-(f.tech&&f.tech.relVol!=null?f.tech.relVol:0),
    criteria:(f)=>{
      const t=f.tech||{};
      return [
        {id:"rv",term:"relvol",label:"Volume at least 2x normal",got:t.relVol!=null?t.relVol.toFixed(1)+"x volume"+(t.volumePartial?" so far":""):"no data",
          state:t.relVol==null?"nodata":okc(t.relVol>=2,t.relVol>=1.5)},
        {id:"hi",term:"breakout",label:"At a 20-day high",got:t.high20!=null&&t.price!=null?(t.atHigh20?"At 20-day high":((t.price/t.high20-1)*100).toFixed(1)+"% from high"):"no data",
          state:t.high20==null||t.price==null?"nodata":okc(!!t.atHigh20,t.price>=t.high20*0.97)},
        {id:"up",term:"rs",label:"Up on the day",got:t.changePct!=null?sgn(t.changePct)+" today":"no data",
          state:t.changePct==null?"nodata":okc(t.changePct>0,false)},
      ];
    }},
  {id:"quality",name:"Quality Compounders",tagline:"High profit, steady growth, low debt",term:"quality",
    blurb:"Companies that keep more than 20% of sales as operating profit, are still growing, and do not lean on debt. They are rarely cheap, so check the price too.",
    sortLabel:"Highest operating margin first",
    rank:(f)=>-(f.opMarginPct!=null?f.opMarginPct:(f.netMarginPct!=null?f.netMarginPct:0)),
    criteria:(f,sector)=>{
      const mg=f.opMarginPct!=null?f.opMarginPct:f.netMarginPct;
      const de=f.debtToEquity;
      const deNA=sector==="fin";
      return [
        {id:"mg",term:"opmargin",label:"Operating margin over 20%",got:mg!=null?"Margin "+mg.toFixed(0)+"%":"no data",state:mg==null?"nodata":okc(mg>20,mg>15)},
        {id:"rev",term:"revgrowth",label:"Revenue growth over 8%",got:f.revGrowthPct!=null?"Sales "+sgn(f.revGrowthPct):"no data",state:f.revGrowthPct==null?"nodata":okc(f.revGrowthPct>8,f.revGrowthPct>5)},
        {id:"debt",term:"de",label:"Debt-to-equity under 1",got:deNA?"n/a for financials":de!=null?(de<0?"Negative equity":"D/E "+de.toFixed(2)):"no data",state:deNA?"pass":de==null?"nodata":okc(de>=0&&de<1,de>=0&&de<1.5)},
        {id:"fcf",term:"fcf",opt:true,label:"Positive free cash flow",got:f.fcfTTM!=null?"FCF "+fmtMoneyM(f.fcfTTM):"no data",state:f.fcfTTM==null?"nodata":okc(f.fcfTTM>0,false)},
      ];
    }},
  {id:"dividend",name:"Dividend Defenders",tagline:"Steady payers you can sleep on",term:"dividend",
    blurb:"Profitable companies yielding 2% or more with manageable debt and lower-than-market swings. Very high yields are not rewarded here, because they often signal trouble.",
    sortLabel:"Highest yield first",
    rank:(f)=>-(f.divYieldPct!=null?f.divYieldPct:0),
    criteria:(f,sector)=>{
      const y=f.divYieldPct,de=f.debtToEquity,deNA=sector==="fin";
      return [
        {id:"y",term:"divyield",label:"Dividend yield 2% to 8%",got:y!=null?"Yield "+y.toFixed(1)+"%":"no data",state:y==null?"nodata":okc(y>=2&&y<=8,y>=1.5&&y<=10)},
        {id:"prof",term:"margin",label:"Profitable",got:f.netMarginPct!=null?"Margin "+f.netMarginPct.toFixed(0)+"%":"no data",state:f.netMarginPct==null?"nodata":okc(f.netMarginPct>0,false)},
        {id:"debt",term:"de",label:"Debt-to-equity under 1.5",got:deNA?"n/a for financials":de!=null?(de<0?"Negative equity":"D/E "+de.toFixed(2)):"no data",state:deNA?"pass":de==null?"nodata":okc(de>=0&&de<1.5,de>=0&&de<2)},
        {id:"beta",term:"beta",opt:true,label:"Beta under 1",got:f.beta!=null?"Beta "+f.beta.toFixed(2):"no data",state:f.beta==null?"nodata":okc(f.beta<1,f.beta<1.15)},
      ];
    }},
  {id:"momentum",name:"Momentum Leaders",tagline:"Strong trends near their highs",term:"momentum",
    blurb:"Stocks up more than 10% over the last 13 weeks, positive this week and still near their 52-week high. Trends can reverse fast, so size positions carefully.",
    sortLabel:"Biggest 13-week gain first",
    rank:(f)=>-(f.ret13w!=null?f.ret13w:-99),
    criteria:(f)=>{
      const r=f.ret13w,w=f.ret5d;
      const px=f.tech&&f.tech.price!=null?f.tech.price:null;
      const hi=f.w52High;
      const near=px!=null&&hi!=null?px/hi:null;
      return [
        {id:"r13",term:"ret13w",label:"Up more than 10% in 13 weeks",got:r!=null?"13-wk "+sgn(r):"no data",state:r==null?"nodata":okc(r>10,r>5)},
        {id:"r5",term:"rs",label:"Positive over 5 days",got:w!=null?"5-day "+sgn(w):"no data",state:w==null?"nodata":okc(w>0,w>-1.5)},
        {id:"hi",term:"breakout",opt:true,label:"Within 8% of the 52-week high",got:near!=null?((near-1)*100).toFixed(1)+"% from high":"no data",state:near==null?"nodata":okc(near>=0.92,near>=0.85)},
      ];
    }},
  {id:"value",name:"Deep Value",tagline:"Profitable and priced low",term:"value",
    blurb:"Profitable companies trading under 15x earnings with sales that are not shrinking and debt under control. Cheap can be a trap, so the health badge matters here.",
    sortLabel:"Lowest P/E first",
    rank:(f)=>f.pe!=null&&f.pe>0?f.pe:99,
    criteria:(f,sector)=>{
      const pe=f.pe,de=f.debtToEquity,deNA=sector==="fin";
      return [
        {id:"pe",term:"pe",label:"P/E under 15",got:pe!=null?(pe>0?"P/E "+pe.toFixed(1):"No earnings"):"no data",state:pe==null?"nodata":okc(pe>0&&pe<15,pe>0&&pe<18)},
        {id:"prof",term:"margin",label:"Net margin over 5%",got:f.netMarginPct!=null?"Margin "+f.netMarginPct.toFixed(0)+"%":"no data",state:f.netMarginPct==null?"nodata":okc(f.netMarginPct>5,f.netMarginPct>2)},
        {id:"rev",term:"revgrowth",label:"Sales not shrinking",got:f.revGrowthPct!=null?"Sales "+sgn(f.revGrowthPct):"no data",state:f.revGrowthPct==null?"nodata":okc(f.revGrowthPct>=0,f.revGrowthPct>-3)},
        {id:"debt",term:"de",label:"Debt-to-equity under 1.5",got:deNA?"n/a for financials":de!=null?(de<0?"Negative equity":"D/E "+de.toFixed(2)):"no data",state:deNA?"pass":de==null?"nodata":okc(de>=0&&de<1.5,de>=0&&de<2)},
      ];
    }},
];
function evalPlaybook(pb,uni){
  const matches=[];
  const near=[];
  const rest=[];
  let nodataRows=0;
  Object.keys(uni).forEach(sym=>{
    const f=uni[sym];
    const sector=SECTOR_OF[sym];
    const cr=pb.criteria(f,sector);
    const eff=cr.filter(c=>!(c.opt&&c.state==="nodata"));
    const passN=eff.filter(c=>c.state==="pass").length;
    const closeN=eff.filter(c=>c.state==="close").length;
    const failN=eff.filter(c=>c.state==="fail").length;
    const noN=eff.filter(c=>c.state==="nodata").length;
    const row={sym,f,cr,rank:pb.rank(f),health:computeHealth(f,sector),score:passN*2+closeN};
    if(noN===eff.length){nodataRows++;return;}
    if(passN===eff.length)matches.push(row);
    else if(failN===0&&noN===0&&closeN>0)near.push(row);
    else if(passN+closeN>0)rest.push(row);
  });
  const byRank=(a,b)=>a.rank-b.rank;
  matches.sort(byRank);
  near.sort(byRank);
  rest.sort((a,b)=>b.score-a.score||a.rank-b.rank);
  return {matches,near:near.slice(0,8),closest:(matches.length+near.length===0)?rest.slice(0,6):[],nodataRows};
}
function PlaybookRow({row,names,T,inList,onAdd}){
  const st={pass:{c:T.up,m:"✓"},close:{c:"#F59E0B",m:"≈"},fail:{c:T.down,m:"✕"},nodata:{c:T.textSub,m:"?"}};
  const t=row.f.tech||{};
  return(
    <div style={{padding:"10px 12px",borderTop:`1px solid ${T.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div style={{minWidth:0,flex:"1 1 140px"}}>
          <span style={{fontSize:13,fontWeight:700,color:T.text}}>{row.sym}</span>
          <span style={{fontSize:10,color:T.textSub,marginLeft:6}}>{names[row.sym]||""}</span>
        </div>
        {t.price!=null&&<span style={{fontSize:12,fontWeight:700,color:T.text,fontVariantNumeric:"tabular-nums"}}>${t.price.toFixed(2)}</span>}
        {t.changePct!=null&&<span style={{fontSize:11,fontWeight:600,color:t.changePct>=0?T.up:T.down,fontVariantNumeric:"tabular-nums"}}>{t.changePct>=0?"+":""}{t.changePct.toFixed(2)}%</span>}
        <HealthBadge h={row.health} T={T}/>
        <button onClick={onAdd} disabled={inList} style={{padding:"3px 10px",borderRadius:6,border:`1px solid ${inList?T.border:T.accent}`,background:"transparent",color:inList?T.textSub:T.accent,fontSize:10,fontWeight:600,cursor:inList?"default":"pointer",fontFamily:T.sans}}>{inList?"In list":"+ Watch"}</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>
        {row.cr.map(c=>(
          <span key={c.id} title={c.label} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:6,border:`1px solid ${st[c.state].c}40`,background:`${st[c.state].c}12`,color:st[c.state].c,fontSize:10,fontWeight:600,fontFamily:T.sans}}>
            <span>{st[c.state].m}</span>
            <HelpTerm k={c.term} T={T}><span>{c.got}</span></HelpTerm>
          </span>
        ))}
      </div>
    </div>
  );
}
function PlaybooksPanel({T,names,tabSymbols,onAdd,embedded}){
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_pb_open")==="1";}catch{return false;}});
  const Head=embedded?"div":"button";
  const [pbId,setPbId]=useState(null);
  const [uni,setUni]=useState({});
  const [loading,setLoading]=useState(false);
  const [ranAt,setRanAt]=useState(null);
  const [showNear,setShowNear]=useState(true);
  const [missing,setMissing]=useState(0);
  useEffect(()=>{try{localStorage.setItem("screener_pb_open",open?"1":"0");}catch{}},[open]);
  const run=async(id,force)=>{
    setPbId(id);setLoading(true);
    try{
      const got=await fetchFundamentals(POPULAR_50,{lite:true,maxAge:30*60e3,force:!!force,onBatch:m=>setUni(p=>Object.assign({},p,m))});
      setMissing(POPULAR_50.filter(x=>!got[x]).length);
      setRanAt(new Date());
    }finally{setLoading(false);}
  };
  const pb=PLAYBOOKS.find(p=>p.id===pbId);
  const res=useMemo(()=>pb?evalPlaybook(pb,uni):null,[pb,uni]);
  const scanned=Object.keys(uni).length;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,marginBottom:14,boxShadow:T.shadow,overflow:"hidden"}}>
      <Head onClick={embedded?undefined:()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:embedded?"default":"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Trader Playbooks</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>Ready-made scans of 50 popular stocks. No filters to build.</span>
        {!embedded&&<span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>}
      </Head>
      {(embedded||open)&&(
        <div style={{borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",gap:8,padding:"12px 12px 4px",flexWrap:"wrap"}}>
            {PLAYBOOKS.map(p=>{
              const on=pbId===p.id;
              return(
                <button key={p.id} onClick={()=>run(p.id,false)} style={{flex:"1 1 180px",textAlign:"left",padding:"10px 12px",borderRadius:10,border:`1px solid ${on?T.accent:T.border}`,background:on?T.accentBg:T.surfaceB,cursor:"pointer",fontFamily:T.sans}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.text}}>{p.name}</div>
                  <div style={{fontSize:10,color:T.textSub,marginTop:2}}>{p.tagline}</div>
                </button>
              );
            })}
          </div>
          {!pb&&<div style={{padding:"8px 16px 14px",fontSize:11,color:T.textSub,lineHeight:1.5}}>Pick a playbook to scan. Each result shows exactly which rules it met, and the health badge warns you about value traps.</div>}
          {pb&&(
            <div style={{padding:"8px 0 0"}}>
              <div style={{padding:"4px 16px 10px"}}>
                <div style={{fontSize:12,color:T.text,lineHeight:1.55}}>
                  <HelpTerm k={pb.term} T={T}><b>{pb.name}</b></HelpTerm>{": "}{pb.blurb}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:6,fontSize:10,color:T.textSub,flexWrap:"wrap"}}>
                  <span>{loading?"Scanning…":`${scanned} stocks scanned${ranAt?" at "+ranAt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):""}`}</span>
                  <span>{pb.sortLabel}</span>
                  <button onClick={()=>run(pb.id,true)} disabled={loading} style={{padding:"2px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:10,cursor:loading?"default":"pointer",fontFamily:T.sans}}>Rescan</button>
                </div>
              </div>
              {loading&&<div style={{padding:"0 16px 10px"}}><LoadTimer T={T} label="Scanning 50 popular stocks" expected={25} done={scanned} total={POPULAR_50.length}/></div>}
              {!loading&&scanned===0&&(
                <div role="alert" style={{margin:"0 16px 12px",padding:"10px 12px",borderRadius:8,border:`1px solid ${T.down}55`,background:`${T.down}12`,fontSize:11,color:T.text,lineHeight:1.55}}>
                  The scan could not load any data. This usually means the market-data provider is busy or a key is missing on the server. Wait a minute and press Rescan.
                </div>
              )}
              {!loading&&scanned>0&&missing>0&&(
                <div style={{margin:"0 16px 10px",fontSize:10,color:T.textSub,lineHeight:1.5}}>{missing} of {POPULAR_50.length} stocks had no data this time (the provider limits how fast it answers). Press Rescan to fill them in.</div>
              )}
              {res&&scanned>0&&(
                <div>
                  <div style={{padding:"6px 16px",fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,background:T.surfaceB}}>Matches ({res.matches.length})</div>
                  {res.matches.length===0&&!loading&&(
                    <div style={{padding:"12px 16px",fontSize:11,color:T.textSub,lineHeight:1.5}}>No stock meets every rule right now. That is normal for strict scans, and a good lesson: good setups are rare. The closest candidates are below.</div>
                  )}
                  {res.matches.map(r=>(<PlaybookRow key={r.sym} row={r} names={names} T={T} inList={tabSymbols.indexOf(r.sym)>=0} onAdd={()=>onAdd(r.sym)}/>))}
                  {res.closest.length>0&&(
                    <div>
                      <div style={{padding:"6px 16px",fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,background:T.surfaceB}}>Closest candidates ({res.closest.length})</div>
                      {res.closest.map(r=>(<PlaybookRow key={r.sym} row={r} names={names} T={T} inList={tabSymbols.indexOf(r.sym)>=0} onAdd={()=>onAdd(r.sym)}/>))}
                    </div>
                  )}
                  {res.near.length>0&&(
                    <div>
                      <button onClick={()=>setShowNear(v=>!v)} style={{width:"100%",textAlign:"left",padding:"6px 16px",fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,background:T.surfaceB,border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",fontFamily:T.sans}}>
                        Near misses ({res.near.length}) · {showNear?"hide":"show"}
                      </button>
                      {showNear&&res.near.map(r=>(<PlaybookRow key={r.sym} row={r} names={names} T={T} inList={tabSymbols.indexOf(r.sym)>=0} onAdd={()=>onAdd(r.sym)}/>))}
                    </div>
                  )}
                </div>
              )}
              <div style={{padding:"10px 16px",fontSize:9,color:T.textSub,lineHeight:1.5,borderTop:`1px solid ${T.border}`}}>
                ✓ rule met · ≈ close to meeting it · ✕ not met · ? no data. Scans use end-of-day and delayed data and skip the analyst-trend check. Educational tool, not a recommendation to buy or sell.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   EARNINGS THIS WEEK — Mon-Fri calendar + watchlist snapshot
════════════════════════════════════════════════════ */
function ewToday(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function ewWeekRange(){
  const now=new Date();
  const dow=now.getDay(); // 0 Sun .. 6 Sat (local)
  const add=dow===0?1:dow===6?2:1-dow;
  const mon=new Date(now.getFullYear(),now.getMonth(),now.getDate()+add);
  const days=[];
  for(let i=0;i<5;i++){
    const d=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");
    days.push({iso:`${y}-${m}-${dd}`,dow:["SUN","MON","TUE","WED","THU","FRI","SAT"][d.getDay()],label:d.toLocaleString("en-US",{month:"short",day:"numeric"})});
  }
  return days;
}
const EW_SLOTS=[["bmo","Before the open"],["dmh","During hours"],["amc","After the close"],["","Time not set"]];
const ewSlot=h=>h==="bmo"||h==="amc"||h==="dmh"?h:"";
const ewSlotLabel=h=>({bmo:"Before open",amc:"After close",dmh:"During hours"}[h]||"Time not set");

function earnChipText(e){
  if(!e)return "";
  const d=new Date(e.date+"T12:00:00");
  const t=new Date();
  const same=d.getFullYear()===t.getFullYear()&&d.getMonth()===t.getMonth()&&d.getDate()===t.getDate();
  const day=same?"today":d.toLocaleString("en-US",{weekday:"short"});
  const slot={bmo:"before open",amc:"after close",dmh:"during hours"}[e.hour]||"";
  return "Earnings "+day+(slot?" · "+slot:"");
}
function EarnChip({e,T}){
  if(!e)return null;
  return(
    <span title="Reports earnings this week" style={{display:"inline-flex",alignItems:"center",gap:4,padding:"1px 7px",borderRadius:10,background:"#F59E0B18",border:"1px solid #F59E0B50",color:"#F59E0B",fontSize:9,fontWeight:700,letterSpacing:".03em",whiteSpace:"nowrap",fontFamily:T.sans}}>
      {earnChipText(e)}
    </span>
  );
}
function EwChip({label,value,color,T}){
  return(
    <div style={{padding:"6px 12px",borderRadius:10,background:T.surfaceB,border:`1px solid ${T.border}`,minWidth:84}}>
      <div style={{fontSize:15,fontWeight:700,color:color||T.text,fontVariantNumeric:"tabular-nums"}}>{value}</div>
      <div style={{fontSize:9,color:T.textSub,marginTop:1,letterSpacing:".04em"}}>{label}</div>
    </div>
  );
}
function EwBox({e,m,h,mine,name,T,onPick,onAdd}){
  const slotLbl=ewSlotLabel(ewSlot(e.hour));
  return(
    <div role={mine?"button":undefined} tabIndex={mine?0:undefined} onClick={mine?()=>onPick(e.symbol):undefined} onKeyDown={mine?ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();onPick(e.symbol);}}:undefined}
      style={{padding:"9px 10px",borderRadius:8,border:`1px solid ${mine?T.accent:T.border}`,background:mine?T.accentBg:T.surface,cursor:mine?"pointer":"default",minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontFamily:T.mono,fontSize:14,fontWeight:600,color:mine?T.accent:T.text,letterSpacing:"-.01em"}}>{e.symbol}</span>
        <span style={{flex:1}}/>
        {mine&&<HealthBadge h={h} T={T}/>}
      </div>
      <div style={{fontSize:11,color:T.textSub,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name||" "}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
        <div style={{borderLeft:`2px solid ${T.border}`,paddingLeft:7}}>
          <div style={{fontSize:9,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",color:T.textSub}}>EPS est.</div>
          <div style={{fontFamily:T.mono,fontSize:12,color:T.text,fontVariantNumeric:"tabular-nums"}}>{e.epsEstimate!=null?"$"+e.epsEstimate.toFixed(2):"n/a"}</div>
        </div>
        <div style={{borderLeft:`2px solid ${T.border}`,paddingLeft:7}}>
          <div style={{fontSize:9,fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",color:T.textSub}}>Revenue est.</div>
          <div style={{fontFamily:T.mono,fontSize:12,color:T.text,fontVariantNumeric:"tabular-nums"}}>{e.revenueEstimate!=null?fmtMoney(e.revenueEstimate):"n/a"}</div>
        </div>
      </div>
      {m&&(
        <div style={{fontSize:10,color:T.textSub,marginTop:7,lineHeight:1.5}}>
          Typical move <b style={{fontFamily:T.mono,color:T.text}}>±{m.avgAbsPct.toFixed(1)}%</b>
          {" · last "}<b style={{fontFamily:T.mono,color:m.lastPct>=0?T.up:T.down}}>{m.lastPct>=0?"+":""}{m.lastPct.toFixed(1)}%</b>
          {" · up "}{m.up}/{m.n}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",marginTop:7,fontSize:10}}>
        <span style={{color:T.textSub}}>{slotLbl}</span>
        <span style={{flex:1}}/>
        {mine&&<span style={{color:T.accent,fontWeight:600}}>Details →</span>}
        {!mine&&onAdd&&<button onClick={ev=>{ev.stopPropagation();onAdd(e.symbol);}} style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>+ Watch</button>}
      </div>
    </div>
  );
}
function EarningsWeek({symbols,stocks,healthMap,names,T,onWatch,onPick,onAdd,embedded}){
  const days=useMemo(ewWeekRange,[]);
  const from=days[0].iso,to=days[4].iso;
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_ew_open")!=="0";}catch{return true;}});
  const Head=embedded?"div":"button";
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);
  const [expanded,setExpanded]=useState({});
  const [scope,setScope]=useState("all");
  const railRef=useRef(null);
  const todayRef=useRef(null);
  const scrolledRef=useRef(false);
  useEffect(()=>{
    const r=railRef.current;
    if(!r||typeof ResizeObserver==="undefined")return undefined;
    const ro=new ResizeObserver(()=>{
      if(scrolledRef.current||!r.clientWidth||!todayRef.current)return;
      scrolledRef.current=true;
      r.scrollLeft=Math.max(0,todayRef.current.offsetLeft-r.offsetLeft-4);
    });
    ro.observe(r);
    return()=>ro.disconnect();
  });
  const toggleOpen=()=>{const n=!open;setOpen(n);try{localStorage.setItem("screener_ew_open",n?"1":"0");}catch{}};
  const pick=sym=>{if(!embedded)setOpen(false);if(onPick)onPick(sym);};
  const watchKey=symbols.slice().sort().join(",");
  useEffect(()=>{
    let dead=false;
    const ck="screener_ew_v2_"+from;
    try{
      const c=JSON.parse(localStorage.getItem(ck)||"null");
      if(c&&c.key===watchKey&&Date.now()-c.t<3*3600e3&&c.data){setData(c.data);setLoading(false);return undefined;}
    }catch{}
    setLoading(true);setErr(null);
    const jsonFetch=async url=>{
      const r=await fetch(url,{signal:AbortSignal.timeout(25000)});
      if(!r.ok||(r.headers.get("content-type")||"").indexOf("json")<0)throw new Error("HTTP "+r.status);
      return r.json();
    };
    const keep=[...new Set([...symbols,...POPULAR_50])].join(",");
    const MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    jsonFetch(`/api/earnings-week?from=${from}&to=${to}&symbols=${encodeURIComponent(keep)}&watch=${encodeURIComponent(symbols.slice(0,10).join(","))}`)
      .then(j=>{if(j.error)throw new Error(j.error);return j;})
      .catch(async e1=>{
        // Fallback: the older /api/events endpoint (watchlist tickers only)
        const live=await jsonFetch(`/api/events?symbols=${encodeURIComponent(symbols.join(","))}`);
        if(!Array.isArray(live))throw e1;
        const yr=new Date().getFullYear();
        const ev=[];
        live.forEach(x=>{
          const p=String(x.date||"").split(" ");
          const mi=MON[(p[0]||"").slice(0,3).toLowerCase()];
          const dd=parseInt(p[1],10);
          if(mi==null||!dd)return;
          const iso=`${yr}-${String(mi+1).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
          ev.push({symbol:x.s,date:iso,hour:x.when==="AMC"?"amc":x.when==="BMO"?"bmo":"",epsEstimate:x.epsEst!=null?x.epsEst:null,revenueEstimate:x.revEst!=null?x.revEst*1e9:null});
        });
        return {events:ev,moves:{},fallback:true,reason:e1.message};
      })
      .then(j=>{
        if(dead)return;
        setData(j);
        if(!j.fallback){try{localStorage.setItem(ck,JSON.stringify({key:watchKey,t:Date.now(),data:j}));}catch{}}
      })
      .catch(e=>{if(!dead)setErr("Earnings calendar unavailable ("+(e.message||"error")+")");})
      .finally(()=>{if(!dead)setLoading(false);});
    return()=>{dead=true;};
  },[watchKey,from]);// eslint-disable-line

  const watchSet=useMemo(()=>new Set(symbols),[watchKey]);// eslint-disable-line
  const events=(data&&data.events?data.events:[]).filter(e=>e.date>=from&&e.date<=to);
  const moves=data&&data.moves?data.moves:{};
  const mine=events.filter(e=>watchSet.has(e.symbol));
  useEffect(()=>{
    if(!onWatch||!data)return;
    const o={};
    mine.forEach(e=>{o[e.symbol]={date:e.date,hour:ewSlot(e.hour)};});
    onWatch(o);
  },[data]);// eslint-disable-line
  const byDay=useMemo(()=>{
    const o={};
    days.forEach(d=>{o[d.iso]=[];});
    events.forEach(e=>{if(o[e.date])o[e.date].push(e);});
    return o;
  },[events,days]);
  const dayName=iso=>{const d=days.find(x=>x.iso===iso);return d?d.dow+" "+d.label:iso;};

  // Watchlist snapshot (active tab)
  const priced=stocks.filter(x=>x.p&&x.pc);
  const upN=priced.filter(x=>x.p>=x.pc).length;
  const downN=priced.length-upN;
  const cautionN=stocks.filter(x=>healthMap[x.s]&&healthMap[x.s].level==="caution").length;
  const watchN=stocks.filter(x=>healthMap[x.s]&&healthMap[x.s].level==="watch").length;
  const reportingN=stocks.filter(x=>mine.some(e=>e.symbol===x.s)).length;
  const rangeLabel=days[0].label+" – "+days[4].label;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,marginBottom:14,boxShadow:T.shadow,overflow:"hidden"}}>
      <Head onClick={embedded?undefined:toggleOpen} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:embedded?"default":"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Earnings This Week</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>{rangeLabel}{data?` · ${events.length} reports, ${mine.length} on your watchlists`:""}</span>
        {!embedded&&<span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>}
      </Head>
      {(embedded||open)&&(
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 14px 14px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <EwChip label="Stocks in this list" value={stocks.length} T={T}/>
            <EwChip label="Up today" value={upN} color={T.up} T={T}/>
            <EwChip label="Down today" value={downN} color={T.down} T={T}/>
            <EwChip label="Report this week" value={reportingN} color={reportingN?T.accent:T.text} T={T}/>
            <EwChip label="Caution flags" value={cautionN} color={cautionN?T.down:T.text} T={T}/>
            <EwChip label="Watch flags" value={watchN} color={watchN?"#F59E0B":T.text} T={T}/>
          </div>

          {loading&&<LoadTimer T={T} label="Loading this week's earnings" expected={8}/>}
          {!loading&&err&&<div style={{fontSize:11,color:T.textSub,padding:"6px 0",lineHeight:1.5}}>{err}. Check that the api folder is deployed and FINNHUB_API_KEY is set in Vercel.</div>}
          {!loading&&!err&&data&&data.fallback&&<div style={{fontSize:10,color:T.textSub,padding:"0 0 8px",lineHeight:1.5}}>Showing your watchlist tickers only: the market-wide calendar (api/earnings-week) returned {data.reason}. Deploy that file to see all big reports.</div>}

          {!loading&&!err&&(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
                <div role="group" aria-label="Which reports to show" style={{display:"inline-flex",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.surface}}>
                  {[["all","All reports ("+events.length+")"],["mine","My stocks ("+mine.length+")"]].map(([k,l],i)=>(
                    <button key={k} aria-pressed={scope===k} onClick={()=>setScope(k)} style={{padding:"7px 13px",border:"none",borderLeft:i?`1px solid ${T.border}`:"none",background:scope===k?T.accent:"transparent",color:scope===k?T.accentInk:T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>{l}</button>
                  ))}
                </div>
                <span style={{fontSize:11,color:T.textSub}}>Swipe or scroll across the week. Tap one of your stocks to open its analysis.</span>
              </div>
              {mine.length===0&&<div style={{fontSize:11,color:T.textSub,marginBottom:10}}>None of your {symbols.length} tickers report this week.</div>}
              <div ref={railRef} style={{display:"grid",gridAutoFlow:"column",gridAutoColumns:"minmax(236px,1fr)",gap:10,overflowX:"auto",scrollSnapType:"x proximity",paddingBottom:8,WebkitOverflowScrolling:"touch"}}>
                {days.map(d=>{
                  const all=(byDay[d.iso]||[]).filter(e=>scope==="all"||watchSet.has(e.symbol));
                  const isOpen=!!expanded[d.iso];
                  const isToday=d.iso===ewToday();
                  return(
                    <div key={d.iso} ref={isToday?todayRef:undefined} style={{scrollSnapAlign:"start",background:T.surfaceB,border:`1px solid ${isToday?T.accent:T.border}`,borderRadius:8,padding:"10px 8px 8px",minWidth:0,display:"flex",flexDirection:"column",gap:6}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:8,padding:"0 4px 6px",borderBottom:`1px solid ${T.border}`}}>
                        <span style={{fontFamily:T.display,fontSize:18,fontWeight:700,color:isToday?T.accent:T.text,letterSpacing:"-.01em"}}>{d.dow}</span>
                        <span style={{fontFamily:T.mono,fontSize:11,color:T.textSub}}>{d.label}</span>
                        <span style={{flex:1}}/>
                        {isToday&&<span style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:T.accent}}>Today</span>}
                        <span style={{fontFamily:T.mono,fontSize:11,color:T.textSub}}>{all.length}</span>
                      </div>
                      {all.length===0&&<div style={{fontSize:11,color:T.textSub,padding:"8px 4px"}}>{scope==="mine"?"None of your stocks":"No big reports"}</div>}
                      {EW_SLOTS.map(([slot,label])=>{
                        const items=all.filter(e=>ewSlot(e.hour)===slot).sort((x,y)=>(watchSet.has(y.symbol)?1:0)-(watchSet.has(x.symbol)?1:0));
                        if(!items.length)return null;
                        const shown=isOpen?items:items.slice(0,6);
                        return(
                          <div key={slot||"tbd"} style={{display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:T.textSub,padding:"4px 4px 0"}}>{label}</div>
                            {shown.map(e=>(<EwBox key={e.symbol} e={e} m={moves[e.symbol]} h={healthMap[e.symbol]} mine={watchSet.has(e.symbol)} name={names[e.symbol]} T={T} onPick={pick} onAdd={onAdd}/>))}
                          </div>
                        );
                      })}
                      {all.length>6&&(
                        <button onClick={()=>setExpanded(p=>Object.assign({},p,{[d.iso]:!p[d.iso]}))} style={{padding:"6px 0",border:`1px dashed ${T.border}`,borderRadius:6,background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer",fontFamily:T.sans}}>
                          {isOpen?"Show fewer":`Show all ${all.length}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:T.textSub,lineHeight:1.5,marginTop:8}}>
                Shows your tickers, the popular-stock list and any report with an $8B+ revenue estimate. Estimates and dates come from public sources and can change. "Typical move" is the average 1-day price change after each of the last reports. A company can beat estimates and still fall. Educational tool, not financial advice.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   CHART CONTROLS
════════════════════════════════════════════════════ */
function ChartControls({tf,setTf,chartMode,setChartMode,ind,toggleInd,T,onFull,compact}){
  const [activeHelp,setActiveHelp]=useState(null);
  const helpDefs={
    "EMA":    {color:T.ema9, title:"EMA — Exponential Moving Average",body:"Smoothed trend lines. When price crosses EMA9 above EMA20 = bullish momentum. When it drops below = bearish."},
    "Vol":    {color:T.accent,title:"Volume",body:"How many shares traded. Rising price + rising volume = strong trend. Rising price + falling volume = suspect move."},
    "MACD":   {color:T.accent,title:"MACD — Convergence/Divergence",body:"Measures trend and momentum. MACD line crossing above signal = potential buy. Below = potential sell."},
    "S/R":    {color:T.up,   title:"Support & Resistance",body:"Support = price floor where buyers step in. Resistance = ceiling where sellers appear. Breaks on high volume signal strong directional moves."},
    "VWAP":   {color:"#60A5FA",title:"VWAP — Volume Weighted Avg Price",body:"The day's fair value by volume. Institutions use this as a bias filter. Price above VWAP = bullish. Below = bearish."},
    "BB":     {color:"#A78BFA",title:"Bollinger Bands",body:"Volatility envelope. When bands narrow (squeeze) a big move is coming. Candles touching the outer band often reverse or continue in a strong trend."},
    "RSI":    {color:T.ema9, title:"RSI — Relative Strength (0–100)",body:"Momentum gauge. Above 70 = overbought, may pull back. Below 30 = oversold, may bounce. Watch 50 as the bull/bear divider."},
    "Signals":{color:"#F43F5E",title:"Trade Signals",body:"Auto-detected crossovers from multiple indicators. Triangle up = bullish crossover. Triangle down = bearish. Use as one input — check volume and context."},
    "VP":     {color:"#F59E0B",title:"Volume Profile",body:"Shows where most trading happened at each price. The amber POC line = highest-volume price — markets are drawn back to it like a magnet."},
  };
  const chip=(active,color,label,onClick,disabled=false)=>(
    <button onClick={disabled?undefined:onClick} title={disabled?"Candle mode only":undefined} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${active?color:T.border}`,background:active&&!disabled?`${color}15`:"transparent",color:active&&!disabled?color:T.textSub,fontSize:10,cursor:disabled?"not-allowed":"pointer",fontWeight:active&&!disabled?600:400,transition:"all 0.12s",whiteSpace:"nowrap",fontFamily:T.sans,opacity:disabled?0.35:1}}>
      {label}
    </button>
  );
  const intraday=Object.entries(TIMEFRAMES).filter(([,v])=>v.group==="Intraday");
  const history =Object.entries(TIMEFRAMES).filter(([,v])=>v.group==="History");
  return(
    <div>
    <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:compact?"nowrap":"wrap",marginBottom:compact?6:10,width:compact?"max-content":undefined}}>
      {onFull&&<button onClick={onFull} title="Full screen chart" aria-label="Full screen chart" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,border:`1px solid ${T.accent}`,background:`${T.accent}15`,color:T.accent,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:T.sans,whiteSpace:"nowrap"}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>Full screen
      </button>}
      {/* Intraday group */}
      <div style={{display:"flex",background:T.surfaceB,border:`1px solid ${T.border}`,borderRadius:7,overflow:"hidden"}}>
        {intraday.map(([k])=>(
          <button key={k} onClick={()=>setTf(k)} style={{padding:"4px 8px",border:"none",borderRight:`1px solid ${T.border}`,background:tf===k?T.accent:"transparent",color:tf===k?"#fff":T.textSub,fontSize:10,cursor:"pointer",fontWeight:tf===k?600:400,fontFamily:T.sans}}>{k}</button>
        ))}
      </div>
      {/* History group */}
      <div style={{display:"flex",background:T.surfaceB,border:`1px solid ${T.border}`,borderRadius:7,overflow:"hidden"}}>
        {history.map(([k])=>(
          <button key={k} onClick={()=>setTf(k)} style={{padding:"4px 8px",border:"none",borderRight:`1px solid ${T.border}`,background:tf===k?T.accent:"transparent",color:tf===k?"#fff":T.textSub,fontSize:10,cursor:"pointer",fontWeight:tf===k?600:400,fontFamily:T.sans}}>{k}</button>
        ))}
      </div>
      <div style={{width:1,height:14,background:T.border}}/>
      {/* Chart type */}
      {chip(chartMode==="line",  T.accent,"Line",  ()=>setChartMode("line"))}
      {chip(chartMode==="candle",T.accent,"Candle",()=>setChartMode("candle"))}
      <div style={{width:1,height:14,background:T.border}}/>
      {/* Indicators */}
      {[["ema",ind.ema,T.ema9,"EMA"],["volume",ind.volume,T.accent,"Vol"],["macd",ind.macd,T.accent,"MACD"],["support",ind.support,T.up,"S/R"]].map(([k,active,color,label])=>(
        <button key={k} onClick={()=>toggleInd(k)}
          title={helpDefs[label]?.body||""}
          style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${ind[k]?helpDefs[label]?.color||T.accent:T.border}`,background:ind[k]?`${helpDefs[label]?.color||T.accent}15`:"transparent",color:ind[k]?helpDefs[label]?.color||T.accent:T.textSub,fontSize:10,cursor:"pointer",fontWeight:ind[k]?600:400,transition:"all 0.12s",whiteSpace:"nowrap",fontFamily:T.sans}}>
          {label}
        </button>
      ))}
      <div style={{width:1,height:14,background:T.border}}/>
      {[["vwap",ind.vwap,"#60A5FA","VWAP"],["bb",ind.bb,"#A78BFA","BB"],["rsi",ind.rsi,T.ema9,"RSI"],["signals",ind.signals,"#F43F5E","Signals"],["volProfile",ind.volProfile,"#F59E0B","VP"]].map(([k,active,color,label])=>{
        const dis=k==="volProfile"&&chartMode!=="candle";
        return(
          <button key={k} onClick={dis?undefined:()=>toggleInd(k)}
            title={helpDefs[label]?.body||""}
            style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${ind[k]&&!dis?helpDefs[label]?.color||T.accent:T.border}`,background:ind[k]&&!dis?`${helpDefs[label]?.color||T.accent}15`:"transparent",color:ind[k]&&!dis?helpDefs[label]?.color||T.accent:T.textSub,fontSize:10,cursor:dis?"not-allowed":"pointer",fontWeight:ind[k]&&!dis?600:400,transition:"all 0.12s",whiteSpace:"nowrap",fontFamily:T.sans,opacity:dis?0.35:1}}>
            {label}
          </button>
        );
      })}
      {/* Mobile glossary button — tap to open help */}
      <button onClick={()=>setActiveHelp(h=>h?"":helpDefs["EMA"]?"open":"")}
        style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${activeHelp?T.accent:T.border}`,background:activeHelp?`${T.accent}15`:"transparent",color:activeHelp?T.accent:T.textSub,fontSize:10,cursor:"pointer",fontFamily:T.sans,display:"flex",alignItems:"center",gap:3}}>
        <span style={{fontSize:11}}>ℹ</span>
      </button>
      {TIMEFRAMES[tf]?.group==="Intraday"&&(
        <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8,
          background:T.accentBg,color:T.accent,border:`1px solid ${T.accent}55`,
          letterSpacing:".05em",whiteSpace:"nowrap"}}>
          Pre+Post
        </span>
      )}
    </div>
    {/* Mobile / on-demand glossary — opened by ℹ button */}
    {activeHelp&&(
      <div style={{background:T.surfaceB,border:`1px solid ${T.accent}30`,borderRadius:10,padding:"12px 14px",marginTop:4,animation:"fadeUp 0.12s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:".06em"}}>Indicator Guide</span>
          <span style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>openGlossary(null)} style={{background:"none",border:"none",color:T.accent,cursor:"pointer",fontSize:10,fontFamily:T.sans}}>Full glossary</button><button onClick={()=>setActiveHelp("")} style={{background:"none",border:"none",color:T.textSub,cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button></span>
        </div>
        {Object.entries(helpDefs).map(([k,h])=>(
          <div key={k} style={{paddingBottom:7,marginBottom:7,borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:11,fontWeight:700,color:h.color||T.accent}}>{k}</span>
            <span style={{fontSize:10,color:T.textSub,lineHeight:1.5,marginLeft:8}}>{h.body}</span>
          </div>
        ))}
      </div>
    )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   INDEX CHART
════════════════════════════════════════════════════ */
function IndexChart({index,T}){
  const [tf,setTf]=useState("5m");
  const [chartMode,setChartMode]=useState("candle");
  const [ind,setInd]=useState({ema:false,volume:false,macd:false,support:false,vwap:false,bb:false,rsi:false,signals:false,volProfile:false});
  const toggleInd=k=>setInd(p=>({...p,[k]:!p[k]}));
  const [rawChart,setRawChart]=useState([]);
  const [chartLoading,setChartLoading]=useState(false);

  const [chartTf,setChartTf]=useState("5m");
  const shownIdx=useRef(null);
  useEffect(()=>{
    let cancelled=false;const sym=index.s;
    if(shownIdx.current!==sym){shownIdx.current=sym;setRawChart([]);}
    const hit=peekChart(sym,tf);
    if(hit){setRawChart(prev=>sameBars(prev,hit.bars)?prev:hit.bars);setChartTf(tf);setChartLoading(false);}
    else setChartLoading(true);
    const load=(force)=>getChart(sym,tf,{force}).then(bars=>{
      if(cancelled)return;
      if(bars&&bars.length>5){setRawChart(prev=>sameBars(prev,bars)?prev:bars);setChartTf(tf);}
      else if(!hit&&!force){setRawChart(getChartData(index.p||100,pct(index.p||100,index.pc||100),tf));setChartTf(tf);}
      setChartLoading(false);
    });
    if(!hit||!hit.fresh)load(false);
    const iv=setInterval(()=>{if(typeof document==="undefined"||document.visibilityState==="visible")load(true);},(YF_TF[tf]?.barMin||5)<1440?20000:90000);
    return()=>{cancelled=true;clearInterval(iv);};
  },[index.s,tf]);// eslint-disable-line

  const data=useMemo(()=>enrich(rawChart),[rawChart]);
  const sr=useMemo(()=>TIMEFRAMES[tf]?.barMin>=1440?findSR(rawChart):[],[rawChart,tf]);
  // Pre-compute extended-hours bands (avoids IIFE-in-JSX Babel issue)
  const extBands=useMemo(()=>{
    if(!data.some(d=>d.isExtended))return[];
    const bands=[];let s=null;
    data.forEach((d,i)=>{
      if(d.isExtended&&s===null)s=i;
      else if(!d.isExtended&&s!==null){bands.push({s,e:i-1,pre:data[s]?._ts&&new Date(data[s]._ts*1000).getUTCHours()<9});s=null;}
    });
    if(s!==null)bands.push({s,e:data.length-1,pre:false});
    return bands;
  },[data]);
  const signals=useMemo(()=>ind.signals?detectSignals(data):[],[data,ind.signals]);
  const ch=pct(index.p,index.pc),isUp=ch>=0;
  const col=isUp?T.up:T.down;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",marginBottom:14,boxShadow:T.shadow,animation:"fadeUp 0.18s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:11,color:T.textSub,fontWeight:500,marginBottom:4,fontFamily:T.sans}}>{index.name} · {index.s}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontSize:26,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{fN(index.p)}</span>
            <DailyChange p={index.p} pc={index.pc} T={T} size="md"/>
          </div>
        </div>
      </div>
      <ChartControls tf={tf} setTf={setTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T}/>
      {chartLoading&&rawChart.length===0&&<div style={{padding:"4px 0 10px"}}><LoadTimer T={T} compact label={"Loading "+index.name+" chart"} expected={4}/></div>}
      <div style={{opacity:chartLoading&&rawChart.length===0?0.35:1,transition:"opacity .2s"}}>
        {chartMode==="candle"
          ?<CandleChart data={data} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} showVolProfile={ind.volProfile} T={T} symbol={index.s} tf={chartTf} chartH={window.innerWidth<640?300:260}/>
          :<LineChartView data={data} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} T={T} height={185} accent={col}/>
        }
      </div>
      {ind.volume&&<div style={{marginTop:8}}><div style={{fontSize:8,color:T.textSub,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>Volume</div><VolumePanel data={data} T={T}/></div>}
      {ind.macd&&<div style={{marginTop:8}}><div style={{fontSize:8,color:T.textSub,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>MACD (12, 26, 9)</div><MACDPanel data={data} T={T}/></div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MARKET HERO — indices + news accordion + events
════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════
   INTELLIGENCE FEED — personalized stream for your watchlist
════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════
   MARKET BAR  (slim top strip, replaces index cards)
════════════════════════════════════════════════════════ */
function MarketBar({indices,selectedIdx,onSelectIdx,T}){
  const session=getMarketSession();
  const cfg=SESSION_CFG[session]||SESSION_CFG.closed;
  return(
    <div style={{display:"flex",alignItems:"center",gap:0,background:T.headerGrad||T.surface,
      borderBottom:`1px solid ${T.border}`,padding:"0 0 0 0",
      overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",
      marginBottom:14}}>
      {indices.map((idx,i)=>{
        const ch=pct(idx.p,idx.pc),isUp=ch>=0,isSel=selectedIdx?.s===idx.s;
        return(
          <button key={idx.s} onClick={()=>onSelectIdx(isSel?null:idx)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",
              background:isSel?`${isUp?T.up:T.down}12`:"transparent",
              border:"none",borderRight:`1px solid ${T.border}`,
              borderBottom:isSel?`2px solid ${T.accent}`:"2px solid transparent",
              cursor:"pointer",transition:"all 0.12s",whiteSpace:"nowrap",flexShrink:0}}>
            <span style={{fontSize:11,fontWeight:600,color:T.textSub,letterSpacing:".02em"}}>{idx.name}</span>
            <span style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:"var(--mono,monospace)",fontVariantNumeric:"tabular-nums"}}>
              {idx.p?fN(idx.p):"—"}
            </span>
            {idx.p>0&&<span style={{fontSize:11,fontWeight:700,color:isUp?T.up:T.down}}>
              {isUp?"▲":"▼"}{Math.abs(ch).toFixed(2)}%
            </span>}
          </button>
        );
      })}
      {/* Session badge — right side */}
      <div style={{marginLeft:"auto",padding:"0 16px",flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
        <span style={{width:6,height:6,borderRadius:3,background:cfg.color,display:"inline-block",
          boxShadow:session==="open"?`0 0 6px ${cfg.color}`:"none"}}/>
        <span style={{fontSize:10,fontWeight:600,color:cfg.color,letterSpacing:".04em"}}>{cfg.label}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MARKET HERO  (news + events below the bar)
════════════════════════════════════════════════════════ */
function MarketHero({T,symbols,news,refreshing}){
  const [events,setEvents]=useState(null);
  useEffect(()=>{
    setEvents({earnings:[],macro:KNOWN_EVENTS.macro.slice(0,4)});
    fetch(`/api/events?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then(r=>r.ok?r.json():[])
      .then(live=>{setEvents({
        earnings:(live.length?live:KNOWN_EVENTS.earnings.filter(e=>symbols.includes(e.s))).slice(0,8),
        macro:KNOWN_EVENTS.macro.slice(0,4),
      });}).catch(()=>{setEvents({
        earnings:KNOWN_EVENTS.earnings.filter(e=>symbols.includes(e.s)).slice(0,6),
        macro:KNOWN_EVENTS.macro.slice(0,4),
      });});
  },[symbols.join(",")]);// eslint-disable-line

  const [newsOpen,setNewsOpen]=useState(true);
  const [evOpen,setEvOpen]=useState(true);

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {/* Trending news */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.shadow}}>
        <div onClick={()=>setNewsOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:6}}>
            <I.News s={12} c={T.textSub}/>Trending News
          </span>
          {newsOpen?<I.ChevronUp s={11} c={T.textSub}/>:<I.ChevronDown s={11} c={T.textSub}/>}
        </div>
        {newsOpen&&(
          <div style={{borderTop:`1px solid ${T.border}`}}>
            {!news.length
              ?<div style={{padding:"10px 14px",fontSize:11,color:T.textSub}}>{refreshing?"Loading news…":"No news"}</div>
              :news.slice(0,5).map((n,i)=>(
                <a key={i} href={n.url||"#"} target="_blank" rel="noreferrer"
                  style={{display:"flex",gap:8,padding:"9px 14px",borderBottom:i<4?`1px solid ${T.border}`:"none",textDecoration:"none",cursor:"pointer",'&:hover':{background:T.surfaceB}}}>
                  <span style={{fontSize:13,flexShrink:0,marginTop:1,color:n.sentiment==="positive"?T.up:n.sentiment==="negative"?T.down:T.textSub}}>
                    {n.sentiment==="positive"?"↑":n.sentiment==="negative"?"↓":"·"}
                  </span>
                  <div>
                    <div style={{fontSize:11,color:T.text,lineHeight:1.4,marginBottom:2}}>{n.h}</div>
                    <div style={{fontSize:9,color:T.textSub}}>{n.publisher}{n.time?` · ${new Date(n.time*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"})}`:""}</div>
                  </div>
                </a>
              ))
            }
          </div>
        )}
      </div>

      {/* Upcoming events */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",boxShadow:T.shadow}}>
        <div onClick={()=>setEvOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer",userSelect:"none"}}>
          <span style={{fontSize:11,fontWeight:700,color:T.text,display:"flex",alignItems:"center",gap:6}}>
            <I.BarChart s={12} c={T.textSub}/>Upcoming Events
          </span>
          {evOpen?<I.ChevronUp s={11} c={T.textSub}/>:<I.ChevronDown s={11} c={T.textSub}/>}
        </div>
        {evOpen&&events&&(
          <div style={{borderTop:`1px solid ${T.border}`}}>
            {[...events.earnings,...events.macro].slice(0,6).map((e,i,arr)=>(
              <div key={i} style={{padding:"9px 14px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {e.s?<I.BarChart s={10} c={T.textSub}/>:<I.TrendUp s={10} c={T.textSub}/>}
                    <span style={{fontSize:12,color:T.text,fontWeight:600,fontFamily:e.s?T.mono:T.sans}}>{e.s||e.event}</span>
                    {e.when&&<span style={{fontSize:9,color:T.textSub,background:T.surfaceB,padding:"1px 5px",borderRadius:4,fontWeight:600}}>{e.when}</span>}
                    {e.impact&&<span style={{fontSize:9,color:e.impact==="high"?T.down:"#F59E0B",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{e.impact}</span>}
                  </div>
                  <span style={{fontSize:10,color:T.textSub,fontWeight:500,flexShrink:0}}>{e.date}</span>
                </div>
                {/* Earnings expectations row */}
                {e.s&&(e.epsEst!=null||e.beatRate!=null)&&(
                  <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
                    {e.epsEst!=null&&(
                      <span style={{fontSize:10,color:T.textSub}}>
                        EPS est <span style={{color:T.text,fontFamily:T.mono,fontWeight:600}}>${e.epsEst}</span>
                      </span>
                    )}
                    {e.revEst!=null&&(
                      <span style={{fontSize:10,color:T.textSub}}>
                        Rev est <span style={{color:T.text,fontFamily:T.mono,fontWeight:600}}>${e.revEst}B</span>
                      </span>
                    )}
                    {e.lastEPS!=null&&(
                      <span style={{fontSize:10,color:T.textSub}}>
                        Last <span style={{color:T.text,fontFamily:T.mono,fontWeight:600}}>${e.lastEPS}</span>
                      </span>
                    )}
                    {e.beatRate!=null&&(
                      <span style={{fontSize:10,fontWeight:700,
                        color:e.beatRate>=75?T.up:e.beatRate>=50?"#F59E0B":T.down}}>
                        Beat {e.beatRate}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!events.earnings.length&&!events.macro.length&&(
              <div style={{padding:"10px 14px",fontSize:11,color:T.textSub}}>No upcoming events</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════
   STOCK CARDS
════════════════════════════════════════════════════ */
function GridCard({stock,selected,onClick,removable,onRemove,names,T,refreshing,onSetAlert,health,earn}){
  const {s,p,pc,loading:ld,failed}=stock;
  const ch=pct(p||0,pc||1);
  const hasAlert=onSetAlert?getAlerts().some(a=>a.symbol===s&&!a.triggered):false;
  return(
    <div onClick={onClick} style={{position:"relative",background:selected?T.accentBg:T.surface,border:`1px solid ${selected?T.accent:T.border}`,borderRadius:12,padding:"12px 12px 10px",cursor:"pointer",boxShadow:selected?T.accentGlow:T.shadow,transition:"all 0.15s"}}>
      {/* Header row: ticker + name on left, price + action icons on right */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{s}</div>
          <div style={{fontSize:9,color:T.textSub,marginTop:1,fontFamily:T.sans}}>{ld?"Fetching…":failed?"—":(names[s]||s)}</div>
        </div>
        {/* Price + action buttons — all inline, no absolute positioning */}
        <div style={{display:"flex",alignItems:"flex-start",gap:4,flexShrink:0,marginLeft:8}}>
          <div style={{textAlign:"right"}}>
            {ld||refreshing
              ?<div style={{width:48,height:16,background:T.border,borderRadius:4,animation:"shimmer 1.2s infinite"}}/>
              :<div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{p<1?`$${p.toFixed(4)}`:`$${f2(p)}`}</div>
            }
          </div>
          {onSetAlert&&<button onClick={e=>{e.stopPropagation();onSetAlert();}} title={hasAlert?"Alert set":"Set alert"} style={{width:20,height:20,borderRadius:6,border:`1px solid ${hasAlert?T.accent:T.border}`,background:hasAlert?`${T.accent}20`:"transparent",color:hasAlert?T.accent:T.textSub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{hasAlert?<I.BellAlert s={10} c={T.accent}/>:<I.Bell s={10}/>}</button>}
          {removable&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{width:18,height:18,borderRadius:6,border:"none",background:T.border,color:T.textSub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I.X s={9}/></button>}
        </div>
      </div>
      {!ld&&!failed&&p>0&&(
        <div style={{margin:"4px 0"}}>
          <Sparkline price={p} changePct={ch} T={T} w={undefined} h={24}/>
        </div>
      )}
      <div style={{marginTop:4,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,flexWrap:"wrap"}}>
        {!ld&&!refreshing&&<DailyChange p={p} pc={pc} T={T}/>}
        {!ld&&!failed&&<HealthBadge h={health} T={T}/>}
      </div>
      {earn&&<div style={{marginTop:5}}><EarnChip e={earn} T={T}/></div>}
    </div>
  );
}
function ListRow({stock,selected,onClick,removable,onRemove,names,T,refreshing,health,earn}){
  const {s,p,pc,loading:ld}=stock;
  const ch=pct(p||0,pc||1);
  return(
    <div className="lr-wrap" style={{borderBottom:`1px solid ${T.border}`,background:selected?T.accentBg:"transparent"}}>
    <div onClick={onClick} style={{display:"flex",alignItems:"center",flexWrap:"wrap",rowGap:6,padding:"10px 14px 10px 14px",cursor:"pointer",transition:"background 0.1s",columnGap:10,minHeight:48}}>
      <div style={{flex:"1 1 72px",minWidth:72}}>
        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{s}</div>
        <div style={{fontSize:10,color:T.textSub,fontFamily:T.sans,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{ld?"Fetching…":(names[s]||s)}</div>
      </div>
      {!ld&&p>0&&<div className="lr-spark" style={{flexShrink:0,width:64,height:24,overflow:"hidden"}}><Sparkline price={p} changePct={ch} T={T} w={64} h={24}/></div>}
      <div style={{textAlign:"right",minWidth:60}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{p<1?`$${p.toFixed(4)}`:`$${f2(p)}`}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:8,flex:"0 1 auto",marginLeft:"auto",justifyContent:"flex-end",minWidth:0}}>
      {earn&&<EarnChip e={earn} T={T}/>}
      {!ld&&<HealthBadge h={health} T={T}/>}
      {!ld&&!refreshing&&<DailyChange p={p} pc={pc} T={T}/>}
      {removable&&<button onClick={e=>{e.stopPropagation();onRemove();}} aria-label={"Remove "+s} style={{padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer"}}><I.X s={10}/></button>}
      </div>
    </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   YF INSIGHTS — analyst data, price targets, news
════════════════════════════════════════════════════ */
const REC_CONFIG={
  strong_buy:  {label:"Strong Buy",  color:"#22C55E"},
  buy:         {label:"Buy",         color:"#4ADE80"},
  hold:        {label:"Hold",        color:"#F59E0B"},
  underperform:{label:"Underperform",color:"#F97316"},
  sell:        {label:"Sell",        color:"#EF4444"},
};

function YFInsights({symbol,price,T}){
  const [metricHelp,setMetricHelp]=useState(null); // which metric's help is showing
  // Definitions for key metrics shown in analyst panel
  const METRIC_HELP={
    pe:    {label:"Fwd P/E",tip:"Price-to-Earnings ratio — how much investors pay per $1 of earnings. Lower = potentially cheaper vs peers. Tech stocks often trade at high P/E due to growth expectations."},
    beta:  {label:"Beta",tip:"Market sensitivity. Beta 1.5 = 50% more volatile than S&P 500. Beta 0.5 = half as volatile. High beta = bigger swings both up and down."},
    w52:   {label:"52W Range",tip:"The stock's price range over the past 52 weeks. Trading near the high = strong momentum. Near the low = potential value OR continued weakness. Context matters."},
    target:{label:"Price Target",tip:"Where analysts think the stock will trade in 12 months. The average of all analyst targets. Upside % = how much higher vs current price if analysts are right."},
    cons:  {label:"Consensus",tip:"The overall analyst recommendation. Strong Buy means most analysts expect significant outperformance. Always check HOW MANY analysts — 2 analysts vs 20 are very different signals."},
    upside:{label:"Upside",tip:"% gain to reach the average analyst price target from current price. Positive = room to grow per analysts. Remember: analysts can be wrong and may have conflicts of interest."},
  };
  const [analyst,  setAnalyst] =useState(null);
  const [news,     setNews]    =useState([]);
  const [actions,  setActions] =useState([]);  // named analyst upgrades/downgrades
  const [earnings, setEarnings]=useState([]);  // quarterly EPS beat/miss history
  const [loading,  setLoading] =useState(true);

  useEffect(()=>{
    setLoading(true);setAnalyst(null);setNews([]);setActions([]);setEarnings([]);
    Promise.all([
      fetchBestAnalystData(symbol),
      fetchYFNews(symbol,5),
      fetchUpgradesHistory(symbol),
      fetchEarningsHistory(symbol),
    ]).then(([a,n,act,earn])=>{
      setAnalyst(a);
      setNews((n||[]).slice(0,4));
      setActions(act||[]);
      setEarnings((earn||[]).slice(0,4).reverse()); // chronological order
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[symbol]);

  if(loading) return(
    <div style={{padding:"16px",background:T.insightBg,border:`1px solid ${T.insightBorder}`,borderRadius:12}}>
      <LoadTimer T={T} compact label="Loading analyst data" expected={6}/>
    </div>
  );

  const rec     = analyst?.recommendationKey;
  const cfg     = REC_CONFIG[rec];
  const target  = analyst?.targetMeanPrice;
  const targetLow  = analyst?.targetLowPrice;
  const targetHigh = analyst?.targetHighPrice;
  const analysts   = analyst?.numberOfAnalysts;
  const upside  = target&&price?((target-price)/price*100):null;
  const pe      = analyst?.peRatioTTM;
  const beta    = analyst?.beta;
  const w52h    = analyst?.week52High;
  const w52l    = analyst?.week52Low;
  const buckets = analyst?.buckets;
  const upgrades = actions;  // from fetchUpgradesHistory (Yahoo Finance)

  const noData=!analyst&&!news.length;
  if(noData) return(
    <div style={{padding:"12px 16px",background:T.insightBg,border:`1px solid ${T.insightBorder}`,borderRadius:12}}>
      <div style={{fontSize:11,color:T.textSub,fontFamily:T.sans}}>No analyst data available for {symbol}.</div>
    </div>
  );

  return(
    <div style={{background:T.insightBg,border:`1px solid ${T.insightBorder}`,borderRadius:12,overflow:"hidden"}}>
      {/* Analyst consensus header */}
      {cfg&&(
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.insightBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans,marginBottom:3}}>Analyst Consensus · {analysts||"—"} analysts </div>
            <span style={{padding:"3px 12px",borderRadius:7,background:`${cfg.color}22`,color:cfg.color,fontSize:13,fontWeight:700,fontFamily:T.sans}}>{cfg.label}</span>
          </div>
          {upside!==null&&(
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:9,color:T.textSub,fontFamily:T.sans,marginBottom:2}}>Avg Target</div>
              <div style={{fontFamily:T.mono,fontSize:14,fontWeight:700,color:T.text}}>${target?.toFixed(2)}</div>
              <div style={{fontSize:11,fontWeight:600,color:upside>=0?T.up:T.down,fontFamily:T.sans}}>{upside>=0?"+":""}{upside.toFixed(1)}% upside</div>
            </div>
          )}
        </div>
      )}

      {/* Price target range bar */}
      {targetLow&&targetHigh&&price&&(
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.insightBorder}`}}>
          <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans,marginBottom:6}}>12-Month Price Target Range</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:T.mono,fontSize:10,color:T.down,minWidth:44}}>${targetLow.toFixed(0)}</span>
            <div style={{flex:1,position:"relative",height:6,background:T.border,borderRadius:3}}>
              <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:`linear-gradient(90deg,${T.down}60,${T.up}60)`,borderRadius:3}}/>
              {/* Current price marker */}
              {price&&(()=>{const pct=Math.max(0,Math.min(100,((price-targetLow)/(targetHigh-targetLow))*100));return(
                <div style={{position:"absolute",top:-3,width:12,height:12,borderRadius:6,background:T.text,border:`2px solid ${T.surface}`,left:`calc(${pct}% - 6px)`,boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
              );})()}
            </div>
            <span style={{fontFamily:T.mono,fontSize:10,color:T.up,minWidth:44,textAlign:"right"}}>${targetHigh.toFixed(0)}</span>
          </div>
          <div style={{textAlign:"center",fontSize:9,color:T.textSub,marginTop:4,fontFamily:T.sans}}>◆ current ${price.toFixed(2)}</div>
        </div>
      )}

      {/* Key stats */}
      {(pe||beta||w52h||w52l)&&(
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.insightBorder}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Fwd P/E",pe?.toFixed(1)],["Beta",beta?.toFixed(2)],["52W High",w52h?`$${w52h.toFixed(2)}`:null],["52W Low",w52l?`$${w52l.toFixed(2)}`:null]]
            .filter(([,v])=>v).map(([l,v])=>(
            <div key={l} style={{background:T.surface,borderRadius:6,padding:"6px 10px"}}>
              <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:T.sans}}>{l}</div>
              <div style={{fontFamily:T.mono,fontSize:12,fontWeight:600,color:T.text,marginTop:2}}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent analyst actions — named upgrade/downgrade history */}
      {upgrades.length>0&&(
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.insightBorder}`}}>
          <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,fontFamily:T.sans}}>Recent Analyst Actions</div>
          {upgrades.map((u,i)=>{
            const isUp=u.action==="up";const isDn=u.action==="down";
            const col=isUp?T.up:isDn?T.down:T.textSub;
            return(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,paddingBottom:6,marginBottom:6,borderBottom:i<upgrades.length-1?`1px solid ${T.border}`:"none"}}>
                <span style={{fontSize:12,color:col,fontWeight:700,flexShrink:0,paddingTop:1}}>{isUp?"↑":isDn?"↓":"→"}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.text}}>{u.firm}</div>
                  <div style={{fontSize:10,color:T.textSub}}>
                    {u.fromGrade&&u.fromGrade!==u.toGrade?`${u.fromGrade} → `:""}{u.toGrade}
                    <span style={{color:isUp?T.up:isDn?T.down:T.textSub,fontWeight:700,marginLeft:5}}>
                      {isUp?"Upgraded":isDn?"Downgraded":"Maintained"}
                    </span>
                  </div>
                </div>
                <span style={{fontSize:9,color:T.textSub,flexShrink:0,paddingTop:2}}>{u.date}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Earnings beat/miss history — last 4 quarters */}
      {earnings.length>0&&(
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.insightBorder}`}}>
          <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,fontFamily:T.sans}}>Earnings History</div>
          <div style={{display:"flex",gap:6}}>
            {earnings.map((q,i)=>{
              const beat=q.beat===true;const miss=q.beat===false;
              const col=beat?T.up:miss?T.down:T.textSub;
              const surp=q.surprisePercent;
              return(
                <div key={i} style={{flex:1,background:T.surface,borderRadius:8,padding:"8px 6px",textAlign:"center",border:`1px solid ${beat?`${T.up}40`:miss?`${T.down}40`:T.border}`}}>
                  <div style={{fontSize:8,color:T.textSub,marginBottom:4}}>
                    {q.quarter?`Q${q.quarter}`:""}{q.year?`'${String(q.year).slice(2)}`:""}
                  </div>
                  {/* Mini bar — estimate vs actual */}
                  {q.estimate!=null&&q.actual!=null&&(()=>{
                    const ref=Math.max(Math.abs(q.estimate),Math.abs(q.actual),0.01);
                    const estH=Math.round((Math.abs(q.estimate)/ref)*28);
                    const actH=Math.round((Math.abs(q.actual)/ref)*28);
                    return(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:2,height:32,marginBottom:4}}>
                        <div style={{width:7,height:estH,background:T.border,borderRadius:"2px 2px 0 0"}} title={`Est $${q.estimate}`}/>
                        <div style={{width:7,height:actH,background:col,borderRadius:"2px 2px 0 0",opacity:0.9}} title={`Act $${q.actual}`}/>
                      </div>
                    );
                  })()}
                  <div style={{fontSize:9,fontWeight:700,color:col}}>{beat?"BEAT":miss?"MISS":"—"}</div>
                  {surp!=null&&<div style={{fontSize:8,color:col,marginTop:1}}>{surp>0?"+":""}{surp.toFixed(1)}%</div>}
                  {q.actual!=null&&<div style={{fontSize:8,color:T.textSub,marginTop:1,fontFamily:T.mono}}>${q.actual}</div>}
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:6,fontSize:9,color:T.textSub,justifyContent:"center"}}>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,background:T.border,borderRadius:1,display:"inline-block"}}/>Est</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:7,height:7,background:T.up,borderRadius:1,display:"inline-block",opacity:.8}}/>Actual</span>
          </div>
        </div>
      )}


      {/* Latest news */}
      {news.length>0&&(
        <div style={{padding:"10px 16px"}}>
          <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:7,fontFamily:T.sans}}>Latest News</div>
          {news.map((n,i)=>(
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
              display:"block",padding:"7px 0",
              borderBottom:i<news.length-1?`1px solid ${T.border}`:"none",
              textDecoration:"none",
            }}>
              <div style={{fontSize:11,color:T.text,lineHeight:1.4,fontFamily:T.sans}}>{n.title}</div>
              <div style={{fontSize:9,color:T.textSub,marginTop:2,fontFamily:T.sans}}>
                {n.publisher} · {new Date((n.providerPublishTime||0)*1000).toLocaleDateString()}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════
   DEEP ANALYSIS — uses /api/claude directly, no separate deploy needed
════════════════════════════════════════════════════ */
function DeepAnalysis({symbol,T,autoRun}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const CACHE_KEY=`deepanalysis_${symbol}_${new Date().toDateString()}`;

  useEffect(()=>{
    try{const c=localStorage.getItem(CACHE_KEY);if(c){const d=JSON.parse(c);if(d?.movement?.length)setData(d);}}catch{}
  },[CACHE_KEY]);

  const generate=async()=>{
    setLoading(true);setError(null);
    try{
      const [analyst,news,earn]=await Promise.all([
        fetchBestAnalystData(symbol),
        fetchYFNews(symbol,5),
        fetchEarningsHistory(symbol),
      ]);
      const a=analyst||{};const earns=(earn||[]).slice(0,4);
      const beatCt=earns.filter(q=>q.beat===true).length;
      const earnsText=earns.length?earns.map(q=>`Q${q.quarter||"?"} ${q.year||""}: ${q.beat===true?"BEAT":q.beat===false?"MISS":"N/A"}${q.surprisePercent!=null?` (${q.surprisePercent>0?"+":""}${q.surprisePercent.toFixed(1)}%)`:""}  EPS $${q.actual??"-"} vs $${q.estimate??"-"}`).join("; "):"No earnings data";
      const newsText=(news||[]).slice(0,4).map((n,i)=>`${i+1}. ${n.title||n.h||""}`).join("; ")||"No recent news";
      const ctx=`STOCK: ${symbol}
ANALYST: ${a.recommendationKey||"N/A"} (${a.numberOfAnalysts||0} analysts) | Target avg $${a.targetMeanPrice?.toFixed(2)||"-"} high $${a.targetHighPrice||"-"} low $${a.targetLowPrice||"-"}
BUCKETS: SB${a.buckets?.strongBuy||0} B${a.buckets?.buy||0} H${a.buckets?.hold||0} S${a.buckets?.sell||0} SS${a.buckets?.strongSell||0}
PE: ${a.peRatioTTM?.toFixed(1)||"N/A"}x | Beta: ${a.beta?.toFixed(2)||"N/A"} | 52W: $${a.week52Low||"-"}–$${a.week52High||"-"}
EARNINGS (${beatCt}/${earns.length} beats): ${earnsText}
NEWS: ${newsText}`;
      const prompt=`Analyze ${symbol} using ONLY this data. Rules: every bullet must cite a specific number; no generic phrases; max 20 words each.
${ctx}
Return ONLY valid JSON:
{"movement":["b1","b2","b3"],"bulls":["b1","b2","b3"],"bears":["b1","b2","b3"],"oneLiner":"one sentence thesis"}`;
      const res=await fetch("/api/analyze",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({symbol,context:ctx})
      });
      // Guard against HTML error pages (404/500) before calling .json()
      const ct=res.headers.get("content-type")||"";
      if(!ct.includes("application/json")){
        if(res.status===404)throw new Error("api/analyze.js not found on server — commit it to your GitHub repo and redeploy to Vercel");
        const html=await res.text().catch(()=>"");
        throw new Error(`Server returned ${res.status} (non-JSON). Check Vercel deployment logs.`);
      }
      const raw=await res.json();
      if(!res.ok){
        const detail=raw.error||raw.anthropic_type||`HTTP ${res.status}`;
        // Only show billing link for the specific Anthropic credit error type
        const isCreditErr=raw.anthropic_type==="credit_balance_too_low"||
          (typeof detail==="string"&&detail.toLowerCase().includes("credit balance"));
        throw new Error(isCreditErr
          ?"Anthropic API credits required — add credits at console.anthropic.com/billing"
          :detail); // show actual error for anything else
      }
      if(raw.error)throw new Error(raw.error);
      const txt=JSON.stringify(raw);
      const parsed=raw.movement?raw:JSON.parse((txt.match(/\{[\s\S]*\}/)||["{}"])[0]);
      if(!parsed.movement?.length)throw new Error("Empty analysis");
      parsed.generatedAt=new Date().toISOString();
      setData(parsed);
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(parsed));}catch{}
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  };

  const autoDone=useRef("");
  useEffect(()=>{
    if(!autoRun||autoDone.current===symbol)return;
    autoDone.current=symbol;
    let cached=false;
    try{cached=!!localStorage.getItem(CACHE_KEY);}catch{}
    if(!cached)generate();
  },[symbol,autoRun]);// eslint-disable-line

  const sections=[
    {key:"movement",label:"Why This Stock Moved",color:"#7C6FF7",icon:"◉"},
    {key:"bulls",   label:"Bull Case",           color:T.up,     icon:"▲"},
    {key:"bears",   label:"Bear Case",           color:T.down,   icon:"▼"},
  ];

  if(!data)return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:20,textAlign:"center"}}>
      {error&&<div style={{fontSize:11,color:T.down,marginBottom:10,fontFamily:T.sans}}>⚠ {error}</div>}
      <div style={{fontSize:12,color:T.textSub,marginBottom:16,lineHeight:1.55}}>Claude will analyze {symbol}'s analyst consensus,<br/>earnings history, and recent news — no extra API file needed.</div>
      <button onClick={generate} disabled={loading} style={{padding:"10px 24px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",background:loading?T.border:T.accent,color:loading?T.textSub:T.accentInk,fontSize:13,fontWeight:700}}>
        {loading?"Analyzing…":"✦ Generate AI Analysis"}
      </button>
      {loading&&<div style={{marginTop:14}}><LoadTimer T={T} label="Reading analyst data, earnings and news" expected={18}/></div>}
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {data.oneLiner&&<div style={{background:T.accentBg,border:`1px solid ${T.accent}55`,borderRadius:10,padding:"12px 16px"}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:"#7C6FF7",marginBottom:5}}>AI Thesis</div>
        <div style={{fontSize:13,color:T.text,lineHeight:1.55,fontStyle:"italic"}}>"{data.oneLiner}"</div>
      </div>}
      {sections.map(({key,label,color,icon})=>(
        <div key={key} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 14px",borderBottom:`1px solid ${T.border}`,background:`${color}0A`}}>
            <span style={{color,fontWeight:700,fontSize:11}}>{icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:T.text}}>{label}</span>
          </div>
          <div style={{padding:"4px 0"}}>
            {(data[key]||[]).map((bullet,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"8px 14px",borderBottom:i<(data[key].length-1)?`1px solid ${T.border}`:"none"}}>
                <span style={{color,fontWeight:700,fontSize:11,flexShrink:0,paddingTop:1}}>•</span>
                <span style={{fontSize:12,color:T.textSub,lineHeight:1.55}}>{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",padding:"4px 2px"}}>
        <span style={{fontSize:9,color:T.textSub}}>Generated {data.generatedAt?new Date(data.generatedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"today"} · Cached until midnight</span>
        <button onClick={()=>{setData(null);setError(null);}} style={{fontSize:10,color:T.accent,background:"none",border:"none",cursor:"pointer"}}>Regenerate ↻</button>
      </div>
    </div>
  );
}


function StockNews({symbol,T}){
  const [news,setNews]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    setLoading(true);setNews([]);
    fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`)
      .then(r=>r.ok?r.json():[]).then(n=>setNews(n||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[symbol]);
  if(loading)return(<div style={{padding:16}}><LoadTimer T={T} compact label="Loading news" expected={6}/></div>);
  if(!news.length)return(<div style={{padding:16,fontSize:11,color:T.textSub}}>No recent news for {symbol}.</div>);
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
      {news.map((n,i)=>(
        <a key={i} href={n.link||n.url||"#"} target="_blank" rel="noreferrer"
          style={{display:"flex",gap:10,padding:"10px 14px",borderBottom:i<news.length-1?`1px solid ${T.border}`:"none",textDecoration:"none",cursor:"pointer"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:T.text,lineHeight:1.4,marginBottom:3}}>{n.title||n.h}</div>
            <div style={{fontSize:10,color:T.textSub}}>{n.publisher} · {n.providerPublishTime||n.time?new Date((n.providerPublishTime||n.time)*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}):""}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

function StockDetail({selected,names,T,onClose,onSetAlert,health,healthLoading,autoAnalyze}){
  const [tf,setTf]=useState("5m");
  const [chartMode,setChartMode]=useState("candle");
  const [ind,setInd]=useState({ema:false,macd:false,volume:false,support:false,vwap:false,bb:false,rsi:false,signals:false,volProfile:false});
  const [rawChart,setRawChart]=useState([]);
  const [chartLoading,setChartLoading]=useState(false);
  const [chartTf,setChartTf]=useState("5m");   // timeframe of the bars actually on screen
  const [initWin,setInitWin]=useState(null);   // time window to keep when zoom switches resolution
  const [resNote,setResNote]=useState("");
  const [blocked,setBlocked]=useState({});
  const resBusy=useRef(false);
  const shownSym=useRef(null);
  const pickTf=t=>{setInitWin(null);setResNote("");setTf(t);};
  const toggleInd=k=>setInd(p=>({...p,[k]:!p[k]}));
  const [full,setFull]=useState(false);
  const [hoverBar,setHoverBar]=useState(null);
  const win=useWinSize();
  useEffect(()=>{setFull(false);},[selected.s]);

  // Reset to first chart timeframe when ticker changes
  useEffect(()=>{ setTf("5m"); },[selected.s]);

  useEffect(()=>{
    let cancelled=false;const sym=selected.s;
    if(shownSym.current!==sym){shownSym.current=sym;setRawChart([]);}
    const hit=peekChart(sym,tf);
    if(hit){setRawChart(prev=>sameBars(prev,hit.bars)?prev:hit.bars);setChartTf(tf);setChartLoading(false);}
    else setChartLoading(true);   // previous chart stays visible underneath
    const load=(force)=>getChart(sym,tf,{force}).then(bars=>{
      if(cancelled)return;
      if(bars&&bars.length>5){setRawChart(prev=>sameBars(prev,bars)?prev:bars);setChartTf(tf);}
      else if(!hit&&!force){setRawChart(getChartData(selected.p||100,pct(selected.p||100,selected.pc||100),tf));setChartTf(tf);setTimeout(()=>{if(!cancelled)load(true);},5000);}
      setChartLoading(false);
    });
    if(!hit||!hit.fresh)load(false);
    const iv=setInterval(()=>{if(typeof document==="undefined"||document.visibilityState==="visible")load(true);},(YF_TF[tf]?.barMin||5)<1440?20000:90000);
    return()=>{cancelled=true;clearInterval(iv);};
  },[selected.s,tf]);// eslint-disable-line
  useEffect(()=>{const id=setTimeout(()=>prefetchCharts(selected.s),900);return()=>clearTimeout(id);},[selected.s]);
  useEffect(()=>{if(!resNote||/^Loading/.test(resNote))return undefined;const id=setTimeout(()=>setResNote(""),3200);return()=>clearTimeout(id);},[resNote]);
  const onRes=useCallback(async(dir,win)=>{
    if(resBusy.current)return;
    const target=nextRes(chartTf,dir);if(!target)return;
    resBusy.current=true;
    setResNote(dir==="in"?"Loading finer candles…":"Loading wider view…");
    try{
      const bars=await getChart(selected.s,target);
      if(!bars||bars.length<6){setBlocked(b=>({...b,[selected.s+"|"+chartTf+"|"+dir]:1}));setResNote("");return;}
      if(dir==="in"&&win&&(!bars[0].ts||bars[0].ts>win.t0+8*3600)){
        setBlocked(b=>({...b,[selected.s+"|"+chartTf+"|in"]:1}));
        setResNote("Max zoom for the data available");return;
      }
      setInitWin(dir==="in"?win:null);
      setTf(target);
      setResNote("Now showing "+tfName(target)+" candles");
    }finally{resBusy.current=false;}
  },[chartTf,selected.s]);
  const canFiner=!!nextRes(chartTf,"in")&&!blocked[selected.s+"|"+chartTf+"|in"];
  const canCoarser=!!nextRes(chartTf,"out")&&!blocked[selected.s+"|"+chartTf+"|out"];

  const chartData=useMemo(()=>enrich(rawChart),[rawChart]);
  const sr=useMemo(()=>TIMEFRAMES[chartTf]?.barMin>=1440?findSR(rawChart):[],[rawChart,chartTf]);
  const signals=useMemo(()=>ind.signals?detectSignals(chartData):[],[chartData,ind.signals]);
  const ch=pct(selected.p,selected.pc),isUp=ch>=0;
  const mobW=win.w<640;
  const shortH=win.h<560;
  const pH=(h)=>h+38;
  const panelTotal=(ind.volume?pH(mobW?70:96):0)+(ind.macd?pH(mobW?90:120):0)+(ind.rsi?pH(mobW?90:120):0);
  const topUsed=(shortH?44:56)+(shortH?40:mobW?100:56)+(mobW||shortH?(shortH?44:86):64)+16;
  const fullH=shortH?Math.max(200,win.h-topUsed):Math.max(240,Math.round((win.h-topUsed)*0.55),win.h-topUsed-panelTotal);
  const chartBox=(big)=>(
    <div style={{background:T.surface,borderRadius:12,padding:big?"6px 6px":"10px 8px",marginBottom:big?0:8,border:`1px solid ${T.border}`,boxShadow:big?"none":T.shadow,minHeight:big?0:220,position:"relative",overflow:"hidden"}}>
      {chartLoading&&chartData.length>0&&<div style={{position:"absolute",left:0,right:0,top:0,height:2,background:T.border,zIndex:5}}><div style={{height:"100%",width:"35%",background:T.accent||T.up,animation:"tfbar 1s ease-in-out infinite"}}/></div>}
      {chartData.length>0&&<div style={{position:"absolute",left:big?10:12,top:big?8:6,zIndex:4,display:"flex",gap:6,alignItems:"center",pointerEvents:"none"}}>
        <span style={{fontSize:big?11:9,fontWeight:700,padding:"2px 7px",borderRadius:99,background:T.surfaceB,border:`1px solid ${T.border}`,color:T.textSub,fontFamily:T.sans}}>{tfName(chartTf)} candles</span>
        {resNote&&<span style={{fontSize:big?11:9,fontWeight:600,padding:"2px 8px",borderRadius:99,background:T.accentBg||T.surfaceB,border:`1px solid ${T.accent||T.border}`,color:T.accent||T.text,fontFamily:T.sans}}>{resNote}</span>}
      </div>}
      {chartLoading&&chartData.length===0
        ?<div style={{height:big?fullH:210,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
          <LoadTimer T={T} label="Loading chart" expected={4}/>
         </div>
        :chartData.length>0&&(chartMode==="candle"
          ?<CandleChart data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} showVolProfile={ind.volProfile} T={T} symbol={selected.s} tf={chartTf} onRes={onRes} initWin={initWin} canFiner={canFiner} canCoarser={canCoarser} chartH={big?fullH:(mobW?300:260)} big={big} fs={big?(mobW?1.1:1.3):1} hideTip={big} onHover={big?setHoverBar:undefined}/>
          :<LineChartView data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} T={T} height={big?fullH:195} accent={isUp?T.up:T.down}/>
        )
      }
    </div>
  );
  const pnlStyle={background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`};
  const pnlLbl={fontSize:big=>big?11:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans};
  const panels=(big)=>(<>
    {ind.volume&&<div style={pnlStyle}><div style={{...pnlLbl,fontSize:big?11:8}}>Volume</div><VolumePanel data={chartData} T={T} h={big?(mobW?70:96):50} fs={big?10:0}/></div>}
    {ind.macd&&<div style={pnlStyle}><div style={{...pnlLbl,fontSize:big?11:8}}>MACD (12, 26, 9)</div><MACDPanel data={chartData} T={T} h={big?(mobW?90:120):70} fs={big?10:0}/></div>}
    {ind.rsi&&(()=>{const last=chartData.filter(d=>d.rsi!=null).at(-1)?.rsi;return(<div style={pnlStyle}><div style={{...pnlLbl,fontSize:big?11:8}}>RSI (14) <span style={{color:last>=70?T.down:last<=30?T.up:T.ema9,marginLeft:4}}>{last?.toFixed(1)}</span></div><RSIPanel data={chartData} T={T} h={big?(mobW?90:120):80} fs={big?10:0}/></div>);})()}
  </>);
  return(
    <div style={{animation:"fadeUp 0.18s ease"}}>
      <div style={{background:T.surface,borderRadius:14,padding:"16px",marginBottom:10,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:T.sans,fontSize:11,color:T.textSub,fontWeight:500,marginBottom:4}}>{names[selected.s]||selected.s}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:T.sans,fontSize:26,fontWeight:700,color:T.text,fontVariantNumeric:"tabular-nums"}}>{selected.p<1?`$${selected.p.toFixed(4)}`:`$${f2(selected.p)}`}</span>
              <DailyChange p={selected.p} pc={selected.pc} T={T} size="lg"/>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
            {onSetAlert&&(()=>{const ha=getAlerts().some(a=>a.symbol===selected.s&&!a.triggered);return(<button onClick={onSetAlert} title={ha?"Alert set":"Set price alert"} style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${ha?T.accent:T.border}`,background:ha?`${T.accent}15`:T.surfaceB,color:ha?T.accent:T.textSub,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:11,fontFamily:T.sans}}>{ha?<I.BellAlert s={12} c={T.accent}/>:<I.Bell s={12}/>}{ha?"Alert set":"Alert"}</button>);})()}
            <button onClick={onClose} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.textSub,fontSize:11,cursor:"pointer",fontFamily:T.sans}}><I.X s={10}/></button>
          </div>
        </div>
      </div>
      {full?(
        <div style={{background:T.surface,border:`1px dashed ${T.border}`,borderRadius:12,padding:"26px 16px",marginBottom:8,textAlign:"center",color:T.textSub,fontSize:12}}>
          Chart is open in full screen. <button onClick={()=>setFull(false)} style={{marginLeft:6,padding:"4px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,cursor:"pointer",fontSize:12}}>Bring it back</button>
        </div>
      ):(<>
        <ChartControls tf={tf} setTf={pickTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T} onFull={()=>setFull(true)}/>
        {chartBox(false)}
        {panels(false)}
      </>)}
      {full&&(
        <FullChartShell T={T} onClose={()=>setFull(false)}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:shortH?"4px 12px":win.w<640?"8px 12px":"10px 16px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",minWidth:0,flex:1}}>
              <span style={{fontSize:win.w<640?16:20,fontWeight:800}}>{selected.s}</span>
              <span style={{fontSize:win.w<640?16:20,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{selected.p<1?`$${selected.p.toFixed(4)}`:`$${f2(selected.p)}`}</span>
              <DailyChange p={selected.p} pc={selected.pc} T={T}/>
              {win.w>=720&&<span style={{fontSize:12,color:T.textSub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{names[selected.s]||""}</span>}
            </div>
            {win.h>win.w&&win.w<640&&<span style={{fontSize:10,color:T.textSub}}>Rotate for a wider view</span>}
            <button onClick={()=>setFull(false)} aria-label="Exit full screen" style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",minHeight:40,borderRadius:10,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:T.sans}}><I.X s={12}/> Close</button>
          </div>
          <div style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch"}}>
            <div style={{padding:"8px 10px 0",overflowX:"auto"}}>
              <ChartControls tf={tf} setTf={pickTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T} compact={shortH}/>
            </div>
            <div style={{position:"sticky",top:0,zIndex:15}}><ReadoutBar bar={hoverBar} last={chartData.at(-1)} T={T} compact={win.w<640||shortH}/></div>
            <div style={{padding:"6px 8px 0"}}>{chartBox(true)}</div>
            <div style={{padding:"8px 8px 12px"}}>{panels(true)}</div>
          </div>
        </FullChartShell>
      )}
      {/* ── AI Analysis ──────────────────────────────── */}
      {/* ── Stock Insights ────────────────────────────── */}
      <HealthPanel h={health} loading={healthLoading} T={T}/>
      <YFInsights symbol={selected.s} price={selected.p} T={T}/>
      {/* ── AI Analysis ───────────────────────────────── */}
      <DeepAnalysis key={selected.s} symbol={selected.s} T={T} autoRun={autoAnalyze}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   RECOMMENDATIONS — Yahoo Finance analyst consensus
════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════
   RECOMMENDATIONS — Finnhub first, Yahoo Finance fallback
════════════════════════════════════════════════════ */
function YahooRecommendations({stocks,T,refreshKey}){
  const [recs,setRecs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false); // start collapsed to save space
  const key=stocks.filter(s=>s.p>0).slice(0,6).map(s=>s.s).join(",");

  const load=useCallback(async()=>{
    const top=stocks.filter(s=>s.p>0).slice(0,6);
    if(!top.length){setLoading(false);return;}
    setLoading(true);setRecs([]);
    const results=await Promise.all(top.map(async stock=>{
      const a=await fetchBestAnalystData(stock.s);
      if(!a?.recommendationKey)return null;
      const upside=a.targetMeanPrice&&stock.p?((a.targetMeanPrice-stock.p)/stock.p*100):null;
      return{
        symbol:stock.s,price:stock.p,rec:a.recommendationKey,
        target:a.targetMeanPrice,targetLow:a.targetLowPrice,targetHigh:a.targetHighPrice,
        analysts:a.numberOfAnalysts,upside,
        buckets:a.buckets||null,
        pe:a.peRatioTTM||null,beta:a.beta||null,
        w52h:a.week52High||null,w52l:a.week52Low||null,
      };
    }));
    setRecs(results.filter(Boolean));
    setLoading(false);
  },[key,refreshKey]);

  useEffect(()=>{load();},[key,refreshKey]);

  return(
    <div style={{background:T.surface,borderRadius:14,border:`1px solid ${T.border}`,marginTop:14,overflow:"hidden",boxShadow:T.shadow}}>
      <div onClick={()=>setOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",cursor:"pointer",borderBottom:open?`1px solid ${T.border}`:"none"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,display:"flex",alignItems:"center",gap:6}}><I.BarChart s={13} c={T.textSub}/>Analyst Consensus</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {loading&&<span style={{fontSize:10,color:T.textSub,animation:"pulse 1.2s infinite",fontFamily:T.sans}}>Loading…</span>}
          <span style={{color:T.textSub,fontSize:12}}>{open?<I.ChevronUp s={11}/>:<I.ChevronDown s={11}/>}</span>
        </div>
      </div>
      {open&&(
        <div style={{padding:"14px 16px"}}>
          {recs.length>0?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {recs.map(r=>{
                const cfg=REC_CONFIG[r.rec]||{label:"Hold",color:T.ema9};
                return(
                  <div key={r.symbol} style={{background:T.surfaceB,borderRadius:12,padding:"14px",border:`1px solid ${T.border}`}}>
                    {/* Header */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <span style={{fontFamily:T.mono,fontSize:15,fontWeight:700,color:T.text}}>{r.symbol}</span>
                        {r.price>0&&<span style={{fontSize:11,color:T.textSub,marginLeft:7,fontVariantNumeric:"tabular-nums"}}>${f2(r.price)}</span>}
                      </div>
                      <span style={{padding:"4px 10px",borderRadius:8,background:`${cfg.color}20`,color:cfg.color,fontSize:11,fontWeight:700,fontFamily:T.sans,flexShrink:0}}>{cfg.label}</span>
                    </div>
                    {/* Analyst score bar */}
                    {r.buckets&&(()=>{
                      const {strongBuy=0,buy=0,hold=0,sell=0,strongSell=0}=r.buckets;
                      const total=strongBuy+buy+hold+sell+strongSell||1;
                      return(<div style={{marginBottom:10}}>
                        <div style={{display:"flex",height:5,borderRadius:3,overflow:"hidden",gap:1,marginBottom:5}}>
                          {strongBuy>0&&<div style={{flex:strongBuy,background:"#16A34A"}}/>}
                          {buy>0&&<div style={{flex:buy,background:"#4ADE80"}}/>}
                          {hold>0&&<div style={{flex:hold,background:"#F59E0B"}}/>}
                          {sell>0&&<div style={{flex:sell,background:"#F97316"}}/>}
                          {strongSell>0&&<div style={{flex:strongSell,background:"#EF4444"}}/>}
                        </div>
                        <div style={{display:"flex",gap:8,fontSize:9,flexWrap:"wrap"}}>
                          {strongBuy>0&&<span style={{color:"#16A34A",fontWeight:600}}>SB {strongBuy}</span>}
                          {buy>0&&<span style={{color:"#4ADE80",fontWeight:600}}>B {buy}</span>}
                          {hold>0&&<span style={{color:"#F59E0B",fontWeight:600}}>H {hold}</span>}
                          {sell>0&&<span style={{color:"#F97316",fontWeight:600}}>S {sell}</span>}
                          {strongSell>0&&<span style={{color:"#EF4444",fontWeight:600}}>SS {strongSell}</span>}
                          <span style={{color:T.textSub,marginLeft:"auto"}}>{total} analysts</span>
                        </div>
                      </div>);
                    })()}
                    {/* Price target range */}
                    {r.target&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:9,color:T.textSub,textTransform:"uppercase",letterSpacing:".06em",marginBottom:5,fontFamily:T.sans}}>12-Month Price Target</div>
                        {r.targetLow&&r.targetHigh&&r.price>0&&(()=>{
                          const pct100=Math.max(0,Math.min(100,((r.price-r.targetLow)/(r.targetHigh-r.targetLow))*100));
                          return(<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                            <span style={{fontFamily:T.mono,fontSize:9,color:T.down,minWidth:32}}>${r.targetLow<100?r.targetLow.toFixed(1):Math.round(r.targetLow)}</span>
                            <div style={{flex:1,position:"relative",height:5,background:T.border,borderRadius:3}}>
                              <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:`linear-gradient(90deg,${T.down}50,${T.up}50)`,borderRadius:3}}/>
                              <div style={{position:"absolute",top:-4,width:13,height:13,borderRadius:"50%",background:T.text,border:`2px solid ${T.surface}`,left:`calc(${pct100}% - 6px)`,boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/>
                            </div>
                            <span style={{fontFamily:T.mono,fontSize:9,color:T.up,minWidth:32,textAlign:"right"}}>${r.targetHigh<100?r.targetHigh.toFixed(1):Math.round(r.targetHigh)}</span>
                          </div>);
                        })()}
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.mono}}>${r.target<100?r.target.toFixed(2):f2(r.target)}</span>
                          <span style={{fontSize:9,color:T.textSub}}>avg target</span>
                          {r.upside!==null&&<span style={{fontSize:12,fontWeight:700,color:r.upside>=0?T.up:T.down,marginLeft:4}}>{r.upside>=0?"+":""}{r.upside.toFixed(1)}% {r.upside>=0?"upside":"downside"}</span>}
                        </div>
                      </div>
                    )}
                    {/* Key metrics row */}
                    {(r.pe||r.beta||r.w52h)&&(
                      <div style={{display:"flex",gap:0,borderTop:`1px solid ${T.border}`,paddingTop:8,flexWrap:"wrap"}}>
                        {r.pe&&<div style={{flex:1,minWidth:60,padding:"0 8px 0 0"}}>
                          <div style={{fontSize:9,color:T.textSub,marginBottom:1}}><HelpTerm k="pe" T={T}>Fwd P/E</HelpTerm></div>
                          <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.mono}}>{r.pe.toFixed(1)}x</div>
                        </div>}
                        {r.beta&&<div style={{flex:1,minWidth:60,padding:"0 8px",borderLeft:`1px solid ${T.border}`}}>
                          <div style={{fontSize:9,color:T.textSub,marginBottom:1}}><HelpTerm k="beta" T={T}>Beta</HelpTerm></div>
                          <div style={{fontSize:12,fontWeight:600,color:T.text,fontFamily:T.mono}}>{r.beta.toFixed(2)}</div>
                        </div>}
                        {r.w52h&&<div style={{flex:2,minWidth:100,padding:"0 0 0 8px",borderLeft:`1px solid ${T.border}`}}>
                          <div style={{fontSize:9,color:T.textSub,marginBottom:1}}><HelpTerm k="w52" T={T}>52W Range</HelpTerm></div>
                          <div style={{fontSize:11,fontWeight:600,fontFamily:T.mono}}><span style={{color:T.down}}>${r.w52l<100?r.w52l?.toFixed(1):Math.round(r.w52l)}</span><span style={{color:T.textSub}}> – </span><span style={{color:T.up}}>${r.w52h<100?r.w52h?.toFixed(1):Math.round(r.w52h)}</span></div>
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ):!loading&&(
            <div style={{fontSize:11,color:T.textSub,fontFamily:T.sans}}>No analyst data found for current watchlist.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   RECOMMENDATIONS
════════════════════════════════════════════════════ */
function Recommendations({stocks,T,refreshKey}){
  const [recs,setRecs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(true);
  const stockKey=stocks.filter(s=>s.p>0).slice(0,6).map(s=>s.s).join(",");

  const load=useCallback(async()=>{
    const top=stocks.filter(s=>s.p>0).slice(0,6);
    if(!top.length){setLoading(false);return;}
    setLoading(true);setRecs([]);
    const results=await Promise.all(top.map(async stock=>{
      const a=await fetchAnalystData(stock.s);
      if(!a?.recommendationKey)return null;
      const rec=a.recommendationKey;
      const target=a.targetMeanPrice;
      const targetLow=a.targetLowPrice;
      const targetHigh=a.targetHighPrice;
      const analysts=a.numberOfAnalysts;
      const upside=target&&stock.p?((target-stock.p)/stock.p*100):null;
      return{symbol:stock.s,price:stock.p,rec,target,targetLow,targetHigh,analysts,upside};
    }));
    setRecs(results.filter(Boolean));
    setLoading(false);
  },[stockKey,refreshKey]);

  useEffect(()=>{load();},[stockKey,refreshKey]);

  const refresh=()=>load();

  return(
    <div style={{background:T.surface,borderRadius:14,border:`1px solid ${T.border}`,marginTop:14,overflow:"hidden",boxShadow:T.shadow}}>
      <div onClick={()=>setOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",cursor:"pointer",borderBottom:open?`1px solid ${T.border}`:"none"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,display:"flex",alignItems:"center",gap:6}}><I.BarChart s={13} c={T.textSub}/>Analyst Consensus</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {!loading&&<button onClick={e=>{e.stopPropagation();refresh();}} style={{fontSize:10,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:T.sans,display:"flex",alignItems:"center",gap:5}}><I.Refresh s={12}/>Refresh</button>}
          {loading&&<span style={{fontSize:10,color:T.textSub,animation:"pulse 1.2s infinite",fontFamily:T.sans}}>Loading…</span>}
          <span style={{color:T.textSub,fontSize:12}}>{open?<I.ChevronUp s={11}/>:<I.ChevronDown s={11}/>}</span>
        </div>
      </div>
      {open&&(
        <div style={{padding:"14px 16px"}}>
          {recs.length>0?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {recs.map(r=>{
                const cfg=REC_CONFIG[r.rec]||{label:"Hold",color:T.ema9};
                return(
                  <div key={r.symbol} style={{background:T.surfaceB,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontFamily:T.mono,fontSize:14,fontWeight:700,color:T.text}}>{r.symbol}</span>
                      <span style={{padding:"3px 8px",borderRadius:6,background:`${cfg.color}20`,color:cfg.color,fontSize:10,fontWeight:700,fontFamily:T.sans}}>{cfg.label}</span>
                    </div>
                    {r.target&&(
                      <div style={{fontSize:11,fontFamily:T.sans}}>
                        <span style={{color:T.textSub}}>Target </span>
                        <span style={{color:T.text,fontWeight:600}}>${r.target.toFixed(2)}</span>
                        {r.upside!==null&&<span style={{marginLeft:6,color:r.upside>=0?T.up:T.down,fontWeight:600}}>{r.upside>=0?"+":""}{r.upside.toFixed(1)}%</span>}
                      </div>
                    )}
                    {r.analysts&&<div style={{fontSize:10,color:T.textSub,marginTop:3,fontFamily:T.sans}}>{r.analysts} analysts</div>}
                  </div>
                );
              })}
            </div>
          ):!loading&&(
            <div style={{fontSize:11,color:T.textSub,fontFamily:T.sans}}>No analyst coverage data for current watchlist.</div>
          )}
        </div>
      )}
    </div>
  );
}
/* ════════════════════════════════════════════════════
   TICKER SUGGESTIONS & SEARCH DROPDOWN
════════════════════════════════════════════════════ */
const SUGGESTIONS=[
  // Mega-cap Tech
  {s:"AAPL",n:"Apple"},{s:"MSFT",n:"Microsoft"},{s:"NVDA",n:"NVIDIA"},
  {s:"GOOGL",n:"Alphabet"},{s:"AMZN",n:"Amazon"},{s:"META",n:"Meta"},
  {s:"TSLA",n:"Tesla"},{s:"AVGO",n:"Broadcom"},{s:"ORCL",n:"Oracle"},
  // Semiconductors
  {s:"AMD",n:"Advanced Micro Devices"},{s:"INTC",n:"Intel"},{s:"QCOM",n:"Qualcomm"},
  {s:"MRVL",n:"Marvell Technology"},{s:"SMCI",n:"Super Micro Computer"},
  {s:"ON",n:"ON Semiconductor"},{s:"AMAT",n:"Applied Materials"},
  {s:"LRCX",n:"Lam Research"},{s:"KLAC",n:"KLA Corporation"},
  {s:"MU",n:"Micron Technology"},{s:"TER",n:"Teradyne"},
  {s:"MCHP",n:"Microchip Technology"},{s:"MPWR",n:"Monolithic Power"},
  // Software / Cloud
  {s:"NOW",n:"ServiceNow"},{s:"CRM",n:"Salesforce"},
  {s:"ADBE",n:"Adobe"},{s:"INTU",n:"Intuit"},{s:"SNOW",n:"Snowflake"},
  {s:"DDOG",n:"Datadog"},{s:"TEAM",n:"Atlassian"},{s:"WDAY",n:"Workday"},
  {s:"ZM",n:"Zoom Video"},{s:"MSCI",n:"MSCI Inc"},
  // Cybersecurity
  {s:"CRWD",n:"CrowdStrike"},{s:"PANW",n:"Palo Alto Networks"},
  {s:"ZS",n:"Zscaler"},{s:"FTNT",n:"Fortinet"},
  {s:"S",n:"SentinelOne"},{s:"OKTA",n:"Okta"},
  // AI / Emerging Tech
  {s:"AI",n:"C3.ai"},{s:"PLTR",n:"Palantir"},{s:"IONQ",n:"IonQ"},
  {s:"SOUN",n:"SoundHound AI"},{s:"BBAI",n:"BigBear.ai"},
  {s:"TEM",n:"Tempus AI"},{s:"RBRK",n:"Rubrik"},
  // Internet / Consumer Tech
  {s:"NFLX",n:"Netflix"},{s:"UBER",n:"Uber"},{s:"LYFT",n:"Lyft"},
  {s:"ABNB",n:"Airbnb"},{s:"BKNG",n:"Booking Holdings"},
  {s:"EXPE",n:"Expedia"},{s:"DASH",n:"DoorDash"},{s:"SNAP",n:"Snap"},
  {s:"PINS",n:"Pinterest"},{s:"RDDT",n:"Reddit"},
  {s:"SPOT",n:"Spotify"},{s:"RBLX",n:"Roblox"},
  // Telecom / Media
  {s:"DIS",n:"Disney"},{s:"CMCSA",n:"Comcast"},
  {s:"T",n:"AT&T"},{s:"VZ",n:"Verizon"},
  // Finance
  {s:"JPM",n:"JPMorgan Chase"},{s:"BAC",n:"Bank of America"},
  {s:"GS",n:"Goldman Sachs"},{s:"MS",n:"Morgan Stanley"},
  {s:"WFC",n:"Wells Fargo"},{s:"C",n:"Citigroup"},
  {s:"BLK",n:"BlackRock"},{s:"SCHW",n:"Charles Schwab"},
  {s:"V",n:"Visa"},{s:"MA",n:"Mastercard"},
  {s:"PYPL",n:"PayPal"},{s:"SQ",n:"Block Inc"},
  {s:"COIN",n:"Coinbase"},{s:"AXP",n:"American Express"},
  {s:"HOOD",n:"Robinhood Markets"},
  // Healthcare
  {s:"UNH",n:"UnitedHealth"},{s:"JNJ",n:"Johnson & Johnson"},
  {s:"LLY",n:"Eli Lilly"},{s:"ABBV",n:"AbbVie"},
  {s:"MRK",n:"Merck"},{s:"PFE",n:"Pfizer"},
  {s:"TMO",n:"Thermo Fisher"},{s:"ABT",n:"Abbott"},
  {s:"ISRG",n:"Intuitive Surgical"},{s:"AMGN",n:"Amgen"},
  // Energy
  {s:"XOM",n:"ExxonMobil"},{s:"CVX",n:"Chevron"},
  {s:"COP",n:"ConocoPhillips"},{s:"VST",n:"Vistra Corp"},
  {s:"CEG",n:"Constellation Energy"},{s:"NEE",n:"NextEra Energy"},
  {s:"SLB",n:"Schlumberger"},
  // Consumer
  {s:"WMT",n:"Walmart"},{s:"COST",n:"Costco"},
  {s:"HD",n:"Home Depot"},{s:"TGT",n:"Target"},
  {s:"MCD",n:"McDonald's"},{s:"SBUX",n:"Starbucks"},
  {s:"NKE",n:"Nike"},{s:"PG",n:"Procter & Gamble"},
  {s:"KO",n:"Coca-Cola"},{s:"PEP",n:"PepsiCo"},
  // Industrial / Defense
  {s:"CAT",n:"Caterpillar"},{s:"DE",n:"Deere & Co"},
  {s:"HON",n:"Honeywell"},{s:"GE",n:"GE Aerospace"},
  {s:"RTX",n:"Raytheon"},{s:"LMT",n:"Lockheed Martin"},
  {s:"BA",n:"Boeing"},{s:"NOC",n:"Northrop Grumman"},
  {s:"LHX",n:"L3Harris Technologies"},
  // EV / Auto
  {s:"GM",n:"General Motors"},{s:"F",n:"Ford Motor"},
  {s:"RIVN",n:"Rivian"},{s:"LCID",n:"Lucid Motors"},
  // ETFs & Indices
  {s:"SPY",n:"S&P 500 ETF (SPDR)"},{s:"QQQ",n:"Nasdaq-100 ETF"},
  {s:"IWM",n:"Russell 2000 ETF"},{s:"DIA",n:"Dow Jones ETF"},
  {s:"VOO",n:"Vanguard S&P 500"},{s:"VTI",n:"Vanguard Total Market"},
  {s:"GLD",n:"Gold ETF (SPDR)"},{s:"TLT",n:"20-Year Treasury ETF"},
  {s:"ARKK",n:"ARK Innovation ETF"},{s:"BOTZ",n:"Robotics & AI ETF"},
  {s:"SOXL",n:"Semis Bull 3x ETF"},{s:"TQQQ",n:"Nasdaq 3x Bull ETF"},
  // Crypto-adjacent
  {s:"MSTR",n:"MicroStrategy"},{s:"MARA",n:"Marathon Digital"},
  {s:"CLSK",n:"CleanSpark"},{s:"RIOT",n:"Riot Platforms"},
  // Other popular
  {s:"NOK",n:"Nokia"},{s:"SPCX",n:"SpaceX"},
  {s:"BRK.B",n:"Berkshire Hathaway B"},{s:"SHOP",n:"Shopify"},
  {s:"MELI",n:"MercadoLibre"},{s:"SE",n:"Sea Limited"},
  {s:"BABA",n:"Alibaba"},{s:"NIO",n:"NIO Inc"},
  {s:"SOFI",n:"SoFi Technologies"},{s:"DRAM",n:"Memory ETF"},
];

function TickerSearch({value,onChange,onSelect,onKeyDown,T}){
  const [open,setOpen]=useState(false);
  const [hi,setHi]=useState(0);
  const q=value.toUpperCase().trim();
  const matches=useMemo(()=>{
    if(!q)return[];
    return SUGGESTIONS
      .filter(t=>t.s.startsWith(q)||t.n.toUpperCase().includes(q))
      .slice(0,8);
  },[q]);

  const pick=useCallback(sym=>{
    onSelect(sym);
    setOpen(false);setHi(0);
  },[onSelect]);

  const handleKey=e=>{
    if(!open||!matches.length){onKeyDown&&onKeyDown(e);return;}
    if(e.key==="ArrowDown"){e.preventDefault();setHi(h=>Math.min(h+1,matches.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setHi(h=>Math.max(h-1,0));}
    else if(e.key==="Enter"){e.preventDefault();pick(matches[hi]?.s||value);}
    else if(e.key==="Escape"){setOpen(false);}
    else{onKeyDown&&onKeyDown(e);}
  };

  return(
    <div style={{position:"relative"}}>
      <input
        value={value}
        onChange={e=>{onChange(e.target.value.toUpperCase());setOpen(true);setHi(0);}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),160)}
        onKeyDown={handleKey}
        placeholder="Add ticker…"
        style={{
          padding:"6px 10px",borderRadius:8,width:110,outline:"none",
          border:`1px solid ${T.border}`,background:T.surface,
          color:T.text,fontSize:12,fontFamily:T.mono,boxShadow:T.shadow
        }}
      />
      {open&&matches.length>0&&(
        <div style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,minWidth:220,
          background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:10,boxShadow:`0 8px 24px rgba(0,0,0,0.18)`,
          zIndex:200,overflow:"hidden"
        }}>
          {matches.map((t,i)=>(
            <div key={t.s} onMouseDown={()=>pick(t.s)} style={{
              display:"flex",gap:10,alignItems:"center",
              padding:"8px 12px",cursor:"pointer",
              background:i===hi?T.accentBg:"transparent",
              borderBottom:i<matches.length-1?`1px solid ${T.border}`:"none",
              transition:"background 0.1s"
            }}>
              <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,color:T.text,minWidth:48}}>{t.s}</span>
              <span style={{fontSize:11,color:T.textSub,fontFamily:T.sans,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   AI CONCIERGE + DAILY EMAIL — panels (module-level components)
   ═══════════════════════════════════════════════════════════ */
function AnswerLine({text}){
  const parts=String(text).split(/\*\*(.+?)\*\*/g);
  return(<span>{parts.map((p,i)=>i%2?<b key={i}>{p}</b>:p)}</span>);
}
function AnswerText({text,T}){
  const lines=String(text||"").split("\n").map(l=>l.trimEnd()).filter(l=>l.trim()!=="");
  return(
    <div>
      {lines.map((l,i)=>{
        const m=l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
        if(m)return(<div key={i} style={{display:"flex",gap:8,margin:"3px 0",paddingLeft:2}}><span style={{color:T.accent}}>•</span><span style={{flex:1}}><AnswerLine text={m[1]}/></span></div>);
        const h=l.replace(/^#+\s*/,"");
        return(<div key={i} style={{margin:i?"8px 0 0":0}}><AnswerLine text={h}/></div>);
      })}
    </div>
  );
}
/* Progress + elapsed-seconds indicator for anything that takes a while.
   Pass done/total for a real progress bar, or just expected seconds for an eased one. */
function LoadTimer({T,label,expected,done,total,compact,note}){
  const [sec,setSec]=useState(0);
  useEffect(()=>{
    const t0=Date.now();
    const id=setInterval(()=>setSec(Math.floor((Date.now()-t0)/1000)),250);
    return()=>clearInterval(id);
  },[]);
  const exp=expected||15;
  const real=total>0;
  const pct=real?Math.min(100,Math.round((done||0)/total*100)):Math.min(92,Math.round((1-Math.exp(-sec/exp*1.5))*100));
  const slow=sec>exp*1.6;
  return(
    <div role="status" aria-live="polite" style={{width:"100%",maxWidth:compact?"none":420,margin:compact?0:"0 auto",padding:compact?"8px 0":"6px 0",fontFamily:T.sans}}>
      <div style={{display:"flex",alignItems:"baseline",gap:8,fontSize:compact?11:12,color:T.text}}>
        <span style={{animation:"pulse 1.4s infinite",color:T.accent}}>●</span>
        <span style={{flex:1,minWidth:0}}>{label||"Loading"}{real?` (${done||0}/${total})`:""}</span>
        <span style={{fontFamily:T.mono,fontSize:11,color:T.textSub,fontVariantNumeric:"tabular-nums"}}>{sec}s</span>
      </div>
      <div style={{height:4,borderRadius:2,background:T.border,marginTop:6,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:T.accent,borderRadius:2,transition:"width .35s ease"}}/>
      </div>
      <div style={{fontSize:10,color:T.textSub,marginTop:4}}>{slow?"Taking longer than usual. It will finish, or show an error.":(note||(real?"":"Usually about "+exp+" seconds"))}</div>
    </div>
  );
}

const CONCIERGE_ASKS=[
  "What moved the most today, and why?",
  "Which of my stocks report earnings this week?",
  "Which of my stocks have caution flags?",
  "Explain my riskiest stock in plain English",
  "Which stock looks most oversold right now?",
  "What should I watch in the market tomorrow?",
  "Summarize my watchlist in 3 bullets",
];
function buildConciergeContext(stocks,healthMap,earnMap){
  return stocks.filter(s=>s.p>0).slice(0,40).map(s=>{
    const ch=pct(s.p,s.pc);
    const h=healthMap[s.s];
    const e=earnMap[s.s];
    let line=`${s.s} $${s.p.toFixed(2)} ${ch>=0?"+":""}${ch.toFixed(2)}%`;
    if(h&&h.level!=="nodata")line+=` | health: ${h.label}${h.flags&&h.flags.length?" ("+h.flags.map(f=>f.title).join("; ")+")":""}`;
    if(e)line+=` | ${earnChipText(e)} ${e.date}${e.epsEstimate!=null?" EPS est $"+e.epsEstimate:""}`;
    return line;
  }).join("\n");
}
/* Entry bar that stays visible while you scroll. It sticks just above the mobile menu.
   With long content it slides away after a few seconds; scroll up, tap the handle or focus the field to bring it back. */
function DockBar({T,mobile,autoHide,children}){
  const [hid,setHid]=useState(false);
  const [navH,setNavH]=useState(mobile?58:0);
  const focusRef=useRef(false);
  const tmRef=useRef(null);
  const lastY=useRef(0);
  const arm=useCallback(()=>{
    clearTimeout(tmRef.current);
    if(!autoHide)return;
    tmRef.current=setTimeout(()=>{if(!focusRef.current)setHid(true);},4000);
  },[autoHide]);
  useEffect(()=>{
    if(!mobile){setNavH(0);return undefined;}
    const el=document.querySelector("[data-mobile-nav]");
    if(!el)return undefined;
    const upd=()=>setNavH(el.offsetHeight||58);
    upd();
    if(typeof ResizeObserver==="undefined")return undefined;
    const ro=new ResizeObserver(upd);
    ro.observe(el);
    return()=>ro.disconnect();
  },[mobile]);
  useEffect(()=>{
    if(!autoHide){setHid(false);clearTimeout(tmRef.current);return undefined;}
    arm();
    const onScroll=()=>{
      const y=window.scrollY||0;
      if(y<lastY.current-4){setHid(false);arm();}
      lastY.current=y;
    };
    window.addEventListener("scroll",onScroll,{passive:true});
    return()=>{window.removeEventListener("scroll",onScroll);clearTimeout(tmRef.current);};
  },[autoHide,arm]);
  const show=()=>{setHid(false);arm();};
  return(
    <div data-dock style={{position:"sticky",bottom:navH,zIndex:35,marginTop:10,transform:hid?"translateY(calc(100% - 22px))":"none",transition:"transform .22s ease"}}
      onFocusCapture={()=>{focusRef.current=true;setHid(false);clearTimeout(tmRef.current);}}
      onBlurCapture={()=>{focusRef.current=false;arm();}}
      onPointerDown={()=>{if(!hid)arm();}}>
      <button type="button" aria-label={hid?"Show entry bar":"Entry bar"} aria-expanded={!hid} onClick={hid?show:undefined} tabIndex={hid?0:-1}
        style={{display:"block",width:"100%",height:22,border:`1px solid ${T.border}`,borderBottom:"none",borderRadius:"8px 8px 0 0",background:T.surfaceB,cursor:hid?"pointer":"default",padding:0}}>
        <span style={{display:"block",width:34,height:3,borderRadius:2,background:T.textSub,opacity:.6,margin:"0 auto"}}/>
      </button>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderTop:"none",padding:"10px 12px 10px"}}>
        {children}
      </div>
    </div>
  );
}
function ConciergePanel({T,stocks,healthMap,earnMap,symbols,embedded,mobile,detail}){
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_cc_open")==="1";}catch{return false;}});
  const Head=embedded?"div":"button";
  const [msgs,setMsgs]=useState([]);
  const [q,setQ]=useState("");
  const [busy,setBusy]=useState(false);
  const [plan,setPlan]=useState(null);
  const [picked,setPicked]=useState(null);
  const [sent,setSent]=useState(false);
  const endRef=useRef(null);
  const pickAsk=a=>{if(busy)return;setPicked(a);setTimeout(()=>setPicked(null),700);ask(a);};
  useEffect(()=>{try{localStorage.setItem("screener_cc_open",open?"1":"0");}catch{}},[open]);
  useEffect(()=>{if(endRef.current&&msgs.length)endRef.current.scrollIntoView({block:"nearest",behavior:"smooth"});},[msgs,busy]);
  const ask=async(text)=>{
    const question=String(text||"").trim();
    if(!question||busy)return;
    const history=msgs.filter(m=>!m.error).map(m=>({role:m.role,content:m.text}));
    setMsgs(p=>[...p,{role:"user",text:question}]);
    setQ("");setBusy(true);setSent(true);setTimeout(()=>setSent(false),520);
    try{
      const res=await fetch("/api/concierge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,history,symbols,detail:detail||"standard",context:buildConciergeContext(stocks,healthMap,earnMap)})});
      const d=await res.json().catch(()=>({}));
      if(!res.ok||!d.answer)throw new Error(d.error||"The concierge could not answer right now.");
      if(d.tier)setPlan({tier:d.tier,left:d.left,limit:d.limit});
      setMsgs(p=>[...p,{role:"assistant",text:d.answer,sources:d.sources||[]}]);
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",text:e.message||"Something went wrong.",error:true}]);
    }finally{setBusy(false);}
  };
  const longChat=msgs.length>=4||msgs.reduce((n,m)=>n+m.text.length,0)>1800;
  const entry=(
    <>
    <div className="cc-rail" role="group" aria-label="Suggested questions" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:2,WebkitOverflowScrolling:"touch"}}>
      {CONCIERGE_ASKS.map(a=>(
        <button key={a} type="button" disabled={busy} onClick={()=>pickAsk(a)} className={"cc-chip"+(picked===a?" picked":"")} style={{flex:"0 0 auto",padding:"6px 12px",borderRadius:16,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:11,cursor:busy?"default":"pointer",opacity:busy?0.55:1,fontFamily:T.sans,whiteSpace:"nowrap"}}>{picked===a?"✓ ":""}{a}</button>
      ))}
    </div>
    <form onSubmit={e=>{e.preventDefault();ask(q);}} style={{display:"flex",gap:8}}>
      <input value={q} onChange={e=>setQ(e.target.value)} maxLength={500} placeholder="e.g. Why is NVDA moving today?" aria-label="Ask the concierge a question" style={{flex:1,minWidth:0,padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:13,fontFamily:T.sans,outline:"none"}}/>
      <button type="submit" disabled={busy||q.trim().length<2} className={"cc-send"+(sent?" sent":"")} style={{padding:"9px 16px",borderRadius:8,border:"none",background:T.accent,color:T.accentInk,fontSize:12,fontWeight:600,cursor:busy||q.trim().length<2?"default":"pointer",opacity:busy||q.trim().length<2?0.5:1,fontFamily:T.sans}}>Ask</button>
    </form>
    <div style={{padding:"6px 2px 0",fontSize:10,color:T.textSub,lineHeight:1.5}}>{plan&&plan.limit?<b style={{fontFamily:T.mono,color:T.text}}>{plan.left} of {plan.limit} answers left today ({plan.tier}). </b>:null}AI can be wrong or out of date. Check the sources. Educational tool, not financial advice.</div>
    </>
  );
  const card=(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:embedded?0:14,overflow:"hidden"}}>
      <Head onClick={embedded?undefined:()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:embedded?"default":"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Ask the Concierge</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>Ask anything about your stocks. Answers use live data and the web.</span>
        {!embedded&&<span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>}
      </Head>
      {(embedded||open)&&(
        <div style={{borderTop:`1px solid ${T.border}`}}>
          <div style={{maxHeight:embedded?"none":420,minHeight:embedded?260:0,overflowY:embedded?"visible":"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
            {msgs.length===0&&(
              <div className="cc-msg" style={{fontSize:12,color:T.textSub,lineHeight:1.55}}>Tap a suggestion below, or type your own question. Answers use live quotes, the news and the web, and cite sources.</div>
            )}
            {msgs.map((m,i)=>(
              m.role==="user"
                ?<div key={i} className="cc-msg" style={{alignSelf:"flex-end",maxWidth:"85%",background:T.accentBg,border:`1px solid ${T.border}`,color:T.text,borderRadius:12,padding:"8px 12px",fontSize:12.5,lineHeight:1.5}}>{m.text}</div>
                :<div key={i} className="cc-msg" style={{alignSelf:"flex-start",maxWidth:"94%",background:T.surfaceB,border:`1px solid ${m.error?T.down:T.border}`,color:m.error?T.down:T.text,borderRadius:12,padding:"10px 13px",fontSize:12.5,lineHeight:1.6}}>
                  <AnswerText text={m.text} T={T}/>
                  {m.sources&&m.sources.length>0&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`,fontSize:10.5,color:T.textSub,display:"flex",flexWrap:"wrap",gap:"4px 10px"}}>
                      <span>Sources:</span>
                      {m.sources.map(s=>(<a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{color:T.accent,textDecoration:"none"}}>{s.title}</a>))}
                    </div>
                  )}
                </div>
            ))}
            {busy&&<div className="cc-msg" style={{alignSelf:"flex-start",width:"min(100%,420px)",padding:"4px 2px"}}><div className="cc-dots" aria-hidden="true" style={{marginBottom:6}}><span/><span/><span/></div><LoadTimer T={T} compact label="Checking live data and the news" expected={14}/></div>}
            <div ref={endRef}/>
          </div>
          {!embedded&&<div style={{padding:"10px 16px 12px",borderTop:`1px solid ${T.border}`}}>{entry}</div>}
        </div>
      )}
    </div>
  );
  return embedded?(<div>{card}<DockBar T={T} mobile={mobile} autoHide={longChat}>{entry}</DockBar></div>):card;
}
function EmailDigestPanel({T,symbols,listName,embedded,mobile,inline}){
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_em_open")==="1";}catch{return false;}});
  const Head=embedded?"div":"button";
  const [email,setEmail]=useState(()=>{try{return localStorage.getItem("screener_em_addr")||"";}catch{return "";}});
  const [state,setState]=useState({kind:"idle",msg:""});
  useEffect(()=>{try{localStorage.setItem("screener_em_open",open?"1":"0");}catch{}},[open]);
  const list=symbols.slice(0,20);
  const valid=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const submit=async(e)=>{
    e.preventDefault();
    if(!valid||!list.length||state.kind==="busy")return;
    setState({kind:"busy",msg:""});
    try{
      const res=await fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),symbols:list})});
      const d=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(d.error||"Could not sign up right now.");
      try{localStorage.setItem("screener_em_addr",email.trim());}catch{}
      setState({kind:"ok",msg:d.message||"Check your inbox to confirm."});
    }catch(err){setState({kind:"err",msg:err.message||"Could not sign up right now."});}
  };
  const entry=(
    <>
    <form onSubmit={submit} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <input type="email" value={email} onChange={e=>{setEmail(e.target.value);if(state.kind!=="busy")setState({kind:"idle",msg:""});}} placeholder="you@example.com" aria-label="Email address for the daily brief" autoComplete="email" style={{flex:"1 1 200px",minWidth:0,padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:13,fontFamily:T.sans,outline:"none"}}/>
      <button type="submit" disabled={!valid||!list.length||state.kind==="busy"} style={{padding:"9px 16px",borderRadius:8,border:"none",background:T.accent,color:T.accentInk,fontSize:12,fontWeight:600,cursor:valid&&list.length&&state.kind!=="busy"?"pointer":"default",opacity:valid&&list.length&&state.kind!=="busy"?1:0.5,fontFamily:T.sans}}>{state.kind==="busy"?"Sending…":"Email me daily"}</button>
    </form>
    {state.msg&&<div role="status" style={{marginTop:8,fontSize:12,lineHeight:1.5,color:state.kind==="ok"?T.up:T.down}}>{state.msg}</div>}
    </>
  );
  const card=(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:embedded?0:14,overflow:"hidden"}}>
      <Head onClick={embedded?undefined:()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:embedded?"default":"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Daily Email</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>Get an AI brief on your watchlist every weekday morning.</span>
        {!embedded&&<span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>}
      </Head>
      {(embedded||open)&&(
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 16px 14px"}}>
          <div style={{fontSize:12,color:T.text,lineHeight:1.55,marginBottom:6}}>One email per weekday for <b>{listName||"your list"}</b>: prices, biggest movers, who reports earnings, and what to watch.</div>
          <div style={{fontSize:11,color:T.textSub,marginBottom:10,lineHeight:1.5}}>{list.length?`Includes ${list.join(", ")}${symbols.length>20?" (first 20)":""}.`:"Add a stock to this list first."} Every email has a one-click unsubscribe.</div>
          {(!embedded||inline)&&<div style={{padding:"0 16px 14px"}}>{entry}</div>}
        </div>
      )}
    </div>
  );
  return embedded&&!inline?(<div>{card}<DockBar T={T} mobile={mobile} autoHide={false}>{entry}</DockBar></div>):card;
}

/* ───────── Personal settings: theme builder ───────── */
const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>"#"+hx(a).map((v,i)=>Math.round(v+(hx(b)[i]-v)*t).toString(16).padStart(2,"0")).join("");
const ACCENTS={
  purple:{n:"Purple",d:["#7C6FF7","#0E0B26"],l:["#5B4BD8","#FFFFFF"],
    nd:{bg:"#08090E",surface:"#0F1018",surfaceB:"#161820",border:"#1E2334",chartGrid:"#1A1D2E"},
    nl:{bg:"#F2F3F5",surface:"#FFFFFF",surfaceB:"#EBEDEF",border:"#D4D7DC",chartGrid:"#EBEDEF"}},
  teal:{n:"Teal",d:["#4CC3A7","#06201A"],l:["#0E6655","#FFFFFF"]},
  blue:{n:"Blue",d:["#6BA3F5","#071A33"],l:["#2A56B0","#FFFFFF"]},
  rose:{n:"Rose",d:["#F28BA8","#2A0A14"],l:["#B4304F","#FFFFFF"]},
};
const DEFAULT_PREFS={mode:"dark",accent:"purple",shade:0,contrast:0,text:100,motion:1,refresh:30,start:"last",ccDetail:"standard"};
function loadPrefs(){
  let o={};
  try{o=JSON.parse(localStorage.getItem("screener_prefs")||"{}")||{};}catch{}
  if(!o.mode){try{o.mode=JSON.parse(localStorage.getItem("screener_dark")??"true")?"dark":"light";}catch{}}
  return Object.assign({},DEFAULT_PREFS,o);
}
function makeTheme(isDark,pf){
  const base=isDark?DARK:LIGHT;
  const ac=ACCENTS[pf.accent]||ACCENTS.purple;
  const [acc,ink]=isDark?ac.d:ac.l;
  const t=Object.assign({},base,isDark?ac.nd:ac.nl);
  t.accent=acc;t.accentInk=ink;
  t.accentBg=acc+(isDark?"26":"1A");
  t.insightText=acc;t.accentGlow="0 0 0 1px "+acc;
  const sh=pf.shade||0;
  if(sh){
    const to=sh<0?"#000000":"#FFFFFF";
    const amt=isDark?(sh<0?0.45:0.07):(sh<0?0.06:0.6);
    ["bg","surface","surfaceB","chartGrid","insightBg"].forEach(k=>{t[k]=mix(t[k],to,amt);});
    t.border=mix(t.border,to,amt*(isDark?0.7:0.4));t.insightBorder=t.border;
  }
  if(pf.contrast){
    t.text=mix(t.text,isDark?"#FFFFFF":"#000000",0.6);
    t.textSub=mix(t.textSub,t.text,0.55);
    t.border=mix(t.border,t.text,0.28);t.insightBorder=t.border;
  }
  t.headerGrad=t.bg;
  return t;
}
function SetCard({T,title,hint,children}){
  return(
    <section style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 16px",marginBottom:12}}>
      <h2 style={{margin:0,fontFamily:T.display,fontSize:17,fontWeight:700,color:T.text}}>{title}</h2>
      {hint&&<div style={{fontSize:11,color:T.textSub,marginTop:2,lineHeight:1.5}}>{hint}</div>}
      <div style={{marginTop:10,display:"flex",flexDirection:"column"}}>{children}</div>
    </section>
  );
}
function SetRow({T,label,hint,children}){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",padding:"10px 0",borderTop:`1px solid ${T.border}`}}>
      <div style={{minWidth:150,flex:"1 1 170px"}}>
        <div style={{fontSize:13,color:T.text,fontWeight:500}}>{label}</div>
        {hint&&<div style={{fontSize:11,color:T.textSub,marginTop:1,lineHeight:1.45}}>{hint}</div>}
      </div>
      <div style={{flex:"0 1 auto",maxWidth:"100%"}}>{children}</div>
    </div>
  );
}
function Seg({T,label,value,options,onChange}){
  return(
    <div role="group" aria-label={label} style={{display:"inline-flex",flexWrap:"wrap",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.surfaceB}}>
      {options.map(([v,l],i)=>(
        <button key={String(v)} aria-pressed={value===v} onClick={()=>onChange(v)} style={{padding:"7px 12px",border:"none",borderLeft:i?`1px solid ${T.border}`:"none",background:value===v?T.accent:"transparent",color:value===v?T.accentInk:T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>{l}</button>
      ))}
    </div>
  );
}
function PlanCard({T}){
  const [code,setCode]=useState(()=>{try{return localStorage.getItem("screener_code")||"";}catch{return "";}});
  const [draft,setDraft]=useState("");
  const [email,setEmail]=useState("");
  const [st,setSt]=useState({kind:"idle",msg:""});
  const [hp,setHp]=useState("");
  const save=c=>{try{if(c)localStorage.setItem("screener_code",c);else localStorage.removeItem("screener_code");}catch{}setCode(c);};
  const join=async e=>{
    e.preventDefault();
    if(st.kind==="busy")return;
    setSt({kind:"busy",msg:""});
    try{
      const r=await fetch("/api/subscribe?kind=beta",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),source:"app",website:hp})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||"Could not sign up right now.");
      if(d.code){save(d.code);setSt({kind:"ok",msg:"You are in the beta. Your access code "+d.code+" is saved on this device. Keep a copy."});}
      else setSt({kind:"ok",msg:d.message||"You are on the list."});
    }catch(err){setSt({kind:"err",msg:err.message||"Could not sign up right now."});}
  };
  const field={padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:13,fontFamily:T.sans,outline:"none",minWidth:0};
  const btn=(on)=>({padding:"9px 14px",borderRadius:8,border:"none",background:T.accent,color:T.accentInk,fontSize:12,fontWeight:600,cursor:on?"pointer":"default",opacity:on?1:0.5,fontFamily:T.sans});
  return(
    <SetCard T={T} title="Your plan" hint="Free users get a few AI answers a day. Beta testers get more, and supporters get the most. This keeps the tool running for everyone.">
      <SetRow T={T} label={code?"Access code saved":"Have an access code?"} hint={code?"Code "+code+" is active on this device.":"Paste the code from your beta invite."}>
        {code
          ?<button onClick={()=>save("")} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>Remove code</button>
          :<form onSubmit={e=>{e.preventDefault();const c=draft.trim().toUpperCase();if(/^[A-Z0-9]{8}$/.test(c)){save(c);setDraft("");}}} style={{display:"flex",gap:8}}>
            <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={8} placeholder="8-character code" aria-label="Access code" style={Object.assign({},field,{width:150,fontFamily:T.mono,textTransform:"uppercase"})}/>
            <button type="submit" disabled={draft.trim().length!==8} style={btn(draft.trim().length===8)}>Save</button>
          </form>}
      </SetRow>
      {!code&&(
        <SetRow T={T} label="Join the beta" hint="Free. You get an access code and early features. Limited seats.">
          <form onSubmit={join} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <input type="text" value={hp} onChange={e=>setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{position:"absolute",left:-9999,width:1,height:1,opacity:0}}/>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email for the beta" autoComplete="email" style={Object.assign({},field,{width:200})}/>
            <button type="submit" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())||st.kind==="busy"} style={btn(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())&&st.kind!=="busy")}>Join beta</button>
          </form>
        </SetRow>
      )}
      {st.msg&&<div role="status" style={{fontSize:12,lineHeight:1.5,color:st.kind==="ok"?T.up:T.down,padding:"4px 0 6px"}}>{st.msg}</div>}
      <SetRow T={T} label="Support the project" hint="Built on nights and weekends. Supporters help cover data and AI costs.">
        <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",padding:"9px 14px",borderRadius:8,border:`1px solid ${T.accent}`,color:T.accent,fontSize:12,fontWeight:600,textDecoration:"none",fontFamily:T.sans}}>Buy me a coffee</a>
      </SetRow>
    </SetCard>
  );
}
function SettingsPanel({T,prefs,setPref,resetPrefs,autoRefresh,setAutoRefresh,mobile,symbols,listName}){
  return(
    <div style={{maxWidth:760}}>
      <SetCard T={T} title="Appearance" hint="Changes apply right away and are saved on this device.">
        <SetRow T={T} label="Mode"><Seg T={T} label="Mode" value={prefs.mode} onChange={v=>setPref("mode",v)} options={[["dark","Dark"],["light","Light"],["auto","Match device"]]}/></SetRow>
        <SetRow T={T} label="Accent colour" hint="Purple also brings back the original blue-violet greys.">
          <div role="group" aria-label="Accent colour" style={{display:"flex",gap:8}}>
            {Object.keys(ACCENTS).map(k=>{const on=prefs.accent===k;const col=ACCENTS[k].d[0];return(
              <button key={k} aria-pressed={on} aria-label={ACCENTS[k].n} title={ACCENTS[k].n} onClick={()=>setPref("accent",k)} style={{width:34,height:34,borderRadius:8,border:`2px solid ${on?T.text:T.border}`,background:T.surfaceB,cursor:"pointer",display:"grid",placeItems:"center",padding:0}}>
                <span style={{width:18,height:18,borderRadius:4,background:col}}/>
              </button>);})}
          </div>
        </SetRow>
        <SetRow T={T} label="Shade" hint="How dark or light the surfaces are."><Seg T={T} label="Shade" value={prefs.shade} onChange={v=>setPref("shade",v)} options={[[-1,"Darker"],[0,"Standard"],[1,"Lighter"]]}/></SetRow>
        <SetRow T={T} label="Contrast" hint="High makes text and borders stronger."><Seg T={T} label="Contrast" value={prefs.contrast} onChange={v=>setPref("contrast",v)} options={[[0,"Normal"],[1,"High"]]}/></SetRow>
        <SetRow T={T} label="Text size"><Seg T={T} label="Text size" value={prefs.text} onChange={v=>setPref("text",v)} options={[[92,"Small"],[100,"Default"],[110,"Large"],[120,"Larger"]]}/></SetRow>
        <SetRow T={T} label="Animations" hint="Turn off pulses and transitions."><Seg T={T} label="Animations" value={prefs.motion} onChange={v=>setPref("motion",v)} options={[[1,"On"],[0,"Off"]]}/></SetRow>
      </SetCard>
      <PlanCard T={T}/>
      <SetCard T={T} title="Data and AI" hint="How often things update, and how the Concierge answers.">
        <SetRow T={T} label="Auto-refresh prices" hint="Also available as the Auto button in the header."><Seg T={T} label="Auto-refresh" value={autoRefresh} onChange={setAutoRefresh} options={[[false,"Off"],[true,"On"]]}/></SetRow>
        <SetRow T={T} label="Refresh rate" hint="Faster uses more of your data-provider quota."><Seg T={T} label="Refresh rate" value={prefs.refresh} onChange={v=>setPref("refresh",v)} options={[[15,"15 s"],[30,"30 s"],[60,"1 min"],[300,"5 min"]]}/></SetRow>
        <SetRow T={T} label="Concierge answers" hint="Shorter answers are faster and cost less."><Seg T={T} label="Concierge answer length" value={prefs.ccDetail} onChange={v=>setPref("ccDetail",v)} options={[["brief","Brief"],["standard","Standard"],["detailed","Detailed"]]}/></SetRow>
        <SetRow T={T} label="Open on" hint="Which section shows when you start the app."><Seg T={T} label="Start section" value={prefs.start} onChange={v=>setPref("start",v)} options={[["last","Last used"],["watchlist","Watchlist"],["overview","Overview"],["earnings","Earnings"]]}/></SetRow>
      </SetCard>
      <SetCard T={T} title="Daily newsletter" hint="A weekday morning AI brief for the list you are viewing. You confirm by email first and can unsubscribe in one click.">
        <EmailDigestPanel inline embedded mobile={mobile} T={T} symbols={symbols} listName={listName}/>
      </SetCard>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
        <button onClick={resetPrefs} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>Reset appearance and data settings</button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   PAPER TRADING — virtual $100,000 account for stocks and options.
   Saved on the device; synced to the person's access code when they have one.
════════════════════════════════════════════════════ */
const PAPER_START=100000;
const PAPER_KEY="screener_paper_v1";
const paperNew=()=>({v:1,cash:PAPER_START,start:PAPER_START,pos:{},trades:[],eq:[],t:Date.now()});
const paperLoadLocal=()=>{try{const j=JSON.parse(localStorage.getItem(PAPER_KEY)||"null");if(j&&typeof j.cash==="number"&&j.pos)return j;}catch{}return paperNew();};
const usd=(n,d=2)=>{const v=Number(n)||0;return (v<0?"-":"")+"$"+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});};
const signedUsd=(n)=>(n>=0?"+":"")+usd(n);
const todayET=()=>{try{return new Date().toLocaleDateString("en-CA",{timeZone:"America/New_York"});}catch{return new Date().toISOString().slice(0,10);}};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtExp=(d)=>{const [y,m,dd]=String(d).split("-");return `${MON[(+m||1)-1]} ${+dd}, '${String(y).slice(2)}`;};
const occKey=(sym,exp,right,strike)=>{const [y,m,d]=exp.split("-");return sym+y.slice(2)+m+d+(right==="p"?"P":"C")+String(Math.round(strike*1000)).padStart(8,"0");};
const daysTo=(exp)=>Math.round((new Date(exp+"T00:00:00Z")-new Date(todayET()+"T00:00:00Z"))/864e5);
const posLabel=(p)=>p.type==="opt"?`${p.sym} ${fmtExp(p.meta.exp)} ${p.meta.k} ${p.meta.r==="p"?"Put":"Call"}`:p.sym;

/* Fills at the price you pass in. Long only: buy to open, sell to close. Returns {acc,pl} or {error}. */
function paperTrade(acc,o){
  const qty=Math.floor(Number(o.qty)),price=Number(o.price),mult=o.mult||1;
  if(!(qty>=1))return{error:"Enter a quantity of at least 1."};
  if(!(price>0))return{error:"No price available yet. Try again in a moment."};
  const val=price*qty*mult;
  const next=JSON.parse(JSON.stringify(acc));
  let pl=null;
  if(o.side==="buy"){
    if(val>next.cash+1e-9)return{error:`Not enough cash: this costs ${usd(val)} and you have ${usd(next.cash)}.`};
    next.cash-=val;
    const p=next.pos[o.key];
    if(p){p.avg=(p.avg*p.qty+price*qty)/(p.qty+qty);p.qty+=qty;}
    else next.pos[o.key]={k:o.key,type:o.type,sym:o.sym,qty,avg:price,mult,meta:o.meta||null};
  }else{
    const p=next.pos[o.key];
    if(!p||p.qty<qty)return{error:`You only hold ${p?p.qty:0}.`};
    pl=(price-p.avg)*qty*mult;
    next.cash+=val;p.qty-=qty;
    if(p.qty===0)delete next.pos[o.key];
  }
  next.trades.unshift({t:Date.now(),k:o.key,type:o.type,sym:o.sym,side:o.side,qty,price,mult,pl,meta:o.meta||null,note:o.note||null});
  next.trades=next.trades.slice(0,300);next.t=Date.now();
  return{acc:next,pl};
}
const paperEquity=(acc,marks)=>Object.values(acc.pos).reduce((v,p)=>v+p.qty*p.mult*(marks[p.k]!=null?marks[p.k]:p.avg),acc.cash);
/* Options past their expiry date settle at intrinsic value using the stock's latest price. */
function paperSettle(acc,under){
  const today=todayET();let next=acc,changed=false;
  Object.values(acc.pos).forEach(p=>{
    if(p.type!=="opt"||!p.meta||p.meta.exp>=today)return;
    const s=under[p.sym];if(!(s>0))return;
    const iv=Math.max(0,p.meta.r==="p"?p.meta.k-s:s-p.meta.k);
    const r=paperTrade(next,{key:p.k,type:"opt",sym:p.sym,side:"sell",qty:p.qty,price:iv>0?iv:0.0001,mult:100,meta:p.meta,note:iv>0?"Expired in the money":"Expired worthless"});
    if(r.acc){next=r.acc;changed=true;}
  });
  return changed?next:acc;
}
function paperSnap(acc,equity){
  const d=todayET();const eq=acc.eq.slice();
  if(eq.length&&eq[eq.length-1].d===d)eq[eq.length-1]={d,v:Math.round(equity*100)/100};else eq.push({d,v:Math.round(equity*100)/100});
  return Object.assign({},acc,{eq:eq.slice(-400)});
}
function paperInsights(acc,marks,health,earn){
  const out=[];const eq=paperEquity(acc,marks);if(eq<=0)return out;
  const bySym={};
  Object.values(acc.pos).forEach(p=>{const v=p.qty*p.mult*(marks[p.k]!=null?marks[p.k]:p.avg);bySym[p.sym]=(bySym[p.sym]||0)+v;});
  Object.entries(bySym).forEach(([s,v])=>{if(v/eq>0.35)out.push({sev:"watch",t:`${s} is ${Math.round(v/eq*100)}% of your account. Spreading across several companies lowers the damage if one falls.`});});
  Object.values(acc.pos).forEach(p=>{
    if(p.type==="opt"&&p.meta){const d=daysTo(p.meta.exp);if(d<=7&&d>=0)out.push({sev:"watch",t:`${posLabel(p)} expires in ${d} day${d===1?"":"s"}. Options lose value fastest near expiry.`});}
  });
  Object.keys(bySym).forEach(s=>{
    const h=health&&health[s];
    if(h&&h.level&&h.level!=="ok"&&h.level!=="nodata")out.push({sev:"watch",t:`${s} has health-check flags (${h.label}). Open it in the Watchlist to see what to research.`});
    if(earn&&earn[s])out.push({sev:"info",t:`${s} reports earnings this week, so a bigger-than-usual move is possible.`});
  });
  const cashPct=acc.cash/eq*100;
  if(cashPct<5&&Object.keys(acc.pos).length)out.push({sev:"info",t:`Only ${cashPct.toFixed(0)}% of your account is cash, so you have little room for new ideas.`});
  return out.slice(0,6);
}
const PAPER_NOTE_OPT="Paper options fill at the ask when you buy and the bid when you sell. Quotes can be about 15 minutes delayed and the market must be open for them to move.";

function PayoffChart({type,strike,premium,qty,under,T}){
  const W=320,H=120,pad=10;
  const lo=Math.min(under,strike)*0.82,hi=Math.max(under,strike)*1.18;
  const f=(S)=>(Math.max(0,type==="p"?strike-S:S-strike)-premium)*100*qty;
  const pts=Array.from({length:41},(_,i)=>{const S=lo+(hi-lo)*i/40;return{S,v:f(S)};});
  const vmin=Math.min(...pts.map(p=>p.v)),vmax=Math.max(...pts.map(p=>p.v),1);
  const X=S=>pad+(S-lo)/(hi-lo)*(W-2*pad),Y=v=>pad+(1-(v-vmin)/((vmax-vmin)||1))*(H-2*pad);
  const be=type==="p"?strike-premium:strike+premium;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Profit or loss at expiry" style={{display:"block"}}>
      <line x1={pad} x2={W-pad} y1={Y(0)} y2={Y(0)} stroke={T.border} strokeWidth="1"/>
      <polyline fill="none" stroke={T.accent} strokeWidth="2" points={pts.map(p=>`${X(p.S).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}/>
      <line x1={X(under)} x2={X(under)} y1={pad} y2={H-pad} stroke={T.textSub} strokeDasharray="3,3" strokeWidth="1"/>
      <text x={X(under)+4} y={pad+8} fill={T.textSub} fontSize="9">now {usd(under)}</text>
      {be>lo&&be<hi&&<g><circle cx={X(be)} cy={Y(0)} r="3.5" fill={T.accent}/><text x={Math.min(X(be)+5,W-70)} y={Y(0)-6} fill={T.text} fontSize="9" fontWeight="700">breakeven {usd(be)}</text></g>}
      <text x={pad} y={H-1} fill={T.down} fontSize="9">max loss {usd(-premium*100*qty,0)}</text>
    </svg>
  );
}

function PaperPanel({T,active,names,healthMap,earnMap,onOpen,mobile}){
  const [acc,setAcc]=useState(paperLoadLocal);
  const [marks,setMarks]=useState({});
  const [under,setUnder]=useState({});
  const [sync,setSync]=useState({s:"local"});
  const [kind,setKind]=useState("stock"); // stock | opt
  const [sym,setSym]=useState("");
  const [symIn,setSymIn]=useState("");
  const [px,setPx]=useState(null);
  const [qty,setQty]=useState("10");
  const [msg,setMsg]=useState(null);
  const [exps,setExps]=useState([]);
  const [exp,setExp]=useState("");
  const [chain,setChain]=useState(null);
  const [optErr,setOptErr]=useState(null);
  const [optLoad,setOptLoad]=useState(false);
  const [right,setRight]=useState("c");
  const [sel,setSel]=useState(null);
  const [allK,setAllK]=useState(false);
  const [confirmReset,setConfirmReset]=useState(false);
  const accRef=useRef(acc);accRef.current=acc;
  const loadedSync=useRef(false);

  // save on the device every time the account changes
  useEffect(()=>{try{localStorage.setItem(PAPER_KEY,JSON.stringify(acc));}catch{}},[acc]);

  // sync with the access code (if any): newest copy wins
  const code=(()=>{try{return localStorage.getItem("screener_code")||"";}catch{return"";}})();
  useEffect(()=>{
    if(!code||loadedSync.current)return;
    loadedSync.current=true;setSync({s:"syncing"});
    fetch("/api/subscribe?kind=paper",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load"})})
      .then(r=>r.json().then(j=>({ok:r.ok,j})))
      .then(({ok,j})=>{
        if(!ok){setSync({s:j.error==="code_required"?"local":"error",m:j.error});return;}
        const remote=j.data;
        if(remote&&remote.t>accRef.current.t){setAcc(remote);}
        setSync({s:"synced"});
      }).catch(()=>setSync({s:"error"}));
  },[code]);
  useEffect(()=>{
    if(!code||!loadedSync.current||sync.s==="syncing")return;
    const id=setTimeout(()=>{
      fetch("/api/subscribe?kind=paper",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",data:acc})})
        .then(r=>setSync(s=>({s:r.ok?"synced":"error",m:r.ok?undefined:String(r.status)}))).catch(()=>setSync({s:"error"}));
    },1500);
    return()=>clearTimeout(id);
  },[acc]);// eslint-disable-line

  // live marks for what you hold (stocks via quotes, options via the options feed)
  const held=Object.values(acc.pos);
  const heldKey=held.map(p=>p.k).sort().join(",");
  const refreshMarks=useCallback(async()=>{
    const a=accRef.current;const ps=Object.values(a.pos);
    const stockSyms=[...new Set(ps.map(p=>p.sym))];
    if(!stockSyms.length)return;
    const q=await fetchYFQuotes(stockSyms);
    const nm={},nu={};
    stockSyms.forEach(s=>{if(q[s]&&q[s].p>0)nu[s]=q[s].p;});
    ps.filter(p=>p.type==="stock").forEach(p=>{if(nu[p.sym])nm[p.k]=nu[p.sym];});
    const occ=ps.filter(p=>p.type==="opt").map(p=>p.k);
    if(occ.length){
      try{
        const r=await fetch("/api/events?kind=optq&symbols="+occ.join(","));
        const j=await r.json();
        occ.forEach(k=>{const o=j&&j.quotes&&j.quotes[k];if(o){const mid=o.b>0&&o.a>0?(o.b+o.a)/2:(o.l>0?o.l:null);if(mid)nm[k]=mid;}});
      }catch{}
    }
    setUnder(u=>Object.assign({},u,nu));setMarks(m=>Object.assign({},m,nm));
    // settle expired options, then record today's equity
    let cur=accRef.current;
    const settled=paperSettle(cur,Object.assign({},nu));
    const eqNow=paperEquity(settled,Object.assign({},nm));
    const snapped=nu&&Object.keys(nu).length?paperSnap(settled,eqNow):settled;
    if(snapped!==cur)setAcc(snapped);
  },[]);
  useEffect(()=>{
    if(!active)return undefined;
    refreshMarks();
    const id=setInterval(()=>{if(!document.hidden)refreshMarks();},30000);
    return()=>clearInterval(id);
  },[active,heldKey,refreshMarks]);

  // price of the symbol you are about to trade
  const pickSym=async(s)=>{
    s=String(s||"").toUpperCase().trim();if(!s)return;
    setSym(s);setSymIn("");setSel(null);setChain(null);setExps([]);setExp("");setOptErr(null);setMsg(null);setPx(null);
    const q=await fetchYFQuotes([s]);
    if(q[s]&&q[s].p>0){setPx(q[s].p);setUnder(u=>Object.assign({},u,{[s]:q[s].p}));}
    else setMsg({bad:true,t:`No price found for ${s}. Check the ticker.`});
  };
  useEffect(()=>{
    if(kind!=="opt"||!sym)return;
    let off=false;setOptLoad(true);setOptErr(null);
    fetch("/api/events?kind=optexp&symbol="+encodeURIComponent(sym)).then(r=>r.json()).then(j=>{
      if(off)return;
      if(j.error){setOptErr(j.error);setExps([]);setOptLoad(false);return;}
      const list=(j.expirations||[]).filter(d=>d>=todayET());
      setExps(list);
      const pref=list.find(d=>daysTo(d)>=14)||list[0]||"";
      setExp(pref);if(!pref)setOptLoad(false);
    }).catch(()=>{if(!off){setOptErr("provider_error");setOptLoad(false);}});
    return()=>{off=true;};
  },[kind,sym]);
  useEffect(()=>{
    if(kind!=="opt"||!sym||!exp)return;
    let off=false;setOptLoad(true);setSel(null);
    fetch(`/api/events?kind=optchain&symbol=${encodeURIComponent(sym)}&exp=${exp}`).then(r=>r.json()).then(j=>{
      if(off)return;setOptLoad(false);
      if(j.error){setOptErr(j.error);return;}
      setChain(j);if(j.under>0)setUnder(u=>Object.assign({},u,{[sym]:j.under}));
    }).catch(()=>{if(!off){setOptLoad(false);setOptErr("provider_error");}});
    return()=>{off=true;};
  },[kind,sym,exp]);

  const doTrade=(o)=>{
    const r=paperTrade(acc,o);
    if(r.error){setMsg({bad:true,t:r.error});return;}
    setAcc(r.acc);
    setMsg({t:`${o.side==="buy"?"Bought":"Sold"} ${o.qty} ${o.type==="opt"?"contract"+(o.qty>1?"s":""):"share"+(o.qty>1?"s":"")} of ${o.label} at ${usd(o.price)}${r.pl!=null?` · ${signedUsd(r.pl)} realized`:""}.`});
    setTimeout(refreshMarks,300);
  };
  const q=Math.max(0,Math.floor(Number(qty)||0));
  const eqNow=paperEquity(acc,marks);
  const openPL=held.reduce((v,p)=>v+(((marks[p.k]!=null?marks[p.k]:p.avg)-p.avg)*p.qty*p.mult),0);
  const realized=acc.trades.reduce((v,t)=>v+(t.pl||0),0);
  const totalRet=eqNow-acc.start;
  const insights=paperInsights(acc,marks,healthMap,earnMap);
  const sellers=acc.trades.filter(t=>t.pl!=null);
  const wins=sellers.filter(t=>t.pl>0).length;

  const card={background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px",marginBottom:12,boxShadow:T.shadow};
  const lbl={fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub};
  const inp={padding:"9px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.text,fontSize:14,fontFamily:T.mono,minWidth:0,width:"100%",boxSizing:"border-box"};
  const btn=(c,dis)=>({padding:"10px 14px",borderRadius:8,border:`1px solid ${c}`,background:dis?"transparent":`${c}22`,color:dis?T.textSub:c,fontWeight:700,fontSize:13,cursor:dis?"not-allowed":"pointer",fontFamily:T.sans,flex:1,minHeight:42,opacity:dis?0.5:1});
  const stat=(l,v,c)=>(<div style={{minWidth:0}}><div style={lbl}>{l}</div><div style={{fontFamily:T.mono,fontSize:mobile?15:17,fontWeight:700,color:c||T.text,fontVariantNumeric:"tabular-nums",overflowWrap:"anywhere"}}>{v}</div></div>);

  // option chain rows
  const rows=chain&&chain.rows?chain.rows.filter(r=>r.r===right).sort((a,b)=>a.k-b.k):[];
  const u0=chain&&chain.under>0?chain.under:px;
  let shown=rows;
  if(!allK&&rows.length>14&&u0>0){
    let ai=0,best=1e9;rows.forEach((r,i)=>{const d=Math.abs(r.k-u0);if(d<best){best=d;ai=i;}});
    shown=rows.slice(Math.max(0,ai-6),Math.max(0,ai-6)+14);
  }
  const selRow=sel&&rows.find(r=>r.o===sel);
  const fillBuy=selRow?(selRow.a>0?selRow.a:selRow.l>0?selRow.l:null):null;
  const fillSell=selRow?(selRow.b>0?selRow.b:selRow.l>0?selRow.l:null):null;
  const heldSel=selRow?acc.pos[selRow.o]:null;
  const optLabel=selRow?`${sym} ${fmtExp(exp)} ${selRow.k} ${right==="p"?"Put":"Call"}`:"";
  const optMeta=selRow?{exp,k:selRow.k,r:right}:null;
  const stockHeld=sym?acc.pos[sym]:null;

  return(
    <div style={{maxWidth:980,margin:"0 auto"}}>
      <div style={{...card,paddingBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={lbl}>Paper trading · virtual money</div>
            <div style={{fontFamily:T.mono,fontSize:mobile?26:32,fontWeight:800,color:T.text,fontVariantNumeric:"tabular-nums",marginTop:2}}>{usd(eqNow)}</div>
            <div style={{fontSize:12,color:totalRet>=0?T.up:T.down,fontFamily:T.mono,fontWeight:700}}>{signedUsd(totalRet)} ({(totalRet/acc.start*100>=0?"+":"")+(totalRet/acc.start*100).toFixed(2)}%) since you started</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <span title={sync.s==="synced"?"Your account is saved to your access code":"Saved in this browser only"} style={{fontSize:10,padding:"3px 9px",borderRadius:10,border:`1px solid ${sync.s==="synced"?T.up:sync.s==="error"?T.down:T.border}`,color:sync.s==="synced"?T.up:sync.s==="error"?T.down:T.textSub}}>
              {sync.s==="synced"?"Synced to your access code":sync.s==="syncing"?"Syncing…":sync.s==="error"?"Sync problem, saved on this device":code?"Saved on this device":"Saved on this device · add an access code in Settings to sync"}
            </span>
            {!confirmReset
              ?<button onClick={()=>setConfirmReset(true)} style={{fontSize:11,padding:"4px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,cursor:"pointer"}}>Reset account</button>
              :<span style={{display:"flex",gap:6,alignItems:"center",fontSize:11,color:T.textSub}}>Start over with $100,000?
                <button onClick={()=>{setAcc(paperNew());setMarks({});setConfirmReset(false);setMsg(null);}} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${T.down}`,background:`${T.down}18`,color:T.down,cursor:"pointer",fontWeight:700}}>Yes, reset</button>
                <button onClick={()=>setConfirmReset(false)} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,cursor:"pointer"}}>Cancel</button></span>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12,marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
          {stat("Cash",usd(acc.cash))}
          {stat("Open P&L",signedUsd(openPL),openPL>=0?T.up:T.down)}
          {stat("Realized",signedUsd(realized),realized>=0?T.up:T.down)}
          {stat("Win rate",sellers.length?Math.round(wins/sellers.length*100)+"% of "+sellers.length:"n/a")}
        </div>
        {acc.eq.length>=2&&(()=>{
          const v=acc.eq.map(e=>e.v),mn=Math.min(...v),mx=Math.max(...v),W=300,H=44;
          const pts=v.map((y,i)=>`${(i/(v.length-1)*W).toFixed(1)},${(H-2-(y-mn)/((mx-mn)||1)*(H-4)).toFixed(1)}`).join(" ");
          return(<div style={{marginTop:10}}><div style={lbl}>Account value by day</div><svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke={totalRet>=0?T.up:T.down} strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div>);
        })()}
      </div>

      {insights.length>0&&(
        <div style={card}>
          <div style={{...lbl,marginBottom:6}}>Portfolio checks</div>
          {insights.map((x,i)=>(<div key={i} style={{display:"flex",gap:8,fontSize:12,color:T.text,lineHeight:1.5,padding:"4px 0"}}><span style={{color:x.sev==="watch"?"#F59E0B":T.textSub}}>{x.sev==="watch"?"▲":"●"}</span><span>{x.t}</span></div>))}
        </div>
      )}

      <div style={card}>
        <div style={{...lbl,marginBottom:8}}>Open positions ({held.length})</div>
        {!held.length&&<div style={{fontSize:12,color:T.textSub,lineHeight:1.6}}>Nothing yet. Use the trade ticket below to buy a stock or an option. Your positions, profit and loss, and checks show up here.</div>}
        {held.map(p=>{
          const mk=marks[p.k]!=null?marks[p.k]:p.avg;const pl=(mk-p.avg)*p.qty*p.mult;const plp=p.avg?(mk/p.avg-1)*100:0;
          return(
            <div key={p.k} style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",alignItems:"center",padding:"10px 0",borderTop:`1px solid ${T.border}`}}>
              <div style={{flex:"1 1 170px",minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text,overflowWrap:"anywhere"}}>{posLabel(p)}</div>
                <div style={{fontSize:10,color:T.textSub}}>{p.qty} {p.type==="opt"?"contract"+(p.qty>1?"s":""):"share"+(p.qty>1?"s":"")} · avg {usd(p.avg)}{p.type==="opt"&&p.meta?` · ${daysTo(p.meta.exp)}d left`:` · ${names[p.sym]||""}`}</div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}><HealthBadge h={healthMap[p.sym]} T={T}/><EarnChip e={earnMap[p.sym]} T={T}/></div>
              </div>
              <div style={{textAlign:"right",fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>
                <div style={{fontSize:13,color:T.text}}>{usd(mk*p.qty*p.mult)}</div>
                <div style={{fontSize:11,fontWeight:700,color:pl>=0?T.up:T.down}}>{signedUsd(pl)} ({(plp>=0?"+":"")+plp.toFixed(1)}%)</div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>onOpen&&onOpen(p.sym)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer"}}>Chart</button>
                {p.type==="stock"
                  ?<button onClick={()=>{setKind("stock");pickSym(p.sym);setQty(String(p.qty));}} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.down}`,background:`${T.down}14`,color:T.down,fontSize:11,fontWeight:700,cursor:"pointer"}}>Sell</button>
                  :<button onClick={()=>{setKind("opt");pickSym(p.sym).then(()=>{setRight(p.meta.r);});setExp(p.meta.exp);setQty(String(p.qty));}} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.down}`,background:`${T.down}14`,color:T.down,fontSize:11,fontWeight:700,cursor:"pointer"}}>Sell</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={card}>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{...lbl,marginRight:6}}>Trade ticket</div>
          {[["stock","Stocks"],["opt","Options"]].map(([k,l])=>(<button key={k} onClick={()=>{setKind(k);setMsg(null);setQty(k==="opt"?"1":"10");}} style={{padding:"6px 14px",borderRadius:999,border:`1px solid ${kind===k?T.accent:T.border}`,background:kind===k?T.accentBg:"transparent",color:kind===k?T.accent:T.textSub,fontWeight:kind===k?700:500,fontSize:12,cursor:"pointer"}}>{l}</button>))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
          <TickerSearch value={symIn} onChange={setSymIn} onSelect={pickSym} onKeyDown={e=>{if(e.key==="Enter")pickSym(symIn);}} T={T}/>
          <button onClick={()=>pickSym(symIn)} style={{padding:"8px 14px",borderRadius:8,border:"none",background:T.accent,color:T.accentInk,fontWeight:700,fontSize:12,cursor:"pointer"}}>Look up</button>
          {sym&&<span style={{fontFamily:T.mono,fontSize:14,fontWeight:700,color:T.text}}>{sym} {px?usd(px):""}</span>}
        </div>

        {kind==="stock"&&sym&&px&&(
          <div>
            <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:"0 0 130px"}}><div style={lbl}>Shares</div><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,""))} style={inp} aria-label="Shares"/></div>
              <div style={{fontSize:12,color:T.textSub,paddingBottom:10}}>Est. {usd(px*q)}{stockHeld?` · you hold ${stockHeld.qty}`:""}</div>
              <button onClick={()=>setQty(String(Math.floor(acc.cash/px)))} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer",marginBottom:4}}>Max buy</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={()=>doTrade({key:sym,type:"stock",sym,side:"buy",qty:q,price:px,mult:1,label:sym})} style={btn(T.up,!q)}>Buy {q||""} at {usd(px)}</button>
              <button onClick={()=>doTrade({key:sym,type:"stock",sym,side:"sell",qty:q,price:px,mult:1,label:sym})} style={btn(T.down,!q||!stockHeld)}>Sell {q||""}</button>
            </div>
          </div>
        )}

        {kind==="opt"&&sym&&(
          <div>
            {optErr==="options_not_configured"&&(
              <div role="alert" style={{padding:"10px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,fontSize:12,color:T.text,lineHeight:1.6}}>
                Options data is not connected on this site yet. The site owner needs to add a free Tradier sandbox token (<b>TRADIER_TOKEN</b>) in Vercel. Stock paper trading works without it.
              </div>
            )}
            {optErr&&optErr!=="options_not_configured"&&(
              <div role="alert" style={{padding:"10px 12px",borderRadius:8,border:`1px solid ${T.down}55`,background:`${T.down}12`,fontSize:12,color:T.text,lineHeight:1.6}}>
                {optErr==="provider_rate"?"The options provider is busy. Wait a few seconds and try again.":optErr==="provider_auth"?"The options provider rejected the site's token. The site owner should check TRADIER_TOKEN.":"Could not load options right now. Try again in a moment."}
              </div>
            )}
            {!optErr&&!optLoad&&exps.length===0&&<div style={{fontSize:12,color:T.textSub}}>No listed options found for {sym}. Not every stock has them.</div>}
            {exps.length>0&&(
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,scrollbarWidth:"thin"}} role="tablist" aria-label="Expiration dates">
                {exps.slice(0,24).map(d=>(<button key={d} role="tab" aria-selected={d===exp} onClick={()=>setExp(d)} style={{flexShrink:0,padding:"6px 11px",borderRadius:999,border:`1px solid ${d===exp?T.accent:T.border}`,background:d===exp?T.accentBg:"transparent",color:d===exp?T.accent:T.textSub,fontSize:11,fontWeight:d===exp?700:500,cursor:"pointer",whiteSpace:"nowrap"}}>{fmtExp(d)} <span style={{opacity:.7}}>{daysTo(d)}d</span></button>))}
              </div>
            )}
            {optLoad&&<LoadTimer T={T} compact label="Loading options chain" expected={5}/>}
            {chain&&!optLoad&&rows.length>0&&(
              <div>
                <div style={{display:"flex",gap:6,margin:"8px 0",alignItems:"center",flexWrap:"wrap"}}>
                  {[["c","Calls"],["p","Puts"]].map(([k,l])=>(<button key={k} onClick={()=>{setRight(k);setSel(null);}} style={{padding:"5px 14px",borderRadius:999,border:`1px solid ${right===k?T.accent:T.border}`,background:right===k?T.accentBg:"transparent",color:right===k?T.accent:T.textSub,fontWeight:right===k?700:500,fontSize:12,cursor:"pointer"}}>{l}</button>))}
                  {u0>0&&<span style={{fontSize:11,color:T.textSub}}>Stock {usd(u0)}</span>}
                  {rows.length>14&&<button onClick={()=>setAllK(v=>!v)} style={{marginLeft:"auto",fontSize:11,padding:"4px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,cursor:"pointer"}}>{allK?"Near the money":"All strikes"}</button>}
                </div>
                <div style={{overflowX:"auto",border:`1px solid ${T.border}`,borderRadius:8}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontFamily:T.mono,fontSize:mobile?11:12,fontVariantNumeric:"tabular-nums"}}>
                    <thead><tr style={{background:T.surfaceB,color:T.textSub,textAlign:"right"}}>{["Strike","Bid","Ask","IV","Delta","Open int."].map((h,i)=>(<th key={h} scope="col" style={{padding:"6px 8px",fontWeight:600,fontSize:10,textAlign:i?"right":"left",whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
                    <tbody>
                      {shown.map(r=>{
                        const itm=u0>0&&(right==="c"?r.k<u0:r.k>u0);const on=r.o===sel;
                        return(<tr key={r.o} onClick={()=>setSel(on?null:r.o)} tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSel(on?null:r.o);}}} aria-selected={on} style={{cursor:"pointer",background:on?T.accentBg:itm?`${T.accent}0D`:"transparent",outline:on?`2px solid ${T.accent}`:"none",outlineOffset:-2,borderTop:`1px solid ${T.border}`,textAlign:"right"}}>
                          <td style={{padding:"8px",textAlign:"left",fontWeight:700,color:T.text}}>{r.k}{acc.pos[r.o]?" ●":""}</td>
                          <td style={{padding:"8px",color:T.text}}>{r.b!=null?r.b.toFixed(2):"–"}</td>
                          <td style={{padding:"8px",color:T.text}}>{r.a!=null?r.a.toFixed(2):"–"}</td>
                          <td style={{padding:"8px",color:T.textSub}}>{r.iv!=null?(r.iv*100).toFixed(0)+"%":"–"}</td>
                          <td style={{padding:"8px",color:T.textSub}}>{r.d!=null?r.d.toFixed(2):"–"}</td>
                          <td style={{padding:"8px",color:T.textSub}}>{r.oi}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:10,color:T.textSub,margin:"6px 0 0"}}>Tinted rows are in the money. Tap a row to pick a contract. One contract controls 100 shares.</div>
              </div>
            )}
            {selRow&&u0>0&&(
              <div style={{marginTop:12,padding:12,borderRadius:10,border:`1px solid ${T.accent}`,background:T.surfaceB}}>
                <div style={{fontSize:14,fontWeight:700,color:T.text}}>{optLabel}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,margin:"10px 0"}}>
                  {stat("You pay (ask)",fillBuy?usd(fillBuy):"n/a")}
                  {stat("Cost",fillBuy?usd(fillBuy*100*q,0):"n/a")}
                  {fillBuy&&stat("Breakeven",usd(right==="p"?selRow.k-fillBuy:selRow.k+fillBuy))}
                  {fillBuy&&stat("Move needed",((right==="p"?(selRow.k-fillBuy)/u0-1:(selRow.k+fillBuy)/u0-1)*100).toFixed(1)+"%")}
                  {selRow.d!=null&&stat("Delta",selRow.d.toFixed(2))}
                  {selRow.th!=null&&stat("Theta/day",usd(selRow.th*100*q))}
                </div>
                {fillBuy&&<PayoffChart type={right} strike={selRow.k} premium={fillBuy} qty={q||1} under={u0} T={T}/>}
                <div style={{fontSize:11,color:T.textSub,margin:"4px 0 10px",lineHeight:1.5}}>The most you can lose on a bought option is what you pay. Theta is the value it loses each day if nothing else changes. {daysTo(exp)} days to expiry.</div>
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div style={{flex:"0 0 120px"}}><div style={lbl}>Contracts</div><input inputMode="numeric" value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9]/g,""))} style={inp} aria-label="Contracts"/></div>
                  {heldSel&&<span style={{fontSize:12,color:T.textSub,paddingBottom:10}}>You hold {heldSel.qty}</span>}
                </div>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button disabled={!q||!fillBuy} onClick={()=>doTrade({key:selRow.o,type:"opt",sym,side:"buy",qty:q,price:fillBuy,mult:100,meta:optMeta,label:optLabel})} style={btn(T.up,!q||!fillBuy)}>Buy to open at {fillBuy?usd(fillBuy):"–"}</button>
                  <button disabled={!q||!heldSel||!fillSell} onClick={()=>doTrade({key:selRow.o,type:"opt",sym,side:"sell",qty:q,price:fillSell,mult:100,meta:optMeta,label:optLabel})} style={btn(T.down,!q||!heldSel||!fillSell)}>Sell to close{fillSell?` at ${usd(fillSell)}`:""}</button>
                </div>
              </div>
            )}
            <div style={{fontSize:10,color:T.textSub,marginTop:8,lineHeight:1.5}}>{PAPER_NOTE_OPT}</div>
          </div>
        )}
        {!sym&&<div style={{fontSize:12,color:T.textSub,lineHeight:1.6}}>Search a ticker to trade it with virtual money. Stock paper trades fill at the live price. Long positions only for now: buy, then sell to close.</div>}
        {msg&&<div role="status" style={{marginTop:10,padding:"8px 10px",borderRadius:8,fontSize:12,border:`1px solid ${msg.bad?T.down:T.up}55`,background:`${msg.bad?T.down:T.up}12`,color:T.text}}>{msg.t}</div>}
      </div>

      <div style={card}>
        <div style={{...lbl,marginBottom:6}}>History</div>
        {!acc.trades.length&&<div style={{fontSize:12,color:T.textSub}}>Your trades will be listed here.</div>}
        {acc.trades.slice(0,25).map((t,i)=>(
          <div key={t.t+"-"+i} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,padding:"7px 0",borderTop:i?`1px solid ${T.border}`:"none",flexWrap:"wrap"}}>
            <span style={{color:T.text,minWidth:0,overflowWrap:"anywhere"}}><b style={{color:t.side==="buy"?T.up:T.down}}>{t.side==="buy"?"Bought":"Sold"}</b> {t.qty} {posLabel({type:t.type,sym:t.sym,meta:t.meta})} at {usd(t.price)}{t.note?` (${t.note})`:""}</span>
            <span style={{fontFamily:T.mono,color:t.pl==null?T.textSub:t.pl>=0?T.up:T.down}}>{t.pl==null?new Date(t.t).toLocaleDateString("en-US",{month:"short",day:"numeric"}):signedUsd(t.pl)}</span>
          </div>
        ))}
      </div>
      <div style={{fontSize:10,color:T.textSub,textAlign:"center",lineHeight:1.6,padding:"0 8px"}}>Paper trading uses virtual money for learning. Results do not predict real trading, which includes fees, slippage and emotions. Not financial advice.</div>
    </div>
  );
}

const SECTIONS=[
  {id:"overview",label:"Overview"},
  {id:"watchlist",label:"Watchlist"},
  {id:"earnings",label:"Earnings"},
  {id:"playbooks",label:"Playbooks"},
  {id:"paper",label:"Paper trading",short:"Paper"},
  {id:"concierge",label:"Concierge"},
  {id:"settings",label:"Settings"},
];
function NavIcon({k,c}){
  const P={
    overview:"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    watchlist:"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    earnings:"M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 13h3",
    playbooks:"M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
    paper:"M4 19V5M4 19h16M8 15l3-4 3 2 5-7M16 6h3v3",
    concierge:"M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    settings:"M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6",
  };
  return(<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[k]}/></svg>);
}
function SectionNav({T,sec,onSelect,badges,mobile}){
  if(mobile){
    return(
      <div data-mobile-nav role="tablist" aria-label="Sections" style={{position:"fixed",left:0,right:0,bottom:0,zIndex:40,display:"grid",gridTemplateColumns:`repeat(${SECTIONS.length},1fr)`,background:T.surface,borderTop:`1px solid ${T.border}`,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        {SECTIONS.map(x=>{
          const on=sec===x.id;
          const b=badges&&badges[x.id];
          const col=on?T.accent:T.textSub;
          return(
            <button key={x.id} role="tab" aria-selected={on} aria-label={x.label} onClick={()=>onSelect(x.id)} style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"9px 2px 8px",minHeight:56,border:"none",background:"transparent",color:col,cursor:"pointer",fontFamily:T.sans,fontSize:10,fontWeight:on?700:500,WebkitTapHighlightColor:"transparent"}}>
              <NavIcon k={x.id} c={col}/>
              <span style={{maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.short||x.label}</span>
              {b?<span style={{position:"absolute",top:5,left:"calc(50% + 6px)",fontSize:9,fontWeight:700,minWidth:15,height:15,lineHeight:"15px",textAlign:"center",padding:"0 4px",borderRadius:4,fontFamily:T.mono,background:T.accent,color:T.accentInk}}>{b}</span>:null}
              {on&&<span style={{position:"absolute",top:0,left:"22%",right:"22%",height:2,borderRadius:2,background:T.accent}}/>}
            </button>
          );
        })}
      </div>
    );
  }
  return(
    <div style={{position:"sticky",top:0,zIndex:30,background:T.bg,padding:"6px 0 12px"}}>
    <div role="tablist" aria-label="Sections" style={{display:"grid",gridTemplateColumns:`repeat(${SECTIONS.length},minmax(0,1fr))`,gap:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:T.shadow,overflow:"hidden"}}>
      {SECTIONS.map((x,i)=>{
        const on=sec===x.id;
        const b=badges&&badges[x.id];
        const col=on?T.accent:T.textSub;
        return(
          <button key={x.id} role="tab" aria-selected={on} onClick={()=>onSelect(x.id)} className="top-tab" style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:"10px 6px 9px",minHeight:58,border:"none",borderLeft:i?`1px solid ${T.border}`:"none",background:on?T.accentBg:"transparent",color:col,cursor:"pointer",fontFamily:T.sans,fontSize:11,fontWeight:on?700:500,whiteSpace:"nowrap",transition:"background .15s,color .15s"}}>
            <NavIcon k={x.id} c={col}/>
            <span>{x.label}</span>
            {b?<span style={{position:"absolute",top:7,left:"calc(50% + 10px)",fontSize:9,fontWeight:700,minWidth:15,height:15,lineHeight:"15px",textAlign:"center",padding:"0 4px",borderRadius:4,fontFamily:T.mono,background:T.accent,color:T.accentInk}}>{b}</span>:null}
            {on&&<span style={{position:"absolute",top:0,left:"24%",right:"24%",height:2,borderRadius:2,background:T.accent}}/>}
          </button>
        );
      })}
    </div>
    </div>
  );
}

export default function StockScreener(){
  const [prefs,setPrefs]=useState(loadPrefs);
  UI_ZOOM=(prefs.text||100)/100;
  const [sysDark,setSysDark]=useState(()=>{try{return window.matchMedia("(prefers-color-scheme: dark)").matches;}catch{return true;}});
  useEffect(()=>{
    let mq;try{mq=window.matchMedia("(prefers-color-scheme: dark)");}catch{return undefined;}
    const f=e=>setSysDark(e.matches);
    if(mq.addEventListener)mq.addEventListener("change",f);
    return()=>{if(mq.removeEventListener)mq.removeEventListener("change",f);};
  },[]);
  const isDark=prefs.mode==="auto"?sysDark:prefs.mode!=="light";
  const T=useMemo(()=>makeTheme(isDark,prefs),[isDark,prefs.accent,prefs.shade,prefs.contrast]);// eslint-disable-line
  const setPref=useCallback((k,v)=>setPrefs(p=>Object.assign({},p,{[k]:v})),[]);
  const resetPrefs=useCallback(()=>setPrefs(p=>Object.assign({},DEFAULT_PREFS,{mode:p.mode})),[]);
  const [isMobile,setIsMobile]=useState(false);
  const [names,setNames]=useState({...BASE_NAMES});
  const [tabs,setTabs]=useState(()=>{try{const s=JSON.parse(localStorage.getItem("screener_tabs")??"null");return s?.length?s:DEFAULT_TABS;}catch{return DEFAULT_TABS;}});
  const [activeTab,setActiveTab]=useState(()=>{try{return localStorage.getItem("screener_activeTab")||"tech";}catch{return"tech";}});
  const [indices,setIndices]=useState(INDICES);
  const [mktNews,setMktNews]=useState([]);
  const [alertModal,setAlertModal]=useState(null);
  const [showAlertList,setShowAlertList]=useState(false);
  const [session]=useState(getMarketSession);
  const [showFilters,setShowFilters]=useState(false);
  const [filters,setFilters]=useState({changeMin:null,changeMax:null});
  const [selectedIdx,setSelectedIdx]=useState(null);
  const [selected,setSelected]=useState(null);
  const [sec,setSecRaw]=useState(()=>{try{const st=loadPrefs().start;if(st&&st!=="last"&&SECTIONS.some(x=>x.id===st))return st;const v=localStorage.getItem("screener_section");return SECTIONS.some(x=>x.id===v)?v:"watchlist";}catch{return"watchlist";}});
  const setSec=useCallback(v=>{setSecRaw(v);try{localStorage.setItem("screener_section",v);}catch{}if(typeof window!=="undefined"&&window.scrollTo)window.scrollTo({top:0});},[]);
  const [viewMode,setViewMode]=useState(()=>{try{return localStorage.getItem("screener_viewMode")||"grid";}catch{return"grid";}});
  const [sort,setSort]=useState(()=>{try{return localStorage.getItem("screener_sort")||"change_desc";}catch{return"change_desc";}});
  const [newTicker,setNewTicker]=useState("");
  const [newTabName,setNewTabName]=useState("");
  const [addingTab,setAddingTab]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh,setAutoRefresh]=useState(()=>{try{const v=localStorage.getItem("screener_auto");return v===null?true:v==="1";}catch{return true;}});
  useEffect(()=>{try{localStorage.setItem("screener_auto",autoRefresh?"1":"0");}catch{}},[autoRefresh]);
  const [lastRefresh,setLastRefresh]=useState(null);
  const [priceHealth,setPriceHealth]=useState({ok:true,got:0,want:0,stale:0});
  const autoRef=useRef(null);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<680);
    check();window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{try{localStorage.setItem("screener_prefs",JSON.stringify(prefs));localStorage.setItem("screener_dark",JSON.stringify(isDark));}catch{}},[prefs,isDark]);
  useEffect(()=>{try{localStorage.setItem("screener_tabs",JSON.stringify(tabs));}catch{}},[tabs]);
  useEffect(()=>{try{localStorage.setItem("screener_activeTab",activeTab);}catch{}},[activeTab]);
  useEffect(()=>{try{localStorage.setItem("screener_viewMode",viewMode);}catch{}},[viewMode]);
  useEffect(()=>{try{localStorage.setItem("screener_sort",sort);}catch{}},[sort]);

  useEffect(()=>{
    if(autoRef.current)clearInterval(autoRef.current);
    if(autoRefresh){autoRef.current=setInterval(()=>{if(typeof document==='undefined'||!document.hidden)runRefresh(curTab.stocks);},(prefs.refresh||30)*1000);}
    return()=>{ if(autoRef.current)clearInterval(autoRef.current); };
  },[autoRefresh,activeTab,prefs.refresh]);

  // refresh right away when the tab becomes visible again (timers are throttled in background tabs)
  useEffect(()=>{
    const f=()=>{if(!document.hidden&&autoRefresh)runRefresh(tabsRef.current[0].stocks);};
    document.addEventListener("visibilitychange",f);
    return()=>document.removeEventListener("visibilitychange",f);
  },[autoRefresh]);// eslint-disable-line

  const curTab=tabs.find(t=>t.id===activeTab)||tabs[0];
  const [earnMap,setEarnMap]=useState({});
  const [earnOnly,setEarnOnly]=useState(false);
  const [autoSym,setAutoSym]=useState(null);
  const allStocks=useMemo(()=>[...curTab.stocks].sort((a,b)=>{
    const ca=pct(a.p||0,a.pc||1),cb=pct(b.p||0,b.pc||1);
    if(sort==="earn"){
      const ea=earnMap[a.s],eb=earnMap[b.s];
      if(ea&&eb)return ea.date<eb.date?-1:ea.date>eb.date?1:cb-ca;
      if(ea)return -1;
      if(eb)return 1;
      return cb-ca;
    }
    if(sort==="change_desc")return cb-ca;
    if(sort==="change_asc") return ca-cb;
    return a.s.localeCompare(b.s);
  }),[curTab,sort,earnMap]);
  const stocks=useMemo(()=>allStocks.filter(s=>{
    if(earnOnly&&!earnMap[s.s])return false;
    if(!s.p||!s.pc)return true;
    const ch=pct(s.p,s.pc);
    if(filters.changeMin!=null&&ch<filters.changeMin)return false;
    if(filters.changeMax!=null&&ch>filters.changeMax)return false;
    return true;
  }),[allStocks,filters,earnOnly,earnMap]);

  // Health checks (fundamentals) for the stocks in the active tab
  const [fund,setFund]=useState({});
  const [fundLoading,setFundLoading]=useState(false);
  const [glossaryOpen,setGlossaryOpen]=useState(false);
  const [glossaryFocus,setGlossaryFocus]=useState(null);
  const tabSymKey=curTab.stocks.map(x=>x.s).join(",");
  useEffect(()=>{
    const syms=tabSymKey?tabSymKey.split(","):[];
    if(!syms.length)return undefined;
    let dead=false;
    setFundLoading(true);
    fetchFundamentals(syms,{onBatch:m=>{if(!dead)setFund(p=>Object.assign({},p,m));}})
      .catch(()=>{}).finally(()=>{if(!dead)setFundLoading(false);});
    return()=>{dead=true;};
  },[tabSymKey]);
  const healthMap=useMemo(()=>{
    const o={};
    Object.keys(fund).forEach(sy=>{o[sy]=computeHealth(fund[sy],SECTOR_OF[sy]);});
    return o;
  },[fund]);
  useEffect(()=>{
    const h=e=>{setGlossaryFocus(e.detail||null);setGlossaryOpen(true);};
    window.addEventListener("open-glossary",h);
    return()=>window.removeEventListener("open-glossary",h);
  },[]);

  const allSymbols=useMemo(()=>[...new Set(tabs.flatMap(t=>t.stocks.map(s=>s.s)))]   ,[tabs]);

  // Auto-fetch prices on first load
  const didMount=useRef(false);
  useEffect(()=>{
    if(didMount.current)return;
    didMount.current=true;
    // Fetch news immediately so it appears without waiting for price refresh
    fetchYFNews("stock market",8).then(articles=>{
      if(articles.length)
        setMktNews(articles.map(n=>({h:n.title,url:n.link,publisher:n.publisher,time:n.providerPublishTime,sentiment:inferSentiment(n.title)})));
    }).catch(()=>{});
    setTimeout(()=>runRefresh(curTab.stocks),600);
  },[]);// eslint-disable-line

  // Core refresh — fetches prices for ALL tabs at once
  // Always-current tabs ref — lets runRefresh read latest without stale closure
  const tabsRef=useRef(tabs);
  useEffect(()=>{tabsRef.current=tabs;},[tabs]);

  const runRefresh=useCallback(async(stockList)=>{
    setRefreshing(true);

    // Use tabsRef.current so newly added tickers are always included
    const allTabSyms=[...new Set(tabsRef.current.flatMap(t=>t.stocks.map(s=>s.s)))];
    const allSyms=[...new Set([...allTabSyms,...INDICES.map(i=>i.s)])];

    // ── Step 1: Finnhub via /api/quotes ─────────────────────────────────
    let priceMap=await fetchYFQuotes(allSyms);

    // ── Step 2: Simple fetch fallback for any missing (no Claude needed) ─
    const missing=allSyms.filter(s=>!priceMap[s]||priceMap[s].p===0);
    if(missing.length>0&&missing.length<allSyms.length){
      // Retry missing symbols individually with a short delay
      await Promise.allSettled(missing.map(async sym=>{
        try{
          const r=await fetch(`/api/quotes?symbols=${encodeURIComponent(sym)}`,{signal:AbortSignal.timeout(6000)});
          if(!r.ok)return;
          const d=await r.json();
          if(d[sym]?.p>0)priceMap[sym]=d[sym];
        }catch{}
      }));
    }

    // ── Step 3: Update ALL tabs + indices ────────────────────────────────
    setIndices(prev=>prev.map(idx=>{
      const u=priceMap[idx.s];
      return u?.p>0?{...idx,p:u.p,pc:u.pc}:idx;
    }));
    setTabs(prev=>prev.map(t=>({
      ...t,
      stocks:t.stocks.map(s=>{
        const u=priceMap[s.s];
        return u?.p>0?{...s,p:u.p,pc:u.pc}:s;
      })
    })));
    // Update company names
    Object.entries(priceMap).forEach(([sym,d])=>{if(d.name&&d.name!==sym)setNames(n=>({...n,[sym]:d.name}));});

    // ── Step 4: Market news from Yahoo Finance ───────────────────
    fetchYFNews("stock market today",6).then(articles=>{
      if(articles.length){
        setMktNews(articles.map(n=>({h:n.title,url:n.link,publisher:n.publisher,time:n.providerPublishTime,sentiment:inferSentiment(n.title)})));
      }
    }).catch(()=>{});

    const gotN=allSyms.filter(x=>priceMap[x]&&priceMap[x].p>0).length;
    setPriceHealth({ok:gotN>0,got:gotN,want:allSyms.length,stale:allSyms.filter(x=>priceMap[x]&&priceMap[x].stale).length});
    checkAndFireAlerts(curTab.stocks);
    if(gotN>0)setLastRefresh(new Date());
    setRefreshKey(k=>k+1);
    setRefreshing(false);
  },[activeTab]); // tabs accessed via tabsRef — always current, no dep needed

  // Keep selected index chart in sync when prices refresh
  useEffect(()=>{
    if(!selectedIdx)return;
    const updated=indices.find(i=>i.s===selectedIdx.s);
    if(updated&&(updated.p!==selectedIdx.p||updated.pc!==selectedIdx.pc)){
      setSelectedIdx(updated);
    }
  },[indices]);

  const addTickerBySymbol=useCallback(async(sym)=>{
    sym=sym.trim().toUpperCase();
    if(!sym)return;
    let alreadyExists=false;
    setTabs(prev=>{
      const cur=prev.find(t=>t.id===activeTab);
      if(cur?.stocks.some(s=>s.s===sym)){alreadyExists=true;return prev;}
      return prev.map(t=>t.id===activeTab?{...t,stocks:[...t.stocks,{s:sym,p:0,pc:0,loading:true}]}:t);
    });
    if(alreadyExists)return;

    // Fetch price for the new symbol immediately
    const yfResult=await fetchYFQuotes([sym]);
    if(yfResult[sym]?.p>0){
      const{p,pc,name}=yfResult[sym];
      if(name&&name!==sym)setNames(n=>({...n,[sym]:name}));
      setTabs(prev=>prev.map(t=>t.id===activeTab?{...t,stocks:t.stocks.map(s=>s.s===sym?{s:sym,p,pc:pc||p,loading:false}:s)}:t));
    }else{
      // Price fetch failed — mark loaded (0 price), runRefresh will pick it up
      setTabs(prev=>prev.map(t=>t.id===activeTab?{...t,stocks:t.stocks.map(s=>s.s===sym?{...s,loading:false}:s)}:t));
      // Trigger a full refresh so new ticker gets prices with everything else
      setTimeout(()=>runRefresh(),500);
    }
  },[activeTab,runRefresh]);

  // Tap a ticker in the earnings panel: switch to its tab, open its details, scroll there, start the analysis
  const pickSymbol=useCallback(sym=>{
    const t=tabsRef.current.find(x=>x.stocks.some(s=>s.s===sym));
    if(!t)return;
    setSecRaw("watchlist");try{localStorage.setItem("screener_section","watchlist");}catch{}
    setActiveTab(t.id);
    setSelected(t.stocks.find(s=>s.s===sym));
    setAutoSym(sym);
    setTimeout(()=>{
      const el=document.getElementById("stock-detail");
      if(el&&el.scrollIntoView)el.scrollIntoView({behavior:"smooth",block:"start"});
    },250);
  },[]);
  const addTicker=()=>{if(newTicker.trim()){addTickerBySymbol(newTicker);setNewTicker("");}}

  const addTab=()=>{
    if(!newTabName.trim())return;
    const id=newTabName.trim().toLowerCase().replace(/\s+/g,"-")+Date.now();
    setTabs(p=>[...p,{id,label:newTabName.trim(),stocks:[]}]);
    setActiveTab(id);setNewTabName("");setAddingTab(false);
  };
  const removeTab=id=>{setTabs(p=>p.filter(t=>t.id!==id));if(activeTab===id)setActiveTab(tabs[0].id);};
  const removeTicker=sym=>{setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.filter(s=>s.s!==sym)}:t));if(selected?.s===sym)setSelected(null);};

  const timeSince=lastRefresh?`Prices ${lastRefresh.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true})}${priceHealth.got<priceHealth.want?` · ${priceHealth.got}/${priceHealth.want} loaded`:""}${priceHealth.stale?" · some delayed":""}`:(priceHealth.ok?"":"Prices unavailable");

  const StockList=(
    <div style={{maxHeight:isMobile?"none":"62vh",overflowY:"auto",paddingRight:isMobile?0:12,scrollbarGutter:isMobile?"auto":"stable"}}>
      {showFilters&&(
        <div style={{display:"flex",gap:6,padding:"10px 12px",background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,marginRight:4}}>Filter by change</span>
          {[["▲>2%",2],["▲>5%",5],["▲>10%",10]].map(([lbl,v])=>{const on=filters.changeMin===v;return(<button key={lbl} onClick={()=>setFilters(p=>on?{changeMin:null,changeMax:null}:{changeMin:v,changeMax:null})} style={{padding:"3px 8px",borderRadius:20,border:`1px solid ${on?T.up:T.border}`,background:on?`${T.up}18`:"transparent",color:on?T.up:T.textSub,fontSize:10,cursor:"pointer",fontWeight:on?700:400}}>{lbl}</button>);})}
          {[["▼>2%",-2],["▼>5%",-5],["▼>10%",-10]].map(([lbl,v])=>{const on=filters.changeMax===v;return(<button key={lbl} onClick={()=>setFilters(p=>on?{changeMin:null,changeMax:null}:{changeMax:v,changeMin:null})} style={{padding:"3px 8px",borderRadius:20,border:`1px solid ${on?T.down:T.border}`,background:on?`${T.down}18`:"transparent",color:on?T.down:T.textSub,fontSize:10,cursor:"pointer",fontWeight:on?700:400}}>{lbl}</button>);})}
          <button onClick={()=>setFilters({changeMin:null,changeMax:null})} style={{marginLeft:"auto",fontSize:10,color:T.textSub,background:"none",border:"none",cursor:"pointer"}}><I.X s={9}/> Clear</button>
          <span style={{fontSize:10,color:T.textSub}}>{stocks.length}/{allStocks.length} shown</span>
        </div>
      )}
      {viewMode==="grid"
        ?<div style={{display:"grid",gridTemplateColumns:selected&&!isMobile?"1fr":"repeat(auto-fill,minmax(160px,1fr))",gap:10,alignItems:"start"}}>
           {stocks.map(st=>(
             <GridCard key={st.s} stock={st} selected={selected?.s===st.s}
               onClick={()=>setSelected(s=>s?.s===st.s?null:st)}
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing} health={healthMap[st.s]} earn={earnMap[st.s]}
               onSetAlert={()=>setAlertModal({symbol:st.s,price:st.p})}/>
           ))}
         </div>
        :<div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.shadow}}>
           {stocks.map(st=>(
             <ListRow key={st.s} stock={st} selected={selected?.s===st.s}
               onClick={()=>setSelected(s=>s?.s===st.s?null:st)}
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing} health={healthMap[st.s]} earn={earnMap[st.s]}/>
           ))}
         </div>
      }
    </div>
  );

  return(
    <div style={{minHeight:"100vh",zoom:prefs.text===100?undefined:prefs.text/100,background:T.bg,color:T.text,fontFamily:T.sans,padding:isMobile?"10px 12px 32px":"18px 24px 48px",boxSizing:"border-box",transition:"background 0.2s,color 0.2s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        html,body,#root{margin:0;padding:0;background:${T.bg};}
        *{box-sizing:border-box;}
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes tfbar {0%{margin-left:-35%}100%{margin-left:100%}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:0.9}}
        @keyframes purpleGlow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 3px ${T.accent}55}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
        input::placeholder{color:${T.textSub}}
        .lr-wrap{container-type:inline-size}
        .pill:hover{filter:brightness(1.08);transform:translateY(-1px)}
        .pill:active{transform:scale(.97)}
        .pill-x:hover{background:rgba(220,60,60,.18)!important;color:#E5484D!important}
        .top-tab:hover{background:rgba(127,127,160,.10)}
        @media (prefers-reduced-motion:reduce){.pill:hover,.pill:active{transform:none}}
        @container (max-width:470px){.lr-spark{display:none!important}}
        .cc-chip{transition:transform .15s ease,background .15s ease,border-color .15s ease,color .15s ease;will-change:transform}
        .cc-chip:not(:disabled):hover{transform:translateY(-2px);background:${T.accentBg}!important;border-color:${T.accent}!important;color:${T.accent}!important}
        .cc-chip:not(:disabled):active{transform:scale(.95)}
        .cc-chip:focus-visible,.cc-send:focus-visible{outline:2px solid ${T.accent};outline-offset:2px}
        .cc-chip.picked{animation:ccPick .6s ease;background:${T.accentBg}!important;border-color:${T.accent}!important;color:${T.accent}!important}
        .cc-send{transition:transform .15s ease,opacity .15s ease,filter .15s ease}
        .cc-send:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.08)}
        .cc-send:not(:disabled):active{transform:scale(.94)}
        .cc-send.sent{animation:ccSend .5s ease}
        .cc-msg{animation:ccIn .28s cubic-bezier(.2,.8,.2,1)}
        .cc-dots span{display:inline-block;width:6px;height:6px;margin-right:4px;border-radius:50%;background:${T.accent};animation:ccDot 1.1s infinite ease-in-out}
        .cc-dots span:nth-child(2){animation-delay:.15s}.cc-dots span:nth-child(3){animation-delay:.3s}
        .cc-rail{scrollbar-width:none}.cc-rail::-webkit-scrollbar{display:none}
        @keyframes ccPick{0%{transform:scale(1)}35%{transform:scale(1.06)}100%{transform:scale(1)}}
        @keyframes ccSend{0%{transform:scale(1)}40%{transform:scale(.92) translateX(2px)}100%{transform:scale(1)}}
        @keyframes ccIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes ccDot{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}
        @media (prefers-reduced-motion:reduce){.cc-chip,.cc-send,.cc-msg,.cc-dots span{animation:none!important;transition:none!important}}
        ${prefs.motion?"":"*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}"}
      `}</style>

      {/* ── HEADER ────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8,padding:"4px 0 8px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{fontFamily:T.display,fontSize:isMobile?18:24,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>AI Market Screener</div>
            {!isMobile&&session&&<span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:`${SESSION_CFG[session]?.color}20`,color:SESSION_CFG[session]?.color,letterSpacing:".07em",textTransform:"uppercase"}}>{SESSION_CFG[session]?.label}</span>}
          </div>
          {!isMobile&&<div style={{fontSize:11,color:T.textSub,marginTop:2}}>AI-powered · Tap any index to view chart</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {timeSince&&<span style={{fontSize:10,color:T.textSub}}>{timeSince}</span>}
          <button onClick={()=>setAutoRefresh(v=>!v)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${autoRefresh?T.up:T.border}`,background:autoRefresh?T.upBg:"transparent",color:autoRefresh?T.up:T.textSub,fontSize:11,cursor:"pointer",fontWeight:autoRefresh?600:400}}>
            {autoRefresh?"⏱ Auto ON":"⏱ Auto"}
          </button>
          <button onClick={()=>openGlossary(null)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:11,cursor:"pointer",fontFamily:T.sans}}>Glossary</button>
          <button onClick={()=>setShowAlertList(true)} title="View Alerts" style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:14,cursor:"pointer"}}><I.Bell s={13}/></button>
          <button onClick={()=>setShowFilters(v=>!v)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${showFilters?T.accent:T.border}`,background:showFilters?`${T.accent}15`:T.surface,color:showFilters?T.accent:T.textSub,fontSize:11,cursor:"pointer",fontWeight:showFilters?700:400,display:"flex",alignItems:"center",gap:5}}><I.Filter s={11}/>Filter{filters.changeMin||filters.changeMax?" ✓":""}</button>
          <button onClick={()=>runRefresh(curTab.stocks)} disabled={refreshing} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:refreshing?T.textSub:T.text,fontSize:11,cursor:refreshing?"default":"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:T.shadow}}>
            <span style={refreshing?{animation:"pulse 1s infinite",display:"inline-block"}:{}}>{refreshing?"↻ Refreshing…":"↻ Refresh"}</span>
          </button>
          <button onClick={()=>setPref("mode",isDark?"light":"dark")} style={{padding:"5px 11px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:12,cursor:"pointer",boxShadow:T.shadow}}>
            {isDark?<I.Sun s={13}/>:<I.Moon s={13}/>}
          </button>
        </div>
      </div>

      {/* ── MARKET BAR (slim index strip) ─────────── */}
      <MarketBar indices={indices} selectedIdx={selectedIdx} onSelectIdx={setSelectedIdx} T={T}/>
      {selectedIdx&&<IndexChart key={selectedIdx.s} index={selectedIdx} T={T}/>}

      <SectionNav T={T} sec={sec} onSelect={setSec} mobile={isMobile} badges={{earnings:Object.keys(earnMap).length||null}}/>
      {/* Sections stay mounted (hidden) so data keeps loading and chats/scans keep their state */}
      <div role="tabpanel" style={{display:sec==="overview"?"block":"none"}}>
        <DailyBrief indices={indices} stocks={allStocks} news={mktNews} T={T}/>
        <IntelligenceFeed stocks={allStocks} news={mktNews} symbols={allSymbols} T={T}/>
      </div>
      <div role="tabpanel" style={{display:sec==="earnings"?"block":"none"}}>
        <EarningsWeek embedded symbols={allSymbols} stocks={allStocks} healthMap={healthMap} names={names} T={T} onWatch={setEarnMap} onPick={pickSymbol} onAdd={sym=>addTickerBySymbol(sym)}/>
      </div>
      <div role="tabpanel" style={{display:sec==="playbooks"?"block":"none"}}>
        <PlaybooksPanel embedded T={T} names={names} tabSymbols={curTab.stocks.map(x=>x.s)} onAdd={sym=>addTickerBySymbol(sym)}/>
      </div>
      <div role="tabpanel" style={{display:sec==="paper"?"block":"none"}}>
        <PaperPanel T={T} active={sec==="paper"} mobile={isMobile} names={names} healthMap={healthMap} earnMap={earnMap} onOpen={sym=>{if(allSymbols.includes(sym))pickSymbol(sym);else addTickerBySymbol(sym);}}/>
      </div>
      <div role="tabpanel" style={{display:sec==="concierge"?"block":"none"}}>
        <ConciergePanel mobile={isMobile} detail={prefs.ccDetail} embedded T={T} stocks={allStocks} healthMap={healthMap} earnMap={earnMap} symbols={allSymbols}/>
      </div>
      <div role="tabpanel" style={{display:sec==="settings"?"block":"none"}}>
        <SettingsPanel T={T} prefs={prefs} setPref={setPref} resetPrefs={resetPrefs} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} mobile={isMobile} symbols={curTab.stocks.map(x=>x.s)} listName={curTab.label}/>
      </div>

      <div role="tabpanel" style={{display:sec==="watchlist"?"block":"none"}}>
      {/* ── LIST PILLS ─────────────── */}
      <div role="tablist" aria-label="Watchlists" style={{display:"flex",alignItems:"center",gap:8,padding:"2px 2px 10px",overflowX:"auto",scrollbarWidth:"none"}}>
        {tabs.map(t=>{
          const on=activeTab===t.id;
          return(
            <div key={t.id} className="pill" style={{display:"inline-flex",alignItems:"center",flexShrink:0,borderRadius:999,border:`1px solid ${on?T.accent:T.border}`,background:on?T.accentBg:T.surface,color:on?T.accent:T.textSub,transition:"all .15s"}}>
              <button role="tab" aria-selected={on} onClick={()=>{setActiveTab(t.id);setSelected(null);}} style={{padding:on&&tabs.length>1?"6px 6px 6px 14px":"6px 14px",border:"none",background:"transparent",color:"inherit",fontWeight:on?700:500,fontSize:12,cursor:"pointer",fontFamily:T.sans,whiteSpace:"nowrap",borderRadius:999}}>{t.label}</button>
              {on&&tabs.length>1&&<button onClick={()=>removeTab(t.id)} aria-label={"Delete list "+t.label} title="Delete list" className="pill-x" style={{width:22,height:22,margin:"0 5px 0 0",display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",border:"none",background:"transparent",color:"inherit",cursor:"pointer",padding:0}}><I.X s={10}/></button>}
            </div>
          );
        })}
        {!addingTab
          ?<button className="pill" onClick={()=>setAddingTab(true)} style={{flexShrink:0,padding:"6px 14px",borderRadius:999,border:`1px dashed ${T.textSub}`,background:"transparent",color:T.textSub,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:T.sans}}>+ New list</button>
          :<div style={{display:"inline-flex",gap:6,alignItems:"center",flexShrink:0,padding:"3px 4px 3px 10px",borderRadius:999,border:`1px solid ${T.accent}`,background:T.surface}}>
            <input value={newTabName} onChange={e=>setNewTabName(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addTab();if(e.key==="Escape")setAddingTab(false);}}
              placeholder="List name" autoFocus aria-label="New list name"
              style={{border:"none",background:"transparent",color:T.text,fontSize:12,width:90,outline:"none",fontFamily:T.sans}}/>
            <button onClick={addTab} style={{padding:"4px 11px",borderRadius:999,border:"none",background:T.accent,color:T.accentInk,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:T.sans}}>Add</button>
            <button onClick={()=>setAddingTab(false)} aria-label="Cancel" style={{width:22,height:22,borderRadius:"50%",border:"none",background:"transparent",color:T.textSub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0}}><I.X s={10}/></button>
          </div>
        }
      </div>

      {/* ── CONTROLS ────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",flexWrap:"wrap",gap:8,marginBottom:10}}>
        <div style={{display:"flex",gap:6}}>
          <TickerSearch
            value={newTicker}
            onChange={setNewTicker}
            onSelect={sym=>{setNewTicker("");addTickerBySymbol(sym);}}
            onKeyDown={e=>e.key==="Enter"&&addTicker()}
            T={T}
          />
          <button onClick={addTicker} style={{padding:"6px 12px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:T.sans}}>+</button>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:T.sans}}>Sort</span>
          {[["change_desc","▲ Top",T.up],["change_asc","▼ Worst",T.down],["earn","Earnings","#F59E0B"],["az","A–Z",T.accent]].map(([k,l,c])=>(
            <button key={k} onClick={()=>setSort(k)} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${sort===k?c:T.border}`,background:sort===k?`${c}15`:"transparent",color:sort===k?c:T.textSub,fontSize:10,cursor:"pointer",fontWeight:sort===k?600:400,fontFamily:T.sans}}>{l}</button>
          ))}
          <button onClick={()=>setEarnOnly(v=>!v)} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${earnOnly?"#F59E0B":T.border}`,background:earnOnly?"#F59E0B15":"transparent",color:earnOnly?"#F59E0B":T.textSub,fontSize:10,cursor:"pointer",fontWeight:earnOnly?600:400,fontFamily:T.sans}}>Reporting this week{Object.keys(earnMap).length?` (${curTab.stocks.filter(x=>earnMap[x.s]).length})`:""}</button>
          <div style={{width:1,height:12,background:T.border}}/>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,display:"flex",overflow:"hidden",boxShadow:T.shadow}}>
            {[["grid",<I.Grid s={12}/>],["list",<I.List s={12}/>]].map(([v,ic])=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{padding:"4px 10px",border:"none",background:viewMode===v?T.accent:"transparent",color:viewMode===v?"#fff":T.textSub,fontSize:13,cursor:"pointer"}}>{ic}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MOBILE or DESKTOP layout ─────────────── */}
      {isMobile?(
        selected?(
          <div id="stock-detail">
            <button onClick={()=>setSelected(null)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:12,cursor:"pointer",marginBottom:12,boxShadow:T.shadow,fontFamily:T.sans}}>← Back</button>
            <StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)} onSetAlert={()=>setAlertModal({symbol:selected.s,price:selected.p})} health={healthMap[selected.s]} healthLoading={fundLoading} autoAnalyze={autoSym===selected.s}/>
          </div>
        ):StockList
      ):(
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:selected?"clamp(330px,34%,420px)":"100%",flexShrink:0,transition:"width 0.18s"}}>{StockList}</div>
          {selected&&<div id="stock-detail" style={{flex:1,minWidth:0}}><StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)} onSetAlert={()=>setAlertModal({symbol:selected.s,price:selected.p})} health={healthMap[selected.s]} healthLoading={fundLoading} autoAnalyze={autoSym===selected.s}/></div>}
        </div>
      )}

      {/* ── RECOMMENDATIONS ──────────────────────── */}


      </div>

      {isMobile&&<div aria-hidden="true" style={{height:"calc(64px + env(safe-area-inset-bottom,0px))"}}/>}
      <div style={{marginTop:20,textAlign:"center",fontSize:10,color:T.textTert,fontFamily:T.sans}}>
        Market data · Not financial advice
      </div>

      {alertModal&&<AlertModal symbol={alertModal.symbol} currentPrice={alertModal.price} T={T} onClose={()=>setAlertModal(null)}/>}
      {showAlertList&&<AlertListModal T={T} onClose={()=>setShowAlertList(false)}/>}
      {glossaryOpen&&<GlossarySheet T={T} focus={glossaryFocus} onClose={()=>setGlossaryOpen(false)}/>}
    </div>
  );
}