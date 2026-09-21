const express = require('express');
const crypto = require('crypto');
const { db, getSetting, setSetting, logActivity, now, DATA_DIR } = require('../db');
const { authenticate, requireRole, clean } = require('../auth');

const router = express.Router();
router.use(authenticate);

// ================= DASHBOARD =================
router.get('/dashboard', (req, res) => {
  const count = (sql, ...p) => db.prepare(sql).get(...p).c;
  const open = `('New','Researching','Qualified','High Intent')`;
  const kpis = {
    total_leads: count('SELECT COUNT(*) c FROM leads'),
    new_leads: count(`SELECT COUNT(*) c FROM leads WHERE status = 'New'`),
    qualified: count(`SELECT COUNT(*) c FROM leads WHERE lead_score >= 75`),
    high_intent: count(`SELECT COUNT(*) c FROM leads WHERE intent_score >= 60`),
    high_score: count(`SELECT COUNT(*) c FROM leads WHERE lead_score >= 75 AND status IN ${open}`),
    followup: count(`SELECT COUNT(*) c FROM leads WHERE next_followup_at IS NOT NULL AND next_followup_at >= date('now')`),
    emails_generated: count('SELECT COUNT(*) c FROM email_drafts'),
    emails_sent: count(`SELECT COUNT(*) c FROM email_drafts WHERE status = 'Sent'`),
    replies: count(`SELECT COUNT(*) c FROM email_events WHERE event = 'replied'`),
    conversions: count(`SELECT COUNT(*) c FROM leads WHERE status IN ('Meeting Booked','Proposal Sent','Won')`)
  };
  kpis.reply_rate = kpis.emails_sent ? Math.round(1000 * kpis.replies / kpis.emails_sent) / 10 : 0;
  kpis.conversion_rate = kpis.emails_sent ? Math.round(1000 * kpis.conversions / kpis.emails_sent) / 10 : 0;

  // 30-day series
  const series = db.prepare(`
    WITH RECURSIVE d(x) AS (SELECT date('now','-29 days') UNION ALL SELECT date(x,'+1 day') FROM d WHERE x < date('now'))
    SELECT d.x day,
      (SELECT COUNT(*) FROM leads l WHERE date(l.created_at)=d.x) leads,
      (SELECT COUNT(*) FROM lead_evidence e WHERE date(e.observed_at)=d.x) evidence,
      (SELECT COUNT(*) FROM email_drafts ed WHERE date(ed.created_at)=d.x) emails
    FROM d ORDER BY d.x`).all();

  const byCountry = db.prepare(`SELECT c.country name, COUNT(*) value FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY 2 DESC LIMIT 8`).all();
  const byIndustry = db.prepare(`SELECT c.industry name, COUNT(*) value FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY 2 DESC LIMIT 8`).all();
  const byCategory = db.prepare(`SELECT score_category name, COUNT(*) value FROM leads GROUP BY 1`).all();
  const recentLeads = db.prepare(`
    SELECT l.id, l.lead_score, l.status, l.intent, l.recommended_service, c.name company, c.country, c.industry
    FROM leads l JOIN companies c ON c.id=l.company_id ORDER BY l.created_at DESC, l.id DESC LIMIT 8`).all();
  const recentEvidence = db.prepare(`
    SELECT e.id, e.title, e.evidence_type, e.confidence, e.observed_at, e.source_name, c.name company, l.id lead_id
    FROM lead_evidence e JOIN leads l ON l.id=e.lead_id JOIN companies c ON c.id=l.company_id
    ORDER BY e.observed_at DESC, e.id DESC LIMIT 10`).all();
  const pipelineStatus = db.prepare(`SELECT status name, COUNT(*) value FROM leads GROUP BY 1`).all();
  const activeJobs = db.prepare(`SELECT id, name, status, stage, progress_json FROM lead_generation_jobs WHERE status IN ('pending','running') ORDER BY created_at DESC LIMIT 3`).all()
    .map((j) => ({ ...j, progress: JSON.parse(j.progress_json || '{}') }));
  res.json({ kpis, series, byCountry, byIndustry, byCategory, recentLeads, recentEvidence, pipelineStatus, activeJobs });
});

// ================= ANALYTICS =================
router.get('/analytics', (req, res) => {
  const q = db.prepare.bind(db);
  const methodPerf = db.prepare(`
    SELECT COALESCE(l.discovery_method, 'Unknown') name,
      COUNT(*) leads,
      SUM(CASE WHEN l.lead_score >= 75 THEN 1 ELSE 0 END) qualified,
      SUM(CASE WHEN l.intent_score >= 60 THEN 1 ELSE 0 END) high_intent,
      ROUND(AVG(l.lead_score), 1) avg_score
    FROM leads l GROUP BY 1 ORDER BY leads DESC`).all();
  const byService = db.prepare(`SELECT recommended_service name, COUNT(*) value, ROUND(AVG(lead_score),1) avg_score FROM leads GROUP BY 1 ORDER BY 2 DESC`).all();
  const scoreDist = db.prepare(`
    SELECT CASE WHEN lead_score >= 90 THEN '90-100' WHEN lead_score >= 75 THEN '75-89'
      WHEN lead_score >= 50 THEN '50-74' WHEN lead_score >= 25 THEN '25-49' ELSE '0-24' END band,
      COUNT(*) value FROM leads GROUP BY 1 ORDER BY band`).all();
  const daily = db.prepare(`
    WITH RECURSIVE d(x) AS (SELECT date('now','-29 days') UNION ALL SELECT date(x,'+1 day') FROM d WHERE x < date('now'))
    SELECT d.x day,
      (SELECT COUNT(*) FROM leads l WHERE date(l.created_at)=d.x) leads,
      (SELECT COUNT(*) FROM leads l WHERE date(l.created_at)=d.x AND l.lead_score>=75) qualified
    FROM d ORDER BY d.x`).all();
  const emailFunnel = (() => {
    const sent = q(`SELECT COUNT(*) c FROM email_drafts WHERE status='Sent'`).c;
    const opened = q(`SELECT COUNT(DISTINCT lead_id) c FROM email_events WHERE event='opened'`).c;
    const replied = q(`SELECT COUNT(DISTINCT lead_id) c FROM email_events WHERE event='replied'`).c;
    const bounced = q(`SELECT COUNT(*) c FROM email_events WHERE event='bounced'`).c;
    return [
      { name: 'Sent', value: sent }, { name: 'Opened', value: opened },
      { name: 'Replied', value: replied }, { name: 'Bounced', value: bounced }
    ];
  })();
  const countryPerf = db.prepare(`
    SELECT c.country name, COUNT(*) leads, SUM(CASE WHEN l.lead_score>=75 THEN 1 ELSE 0 END) qualified, ROUND(AVG(l.lead_score),1) avg_score
    FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY leads DESC LIMIT 12`).all();
  const industryPerf = db.prepare(`
    SELECT c.industry name, COUNT(*) leads, SUM(CASE WHEN l.lead_score>=75 THEN 1 ELSE 0 END) qualified, ROUND(AVG(l.lead_score),1) avg_score
    FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY leads DESC LIMIT 12`).all();
  const signalPerf = db.prepare(`
    SELECT s.signal_type name, COUNT(*) value FROM lead_signals s GROUP BY 1 ORDER BY value DESC`).all();
  const rates = (() => {
    const sent = q(`SELECT COUNT(*) c FROM email_drafts WHERE status='Sent'`).c || 0;
    const replies = q(`SELECT COUNT(*) c FROM email_events WHERE event='replied'`).c || 0;
    const conv = q(`SELECT COUNT(*) c FROM leads WHERE status IN ('Meeting Booked','Proposal Sent','Won')`).c || 0;
    return {
      qualified_rate: Math.round(1000 * q(`SELECT COUNT(*) c FROM leads WHERE lead_score>=75`).c / Math.max(1, q(`SELECT COUNT(*) c FROM leads`).c)) / 10,
      high_intent_rate: Math.round(1000 * q(`SELECT COUNT(*) c FROM leads WHERE intent_score>=60`).c / Math.max(1, q(`SELECT COUNT(*) c FROM leads`).c)) / 10,
      email_gen_rate: Math.round(1000 * q(`SELECT COUNT(*) c FROM email_drafts`).c / Math.max(1, q(`SELECT COUNT(*) c FROM leads`).c)) / 10,
      reply_rate: sent ? Math.round(1000 * replies / sent) / 10 : 0,
      conversion_rate: sent ? Math.round(1000 * conv / sent) / 10 : 0
    };
  })();
  res.json({ methodPerf, byService, scoreDist, daily, emailFunnel, countryPerf, industryPerf, signalPerf, rates });
});

// ================= ACTIVITY =================
router.get('/activity', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 100 OFFSET ?').all((page - 1) * 100);
  const total = db.prepare('SELECT COUNT(*) c FROM activity_logs').get().c;
  res.json({ activity: rows, total, page });
});

// ================= SETTINGS =================
router.get('/settings', (req, res) => {
  const out = {};
  for (const key of ['general', 'leadgen', 'scoring', 'outreach', 'display']) out[key] = getSetting(key, {});
  res.json(out);
});
router.put('/settings', requireRole('admin', 'manager'), (req, res) => {
  for (const key of ['general', 'leadgen', 'scoring', 'outreach', 'display']) {
    if (req.body[key] !== undefined) setSetting(key, req.body[key]);
  }
  logActivity(req.user.uid, req.user.name, 'Updated settings', 'settings', null, Object.keys(req.body).join(', '));
  res.json({ ok: true });
});

// ================= INTEGRATIONS =================
// Credential encryption (AES-256-GCM, key derived from server secret)
const { SECRET } = require('../auth');
function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}
function decryptSecret(blob) {
  try {
    const [ivHex, data] = String(blob).split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const buf = Buffer.from(data, 'hex');
    const tag = buf.subarray(buf.length - 16);
    const ciphertext = buf.subarray(0, buf.length - 16);
    const key = crypto.createHash('sha256').update(SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch { return null; }
}

const INTEGRATION_CATALOG = [
  { key: 'search_api', type: 'SearchProvider', name: 'Search API (e.g. SerpAPI / Bing)', fields: ['api_key'], live: true },
  { key: 'enrichment_api', type: 'CompanyEnrichmentProvider', name: 'Company Enrichment API (e.g. Clearbit-style)', fields: ['api_key'], live: true },
  { key: 'tech_api', type: 'TechnologyProvider', name: 'Technology Detection API (e.g. BuiltWith-style)', fields: ['api_key'], live: true },
  { key: 'contact_api', type: 'ContactProvider', name: 'Contact Discovery API', fields: ['api_key'], live: true },
  { key: 'smtp', type: 'EmailProvider', name: 'Email / SMTP Provider', fields: ['host', 'port', 'username', 'password'], live: true },
  { key: 'llm', type: 'EmailGenerationProvider', name: 'AI Model (email generation)', fields: ['api_key', 'model'], live: true },
  { key: 'crm', type: 'CRMProvider', name: 'CRM Integration', fields: ['api_key', 'endpoint'], live: true }
];

router.get('/integrations', (req, res) => {
  const rows = db.prepare('SELECT * FROM api_integrations').all();
  const map = new Map(rows.map((r) => [r.provider_key, r]));
  const out = INTEGRATION_CATALOG.map((c) => {
    const row = map.get(c.key);
    return {
      key: c.key, type: c.type, name: c.name, fields: c.fields,
      enabled: row ? !!row.enabled : false,
      status: row ? row.status : 'Not Configured',
      hasSecret: row ? !!row.config_encrypted : false,
      nonSecret: row ? JSON.parse(row.config_json || '{}') : {}
    };
  });
  res.json({ integrations: out });
});

router.put('/integrations/:key', requireRole('admin'), (req, res) => {
  const cat = INTEGRATION_CATALOG.find((c) => c.key === req.params.key);
  if (!cat) return res.status(404).json({ error: 'Unknown integration' });
  const { enabled, secrets, nonSecret } = req.body || {};
  const existing = db.prepare('SELECT * FROM api_integrations WHERE provider_key = ?').get(cat.key);
  const enc = secrets && Object.values(secrets).some((v) => v) ? encryptSecret(JSON.stringify(secrets)) : existing ? existing.config_encrypted : null;
  const status = enabled ? (enc ? 'Connected (credentials stored encrypted)' : 'Enabled (no credentials)') : 'Not Configured';
  if (existing) {
    db.prepare('UPDATE api_integrations SET enabled=?, config_encrypted=?, config_json=?, status=?, last_checked=? WHERE provider_key=?')
      .run(enabled ? 1 : 0, enc, JSON.stringify(nonSecret || {}), status, now(), cat.key);
  } else {
    db.prepare('INSERT INTO api_integrations (provider_type, provider_key, name, enabled, config_encrypted, config_json, status, last_checked) VALUES (?,?,?,?,?,?,?,?)')
      .run(cat.type, cat.key, cat.name, enabled ? 1 : 0, enc, JSON.stringify(nonSecret || {}), status, now());
  }
  logActivity(req.user.uid, req.user.name, `Updated integration ${cat.key}`, 'integration', null, status);
  res.json({ ok: true });
});

// ================= EXPORTS =================
function leadsForExport(req) {
  // Reuse the same filter logic as /leads by ids or filter params
  const ids = req.query.ids ? String(req.query.ids).split(',').map(Number).slice(0, 5000) : null;
  if (ids && ids.length) {
    return db.prepare(`
      SELECT l.id, c.name company, c.website, c.domain, c.industry, c.country, c.city, c.employee_count, c.revenue_band,
        ct.name contact_name, ct.role contact_role, ct.email contact_email, ct.phone contact_phone, ct.linkedin_url contact_linkedin,
        l.status, l.lead_score, l.intent, l.recommended_service, l.source, l.created_at, l.updated_at
      FROM leads l JOIN companies c ON c.id=l.company_id LEFT JOIN contacts ct ON ct.id=l.primary_contact_id
      WHERE l.id IN (${ids.map(() => '?').join(',')}) ORDER BY l.lead_score DESC`).all(...ids);
  }
  const minScore = Number(req.query.minScore) || 0;
  const country = req.query.country, industry = req.query.industry, service = req.query.service, status = req.query.status;
  const where = ['l.lead_score >= ?'], params = [minScore];
  if (country) { const a = String(country).split(','); where.push(`c.country IN (${a.map(() => '?').join(',')})`); params.push(...a); }
  if (industry) { const a = String(industry).split(','); where.push(`c.industry IN (${a.map(() => '?').join(',')})`); params.push(...a); }
  if (service) { const a = String(service).split(','); where.push(`l.recommended_service IN (${a.map(() => '?').join(',')})`); params.push(...a); }
  if (status) { const a = String(status).split(','); where.push(`l.status IN (${a.map(() => '?').join(',')})`); params.push(...a); }
  if (req.query.campaignId) { where.push('l.id IN (SELECT lead_id FROM campaign_leads WHERE campaign_id = ?)'); params.push(Number(req.query.campaignId)); }
  return db.prepare(`
    SELECT l.id, c.name company, c.website, c.domain, c.industry, c.country, c.city, c.employee_count, c.revenue_band,
      ct.name contact_name, ct.role contact_role, ct.email contact_email, ct.phone contact_phone, ct.linkedin_url contact_linkedin,
      l.status, l.lead_score, l.intent, l.recommended_service, l.source, l.created_at, l.updated_at
    FROM leads l JOIN companies c ON c.id=l.company_id LEFT JOIN contacts ct ON ct.id=l.primary_contact_id
    WHERE ${where.join(' AND ')} ORDER BY l.lead_score DESC LIMIT 20000`).all(...params);
}

router.get('/exports/leads', (req, res) => {
  const format = (req.query.format || 'csv').toLowerCase();
  const rows = leadsForExport(req);
  const headers = ['Lead ID', 'Company', 'Website', 'Domain', 'Industry', 'Country', 'City', 'Employees', 'Revenue', 'Contact', 'Role', 'Email', 'Phone', 'LinkedIn', 'Status', 'Lead Score', 'Intent', 'Recommended Service', 'Source', 'Created'];
  const esc = (v) => String(v == null ? '' : v).replace(/"/g, '""');
  let filename, contentType, payload;

  if (format === 'json') {
    filename = `rynex-leads-${Date.now()}.json`;
    payload = JSON.stringify(rows, null, 2);
    contentType = 'application/json';
  } else if (format === 'xlsx') {
    // stream via exceljs
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Leads');
    ws.addRow(headers);
    rows.forEach((r) => ws.addRow([r.id, r.company, r.website, r.domain, r.industry, r.country, r.city, r.employee_count, r.revenue_band, r.contact_name, r.contact_role, r.contact_email, r.contact_phone, r.contact_linkedin, r.status, r.lead_score, r.intent, r.recommended_service, r.source, r.created_at]));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rynex-leads-${Date.now()}.xlsx"`);
    wb.xlsx.write(res).then(() => {
      db.prepare('INSERT INTO export_history (user_id, filename, format, scope, row_count) VALUES (?,?,?,?,?)')
        .run(req.user.uid, `rynex-leads-${Date.now()}.xlsx`, 'xlsx', 'leads', rows.length);
      logActivity(req.user.uid, req.user.name, `Exported ${rows.length} leads (xlsx)`, 'export', null);
      res.end();
    }).catch(() => res.status(500).end());
    return;
  } else if (format === 'pdf') {
    const PDFDocument = require('pdfkit');
    filename = `rynex-leads-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    doc.pipe(res);
    doc.fontSize(16).fillColor('#000000').text('Rynex Technologies - Lead Export', { align: 'left' });
    doc.fontSize(9).fillColor('#555555').text(`Generated ${now()} UTC - ${rows.length} leads (demo/synthetic data marked accordingly)`).moveDown(0.5);
    const cols = [40, 170, 300, 430, 520, 600, 700];
    doc.fontSize(8).fillColor('#000000');
    ['ID', 'Company', 'Industry', 'Country', 'Score', 'Service', 'Status'].forEach((h, i) => doc.text(h, cols[i], doc.y, { lineBreak: false }));
    doc.moveTo(36, doc.y + 12).lineTo(790, doc.y + 12).strokeColor('#00D4FF').stroke();
    doc.moveDown(0.3);
    rows.slice(0, 800).forEach((r) => {
      const y = doc.y;
      if (y > 540) { doc.addPage(); }
      doc.fontSize(7.5).fillColor('#222222');
      doc.text(String(r.id), cols[0], doc.y, { lineBreak: false });
      doc.text(String(r.company || '').slice(0, 24), cols[1], doc.y, { lineBreak: false });
      doc.text(String(r.industry || '').slice(0, 18), cols[2], doc.y, { lineBreak: false });
      doc.text(String(r.country || '').slice(0, 14), cols[3], doc.y, { lineBreak: false });
      doc.text(String(r.lead_score), cols[4], doc.y, { lineBreak: false });
      doc.text(String(r.recommended_service || ''), cols[5], doc.y, { lineBreak: false });
      doc.text(String(r.status || ''), cols[6], doc.y, { lineBreak: false });
      doc.moveDown(0.35);
    });
    doc.end();
    db.prepare('INSERT INTO export_history (user_id, filename, format, scope, row_count) VALUES (?,?,?,?,?)')
      .run(req.user.uid, filename, 'pdf', 'leads', rows.length);
    logActivity(req.user.uid, req.user.name, `Exported ${rows.length} leads (pdf)`, 'export', null);
    return;
  } else {
    filename = `rynex-leads-${Date.now()}.csv`;
    const lines = [headers.map((h) => `"${h}"`).join(',')];
    rows.forEach((r) => lines.push([r.id, r.company, r.website, r.domain, r.industry, r.country, r.city, r.employee_count, r.revenue_band, r.contact_name, r.contact_role, r.contact_email, r.contact_phone, r.contact_linkedin, r.status, r.lead_score, r.intent, r.recommended_service, r.source, r.created_at].map(esc).map((v) => `"${v}"`).join(',')));
    payload = lines.join('\n');
    contentType = 'text/csv';
  }
  db.prepare('INSERT INTO export_history (user_id, filename, format, scope, row_count) VALUES (?,?,?,?,?)')
    .run(req.user.uid, filename, format, 'leads', rows.length);
  logActivity(req.user.uid, req.user.name, `Exported ${rows.length} leads (${format})`, 'export', null);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(payload);
});

router.get('/exports/history', (req, res) => {
  res.json({ history: db.prepare('SELECT e.*, u.name user_name FROM export_history e LEFT JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 50').all() });
});

// ================= IMPORTS =================
const importStaging = new Map(); // token -> { rows, columns }

router.post('/imports/parse', requireRole('manager', 'researcher', 'admin'), (req, res) => {
  const { content, filename } = req.body || {};
  if (!content) return res.status(400).json({ error: 'File content required' });
  let rows = [];
  const name = String(filename || '').toLowerCase();
  try {
    if (name.endsWith('.json')) {
      const parsed = JSON.parse(content);
      rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.leads) ? parsed.leads : [parsed];
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // content is base64
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      return wb.xlsx.load(Buffer.from(content, 'base64')).then((wb2) => {
        const ws = wb2.worksheets[0];
        const headers = [];
        ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value || '').trim(); });
        const out = [];
        ws.eachRow((row, rn) => {
          if (rn === 1) return;
          const obj = {};
          headers.forEach((h, ci) => { if (h) obj[h] = row.getCell(ci).value; });
          out.push(obj);
        });
        const token = crypto.randomBytes(8).toString('hex');
        importStaging.set(token, { rows: out, columns: Object.keys(out[0] || {}) });
        res.json({ ok: true, token, columns: Object.keys(out[0] || {}), rowCount: out.length, sample: out.slice(0, 5) });
      }).catch((e) => res.status(400).json({ error: 'Could not parse XLSX: ' + e.message }));
      return;
    } else {
      // CSV
      const text = String(content);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const parseLine = (line) => {
        const out = []; let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
          else if (ch === '"') inQ = true;
          else if (ch === ',') { out.push(cur); cur = ''; }
          else cur += ch;
        }
        out.push(cur); return out;
      };
      const headers = parseLine(lines[0]).map((h) => h.trim());
      rows = lines.slice(1).map((l) => {
        const vals = parseLine(l); const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i]);
        return obj;
      });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Could not parse file: ' + e.message });
  }
  const token = crypto.randomBytes(8).toString('hex');
  importStaging.set(token, { rows, columns: Object.keys(rows[0] || {}) });
  res.json({ ok: true, token, columns: Object.keys(rows[0] || {}), rowCount: rows.length, sample: rows.slice(0, 5) });
});

const FIELD_MAP = {
  company: ['company', 'company name', 'name', 'organization'],
  website: ['website', 'url', 'site', 'domain_url'],
  domain: ['domain', 'domain name'],
  industry: ['industry', 'sector', 'category'],
  country: ['country', 'location', 'geo'],
  city: ['city', 'town'],
  employees: ['employees', 'employee count', 'size', 'headcount'],
  revenue: ['revenue', 'revenue band', 'annual revenue'],
  contact: ['contact', 'contact name', 'full name'],
  role: ['role', 'title', 'job title', 'position'],
  email: ['email', 'email address', 'work email'],
  phone: ['phone', 'phone number', 'tel']
};

router.post('/imports/validate', requireRole('manager', 'researcher', 'admin'), (req, res) => {
  const { token, mapping } = req.body || {};
  const staged = importStaging.get(token);
  if (!staged) return res.status(400).json({ error: 'Import session expired - upload again' });
  const get = (row, field) => {
    for (const col of mapping[field] || []) if (row[col] != null && row[col] !== '') return row[col];
    return null;
  };
  const valid = [], invalid = [], duplicates = [];
  const seenDomains = new Set();
  for (const row of staged.rows) {
    const rec = {
      company: get(row, 'company'), website: get(row, 'website'), domain: get(row, 'domain'),
      industry: get(row, 'industry'), country: get(row, 'country'), city: get(row, 'city'),
      employees: get(row, 'employees'), revenue: get(row, 'revenue'), contact: get(row, 'contact'),
      role: get(row, 'role'), email: get(row, 'email'), phone: get(row, 'phone')
    };
    if (!rec.company) { invalid.push({ row: rec, reason: 'Company name missing' }); continue; }
    const domain = (rec.domain || (rec.email ? String(rec.email).split('@')[1] : '') || (rec.website ? String(rec.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '')).toLowerCase();
    if (domain) rec.domain = domain;
    if (domain) {
      if (seenDomains.has(domain)) { duplicates.push({ row: rec, reason: 'Duplicate within file' }); continue; }
      if (db.prepare('SELECT 1 FROM companies WHERE domain = ?').get(domain)) { duplicates.push({ row: rec, reason: 'Domain already in database' }); continue; }
      seenDomains.add(domain);
    }
    valid.push(rec);
  }
  const vtoken = crypto.randomBytes(8).toString('hex');
  importStaging.set(vtoken, { rows: valid, columns: staged.columns });
  res.json({ ok: true, token: vtoken, valid: valid.length, invalid: invalid.length, duplicates: duplicates.length, invalidSample: invalid.slice(0, 10), duplicateSample: duplicates.slice(0, 10) });
});

router.post('/imports/commit', requireRole('manager', 'researcher', 'admin'), (req, res) => {
  const { token } = req.body || {};
  const staged = importStaging.get(token);
  if (!staged) return res.status(400).json({ error: 'Import session expired - upload again' });
  const weights = require('../engines/intel').getWeights(getSetting('general', {}));
  let imported = 0;
  const tx = db.transaction(() => {
    for (const rec of staged.rows.slice(0, 5000)) {
      const c = db.prepare('INSERT INTO companies (name, website, domain, industry, country, city, employee_count, revenue_band, is_demo, enriched, data_confidence) VALUES (?,?,?,?,?,?,?,?,0,1,?)')
        .run(rec.company, rec.website, rec.domain, rec.industry, rec.country, rec.city, rec.employees ? Number(String(rec.employees).replace(/\D/g, '')) || null : null, rec.revenue, 'Medium');
      const companyId = Number(c.lastInsertRowid);
      let contactId = null;
      if (rec.contact) {
        const ct = db.prepare('INSERT INTO contacts (company_id, name, role, email, phone, email_status, is_primary, confidence, source) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(companyId, rec.contact, rec.role, rec.email, rec.phone, rec.email ? 'unverified' : null, 1, 'Low', 'Manual import');
        contactId = Number(ct.lastInsertRowid);
      }
      const l = db.prepare(`INSERT INTO leads (company_id, primary_contact_id, status, lead_score, score_category, source, discovery_method, is_demo, data_quality_score)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(companyId, contactId, 'New', 20, 'Low Potential', 'Manual Import', 'Import', 0, 8);
      void l; void weights;
      imported++;
    }
  });
  tx();
  importStaging.delete(token);
  logActivity(req.user.uid, req.user.name, `Imported ${imported} leads`, 'import', null);
  res.json({ ok: true, imported });
});

// Re-export for tests
router._encryptSecret = encryptSecret;
router._decryptSecret = decryptSecret;

module.exports = router;
