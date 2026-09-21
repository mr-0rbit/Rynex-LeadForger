/**
 * Rynex Technologies - Lead Intelligence Platform
 * Database layer (node:sqlite). Schema designed to map 1:1 to PostgreSQL
 * for a future production swap (see docs in README).
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'rynex.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','researcher','sales')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website TEXT,
  domain TEXT,
  industry TEXT,
  business_model TEXT,
  description TEXT,
  country TEXT,
  city TEXT,
  employee_count INTEGER,
  revenue_band TEXT,
  founded_year INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  enriched INTEGER NOT NULL DEFAULT 0,
  data_confidence TEXT DEFAULT 'Medium',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain) WHERE domain IS NOT NULL AND domain != '';
CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  email_status TEXT DEFAULT 'unverified',
  is_primary INTEGER NOT NULL DEFAULT 0,
  confidence TEXT DEFAULT 'Medium',
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  primary_contact_id INTEGER REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'New',
  lead_score INTEGER NOT NULL DEFAULT 0,
  score_category TEXT DEFAULT 'Medium Potential',
  company_fit_score INTEGER DEFAULT 0,
  security_signal_score INTEGER DEFAULT 0,
  intent_score INTEGER DEFAULT 0,
  service_fit_score INTEGER DEFAULT 0,
  data_quality_score INTEGER DEFAULT 0,
  intent TEXT DEFAULT 'Unknown',
  recommended_service TEXT,
  service_relevance TEXT,
  confidence TEXT DEFAULT 'Medium',
  source TEXT,
  source_url TEXT,
  discovery_method TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_contacted_at TEXT,
  next_followup_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_service ON leads(recommended_service);

CREATE TABLE IF NOT EXISTS lead_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_name TEXT,
  source_url TEXT,
  observed_at TEXT,
  confidence TEXT DEFAULT 'Medium',
  related_service TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_evidence_lead ON lead_evidence(lead_id);
CREATE INDEX IF NOT EXISTS idx_evidence_observed ON lead_evidence(observed_at);

CREATE TABLE IF NOT EXISTS lead_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  category TEXT,
  title TEXT,
  confidence TEXT DEFAULT 'Medium',
  relevant_services TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_signals_lead ON lead_signals(lead_id);

CREATE TABLE IF NOT EXISTS company_technologies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  technology TEXT NOT NULL,
  category TEXT,
  confidence TEXT DEFAULT 'Medium',
  source TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tech_company ON company_technologies(company_id);
CREATE INDEX IF NOT EXISTS idx_tech_name ON company_technologies(technology);

CREATE TABLE IF NOT EXISTS company_compliance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  framework TEXT NOT NULL,
  status TEXT,
  evidence TEXT,
  confidence TEXT DEFAULT 'Medium',
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_compliance_company ON company_compliance(company_id);

CREATE TABLE IF NOT EXISTS lead_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  provider TEXT,
  source_name TEXT,
  source_url TEXT,
  retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
  confidence TEXT DEFAULT 'Medium'
);
CREATE INDEX IF NOT EXISTS idx_sources_lead ON lead_sources(lead_id);

CREATE TABLE IF NOT EXISTS lead_generation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  target_json TEXT NOT NULL DEFAULT '{}',
  methods_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','partially_completed','failed','cancelled')),
  stage TEXT,
  progress_json TEXT DEFAULT '{}',
  stats_json TEXT DEFAULT '{}',
  error TEXT,
  is_demo INTEGER NOT NULL DEFAULT 1,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON lead_generation_jobs(status);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  segment_json TEXT DEFAULT '{}',
  primary_service TEXT,
  personalization TEXT DEFAULT 'Deep Research',
  status TEXT DEFAULT 'Draft',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaign_leads (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS email_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id),
  personalization TEXT DEFAULT 'Deep Research',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Pending Review','Approved','Scheduled','Sent','Rejected')),
  evidence_confidence TEXT DEFAULT 'High',
  safety_checks TEXT DEFAULT '{}',
  generated_by TEXT DEFAULT 'Rynex Email Engine',
  scheduled_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_lead ON email_drafts(lead_id);

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  service TEXT,
  tone TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER REFERENCES email_drafts(id) ON DELETE CASCADE,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('sent','opened','replied','bounced','unsubscribed','clicked')),
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_draft ON email_events(draft_id);
CREATE INDEX IF NOT EXISTS idx_events_lead ON email_events(lead_id);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  due_date TEXT,
  priority TEXT DEFAULT 'Medium',
  status TEXT DEFAULT 'Open',
  assigned_to INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#00D4FF',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE IF NOT EXISTS suppression (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('email','domain')),
  value TEXT NOT NULL,
  reason TEXT,
  list TEXT NOT NULL DEFAULT 'do_not_contact',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, value)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_type TEXT NOT NULL,
  provider_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_encrypted TEXT,
  config_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'Not Configured',
  last_checked TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS export_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  filename TEXT NOT NULL,
  format TEXT NOT NULL,
  scope TEXT,
  row_count INTEGER,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_niche_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  niche TEXT,
  location TEXT,
  description TEXT,
  detected_need TEXT,
  tech_stack TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  evidence_url TEXT,
  evidence_label TEXT,
  contact_page_url TEXT,
  contact_person TEXT,
  contact_title TEXT,
  contact_linkedin TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  notes TEXT,
  your_offer TEXT,
  lead_score INTEGER DEFAULT 50,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saved_leads_status ON saved_niche_leads(status);
CREATE INDEX IF NOT EXISTS idx_saved_leads_niche ON saved_niche_leads(niche);
`);

// Migration: safely add evidence and contact columns to saved_niche_leads if not present
const newNicheCols = [
  'evidence_url TEXT',
  'evidence_label TEXT',
  'contact_page_url TEXT',
  'contact_person TEXT',
  'contact_title TEXT',
  'contact_linkedin TEXT'
];
for (const col of newNicheCols) {
  try {
    db.exec(`ALTER TABLE saved_niche_leads ADD COLUMN ${col};`);
  } catch (err) {
    // Column already exists
  }
}

// ---------- helpers ----------
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// better-sqlite3-compatible transaction helper (node:sqlite lacks one).
let inTx = false;
db.transaction = function (fn) {
  return function (...args) {
    if (inTx) return fn(...args); // nested calls join the outer transaction
    inTx = true;
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      inTx = false;
      return result;
    } catch (e) {
      inTx = false;
      try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw e;
    }
  };
};

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value_json); } catch { return fallback; }
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
  ).run(key, JSON.stringify(value));
}

function logActivity(userId, userName, action, entityType, entityId, detail) {
  db.prepare(
    `INSERT INTO activity_logs (user_id, user_name, action, entity_type, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId || null, userName || 'system', action, entityType || null, entityId ? String(entityId) : null, detail || null, now());
}

module.exports = { db, getSetting, setSetting, logActivity, now, DATA_DIR };
