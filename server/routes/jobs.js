const express = require('express');
const { db, logActivity, now } = require('../db');
const { authenticate, requireRole } = require('../auth');
const pipeline = require('../engines/pipeline');

const router = express.Router();
router.use(authenticate);

// Discovery method registry (each is an independent, toggleable module)
const METHODS = [
  { key: 'business_directory', name: 'Business Directory Discovery', desc: 'Discover businesses through public business directories and legitimate listings.', provider: 'LeadSourceProvider' },
  { key: 'search_engine', name: 'Search Engine Discovery', desc: 'Dynamically generated search strategies across industry, size and security hooks.', provider: 'SearchProvider' },
  { key: 'company_website', name: 'Company Website Discovery', desc: 'Profile companies from their public website content.', provider: 'CompanyEnrichmentProvider' },
  { key: 'tech_intel', name: 'Technology Stack Discovery', desc: 'Passive detection of publicly observable technologies.', provider: 'TechnologyProvider' },
  { key: 'security_signals', name: 'Security Signal Discovery', desc: 'Detect public signals that indicate security requirements.', provider: 'SignalEngine' },
  { key: 'compliance_signals', name: 'Compliance Signal Discovery', desc: 'SOC 2, ISO 27001, PCI DSS, HIPAA, GDPR and more.', provider: 'SignalEngine' },
  { key: 'job_intel', name: 'Job Posting Intelligence', desc: 'Security hiring signals from public job boards.', provider: 'SearchProvider' },
  { key: 'public_business_info', name: 'Public Business Information', desc: 'Registries and public company profiles.', provider: 'LeadSourceProvider' },
  { key: 'industry_directory', name: 'Industry Directory Discovery', desc: 'Vertical-specific directories.', provider: 'LeadSourceProvider' },
  { key: 'startup_db', name: 'Startup/Company Database Discovery', desc: 'Startup databases and funding trackers.', provider: 'LeadSourceProvider' },
  { key: 'social_presence', name: 'Social/Professional Presence Discovery', desc: 'Public professional profiles and company pages.', provider: 'ContactProvider' },
  { key: 'domain_intel', name: 'Domain Intelligence', desc: 'Passive domain registration context.', provider: 'TechnologyProvider' },
  { key: 'web_tech_intel', name: 'Web Technology Intelligence', desc: 'Public web technology footprints.', provider: 'TechnologyProvider' },
  { key: 'news_intel', name: 'News/Event Intelligence', desc: 'Public announcements: expansion, incidents, launches.', provider: 'SearchProvider' },
  { key: 'contact_discovery', name: 'Public Contact Discovery', desc: 'Publicly listed business contacts.', provider: 'ContactProvider' }
];

router.get('/methods', (req, res) => {
  res.json({ methods: METHODS });
});

router.post('/jobs', requireRole('manager', 'researcher', 'admin'), (req, res) => {
  const { name, target, methods } = req.body || {};
  if (!Array.isArray(methods) || methods.length === 0) return res.status(400).json({ error: 'Select at least one discovery method' });
  if (!target) return res.status(400).json({ error: 'Target configuration required' });
  const t = {
    countries: (target.countries || []).slice(0, 30),
    industries: (target.industries || []).slice(0, 30),
    employeesMin: target.employeesMin != null ? Number(target.employeesMin) : null,
    employeesMax: target.employeesMax != null ? Number(target.employeesMax) : null,
    revenue: target.revenue || null,
    minScore: Number(target.minScore) || 0,
    maxLeads: Number(target.maxLeads) || 250,
    personalization: target.personalization || 'Deep Research'
  };
  const id = pipeline.startJob(req.user, name, t, methods.slice(0, 15));
  res.json({ ok: true, jobId: id });
});

router.get('/jobs', (req, res) => {
  const rows = db.prepare(`
    SELECT j.*, u.name user_name,
      (SELECT COUNT(*) FROM leads l WHERE l.created_at >= j.started_at) leads_created_since
    FROM lead_generation_jobs j LEFT JOIN users u ON u.id = j.user_id
    ORDER BY j.created_at DESC LIMIT 100`).all();
  res.json({ jobs: rows.map((j) => ({
    ...j,
    target: JSON.parse(j.target_json || '{}'),
    methods: JSON.parse(j.methods_json || '[]'),
    progress: JSON.parse(j.progress_json || '{}'),
    stats: JSON.parse(j.stats_json || '{}')
  })) });
});

router.get('/jobs/:id', (req, res) => {
  const j = db.prepare('SELECT j.*, u.name user_name FROM lead_generation_jobs j LEFT JOIN users u ON u.id=j.user_id WHERE j.id = ?').get(Number(req.params.id));
  if (!j) return res.status(404).json({ error: 'Job not found' });
  res.json({
    job: {
      ...j,
      target: JSON.parse(j.target_json || '{}'),
      methods: JSON.parse(j.methods_json || '[]'),
      progress: JSON.parse(j.progress_json || '{}'),
      stats: JSON.parse(j.stats_json || '{}')
    }
  });
});

router.post('/jobs/:id/cancel', requireRole('manager', 'researcher', 'admin'), (req, res) => {
  const ok = pipeline.cancelJob(Number(req.params.id));
  if (ok) logActivity(req.user.uid, req.user.name, 'Cancelled lead generation job', 'job', req.params.id);
  res.json({ ok });
});

// Recent leads produced by a job (for the result page)
router.get('/jobs/:id/leads', (req, res) => {
  const j = db.prepare('SELECT * FROM lead_generation_jobs WHERE id = ?').get(Number(req.params.id));
  if (!j) return res.status(404).json({ error: 'Job not found' });
  const rows = db.prepare(`
    SELECT l.id, l.lead_score, l.status, l.recommended_service, l.intent, c.name company, c.country, c.industry, c.employee_count
    FROM leads l JOIN companies c ON c.id = l.company_id
    WHERE l.created_at >= ? ORDER BY l.lead_score DESC LIMIT 500`).all(j.started_at || j.created_at);
  res.json({ leads: rows });
});

module.exports = router;
