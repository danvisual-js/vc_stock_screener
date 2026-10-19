import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ComposedChart, BarChart, Line, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Brush
} from "recharts";

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
    const r=await fetch(`/api/earnings?symbol=${encodeURIComponent(symbol)}`,{signal:AbortSignal.timeout(7000)});
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
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:`linear-gradient(135deg,#6366F112,#7C6FF708)`}}>
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
        {loading&&<div style={{display:"flex",alignItems:"center",gap:8,color:T.textSub,fontSize:11}}><span style={{animation:"pulse 1.2s infinite",fontSize:14}}>✦</span>Generating… (10–20s)</div>}
        {/* Generate button — shown when no brief and not loading */}
        {!brief&&!loading&&(
          <div style={{textAlign:"center",padding:"4px 0 8px"}}>
            <div style={{fontSize:11,color:T.textSub,marginBottom:12,lineHeight:1.5}}>
              AI-written summary of your watchlist and market conditions.<br/>
              <span style={{fontSize:9}}>Requires Anthropic API credits · Cached until midnight</span>
            </div>
            <button onClick={generate} style={{padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",background:`linear-gradient(135deg,#6366F1,#7C6FF7)`,color:"#fff",fontSize:12,fontWeight:700,boxShadow:"0 4px 12px rgba(99,102,241,0.3)"}}>
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
            ?<div style={{padding:"14px 12px",fontSize:11,color:T.textSub}}>Loading…</div>
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
            ?<div style={{padding:"14px 12px",fontSize:11,color:T.textSub}}>Loading news…</div>
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
  // Dark grey base — subtle indigo/purple accent only (not purple background)
  bg:        "#08090E",   // near-black (same as V2 proposal)
  surface:   "#0F1018",   // dark blue-grey card
  surfaceB:  "#161820",   // slightly raised surface
  border:    "#1E2334",   // dark blue-grey border
  // Accent: indigo/purple for interactive elements only
  accent:    "#6366F1",   // indigo — tabs, active states, CTAs
  up:        "#00D084",   down:"#FF4560",
  text:      "#F1F5F9",   textSub:"#64748B",  textTert:"#1E293B",
  mono:      "'SF Mono','Fira Code','Consolas',monospace",
  sans:      "-apple-system,'SF Pro Display','Helvetica Neue',Inter,sans-serif",
  ema9:      "#F59E0B",   ema20:"#60A5FA",  ema50:"#C084FC",
  chartGrid: "#1A1D2E",
  insightBg:"#0F1018",insightBorder:"#1E2334",insightText:"#6366F1",
  upBg:"#00D08420",downBg:"#FF456020",accentBg:"#6366F118",
  shadow:    "0 2px 8px rgba(0,0,0,0.5)",
  // Subtle purple glow on selected card — the only purple touch
  accentGlow:"0 0 0 1.5px #6366F170, 0 4px 16px rgba(99,102,241,0.2)",
  headerGrad:"linear-gradient(180deg,#0E1028 0%,#08090E 100%)",
};
const LIGHT = {
  // Discord-inspired: layered grey backgrounds, no harsh white
  bg:        "#F2F3F5",   // Discord server background (grey-100)
  surface:   "#FFFFFF",   // card surface white for contrast against bg
  surfaceB:  "#EBEDEF",   // Discord channel list / raised surface (grey-200)
  border:    "#D4D7DC",   // Discord separator
  accent:    "#5865F2",   // Discord blurple
  up:        "#2D7D46",   down:"#DA3633",
  text:      "#060607",   // Discord near-black
  textSub:   "#4E5058",   // Discord muted / secondary
  textTert:  "#B5BAC1",   // Discord deselected / placeholder
  mono:      "'SF Mono','Fira Code','Consolas',monospace",
  sans:      "-apple-system,'SF Pro Display','Helvetica Neue',Inter,sans-serif",
  ema9:      "#D97706",   ema20:"#2563EB",  ema50:"#7C3AED",
  chartGrid: "#EBEDEF",
  insightBg:"#FFFFFF",insightBorder:"#D4D7DC",insightText:"#5865F2",
  upBg:"#2D7D4615",downBg:"#DA363315",accentBg:"#5865F215",
  shadow:    "0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06)",
  accentGlow:"0 0 0 1.5px #5865F260",
  headerGrad:"linear-gradient(180deg,#E9EAEC 0%,#F2F3F5 100%)",
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
      signal:AbortSignal.timeout(12000),
    });
    if(!r.ok)return{};
    const data=await r.json();
    if(!data||data.error)return{};
    const result={};
    Object.entries(data).forEach(([sym,q])=>{
      if(q&&q.p>0)result[sym]={p:q.p,pc:q.pc||q.p,name:q.name||sym};
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
    return{date:label,open:+open.toFixed(4),close:+close.toFixed(4),high:+high.toFixed(4),low:+low.toFixed(4),volume,isGreen:close>=open,isExtended};
  }).filter(Boolean);
  if(bars.length<=5)throw new Error("too few bars");
  return bars;
  };
  // Promise.any: try all URLs in parallel, use first success
  try{
    const attempts=[processChart(base)];
    if(prePost)attempts.push(processChart(base+"&includePrePost=true"));
    return await Promise.any(attempts);
  }catch{return null;}
}
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

function CandleChart({data,showEMA,showSupport,srLevels,showVWAP,showBB,signals,showSignals,showVolProfile,symbol,tf,T,chartH=CC_VH}){
  // Dynamic VH/H based on chartH prop — allows mobile to pass taller value
  const VW=CC_VW, VH=chartH, Pad=CC_PAD;
  const W=VW-Pad.l-Pad.r, H=VH-Pad.t-Pad.b;
  const [vS,setVS]=useState(0);
  const [vE,setVE]=useState(()=>data.length);
  const drag=useRef({on:false,x0:0,s0:0,e0:0});
  // Pinch-to-zoom state (pointer-based, cross-platform)
  const activePtr=useRef(new Map()); // pointerId → {x,y}
  const pinchRef=useRef(null);       // {startDist, startVS, startVE}
  const divRef=useRef(null);
  const dsKey=`${data.length}|${data[0]?.date}|${data.at?.(-1)?.date}`;
  useEffect(()=>{setVS(0);setVE(data.length);},[dsKey]);// eslint-disable-line
  const vStart=Math.max(0,Math.min(vS,data.length-5));
  const vEnd=Math.max(vStart+5,Math.min(vE,data.length));
  const visData=data.slice(vStart,vEnd);
  const isZoomed=vStart>0||vEnd<data.length;
  const onWheel=useCallback((e)=>{
    e.preventDefault();
    const vis=vEnd-vStart,dir=e.deltaY>0?1:-1;
    const amt=Math.max(1,Math.floor(vis*0.12));
    const rect=divRef.current?.getBoundingClientRect();
    const ratio=rect?(e.clientX-rect.left)/rect.width:0.5;
    const dl=Math.round(amt*ratio),dr=amt-dl;
    const ns=Math.max(0,vStart+dir*dl),ne=Math.min(data.length,vEnd-dir*dr);
    if(ne-ns>=5){setVS(ns);setVE(ne);}
  },[vStart,vEnd,data.length]);
  useEffect(()=>{const el=divRef.current;if(!el)return;el.addEventListener("wheel",onWheel,{passive:false});return()=>el.removeEventListener("wheel",onWheel);},[onWheel]);
  const onMD=(e)=>{if(e.button!==0)return;drag.current={on:true,x0:e.clientX,s0:vStart,e0:vEnd};e.currentTarget.style.cursor="grabbing";};
  const onMM=(e)=>{if(!drag.current.on)return;const rect=divRef.current?.getBoundingClientRect();if(!rect)return;const vis=drag.current.e0-drag.current.s0;const sh=Math.round((drag.current.x0-e.clientX)/(rect.width/vis));const ns=Math.max(0,drag.current.s0+sh);const ne=Math.min(data.length,drag.current.e0+sh);if(ne-ns===vis){setVS(ns);setVE(ne);}};
  const onMU=(e)=>{drag.current.on=false;if(e.currentTarget)e.currentTarget.style.cursor="default";};
  const resetZoom=()=>{setVS(0);setVE(data.length);};



  // ── Drawing state (must be before onChartClick useCallback) ─────────────
  const DRAW_KEY=`drawings_${symbol||"x"}_${tf||"5m"}`;
  const [drawings,setDrawings]=useState(()=>{try{return JSON.parse(localStorage.getItem(DRAW_KEY)||"[]");}catch{return[];}});
  useEffect(()=>{try{localStorage.setItem(DRAW_KEY,JSON.stringify(drawings));}catch{}},[drawings,DRAW_KEY]);
  const [drawMode,setDrawMode]=useState(null);
  const [drawStart,setDrawStart]=useState(null);
  const [selDraw,setSelDraw]=useState(null);
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
    const svgX=(clientX-rect.left)/rect.width*CC_VW;
    const svgY=(clientY-rect.top)/rect.height*chartH; // chartH not CC_VH — critical for mobile
    const barAbsIdx=Math.round((svgX-CC_PAD.l)/CC_W*visData.length)+vStart;
    const svgH=chartH-CC_PAD.t-CC_PAD.b;
    const price=chartRange.current.minP+(1-(svgY-CC_PAD.t)/svgH)*chartRange.current.rng;
    return{svgX,svgY,barAbsIdx,price};
  },[vStart,visData.length,chartH]);

  const onChartClick=useCallback((e)=>{
    if(!drawMode)return;
    const pos=svgPos(e);if(!pos||isNaN(pos.price)||pos.price<=0)return;
    if(drawMode==='hline'){
      setDrawings(prev=>[...prev,{id:Date.now(),type:'hline',price:pos.price,color:'#A78BFA'}]);
      setDrawMode(null);
    } else if(drawMode==='trend'){
      if(!drawStart)setDrawStart({barIdx:pos.barAbsIdx,price:pos.price});
      else{setDrawings(prev=>[...prev,{id:Date.now(),type:'trend',p1:drawStart,p2:{barIdx:pos.barAbsIdx,price:pos.price},color:'#6366F1'}]);setDrawStart(null);setDrawMode(null);}
    }
  },[drawMode,drawStart,svgPos]);

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
    const vhRef=chartH-CC_PAD.t-CC_PAD.b;const dprice=(draggingDraw.startSvgY-pos.svgY)/vhRef*chartRange.current.rng;
    const dbar=Math.round((pos.svgX-draggingDraw.startSvgX)/CC_W*visData.length);
    const{orig}=draggingDraw;
    setDrawings(prev=>prev.map(d=>{
      if(d.id!==draggingDraw.id)return d;
      if(d.type==='hline')return{...d,price:orig.price+dprice};
      if(d.type==='trend')return{...d,p1:{barIdx:orig.p1.barIdx+dbar,price:orig.p1.price+dprice},p2:{barIdx:orig.p2.barIdx+dbar,price:orig.p2.price+dprice}};
      return d;
    }));
  },[draggingDraw,svgPos,visData.length]);

  const onDrawingMouseUp=useCallback(()=>setDraggingDraw(null),[]);

  // ── Crosshair state + RAF handler ────────────────────────────────────────
  const [hoverI,setHoverI]=useState(null);
  const rafRef=useRef(null);
  const onSVGMove=useCallback((e)=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(()=>{
      const rect=divRef.current?.getBoundingClientRect();
      if(!rect)return;
      const svgX=(e.clientX-rect.left)/rect.width*CC_VW;
      const idx=Math.floor((svgX-CC_PAD.l)/CC_W*visData.length);
      setHoverI(idx>=0&&idx<visData.length?idx:null);
    });
  },[visData.length]);
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
  const trendPrev=(drawMode==='trend'&&drawStart&&hoverI!=null&&visData[hoverI])?{
    x1:Pad.l+(drawStart.barIdx-vStart+0.5)*(W/visData.length),
    y1:sy(drawStart.price),
    x2:sx(hoverI),y2:sy(visData[hoverI].close)
  }:null;
  const hlinePrevY=(drawMode==='hline'&&hoverI!=null&&visData[hoverI])?sy(visData[hoverI].close):null;
  const yTicks=Array.from({length:4},(_,i)=>minP+(rng/3)*i);
  const fY=p=>p>=10000?(p/1000).toFixed(0)+"K":p>=100?p.toFixed(0):p<1?p.toFixed(3):p.toFixed(2);
  const eLine=(key,color,dash,w=1.2)=>{let seg=[],segs=[];visData.forEach((d,i)=>{if(d[key]!=null)seg.push(`${sx(i)},${sy(d[key])}`);else if(seg.length){segs.push(seg.join(" "));seg=[];}});if(seg.length)segs.push(seg.join(" "));return segs.map((pts,si)=><polyline key={`${key}-${si}`} points={pts} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash} opacity={0.9}/>);};
  return(
    <div ref={divRef}
      style={{position:"relative",cursor:drawMode?"crosshair":"default",userSelect:"none",touchAction:"none"}}
      onPointerDown={onPtrDown} onPointerMove={onPtrMove}
      onPointerUp={onPtrUp} onPointerLeave={onPtrLeave} onPointerCancel={onPtrUp}
      onDoubleClick={resetZoom} onClick={onChartClick}>
      {isZoomed&&<div onClick={resetZoom} style={{position:"absolute",top:6,right:50,zIndex:10,background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,padding:"2px 8px",fontSize:9,color:"#00D4AA",cursor:"pointer",fontWeight:700,fontFamily:"monospace"}}>↺ {visData.length}/{data.length}</div>}
      {/* Drawing toolbar — always visible, prominent placement */}
      <div style={{position:"absolute",bottom:28,left:CC_PAD.l+4,zIndex:10,display:"flex",gap:4,pointerEvents:"all"}}>
        {(()=>{
          const mob=typeof window!=="undefined"&&window.innerWidth<640;
          const bsz={padding:mob?"7px 14px":"4px 10px",fontSize:mob?13:11,minHeight:mob?44:undefined,minWidth:mob?80:undefined};
          return [['hline','─','H-Line','#A78BFA'],['trend','/','Trend','#6366F1']].map(([mode,ico,lbl,col])=>(
            <button key={mode} onClick={e=>{e.stopPropagation();setDrawMode(m=>m===mode?null:mode);setDrawStart(null);}}
              title={drawMode===mode&&mode==='trend'&&drawStart?"Click 2nd point to finish":lbl}
              style={{...bsz,fontWeight:700,borderRadius:8,border:`1.5px solid ${drawMode===mode?col:T.border}`,
                background:drawMode===mode?`${col}22`:"rgba(15,16,24,0.9)",
                color:drawMode===mode?col:T.text,cursor:"pointer",
                boxShadow:drawMode===mode?`0 0 0 1px ${col}40`:"none",
                backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              <span style={{fontSize:mob?16:13,lineHeight:1}}>{ico}</span>
              <span>{drawMode===mode?(mode==='trend'&&drawStart?"pt2…":lbl+" ✓"):lbl}</span>
            </button>
          ));
        })()}
        {drawings.length>0&&(()=>{
          const mob=typeof window!=="undefined"&&window.innerWidth<640;
          return(<button onClick={e=>{e.stopPropagation();setDrawings([]);setDrawMode(null);setDrawStart(null);setSelDraw(null);}}
            title="Clear all drawings"
            style={{padding:mob?"7px 14px":"4px 10px",fontSize:mob?13:10,fontWeight:700,borderRadius:8,
              border:`1.5px solid ${T.border}`,background:"rgba(15,16,24,0.9)",
              color:T.down,cursor:"pointer",backdropFilter:"blur(4px)",minHeight:mob?44:undefined}}>
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
            style={{position:"absolute",top:30,right:CC_PAD.r+6,zIndex:20,
              padding:"4px 10px",fontSize:11,fontWeight:700,borderRadius:6,
              border:`1.5px solid ${T.down}`,background:`${T.down}22`,
              color:T.down,cursor:"pointer",pointerEvents:"all",
              display:"flex",alignItems:"center",gap:5,backdropFilter:"blur(4px)"}}>
            <I.X s={11} c={T.down}/> Delete line
          </div>
        );
      })()}
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{width:"100%",display:"block"}}>
        {yTicks.map((p,i)=>(<g key={i}><line x1={Pad.l} x2={Pad.l+W} y1={sy(p)} y2={sy(p)} stroke={T.chartGrid} strokeDasharray="2,5" strokeWidth={0.8}/><text x={Pad.l-4} y={sy(p)} textAnchor="end" fill={T.textSub} fontSize={9} dominantBaseline="middle">{fY(p)}</text></g>))}
        {/* Pre/after-hours shading — pre-computed, no IIFE */}
        {visExtBands.map((b,i)=>(
          <rect key={i}
            x={Pad.l+b.s*(W/visData.length)} y={Pad.t}
            width={(b.e-b.s+1)*(W/visData.length)} height={H}
            fill={b.pre?"#6366F1":"#94A3B8"} opacity={0.07}/>
        ))}
        {showSupport&&srLevels.map((z,i)=>(<g key={i}><line x1={Pad.l} x2={Pad.l+W} y1={sy(z.price)} y2={sy(z.price)} stroke={z.type==="support"?T.up:T.down} strokeDasharray="5,3" strokeWidth={1} opacity={0.4}/><text x={Pad.l+W+3} y={sy(z.price)} fill={z.type==="support"?T.up:T.down} fontSize={8} dominantBaseline="middle">{z.type==="support"?"S":"R"}</text></g>))}
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
        {showVolProfile&&(()=>{const profile=buildVolumeProfile(visData,28);const maxV=Math.max(...profile.map(b=>b.vol),1);const POC=profile.reduce((a,b)=>b.vol>a.vol?b:a,profile[0]);const vpW=48,vpX=Pad.l+W-vpW;return profile.map((b,i)=>{const y1=sy(b.priceMax),y2=sy(b.priceMin),bh=Math.max(1,y2-y1),bw=(b.vol/maxV)*vpW,isPOC=b.vol===POC.vol;const color=isPOC?"#F59E0B":b.volUp>=b.volDn?T.up:T.down;return(<rect key={i} x={vpX+(vpW-bw)} y={y1} width={bw} height={bh} fill={color} opacity={isPOC?0.85:0.3}/>);}).concat(<line key="poc" x1={Pad.l} x2={Pad.l+W} y1={sy(POC.priceMid)} y2={sy(POC.priceMid)} stroke="#F59E0B" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.6}/>,<text key="poc-l" x={Pad.l+2} y={sy(POC.priceMid)-3} fill="#F59E0B" fontSize={7}>POC</text>);})()}
        {visData.map((d,i)=>i%step===0&&<text key={i} x={sx(i)} y={VH-4} textAnchor="middle" fill={T.textSub} fontSize={7}>{d.date}</text>)}


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
              <text x={Pad.l+W+3} y={y+1} fontSize={7.5} fill={d.color} dominantBaseline="middle">{fY(d.price)}</text>
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
          const tipW=168,tipH=58;
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
              fontSize={8} fontWeight={700} dominantBaseline="middle">{fY(bar.close)}</text>
            {/* OHLCV tooltip */}
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6}
              fill={T.surface} stroke={T.border} strokeWidth={0.8} opacity={0.97}/>
            <text x={tipX+10} y={tipY+13} fill={T.textSub} fontSize={8.5} fontFamily="monospace">{bar.date}</text>
            {[["O",bar.open,"#94A3B8"],["H",bar.high,T.up],["L",bar.low,T.down],["C",bar.close,col]].map(([l,v,c],i)=>(
              <g key={l}>
                <text x={tipX+10+i*40} y={tipY+30} fill={T.textSub} fontSize={8} fontFamily="monospace">{l}</text>
                <text x={tipX+18+i*40} y={tipY+30} fill={c} fontSize={8} fontWeight={700} fontFamily="monospace">{fY(v)}</text>
              </g>
            ))}
            {bar.volume>0&&<text x={tipX+10} y={tipY+47} fill={T.textSub} fontSize={8} fontFamily="monospace">
              Vol <tspan fill={T.text} fontWeight={700}>{bar.volume>1e9?(bar.volume/1e9).toFixed(1)+"B":bar.volume>1e6?(bar.volume/1e6).toFixed(1)+"M":bar.volume>1e3?(bar.volume/1e3).toFixed(0)+"K":bar.volume}</tspan>
            </text>}
          </g>);
        })()}
      </svg>
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

function MACDPanel({data,T}){
  const d=data.filter(x=>x.macd!=null);
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10},itemStyle:{color:T.text}};
  return(
    <ResponsiveContainer width="100%" height={70}>
      <ComposedChart data={d} margin={{top:2,right:8,left:0,bottom:0}}>
        <CartesianGrid stroke={T.chartGrid} strokeDasharray="2 5" vertical={false}/>
        <XAxis dataKey="date" tick={false}/>
        <YAxis tick={{fill:T.textSub,fontSize:7}} width={40} tickFormatter={v=>v.toFixed(2)}/>
        <Tooltip {...tt}/>
        <Bar dataKey="histogram" isAnimationActive={false}>{d.map((e,i)=><Cell key={i} fill={e.histogram>=0?`${T.up}55`:`${T.down}55`}/>)}</Bar>
        <Line type="monotone" dataKey="macd"   stroke={T.accent} dot={false} strokeWidth={1} name="MACD"/>
        <Line type="monotone" dataKey="signal" stroke={T.ema9}   dot={false} strokeWidth={1} strokeDasharray="3 2" name="Signal"/>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
function RSIPanel({data,T}){
  const d=data.filter(x=>x.rsi!=null);
  const last=d.length?d[d.length-1].rsi:null;
  const rc=last>=70?T.down:last<=30?T.up:T.ema9;
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:5,fontSize:10},itemStyle:{color:T.text}};
  return(<ResponsiveContainer width="100%" height={80}><ComposedChart data={d} margin={{top:2,right:8,left:0,bottom:0}}>
    <CartesianGrid stroke={T.chartGrid} strokeDasharray="3 4" vertical={false}/>
    <XAxis dataKey="date" tick={false}/>
    <YAxis domain={[0,100]} tick={{fill:T.textSub,fontSize:7}} width={28} ticks={[30,50,70]}/>
    <Tooltip {...tt} formatter={v=>[v?.toFixed(1),"RSI(14)"]}/>
    <ReferenceLine y={70} stroke={T.down} strokeDasharray="3 3" strokeWidth={1} opacity={0.5}/>
    <ReferenceLine y={30} stroke={T.up}   strokeDasharray="3 3" strokeWidth={1} opacity={0.5}/>
    <ReferenceLine y={50} stroke={T.border} strokeWidth={0.8} opacity={0.6}/>
    <Area type="monotone" dataKey="rsi" stroke={rc} fill={`${rc}18`} strokeWidth={1.5} dot={false} isAnimationActive={false} name="RSI"/>
  </ComposedChart></ResponsiveContainer>);
}

function VolumePanel({data,T}){
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:6,fontSize:10},formatter:v=>`${(v/1e6).toFixed(1)}M`};
  return(
    <ResponsiveContainer width="100%" height={50}>
      <BarChart data={data} margin={{top:2,right:8,left:0,bottom:0}}>
        <XAxis dataKey="date" tick={false}/>
        <YAxis tick={{fill:T.textSub,fontSize:7}} width={40} tickFormatter={v=>`${(v/1e6).toFixed(0)}M`}/>
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
const FUND_KEY="screener_fund_v1";
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
    if(!o.force&&c&&now-c.fetchedAt<maxAge&&(lite||!c.lite))out[s]=c;else need.push(s);
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
        {id:"rev",term:"revgrowth",label:"Revenue growth over 10%",got:f.revGrowthPct!=null?"Sales "+(f.revGrowthPct>=0?"+":"")+f.revGrowthPct.toFixed(0)+"%":"no data",
          state:f.revGrowthPct==null?"nodata":okc(f.revGrowthPct>10,f.revGrowthPct>7)},
        {id:"prof",term:"margin",label:"Profitable",got:profitable==null?"no data":profitable?"Profitable"+(f.netMarginPct!=null?" ("+f.netMarginPct.toFixed(0)+"% margin)":""):"Not profitable",
          state:profitable==null?"nodata":okc(profitable,false)},
        {id:"debt",term:"de",label:"Debt-to-equity under 1",got:deNA?"n/a for financials":de!=null?(de<0?"Negative equity":"D/E "+de.toFixed(2)):"no data",
          state:deNA?"pass":de==null?"nodata":okc(de>=0&&de<1,de>=0&&de<1.5)},
      ];
    }},
  {id:"oversold",name:"Oversold Blue Chips",tagline:"Big, established names on a sharp dip",term:"oversold",
    blurb:"Companies worth over $50B whose RSI has dropped under 35, the kind of dip pros watch for a bounce. Check the health badge before trusting a dip.",
    sortLabel:"Lowest RSI first",
    rank:(f)=>f.tech&&f.tech.rsi!=null?f.tech.rsi:99,
    criteria:(f)=>{
      const cap=f.marketCapM;
      const rsi=f.tech?f.tech.rsi:null;
      return [
        {id:"cap",term:"mktcap",label:"Market cap over $50B",got:cap!=null?"Cap "+fmtMoneyM(cap):"no data",
          state:cap==null?"nodata":okc(cap>50000,cap>30000)},
        {id:"rsi",term:"rsi",label:"RSI under 35",got:rsi!=null?"RSI "+rsi.toFixed(0):"no data",
          state:rsi==null?"nodata":okc(rsi<35,rsi<40)},
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
        {id:"up",term:"rs",label:"Up on the day",got:t.changePct!=null?(t.changePct>=0?"+":"")+t.changePct.toFixed(1)+"% today":"no data",
          state:t.changePct==null?"nodata":okc(t.changePct>0,false)},
      ];
    }},
];
function evalPlaybook(pb,uni){
  const matches=[];
  const near=[];
  Object.keys(uni).forEach(sym=>{
    const f=uni[sym];
    const sector=SECTOR_OF[sym];
    const cr=pb.criteria(f,sector);
    const passN=cr.filter(c=>c.state==="pass").length;
    const closeN=cr.filter(c=>c.state==="close").length;
    const failN=cr.filter(c=>c.state==="fail"||c.state==="nodata").length;
    const row={sym,f,cr,rank:pb.rank(f),health:computeHealth(f,sector)};
    if(passN===cr.length)matches.push(row);
    else if(failN===0&&closeN>0)near.push(row);
  });
  matches.sort((a,b)=>a.rank-b.rank);
  near.sort((a,b)=>a.rank-b.rank);
  return {matches,near:near.slice(0,8)};
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
function PlaybooksPanel({T,names,tabSymbols,onAdd}){
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_pb_open")==="1";}catch{return false;}});
  const [pbId,setPbId]=useState(null);
  const [uni,setUni]=useState({});
  const [loading,setLoading]=useState(false);
  const [ranAt,setRanAt]=useState(null);
  const [showNear,setShowNear]=useState(true);
  useEffect(()=>{try{localStorage.setItem("screener_pb_open",open?"1":"0");}catch{}},[open]);
  const run=async(id,force)=>{
    setPbId(id);setLoading(true);
    try{
      await fetchFundamentals(POPULAR_50,{lite:true,maxAge:30*60e3,force:!!force,onBatch:m=>setUni(p=>Object.assign({},p,m))});
      setRanAt(new Date());
    }finally{setLoading(false);}
  };
  const pb=PLAYBOOKS.find(p=>p.id===pbId);
  const res=useMemo(()=>pb?evalPlaybook(pb,uni):null,[pb,uni]);
  const scanned=Object.keys(uni).length;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,marginBottom:14,boxShadow:T.shadow,overflow:"hidden"}}>
      <button onClick={()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Trader Playbooks</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>Ready-made scans of 50 popular stocks. No filters to build.</span>
        <span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>
      </button>
      {open&&(
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
                  <span>{loading?`Scanning… ${scanned}/${POPULAR_50.length}`:`${scanned} stocks scanned${ranAt?" at "+ranAt.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):""}`}</span>
                  <span>{pb.sortLabel}</span>
                  <button onClick={()=>run(pb.id,true)} disabled={loading} style={{padding:"2px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:10,cursor:loading?"default":"pointer",fontFamily:T.sans}}>Rescan</button>
                </div>
              </div>
              {res&&(
                <div>
                  <div style={{padding:"6px 16px",fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,background:T.surfaceB}}>Matches ({res.matches.length})</div>
                  {res.matches.length===0&&!loading&&(
                    <div style={{padding:"12px 16px",fontSize:11,color:T.textSub,lineHeight:1.5}}>No stock meets every rule right now. That is normal for strict scans, and a good lesson: good setups are rare. The closest candidates are below.</div>
                  )}
                  {res.matches.map(r=>(<PlaybookRow key={r.sym} row={r} names={names} T={T} inList={tabSymbols.indexOf(r.sym)>=0} onAdd={()=>onAdd(r.sym)}/>))}
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

function EwChip({label,value,color,T}){
  return(
    <div style={{padding:"6px 12px",borderRadius:10,background:T.surfaceB,border:`1px solid ${T.border}`,minWidth:84}}>
      <div style={{fontSize:15,fontWeight:700,color:color||T.text,fontVariantNumeric:"tabular-nums"}}>{value}</div>
      <div style={{fontSize:9,color:T.textSub,marginTop:1,letterSpacing:".04em"}}>{label}</div>
    </div>
  );
}
function EarningsWeek({symbols,stocks,healthMap,names,T}){
  const days=useMemo(ewWeekRange,[]);
  const from=days[0].iso,to=days[4].iso;
  const [open,setOpen]=useState(()=>{try{return localStorage.getItem("screener_ew_open")!=="0";}catch{return true;}});
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);
  const [expanded,setExpanded]=useState({});
  useEffect(()=>{try{localStorage.setItem("screener_ew_open",open?"1":"0");}catch{}},[open]);
  const watchKey=symbols.slice().sort().join(",");
  useEffect(()=>{
    let dead=false;
    const ck="screener_ew_v1_"+from;
    try{
      const c=JSON.parse(localStorage.getItem(ck)||"null");
      if(c&&c.key===watchKey&&Date.now()-c.t<3*3600e3&&c.data){setData(c.data);setLoading(false);return undefined;}
    }catch{}
    setLoading(true);setErr(null);
    const keep=[...new Set([...symbols,...POPULAR_50])].join(",");
    fetch(`/api/earnings-week?from=${from}&to=${to}&symbols=${encodeURIComponent(keep)}&watch=${encodeURIComponent(symbols.slice(0,10).join(","))}`,{signal:AbortSignal.timeout(25000)})
      .then(r=>{
        if(!r.ok||(r.headers.get("content-type")||"").indexOf("json")<0)throw new Error("Earnings calendar unavailable");
        return r.json();
      })
      .then(j=>{
        if(dead)return;
        if(j.error)throw new Error(j.error);
        setData(j);
        try{localStorage.setItem(ck,JSON.stringify({key:watchKey,t:Date.now(),data:j}));}catch{}
      })
      .catch(e=>{if(!dead)setErr(e.message||"Earnings calendar unavailable");})
      .finally(()=>{if(!dead)setLoading(false);});
    return()=>{dead=true;};
  },[watchKey,from]);// eslint-disable-line

  const watchSet=useMemo(()=>new Set(symbols),[watchKey]);// eslint-disable-line
  const events=data&&data.events?data.events:[];
  const moves=data&&data.moves?data.moves:{};
  const mine=events.filter(e=>watchSet.has(e.symbol));
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
      <button onClick={()=>setOpen(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:T.sans}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub}}>Earnings This Week</span>
        <span style={{fontSize:11,color:T.textSub,flex:1}}>{rangeLabel}{data?` · ${events.length} reports, ${mine.length} on your watchlists`:""}</span>
        <span style={{fontSize:11,color:T.textSub}}>{open?"Hide":"Show"}</span>
      </button>
      {open&&(
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 14px 14px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <EwChip label="Stocks in this list" value={stocks.length} T={T}/>
            <EwChip label="Up today" value={upN} color={T.up} T={T}/>
            <EwChip label="Down today" value={downN} color={T.down} T={T}/>
            <EwChip label="Report this week" value={reportingN} color={reportingN?T.accent:T.text} T={T}/>
            <EwChip label="Caution flags" value={cautionN} color={cautionN?T.down:T.text} T={T}/>
            <EwChip label="Watch flags" value={watchN} color={watchN?"#F59E0B":T.text} T={T}/>
          </div>

          {loading&&<div style={{fontSize:11,color:T.textSub,animation:"pulse 1.2s infinite",padding:"6px 0"}}>Loading this week's earnings…</div>}
          {!loading&&err&&<div style={{fontSize:11,color:T.textSub,padding:"6px 0"}}>{err}. Make sure api/earnings-week.js is deployed and FINNHUB_API_KEY is set.</div>}

          {!loading&&!err&&(
            <div>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,marginBottom:6}}>Your watchlists</div>
              {mine.length===0&&<div style={{fontSize:11,color:T.textSub,marginBottom:12}}>None of your {symbols.length} tickers report this week.</div>}
              {mine.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:8,marginBottom:14}}>
                  {mine.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).map(e=>{
                    const m=moves[e.symbol];
                    const h=healthMap[e.symbol];
                    return(
                      <div key={e.symbol} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${T.accent}55`,background:T.accentBg}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:13,fontWeight:700,color:T.text}}>{e.symbol}</span>
                          <span style={{fontSize:10,color:T.textSub,flex:1}}>{dayName(e.date)} · {ewSlotLabel(ewSlot(e.hour))}</span>
                          <HealthBadge h={h} T={T}/>
                        </div>
                        <div style={{fontSize:11,color:T.text,marginTop:6,fontVariantNumeric:"tabular-nums"}}>
                          {e.epsEstimate!=null?<span>EPS est. ${e.epsEstimate.toFixed(2)}</span>:<span style={{color:T.textSub}}>No EPS estimate</span>}
                          {e.revenueEstimate!=null&&<span style={{color:T.textSub}}> · Rev. {fmtMoney(e.revenueEstimate)}</span>}
                        </div>
                        {m?(
                          <div style={{fontSize:10,color:T.textSub,marginTop:4,lineHeight:1.5}}>
                            Avg move after last {m.n} reports <b style={{color:T.text}}>±{m.avgAbsPct.toFixed(1)}%</b>
                            {" · "}last <b style={{color:m.lastPct>=0?T.up:T.down}}>{m.lastPct>=0?"+":""}{m.lastPct.toFixed(1)}%</b>
                            {" · "}up {m.up} of {m.n}
                          </div>
                        ):<div style={{fontSize:10,color:T.textSub,marginTop:4}}>Past reactions unavailable</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{fontSize:9,fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:T.textSub,marginBottom:6}}>The week at a glance</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:8}}>
                {days.map(d=>{
                  const list=byDay[d.iso]||[];
                  const isOpen=!!expanded[d.iso];
                  return(
                    <div key={d.iso} style={{background:T.surfaceB,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 8px 6px",minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.text}}>{d.dow}</span>
                        <span style={{fontSize:10,color:T.textSub}}>{d.label}</span>
                      </div>
                      {list.length===0&&<div style={{fontSize:10,color:T.textSub,padding:"6px 0"}}>No big reports</div>}
                      {EW_SLOTS.map(([slot,label])=>{
                        const items=list.filter(e=>ewSlot(e.hour)===slot);
                        if(!items.length)return null;
                        const shown=isOpen?items:items.slice(0,5);
                        return(
                          <div key={slot||"tbd"} style={{marginBottom:6}}>
                            <div style={{fontSize:8,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:T.textSub,margin:"6px 0 3px"}}>{label}</div>
                            {shown.map(e=>{
                              const mineIt=watchSet.has(e.symbol);
                              return(
                                <div key={e.symbol} title={names[e.symbol]||e.symbol} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,padding:"3px 6px",marginBottom:2,borderRadius:6,border:`1px solid ${mineIt?T.accent:"transparent"}`,background:mineIt?T.accentBg:"transparent"}}>
                                  <span style={{fontSize:11,fontWeight:mineIt?700:600,color:mineIt?T.accent:T.text}}>{e.symbol}</span>
                                  <span style={{fontSize:9,color:T.textSub,fontVariantNumeric:"tabular-nums"}}>{e.epsEstimate!=null?"est $"+e.epsEstimate.toFixed(2):""}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                      {list.length>5&&(
                        <button onClick={()=>setExpanded(p=>Object.assign({},p,{[d.iso]:!p[d.iso]}))} style={{width:"100%",padding:"3px 0",border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer",fontFamily:T.sans}}>
                          {isOpen?"Show fewer":`+ more (${list.length})`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:9,color:T.textSub,lineHeight:1.5,marginTop:10}}>
                Shows your tickers, the popular-stock list and any report with an $8B+ revenue estimate. Dates are as companies have scheduled them and can move. "Avg move" is the absolute 1-day price change after each of the last reports. A company can beat estimates and still fall. Educational tool, not financial advice.
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
function ChartControls({tf,setTf,chartMode,setChartMode,ind,toggleInd,T}){
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
    <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
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
          background:"#6366F118",color:"#818CF8",border:"1px solid #6366F130",
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

  useEffect(()=>{
    let cancelled=false;
    setChartLoading(true);setRawChart([]);
    fetchYFChart(index.s,tf).then(data=>{
      if(cancelled)return;
      if(data?.length>5){setRawChart(data);}
      else{setRawChart(getChartData(index.p||100,pct(index.p||100,index.pc||100),tf));}
      setChartLoading(false);
    });
    return()=>{cancelled=true;};
  },[index.s,index.p,tf]);

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
      <div>
        {chartMode==="candle"
          ?<CandleChart data={data} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} showVolProfile={ind.volProfile} T={T} symbol={index.s} tf={tf} chartH={window.innerWidth<640?460:210}/>
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
function GridCard({stock,selected,onClick,removable,onRemove,names,T,refreshing,onSetAlert,health}){
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
    </div>
  );
}
function ListRow({stock,selected,onClick,removable,onRemove,names,T,refreshing,health}){
  const {s,p,pc,loading:ld}=stock;
  const ch=pct(p||0,pc||1);
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",padding:"10px 16px 10px 14px",borderBottom:`1px solid ${T.border}`,background:selected?T.accentBg:"transparent",cursor:"pointer",transition:"background 0.1s",gap:10,minHeight:48}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{s}</div>
        <div style={{fontSize:10,color:T.textSub,fontFamily:T.sans}}>{ld?"Fetching…":(names[s]||s)}</div>
      </div>
      {!ld&&p>0&&<div style={{flexShrink:0}}><Sparkline price={p} changePct={ch} T={T} w={64} h={24}/></div>}
      <div style={{textAlign:"right",minWidth:60}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{p<1?`$${p.toFixed(4)}`:`$${f2(p)}`}</div>
      </div>
      {!ld&&<HealthBadge h={health} T={T}/>}
      {!ld&&!refreshing&&<DailyChange p={p} pc={pc} T={T}/>}
      {removable&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{marginLeft:4,padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer"}}><I.X s={10}/></button>}
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
      <div style={{fontSize:12,color:T.textSub,fontFamily:T.sans,animation:"pulse 1.2s infinite"}}>Loading analyst data…</div>
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
function DeepAnalysis({symbol,T}){
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

  const sections=[
    {key:"movement",label:"Why This Stock Moved",color:"#7C6FF7",icon:"◉"},
    {key:"bulls",   label:"Bull Case",           color:T.up,     icon:"▲"},
    {key:"bears",   label:"Bear Case",           color:T.down,   icon:"▼"},
  ];

  if(!data)return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:20,textAlign:"center"}}>
      {error&&<div style={{fontSize:11,color:T.down,marginBottom:10,fontFamily:T.sans}}>⚠ {error}</div>}
      <div style={{fontSize:12,color:T.textSub,marginBottom:16,lineHeight:1.55}}>Claude will analyze {symbol}'s analyst consensus,<br/>earnings history, and recent news — no extra API file needed.</div>
      <button onClick={generate} disabled={loading} style={{padding:"10px 24px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",background:loading?T.border:"linear-gradient(135deg,#6366F1,#7C6FF7)",color:loading?T.textSub:"#fff",fontSize:13,fontWeight:700,boxShadow:loading?"none":"0 4px 16px rgba(99,102,241,0.35)"}}>
        {loading?"Generating… (10-20s)":"✦ Generate AI Analysis"}
      </button>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {data.oneLiner&&<div style={{background:"linear-gradient(135deg,#6366F118,#7C6FF710)",border:"1px solid #6366F130",borderRadius:10,padding:"12px 16px"}}>
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
  if(loading)return(<div style={{padding:16,fontSize:11,color:T.textSub}}>Loading news…</div>);
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

function StockDetail({selected,names,T,onClose,onSetAlert,health,healthLoading}){
  const [tf,setTf]=useState("5m");
  const [chartMode,setChartMode]=useState("candle");
  const [ind,setInd]=useState({ema:false,macd:false,volume:false,support:false,vwap:false,bb:false,rsi:false,signals:false,volProfile:false});
  const [rawChart,setRawChart]=useState([]);
  const [chartLoading,setChartLoading]=useState(false);
  const toggleInd=k=>setInd(p=>({...p,[k]:!p[k]}));

  // Reset to first chart timeframe when ticker changes
  useEffect(()=>{ setTf("5m"); },[selected.s]);

  useEffect(()=>{
    let cancelled=false;
    setChartLoading(true);setRawChart([]);
    fetchYFChart(selected.s,tf).then(data=>{
      if(cancelled)return;
      if(data?.length>5){setRawChart(data);}
      else{setRawChart(getChartData(selected.p||100,pct(selected.p||100,selected.pc||100),tf));}
      setChartLoading(false);
    });
    return()=>{cancelled=true;};
  },[selected.s,tf]);

  const chartData=useMemo(()=>enrich(rawChart),[rawChart]);
  const sr=useMemo(()=>TIMEFRAMES[tf]?.barMin>=1440?findSR(rawChart):[],[rawChart,tf]);
  const signals=useMemo(()=>ind.signals?detectSignals(chartData):[],[chartData,ind.signals]);
  const ch=pct(selected.p,selected.pc),isUp=ch>=0;
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
      <ChartControls tf={tf} setTf={setTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T}/>
      <div style={{background:T.surface,borderRadius:12,padding:"10px 8px",marginBottom:8,border:`1px solid ${T.border}`,boxShadow:T.shadow,minHeight:220}}>
        {chartLoading
          ?<div style={{height:210,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:T.textSub,fontSize:12,fontFamily:T.sans}}>
            <span style={{animation:"pulse 1.2s infinite",display:"inline-block"}}>⟳</span> Fetching real-time chart…
           </div>
          :chartData.length>0&&(chartMode==="candle"
            ?<CandleChart data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} showVolProfile={ind.volProfile} T={T} symbol={selected.s} tf={tf} chartH={window.innerWidth<640?520:210}/>
            :<LineChartView data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} showVWAP={ind.vwap} showBB={ind.bb} signals={signals} showSignals={ind.signals} T={T} height={195} accent={isUp?T.up:T.down}/>
          )
        }
      </div>
      {ind.volume&&<div style={{background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`}}><div style={{fontSize:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>Volume</div><VolumePanel data={chartData} T={T}/></div>}
      {ind.macd&&<div style={{background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`}}><div style={{fontSize:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>MACD (12, 26, 9)</div><MACDPanel data={chartData} T={T}/></div>}
      {ind.rsi&&(()=>{const last=chartData.filter(d=>d.rsi!=null).at(-1)?.rsi;return(<div style={{background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`}}><div style={{fontSize:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>RSI (14) <span style={{color:last>=70?T.down:last<=30?T.up:T.ema9,marginLeft:4}}>{last?.toFixed(1)}</span></div><RSIPanel data={chartData} T={T}/></div>);})()}
      {/* ── AI Analysis ──────────────────────────────── */}
      {/* ── Stock Insights ────────────────────────────── */}
      <HealthPanel h={health} loading={healthLoading} T={T}/>
      <YFInsights symbol={selected.s} price={selected.p} T={T}/>
      {/* ── AI Analysis ───────────────────────────────── */}
      <DeepAnalysis symbol={selected.s} T={T}/>
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


export default function StockScreener(){
  const [isDark,setIsDark]=useState(()=>{try{return JSON.parse(localStorage.getItem("screener_dark")??"true");}catch{return true;}});
  const T=isDark?DARK:LIGHT;
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
  const [viewMode,setViewMode]=useState(()=>{try{return localStorage.getItem("screener_viewMode")||"grid";}catch{return"grid";}});
  const [sort,setSort]=useState(()=>{try{return localStorage.getItem("screener_sort")||"change_desc";}catch{return"change_desc";}});
  const [newTicker,setNewTicker]=useState("");
  const [newTabName,setNewTabName]=useState("");
  const [addingTab,setAddingTab]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh,setAutoRefresh]=useState(false);
  const [lastRefresh,setLastRefresh]=useState(null);
  const autoRef=useRef(null);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<680);
    check();window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{try{localStorage.setItem("screener_dark",JSON.stringify(isDark));}catch{}},[isDark]);
  useEffect(()=>{try{localStorage.setItem("screener_tabs",JSON.stringify(tabs));}catch{}},[tabs]);
  useEffect(()=>{try{localStorage.setItem("screener_activeTab",activeTab);}catch{}},[activeTab]);
  useEffect(()=>{try{localStorage.setItem("screener_viewMode",viewMode);}catch{}},[viewMode]);
  useEffect(()=>{try{localStorage.setItem("screener_sort",sort);}catch{}},[sort]);

  useEffect(()=>{
    if(autoRef.current)clearInterval(autoRef.current);
    if(autoRefresh){autoRef.current=setInterval(()=>runRefresh(curTab.stocks),15000);}
    return()=>{ if(autoRef.current)clearInterval(autoRef.current); };
  },[autoRefresh,activeTab]);

  const curTab=tabs.find(t=>t.id===activeTab)||tabs[0];
  const allStocks=useMemo(()=>[...curTab.stocks].sort((a,b)=>{
    const ca=pct(a.p||0,a.pc||1),cb=pct(b.p||0,b.pc||1);
    if(sort==="change_desc")return cb-ca;
    if(sort==="change_asc") return ca-cb;
    return a.s.localeCompare(b.s);
  }),[curTab,sort]);
  const stocks=useMemo(()=>allStocks.filter(s=>{
    if(!s.p||!s.pc)return true;
    const ch=pct(s.p,s.pc);
    if(filters.changeMin!=null&&ch<filters.changeMin)return false;
    if(filters.changeMax!=null&&ch>filters.changeMax)return false;
    return true;
  }),[allStocks,filters]);

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

    checkAndFireAlerts(curTab.stocks);
    setLastRefresh(new Date());
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

  const addTicker=()=>{if(newTicker.trim()){addTickerBySymbol(newTicker);setNewTicker("");}}

  const addTab=()=>{
    if(!newTabName.trim())return;
    const id=newTabName.trim().toLowerCase().replace(/\s+/g,"-")+Date.now();
    setTabs(p=>[...p,{id,label:newTabName.trim(),stocks:[]}]);
    setActiveTab(id);setNewTabName("");setAddingTab(false);
  };
  const removeTab=id=>{setTabs(p=>p.filter(t=>t.id!==id));if(activeTab===id)setActiveTab(tabs[0].id);};
  const removeTicker=sym=>{setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.filter(s=>s.s!==sym)}:t));if(selected?.s===sym)setSelected(null);};

  const timeSince=lastRefresh?`Updated ${lastRefresh.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}`:"";

  const StockList=(
    <div style={{maxHeight:isMobile?"none":"52vh",overflowY:"auto"}}>
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
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing} health={healthMap[st.s]}
               onSetAlert={()=>setAlertModal({symbol:st.s,price:st.p})}/>
           ))}
         </div>
        :<div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.shadow}}>
           {stocks.map(st=>(
             <ListRow key={st.s} stock={st} selected={selected?.s===st.s}
               onClick={()=>setSelected(s=>s?.s===st.s?null:st)}
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing} health={healthMap[st.s]}/>
           ))}
         </div>
      }
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:T.sans,padding:isMobile?"10px 12px 32px":"18px 24px 48px",boxSizing:"border-box",transition:"background 0.2s,color 0.2s"}}>
      <style>{`
        html,body,#root{margin:0;padding:0;background:${T.bg};}
        *{box-sizing:border-box;}
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:0.9}}
        @keyframes purpleGlow{0%,100%{box-shadow:0 0 8px rgba(124,111,247,0.3)}50%{box-shadow:0 0 20px rgba(124,111,247,0.6)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
        input::placeholder{color:${T.textSub}}
      `}</style>

      {/* ── HEADER ────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8,padding:"4px 0 8px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{fontSize:isMobile?16:20,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>AI Market Screener</div>
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
          <button onClick={()=>setIsDark(v=>!v)} style={{padding:"5px 11px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:12,cursor:"pointer",boxShadow:T.shadow}}>
            {isDark?<I.Sun s={13}/>:<I.Moon s={13}/>}
          </button>
        </div>
      </div>

      {/* ── MARKET BAR (slim index strip) ─────────── */}
      <MarketBar indices={indices} selectedIdx={selectedIdx} onSelectIdx={setSelectedIdx} T={T}/>
      {selectedIdx&&<IndexChart key={selectedIdx.s} index={selectedIdx} T={T}/>}

      {/* ── DAILY BRIEF ───────────────────────────────── */}
      <DailyBrief indices={indices} stocks={allStocks} news={mktNews} T={T}/>
      {/* ── INTELLIGENCE FEED ─────────────────────── */}
      <EarningsWeek symbols={allSymbols} stocks={allStocks} healthMap={healthMap} names={names} T={T}/>
      <IntelligenceFeed stocks={allStocks} news={mktNews} symbols={allSymbols} T={T}/>

      <PlaybooksPanel T={T} names={names} tabSymbols={curTab.stocks.map(x=>x.s)} onAdd={sym=>addTickerBySymbol(sym)}/>

      {/* ── TABS (underline style) ─────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:0,overflowX:"auto",borderBottom:`1px solid ${T.border}`}}>
        {tabs.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",flexShrink:0}}>
            <button onClick={()=>{setActiveTab(t.id);setSelected(null);}} style={{
              padding:"10px 14px",border:"none",background:"transparent",
              color:activeTab===t.id?T.accent:T.textSub,
              fontWeight:activeTab===t.id?700:400,fontSize:13,cursor:"pointer",
              borderBottom:`2px solid ${activeTab===t.id?T.accent:"transparent"}`,
              marginBottom:-1,transition:"all 0.12s",fontFamily:T.sans,whiteSpace:"nowrap",
            }}>{t.label}</button>
            {activeTab===t.id&&tabs.length>1&&<button onClick={()=>removeTab(t.id)} style={{padding:"1px 4px",borderRadius:3,border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer",marginLeft:-6}}><I.X s={10}/></button>}
          </div>
        ))}
        {!addingTab
          ?<button onClick={()=>setAddingTab(true)} style={{padding:"10px 12px",border:"none",background:"transparent",color:T.textSub,fontSize:12,cursor:"pointer",flexShrink:0}}>+ Add</button>
          :<div style={{display:"flex",gap:4,alignItems:"center",padding:"6px 8px",flexShrink:0}}>
            <input value={newTabName} onChange={e=>setNewTabName(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addTab();if(e.key==="Escape")setAddingTab(false);}}
              placeholder="Name…" autoFocus
              style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:11,width:80,outline:"none",fontFamily:T.sans}}/>
            <button onClick={addTab} style={{padding:"4px 9px",borderRadius:6,border:"none",background:T.accent,color:"#fff",fontSize:11,cursor:"pointer",fontFamily:T.sans}}>Add</button>
            <button onClick={()=>setAddingTab(false)} style={{padding:"4px 7px",borderRadius:6,border:"none",background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer"}}><I.X s={10}/></button>
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
          {[["change_desc","▲ Top",T.up],["change_asc","▼ Worst",T.down],["az","A–Z",T.accent]].map(([k,l,c])=>(
            <button key={k} onClick={()=>setSort(k)} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${sort===k?c:T.border}`,background:sort===k?`${c}15`:"transparent",color:sort===k?c:T.textSub,fontSize:10,cursor:"pointer",fontWeight:sort===k?600:400,fontFamily:T.sans}}>{l}</button>
          ))}
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
          <div>
            <button onClick={()=>setSelected(null)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:T.surface,color:T.textSub,fontSize:12,cursor:"pointer",marginBottom:12,boxShadow:T.shadow,fontFamily:T.sans}}>← Back</button>
            <StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)} onSetAlert={()=>setAlertModal({symbol:selected.s,price:selected.p})} health={healthMap[selected.s]} healthLoading={fundLoading}/>
          </div>
        ):StockList
      ):(
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:selected?255:"100%",flexShrink:0,transition:"width 0.18s"}}>{StockList}</div>
          {selected&&<div style={{flex:1,minWidth:0}}><StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)} onSetAlert={()=>setAlertModal({symbol:selected.s,price:selected.p})} health={healthMap[selected.s]} healthLoading={fundLoading}/></div>}
        </div>
      )}

      {/* ── RECOMMENDATIONS ──────────────────────── */}


      <div style={{marginTop:20,textAlign:"center",fontSize:10,color:T.textTert,fontFamily:T.sans}}>
        Market data · Not financial advice
      </div>

      {alertModal&&<AlertModal symbol={alertModal.symbol} currentPrice={alertModal.price} T={T} onClose={()=>setAlertModal(null)}/>}
      {showAlertList&&<AlertListModal T={T} onClose={()=>setShowAlertList(false)}/>}
      {glossaryOpen&&<GlossarySheet T={T} focus={glossaryFocus} onClose={()=>setGlossaryOpen(false)}/>}
    </div>
  );
}