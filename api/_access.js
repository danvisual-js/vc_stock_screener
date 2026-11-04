/**
 * api/_access.js — who is calling, which tier they are on, and how many AI calls they may make today.
 *
 * Tiers (daily AI questions per person; override with env AI_LIMITS="free,beta,supporter"):
 *   free       no code, counted per IP address            default 5
 *   beta       valid access code from the waitlist        default 30
 *   supporter  valid code whose member row has tier set   default 100
 * Plus: a per-minute burst limit, a global daily cap (CONCIERGE_DAILY_CAP) and a same-site check.
 * Codes are looked up in Supabase `members`; without Supabase everyone is "free".
 */
const db = require("./_db");

const LIMITS = () => {
  const p = String(process.env.AI_LIMITS || "5,30,100").split(",").map((x) => Number(x));
  return { free: p[0] > 0 ? p[0] : 5, beta: p[1] > 0 ? p[1] : 30, supporter: p[2] > 0 ? p[2] : 100 };
};
const CODE_RE = /^[A-Z0-9]{8}$/;

// Same-site check: browsers always send Origin on POST. Blocks other websites from using your endpoints.
// The packaged desktop/mobile apps (capacitor://localhost, file:// "null") are allowed too. Extra sites: env ALLOWED_ORIGINS.
function originOk(req) {
  const host = String(req.headers.host || "").toLowerCase();
  const o = String(req.headers.origin || "");
  if (!o) return { ok: true, origin: "" }; // non-browser clients (curl) are still covered by the rate limits
  if (o === "null" || /^(capacitor|ionic):\/\/localhost$/i.test(o)) return { ok: true, origin: o };
  try {
    const h = new URL(o).host.toLowerCase();
    const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (h === host || extra.includes(h) || /^localhost(:\d+)?$/.test(h)) return { ok: true, origin: o };
  } catch { /* invalid origin */ }
  return { ok: false, origin: o };
}
const sameSite = (req) => originOk(req).ok;
// Sets CORS headers only for allowed origins (no wildcard). Returns false if the caller's origin is not allowed.
function cors(req, res, methods) {
  const r = originOk(req);
  res.setHeader("Vary", "Origin");
  if (r.ok && r.origin) res.setHeader("Access-Control-Allow-Origin", r.origin);
  res.setHeader("Access-Control-Allow-Methods", methods || "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Access-Code");
  return r.ok;
}

async function whoIs(req) {
  const raw = String(req.headers["x-access-code"] || "").trim().toUpperCase();
  const ip = db.clientIp(req);
  if (CODE_RE.test(raw) && db.configured()) {
    try {
      const rows = await db.rest(`members?code=eq.${encodeURIComponent(raw)}&active=eq.true&select=tier,code`);
      const m = rows && rows[0];
      if (m && (m.tier === "beta" || m.tier === "supporter")) return { tier: m.tier, id: "c:" + raw, ip };
    } catch { /* fall through to free */ }
  }
  return { tier: "free", id: "ip:" + ip, ip };
}

/**
 * Charge one AI call. Returns { ok, tier, limit, left, reason }.
 * bucket separates features that should have their own allowance (e.g. "cc", "ai").
 */
async function charge(req, bucket, per) {
  const who = await whoIs(req);
  const lim = LIMITS()[who.tier] * (per || 1);
  const day = new Date().toISOString().slice(0, 10);
  // burst guard: at most 8 calls per minute per IP, whatever the tier
  const burst = await db.take(`rl:burst:${bucket}:${who.ip}`, 8, 60);
  if (!burst.ok) return { ok: false, tier: who.tier, limit: lim, left: 0, reason: "Slow down a little and try again in a minute." };
  const t = await db.take(`rl:${bucket}:day:${day}:${who.id}`, lim, 86400);
  if (!t.ok) {
    const up = who.tier === "free" ? " Join the beta for a bigger daily allowance." : who.tier === "beta" ? " Supporters get the largest allowance." : "";
    return { ok: false, tier: who.tier, limit: lim, left: 0, reason: `You have used today's ${lim} AI answers.${up} It resets in 24 hours.` };
  }
  return { ok: true, tier: who.tier, limit: lim, left: Math.max(0, lim - t.n) };
}

module.exports = { cors, sameSite, whoIs, charge, LIMITS, CODE_RE };
