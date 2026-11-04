/**
 * api/_db.js — Supabase (PostgREST) helpers for email subscriptions + rate limiting.
 * Files starting with "_" are not deployed as routes by Vercel. No extra npm packages needed.
 *
 * Env (server only — never expose the service role key to the browser):
 *   SUPABASE_URL                 e.g. https://abcdxyz.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    Project Settings → API → service_role
 *
 * Tables/functions are created by supabase/schema.sql (run it once in the Supabase SQL editor).
 */
const URL_ = () => (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = () => !!(URL_() && KEY());

async function rest(path, opts) {
  if (!configured()) throw new Error("DB_NOT_CONFIGURED");
  const o = opts || {};
  const r = await fetch(`${URL_()}/rest/v1/${path}`, {
    method: o.method || "GET",
    headers: {
      apikey: KEY(),
      Authorization: `Bearer ${KEY()}`,
      "Content-Type": "application/json",
      ...(o.prefer ? { Prefer: o.prefer } : {}),
    },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = null; }
  if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Database error ${r.status}`);
  return j;
}

const fromRow = (r) =>
  r && {
    id: r.id,
    email: r.email,
    symbols: r.symbols || [],
    confirmed: !!r.confirmed,
    unsub: r.unsub,
    pending: r.pending || null,
    createdAt: r.created_at,
    confirmedAt: r.confirmed_at,
  };

async function getSub(id) {
  const rows = await rest(`subscriptions?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows && rows[0] ? fromRow(rows[0]) : null;
}
async function saveSub(s) {
  await rest("subscriptions?on_conflict=id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      id: s.id,
      email: s.email,
      symbols: s.symbols || [],
      confirmed: !!s.confirmed,
      unsub: s.unsub,
      pending: s.pending || null,
      confirmed_at: s.confirmedAt ? new Date(s.confirmedAt).toISOString() : null,
    },
  });
}
const deleteSub = (id) => rest(`subscriptions?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
async function listConfirmed(max) {
  const rows = await rest(`subscriptions?confirmed=eq.true&select=*&order=created_at.asc&limit=${Number(max) || 300}`);
  return (rows || []).map(fromRow).filter((s) => s.symbols.length);
}
// Atomically claim today's send for a subscriber. Returns true only for the first caller each day.
async function claimSend(id, day) {
  const rows = await rest(`subscriptions?id=eq.${encodeURIComponent(id)}&or=(last_sent.is.null,last_sent.neq.${day})`, {
    method: "PATCH",
    prefer: "return=representation",
    body: { last_sent: day },
  });
  return Array.isArray(rows) && rows.length === 1;
}
const releaseSend = (id) => rest(`subscriptions?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=minimal", body: { last_sent: null } });
const purgeUnconfirmed = (days) =>
  rest(`subscriptions?confirmed=eq.false&created_at=lt.${encodeURIComponent(new Date(Date.now() - days * 864e5).toISOString())}`, { method: "DELETE", prefer: "return=minimal" });

// Fixed-window rate limit: Postgres function rl_hit (atomic) when configured, else per-instance memory.
const mem = new Map();
async function limit(key, max, windowSec) {
  if (configured()) {
    try {
      const ok = await rest("rpc/rl_hit", { method: "POST", body: { k: key, max_n: max, win_s: windowSec } });
      if (typeof ok === "boolean") return ok;
    } catch {
      /* fall back to memory */
    }
  }
  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.reset < now) {
    mem.set(key, { n: 1, reset: now + windowSec * 1000 });
    return true;
  }
  e.n++;
  return e.n <= max;
}

function clientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.headers["x-real-ip"] || "unknown";
}

// Like limit() but returns { ok, n } so callers can show how many are left.
async function take(key, max, windowSec) {
  if (configured()) {
    try {
      const r = await rest("rpc/rl_take", { method: "POST", body: { k: key, max_n: max, win_s: windowSec } });
      if (r && typeof r.ok === "boolean") return { ok: r.ok, n: Number(r.n) || 0 };
    } catch {
      /* fall back to memory */
    }
  }
  const now = Date.now();
  const e = mem.get(key);
  if (!e || e.reset < now) {
    mem.set(key, { n: 1, reset: now + windowSec * 1000 });
    return { ok: true, n: 1 };
  }
  e.n++;
  return { ok: e.n <= max, n: e.n };
}

module.exports = { rest, take, configured, getSub, saveSub, deleteSub, listConfirmed, claimSend, releaseSend, purgeUnconfirmed, limit, clientIp };
