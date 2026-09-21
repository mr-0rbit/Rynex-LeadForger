const express = require('express');
const { db, logActivity, now } = require('../db');
const { authenticate, requireRole, clean } = require('../auth');
const intel = require('../engines/intel');

const router = express.Router();
router.use(authenticate);

const LEAD_SELECT = `
  SELECT l.*, c.name AS company, c.website, c.domain, c.industry, c.country, c.city,
         c.employee_count, c.revenue_band, c.business_model, c.description AS company_description,
         c.data_confidence AS company_data_confidence, c.created_at AS company_created_at,
         ct.name AS contact_name, ct.role AS contact_role, ct.email AS contact_email,
         ct.phone AS contact_phone, ct.linkedin_url AS contact_linkedin
  FROM leads l
  JOIN companies c ON c.id = l.company_id
  LEFT JOIN contacts ct ON ct.id = l.primary_contact_id
`;

const SORTABLE = {
  score: 'l.lead_score', intent: 'l.intent_score', created: 'l.created_at', updated: 'l.updated_at',
  company: 'c.name COLLATE NOCASE', country: 'c.country', status: 'l.status', service: 'l.recommended_service'
};

router.get('/leads', (req, res) => {
  const { q, status, country, industry, service, intent, method, source, tech, signal, compliance, tag,
    minScore, maxScore, size, revenue, freshness, createdFrom, createdTo } = req.query;
  const sort = SORTABLE[req.query.sort] || 'l.created_at';
  const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize) || 50));

  const where = [], params = [];
  if (q) {
    where.push(`(c.name LIKE ? OR c.domain LIKE ? OR ct.name LIKE ? OR ct.email LIKE ? OR c.industry LIKE ? OR l.recommended_service LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (status) { const arr = String(status).split(','); where.push(`l.status IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (country) { const arr = String(country).split(','); where.push(`c.country IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (industry) { const arr = String(industry).split(','); where.push(`c.industry IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (service) { const arr = String(service).split(','); where.push(`l.recommended_service IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (intent) { const arr = String(intent).split(','); where.push(`l.intent IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (method) { const arr = String(method).split(','); where.push(`l.discovery_method IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (minScore) { where.push('l.lead_score >= ?'); params.push(Number(minScore)); }
  if (maxScore) { where.push('l.lead_score <= ?'); params.push(Number(maxScore)); }
  if (size) {
    const parts = String(size).split(',').map((s) => {
      const [a, b] = s.split('-').map(Number);
      return `(c.employee_count BETWEEN ${Number(a) || 0} AND ${Number(b) || 1000000})`;
    });
    if (parts.length) where.push(`(${parts.join(' OR ')})`);
  }
  if (revenue) { const arr = String(revenue).split(','); where.push(`c.revenue_band IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (req.query.isDemo !== undefined && req.query.isDemo !== '') {
    where.push('l.is_demo = ?');
    params.push(Number(req.query.isDemo));
  }
  if (createdFrom) { where.push('l.created_at >= ?'); params.push(createdFrom); }
  if (createdTo) { where.push('l.created_at <= ?'); params.push(createdTo + ' 23:59:59'); }
  if (freshness) {
    const days = Number(freshness);
    if (days > 0) { where.push(`l.created_at >= datetime('now', ?)`); params.push(`-${days} days`); }
  }
  if (tech) {
    const arr = String(tech).split(',');
    where.push(`l.company_id IN (SELECT company_id FROM company_technologies WHERE technology IN (${arr.map(() => '?').join(',')}))`);
    params.push(...arr);
  }
  if (signal) {
    const arr = String(signal).split(',');
    where.push(`l.id IN (SELECT lead_id FROM lead_signals WHERE signal_type IN (${arr.map(() => '?').join(',')}))`);
    params.push(...arr);
  }
  if (compliance) {
    const arr = String(compliance).split(',');
    where.push(`l.company_id IN (SELECT company_id FROM company_compliance WHERE framework IN (${arr.map(() => '?').join(',')}))`);
    params.push(...arr);
  }
  if (tag) {
    const arr = String(tag).split(',');
    where.push(`l.id IN (SELECT lead_id FROM lead_tags WHERE tag_id IN (SELECT id FROM tags WHERE name IN (${arr.map(() => '?').join(',')})))`);
    params.push(...arr);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM leads l JOIN companies c ON c.id=l.company_id LEFT JOIN contacts ct ON ct.id=l.primary_contact_id ${whereSql}`).get(...params).c;

  const rows = db.prepare(`${LEAD_SELECT} ${whereSql} ORDER BY ${sort} ${dir} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  // facet counts for filter UI
  const facets = {
    countries: db.prepare(`SELECT DISTINCT c.country v, COUNT(*) n FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY n DESC`).all(),
    industries: db.prepare(`SELECT DISTINCT c.industry v, COUNT(*) n FROM leads l JOIN companies c ON c.id=l.company_id GROUP BY 1 ORDER BY n DESC`).all(),
    services: db.prepare(`SELECT DISTINCT l.recommended_service v, COUNT(*) n FROM leads l GROUP BY 1 ORDER BY n DESC`).all(),
    methods: db.prepare(`SELECT DISTINCT l.discovery_method v, COUNT(*) n FROM leads l GROUP BY 1 ORDER BY n DESC`).all(),
    statuses: db.prepare(`SELECT l.status v, COUNT(*) n FROM leads l GROUP BY 1`).all()
  };

  res.json({ leads: rows, total, page, pageSize, facets });
});

// Live Domain Reconnaissance & Prospecting
const realrecon = require('../engines/realrecon');
const { getSetting } = require('../db');

router.post('/leads/prospect', async (req, res) => {
  try {
    const { domain, name, industry, country, city } = req.body || {};
    if (!domain) return res.status(400).json({ error: 'Domain is required' });

    const recon = await realrecon.performFullRecon(domain, { name, industry, country, city });

    // Deduplication check
    let existingCompany = db.prepare('SELECT id FROM companies WHERE domain = ?').get(recon.domain);
    let companyId;
    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const ins = db.prepare(`
        INSERT INTO companies (name, website, domain, industry, business_model, description, country, city, is_demo, enriched, data_confidence)
        VALUES (?, ?, ?, ?, 'Digital / Online', ?, ?, ?, 0, 1, 'High')
      `).run(recon.companyName, recon.website, recon.domain, recon.industry, recon.description, recon.country, recon.city);
      companyId = Number(ins.lastInsertRowid);
    }

    // Insert contacts
    let primaryContactId = null;
    for (const ct of recon.contacts) {
      const existsCt = db.prepare('SELECT id FROM contacts WHERE company_id = ? AND email = ?').get(companyId, ct.email);
      if (!existsCt) {
        const cIns = db.prepare(`
          INSERT INTO contacts (company_id, name, role, email, email_status, is_primary, confidence, source)
          VALUES (?, ?, ?, ?, 'unverified', ?, ?, ?)
        `).run(companyId, ct.name, ct.role, ct.email, ct.is_primary, ct.confidence, ct.source);
        if (ct.is_primary) primaryContactId = Number(cIns.lastInsertRowid);
      } else if (ct.is_primary) {
        primaryContactId = existsCt.id;
      }
    }

    // Insert technologies
    for (const t of recon.technologies) {
      db.prepare(`
        INSERT OR IGNORE INTO company_technologies (company_id, technology, category, confidence, source)
        VALUES (?, ?, ?, ?, ?)
      `).run(companyId, t.technology, t.category, t.confidence, t.source);
    }

    // Insert compliance
    for (const c of recon.compliance) {
      db.prepare(`
        INSERT OR IGNORE INTO company_compliance (company_id, framework, status, evidence, confidence)
        VALUES (?, ?, ?, ?, ?)
      `).run(companyId, c.framework, c.status, c.evidence, c.confidence);
    }

    // Calculate 5-pillar score
    const weights = intel.getWeights(getSetting('general', {}));
    const companyObj = {
      id: companyId,
      name: recon.companyName,
      domain: recon.domain,
      industry: recon.industry,
      country: recon.country,
      employee_count: 50,
      data_confidence: 'High'
    };
    const score = intel.scoreLead(companyObj, {
      signals: recon.signals,
      compliance: recon.compliance,
      tech: recon.technologies,
      evidence: recon.evidence,
      contacts: recon.contacts,
      weights
    });

    // Insert or update lead
    let leadId;
    const existingLead = db.prepare('SELECT id FROM leads WHERE company_id = ?').get(companyId);
    if (existingLead) {
      leadId = existingLead.id;
      db.prepare(`
        UPDATE leads SET
          lead_score = ?, score_category = ?, company_fit_score = ?, security_signal_score = ?,
          intent_score = ?, service_fit_score = ?, data_quality_score = ?, intent = ?,
          recommended_service = ?, service_relevance = ?, is_demo = 0, updated_at = ?
        WHERE id = ?
      `).run(
        score.lead_score, score.score_category, score.breakdown.company_fit, score.breakdown.security_signals,
        score.breakdown.intent, score.breakdown.service_fit, score.breakdown.data_quality, score.intent,
        score.relevance.primary.service, JSON.stringify(score.relevance.all), now(), leadId
      );
    } else {
      const lIns = db.prepare(`
        INSERT INTO leads (
          company_id, primary_contact_id, status, lead_score, score_category,
          company_fit_score, security_signal_score, intent_score, service_fit_score, data_quality_score,
          intent, recommended_service, service_relevance, confidence, source, source_url, discovery_method, is_demo
        ) VALUES (?, ?, 'Qualified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'High', 'Live Passive Recon', ?, 'Domain Intelligence', 0)
      `).run(
        companyId, primaryContactId, score.lead_score, score.score_category,
        score.breakdown.company_fit, score.breakdown.security_signals, score.breakdown.intent, score.breakdown.service_fit, score.breakdown.data_quality,
        score.intent, score.relevance.primary.service, JSON.stringify(score.relevance.all), recon.website
      );
      leadId = Number(lIns.lastInsertRowid);
    }

    // Insert evidence
    for (const e of recon.evidence) {
      db.prepare(`
        INSERT INTO lead_evidence (lead_id, evidence_type, title, description, source_name, source_url, observed_at, confidence, related_service)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(leadId, e.evidence_type, e.title, e.description, e.source_name, e.source_url, e.observed_at, e.confidence, e.related_service);
    }

    // Insert signals
    for (const s of recon.signals) {
      db.prepare(`
        INSERT INTO lead_signals (lead_id, signal_type, category, title, confidence, relevant_services)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(leadId, s.signal_type, s.category, s.title, s.confidence, s.relevant_services);
    }

    logActivity(req.user.uid, req.user.name, `Prospected live domain ${recon.domain}`, 'lead', leadId, `Score ${score.lead_score} · ${score.relevance.primary.service}`);

    res.json({ ok: true, leadId, company: recon.companyName, domain: recon.domain, score: score.lead_score, service: score.relevance.primary.service, recon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint to purge synthetic demo data
router.delete('/leads/demo', requireRole('admin'), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM leads WHERE is_demo = 1').get().c;
  db.prepare('DELETE FROM leads WHERE is_demo = 1').run();
  db.prepare('DELETE FROM companies WHERE is_demo = 1').run();
  logActivity(req.user.uid, req.user.name, `Purged ${count} synthetic demo leads`, 'lead', null, null);
  res.json({ ok: true, purged: count });
});

router.get('/leads/export-query', (req, res) => {
  // returns ids matching current filters (used by export center)
  res.json({ ok: true });
});

router.get('/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  const lead = db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).get(id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const evidence = db.prepare('SELECT * FROM lead_evidence WHERE lead_id = ? ORDER BY observed_at DESC').all(id);
  const signals = db.prepare('SELECT * FROM lead_signals WHERE lead_id = ? ORDER BY detected_at DESC').all(id);
  const tech = db.prepare('SELECT * FROM company_technologies WHERE company_id = ?').all(lead.company_id);
  const compliance = db.prepare('SELECT * FROM company_compliance WHERE company_id = ?').all(lead.company_id);
  const sources = db.prepare('SELECT * FROM lead_sources WHERE lead_id = ?').all(id);
  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC, id').all(lead.company_id);
  const notes = db.prepare('SELECT n.*, u.name user_name FROM notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.lead_id = ? ORDER BY n.created_at DESC').all(id);
  const tasks = db.prepare('SELECT t.*, u.name assigned_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.lead_id = ? ORDER BY t.due_date').all(id);
  const tags = db.prepare('SELECT t.id, t.name FROM tags t JOIN lead_tags lt ON lt.tag_id=t.id WHERE lt.lead_id = ?').all(id);
  const drafts = db.prepare('SELECT id, subject, status, personalization, created_at FROM email_drafts WHERE lead_id = ? ORDER BY created_at DESC').all(id);
  const events = db.prepare('SELECT e.* FROM email_events e WHERE e.lead_id = ? ORDER BY occurred_at DESC LIMIT 20').all(id);
  const allTags = db.prepare('SELECT * FROM tags ORDER BY name').all();
  const relevance = lead.service_relevance ? JSON.parse(lead.service_relevance) : [];
  res.json({ lead, evidence, signals, tech, compliance, sources, contacts, notes, tasks, tags, allTags, drafts, events, relevance });
});

router.patch('/leads/:id', requireRole('manager', 'researcher'), (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['status'];
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (req.body.status) {
    if (!intel.LEAD_STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(req.body.status, now(), id);
    logActivity(req.user.uid, req.user.name, `Lead status changed to ${req.body.status}`, 'lead', id, lead.status + ' -> ' + req.body.status);
  }
  res.json({ ok: true });
});

router.post('/leads/bulk', requireRole('manager', 'researcher'), (req, res) => {
  const { ids, action, value } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No leads selected' });
  const capped = ids.slice(0, 1000);
  if (action === 'status') {
    if (!intel.LEAD_STATUSES.includes(value)) return res.status(400).json({ error: 'Invalid status' });
    const upd = db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?');
    const tx = db.transaction(() => capped.forEach((id) => upd.run(value, now(), id)));
    tx();
    logActivity(req.user.uid, req.user.name, `Bulk status update (${capped.length} leads)`, 'lead', null, `Status -> ${value}`);
  } else if (action === 'tag') {
    let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(value);
    if (!tag) { const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(value); tag = { id: Number(r.lastInsertRowid) }; }
    const ins = db.prepare('INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?,?)');
    const tx = db.transaction(() => capped.forEach((id) => ins.run(id, tag.id)));
    tx();
    logActivity(req.user.uid, req.user.name, `Bulk tag (${capped.length} leads)`, 'lead', null, `Tag -> ${value}`);
  } else if (action === 'delete') {
    const del = db.prepare('DELETE FROM leads WHERE id = ?');
    const tx = db.transaction(() => capped.forEach((id) => del.run(id)));
    tx();
    logActivity(req.user.uid, req.user.name, `Deleted ${capped.length} leads`, 'lead', null, null);
  } else return res.status(400).json({ error: 'Unknown action' });
  res.json({ ok: true, count: capped.length });
});

router.post('/leads/:id/notes', (req, res) => {
  const id = Number(req.params.id);
  const body = clean(req.body.body, 4000);
  if (!body) return res.status(400).json({ error: 'Note text required' });
  db.prepare('INSERT INTO notes (lead_id, user_id, body) VALUES (?,?,?)').run(id, req.user.uid, body);
  logActivity(req.user.uid, req.user.name, 'Added lead note', 'lead', id);
  res.json({ ok: true });
});

router.post('/leads/:id/tasks', requireRole('manager', 'researcher', 'sales'), (req, res) => {
  const id = Number(req.params.id);
  const title = clean(req.body.title, 200);
  if (!title) return res.status(400).json({ error: 'Task title required' });
  db.prepare('INSERT INTO tasks (lead_id, title, type, due_date, priority, assigned_to) VALUES (?,?,?,?,?,?)')
    .run(id, title, clean(req.body.type, 40) || 'Follow up', clean(req.body.due_date, 10), clean(req.body.priority, 10) || 'Medium', req.user.uid);
  logActivity(req.user.uid, req.user.name, 'Created follow-up task', 'lead', id, title);
  res.json({ ok: true });
});

router.post('/leads/:id/tags', (req, res) => {
  const id = Number(req.params.id);
  const name = clean(req.body.name, 60);
  if (!name) return res.status(400).json({ error: 'Tag name required' });
  let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (!tag) tag = { id: Number(db.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid) };
  db.prepare('INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?,?)').run(id, tag.id);
  res.json({ ok: true });
});

router.delete('/leads/:id/tags/:tagId', (req, res) => {
  db.prepare('DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?').run(Number(req.params.id), Number(req.params.tagId));
  res.json({ ok: true });
});

// ---------- companies / contacts / evidence ----------
router.get('/companies', (req, res) => {
  const { q } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, parseInt(req.query.pageSize) || 50);
  const where = q ? 'WHERE c.name LIKE ? OR c.domain LIKE ? OR c.industry LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [];
  const total = db.prepare(`SELECT COUNT(*) c FROM companies c ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM leads l WHERE l.company_id = c.id) lead_count,
           (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) contact_count,
           (SELECT GROUP_CONCAT(technology, ', ') FROM (SELECT technology FROM company_technologies WHERE company_id = c.id LIMIT 5)) tech_summary
    FROM companies c ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  res.json({ companies: rows, total, page, pageSize });
});

router.get('/contacts', (req, res) => {
  const { q, companyId } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, parseInt(req.query.pageSize) || 50);
  const where = [], params = [];
  if (q) { where.push('(ct.name LIKE ? OR ct.email LIKE ? OR ct.role LIKE ? OR c.name LIKE ?)'); const like = `%${q}%`; params.push(like, like, like, like); }
  if (companyId) { where.push('ct.company_id = ?'); params.push(Number(companyId)); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM contacts ct JOIN companies c ON c.id=ct.company_id ${whereSql}`).get(...params).c;
  const rows = db.prepare(`
    SELECT ct.*, c.name company, c.country, c.domain,
      (SELECT l.id FROM leads l WHERE l.company_id = ct.company_id LIMIT 1) lead_id
    FROM contacts ct JOIN companies c ON c.id = ct.company_id ${whereSql}
    ORDER BY ct.id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  res.json({ contacts: rows, total, page, pageSize });
});

router.get('/evidence', (req, res) => {
  const { q, type, confidence, days } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, parseInt(req.query.pageSize) || 50);
  const where = [], params = [];
  if (q) { where.push('(e.title LIKE ? OR e.description LIKE ? OR c.name LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  if (type) { const arr = String(type).split(','); where.push(`e.evidence_type IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (confidence) { const arr = String(confidence).split(','); where.push(`e.confidence IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (days) { where.push(`e.observed_at >= date('now', ?)`); params.push(`-${Number(days)} days`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) c FROM lead_evidence e JOIN leads l ON l.id=e.lead_id JOIN companies c ON c.id=l.company_id ${whereSql}`).get(...params).c;
  const rows = db.prepare(`
    SELECT e.*, c.name company, c.country, l.id lead_id, l.lead_score, l.status, l.recommended_service
    FROM lead_evidence e JOIN leads l ON l.id=e.lead_id JOIN companies c ON c.id=l.company_id ${whereSql}
    ORDER BY e.observed_at DESC, e.id DESC LIMIT ? OFFSET ?`).all(...params, pageSize, (page - 1) * pageSize);
  const types = db.prepare('SELECT DISTINCT evidence_type v, COUNT(*) n FROM lead_evidence GROUP BY 1 ORDER BY n DESC').all();
  res.json({ evidence: rows, total, page, pageSize, types });
});

// ---------- global search ----------
router.get('/search', (req, res) => {
  const q = clean(req.query.q, 120);
  if (!q) return res.json({ results: [] });
  const like = `%${q}%`;
  const results = [];
  for (const r of db.prepare('SELECT id, name, domain, industry, country FROM companies WHERE name LIKE ? OR domain LIKE ? LIMIT 6').all(like, like)) {
    results.push({ type: 'Company', label: r.name, sub: `${r.industry || ''} - ${r.country || ''}`, leadId: (db.prepare('SELECT id FROM leads WHERE company_id=? LIMIT 1').get(r.id) || {}).id });
  }
  for (const r of db.prepare('SELECT ct.name, ct.email, ct.role, c.name company FROM contacts ct JOIN companies c ON c.id=ct.company_id WHERE ct.name LIKE ? OR ct.email LIKE ? LIMIT 6').all(like, like)) {
    results.push({ type: 'Contact', label: r.name, sub: `${r.role || ''} at ${r.company}`, company: r.company });
  }
  for (const r of db.prepare('SELECT DISTINCT industry v FROM companies WHERE industry LIKE ? LIMIT 4').all(like)) results.push({ type: 'Industry', label: r.v, sub: 'Industry' });
  for (const r of db.prepare('SELECT DISTINCT country v FROM companies WHERE country LIKE ? LIMIT 4').all(like)) results.push({ type: 'Country', label: r.v, sub: 'Country' });
  for (const r of db.prepare('SELECT id, name FROM campaigns WHERE name LIKE ? LIMIT 4').all(like)) results.push({ type: 'Campaign', label: r.name, sub: 'Campaign' });
  for (const r of db.prepare('SELECT DISTINCT technology v FROM company_technologies WHERE technology LIKE ? LIMIT 4').all(like)) results.push({ type: 'Technology', label: r.v, sub: 'Technology' });
  for (const r of db.prepare(`SELECT e.title, l.id lead_id, c.name company FROM lead_evidence e JOIN leads l ON l.id=e.lead_id JOIN companies c ON c.id=l.company_id WHERE e.title LIKE ? OR e.description LIKE ? LIMIT 6`).all(like, like)) {
    results.push({ type: 'Evidence', label: r.title, sub: r.company, leadId: r.lead_id });
  }
  for (const r of db.prepare('SELECT framework v FROM company_compliance WHERE framework LIKE ? GROUP BY 1 LIMIT 4').all(like)) results.push({ type: 'Compliance', label: r.v, sub: 'Framework' });
  res.json({ results: results.slice(0, 25) });
});

// ---------- meta (filter option lists) ----------
router.get('/meta', (req, res) => {
  res.json({
    industries: intel.INDUSTRIES, revenueBands: intel.REVENUE_BANDS, countries: Object.keys(intel.COUNTRIES),
    cities: intel.COUNTRIES, signals: intel.SECURITY_SIGNAL_TYPES, frameworks: intel.COMPLIANCE_FRAMEWORKS,
    technologies: intel.TECHNOLOGIES, services: intel.SERVICES, statuses: intel.LEAD_STATUSES,
    securityRoles: intel.SECURITY_ROLES
  });
});

module.exports = router;
