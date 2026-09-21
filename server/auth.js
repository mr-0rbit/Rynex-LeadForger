/**
 * Authentication & security: scrypt password hashing (node:crypto),
 * HMAC-signed bearer tokens, RBAC guards, rate limiting, input hardening.
 */
const crypto = require('crypto');
const { db, logActivity, now } = require('./db');

const SECRET = (() => {
  // Secret management: persist a random server secret outside the repo.
  const fs = require('fs');
  const path = require('path');
  const f = path.join(__dirname, '..', 'data', '.server-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(f, s, { encoding: 'utf8' });
    return s;
  }
})();

// ---- password hashing (scrypt) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch { return false; }
}

// ---- bearer tokens (HMAC-SHA256 signed, 24h expiry) ----
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

function issueToken(user) {
  const payload = b64url(JSON.stringify({
    uid: user.id, role: user.role, name: user.name, email: user.email,
    exp: Date.now() + 24 * 3600 * 1000
  }));
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payload, sig] = String(token).split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

// ---- middleware ----
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? verifyToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

const ROLE_RANK = { sales: 1, researcher: 2, manager: 3, admin: 4 };

/** Require at least one of the given roles (admin always passes). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Insufficient permissions for this action' });
  };
}

// ---- simple in-memory rate limiter (per IP per minute) ----
const buckets = new Map();
function rateLimit(maxPerMinute = 120) {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const minute = Math.floor(Date.now() / 60000);
    let b = buckets.get(key);
    if (!b || b.minute !== minute) { b = { minute, count: 0 }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > maxPerMinute) return res.status(429).json({ error: 'Rate limit exceeded. Slow down.' });
    next();
  };
}

// ---- input validation helpers (SQL injection prevention via prepared statements;
//      these helpers guard string inputs used in dynamic clauses) ----
function sanitizeIdent(s, allowed) {
  s = String(s || '');
  return allowed.includes(s) ? s : null;
}
const MAX_STR = 500;
function clean(s, max = MAX_STR) {
  if (s === null || s === undefined) return null;
  return String(s).slice(0, max).trim() || null;
}
// Basic HTML escaping for any user-provided string later rendered (XSS defense in depth;
// React escapes by default — this protects exports/emails too).
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = {
  SECRET, hashPassword, verifyPassword, issueToken, verifyToken,
  authenticate, requireRole, rateLimit, sanitizeIdent, clean, escapeHtml
};
