import { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   PORTFOLIO DATA — edit this section to update content
   ============================================================ */

const GAME_TITLE = "Design Quest";
const GAME_SUBTITLE_LINE = "A TOP-DOWN DESIGN ADVENTURE";
const GAME_DESCRIPTION =
  "Lead Product Designer obsessed with scalable systems and high-fidelity interactions. Motion roots, systems brain.";

const PROFILE = {
  name: "Daniel Tieu",
  title: "Product Designer",
  email: "danvisual.uxd@gmail.com",
  phone: "510.221.6211",
  linkedin: "https://www.linkedin.com/in/danieltieu/",
  dribbble: "https://dribbble.com/dan_visual",
  site: "https://www.danielvisual.com",
};

const ABOUT = {
  bio: [
    "12+ years across consumer health, wellness, and AI-first products.",
    "I lead high-stakes flows where conversion, trust, and compliance compound — turning sensitive user moments into clear, testable interactions.",
    "My insatiable curiosity drives my design thinking: I'm never content with the status quo, always questioning, researching, and uncovering insights that inform user-centered decisions.",
    "I bring a strong sense of integrity to the workplace — my work ethic is anchored in honesty, trust, and transparent communication.",
  ],
  highlight:
    "Previously @ Doctronic (AI health layer), GoodRx, Estée Lauder, Sephora.",
  education: [
    "UC Davis — B.A. Media Technology & Chinese (2009)",
    "General Assembly — Product Design (2021)",
    "Udacity — UX Design (2020)",
  ],
  recognition: [
    "Sephora Values In Action Award (2019)",
    "Adobe Creative Jam — Top 10 Finalist (2021)",
    "SacHackathon — 1st Place (2021)",
  ],
};

const SKILLS = [
  { name: "Product Design", level: 5, desc: "End-to-end product thinking, from problem framing to shipped UI." },
  { name: "Conversion & Growth Design", level: 5, desc: "Diagnosing drop-off and shipping the fix — proven across GoodRx and Amyris." },
  { name: "Interaction & Motion Design", level: 5, desc: "A motion design background that shapes every interface he touches." },
  { name: "Design Systems", level: 4, desc: "Built foundational systems at Sephora and an enterprise library at Estée Lauder." },
  { name: "UX Research & Diagnosis", level: 4, desc: "Surveys, funnel diagnosis, and synthesis that drives the next decision." },
  { name: "Prototyping (Figma)", level: 5, desc: "Fast, high-fidelity prototypes that hold up under real engineering review." },
  { name: "Cross-functional Partnership", level: 5, desc: "Works fluently with engineering, legal, and clinical teams on regulated products." },
  { name: "Accessibility", level: 4, desc: "Navigation, tap-targets, and accessibility work built into the React rebuild at Doctronic." },
];

// Real resume — reverse chronological
const EXPERIENCE = [
  {
    role: "Lead Product Designer",
    org: "Doctronic",
    sub: "AI-first telehealth",
    period: "Feb 2026 – June 2026",
    bullets: [
      "Drove the Utah prescription refill flow toward a 6% conversion target — batched lander, eligibility, and copy optimizations across mobile and desktop.",
      "Shipped the EHR medical records and trust-and-privacy surfaces (memory controls, delete-consult, incognito) that make AI-mediated care legible and controllable.",
      "Partnered with founding engineering on the React rebuild — navigation, accessibility, and tap-target work without a standing design system.",
    ],
  },
  {
    role: "Senior Product Designer",
    org: "GoodRx",
    sub: "Telehealth",
    period: "Apr 2025 – Jan 2026",
    bullets: [
      "Led design for GoodRx's first subscription product (telehealth ED treatment) — onboarding, treatment preference, and post-purchase from MVP through optimization.",
      "Diagnosed a 36% onboarding drop-off and shipped three interventions (emergency-screening copy, warm-up question removal, personalized dosage paths) that lifted conversion across the funnel.",
    ],
  },
  {
    role: "Senior Product Designer",
    org: "Estée Lauder",
    sub: "Consumer Experience",
    period: "Oct 2023 – Apr 2025",
    bullets: [
      "Delivered an enterprise interaction library — tokens, motion guidelines, responsive components — for 7+ luxury brands including MAC, La Mer, and Origins.",
      "Redesigned global search and filtering with mobile-first filter logic; improved findability and search speed across the portfolio.",
    ],
  },
  {
    role: "Senior UI/UX Designer",
    org: "Amyris",
    sub: "B2B2C Consumer Experience",
    period: "Oct 2021 – Oct 2023",
    bullets: [
      "Shipped a 0-to-1 e-commerce brand for Stripes Beauty — a science-backed menopause wellness brand co-founded by Naomi Watts. Conversion +25%, cart abandonment −13% YoY.",
      "Delivered enterprise product features across Amyris's brand portfolio: Biossance, Pipette, JVN Hair, Rose Inc, and Costa Brazil.",
    ],
  },
  {
    role: "Interaction Designer",
    org: "Sephora",
    sub: "Learning & Development",
    period: "Nov 2017 – Mar 2021",
    bullets: [
      "Led a pod of 4 designers/producers to build virtual e-learning tools for Sephora's Education & Learning org — videos, interactive courses, EDU portal, and onboarding for 30K+ in-store hires.",
      "Established the foundational design system for the org — responsive breakpoints, type scales, iconography — across iOS, Android, and web.",
    ],
  },
  {
    role: "Visual / Lead Designer",
    org: "Various Clients",
    sub: "Old Navy, Amazon, Sephora, Quicken, Live Nation",
    period: "2014 – 2021",
    bullets: [
      "Delivered marketing campaigns, mobile features, and social content across workforce, beauty & fashion, and finance sectors.",
      "Notably: Amazon Jobs candidate portal mobile funnel supporting 1.6M annual hires.",
    ],
  },
];

// Arcade = UX case studies ONLY, with Problem / Approach / Outcome detail
const CASE_STUDIES = [
  {
    id: "doctronic",
    title: "Doctronic",
    role: "Lead Product Designer",
    period: "Feb 2026 – June 2026",
    blurb: "AI-mediated prescription refill flow and trust surfaces for an AI-first telehealth product.",
    problem:
      "Doctronic needed to take an AI-mediated prescription refill flow live in Utah, but conversion was below target and the surrounding trust/privacy experience (memory controls, consult deletion, incognito mode) didn't yet exist — a risk for an AI-authorized clinical flow with no prior playbook.",
    approach:
      "Batched lander, eligibility, and copy optimizations across mobile and desktop while building the EHR medical records and trust-and-privacy surfaces from scratch. Partnered directly with founding engineering on a React rebuild — navigation, accessibility, and tap targets — without a standing design system to lean on.",
    outcome:
      "Drove the refill flow toward a 6% conversion target and shipped the first AI-authorized prescription refill flow in the US — covered by the Washington Post, Politico, and the Salt Lake Tribune.",
    tags: ["AI", "Health", "0→1", "Compliance"],
    link: null,
    featured: true,
  },
  {
    id: "goodrx",
    title: "GoodRx",
    role: "Senior Product Designer",
    period: "Apr 2025 – Jan 2026",
    blurb: "GoodRx's first subscription product — telehealth ED treatment, MVP through optimization.",
    problem:
      "GoodRx was launching its first subscription product, a telehealth ED treatment line, and onboarding had a 36% drop-off rate that was capping growth before the funnel could even reach paid conversion.",
    approach:
      "Led design across onboarding, treatment preference, and post-purchase from MVP through optimization, partnering closely with content, legal, and clinical teams to navigate medical compliance while diagnosing exactly where users were abandoning the flow.",
    outcome:
      "Shipped three targeted interventions — emergency-screening copy, removing a warm-up question, and personalized dosage paths — that lifted conversion across the entire funnel.",
    tags: ["Health", "Subscription", "Conversion"],
    link: "https://www.danielvisual.com/goodrx/",
  },
  {
    id: "estee-lauder",
    title: "Estée Lauder",
    role: "Senior Product Designer",
    period: "Oct 2023 – Apr 2025",
    blurb: "Enterprise interaction library and global search redesign across 7+ luxury brands.",
    problem:
      "Seven-plus luxury brands — including MAC, La Mer, and Origins — had inconsistent interaction patterns and a search/filter experience that wasn't built mobile-first, hurting findability across the portfolio.",
    approach:
      "Delivered an enterprise interaction library covering design tokens, motion guidelines, and responsive components, then redesigned global search and filtering around mobile-first filter logic.",
    outcome:
      "Improved findability and search speed across the entire brand portfolio while giving every brand team a shared, scalable interaction foundation.",
    tags: ["Design Systems", "Search", "Enterprise"],
    link: "https://www.danielvisual.com/estee-lauder-shopex/",
  },
  {
    id: "amyris",
    title: "Stripes Beauty (Amyris)",
    role: "Senior UI/UX Designer",
    period: "Oct 2021 – Oct 2023",
    blurb: "0-to-1 e-commerce brand for a menopause wellness line co-founded by Naomi Watts.",
    problem:
      "Stripes Beauty, a science-backed menopause wellness brand co-founded by Naomi Watts, needed a full e-commerce experience built from zero, alongside ongoing feature work across Amyris's wider brand portfolio.",
    approach:
      "Shipped the 0-to-1 e-commerce brand experience while optimizing the customer journey, and delivered enterprise product features — shopping cart, PDP/PLP, navigation, livestream platform — across Biossance, Pipette, JVN Hair, Rose Inc, and Costa Brazil.",
    outcome:
      "Conversion improved +25% with cart abandonment down −13% year-over-year for Stripes Beauty.",
    tags: ["Beauty", "0→1", "E-commerce"],
    link: "https://www.danielvisual.com/amyris/",
  },
  {
    id: "sephora-education",
    title: "Sephora — Learning & Development",
    role: "Interaction Designer",
    period: "Nov 2017 – Mar 2021",
    blurb: "E-learning platform and foundational design system for 30K+ in-store hires.",
    problem:
      "Sephora's Education & Learning org needed virtual e-learning tools to onboard over 30,000 in-store hires, but had no shared design foundation across iOS, Android, and web to build on.",
    approach:
      "Led a pod of 4 designers and producers to build videos, interactive courses, and an EDU portal, while establishing the org's foundational design system — responsive breakpoints, type scales, and iconography.",
    outcome:
      "Delivered a scalable onboarding system that supported 30,000+ in-store hires and earned a Sephora Values In Action Award in 2019.",
    tags: ["Education", "Design Systems", "Retail"],
    link: "https://www.danielvisual.com/sephora-education/",
  },
  {
    id: "quicken",
    title: "Quicken Finance Calculator",
    role: "Visual / Lead Designer",
    period: "2014 – 2021",
    blurb: "Finance calculator product design for Quicken.",
    problem: "Quicken needed clearer calculator tooling to help users model personal finance decisions.",
    approach: "Designed the calculator product flow and supporting visual system as part of a broader run of client engagements during this period.",
    outcome: "Shipped a finance calculator experience used within Quicken's product suite.",
    tags: ["Fintech", "Tools"],
    link: "https://www.danielvisual.com/quicken/",
  },
  {
    id: "homebase",
    title: "HomeBase App",
    role: "Lead Designer & Researcher",
    period: "2021",
    blurb: "Hackathon project fostering community connection — 1st place, SacHackathon 2021.",
    problem:
      "A 4-person hackathon team (down to 2 after early dropouts) wanted to build an app fostering genuine community relationships in just 36 hours.",
    approach:
      "Acted as main designer and researcher — ran a survey to understand community connection behaviors, then used agile sprints to deliver a full MVP and walkthrough presentation within the hackathon window.",
    outcome:
      "Won 1st place for Most Entertaining Hack at SacHackathon 2021.",
    tags: ["Hackathon", "Community", "0→1"],
    link: "https://www.danielvisual.com/homebase-app/",
  },
];

// Gallery building — visual/play projects, swipeable image-style cards
const VISUAL_PROJECTS = [
  {
    id: "sephora-digital",
    title: "Sephora Digital Marketing",
    period: "2014 – 2021",
    blurb:
      "Visual and campaign design across Sephora's digital marketing — translating brand campaigns into web and social placements that stayed on-brand at scale.",
    emphasis: "Brand consistency across a high-volume retail marketing calendar.",
    link: "https://www.danielvisual.com/sephora-digital/",
  },
  {
    id: "old-navy",
    title: "Old Navy",
    period: "2014 – 2021",
    blurb:
      "Campaign and digital marketing visual design for Old Navy — seasonal promotions, sale events, and mobile-first marketing placements.",
    emphasis: "Fast-turnaround campaign work in a high-frequency retail marketing cycle.",
    link: "https://www.danielvisual.com/old-navy-digital/",
  },
  {
    id: "live-nation",
    title: "Live Nation",
    period: "2014 – 2021",
    blurb:
      "Visual design for Live Nation's digital entertainment experiences — campaign-driven pages built for ticket-buying urgency and artist branding.",
    emphasis: "Entertainment branding paired with conversion-focused interaction design.",
    link: "https://www.danielvisual.com/live-nation/",
  },
  {
    id: "amazon-wfs",
    title: "Amazon WFS",
    period: "2014 – 2021",
    blurb:
      "Visual design for the Amazon Jobs candidate portal mobile funnel — built to handle massive scale without losing clarity for first-time applicants.",
    emphasis: "Supported 1.6M annual hires through the mobile candidate funnel.",
    link: "https://www.danielvisual.com/amazon-wfs/",
  },
];

// Selectable characters — "hiring panel" framing
const CHARACTERS = [
  {
    id: "pixel",
    name: "Pixel",
    role: "The Systems Architect",
    sprite: "systems",
    bio: "Methodical and detail-obsessed. Pixel speaks fluent design tokens and never met a breakpoint she didn't like. Brought in whenever a brand portfolio needs one shared language.",
    color: "#3098e8",
  },
  {
    id: "nova",
    name: "Nova",
    role: "The Growth Strategist",
    sprite: "growth",
    bio: "Data-driven and relentless about funnels. Nova diagnoses drop-off before anyone else notices it's happening, then ships the fix before lunch.",
    color: "#f04830",
  },
  {
    id: "sketch",
    name: "Sketch",
    role: "The Motion Maverick",
    sprite: "motion",
    bio: "Animation-obsessed and a little theatrical about it. Sketch believes every interaction deserves a little personality — and usually delivers it in one take.",
    color: "#a858e0",
  },
];

/* ============================================================
   WORLD / MAP CONFIG — bigger town, varied landscape
   ============================================================ */

const TILE = 32;
const COLS = 36;
const ROWS = 24;

// Distinct building footprints + visual "kind" for unique rendering
const BUILDINGS = [
  { id: "arcade", label: "Arcade", sub: "Projects", kind: "arcade", x: 4, y: 4, w: 5, h: 4, color: "#f0d8a8", roof: "#e85838", trim: "#ffffff" },
  { id: "tower", label: "Tower", sub: "Skills", kind: "tower", x: 16, y: 2, w: 4, h: 7, color: "#e8e0d0", roof: "#4878c0", trim: "#2858a0" },
  { id: "house", label: "Cottage", sub: "About", kind: "house", x: 27, y: 4, w: 5, h: 4, color: "#f0d8a8", roof: "#48a050", trim: "#2c7838" },
  { id: "library", label: "Library", sub: "Resume", kind: "library", x: 5, y: 16, w: 6, h: 5, color: "#e8e0d0", roof: "#a85838", trim: "#ffffff" },
  { id: "post", label: "Post Office", sub: "Contact", kind: "post", x: 26, y: 16, w: 5, h: 4, color: "#f0d8a8", roof: "#e8b830", trim: "#c88800" },
  { id: "gallery", label: "Gallery", sub: "Visual Play", kind: "gallery", x: 16, y: 17, w: 5, h: 4, color: "#f8c8d8", roof: "#d85890", trim: "#ffffff" },
];

function doorTile(b) {
  return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h };
}

const START_POS = { x: 18, y: 11 };

// NPCs — placed near About (house) and Contact (post)
const NPCS = [
  {
    id: "elder",
    name: "The Village Elder",
    nearBuildingId: "house",
    x: 26,
    y: 9,
    palette: { skin: "#f0c89c", robe: "#c89030", trim: "#ffe858" },
    intro: "Ah, a traveler. You wish to know more about the designer who built this town?",
    branches: [
      { label: "Tell me about his approach", response: "approach" },
      { label: "What is he known for?", response: "highlight" },
      { label: "Where did he train?", response: "education" },
    ],
  },
  {
    id: "courier",
    name: "The Courier",
    nearBuildingId: "post",
    x: 25,
    y: 13,
    palette: { skin: "#f0c89c", robe: "#3098e8", trim: "#bfe0ff" },
    intro: "Looking to reach Daniel? I won't just hand you the address — but I'll give you a clue, if you're up for it.",
    riddle:
      "Seek the building with the golden roof and the flag flying high near its chimney. Knock there, and the way to reach him will be revealed.",
    branches: [
      { label: "Give me the clue", response: "clue" },
      { label: "I found it — reveal the contact", response: "reveal" },
    ],
  },
];

// Critters — original wandering flavor creatures, light tap interaction only
const CRITTER_SPAWN = [
  { id: "c1", x: 12, y: 12, kind: "glowpup" },
  { id: "c2", x: 21, y: 6, kind: "inkdrop" },
  { id: "c3", x: 9, y: 9, kind: "sproutling" },
  { id: "c4", x: 24, y: 20, kind: "embercub" },
];

const CRITTER_QUIPS = [
  "Glowpup nuzzles your leg curiously!",
  "Inkdrop blinks its one big eye at you.",
  "Sproutling rustles its little leaf-bud happily.",
  "Embercub's tail flickers with excitement!",
  "*the critter bounces away, unimpressed by your résumé*",
];

// Decorative landscape — trees, mountains, rocks, water
const TREES = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 13, y: 0 }, { x: 22, y: 0 }, { x: 34, y: 0 }, { x: 35, y: 0 },
  { x: 0, y: 1 }, { x: 35, y: 1 }, { x: 0, y: 7 }, { x: 35, y: 7 }, { x: 0, y: 14 }, { x: 35, y: 14 },
  { x: 0, y: 21 }, { x: 1, y: 23 }, { x: 35, y: 21 }, { x: 34, y: 23 },
  { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 21, y: 9 }, { x: 22, y: 9 },
  { x: 13, y: 14 }, { x: 22, y: 14 }, { x: 3, y: 11 }, { x: 32, y: 11 },
  { x: 7, y: 21 }, { x: 8, y: 22 }, { x: 28, y: 21 }, { x: 19, y: 22 },
  { x: 4, y: 2 }, { x: 31, y: 2 }, { x: 17, y: 12 }, { x: 18, y: 13 },
];

// Mountains along the top edge (decorative, also blocking)
const MOUNTAINS = [
  { x: 5, y: 0, w: 4 }, { x: 15, y: 0, w: 3 }, { x: 24, y: 0, w: 5 },
];

const ROCKS = [
  { x: 11, y: 19 }, { x: 30, y: 8 }, { x: 6, y: 13 }, { x: 29, y: 13 },
];

/* ============================================================
   PIXEL ART RENDERING — Gen3 handheld RPG style (original art,
   vibrant saturated palette, tile-roof buildings, trainer sprites)
   ============================================================ */



function Ground() {
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${COLS * TILE} ${ROWS * TILE}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id="grass" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <rect width={TILE} height={TILE} fill="#5fa050" />
          <rect width={TILE} height={TILE} fill="#6bb05c" opacity="0.45" />
          <circle cx={8} cy={8} r="2.2" fill="#4d8a40" />
          <circle cx={22} cy={18} r="2.2" fill="#4d8a40" />
          <circle cx={14} cy={26} r="1.6" fill="#7fc06f" />
          <circle cx={26} cy={6} r="1.4" fill="#7fc06f" />
        </pattern>
        <pattern id="path" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <rect width={TILE} height={TILE} fill="#ecc888" />
          <rect width={TILE} height={TILE} fill="#e8c078" opacity="0.5" />
          <circle cx={10} cy={12} r="2" fill="#d8ac5c" />
          <circle cx={22} cy={22} r="1.6" fill="#d8ac5c" />
          <circle cx={5} cy={24} r="1.2" fill="#d8ac5c" />
        </pattern>
        <pattern id="water" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
          <rect width={TILE} height={TILE} fill="#4fa0d8" />
          <path d="M0 16 Q8 11 16 16 T32 16" stroke="#7ec4ec" strokeWidth="2.4" fill="none" opacity="0.8" />
          <path d="M0 24 Q8 20 16 24 T32 24" stroke="#3a82b8" strokeWidth="2" fill="none" opacity="0.6" />
        </pattern>
      </defs>
      <rect width={COLS * TILE} height={ROWS * TILE} fill="url(#grass)" />
      <rect x={0} y={11 * TILE} width={COLS * TILE} height={2 * TILE} fill="url(#path)" />
      <rect x={17 * TILE} y={0} width={2 * TILE} height={ROWS * TILE} fill="url(#path)" />
      <rect x={6 * TILE} y={11 * TILE} width={2 * TILE} height={5 * TILE} fill="url(#path)" />
      <rect x={27 * TILE} y={11 * TILE} width={2 * TILE} height={5 * TILE} fill="url(#path)" />
      {/* path edge highlight for a more finished look */}
      <rect x={0} y={11 * TILE} width={COLS * TILE} height={3} fill="#fff3d6" opacity="0.6" />
      <rect x={0} y={13 * TILE - 3} width={COLS * TILE} height={3} fill="#c89858" opacity="0.5" />
      <ellipse cx={30 * TILE} cy={5 * TILE} rx={2.4 * TILE} ry={1.6 * TILE} fill="url(#water)" />
      <ellipse cx={30 * TILE} cy={5 * TILE} rx={2.4 * TILE} ry={1.6 * TILE} fill="none" stroke="#2868a0" strokeWidth="3" />
      <ellipse cx={29.3 * TILE} cy={4.5 * TILE} rx={0.6 * TILE} ry={0.3 * TILE} fill="#bfe6ff" opacity="0.5" />
    </svg>
  );
}

function Mountain({ x, y, w }) {
  const px = x * TILE;
  const py = y * TILE;
  const width = w * TILE;
  const height = TILE * 2.6;
  return (
    <svg style={{ position: "absolute", left: px, top: py, pointerEvents: "none" }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={`0,${height} ${width * 0.35},${height * 0.22} ${width * 0.6},${height * 0.52} ${width},${height}`} fill="#7d8a5c" />
      <polygon points={`${width * 0.35},${height * 0.22} ${width * 0.48},${height * 0.42} ${width * 0.22},${height * 0.52}`} fill="#a8b888" opacity="0.85" />
      <polygon points={`0,${height} ${width * 0.35},${height * 0.22} ${width * 0.5},${height * 0.47} ${width * 0.15},${height}`} fill="#5f6c44" />
      <polygon points={`${width * 0.3},${height * 0.26} ${width * 0.38},${height * 0.34} ${width * 0.28},${height * 0.34}`} fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

function Rock({ x, y }) {
  const px = x * TILE;
  const py = y * TILE;
  return (
    <svg style={{ position: "absolute", left: px, top: py, pointerEvents: "none" }} width={TILE} height={TILE} viewBox="0 0 32 32">
      <ellipse cx="16" cy="26" rx="11" ry="3" fill="rgba(0,0,0,0.18)" />
      <path d="M6 24 Q4 14 14 12 Q22 8 27 16 Q29 24 22 25 Q12 28 6 24Z" fill="#9c9684" />
      <path d="M9 16 Q14 12 19 14" stroke="#c0bcaa" strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M10 22 Q16 24 22 21" stroke="#7a7666" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}

function Tree({ x, y }) {
  const px = x * TILE;
  const py = y * TILE;
  return (
    <svg
      style={{ position: "absolute", left: px, top: py, width: TILE, height: TILE * 1.4, pointerEvents: "none" }}
      viewBox="0 0 32 44"
    >
      <ellipse cx="16" cy="14" rx="13" ry="12" fill="#3a8048" />
      <ellipse cx="16" cy="11" rx="10" ry="9" fill="#4ea05c" />
      <ellipse cx="12" cy="8" rx="4.5" ry="4" fill="#7fc46f" opacity="0.85" />
      <rect x="13" y="22" width="6" height="14" fill="#8a5c34" />
      <rect x="13" y="22" width="3" height="14" fill="#a06f3e" />
    </svg>
  );
}

// Distinct, vibrant Gen3-style building art per "kind"
function BuildingArt({ b, w, h, roofH }) {
  const trim = b.trim || "#ffffff";
  const common = <ellipse cx={w / 2} cy={h - 2} rx={w / 2.1} ry={6} fill="rgba(0,0,0,0.22)" />;

  // shared shingle-roof texture lines
  function roofLines(yTop, yBot, xStart, xEnd) {
    const lines = [];
    const step = 6;
    for (let yy = yTop; yy < yBot; yy += step) {
      lines.push(<line key={yy} x1={xStart} y1={yy} x2={xEnd} y2={yy} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />);
    }
    return lines;
  }

  if (b.kind === "tower") {
    return (
      <>
        {common}
        <rect x={w * 0.2} y={roofH} width={w * 0.6} height={h - roofH - 2} fill={b.color} />
        <rect x={w * 0.2} y={roofH} width={w * 0.6} height={6} fill="rgba(255,255,255,0.35)" />
        <rect x={w * 0.2} y={h - 10} width={w * 0.6} height={8} fill="rgba(0,0,0,0.15)" />
        <polygon points={`${w * 0.16},${roofH} ${w / 2},2 ${w * 0.84},${roofH}`} fill={b.roof} />
        {roofLines(roofH * 0.35, roofH, w * 0.2, w * 0.8)}
        <circle cx={w / 2} cy={2} r="3.5" fill="#ffe858" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={w / 2 - 7} y={roofH + 12 + i * 22} width={14} height={12} fill={trim} stroke={b.trim} strokeWidth="1.5" />
            <rect x={w / 2 - 6} y={roofH + 13 + i * 22} width={5} height={10} fill="#bfe0ff" />
            <rect x={w / 2 + 1} y={roofH + 13 + i * 22} width={5} height={10} fill="#bfe0ff" />
          </g>
        ))}
        <rect x={w / 2 - 8} y={h - 22} width={16} height={20} rx={2} fill="#5a3c20" />
        <rect x={w / 2 - 8} y={h - 22} width={16} height={5} fill="#7a5430" />
      </>
    );
  }
  if (b.kind === "arcade") {
    return (
      <>
        {common}
        <rect x={2} y={roofH} width={w - 4} height={h - roofH - 2} fill={b.color} />
        <rect x={2} y={roofH} width={w - 4} height={8} fill="rgba(255,255,255,0.3)" />
        <rect x={2} y={h - 10} width={w - 4} height={8} fill="rgba(0,0,0,0.15)" />
        <rect x={0} y={roofH - 8} width={w} height={12} fill={b.roof} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x={(i * w) / 8} y={roofH - 8} width={w / 16} height={12} fill={i % 2 ? "#ffffff" : b.roof} opacity={i % 2 ? 0.95 : 1} />
        ))}
        <path d={`M${w * 0.3},${h - 2} Q${w * 0.3},${h - 28} ${w / 2},${h - 28} Q${w * 0.7},${h - 28} ${w * 0.7},${h - 2}Z`} fill="#3a2c1a" />
        <path d={`M${w * 0.34},${h - 2} Q${w * 0.34},${h - 24} ${w / 2},${h - 24} Q${w * 0.66},${h - 24} ${w * 0.66},${h - 2}Z`} fill="#ffe858" opacity="0.85" />
        <circle cx={14} cy={roofH + 16} r="6" fill="#ffffff" stroke="#e85838" strokeWidth="2" />
        <circle cx={w - 14} cy={roofH + 16} r="6" fill="#ffffff" stroke="#e85838" strokeWidth="2" />
      </>
    );
  }
  if (b.kind === "library") {
    return (
      <>
        {common}
        <rect x={2} y={roofH} width={w - 4} height={h - roofH - 2} fill={b.color} />
        <rect x={2} y={roofH} width={w - 4} height={6} fill="rgba(255,255,255,0.3)" />
        <rect x={2} y={h - 10} width={w - 4} height={8} fill="rgba(0,0,0,0.12)" />
        <rect x={0} y={roofH - 10} width={w} height={12} fill={b.roof} />
        {roofLines(roofH - 9, roofH + 1, 0, w)}
        {[0.1, 0.3, 0.7, 0.9].map((f, i) => (
          <rect key={i} x={w * f - 3.5} y={roofH} width={7} height={h - roofH - 2} fill="rgba(255,255,255,0.4)" />
        ))}
        <path d={`M${w * 0.34},${h - 4} L${w * 0.34},${roofH + 18} Q${w / 2},${roofH + 4} ${w * 0.66},${roofH + 18} L${w * 0.66},${h - 4}Z`} fill="#bfe0ff" stroke="#ffffff" strokeWidth="1.5" />
      </>
    );
  }
  if (b.kind === "post") {
    return (
      <>
        {common}
        <rect x={2} y={roofH} width={w - 4} height={h - roofH - 2} fill={b.color} />
        <rect x={2} y={roofH} width={w - 4} height={6} fill="rgba(255,255,255,0.3)" />
        <rect x={2} y={h - 10} width={w - 4} height={8} fill="rgba(0,0,0,0.12)" />
        <polygon points={`0,${roofH} ${w / 2},4 ${w},${roofH}`} fill={b.roof} />
        {roofLines(roofH * 0.4, roofH, 0, w)}
        <rect x={w - 9} y={-12} width={2.5} height={roofH + 12} fill="#5a4828" />
        <polygon points={`${w - 6.5},-12 ${w + 12},-6 ${w - 6.5},0`} fill="#f0c030" />
        <circle cx={w / 2} cy={roofH + 16} r="9" fill="#ffffff" />
        <path d="M-5,-5 L5,-5 L0,5Z" transform={`translate(${w / 2 - 5},${roofH + 11})`} fill={b.roof} />
        <rect x={w / 2 - 8} y={h - 20} width={16} height={18} rx={2} fill="#5a4828" />
      </>
    );
  }
  if (b.kind === "gallery") {
    return (
      <>
        {common}
        <rect x={2} y={roofH} width={w - 4} height={h - roofH - 2} fill={b.color} />
        <rect x={2} y={roofH} width={w - 4} height={6} fill="rgba(255,255,255,0.35)" />
        <rect x={2} y={h - 10} width={w - 4} height={8} fill="rgba(0,0,0,0.12)" />
        <polygon points={`0,${roofH} ${w / 2},2 ${w},${roofH}`} fill={b.roof} />
        {Array.from({ length: 7 }).map((_, i) => (
          <polygon key={i} points={`${(i * w) / 6 - 5},${roofH} ${(i * w) / 6 + 5},${roofH} ${(i * w) / 6},${roofH + 12}`} fill={i % 2 ? "#ffe858" : "#bfe0ff"} />
        ))}
        <circle cx={w / 2} cy={roofH + 22} r="13" fill="#3a2c1a" />
        <circle cx={w / 2} cy={roofH + 22} r="10" fill="#ffe858" />
        <circle cx={w / 2 - 3} cy={roofH + 19} r="2.5" fill="#ffffff" opacity="0.8" />
        <rect x={w / 2 - 8} y={h - 20} width={16} height={18} rx={2} fill="#5a3c20" />
      </>
    );
  }
  // house / cottage
  return (
    <>
      {common}
      <rect x={2} y={roofH} width={w - 4} height={h - roofH - 2} fill={b.color} />
      <rect x={2} y={roofH} width={w - 4} height={6} fill="rgba(255,255,255,0.3)" />
      <rect x={2} y={h - 10} width={w - 4} height={8} fill="rgba(0,0,0,0.15)" />
      <polygon points={`0,${roofH} ${w / 2},2 ${w},${roofH}`} fill={b.roof} />
      {roofLines(roofH * 0.3, roofH, 0, w)}
      <rect x={w * 0.72} y={-10} width={9} height={roofH + 10} fill="#9c7a52" />
      <rect x={w * 0.72} y={-10} width={9} height={5} fill="#b8946a" />
      <rect x={w / 2 - 9} y={h - 22} width={18} height={20} rx={2} fill="#5a4828" />
      <rect x={w / 2 - 9} y={h - 22} width={18} height={4} fill="#7a6038" />
      <rect x={10} y={roofH + 10} width={11} height={11} fill="#bfe0ff" stroke="#ffffff" strokeWidth="1.5" />
      <rect x={w - 21} y={roofH + 10} width={11} height={11} fill="#bfe0ff" stroke="#ffffff" strokeWidth="1.5" />
      {/* flower box */}
      <rect x={9} y={roofH + 22} width={13} height={4} fill="#9c7a52" />
      <circle cx={11} cy={roofH + 21} r="2" fill="#f06090" />
      <circle cx={15} cy={roofH + 21} r="2" fill="#ffe858" />
      <circle cx={19} cy={roofH + 21} r="2" fill="#f06090" />
    </>
  );
}

function Building({ b, active }) {
  const px = b.x * TILE;
  const py = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const roofH = h * (b.kind === "tower" ? 0.3 : 0.4);

  return (
    <div
      style={{
        position: "absolute",
        left: px,
        top: py,
        width: w,
        height: h,
        filter: active ? "drop-shadow(0 0 12px rgba(255,232,88,0.95))" : "none",
        transition: "filter 0.15s ease",
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <BuildingArt b={b} w={w} h={h} roofH={roofH} />
      </svg>
      {/* Signage plaque mounted on the building face, above the door — high contrast for readability */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: h * 0.42,
          transform: "translateX(-50%)",
          background: "#1c1408",
          border: "2px solid #ffe858",
          borderRadius: 3,
          padding: "3px 7px",
          textAlign: "center",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ffe858", letterSpacing: 0.5 }}>
          {b.label}
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#fffaf0", marginTop: 1 }}>{b.sub}</div>
      </div>
    </div>
  );
}

// Trainer-style hero sprite — bigger cap/hair silhouette, two-tone outfit, backpack hint
function Hero({ x, y, dir, walking, palette }) {
  const px = x * TILE;
  const py = y * TILE;
  const bob = walking ? -2 : 0;
  const p = palette || CHAR_PALETTES.systems;

  return (
    <div
      style={{
        position: "absolute",
        left: px,
        top: py - TILE * 0.4,
        width: TILE,
        height: TILE * 1.4,
        transition: "left 0.12s linear, top 0.12s linear",
        zIndex: 5,
      }}
    >
      <svg width={TILE} height={TILE * 1.4} viewBox="0 0 32 46">
        <ellipse cx="16" cy="42" rx="9" ry="3" fill="rgba(0,0,0,0.28)" />
        {/* shoes */}
        <rect x="10.5" y={36 + bob} width="5" height="4" rx="1" fill={p.shoe} />
        <rect x="16.5" y={36 - bob} width="5" height="4" rx="1" fill={p.shoe} />
        {/* legs */}
        <rect x="11" y={29 + bob} width="4.5" height="9" fill={p.legs} />
        <rect x="16.5" y={29 - bob} width="4.5" height="9" fill={p.legs} />
        {/* backpack hint (back arm side) */}
        {dir !== "down" && <rect x={dir === "left" ? 21 : 6} y="17" width="5" height="11" rx="2" fill={p.pack} />}
        {/* torso / shirt - two tone */}
        <rect x="8" y="16" width="16" height="14" rx="3" fill={p.shirt} />
        <rect x="8" y="16" width="16" height="6" fill={p.shirtLight} opacity="0.85" />
        <rect x="8" y="25" width="16" height="5" fill={p.shirtDark} opacity="0.6" />
        {/* arms */}
        <rect x={dir === "left" ? 3.5 : 5.5} y="18" width="4.5" height="10" rx="2" fill={p.shirt} />
        <rect x={dir === "right" ? 24 : 22} y="18" width="4.5" height="10" rx="2" fill={p.shirt} />
        {/* head */}
        <rect x="9.5" y="4" width="13" height="13" rx="4" fill={p.skin} />
        {/* hair / cap base */}
        <path d="M8.5 8 Q16 -2 23.5 8 L23.5 11 Q16 5 8.5 11Z" fill={p.hair} />
        {/* cap brim / accent */}
        <rect x="8.5" y="6.5" width="15" height="4" rx="2" fill={p.cap} />
        <rect x="14" y="3" width="4" height="3" rx="1" fill={p.capAccent} />
        {dir === "down" && (
          <>
            <rect x="12" y="11" width="2.2" height="2.2" fill="#1a1208" />
            <rect x="17.8" y="11" width="2.2" height="2.2" fill="#1a1208" />
          </>
        )}
        {dir === "up" && <rect x="12.5" y="8" width="7" height="3.5" fill={p.hair} />}
        {dir === "left" && <rect x="11" y="11" width="2.2" height="2.2" fill="#1a1208" />}
        {dir === "right" && <rect x="18.8" y="11" width="2.2" height="2.2" fill="#1a1208" />}
      </svg>
    </div>
  );
}

// Three original persona looks, vibrant Gen3-style trainer palettes
const CHAR_PALETTES = {
  systems: {
    skin: "#f0c89c", hair: "#283848", cap: "#3098e8", capAccent: "#ffffff",
    shirt: "#3098e8", shirtLight: "#70bcf0", shirtDark: "#1c68a8",
    legs: "#e8e0d0", shoe: "#283848", pack: "#1c68a8",
  },
  growth: {
    skin: "#e8b888", hair: "#5a1810", cap: "#f04830", capAccent: "#ffe858",
    shirt: "#f04830", shirtLight: "#f88868", shirtDark: "#a82c18",
    legs: "#3a3a3a", shoe: "#5a1810", pack: "#a82c18",
  },
  motion: {
    skin: "#f0d0a4", hair: "#3c1858", cap: "#a858e0", capAccent: "#ffe858",
    shirt: "#a858e0", shirtLight: "#d0a0f0", shirtDark: "#702cae",
    legs: "#2c2030", shoe: "#3c1858", pack: "#702cae",
  },
};

// Original wandering critters (not Pokemon designs — same playful genre, fresh shapes)
function Critter({ kind, x, y, onTap, bounce }) {
  const px = x * TILE;
  const py = y * TILE;
  const sq = bounce ? 0.85 : 1;

  const ART = {
    glowpup: (
      <svg width={TILE} height={TILE * 0.85} viewBox="0 0 32 27">
        <ellipse cx="16" cy="25" rx="12" ry="2" fill="rgba(0,0,0,0.18)" />
        <ellipse cx="16" cy="16" rx="12" ry="9" fill="#f0d850" />
        <ellipse cx="7" cy="9" rx="4" ry="6" fill="#f0d850" transform="rotate(-25 7 9)" />
        <ellipse cx="25" cy="9" rx="4" ry="6" fill="#f0d850" transform="rotate(25 25 9)" />
        <ellipse cx="11" cy="13" rx="3.5" ry="3" fill="#fff3b0" opacity="0.7" />
        <circle cx="12" cy="17" r="2" fill="#1a1208" />
        <circle cx="20" cy="17" r="2" fill="#1a1208" />
        <path d="M14 21 Q16 23 18 21" stroke="#1a1208" strokeWidth="1.4" fill="none" />
      </svg>
    ),
    inkdrop: (
      <svg width={TILE} height={TILE * 0.85} viewBox="0 0 32 27">
        <ellipse cx="16" cy="25" rx="11" ry="2" fill="rgba(0,0,0,0.18)" />
        <path d="M16 2 Q26 14 24 20 Q22 26 16 26 Q10 26 8 20 Q6 14 16 2Z" fill="#5090e0" />
        <path d="M16 2 Q26 14 24 20 Q22 26 16 26" fill="#3068b8" opacity="0.5" />
        <ellipse cx="12" cy="14" rx="3" ry="4" fill="#90c0f0" opacity="0.7" />
        <circle cx="16" cy="18" r="4.5" fill="#ffffff" />
        <circle cx="16" cy="18" r="2.6" fill="#1a1208" />
        <circle cx="15" cy="17" r="0.9" fill="#ffffff" />
      </svg>
    ),
    sproutling: (
      <svg width={TILE} height={TILE * 0.85} viewBox="0 0 32 27">
        <ellipse cx="16" cy="25" rx="11" ry="2" fill="rgba(0,0,0,0.18)" />
        <ellipse cx="16" cy="17" rx="11" ry="8.5" fill="#58a850" />
        <ellipse cx="10" cy="12" rx="3.5" ry="2.8" fill="#80c870" opacity="0.8" />
        <path d="M16 8 Q12 2 16 -1 Q20 2 16 8Z" fill="#3c8038" />
        <circle cx="12" cy="17" r="2" fill="#1a1208" />
        <circle cx="20" cy="17" r="2" fill="#1a1208" />
        <ellipse cx="16" cy="22" rx="3" ry="1.4" fill="#3c8038" opacity="0.7" />
      </svg>
    ),
    embercub: (
      <svg width={TILE} height={TILE * 0.85} viewBox="0 0 32 27">
        <ellipse cx="16" cy="25" rx="11" ry="2" fill="rgba(0,0,0,0.18)" />
        <ellipse cx="16" cy="16" rx="11" ry="9" fill="#f07838" />
        <ellipse cx="11" cy="12" rx="3.5" ry="3" fill="#f8a868" opacity="0.7" />
        <path d="M25 14 Q30 11 28 7 Q26 11 23 12Z" fill="#ffd040" />
        <path d="M26 13 Q29 11 28 9" fill="#ff8838" opacity="0.8" />
        <circle cx="12" cy="17" r="2" fill="#1a1208" />
        <circle cx="20" cy="17" r="2" fill="#1a1208" />
        <ellipse cx="16" cy="21" rx="2.5" ry="1.3" fill="#a83c18" opacity="0.6" />
      </svg>
    ),
  };

  return (
    <div
      onClick={onTap}
      style={{
        position: "absolute",
        left: px,
        top: py + TILE * 0.35,
        width: TILE,
        height: TILE * 0.85,
        cursor: "pointer",
        transition: "left 1.2s ease, top 1.2s ease, transform 0.15s ease",
        transform: `scaleY(${sq})`,
        zIndex: 4,
      }}
      title="A wild critter"
    >
      {ART[kind]}
    </div>
  );
}

function NpcSprite({ x, y, palette, onTap, active }) {
  const px = x * TILE;
  const py = y * TILE;
  return (
    <div
      onClick={onTap}
      style={{
        position: "absolute",
        left: px,
        top: py - TILE * 0.35,
        width: TILE,
        height: TILE * 1.35,
        cursor: "pointer",
        zIndex: 4,
        filter: active ? "drop-shadow(0 0 10px rgba(255,232,88,0.9))" : "none",
      }}
      title="Talk"
    >
      <svg width={TILE} height={TILE * 1.35} viewBox="0 0 32 44">
        <ellipse cx="16" cy="40" rx="9" ry="3" fill="rgba(0,0,0,0.3)" />
        <rect x="9" y="20" width="14" height="18" rx="4" fill={palette.robe} />
        <rect x="9" y="20" width="14" height="6" fill={palette.trim} opacity="0.85" />
        <rect x="10" y="6" width="12" height="12" rx="3" fill={palette.skin} />
        <path d="M9 9 Q16 -1 23 9 L23 13 Q16 6 9 13Z" fill={palette.trim} />
        <rect x="12.5" y="12" width="2.2" height="2.2" fill="#1a1208" />
        <rect x="17.5" y="12" width="2.2" height="2.2" fill="#1a1208" />
      </svg>
    </div>
  );
}

function PixelButton({ children, onClick, style, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: small ? 8 : 10,
        color: "#fffaf0",
        background: "#3098e8",
        border: "none",
        boxShadow: "0 0 0 2px #1c68a8, inset 0 -3px 0 rgba(0,0,0,0.25), inset 0 3px 0 rgba(255,255,255,0.15)",
        padding: small ? "6px 10px" : "10px 16px",
        cursor: "pointer",
        borderRadius: 2,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Tracks which Modal instances are currently mounted, in mount order, so
// that when modals are stacked (e.g. a project detail opened on top of the
// Arcade list), only the topmost one responds to keyboard input — otherwise
// a single keypress would affect every layer at once.
let modalStackCounter = 0;
const modalStack = [];

function Modal({ title, onClose, children, wide, onEnter, onArrowLeft, onArrowRight }) {
  const idRef = useRef(null);
  if (idRef.current === null) {
    idRef.current = ++modalStackCounter;
  }
  const bodyRef = useRef(null);

  useEffect(() => {
    modalStack.push(idRef.current);
    return () => {
      const i = modalStack.indexOf(idRef.current);
      if (i !== -1) modalStack.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    function onKey(e) {
      const isTop = modalStack[modalStack.length - 1] === idRef.current;
      if (!isTop) return;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "Enter":
          // Enter confirms/closes a modal by default unless the modal supplies
          // its own onEnter handler (e.g. a sub-flow that wants Enter to advance
          // a step instead of closing outright).
          e.preventDefault();
          if (onEnter) onEnter();
          else onClose();
          break;
        case "ArrowUp":
          // Up/Down always scroll the modal body — this is what makes long
          // case-study and resume text keyboard-navigable.
          e.preventDefault();
          if (bodyRef.current) bodyRef.current.scrollBy({ top: -64, behavior: "smooth" });
          break;
        case "ArrowDown":
          e.preventDefault();
          if (bodyRef.current) bodyRef.current.scrollBy({ top: 64, behavior: "smooth" });
          break;
        case "ArrowLeft":
          // Left/Right are free for the modal's own content to claim — used
          // by carousels (Gallery) and stat navigation (Tower).
          if (onArrowLeft) { e.preventDefault(); onArrowLeft(); }
          break;
        case "ArrowRight":
          if (onArrowRight) { e.preventDefault(); onArrowRight(); }
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onEnter, onArrowLeft, onArrowRight]);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(8,6,4,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        style={{
          width: wide ? "min(640px, 100%)" : "min(420px, 100%)",
          maxHeight: "85%",
          display: "flex",
          flexDirection: "column",
          background: "#1c2c44",
          border: "4px solid #3068a8",
          boxShadow: "0 0 0 4px #0c1828, inset 0 0 0 2px #264870",
          borderRadius: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "3px solid #3068a8",
            background: "#1c3050",
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#ffe858", margin: 0, letterSpacing: 0.5 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 10,
              color: "#fffaf0",
              background: "#e04848",
              border: "none",
              boxShadow: "0 0 0 2px #a02828",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            X
          </button>
        </div>
        {/* Scrollable body — isolated from the backdrop so mouse-wheel,
            trackpad, and Up/Down arrow-key scroll all reach this element. */}
        <div
          ref={bodyRef}
          tabIndex={-1}
          role="document"
          style={{
            padding: 16,
            color: "#f0ece0",
            fontFamily: "'VT323', monospace",
            fontSize: 16,
            lineHeight: 1.5,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Lets content nested inside a Modal (carousels, stat screens) claim Left/Right
// arrow keys for their own navigation, but only while no further modal has
// been stacked on top of their parent (e.g. a project detail opened from the
// Arcade list) — otherwise a deeper modal's controls could be shadowed by a
// carousel two layers down still listening.
/* ============================================================
   PROJECT CARD + DETAIL (Arcade — case studies only)
   ============================================================ */

function ProjectCard({ project, focused, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focused]);

  return (
    <button
      ref={ref}
      onClick={() => onSelect(project)}
      style={{
        textAlign: "left",
        background: project.featured ? "#284060" : "#203854",
        border: focused ? "2px solid #ffe858" : "2px solid #3068a8",
        boxShadow: focused ? "0 0 0 2px rgba(255,232,88,0.35)" : "none",
        borderRadius: 4,
        padding: 10,
        cursor: "pointer",
        color: "#f0ece0",
        fontFamily: "'VT323', monospace",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        width: "100%",
        outline: "none",
        transition: "border-color 0.1s, box-shadow 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: focused ? "#ffe858" : "#70c8ff" }}>
          {project.title}
        </span>
        {project.featured && <span style={{ fontSize: 11, color: "#ffe858" }}>★ FEATURED</span>}
      </div>
      <div style={{ fontSize: 13, color: "#c8c0a8" }}>{project.role} · {project.period}</div>
      <div style={{ fontSize: 15 }}>{project.blurb}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        {project.tags.map((t) => (
          <span key={t} style={{ fontSize: 10, fontFamily: "'Press Start 2P', monospace", background: "#142438", color: "#5cd87c", padding: "3px 6px", borderRadius: 2 }}>
            {t}
          </span>
        ))}
      </div>
    </button>
  );
}

// ArcadeContent receives all navigation callbacks from the parent Modal
// so there's exactly one keydown listener in the whole system.
function ArcadeContent({ focusIndex, onFocusPrev, onFocusNext, onSelectProject }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", margin: 0 }}>UX CASE STUDIES</h3>
        <span style={{ fontSize: 12, color: "#8a8270" }}>▲▼ navigate · Enter to open</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {CASE_STUDIES.map((p, i) => (
          <ProjectCard key={p.id} project={p} focused={i === focusIndex} onSelect={onSelectProject} />
        ))}
      </div>
    </div>
  );
}

function ProjectDetail({ project, onClose }) {
  return (
    <Modal title={project.title} onClose={onClose} wide>
      <div style={{ marginBottom: 4, color: "#70c8ff" }}>{project.role}</div>
      <div style={{ marginBottom: 14, fontSize: 13, color: "#8a8270" }}>{project.period}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {project.tags.map((t) => (
          <span key={t} style={{ fontSize: 10, fontFamily: "'Press Start 2P', monospace", background: "#142438", color: "#5cd87c", padding: "4px 7px", borderRadius: 2 }}>
            {t}
          </span>
        ))}
      </div>

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#f04830", marginBottom: 6 }}>PROBLEM</h3>
      <p style={{ marginBottom: 16 }}>{project.problem}</p>

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#70c8ff", marginBottom: 6 }}>APPROACH</h3>
      <p style={{ marginBottom: 16 }}>{project.approach}</p>

      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#5cd87c", marginBottom: 6 }}>OUTCOME</h3>
      <p style={{ marginBottom: 18 }}>{project.outcome}</p>

      {project.link ? (
        <a href={project.link} target="_blank" rel="noopener noreferrer">
          <PixelButton small>VIEW FULL CASE STUDY →</PixelButton>
        </a>
      ) : (
        <div style={{ fontSize: 13, color: "#c8c0a8" }}>Full case study coming soon to danielvisual.com</div>
      )}
    </Modal>
  );
}

/* ============================================================
   GALLERY (Visual / Play projects) — swipeable
   ============================================================ */

function GalleryContent({ index, onPrev, onNext }) {
  const project = VISUAL_PROJECTS[index];

  const touchStartX = useRef(null);
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 40) onPrev();
    else if (dx < -40) onNext();
    touchStartX.current = null;
  }

  return (
    <div>
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 10 }}>
        BRANDING &amp; CAMPAIGN WORK
      </h3>
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          background: "#203854",
          border: "2px solid #3068a8",
          borderRadius: 4,
          padding: 20,
          textAlign: "center",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#e858a8" }}>{project.title}</div>
        <div style={{ fontSize: 12, color: "#8a8270" }}>{project.period}</div>
        <p style={{ fontSize: 15, margin: 0 }}>{project.blurb}</p>
        <div style={{ background: "#142438", border: "1px solid #3068a8", borderRadius: 4, padding: "8px 12px" }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#5cd87c" }}>HIGHLIGHT: </span>
          <span style={{ fontSize: 14 }}>{project.emphasis}</span>
        </div>
        <a href={project.link} target="_blank" rel="noopener noreferrer">
          <PixelButton small style={{ background: "#e858a8", boxShadow: "0 0 0 2px #a8307c", margin: "0 auto" }}>
            VIEW ON DANIELVISUAL.COM →
          </PixelButton>
        </a>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <PixelButton small onClick={onPrev}>◀ PREV</PixelButton>
        <div style={{ display: "flex", gap: 6 }}>
          {VISUAL_PROJECTS.map((_, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === index ? "#ffe858" : "#3068a8", display: "inline-block" }} />
          ))}
        </div>
        <PixelButton small onClick={onNext}>NEXT ▶</PixelButton>
      </div>
      <p style={{ fontSize: 12, color: "#8a8270", marginTop: 10, fontStyle: "italic" }}>
        ◀ ▶ arrow keys, swipe, or the buttons to browse. Full work lives on danielvisual.com.
      </p>
    </div>
  );
}

/* ============================================================
   ZONE CONTENT (modal bodies per building)
   ============================================================ */

function HouseContent() {
  return (
    <div>
      <p style={{ marginBottom: 14, color: "#ffe858", fontFamily: "'Press Start 2P', monospace", fontSize: 9 }}>
        {PROFILE.name.toUpperCase()}
      </p>
      <p style={{ marginBottom: 14 }}>{ABOUT.highlight}</p>
      {ABOUT.bio.map((p, i) => (
        <p key={i} style={{ marginBottom: 12 }}>{p}</p>
      ))}
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#70c8ff", margin: "16px 0 8px" }}>EDUCATION</h3>
      {ABOUT.education.map((e, i) => <p key={i} style={{ fontSize: 14 }}>{e}</p>)}
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#5cd87c", margin: "16px 0 8px" }}>RECOGNITION</h3>
      {ABOUT.recognition.map((r, i) => <p key={i} style={{ fontSize: 14 }}>{r}</p>)}
      <p style={{ marginTop: 16, fontSize: 12, color: "#8a8270", fontStyle: "italic" }}>
        The Village Elder, standing nearby, is happy to tell you more — just walk up and talk.
      </p>
    </div>
  );
}

function TowerContent({ index, animKey, onPrev, onNext }) {
  const skill = SKILLS[index];

  return (
    <div>
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 14, textAlign: "center" }}>
        CHARACTER STATS
      </h3>

      {/* Profile header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, justifyContent: "center" }}>
        <svg width="48" height="64" viewBox="0 0 32 46">
          <rect x="9" y="18" width="14" height="14" rx="3" fill="#3098e8" />
          <rect x="11" y="30" width="4" height="8" fill="#264858" />
          <rect x="17" y="30" width="4" height="8" fill="#264858" />
          <rect x="9.5" y="4" width="13" height="13" rx="4" fill="#f0c89c" />
          <path d="M8.5 8 Q16 -2 23.5 8 L23.5 11 Q16 5 8.5 11Z" fill="#283848" />
          <rect x="8.5" y="6.5" width="15" height="4" rx="2" fill="#3098e8" />
          <rect x="12" y="11" width="2.2" height="2.2" fill="#1a1208" />
          <rect x="17.8" y="11" width="2.2" height="2.2" fill="#1a1208" />
        </svg>
        <div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#fffaf0" }}>{PROFILE.name}</div>
          <div style={{ fontSize: 13, color: "#8a8270" }}>{PROFILE.title}</div>
        </div>
      </div>

      {/* Single animated stat card — key prop drives re-animation on nav */}
      <div
        key={animKey}
        style={{
          background: "#142438",
          border: "2px solid #3068a8",
          borderRadius: 6,
          padding: 18,
          textAlign: "center",
          animation: "statSlideIn 0.35s ease-out",
        }}
      >
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#70c8ff", marginBottom: 10 }}>
          {skill.name}
        </div>
        <div style={{ height: 16, background: "#0c1828", border: "2px solid #3068a8", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
          <div
            style={{
              height: "100%",
              width: `${(skill.level / 5) * 100}%`,
              background: "linear-gradient(to right, #3f9e5c, #5cd87c)",
              animation: "statBarFill 0.6s ease-out",
            }}
          />
        </div>
        <div style={{ color: "#ffe858", fontSize: 16, marginBottom: 10 }}>{"★".repeat(skill.level)}{"☆".repeat(5 - skill.level)}</div>
        <p style={{ fontSize: 14, color: "#c8c0a8", margin: 0 }}>{skill.desc}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <PixelButton small onClick={onPrev}>◀ PREV</PixelButton>
        <div style={{ fontSize: 13, color: "#8a8270" }}>{index + 1} / {SKILLS.length}</div>
        <PixelButton small onClick={onNext}>NEXT ▶</PixelButton>
      </div>
      <p style={{ fontSize: 12, color: "#8a8270", marginTop: 10, fontStyle: "italic", textAlign: "center" }}>
        ◀ ▶ arrow keys or the buttons to browse stats.
      </p>
      <style>{`
        @keyframes statSlideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes statBarFill { from { width: 0; } }
      `}</style>
    </div>
  );
}

function LibraryContent() {
  return (
    <div>
      <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 14 }}>
        QUEST LOG — EXPERIENCE
      </h3>
      <div style={{ display: "grid", gap: 16 }}>
        {EXPERIENCE.map((e, i) => (
          <div key={i} style={{ borderLeft: "3px solid #3068a8", paddingLeft: 12 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#70c8ff" }}>{e.role}</div>
            <div style={{ color: "#ffe858", fontSize: 15 }}>{e.org} <span style={{ color: "#8a8270", fontSize: 13 }}>— {e.sub}</span></div>
            <div style={{ fontSize: 12, color: "#8a8270", marginBottom: 6 }}>{e.period}</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {e.bullets.map((b, j) => <li key={j} style={{ fontSize: 14, marginBottom: 4 }}>{b}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostContent() {
  const [chosen, setChosen] = useState(null);

  const ROUTES = [
    {
      id: "linkedin",
      label: "LinkedIn",
      desc: "Connect professionally and see his full work history.",
      href: PROFILE.linkedin,
      color: "#3098e8",
      shadow: "#1c68a8",
    },
    {
      id: "email",
      label: "Email",
      desc: "Drop a direct message — he'll get back to you.",
      href: `mailto:${PROFILE.email}`,
      color: "#e8b830",
      shadow: "#a87c10",
    },
    {
      id: "dribbble",
      label: "Dribbble",
      desc: "Browse his visual and interaction design work.",
      href: PROFILE.dribbble,
      color: "#e858a8",
      shadow: "#a8307c",
    },
    {
      id: "site",
      label: "danielvisual.com",
      desc: "The full portfolio site, case studies and all.",
      href: PROFILE.site,
      color: "#30c890",
      shadow: "#1c8860",
    },
  ];

  if (!chosen) {
    return (
      <div>
        <p style={{ marginBottom: 18, fontSize: 16 }}>Send word, traveler. Choose your route:</p>
        <div style={{ display: "grid", gap: 12 }}>
          {ROUTES.map((r) => (
            <button
              key={r.id}
              onClick={() => setChosen(r)}
              style={{
                background: "#142438",
                border: `3px solid ${r.color}`,
                borderRadius: 8,
                padding: "16px 18px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: r.color, marginBottom: 6 }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 14, color: "#c8c0a8" }}>{r.desc}</div>
              </div>
              <div style={{ fontSize: 20, color: r.color }}>▶</div>
            </button>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: "#8a8270", fontStyle: "italic" }}>
          The Courier, standing nearby, has a clue if you'd rather discover this the long way.
        </p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: chosen.color, marginBottom: 14 }}>
        ▸ DEPARTING VIA {chosen.label.toUpperCase()}
      </div>
      <p style={{ fontSize: 16, marginBottom: 20 }}>{chosen.desc}</p>
      <a href={chosen.href} target={chosen.id === "email" ? undefined : "_blank"} rel="noopener noreferrer">
        <PixelButton style={{ background: chosen.color, boxShadow: `0 0 0 2px ${chosen.shadow}` }}>
          CONTINUE →
        </PixelButton>
      </a>
      <div style={{ marginTop: 18 }}>
        <PixelButton small onClick={() => setChosen(null)} style={{ background: "#203854", boxShadow: "0 0 0 2px #3068a8" }}>
          ← CHOOSE ANOTHER ROUTE
        </PixelButton>
      </div>
    </div>
  );
}

/* ============================================================
   NPC DIALOGUE — branching
   ============================================================ */

const NPC_RESPONSES = {
  approach: "He treats every project like a system: research the real behavior, question the brief, then design and test the smallest change that moves the metric.",
  highlight: "Most recently, leading product design at Doctronic — shipping the first AI-authorized prescription refill flow in the US, covered by the Washington Post, Politico, and the Salt Lake Tribune.",
  education: "UC Davis for a B.A. in Media Technology and Chinese, then General Assembly's Product Design program and a UX Design course at Udacity to sharpen the craft.",
  clue: "The Courier leans in: \"Seek the building with the golden roof and the flag flying high near its chimney. Knock there, and the way to reach him will be revealed.\"",
  reveal: `The Courier grins. "Smart traveler — you found it! Head into the Post Office to connect. You'll find all the routes to reach Daniel there. Safe travels."`,
};

function NpcDialogue({ npc, onClose }) {
  const [chosen, setChosen] = useState(null);

  return (
    <Modal title={npc.name} onClose={onClose}>
      <p style={{ marginBottom: 16, color: "#70c8ff" }}>{npc.intro}</p>
      {!chosen ? (
        <div style={{ display: "grid", gap: 8 }}>
          {npc.branches.map((b) => (
            <PixelButton key={b.label} small style={{ textAlign: "left" }} onClick={() => setChosen(b)}>
              ▸ {b.label}
            </PixelButton>
          ))}
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: 16, background: "#203854", border: "2px solid #3068a8", borderRadius: 4, padding: 12 }}>
            {NPC_RESPONSES[chosen.response]}
          </p>
          <PixelButton small onClick={() => setChosen(null)}>← ASK SOMETHING ELSE</PixelButton>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   TITLE SCREEN + CHARACTER SELECT
   ============================================================ */


/* ============================================================
   TITLE SCREEN + CHARACTER SELECT — vibrant, descriptive
   ============================================================ */

function TitleScreen({ onContinue }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  // Mini walking trainer sprite (simplified, for animation)
  function MiniTrainer({ color, y, duration, delay, flip }) {
    return (
      <div style={{
        position: "absolute",
        top: `${y}%`,
        left: flip ? "110%" : "-10%",
        animation: `${flip ? "walkLeft" : "walkRight"} ${duration}s linear ${delay}s infinite`,
        pointerEvents: "none",
      }}>
        <svg width="24" height="32" viewBox="0 0 32 46"
          style={{ transform: flip ? "scaleX(-1)" : "none" }}>
          <rect x="10.5" y="36" width="5" height="4" rx="1" fill="#283848" />
          <rect x="16.5" y="36" width="5" height="4" rx="1" fill="#283848" />
          <rect x="11" y="28" width="4.5" height="9" fill="#e0e0e0" />
          <rect x="16.5" y="28" width="4.5" height="9" fill="#e0e0e0" />
          <rect x="8" y="16" width="16" height="13" rx="3" fill={color} />
          <rect x="5.5" y="18" width="4.5" height="9" rx="2" fill={color} />
          <rect x="22" y="18" width="4.5" height="9" rx="2" fill={color} />
          <rect x="9.5" y="4" width="13" height="13" rx="4" fill="#f0c89c" />
          <rect x="8.5" y="6.5" width="15" height="4" rx="2" fill={color} />
        </svg>
      </div>
    );
  }

  function MiniCritter({ kind, y, duration, delay, flip }) {
    const art = {
      glowpup: (
        <svg width="20" height="16" viewBox="0 0 32 22">
          <path d="M3 18 Q1 6 16 6 Q31 6 29 18 Q29 21 16 21 Q3 21 3 18Z" fill="#f0d850" />
          <circle cx="12" cy="14" r="1.6" fill="#1a1208" />
          <circle cx="20" cy="14" r="1.6" fill="#1a1208" />
        </svg>
      ),
      inkdrop: (
        <svg width="16" height="20" viewBox="0 0 32 27">
          <path d="M16 2 Q26 14 24 20 Q22 26 16 26 Q10 26 8 20 Q6 14 16 2Z" fill="#5090e0" />
          <circle cx="16" cy="17" r="3.5" fill="#fff" />
          <circle cx="16" cy="17" r="2" fill="#1a1208" />
        </svg>
      ),
      sproutling: (
        <svg width="20" height="18" viewBox="0 0 32 27">
          <ellipse cx="16" cy="17" rx="11" ry="8.5" fill="#58a850" />
          <path d="M16 8 Q12 2 16 -1 Q20 2 16 8Z" fill="#3c8038" />
          <circle cx="12" cy="17" r="1.6" fill="#1a1208" />
          <circle cx="20" cy="17" r="1.6" fill="#1a1208" />
        </svg>
      ),
      embercub: (
        <svg width="20" height="18" viewBox="0 0 32 27">
          <ellipse cx="15" cy="16" rx="11" ry="9" fill="#f07838" />
          <path d="M25 14 Q30 11 28 7 Q26 11 23 12Z" fill="#ffd040" />
          <circle cx="12" cy="17" r="1.6" fill="#1a1208" />
          <circle cx="19" cy="17" r="1.6" fill="#1a1208" />
        </svg>
      ),
    };
    return (
      <div style={{
        position: "absolute",
        top: `${y}%`,
        left: flip ? "110%" : "-8%",
        animation: `${flip ? "walkLeft" : "walkRight"} ${duration}s linear ${delay}s infinite`,
        pointerEvents: "none",
      }}>
        <div style={{ transform: flip ? "scaleX(-1)" : "none" }}>
          {art[kind]}
        </div>
      </div>
    );
  }

  function MiniNpc({ y, duration, delay, flip }) {
    return (
      <div style={{
        position: "absolute",
        top: `${y}%`,
        left: flip ? "110%" : "-10%",
        animation: `${flip ? "walkLeft" : "walkRight"} ${duration}s linear ${delay}s infinite`,
        pointerEvents: "none",
      }}>
        <svg width="22" height="30" viewBox="0 0 32 44"
          style={{ transform: flip ? "scaleX(-1)" : "none" }}>
          <rect x="9" y="20" width="14" height="18" rx="4" fill="#c89030" />
          <rect x="9" y="20" width="14" height="6" fill="#ffe858" opacity="0.8" />
          <rect x="10" y="6" width="12" height="12" rx="3" fill="#f0c89c" />
          <path d="M9 9 Q16 -1 23 9 L23 13 Q16 6 9 13Z" fill="#ffe858" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #1c1030 0%, #2c2048 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Press Start 2P', monospace",
        color: "#f0ece0",
        gap: 16,
        position: "relative",
        overflow: "hidden",
        borderRadius: 6,
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      {/* CRT scanlines */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)" }} />

      {/* Animated game-preview sprites walking behind the UI */}
      <MiniTrainer color="#3098e8" y={72} duration={12} delay={0} flip={false} />
      <MiniTrainer color="#f04830" y={83} duration={9} delay={3} flip={true} />
      <MiniTrainer color="#a858e0" y={78} duration={14} delay={6} flip={false} />
      <MiniCritter kind="glowpup" y={75} duration={7} delay={1} flip={false} />
      <MiniCritter kind="inkdrop" y={85} duration={10} delay={5} flip={true} />
      <MiniCritter kind="sproutling" y={80} duration={8} delay={2} flip={true} />
      <MiniCritter kind="embercub" y={70} duration={11} delay={8} flip={false} />
      <MiniNpc y={76} duration={16} delay={4} flip={true} />

      <style>{`
        @keyframes walkRight { 0% { left: -15%; } 100% { left: 115%; } }
        @keyframes walkLeft  { 0% { left: 115%; } 100% { left: -15%; } }
      `}</style>

      <h1 style={{
        fontSize: "clamp(20px, 4.5vw, 34px)", letterSpacing: 3, zIndex: 1,
        textAlign: "center", color: "#3ee0d8",
        textShadow: "0 0 12px rgba(62,224,216,0.5)",
      }}>
        {PROFILE.name.toUpperCase()}
      </h1>
      <p style={{ fontSize: "clamp(10px, 1.8vw, 13px)", color: "#ffe858", zIndex: 1, letterSpacing: 1 }}>
        LEAD PRODUCT DESIGNER · INTERACTION · VISUAL ARTS
      </p>

      <div style={{
        zIndex: 1,
        background: "rgba(12,8,24,0.75)",
        border: "2px solid #4a3a70",
        borderRadius: 6,
        padding: "22px 26px",
        maxWidth: 460,
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: "clamp(13px, 2.4vw, 17px)", color: "#f0ece0", marginBottom: 16, letterSpacing: 1 }}>
          {GAME_SUBTITLE_LINE}
        </h2>
        <p style={{ fontFamily: "'VT323', monospace", fontSize: 18, lineHeight: 1.5, margin: "0 0 20px", color: "#c8bcd8" }}>
          {GAME_DESCRIPTION}
        </p>

        <button
          onClick={onContinue}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(11px, 2.2vw, 14px)",
            color: "#0a0e1a",
            background: "#3ee0d8",
            border: "none",
            boxShadow: "0 4px 0 #1c8078",
            padding: "14px 30px",
            cursor: "pointer",
            borderRadius: 3,
            marginBottom: 14,
          }}
        >
          PRESS START
        </button>

        <div style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: "#6878a0", letterSpacing: 1 }}>
          ▸ PRESS ENTER OR SPACE
        </div>
      </div>
    </div>
  );
}

function TrainerPreview({ sprite }) {
  const p = CHAR_PALETTES[sprite];
  return (
    <svg width="56" height="76" viewBox="0 0 32 46">
      <ellipse cx="16" cy="42" rx="9" ry="3" fill="rgba(0,0,0,0.22)" />
      <rect x="10.5" y="36" width="5" height="4" rx="1" fill={p.shoe} />
      <rect x="16.5" y="36" width="5" height="4" rx="1" fill={p.shoe} />
      <rect x="11" y="29" width="4.5" height="9" fill={p.legs} />
      <rect x="16.5" y="29" width="4.5" height="9" fill={p.legs} />
      <rect x="8" y="16" width="16" height="14" rx="3" fill={p.shirt} />
      <rect x="8" y="16" width="16" height="6" fill={p.shirtLight} opacity="0.85" />
      <rect x="5.5" y="18" width="4.5" height="10" rx="2" fill={p.shirt} />
      <rect x="22" y="18" width="4.5" height="10" rx="2" fill={p.shirt} />
      <rect x="9.5" y="4" width="13" height="13" rx="4" fill={p.skin} />
      <path d="M8.5 8 Q16 -2 23.5 8 L23.5 11 Q16 5 8.5 11Z" fill={p.hair} />
      <rect x="8.5" y="6.5" width="15" height="4" rx="2" fill={p.cap} />
      <rect x="14" y="3" width="4" height="3" rx="1" fill={p.capAccent} />
      <rect x="12" y="11" width="2.2" height="2.2" fill="#1a1208" />
      <rect x="17.8" y="11" width="2.2" height="2.2" fill="#1a1208" />
    </svg>
  );
}

function CharacterSelect({ onSelect }) {
  const [hoverIndex, setHoverIndex] = useState(0);
  const active = CHARACTERS[hoverIndex];

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setHoverIndex((i) => (i - 1 + CHARACTERS.length) % CHARACTERS.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setHoverIndex((i) => (i + 1) % CHARACTERS.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(CHARACTERS[hoverIndex]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hoverIndex, onSelect]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #2c2048 0%, #402c60 60%, #503080 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        position: "relative",
        borderRadius: 6,
        padding: 22,
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(11px, 2.2vw, 15px)",
          color: "#ffe858",
          margin: 0,
          textAlign: "center",
          textShadow: "2px 2px 0 #1c1030",
        }}
      >
        CHOOSE YOUR HIRING PANEL MEMBER
      </h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {CHARACTERS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            onMouseEnter={() => setHoverIndex(i)}
            style={{
              background: hoverIndex === i ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.2)",
              border: hoverIndex === i ? `3px solid ${c.color}` : "3px solid rgba(255,255,255,0.25)",
              borderRadius: 8,
              padding: 14,
              cursor: "pointer",
              width: 134,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            <TrainerPreview sprite={c.sprite} />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#fffaf0" }}>{c.name}</div>
            <div style={{ fontSize: 9, color: c.color, fontFamily: "'Press Start 2P', monospace", textAlign: "center" }}>{c.role}</div>
          </button>
        ))}
      </div>
      <div
        style={{
          background: "rgba(12,8,24,0.6)",
          border: "3px solid #fffaf0",
          borderRadius: 6,
          padding: 12,
          maxWidth: 460,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <p style={{ fontFamily: "'VT323', monospace", fontSize: 16, color: "#f0ece0", margin: 0 }}>{active.bio}</p>
      </div>
      <p style={{ fontSize: 11, color: "#c8bcd8", fontFamily: "'VT323', monospace" }}>◀ ▶ to choose, ENTER or SPACE to confirm — or just tap a character.</p>
    </div>
  );
}

/* ============================================================
   MAIN GAME COMPONENT
   ============================================================ */



/* ============================================================
   ENDING SCREEN — thanks for playing, celebrating sprite, credits
   ============================================================ */

function CelebratingHero({ palette }) {
  const p = palette || CHAR_PALETTES.systems;
  return (
    <svg width="64" height="84" viewBox="0 0 32 46" style={{ animation: "celebrate 0.6s ease-in-out infinite" }}>
      <ellipse cx="16" cy="42" rx="9" ry="3" fill="rgba(0,0,0,0.25)" />
      <rect x="10.5" y="34" width="5" height="4" rx="1" fill={p.shoe} />
      <rect x="16.5" y="34" width="5" height="4" rx="1" fill={p.shoe} />
      <rect x="11" y="27" width="4.5" height="9" fill={p.legs} />
      <rect x="16.5" y="27" width="4.5" height="9" fill={p.legs} />
      <rect x="8" y="14" width="16" height="14" rx="3" fill={p.shirt} />
      <rect x="8" y="14" width="16" height="6" fill={p.shirtLight} opacity="0.85" />
      {/* arms raised up in celebration */}
      <rect x="2" y="2" width="4.5" height="14" rx="2" fill={p.shirt} transform="rotate(-20 4 9)" />
      <rect x="25.5" y="2" width="4.5" height="14" rx="2" fill={p.shirt} transform="rotate(20 28 9)" />
      <rect x="9.5" y="2" width="13" height="13" rx="4" fill={p.skin} />
      <path d="M8.5 6 Q16 -4 23.5 6 L23.5 9 Q16 3 8.5 9Z" fill={p.hair} />
      <rect x="8.5" y="4.5" width="15" height="4" rx="2" fill={p.cap} />
      <rect x="14" y="1" width="4" height="3" rx="1" fill={p.capAccent} />
      <path d="M11 8 Q13 10 15 8" stroke="#1a1208" strokeWidth="1.4" fill="none" />
      <path d="M17 8 Q19 10 21 8" stroke="#1a1208" strokeWidth="1.4" fill="none" />
      <style>{`@keyframes celebrate { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-6px) rotate(2deg); } }`}</style>
    </svg>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 14 }, (_, i) => ({
    left: (i * 71) % 100,
    delay: (i * 0.27) % 2,
    color: ["#ffe858", "#3ee0d8", "#f04830", "#a858e0", "#5cd87c"][i % 5],
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-10%",
            width: 6,
            height: 6,
            background: p.color,
            animation: `confettiFall 2.6s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(420px) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}

const CREDITS_LINES = [
  "DESIGN QUEST",
  "",
  "Made by Daniel Tieu",
  "danielvisual.com",
  "",
  "Lead Product Designer",
  "Doctronic · GoodRx · Estée Lauder",
  "Amyris · Sephora",
  "",
  "Thanks for playing!",
  "",
  "See you again soon.",
];

function EndingScreen({ palette, onReturnToTitle }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onReturnToTitle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReturnToTitle]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        background: "linear-gradient(180deg, #1c1030 0%, #2c2048 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: 6,
        boxSizing: "border-box",
      }}
    >
      {/* Top portion: celebrating character + confetti */}
      <div style={{ position: "relative", width: "100%", height: "38%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Confetti />
        <CelebratingHero palette={palette} />
      </div>

      <h2
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(13px, 2.6vw, 18px)",
          color: "#ffe858",
          margin: "4px 0 12px",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        THANKS FOR PLAYING!
      </h2>

      {/* Scrolling credits */}
      <div
        style={{
          position: "relative",
          flex: 1,
          width: "100%",
          overflow: "hidden",
          maskImage: "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            top: "100%",
            animation: "scrollCredits 14s linear infinite",
            fontFamily: "'VT323', monospace",
            textAlign: "center",
            color: "#f0ece0",
          }}
        >
          {CREDITS_LINES.map((line, i) => (
            <div key={i} style={{ fontSize: line === "DESIGN QUEST" ? 22 : 17, color: line === "DESIGN QUEST" ? "#3ee0d8" : "#f0ece0", margin: "10px 0" }}>
              {line || "\u00A0"}
            </div>
          ))}
        </div>
        <style>{`@keyframes scrollCredits { 0% { top: 100%; } 100% { top: -220%; } }`}</style>
      </div>

      <button
        onClick={onReturnToTitle}
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(10px, 2vw, 13px)",
          color: "#0a0e1a",
          background: "#3ee0d8",
          border: "none",
          boxShadow: "0 4px 0 #1c8078",
          padding: "12px 26px",
          cursor: "pointer",
          borderRadius: 3,
          marginBottom: 22,
          zIndex: 1,
        }}
      >
        RETURN TO MAIN MENU
      </button>
      <div style={{ fontFamily: "'VT323', monospace", fontSize: 12, color: "#6878a0", marginBottom: 16, zIndex: 1 }}>
        ▸ PRESS ENTER OR SPACE
      </div>
    </div>
  );
}


export default function PortfolioGame() {
  const [phase, setPhase] = useState("title"); // title -> select -> playing -> ending
  const [character, setCharacter] = useState(null);
  const [pos, setPos] = useState(START_POS);
  const [dir, setDir] = useState("down");
  const [walking, setWalking] = useState(false);
  const [activeZone, setActiveZone] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeNpc, setActiveNpc] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [critters, setCritters] = useState(CRITTER_SPAWN.map((c) => ({ ...c, bounce: false })));
  const [critterQuip, setCritterQuip] = useState(null);
  const [approachPopup, setApproachPopup] = useState(null);
  const walkTimeout = useRef(null);
  const popupTimeout = useRef(null);
  const viewportRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Zone-level navigation state — lives here so Modal props can reference it
  // without any secondary keydown listeners competing with Modal's own handler.
  const [arcadeFocus, setArcadeFocus] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [towerIndex, setTowerIndex] = useState(0);
  const [towerAnimKey, setTowerAnimKey] = useState(0);

  const galleryPrev = useCallback(() => setGalleryIndex((i) => (i - 1 + VISUAL_PROJECTS.length) % VISUAL_PROJECTS.length), []);
  const galleryNext = useCallback(() => setGalleryIndex((i) => (i + 1) % VISUAL_PROJECTS.length), []);
  const towerPrev = useCallback(() => { setTowerIndex((i) => (i - 1 + SKILLS.length) % SKILLS.length); setTowerAnimKey((k) => k + 1); }, []);
  const towerNext = useCallback(() => { setTowerIndex((i) => (i + 1) % SKILLS.length); setTowerAnimKey((k) => k + 1); }, []);
  const arcadePrev = useCallback(() => setArcadeFocus((i) => (i - 1 + CASE_STUDIES.length) % CASE_STUDIES.length), []);
  const arcadeNext = useCallback(() => setArcadeFocus((i) => (i + 1) % CASE_STUDIES.length), []);
  const arcadeEnter = useCallback(() => setSelectedProject(CASE_STUDIES[arcadeFocus]), [arcadeFocus]);

  const anyModalOpen = !!(activeZone || selectedProject || activeNpc || menuOpen);

  // Track the window size — this is what drives tileScale.
  // We use window dimensions rather than the viewport div so the scale is
  // correct even before the game viewport div mounts (title/select screens).
  // The viewport div's measured size is kept separately only for camera clamping.
  useEffect(() => {
    function onResize() {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const nearestBuilding = useCallback((p) => {
    for (const b of BUILDINGS) {
      const d = doorTile(b);
      const dist = Math.abs(d.x - p.x) + Math.abs(d.y - p.y);
      if (dist <= 1) return b;
    }
    return null;
  }, []);

  const nearestNpc = useCallback((p) => {
    for (const n of NPCS) {
      const dist = Math.abs(n.x - p.x) + Math.abs(n.y - p.y);
      if (dist <= 1) return n;
    }
    return null;
  }, []);

  const [nearBuilding, setNearBuilding] = useState(null);
  const [nearNpc, setNearNpc] = useState(null);

  useEffect(() => {
    const b = nearestBuilding(pos);
    const n = nearestNpc(pos);
    setNearBuilding(b);
    setNearNpc(n);

    // Trigger a brief name popup the moment the player newly approaches
    const newTarget = n ? { kind: "npc", label: n.name } : b ? { kind: "building", label: `${b.label} — ${b.sub}` } : null;
    if (newTarget) {
      setApproachPopup(newTarget);
      clearTimeout(popupTimeout.current);
      popupTimeout.current = setTimeout(() => setApproachPopup(null), 2200);
    }
  }, [pos, nearestBuilding, nearestNpc]);

  const isBlocked = useCallback((x, y) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return true;
    for (const b of BUILDINGS) {
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true;
    }
    for (const t of TREES) if (t.x === x && t.y === y) return true;
    for (const m of MOUNTAINS) {
      if (y === m.y && x >= m.x && x < m.x + m.w) return true;
    }
    for (const r of ROCKS) if (r.x === x && r.y === y) return true;
    for (const n of NPCS) if (n.x === x && n.y === y) return true;
    return false;
  }, []);

  const move = useCallback(
    (dx, dy, newDir) => {
      setDir(newDir);
      setPos((p) => {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (isBlocked(nx, ny)) return p;
        return { x: nx, y: ny };
      });
      setWalking(true);
      clearTimeout(walkTimeout.current);
      walkTimeout.current = setTimeout(() => setWalking(false), 150);
    },
    [isBlocked]
  );

  const interact = useCallback(() => {
    if (anyModalOpen) return;
    if (nearNpc) { setActiveNpc(nearNpc); return; }
    if (nearBuilding) { setActiveZone(nearBuilding.id); return; }
  }, [anyModalOpen, nearNpc, nearBuilding]);

  // gentle critter wander
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setCritters((prev) =>
        prev.map((c) => {
          const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
          const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
          let nx = c.x + dx;
          let ny = c.y + dy;
          if (isBlocked(nx, ny) || nx < 1 || ny < 1 || nx > COLS - 2 || ny > ROWS - 2) {
            nx = c.x;
            ny = c.y;
          }
          return { ...c, x: nx, y: ny };
        })
      );
    }, 1800);
    return () => clearInterval(interval);
  }, [phase, isBlocked]);

  const tapCritter = useCallback((id) => {
    setCritters((prev) => prev.map((c) => (c.id === id ? { ...c, bounce: true } : c)));
    setCritterQuip(CRITTER_QUIPS[Math.floor(Math.random() * CRITTER_QUIPS.length)]);
    setTimeout(() => {
      setCritters((prev) => prev.map((c) => (c.id === id ? { ...c, bounce: false } : c)));
    }, 200);
    setTimeout(() => setCritterQuip(null), 2200);
  }, []);

  // Movement + interaction keys — arrows only (no WASD), Enter/Space to interact, M for menu
  useEffect(() => {
    if (phase !== "playing") return;
    function onKey(e) {
      if (anyModalOpen) return;
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); move(0, -1, "up"); break;
        case "ArrowDown": e.preventDefault(); move(0, 1, "down"); break;
        case "ArrowLeft": e.preventDefault(); move(-1, 0, "left"); break;
        case "ArrowRight": e.preventDefault(); move(1, 0, "right"); break;
        case "Enter": case " ": e.preventDefault(); interact(); break;
        case "m": case "M": setMenuOpen((s) => !s); break;
        default: break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, move, interact, anyModalOpen]);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  function restartGame() {
    setPos(START_POS);
    setDir("down");
    setActiveZone(null);
    setSelectedProject(null);
    setActiveNpc(null);
    setMenuOpen(false);
    setCritters(CRITTER_SPAWN.map((c) => ({ ...c, bounce: false })));
    setPhase("select");
  }

  function exitGame() {
    setMenuOpen(false);
    setPhase("ending");
  }

  function returnToTitle() {
    setPos(START_POS);
    setDir("down");
    setCharacter(null);
    setActiveZone(null);
    setSelectedProject(null);
    setActiveNpc(null);
    setMenuOpen(false);
    setPhase("title");
  }

  const palette = character ? CHAR_PALETTES[character.sprite] : CHAR_PALETTES.systems;

  const zoneContent = {
    arcade: <ArcadeContent focusIndex={arcadeFocus} onFocusPrev={arcadePrev} onFocusNext={arcadeNext} onSelectProject={setSelectedProject} />,
    house: <HouseContent />,
    tower: <TowerContent index={towerIndex} animKey={towerAnimKey} onPrev={towerPrev} onNext={towerNext} />,
    library: <LibraryContent />,
    post: <PostContent />,
    gallery: <GalleryContent index={galleryIndex} onPrev={galleryPrev} onNext={galleryNext} />,
  };

  // Per-zone keyboard wiring — all routed through Modal's single listener
  const zoneArrowLeft  = { arcade: arcadePrev,  gallery: galleryPrev, tower: towerPrev  };
  const zoneArrowRight = { arcade: arcadeNext,  gallery: galleryNext, tower: towerNext  };
  const zoneEnter      = { arcade: arcadeEnter };

  const zoneTitle = {
    arcade: "ARCADE — UX CASE STUDIES",
    house: "COTTAGE — ABOUT",
    tower: "TOWER — SKILLS",
    library: "LIBRARY — RESUME",
    post: "POST OFFICE — CONTACT",
    gallery: "GALLERY — BRANDING & CAMPAIGNS",
  };

  if (phase === "title") {
    return (
      <div style={{ width: "100vw", height: "100dvh" }}>
        <TitleScreen onContinue={() => setPhase("select")} />
      </div>
    );
  }
  if (phase === "select") {
    return (
      <div style={{ width: "100vw", height: "100dvh" }}>
        <CharacterSelect
          onSelect={(c) => {
            setCharacter(c);
            setPhase("playing");
          }}
        />
      </div>
    );
  }
  if (phase === "ending") {
    return (
      <div style={{ width: "100vw", height: "100dvh" }}>
        <EndingScreen palette={palette} onReturnToTitle={returnToTitle} />
      </div>
    );
  }

  // Separate state for the game viewport div's actual pixel size.
  // Used for camera clamping — needs to be the div dimensions, not window,
  // since the HUD and padding reduce the available game area.
  const [vpDivSize, setVpDivSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (phase !== "playing" || !viewportRef.current) return;
    const el = viewportRef.current;
    function measure() { setVpDivSize({ w: el.clientWidth, h: el.clientHeight }); }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // tileScale: target a readable tile pixel size on every screen.
  // We don't try to fit the whole 36×24 world at once — the camera scrolls it.
  // Instead, make tiles as large as they can be while still showing at least
  // 8 columns and 5 rows (enough to see a building + surroundings at all times).
  // Clamped to [18px, 56px] per tile so sprites stay legible on tiny and large screens.
  const MIN_TILE_PX = 18;
  const MAX_TILE_PX = 56;
  const MIN_COLS_VISIBLE = 8;
  const MIN_ROWS_VISIBLE = 5;
  const vpW = vpDivSize.w > 0 ? vpDivSize.w : Math.max(1, viewportSize.w - 16);
  const vpH = vpDivSize.h > 0 ? vpDivSize.h : Math.max(1, viewportSize.h - 54);
  const scaleForCols = vpW / (TILE * MIN_COLS_VISIBLE);
  const scaleForRows = vpH / (TILE * MIN_ROWS_VISIBLE);
  const tileScale = Math.min(
    MAX_TILE_PX / TILE,
    Math.max(MIN_TILE_PX / TILE, Math.min(scaleForCols, scaleForRows))
  );

  // Camera: how many tiles fit in the scaled viewport.
  const viewportColsActual = vpW / (TILE * tileScale);
  const viewportRowsActual = vpH / (TILE * tileScale);
  const rangeX = COLS - viewportColsActual;
  const rangeY = ROWS - viewportRowsActual;
  const camX = rangeX <= 0 ? rangeX / 2 : Math.max(0, Math.min(rangeX, pos.x + 0.5 - viewportColsActual / 2));
  const camY = rangeY <= 0 ? rangeY / 2 : Math.max(0, Math.min(rangeY, pos.y + 0.5 - viewportRowsActual / 2));

  return (
    <div style={{
      width: "100vw",
      height: "100dvh",
      fontFamily: "'VT323', monospace",
      background: "#0c1828",
      padding: "6px 8px 8px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Slim HUD bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(8px, 2vw, 11px)", color: "#ffe858" }}>
          {GAME_TITLE.toUpperCase()} <span style={{ color: "#70c8ff" }}>· {character?.name}</span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(7px, 1.5vw, 9px)",
            color: "#1c2c44",
            background: "#ffe858",
            border: "none",
            padding: "6px 10px",
            cursor: "pointer",
            borderRadius: 3,
            boxShadow: "0 0 0 2px #c89010",
            touchAction: "manipulation",
          }}
        >
          ☰ MENU (M)
        </button>
      </div>

      {/* Game viewport — fills remaining space after HUD */}
      <div
        ref={viewportRef}
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          overflow: "hidden",
          border: "3px solid #3068a8",
          boxShadow: "0 0 0 3px #0c1828",
          borderRadius: 4,
          background: "#5fa050",
        }}
      >
        {/* World container: zoom scales the entire layout subtree so all the
            absolute pixel positions (left, top, width, height) work correctly
            at any screen size. Unlike transform:scale, zoom doesn't detach the
            element from normal layout flow, so overflow:hidden on the parent
            clips at exactly the right pixel boundary on every screen. */}
        <div
          style={{
            position: "absolute",
            left: `${-camX * TILE}px`,
            top: `${-camY * TILE}px`,
            width: COLS * TILE,
            height: ROWS * TILE,
            transition: "left 0.12s linear, top 0.12s linear",
            zoom: tileScale,
          }}
        >
          <Ground />
          {MOUNTAINS.map((m, i) => <Mountain key={i} x={m.x} y={m.y} w={m.w} />)}
          {ROCKS.map((r, i) => <Rock key={i} x={r.x} y={r.y} />)}
          {TREES.map((t, i) => <Tree key={i} x={t.x} y={t.y} />)}
          {BUILDINGS.map((b) => (
            <div key={b.id} onClick={() => setActiveZone(b.id)} style={{ cursor: "pointer" }} title={`Enter ${b.label}`}>
              <Building b={b} active={nearBuilding?.id === b.id} />
            </div>
          ))}
          {NPCS.map((n) => (
            <NpcSprite key={n.id} x={n.x} y={n.y} palette={n.palette} onTap={() => setActiveNpc(n)} active={nearNpc?.id === n.id} />
          ))}
          {critters.map((c) => (
            <Critter key={c.id} kind={c.kind} x={c.x} y={c.y} bounce={c.bounce} onTap={() => tapCritter(c.id)} />
          ))}
          <Hero x={pos.x} y={pos.y} dir={dir} walking={walking} palette={palette} />
        </div>

        {/* Approach popup — shows briefly when newly arriving near a building or NPC */}
        {approachPopup && !anyModalOpen && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 10,
              transform: "translateX(-50%)",
              background: "rgba(12,24,40,0.92)",
              color: "#ffe858",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 9,
              padding: "8px 12px",
              borderRadius: 3,
              border: "2px solid #3068a8",
              whiteSpace: "nowrap",
              zIndex: 6,
              textAlign: "center",
            }}
          >
            <div>{approachPopup.label}</div>
            <div style={{ fontSize: 7, color: "#70c8ff", marginTop: 3 }}>
              PRESS ENTER OR SPACE TO {approachPopup.kind === "npc" ? "TALK" : "ENTER"}
            </div>
          </div>
        )}

        {critterQuip && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 16,
              transform: "translateX(-50%)",
              background: "rgba(12,24,40,0.92)",
              color: "#5cd87c",
              fontFamily: "'VT323', monospace",
              fontSize: 14,
              padding: "6px 12px",
              borderRadius: 3,
              border: "2px solid #3068a8",
              whiteSpace: "nowrap",
              zIndex: 6,
            }}
          >
            {critterQuip}
          </div>
        )}

        {/* Floating D-pad only — no A button; players use Enter/Space for actions */}
        <div style={{ position: "absolute", left: 10, bottom: 10, zIndex: 7 }}>
          <DPad onMove={move} />
        </div>
      </div>

      {menuOpen && (
        <Modal
          title="MENU"
          onClose={() => setMenuOpen(false)}
          onEnter={() => setMenuOpen(false)}
          onArrowLeft={() => { setMenuOpen(false); restartGame(); }}
          onArrowRight={() => { setMenuOpen(false); exitGame(); }}
        >
          <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 10 }}>CONTROLS</h3>
          <div style={{ display: "grid", gap: 8, marginBottom: 18, fontSize: 14 }}>
            <div><b style={{ color: "#70c8ff" }}>Move:</b> Arrow Keys, or the floating D-pad</div>
            <div><b style={{ color: "#70c8ff" }}>Interact / Talk:</b> Enter or Space — when close to a building or NPC</div>
            <div><b style={{ color: "#70c8ff" }}>Scroll long text:</b> ▲ ▼ inside any window</div>
            <div><b style={{ color: "#70c8ff" }}>Browse carousels:</b> ◀ ▶ in Tower and Gallery</div>
            <div><b style={{ color: "#70c8ff" }}>Navigate case studies:</b> ▲ ▼ + Enter in the Arcade</div>
            <div><b style={{ color: "#70c8ff" }}>Open this menu:</b> M or menu button top-right</div>
            <div><b style={{ color: "#70c8ff" }}>Close any window:</b> Esc · Enter</div>
          </div>
          <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 10 }}>QUICK TRAVEL</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {BUILDINGS.map((b) => (
              <PixelButton
                key={b.id}
                small
                onClick={() => { setMenuOpen(false); setActiveZone(b.id); }}
                style={{ background: "#203854", boxShadow: "0 0 0 2px #3068a8" }}
              >
                {b.label}
              </PixelButton>
            ))}
          </div>
          <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe858", marginBottom: 10 }}>GAME</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PixelButton small onClick={restartGame} style={{ background: "#3098e8", boxShadow: "0 0 0 2px #1c68a8" }}>
              ↺ RESTART [◀]
            </PixelButton>
            <PixelButton small onClick={exitGame} style={{ background: "#e04848", boxShadow: "0 0 0 2px #a02828" }}>
              ✕ EXIT [▶]
            </PixelButton>
          </div>
        </Modal>
      )}

      {activeZone && (
        <Modal
          title={zoneTitle[activeZone]}
          onClose={() => setActiveZone(null)}
          wide={activeZone === "arcade" || activeZone === "library" || activeZone === "tower"}
          onEnter={zoneEnter[activeZone] || undefined}
          onArrowLeft={zoneArrowLeft[activeZone] || undefined}
          onArrowRight={zoneArrowRight[activeZone] || undefined}
        >
          {zoneContent[activeZone]}
        </Modal>
      )}
      {selectedProject && <ProjectDetail project={selectedProject} onClose={() => setSelectedProject(null)} />}
      {activeNpc && <NpcDialogue npc={activeNpc} onClose={() => setActiveNpc(null)} />}
    </div>
  );
}

function DPad({ onMove }) {
  // Responsive size: comfortable tap target on mobile (min 44px),
  // smaller on desktop where keyboard is preferred.
  const sz = "clamp(44px, 10vmin, 54px)";
  const btn = (label, dx, dy, dir) => (
    <button
      onClick={() => onMove(dx, dy, dir)}
      style={{
        width: sz,
        height: sz,
        background: "rgba(28,44,68,0.82)",
        border: "2px solid rgba(112,200,255,0.6)",
        color: "#fffaf0",
        fontSize: "clamp(15px, 4vmin, 20px)",
        cursor: "pointer",
        borderRadius: 6,
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `${sz} ${sz} ${sz}`,
      gridTemplateRows: `${sz} ${sz} ${sz}`,
      gap: 3,
    }}>
      <div />{btn("▲", 0, -1, "up")}<div />
      {btn("◀", -1, 0, "left")}<div />{btn("▶", 1, 0, "right")}
      <div />{btn("▼", 0, 1, "down")}<div />
    </div>
  );
}
