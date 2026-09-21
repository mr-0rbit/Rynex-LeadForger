const express = require('express');
const { db, logActivity, now } = require('../db');
const { issueToken, verifyPassword, authenticate, rateLimit, clean } = require('../auth');

const router = express.Router();

const attempts = new Map(); // brute-force guard
router.post('/login', rateLimit(20), (req, res) => {
  const { email, password } = req.body || {};
  const key = String(email || '').toLowerCase();
  const rec = attempts.get(key);
  if (rec && rec.count >= 8 && Date.now() - rec.first < 15 * 60000) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1').get(key);
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    const a = attempts.get(key) || { count: 0, first: Date.now() };
    a.count++; attempts.set(key, a);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  attempts.delete(key);
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), user.id);
  logActivity(user.id, user.name, 'Signed in', 'user', user.id);
  const token = issueToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', authenticate, (req, res) => {
  const u = db.prepare('SELECT id, name, email, role, last_login FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: u });
});

router.get('/users', authenticate, (req, res) => {
  const rows = db.prepare('SELECT id, name, email, role, active, created_at, last_login FROM users ORDER BY id').all();
  res.json({ users: rows });
});

// Demo credential helper shown on the login screen
router.get('/demo-accounts', (req, res) => {
  res.json({
    accounts: [
      { role: 'Admin', email: 'admin@rynex.io', password: 'Admin@123' },
      { role: 'Manager', email: 'manager@rynex.io', password: 'Manager@123' },
      { role: 'Researcher', email: 'researcher@rynex.io', password: 'Research@123' },
      { role: 'Sales', email: 'sales@rynex.io', password: 'Sales@123' }
    ]
  });
});

module.exports = router;
