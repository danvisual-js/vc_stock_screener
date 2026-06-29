import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ComposedChart, BarChart, Line, Area, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
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
  {s:"DJI", name:"Dow Jones",  p:43215,  pc:42450 },
  {s:"VIX", name:"VIX",        p:16.23,  pc:18.20 },
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
const KNOWN_EVENTS = {
  earnings:[
    {s:"NFLX", date:"Jul 17",when:"AMC"},{s:"INTC",date:"Jul 24",when:"AMC"},
    {s:"NOW",  date:"Jul 23",when:"AMC"},{s:"TSLA",date:"Jul 23",when:"AMC"},
    {s:"MSFT", date:"Jul 29",when:"AMC"},{s:"GOOGL",date:"Jul 29",when:"AMC"},
    {s:"AMD",  date:"Jul 29",when:"AMC"},{s:"META", date:"Jul 30",when:"AMC"},
    {s:"QCOM", date:"Jul 30",when:"AMC"},{s:"AAPL", date:"Jul 31",when:"AMC"},
    {s:"AMZN", date:"Aug 1", when:"AMC"},{s:"MRVL", date:"Aug 26",when:"AMC"},
    {s:"NVDA", date:"Aug 27",when:"AMC"},{s:"AVGO", date:"Sep 4", when:"AMC"},
    {s:"CRM",  date:"Aug 27",when:"AMC"},{s:"CRWD", date:"Aug 26",when:"AMC"},
  ],
  macro:[
    {event:"PCE Inflation",  date:"Jun 27",impact:"high"},
    {event:"Jobs Report",    date:"Jul 5", impact:"high"},
    {event:"CPI Report",     date:"Jul 11",impact:"high"},
    {event:"FOMC Meeting",   date:"Jul 29",impact:"high"},
    {event:"PCE Inflation",  date:"Jul 31",impact:"med"},
  ],
};

/* ════════════════════════════════════════════════════
   THEMES — Yahoo Finance / iOS Finance aesthetic
════════════════════════════════════════════════════ */
const DARK = {
  bg:"#0D0D0F",surface:"#1A1A1E",surfaceB:"#242428",
  border:"#2C2C30",up:"#00D084",down:"#FF4560",accent:"#4F8EF7",
  text:"#F1F5F9",textSub:"#94A3B8",textTert:"#475569",
  mono:"'SF Mono','Fira Code','Consolas',monospace",
  sans:"-apple-system,'SF Pro Display','Helvetica Neue',Inter,sans-serif",
  ema9:"#F59E0B",ema20:"#60A5FA",ema50:"#C084FC",
  chartGrid:"#1E1E22",
  insightBg:"#0F172A",insightBorder:"#1E3A5F",insightText:"#93C5FD",
  upBg:"#00D08420",downBg:"#FF456020",accentBg:"#4F8EF715",
  shadow:"0 1px 3px rgba(0,0,0,0.4)",
};
const LIGHT = {
  bg:"#F2F2F7",surface:"#FFFFFF",surfaceB:"#F8F9FA",
  border:"#E5E5EA",up:"#00B386",down:"#E74C3C",accent:"#0066FF",
  text:"#1C1C1E",textSub:"#6C757D",textTert:"#ADB5BD",
  mono:"'SF Mono','Fira Code','Consolas',monospace",
  sans:"-apple-system,'SF Pro Display','Helvetica Neue',Inter,sans-serif",
  ema9:"#D97706",ema20:"#2563EB",ema50:"#7C3AED",
  chartGrid:"#F0F0F5",
  insightBg:"#EFF6FF",insightBorder:"#BFDBFE",insightText:"#1D4ED8",
  upBg:"#00B38618",downBg:"#E74C3C18",accentBg:"#0066FF0D",
  shadow:"0 1px 3px rgba(0,0,0,0.08)",
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
  return data.map((d,i)=>({...d,ema9:e9[i],ema20:e20[i],ema50:e50[i],macd:mac[i],signal:sig[i],histogram:his[i]}));
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
async function callClaude(userMsg,system){
  const body={model:"claude-sonnet-4-6",max_tokens:1000,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[{role:"user",content:userMsg}]};
  if(system)body.system=system;
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

// Fetch prices for a batch of symbols — no system prompt, explicit user instructions
async function fetchPrices(symbols){
  const eg=JSON.stringify(Object.fromEntries(symbols.slice(0,2).map(s=>[s,{p:298.14,pc:295.95}])));
  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:1000,
        tools:[{type:"web_search_20250305",name:"web_search"}],
        messages:[{role:"user",content:`Use web search to look up the current real-time stock prices for: ${symbols.join(", ")}.

After searching, reply with ONLY this JSON — no explanation, no markdown fences, just the raw object:
${eg}

Replace example values with the actual prices you find for all ${symbols.length} tickers.`}]
      })
    });
    const d=await res.json();
    const txt=d.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
    return parseJSON(txt)||{};
  }catch{return{};}
}

// Sorted date helper for events
const MONTHS={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
function parseDate(str){const[mon,day]=(str||"").split(" ");return new Date(2026,MONTHS[mon]??6,parseInt(day)||1);}

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

// Timeframe config: barMin (minutes per candle) + n (number of bars)
const TIMEFRAMES={
  "1m": {barMin:1,   n:390, group:"Intraday"},
  "5m": {barMin:5,   n:78,  group:"Intraday"},
  "15m":{barMin:15,  n:26,  group:"Intraday"},
  "1h": {barMin:60,  n:7,   group:"Intraday"},
  "1W": {barMin:1440,n:5,   group:"History"},
  "1M": {barMin:1440,n:30,  group:"History"},
  "3M": {barMin:1440,n:90,  group:"History"},
  "6M": {barMin:1440,n:180, group:"History"},
  "1Y": {barMin:1440,n:365, group:"History"},
};

function getChartData(price,chPct,tf){
  const {barMin,n}=TIMEFRAMES[tf]||TIMEFRAMES["5m"];
  return enrich(genBars(price,chPct,barMin,n));
}



/* ════════════════════════════════════════════════════
   CHANGE BADGE
════════════════════════════════════════════════════ */
function ChangeBadge({p,pc,T,size="sm"}){
  const ch=pct(p||0,pc||1),isUp=ch>=0;
  const fs=size==="lg"?14:size==="md"?12:11;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:2,padding:"2px 7px",borderRadius:6,background:isUp?T.upBg:T.downBg,color:isUp?T.up:T.down,fontSize:fs,fontWeight:600,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
      {isUp?"▲":"▼"} {Math.abs(ch).toFixed(2)}%
    </span>
  );
}

/* ════════════════════════════════════════════════════
   SPARKLINE — mini daily chart for cards
════════════════════════════════════════════════════ */
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


function CandleChart({data,showEMA,showSupport,srLevels,T}){
  const VW=900,VH=210,P={t:8,r:44,b:22,l:54};
  const W=VW-P.l-P.r,H=VH-P.t-P.b;
  if(!data.length)return null;
  const prices=data.flatMap(d=>[d.high,d.low]);
  const minP=Math.min(...prices)*0.997,maxP=Math.max(...prices)*1.003,rng=maxP-minP;
  const sy=p=>P.t+H*(1-(p-minP)/rng);
  const sx=i=>P.l+(i+0.5)*(W/data.length);
  const cw=Math.max(3,(W/data.length)*0.6);
  const step=Math.max(1,Math.round(data.length/7));
  const yTicks=Array.from({length:4},(_,i)=>minP+(rng/3)*i);
  const fY=p=>p>=10000?(p/1000).toFixed(0)+"K":p>=100?p.toFixed(0):p<1?p.toFixed(3):p.toFixed(2);
  const eLine=(key,color,dash)=>{
    let seg=[],segs=[];
    data.forEach((d,i)=>{if(d[key]!=null)seg.push(`${sx(i)},${sy(d[key])}`);else if(seg.length){segs.push(seg.join(" "));seg=[];}});
    if(seg.length)segs.push(seg.join(" "));
    return segs.map((pts,si)=><polyline key={`${key}-${si}`} points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeDasharray={dash} opacity={0.9}/>);
  };
  return(
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{width:"100%",display:"block"}}>
      {yTicks.map((p,i)=>(
        <g key={i}>
          <line x1={P.l} x2={P.l+W} y1={sy(p)} y2={sy(p)} stroke={T.chartGrid} strokeDasharray="2,5" strokeWidth={0.8}/>
          <text x={P.l-4} y={sy(p)} textAnchor="end" fill={T.textSub} fontSize={9} dominantBaseline="middle">{fY(p)}</text>
        </g>
      ))}
      {showSupport&&srLevels.map((z,i)=>(
        <g key={i}>
          <line x1={P.l} x2={P.l+W} y1={sy(z.price)} y2={sy(z.price)} stroke={z.type==="support"?T.up:T.down} strokeDasharray="5,3" strokeWidth={1} opacity={0.4}/>
          <text x={P.l+W+3} y={sy(z.price)} fill={z.type==="support"?T.up:T.down} fontSize={8} dominantBaseline="middle">{z.type==="support"?"S":"R"}</text>
        </g>
      ))}
      {data.map((d,i)=>{
        const color=d.isGreen?T.up:T.down;
        const bT=sy(Math.max(d.open,d.close)),bB=sy(Math.min(d.open,d.close));
        return(<g key={i}><line x1={sx(i)} x2={sx(i)} y1={sy(d.high)} y2={sy(d.low)} stroke={color} strokeWidth={0.8} opacity={0.55}/><rect x={sx(i)-cw/2} y={bT} width={cw} height={Math.max(bB-bT,1)} fill={color} fillOpacity={d.isGreen?0.2:0.45} stroke={color} strokeWidth={0.8}/></g>);
      })}
      {showEMA&&<>{eLine("ema9",T.ema9,"4,3")}{eLine("ema20",T.ema20,"")}{eLine("ema50",T.ema50,"")}</>}
      {data.map((d,i)=>i%step===0&&<text key={i} x={sx(i)} y={VH-4} textAnchor="middle" fill={T.textSub} fontSize={7}>{d.date}</text>)}
    </svg>
  );
}

/* ════════════════════════════════════════════════════
   LINE CHART
════════════════════════════════════════════════════ */
function LineChartView({data,showEMA,showSupport,srLevels,T,height=200,accent}){
  const col=accent||T.accent;
  const tt={contentStyle:{background:T.surface,border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,boxShadow:T.shadow},labelStyle:{color:T.textSub},itemStyle:{color:T.text}};
  const fY=v=>v>=10000?(v/1000).toFixed(0)+"K":v>=100?v.toFixed(0):v.toFixed(2);
  return(
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{top:6,right:8,left:0,bottom:0}}>
        <defs>
          <linearGradient id={`grad-${col.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={col} stopOpacity={0.15}/>
            <stop offset="95%" stopColor={col} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke={T.chartGrid} strokeDasharray="2 5" vertical={false}/>
        <XAxis dataKey="date" tick={{fill:T.textSub,fontSize:8}} interval="preserveStartEnd"/>
        <YAxis domain={["auto","auto"]} tick={{fill:T.textSub,fontSize:8}} width={44} tickFormatter={fY}/>
        <Tooltip {...tt}/>
        <Area type="monotone" dataKey="close" stroke={col} fill={`url(#grad-${col.replace("#","")})`} strokeWidth={2} dot={false} name="Price"/>
        {showEMA&&<>
          <Line type="monotone" dataKey="ema9"  stroke={T.ema9}  dot={false} strokeWidth={1} strokeDasharray="4 2" name="EMA 9"  connectNulls={false}/>
          <Line type="monotone" dataKey="ema20" stroke={T.ema20} dot={false} strokeWidth={1} name="EMA 20" connectNulls={false}/>
          <Line type="monotone" dataKey="ema50" stroke={T.ema50} dot={false} strokeWidth={1.5} name="EMA 50" connectNulls={false}/>
        </>}
        {showSupport&&srLevels&&srLevels.map((z,i)=>(
          <ReferenceLine key={i} y={z.price} stroke={z.type==="support"?T.up:T.down} strokeDasharray="5 3" strokeWidth={1} opacity={0.45}/>
        ))}
      </ComposedChart>
    </ResponsiveContainer>
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
   CHART CONTROLS
════════════════════════════════════════════════════ */
function ChartControls({tf,setTf,chartMode,setChartMode,ind,toggleInd,T}){
  const chip=(active,color,label,onClick)=>(
    <button onClick={onClick} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${active?color:T.border}`,background:active?`${color}15`:"transparent",color:active?color:T.textSub,fontSize:10,cursor:"pointer",fontWeight:active?600:400,transition:"all 0.12s",whiteSpace:"nowrap",fontFamily:T.sans}}>
      {label}
    </button>
  );
  const intraday=Object.entries(TIMEFRAMES).filter(([,v])=>v.group==="Intraday");
  const history =Object.entries(TIMEFRAMES).filter(([,v])=>v.group==="History");
  return(
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
      {chip(ind.ema,    T.ema9,  "EMA",()=>toggleInd("ema"))}
      {chip(ind.volume, T.accent,"Vol",()=>toggleInd("volume"))}
      {chip(ind.macd,   T.accent,"MACD",()=>toggleInd("macd"))}
      {chip(ind.support,T.up,   "S/R",()=>toggleInd("support"))}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   INDEX CHART
════════════════════════════════════════════════════ */
function IndexChart({index,T}){
  const [tf,setTf]=useState("5m");
  const [chartMode,setChartMode]=useState("candle");
  const [ind,setInd]=useState({ema:false,volume:false,macd:false,support:false});
  const toggleInd=k=>setInd(p=>({...p,[k]:!p[k]}));
  const raw=useMemo(()=>genHistory(index.p,pct(index.p,index.pc),365),[index.s]);
  const full=useMemo(()=>enrich(raw),[raw]);
  const data=useMemo(()=>getChartData(index.p,pct(index.p,index.pc),tf),[index.s,index.p,tf]);
  const sr=useMemo(()=>TIMEFRAMES[tf]?.barMin>=1440?findSR(data):[],[data,tf]);
  const ch=pct(index.p,index.pc),isUp=ch>=0;
  const col=isUp?T.up:T.down;
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px",marginBottom:14,boxShadow:T.shadow,animation:"fadeUp 0.18s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:11,color:T.textSub,fontWeight:500,marginBottom:4,fontFamily:T.sans}}>{index.name} · {index.s}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontSize:26,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{fN(index.p)}</span>
            <ChangeBadge p={index.p} pc={index.pc} T={T} size="md"/>
          </div>
        </div>
      </div>
      <ChartControls tf={tf} setTf={setTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T}/>
      <div>
        {chartMode==="candle"
          ?<CandleChart data={data} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} T={T}/>
          :<LineChartView data={data} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} T={T} height={185} accent={col}/>
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
function MarketHero({T,selectedIdx,onSelectIdx,symbols,indices,news,refreshing}){
  const [events,setEvents]=useState(null);
  const [newsOpen,setNewsOpen]=useState(false);

  useEffect(()=>{
    const filtered={
      earnings:KNOWN_EVENTS.earnings.filter(e=>symbols.includes(e.s)).slice(0,6),
      macro:KNOWN_EVENTS.macro.slice(0,4),
    };
    setEvents(filtered);
  },[symbols.join(",")]);

  const sentC=s=>s==="bullish"?T.up:s==="bearish"?T.down:T.textSub;
  const sentI=s=>s==="bullish"?"↑":s==="bearish"?"↓":"→";
  const impC=i=>i==="high"?T.down:i==="med"?T.ema9:T.textSub;

  return(
    <div>
      {/* Index tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {indices.map(idx=>{
          const ch=pct(idx.p,idx.pc),isUp=ch>=0,isSel=selectedIdx?.s===idx.s;
          return(
            <div key={idx.s} onClick={()=>onSelectIdx(isSel?null:idx)} style={{
              background:T.surface,borderRadius:12,padding:"12px 12px",cursor:"pointer",
              border:`1px solid ${isSel?T.accent:T.border}`,
              borderTop:`3px solid ${isSel?T.accent:isUp?T.up:T.down}`,
              boxShadow:isSel?`0 0 0 2px ${T.accent}30`:T.shadow,
              transition:"all 0.15s",
            }}>
              <div style={{fontSize:9,color:T.textSub,fontWeight:500,marginBottom:4,fontFamily:T.sans,textTransform:"uppercase",letterSpacing:"0.04em"}}>{idx.name}</div>
              <div style={{fontSize:15,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums",marginBottom:4}}>{fN(idx.p)}</div>
              <ChangeBadge p={idx.p} pc={idx.pc} T={T} size="sm"/>
            </div>
          );
        })}
      </div>

      {/* News + Events row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>

        {/* Trending News accordion */}
        <div style={{background:T.surface,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,fontFamily:T.sans}}>Trending</div>
          {refreshing&&!news.length&&<div style={{fontSize:12,color:T.textSub,animation:"pulse 1.2s infinite",fontFamily:T.sans}}>Loading…</div>}
          {news.length>0&&<>
            {(newsOpen?news:news.slice(0,2)).map((n,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:10,paddingBottom:i<(newsOpen?news:news.slice(0,2)).length-1?10:0,borderBottom:i<(newsOpen?news:news.slice(0,2)).length-1?`1px solid ${T.border}`:"none"}}>
                <span style={{fontSize:13,color:sentC(n.sentiment),flexShrink:0,marginTop:1}}>{sentI(n.sentiment)}</span>
                <span style={{fontSize:12,color:T.text,lineHeight:1.45,fontFamily:T.sans}}>{n.h}</span>
              </div>
            ))}
            {news.length>2&&(
              <button onClick={()=>setNewsOpen(v=>!v)} style={{fontSize:11,color:T.accent,background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:600,fontFamily:T.sans}}>
                {newsOpen?`Show less ▲`:`+${news.length-2} more ▼`}
              </button>
            )}
          </>}
          {!refreshing&&!news.length&&<div style={{fontSize:11,color:T.textSub,fontFamily:T.sans}}>Tap an index tile to see its chart.</div>}
        </div>

        {/* Events */}
        <div style={{background:T.surface,borderRadius:12,padding:"14px 16px",border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:10,fontWeight:700,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,fontFamily:T.sans}}>Upcoming Events</div>
          {events&&(()=>{
            const allEv=[
              ...(events.earnings||[]).map(e=>({...e,type:"earnings",label:e.s,sub:e.when||""})),
              ...(events.macro||[]).map(m=>({...m,type:"macro",label:m.event,sub:m.impact+" impact"})),
            ].sort((a,b)=>parseDate(a.date)-parseDate(b.date)).slice(0,6);
            return allEv.map((e,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",gap:6,alignItems:"center",minWidth:0}}>
                  <span style={{fontSize:10,flexShrink:0}}>{e.type==="earnings"?"📊":"🏦"}</span>
                  <div style={{minWidth:0}}>
                    <span style={{fontFamily:e.type==="earnings"?T.mono:T.sans,fontSize:11,fontWeight:700,color:T.text}}>{e.label}</span>
                    {e.sub&&<span style={{fontSize:9,color:T.textSub,marginLeft:4,fontFamily:T.sans}}>{e.sub}</span>}
                  </div>
                </div>
                <span style={{fontSize:10,color:T.accent,fontWeight:600,fontFamily:T.sans,flexShrink:0,marginLeft:6}}>{e.date}</span>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   STOCK CARDS
════════════════════════════════════════════════════ */
function GridCard({stock,selected,onClick,removable,onRemove,names,T,refreshing}){
  const {s,p,pc,loading:ld,failed}=stock;
  const ch=pct(p||0,pc||1),isUp=ch>=0;
  return(
    <div onClick={onClick} style={{position:"relative",background:selected?T.accentBg:T.surface,border:`1px solid ${selected?T.accent:T.border}`,borderRadius:12,padding:"14px 14px 10px",cursor:"pointer",boxShadow:selected?`0 0 0 2px ${T.accent}30`:T.shadow,transition:"all 0.15s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{s}</div>
          <div style={{fontSize:9,color:T.textSub,marginTop:1,fontFamily:T.sans}}>{ld?"Fetching…":failed?"—":(names[s]||s)}</div>
        </div>
        <div style={{textAlign:"right"}}>
          {ld||refreshing
            ?<div style={{width:52,height:18,background:T.border,borderRadius:4,animation:"shimmer 1.2s infinite"}}/>
            :<div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{p<1?`$${p.toFixed(4)}`:`$${f2(p)}`}</div>
          }
        </div>
      </div>
      {!ld&&!failed&&p>0&&(
        <div style={{margin:"4px 0"}}>
          <Sparkline price={p} changePct={ch} T={T} w={undefined} h={26}/>
        </div>
      )}
      <div style={{marginTop:4}}>
        {!ld&&!refreshing&&<ChangeBadge p={p} pc={pc} T={T}/>}
      </div>
      {removable&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{position:"absolute",top:8,right:8,width:18,height:18,borderRadius:9,border:"none",background:T.border,color:T.textSub,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>}
    </div>
  );
}
function ListRow({stock,selected,onClick,removable,onRemove,names,T,refreshing}){
  const {s,p,pc,loading:ld}=stock;
  const ch=pct(p||0,pc||1);
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",padding:"10px 16px",borderBottom:`1px solid ${T.border}`,background:selected?T.accentBg:"transparent",cursor:"pointer",transition:"background 0.1s",gap:10}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>{s}</div>
        <div style={{fontSize:10,color:T.textSub,fontFamily:T.sans}}>{ld?"Fetching…":(names[s]||s)}</div>
      </div>
      {!ld&&p>0&&<div style={{flexShrink:0}}><Sparkline price={p} changePct={ch} T={T} w={64} h={24}/></div>}
      <div style={{textAlign:"right",minWidth:60}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans,fontVariantNumeric:"tabular-nums"}}>{p<1?`$${p.toFixed(4)}`:`$${f2(p)}`}</div>
      </div>
      {!ld&&!refreshing&&<ChangeBadge p={p} pc={pc} T={T}/>}
      {removable&&<button onClick={e=>{e.stopPropagation();onRemove();}} style={{marginLeft:4,padding:"1px 6px",borderRadius:4,border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer"}}>✕</button>}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   STOCK DETAIL
════════════════════════════════════════════════════ */
function StockDetail({selected,names,T,onClose}){
  const [tf,setTf]=useState("5m");
  const [chartMode,setChartMode]=useState("candle");
  const [ind,setInd]=useState({ema:false,macd:false,volume:false,support:false});
  const [insight,setInsight]=useState("");
  const [loadingAI,setLoadingAI]=useState(false);
  const toggleInd=k=>setInd(p=>({...p,[k]:!p[k]}));
  const chartData=useMemo(()=>getChartData(selected.p,pct(selected.p,selected.pc),tf),[selected.s,selected.p,tf]);
  const sr=useMemo(()=>TIMEFRAMES[tf]?.barMin>=1440?findSR(chartData):[],[chartData,tf]);
  const ch=pct(selected.p,selected.pc),isUp=ch>=0;
  const getInsight=async()=>{
    setLoadingAI(true);setInsight("");
    try{
      const raw=await callClaude(`2-3 sentence day trader brief on ${selected.s} (${names[selected.s]||selected.s}) June 22 2026, price $${f2(selected.p)} ${ch>=0?"+":""}${f2(ch)}% today. Cover: main driver, 2 key catalysts, weekly price target range. Be specific.`);
      setInsight(raw.trim()||"No insight.");
    }catch{setInsight("Fetch failed — try again.");}
    finally{setLoadingAI(false);}
  };
  return(
    <div style={{animation:"fadeUp 0.18s ease"}}>
      <div style={{background:T.surface,borderRadius:14,padding:"16px",marginBottom:10,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontFamily:T.sans,fontSize:11,color:T.textSub,fontWeight:500,marginBottom:4}}>{names[selected.s]||selected.s}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontFamily:T.sans,fontSize:26,fontWeight:700,color:T.text,fontVariantNumeric:"tabular-nums"}}>{selected.p<1?`$${selected.p.toFixed(4)}`:`$${f2(selected.p)}`}</span>
              <ChangeBadge p={selected.p} pc={selected.pc} T={T} size="lg"/>
            </div>
          </div>
          <button onClick={onClose} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surfaceB,color:T.textSub,fontSize:11,cursor:"pointer",fontFamily:T.sans}}>✕</button>
        </div>
      </div>
      <ChartControls tf={tf} setTf={setTf} chartMode={chartMode} setChartMode={setChartMode} ind={ind} toggleInd={toggleInd} T={T}/>
      <div style={{background:T.surface,borderRadius:12,padding:"10px 8px",marginBottom:8,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
        {chartData.length>0&&(chartMode==="candle"
          ?<CandleChart data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} T={T}/>
          :<LineChartView data={chartData} showEMA={ind.ema} showSupport={ind.support} srLevels={sr} T={T} height={195} accent={isUp?T.up:T.down}/>
        )}
      </div>
      {ind.volume&&<div style={{background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`}}><div style={{fontSize:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>Volume</div><VolumePanel data={chartData} T={T}/></div>}
      {ind.macd&&<div style={{background:T.surface,borderRadius:10,padding:"10px 8px 6px",marginBottom:8,border:`1px solid ${T.border}`}}><div style={{fontSize:8,color:T.textSub,paddingLeft:4,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:T.sans}}>MACD (12, 26, 9)</div><MACDPanel data={chartData} T={T}/></div>}
      <div style={{background:T.insightBg,border:`1px solid ${T.insightBorder}`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:insight?10:0}}>
          <div style={{fontSize:11,fontWeight:700,color:T.accent,fontFamily:T.sans}}>✦ AI Insight</div>
          <button onClick={getInsight} disabled={loadingAI} style={{padding:"5px 14px",borderRadius:8,border:loadingAI?`1px solid ${T.border}`:"none",background:loadingAI?"transparent":`linear-gradient(135deg,#312E81,#4338CA)`,color:loadingAI?T.textSub:"#C7D2FE",fontSize:11,fontWeight:600,cursor:loadingAI?"default":"pointer",fontFamily:T.sans}}>
            {loadingAI?<span style={{animation:"pulse 1.1s infinite"}}>Searching…</span>:"Generate"}
          </button>
        </div>
        {insight&&<div style={{fontSize:12,color:T.insightText,lineHeight:1.65,fontFamily:T.sans}}>{insight}</div>}
        {!insight&&!loadingAI&&<div style={{fontSize:11,color:T.textSub,marginTop:6,fontFamily:T.sans}}>Live AI brief: driver · catalysts · weekly price target for {selected.s}</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   RECOMMENDATIONS
════════════════════════════════════════════════════ */
function Recommendations({stocks,T}){
  const [recs,setRecs]=useState(null);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState(true);
  const key=stocks.slice(0,8).map(s=>s.s).join(",");

  const load=useCallback(async()=>{
    if(!stocks.length)return;
    setLoading(true);setRecs(null);
    const priceInfo=stocks.slice(0,8).map(s=>`${s.s}:$${f2(s.p)}(${pct(s.p,s.pc)>=0?"+":""}${f2(pct(s.p,s.pc))}%)`).join(", ");
    try{
      const raw=await callClaude(
        `Based on these stocks and their momentum: ${priceInfo}. Provide 4 concise buy/watch/avoid recommendations for a day trader. Today is June 22 2026. JSON only.`,
        `Return ONLY raw JSON no markdown: {"recs":[{"symbol":"NVDA","action":"buy","reason":"one concise sentence","target":"$210–$220"}]}`
      );
      const parsed=parseJSON(raw);
      if(parsed?.recs)setRecs(parsed.recs);
    }catch{}
    finally{setLoading(false);}
  },[key]);

  useEffect(()=>{load();},[key]);

  const actionStyle=(action)=>{
    const map={buy:{bg:T.upBg,color:T.up},watch:{bg:`${T.ema9}18`,color:T.ema9},avoid:{bg:T.downBg,color:T.down}};
    return map[action?.toLowerCase()]||map.watch;
  };

  return(
    <div style={{background:T.surface,borderRadius:14,border:`1px solid ${T.border}`,marginTop:14,overflow:"hidden",boxShadow:T.shadow}}>
      <div onClick={()=>setOpen(v=>!v)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",cursor:"pointer",borderBottom:open?`1px solid ${T.border}`:"none"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.sans}}>✦ AI Recommendations</div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {!loading&&<button onClick={e=>{e.stopPropagation();load();}} style={{fontSize:10,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontFamily:T.sans}}>↻ Refresh</button>}
          {loading&&<span style={{fontSize:10,color:T.textSub,animation:"pulse 1.2s infinite",fontFamily:T.sans}}>Analyzing…</span>}
          <span style={{color:T.textSub,fontSize:12}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&(
        <div style={{padding:"14px 16px"}}>
          {loading&&<div style={{fontSize:12,color:T.textSub,fontFamily:T.sans,animation:"pulse 1.2s infinite"}}>Running AI analysis on your watchlist…</div>}
          {recs&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {recs.map((r,i)=>{
                const st=actionStyle(r.action);
                return(
                  <div key={i} style={{background:T.surfaceB,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontFamily:T.sans,fontSize:14,fontWeight:700,color:T.text}}>{r.symbol}</span>
                      <span style={{padding:"3px 8px",borderRadius:6,background:st.bg,color:st.color,fontSize:10,fontWeight:700,textTransform:"uppercase",fontFamily:T.sans}}>{r.action}</span>
                    </div>
                    <div style={{fontSize:11,color:T.textSub,lineHeight:1.5,marginBottom:6,fontFamily:T.sans}}>{r.reason}</div>
                    {r.target&&<div style={{fontSize:10,color:T.accent,fontWeight:600,fontFamily:T.sans}}>Target: {r.target}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {!loading&&!recs&&<div style={{fontSize:11,color:T.textSub,fontFamily:T.sans}}>AI recommendations will load automatically.</div>}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════ */
export default function StockScreener(){
  const [isDark,setIsDark]=useState(true);
  const T=isDark?DARK:LIGHT;
  const [isMobile,setIsMobile]=useState(false);
  const [names,setNames]=useState({...BASE_NAMES});
  const [tabs,setTabs]=useState(DEFAULT_TABS);
  const [activeTab,setActiveTab]=useState("tech");
  const [indices,setIndices]=useState(INDICES);
  const [mktNews,setMktNews]=useState([]);
  const [selectedIdx,setSelectedIdx]=useState(null);
  const [selected,setSelected]=useState(null);
  const [viewMode,setViewMode]=useState("grid");
  const [sort,setSort]=useState("change_desc");
  const [newTicker,setNewTicker]=useState("");
  const [newTabName,setNewTabName]=useState("");
  const [addingTab,setAddingTab]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [autoRefresh,setAutoRefresh]=useState(false);
  const [lastRefresh,setLastRefresh]=useState(null);
  const autoRef=useRef(null);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<680);
    check();window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    if(autoRef.current)clearInterval(autoRef.current);
    if(autoRefresh){autoRef.current=setInterval(()=>runRefresh(curTab.stocks),60000);}
    return()=>{ if(autoRef.current)clearInterval(autoRef.current); };
  },[autoRefresh,activeTab]);

  const curTab=tabs.find(t=>t.id===activeTab)||tabs[0];
  const stocks=useMemo(()=>[...curTab.stocks].sort((a,b)=>{
    const ca=pct(a.p||0,a.pc||1),cb=pct(b.p||0,b.pc||1);
    if(sort==="change_desc")return cb-ca;
    if(sort==="change_asc") return ca-cb;
    return a.s.localeCompare(b.s);
  }),[curTab,sort]);

  const allSymbols=useMemo(()=>[...new Set(tabs.flatMap(t=>t.stocks.map(s=>s.s)))]   ,[tabs]);

  // Auto-fetch prices on first load
  const didMount=useRef(false);
  useEffect(()=>{
    if(didMount.current)return;
    didMount.current=true;
    setTimeout(()=>runRefresh(curTab.stocks),600);
  },[]);// eslint-disable-line

  // Core refresh — accepts any stock list so it works on mount and tab switch
  const runRefresh=useCallback(async(stockList)=>{
    const valid=(stockList||[]).filter(s=>!s.loading&&s.s);
    setRefreshing(true);

    // Combine stock symbols + index symbols into one pool of batches
    const idxSyms=INDICES.map(i=>i.s);
    const allSyms=[...new Set([...valid.map(s=>s.s),...idxSyms])];
    const batchSize=4;
    const batches=[];
    for(let i=0;i<allSyms.length;i+=batchSize)batches.push(allSyms.slice(i,i+batchSize));

    // Fire all price batches + news fetch in parallel
    const [batchResults,newsRaw]=await Promise.all([
      Promise.all(batches.map(b=>fetchPrices(b))),
      callClaude(
        "Today: 3 top stock market news items with sentiment. JSON only.",
        `Return ONLY raw JSON: {"news":[{"h":"headline","sentiment":"bullish|bearish|neutral"}]}`
      ).catch(()=>"")
    ]);

    const merged=Object.assign({},...batchResults);

    // Update news
    const parsedNews=parseJSON(newsRaw);
    if(parsedNews?.news?.length)setMktNews(parsedNews.news);

    // Update index prices
    setIndices(prev=>prev.map(idx=>{
      const u=merged[idx.s];
      if(!u)return idx;
      const p=Number(u.p||u.price||0);
      const pc=Number(u.pc||u.prevClose||p*0.99);
      return p>0?{...idx,p,pc}:idx;
    }));

    // Update stock prices
    if(valid.length>0){
      setTabs(prev=>prev.map(t=>t.id===activeTab?{
        ...t,
        stocks:t.stocks.map(s=>{
          const u=merged[s.s]||merged[s.s?.toLowerCase()];
          if(!u)return s;
          const p=Number(u.p||u.price||0);
          const pc=Number(u.pc||u.prevClose||p*0.99);
          return p>0?{...s,p,pc}:s;
        })
      }:t));
    }

    setLastRefresh(new Date());
    setRefreshing(false);
  },[activeTab]);

  // Keep selected index chart in sync when prices refresh
  useEffect(()=>{
    if(!selectedIdx)return;
    const updated=indices.find(i=>i.s===selectedIdx.s);
    if(updated&&(updated.p!==selectedIdx.p||updated.pc!==selectedIdx.pc)){
      setSelectedIdx(updated);
    }
  },[indices]);

  const addTicker=async()=>{
    const sym=newTicker.trim().toUpperCase();
    if(!sym||curTab.stocks.some(s=>s.s===sym)){setNewTicker("");return;}
    setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:[...t.stocks,{s:sym,p:0,pc:0,loading:true}]}:t));
    setNewTicker("");
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:500,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Search the web for the current real-time stock price of ${sym}.

Reply with ONLY this JSON and nothing else:
{"symbol":"${sym}","name":"Full Company Name","price":123.45,"prevClose":121.00}

Use the actual current price from your search results.`}]
        })
      });
      const data=await res.json();
      const txt=data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
      const parsed=parseJSON(txt);
      let price=Number(parsed?.price||parsed?.p||0);
      let prevClose=Number(parsed?.prevClose||parsed?.pc||0);
      // Regex fallback if JSON parsing missed the price
      if(!price){const fp=extractPrice(txt);if(fp)price=fp;}
      if(price>0){
        if(parsed?.name)setNames(n=>({...n,[sym]:parsed.name}));
        if(!prevClose)prevClose=price*0.99;
        setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.map(s=>s.s===sym?{s:sym,p:price,pc:prevClose,loading:false}:s)}:t));
      }else{
        setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.map(s=>s.s===sym?{...s,loading:false,failed:true}:s)}:t));
      }
    }catch{
      setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.map(s=>s.s===sym?{...s,loading:false,failed:true}:s)}:t));
    }
  };

  const addTab=()=>{
    if(!newTabName.trim())return;
    const id=newTabName.trim().toLowerCase().replace(/\s+/g,"-")+Date.now();
    setTabs(p=>[...p,{id,label:newTabName.trim(),stocks:[]}]);
    setActiveTab(id);setNewTabName("");setAddingTab(false);
  };
  const removeTab=id=>{setTabs(p=>p.filter(t=>t.id!==id));if(activeTab===id)setActiveTab(tabs[0].id);};
  const removeTicker=sym=>{setTabs(p=>p.map(t=>t.id===activeTab?{...t,stocks:t.stocks.filter(s=>s.s!==sym)}:t));if(selected?.s===sym)setSelected(null);};

  const timeSince=lastRefresh?`Updated ${Math.floor((Date.now()-lastRefresh)/60000)||"<1"} min ago`:"";

  const StockList=(
    <div style={{maxHeight:isMobile?"none":"52vh",overflowY:"auto"}}>
      {viewMode==="grid"
        ?<div style={{display:"grid",gridTemplateColumns:selected&&!isMobile?"1fr":"repeat(auto-fill,minmax(155px,1fr))",gap:10}}>
           {stocks.map(st=>(
             <GridCard key={st.s} stock={st} selected={selected?.s===st.s}
               onClick={()=>setSelected(s=>s?.s===st.s?null:st)}
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing}/>
           ))}
         </div>
        :<div style={{background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:T.shadow}}>
           {stocks.map(st=>(
             <ListRow key={st.s} stock={st} selected={selected?.s===st.s}
               onClick={()=>setSelected(s=>s?.s===st.s?null:st)}
               removable={true} onRemove={()=>removeTicker(st.s)} names={names} T={T} refreshing={refreshing}/>
           ))}
         </div>
      }
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:T.sans,padding:isMobile?"10px 12px 32px":"16px 20px 40px",boxSizing:"border-box",transition:"background 0.2s,color 0.2s"}}>
      <style>{`
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%,100%{opacity:0.5}50%{opacity:0.9}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
        input::placeholder{color:${T.textSub}}
      `}</style>

      {/* ── HEADER ────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:isMobile?16:20,fontWeight:700,color:T.text,letterSpacing:"-0.02em"}}>AI Market Screener</div>
          {!isMobile&&<div style={{fontSize:11,color:T.textSub,marginTop:2}}>AI-powered · Tap any index to view chart</div>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {timeSince&&<span style={{fontSize:10,color:T.textSub}}>{timeSince}</span>}
          <button onClick={()=>setAutoRefresh(v=>!v)} style={{padding:"5px 10px",borderRadius:8,border:`1px solid ${autoRefresh?T.up:T.border}`,background:autoRefresh?T.upBg:"transparent",color:autoRefresh?T.up:T.textSub,fontSize:11,cursor:"pointer",fontWeight:autoRefresh?600:400}}>
            {autoRefresh?"⏱ Auto ON":"⏱ Auto"}
          </button>
          <button onClick={()=>runRefresh(curTab.stocks)} disabled={refreshing} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:refreshing?T.textSub:T.text,fontSize:11,cursor:refreshing?"default":"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:T.shadow}}>
            <span style={refreshing?{animation:"pulse 1s infinite",display:"inline-block"}:{}}>{refreshing?"↻ Refreshing…":"↻ Refresh"}</span>
          </button>
          <button onClick={()=>setIsDark(v=>!v)} style={{padding:"5px 11px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:12,cursor:"pointer",boxShadow:T.shadow}}>
            {isDark?"☀️":"🌙"}
          </button>
        </div>
      </div>

      {/* ── MARKET HERO ─────────────────────────── */}
      <MarketHero T={T} selectedIdx={selectedIdx} onSelectIdx={setSelectedIdx} symbols={allSymbols} indices={indices} news={mktNews} refreshing={refreshing}/>
      {selectedIdx&&<IndexChart key={selectedIdx.s} index={selectedIdx} T={T}/>}

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
            {activeTab===t.id&&tabs.length>1&&<button onClick={()=>removeTab(t.id)} style={{padding:"1px 4px",borderRadius:3,border:"none",background:"transparent",color:T.textSub,fontSize:10,cursor:"pointer",marginLeft:-6}}>✕</button>}
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
            <button onClick={()=>setAddingTab(false)} style={{padding:"4px 7px",borderRadius:6,border:"none",background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer"}}>✕</button>
          </div>
        }
      </div>

      {/* ── CONTROLS ────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",flexWrap:"wrap",gap:8,marginBottom:10}}>
        <div style={{display:"flex",gap:6}}>
          <input value={newTicker} onChange={e=>setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&addTicker()}
            placeholder="Add ticker…"
            style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:12,width:100,outline:"none",fontFamily:T.mono,boxShadow:T.shadow}}/>
          <button onClick={addTicker} style={{padding:"6px 12px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:12,cursor:"pointer",fontWeight:600,fontFamily:T.sans}}>+</button>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:T.textSub,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:T.sans}}>Sort</span>
          {[["change_desc","▲ Top",T.up],["change_asc","▼ Worst",T.down],["az","A–Z",T.accent]].map(([k,l,c])=>(
            <button key={k} onClick={()=>setSort(k)} style={{padding:"4px 9px",borderRadius:6,border:`1px solid ${sort===k?c:T.border}`,background:sort===k?`${c}15`:"transparent",color:sort===k?c:T.textSub,fontSize:10,cursor:"pointer",fontWeight:sort===k?600:400,fontFamily:T.sans}}>{l}</button>
          ))}
          <div style={{width:1,height:12,background:T.border}}/>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,display:"flex",overflow:"hidden",boxShadow:T.shadow}}>
            {[["grid","▦"],["list","≡"]].map(([v,ic])=>(
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
            <StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)}/>
          </div>
        ):StockList
      ):(
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:selected?255:"100%",flexShrink:0,transition:"width 0.18s"}}>{StockList}</div>
          {selected&&<div style={{flex:1,minWidth:0}}><StockDetail selected={selected} names={names} T={T} onClose={()=>setSelected(null)}/></div>}
        </div>
      )}

      {/* ── RECOMMENDATIONS ──────────────────────── */}
      <Recommendations stocks={stocks} T={T}/>

      <div style={{marginTop:20,textAlign:"center",fontSize:10,color:T.textTert,fontFamily:T.sans}}>
        AI insights via Claude + web search · Chart data is synthetic/illustrative · Not financial advice
      </div>
    </div>
  );
}
