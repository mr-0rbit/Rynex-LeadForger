/**
 * Rynex Technologies - Global Lead Intelligence & Outreach Platform
 * API server. Serves the REST API and (in production) the built frontend.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const seed = require('./seed');
const { rateLimit } = require('./auth');

seed.main(); // idempotent: creates users/settings and seeds demo data only once

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(rateLimit(300));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'rynex-lead-intelligence', demo: true }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/niche', require('./routes/niche_routes'));
app.use('/api', require('./routes/leads'));
app.use('/api', require('./routes/jobs'));
app.use('/api', require('./routes/outreach'));
app.use('/api', require('./routes/misc'));

// API 404 + error handling
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[api error]', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Serve built frontend (production)
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4180;
app.listen(PORT, () => {
  console.log(`[rynex] API server listening on http://127.0.0.1:${PORT} (demo mode: synthetic data)`);
});
