/**
 * api/waitlist.js — beta signup from the lander (and the app).
 *   POST /api/waitlist { email, name?, interest?, source?, website? }   (website = hidden honeypot field)
 * The first BETA_SEATS (default 100) people get tier "beta" and an 8-character access code, shown once on screen.
 * Everyone after that is on the "waitlist" (no code) until you upgrade the row in Supabase -> members.
 * Check the list any time: Supabase -> Table Editor -> members.
 */
const crypto = require("crypto");
const db = require("./_db");
const access = require("./_access");

const idOf = (e) => crypto.createHash("sha256").update(e).digest("hex").slice(0, 24);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const makeCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHA[b % ALPHA.length]).join("");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

module.exports = async function handler(req, res) {
  const allowed = access.cors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(allowed ? 200 : 403).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!allowed) return res.status(403).json({ error: "Not allowed from this site." });
  if (!db.configured()) return res.status(503).json({ error: "Signups are not open yet." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  if (body.website) return res.status(200).json({ ok: true, status: "waitlist" }); // bots fill the hidden field; pretend success

  const email = clean(body.email, 254).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

  const ok = (await db.limit("rl:wl:ip:" + db.clientIp(req), 5, 3600)) && (await db.limit("rl:wl:day", 400, 86400));
  if (!ok) return res.status(429).json({ error: "Too many signups right now. Try again later." });

  try {
    const id = idOf(email);
    const have = await db.rest(`members?id=eq.${id}&select=tier`);
    if (have && have[0]) return res.status(200).json({ ok: true, status: "exists", message: "You are already on the list. We will email you when there is news." });

    const seats = Number(process.env.BETA_SEATS) || 100;
    const used = await db.rest("members?tier=in.(beta,supporter)&select=id", { prefer: "count=exact" });
    const open = !Array.isArray(used) || used.length < seats;
    const row = {
      id, email, name: clean(body.name, 60) || null, interest: clean(body.interest, 300) || null, source: clean(body.source, 40) || null,
      code: open ? makeCode() : null, tier: open ? "beta" : "waitlist",
    };
    await db.rest("members", { method: "POST", prefer: "return=minimal", body: row });
    return res.status(200).json(open
      ? { ok: true, status: "beta", code: row.code, message: "You are in the beta. Save this access code." }
      : { ok: true, status: "waitlist", message: "You are on the waitlist. We will email you when a seat opens." });
  } catch (e) {
    return res.status(500).json({ error: "Could not sign you up right now. Please try again." });
  }
};
