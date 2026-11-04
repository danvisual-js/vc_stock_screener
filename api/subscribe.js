/**
 * api/subscribe.js — self-serve daily email signup for a watchlist (double opt-in).
 *
 *   POST /api/subscribe  { email, symbols: ["AAPL",...] }   -> sends a confirmation email
 *   GET  /api/subscribe?confirm=<id>.<token>                 -> activates (or applies a watchlist change)
 *   GET  /api/subscribe?unsub=<id>.<token>                   -> removes the subscription
 *
 * Nothing is stored as "active" until the owner of the address clicks the confirm link, so nobody
 * can sign up (or change) someone else's address. Sending is done by /api/daily-report (cron).
 *
 * Env: RESEND_API_KEY, REPORT_FROM_EMAIL (a Resend-verified sender), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional PUBLIC_URL.
 */
const crypto = require("crypto");
const db = require("./_db");
const waitlist = require("./_waitlist");

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const idOf = (email) => crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);
const token = () => crypto.randomBytes(18).toString("hex");
const same = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const baseUrl = (req) => (process.env.PUBLIC_URL || `https://${req.headers.host}`).replace(/\/$/, "");

function page(res, status, title, msg) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).send(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
      `<body style="margin:0;background:#08090E;color:#F1F5F9;font-family:-apple-system,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">` +
      `<div style="max-width:440px;background:#0F1018;border:1px solid #1E2334;border-radius:14px;padding:28px"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:10px">AI Market Screener</div>` +
      `<h1 style="font-size:20px;margin:0 0 10px">${esc(title)}</h1><p style="color:#94A3B8;line-height:1.6;font-size:14px;margin:0 0 18px">${esc(msg)}</p>` +
      `<a href="/" style="color:#818CF8;font-size:13px">Back to the screener</a></div></body></html>`
  );
}

async function sendMail(to, subject, html) {
  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) throw new Error("Email is not configured on the server (RESEND_API_KEY).");
  const from = process.env.REPORT_FROM_EMAIL || "AI Market Screener <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const m = (j && (j.message || j.error)) || "";
    if (/verify|domain|testing/i.test(m)) throw new Error("The email sender is not verified yet, so mail can only go to the site owner for now.");
    throw new Error("Could not send the confirmation email.");
  }
}

module.exports = async function handler(req, res) {
  // beta signup shares this function (POST /api/subscribe?kind=beta) to stay within the 12-function Hobby limit
  if (/[?&]kind=beta\b/.test(req.url || "")) return waitlist(req, res);
  const corsOk = require("./_access").cors(req, res, "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(corsOk ? 200 : 403).end();

  const base = baseUrl(req);
  const q = new URL(req.url, "http://x").searchParams;

  // ── confirm / unsubscribe links (GET) ──────────────────────────────────────
  if (req.method === "GET") {
    const c = q.get("confirm");
    const u = q.get("unsub");
    if (!c && !u) return res.status(400).json({ error: "Missing link parameter" });
    if (!db.configured()) return page(res, 503, "Not available", "Subscriptions are not set up on this site yet.");
    try {
      const [id, tok] = String(c || u).split(".");
      const rec = id && (await db.getSub(id));
      if (!rec) return page(res, 404, "Link expired", "We could not find that subscription. It may already be removed.");
      if (u) {
        if (!same(rec.unsub, tok)) return page(res, 400, "Invalid link", "This unsubscribe link is not valid.");
        await db.deleteSub(id);
        return page(res, 200, "You are unsubscribed", "You will not get any more daily emails. You can sign up again any time from the app.");
      }
      if (!rec.pending || !same(rec.pending.token, tok)) return page(res, 400, "Invalid or used link", "This confirmation link is not valid or was already used.");
      rec.symbols = rec.pending.symbols;
      rec.confirmed = true;
      rec.confirmedAt = Date.now();
      delete rec.pending;
      await db.saveSub(rec);
      return page(res, 200, "You are subscribed", `Daily brief for ${rec.symbols.join(", ")} will arrive each weekday morning. Every email has a one-click unsubscribe link.`);
    } catch (e) {
      return page(res, 500, "Something went wrong", "Please try the link again in a minute.");
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!require("./_access").sameSite(req)) return res.status(403).json({ error: "Not allowed from this site." });
  if (!db.configured()) return res.status(503).json({ error: "Email subscriptions are not set up on this site yet." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  const symbols = [...new Set((Array.isArray(body.symbols) ? body.symbols : []).map((s) => String(s).trim().toUpperCase()).filter((s) => /^[A-Z.\-]{1,10}$/.test(s)))].slice(0, 20);
  if (!symbols.length) return res.status(400).json({ error: "Add at least one stock to your watchlist first." });

  const id = idOf(email);
  const ok =
    (await db.limit("rl:sub:ip:" + db.clientIp(req), 6, 3600)) &&
    (await db.limit("rl:sub:em:" + id, 3, 86400));
  if (!ok) return res.status(429).json({ error: "Too many requests. Try again later." });

  try {
    const old = await db.getSub(id);
    const rec = old || { id, email, confirmed: false, symbols: [], unsub: token(), createdAt: Date.now() };
    rec.pending = { symbols, token: token() };
    await db.saveSub(rec); // unconfirmed signups are purged after 7 days by the daily job
    const link = `${base}/api/subscribe?confirm=${id}.${rec.pending.token}`;
    await sendMail(
      email,
      "Confirm your daily stock brief",
      `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1C1C1E">` +
        `<h2 style="margin:0 0 8px;font-size:18px">Confirm your daily brief</h2>` +
        `<p style="font-size:14px;line-height:1.6;color:#444">Someone (hopefully you) asked for a weekday morning AI brief on: <b>${esc(symbols.join(", "))}</b>.</p>` +
        `<p style="margin:20px 0"><a href="${link}" style="background:#6366F1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">Confirm and start the daily email</a></p>` +
        `<p style="font-size:12px;color:#888">If you did not ask for this, ignore this email and nothing will be sent. Educational tool, not financial advice.</p></div>`
    );
    return res.status(200).json({ ok: true, message: "Check your inbox and click the confirmation link to start the daily email." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not subscribe right now." });
  }
};
