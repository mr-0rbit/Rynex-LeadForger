const express = require('express');
const { db, logActivity, now, getSetting } = require('../db');
const { authenticate, requireRole, clean } = require('../auth');
const { generateEmail, safetyChecks } = require('../engines/emailgen');

const router = express.Router();
router.use(authenticate);

// ---------- campaigns ----------
router.get('/campaigns', (req, res) => {
  const rows = db.prepare(`
    SELECT cp.*, u.name created_by_name,
      (SELECT COUNT(*) FROM campaign_leads cl WHERE cl.campaign_id = cp.id) lead_count,
      (SELECT COUNT(*) FROM email_drafts d WHERE d.campaign_id = cp.id AND d.status = 'Sent') sent_count,
      (SELECT COUNT(*) FROM email_drafts d WHERE d.campaign_id = cp.id AND d.status IN ('Draft','Pending Review','Approved','Scheduled')) pipeline_count
    FROM campaigns cp LEFT JOIN users u ON u.id = cp.created_by ORDER BY cp.created_at DESC`).all();
  res.json({ campaigns: rows.map((r) => ({ ...r, segment: JSON.parse(r.segment_json || '{}') })) });
});

router.post('/campaigns', requireRole('manager', 'admin'), (req, res) => {
  const { name, description, segment, primaryService, personalization, status } = req.body || {};
  if (!clean(name, 120)) return res.status(400).json({ error: 'Campaign name required' });
  const r = db.prepare('INSERT INTO campaigns (name, description, segment_json, primary_service, personalization, status, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(clean(name, 120), clean(description, 1000), JSON.stringify(segment || {}), clean(primaryService, 40) || 'VAPT', personalization || 'Deep Research', status || 'Draft', req.user.uid);
  logActivity(req.user.uid, req.user.name, 'Created campaign', 'campaign', Number(r.lastInsertRowid), name);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

router.get('/campaigns/:id', (req, res) => {
  const c = db.prepare('SELECT cp.*, u.name created_by_name FROM campaigns cp LEFT JOIN users u ON u.id=cp.created_by WHERE cp.id = ?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const leads = db.prepare(`
    SELECT l.id, l.lead_score, l.status, l.intent, l.recommended_service, c.name company, c.country, c.industry,
      (SELECT subject FROM email_drafts d WHERE d.lead_id = l.id AND d.campaign_id = ? LIMIT 1) draft_subject,
      (SELECT status FROM email_drafts d WHERE d.lead_id = l.id AND d.campaign_id = ? LIMIT 1) draft_status
    FROM campaign_leads cl JOIN leads l ON l.id = cl.lead_id JOIN companies c ON c.id = l.company_id
    WHERE cl.campaign_id = ? ORDER BY l.lead_score DESC LIMIT 500`).all(c.id, c.id, c.id);
  const stats = {
    leads: leads.length,
    qualified: leads.filter((l) => l.lead_score >= 75).length,
    drafted: leads.filter((l) => l.draft_status).length,
    sent: leads.filter((l) => l.draft_status === 'Sent').length
  };
  res.json({ campaign: { ...c, segment: JSON.parse(c.segment_json || '{}') }, leads, stats });
});

router.post('/campaigns/:id/leads', requireRole('manager', 'admin'), (req, res) => {
  const cid = Number(req.params.id);
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'No leads selected' });
  const ins = db.prepare('INSERT OR IGNORE INTO campaign_leads (campaign_id, lead_id) VALUES (?,?)');
  const tx = db.transaction(() => ids.slice(0, 1000).forEach((id) => ins.run(cid, Number(id))));
  tx();
  logActivity(req.user.uid, req.user.name, 'Added leads to campaign', 'campaign', cid, `${ids.length} leads`);
  res.json({ ok: true });
});

router.patch('/campaigns/:id', requireRole('manager', 'admin'), (req, res) => {
  const { status } = req.body || {};
  const allowed = ['Draft', 'Active', 'Paused', 'Completed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  logActivity(req.user.uid, req.user.name, `Campaign status -> ${status}`, 'campaign', req.params.id);
  res.json({ ok: true });
});

// Suggest leads matching a campaign segment
router.post('/campaigns/:id/suggest', async (req, res) => {
  const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const seg = JSON.parse(c.segment_json || '{}');
  const where = [], params = [];
  if (seg.countries && seg.countries.length) { where.push(`c.country IN (${seg.countries.map(() => '?').join(',')})`); params.push(...seg.countries); }
  if (seg.industries && seg.industries.length) { where.push(`c.industry IN (${seg.industries.map(() => '?').join(',')})`); params.push(...seg.industries); }
  if (seg.employeesMin != null) { where.push('c.employee_count >= ?'); params.push(Number(seg.employeesMin)); }
  if (seg.employeesMax != null) { where.push('c.employee_count <= ?'); params.push(Number(seg.employeesMax)); }
  where.push('l.lead_score >= ?'); params.push(Number(seg.minScore) || 0);
  where.push(`l.id NOT IN (SELECT lead_id FROM campaign_leads WHERE campaign_id = ?)`); params.push(c.id);
  const rows = db.prepare(`
    SELECT l.id, l.lead_score, l.status, l.recommended_service, l.intent, c.name company, c.country, c.industry, c.employee_count
    FROM leads l JOIN companies c ON c.id = l.company_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY l.lead_score DESC LIMIT 100`).all(...params);
  res.json({ suggestions: rows });
});

// ---------- email generation ----------
router.get('/emails/context/:leadId', (req, res) => {
  const leadId = Number(req.params.leadId);
  const row = db.prepare(`
    SELECT l.*, c.name company, c.website, c.domain, c.industry, c.country, c.city, c.employee_count,
      c.revenue_band, c.business_model, c.description company_description
    FROM leads l JOIN companies c ON c.id = l.company_id WHERE l.id = ?`).get(leadId);
  if (!row) return res.status(404).json({ error: 'Lead not found' });
  const evidence = db.prepare('SELECT * FROM lead_evidence WHERE lead_id = ? ORDER BY confidence DESC, observed_at DESC').all(leadId);
  const signals = db.prepare('SELECT * FROM lead_signals WHERE lead_id = ?').all(leadId);
  const compliance = db.prepare('SELECT framework FROM company_compliance WHERE company_id = ?').all(row.company_id);
  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ? AND email IS NOT NULL ORDER BY is_primary DESC').all(row.company_id);
  res.json({ lead: { ...row, evidence, signals, compliance }, contacts });
});

router.post('/emails/generate', requireRole('manager', 'sales', 'admin', 'researcher'), (req, res) => {
  const { leadId, contactId, level, campaignId } = req.body || {};
  const ctx = db.prepare(`
    SELECT l.*, c.name company, c.website, c.domain, c.industry, c.country, c.city, c.employee_count, c.revenue_band, c.business_model
    FROM leads l JOIN companies c ON c.id = l.company_id WHERE l.id = ?`).get(Number(leadId));
  if (!ctx) return res.status(404).json({ error: 'Lead not found' });
  const evidence = db.prepare('SELECT * FROM lead_evidence WHERE lead_id = ? ORDER BY confidence DESC, observed_at DESC').all(Number(leadId));
  const signals = db.prepare('SELECT * FROM lead_signals WHERE lead_id = ?').all(Number(leadId));
  const compliance = db.prepare('SELECT framework FROM company_compliance WHERE company_id = ?').all(ctx.company_id);
  const contact = contactId ? db.prepare('SELECT * FROM contacts WHERE id = ?').get(Number(contactId))
    : db.prepare('SELECT * FROM contacts WHERE company_id = ? AND email IS NOT NULL ORDER BY is_primary DESC LIMIT 1').get(ctx.company_id);

  // Suppression / do-not-contact gate
  if (ctx.status === 'Do Not Contact') return res.status(400).json({ error: 'Lead is marked Do Not Contact.' });
  const supp = db.prepare(`SELECT 1 FROM suppression WHERE (type='domain' AND lower(value)=lower(?)) OR (type='email' AND ? IS NOT NULL AND lower(value)=lower(?))`).get(ctx.domain || '', contact ? contact.email : null, contact ? contact.email : '');
  if (supp) return res.status(400).json({ error: 'This company or recipient is on the suppression list.' });

  const company = {
    name: ctx.company, domain: ctx.domain, website: ctx.website, industry: ctx.industry,
    country: ctx.country, city: ctx.city, employee_count: ctx.employee_count,
    revenue_band: ctx.revenue_band, business_model: ctx.business_model
  };
  const result = generateEmail({ ...ctx, evidence, signals, compliance }, company, contact, level || 'Deep Research');
  res.json({ ...result, contact, lead: { id: ctx.id, company: ctx.company, lead_score: ctx.lead_score, recommended_service: ctx.recommended_service } });
});

router.post('/emails/drafts', requireRole('manager', 'sales', 'admin', 'researcher'), (req, res) => {
  const { leadId, campaignId, contactId, subject, body, personalization, evidenceConfidence, status, checks } = req.body || {};
  if (!clean(subject, 200) || !body) return res.status(400).json({ error: 'Subject and body required' });
  const st = ['Draft', 'Pending Review', 'Approved', 'Scheduled'].includes(status) ? status : 'Draft';
  const r = db.prepare(`INSERT INTO email_drafts (lead_id, campaign_id, contact_id, personalization, subject, body, status, evidence_confidence, safety_checks, scheduled_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(Number(leadId), campaignId ? Number(campaignId) : null, contactId ? Number(contactId) : null,
      personalization || 'Deep Research', clean(subject, 200), String(body).slice(0, 20000), st,
      evidenceConfidence || 'Medium', JSON.stringify(checks || {}), st === 'Scheduled' ? req.body.scheduled_at || null : null);
  logActivity(req.user.uid, req.user.name, 'Saved email draft', 'lead', leadId, subject);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

router.get('/emails/drafts', (req, res) => {
  const { status, campaignId, q } = req.query;
  const where = [], params = [];
  if (status) { const arr = String(status).split(','); where.push(`d.status IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
  if (campaignId) { where.push('d.campaign_id = ?'); params.push(Number(campaignId)); }
  if (q) { where.push('(d.subject LIKE ? OR c.name LIKE ? OR ct.name LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT d.*, c.name company, c.domain, ct.name contact_name, ct.email contact_email, l.lead_score, l.recommended_service
    FROM email_drafts d JOIN leads l ON l.id = d.lead_id JOIN companies c ON c.id = l.company_id
    LEFT JOIN contacts ct ON ct.id = d.contact_id
    ${whereSql} ORDER BY d.updated_at DESC LIMIT 300`).all(...params);
  const counts = db.prepare('SELECT status, COUNT(*) n FROM email_drafts GROUP BY status').all();
  res.json({ drafts: rows, counts });
});

router.get('/emails/drafts/:id', (req, res) => {
  const d = db.prepare(`
    SELECT d.*, c.name company, c.domain, l.lead_score, l.recommended_service
    FROM email_drafts d JOIN leads l ON l.id = d.lead_id JOIN companies c ON c.id = l.company_id WHERE d.id = ?`).get(Number(req.params.id));
  if (!d) return res.status(404).json({ error: 'Draft not found' });
  const events = db.prepare('SELECT * FROM email_events WHERE draft_id = ? ORDER BY occurred_at').all(d.id);
  res.json({ draft: d, events: events });
});

router.patch('/emails/drafts/:id', requireRole('manager', 'sales', 'admin'), (req, res) => {
  const id = Number(req.params.id);
  const d = db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id);
  if (!d) return res.status(404).json({ error: 'Draft not found' });
  const { subject, body, status, scheduled_at } = req.body || {};
  const allowed = ['Draft', 'Pending Review', 'Approved', 'Scheduled', 'Sent', 'Rejected'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  // Approval workflow: sending requires an Approved draft and an SMTP provider configured.
  if (status === 'Sent') {
    if (d.status !== 'Approved' && d.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Draft must be Approved before sending.' });
    }
    const outreach = getSetting('outreach', {});
    if (outreach.require_approval && d.status === 'Draft') {
      return res.status(400).json({ error: 'Sending requires approval (settings.outreach.require_approval).' });
    }
    db.prepare('UPDATE email_drafts SET status=?, sent_at=?, updated_at=? WHERE id=?').run('Sent', now(), now(), id);
    db.prepare('INSERT INTO email_events (draft_id, lead_id, event) VALUES (?,?,?)').run(id, d.lead_id, 'sent');
    db.prepare('UPDATE leads SET status = ?, last_contacted_at = ?, updated_at = ? WHERE id = ? AND status NOT IN ("Won","Lost")')
      .run('Email Sent', now().slice(0, 10), now(), d.lead_id);
    logActivity(req.user.uid, req.user.name, 'Email sent', 'draft', id, d.subject);
    return res.json({ ok: true });
  }

  db.prepare(`UPDATE email_drafts SET subject = COALESCE(?, subject), body = COALESCE(?, body), status = COALESCE(?, status), scheduled_at = COALESCE(?, scheduled_at), updated_at = ? WHERE id = ?`)
    .run(clean(subject, 200) || null, body ? String(body).slice(0, 20000) : null, status || null, scheduled_at || null, now(), id);
  if (status === 'Rejected') logActivity(req.user.uid, req.user.name, 'Email draft rejected', 'draft', id);
  else if (status === 'Approved') logActivity(req.user.uid, req.user.name, 'Email draft approved', 'draft', id);
  else logActivity(req.user.uid, req.user.name, 'Updated email draft', 'draft', id);
  res.json({ ok: true });
});

// Simulated engagement tracking (demo mode): record an event on a sent draft
router.post('/emails/drafts/:id/events', requireRole('manager', 'admin'), (req, res) => {
  const id = Number(req.params.id);
  const { event } = req.body || {};
  const allowed = ['opened', 'replied', 'bounced', 'unsubscribed', 'clicked'];
  if (!allowed.includes(event)) return res.status(400).json({ error: 'Invalid event' });
  const d = db.prepare('SELECT * FROM email_drafts WHERE id = ?').get(id);
  if (!d || d.status !== 'Sent') return res.status(400).json({ error: 'Event requires a Sent draft' });
  db.prepare('INSERT INTO email_events (draft_id, lead_id, event) VALUES (?,?,?)').run(id, d.lead_id, event);
  if (event === 'opened') db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND status = "Email Sent"').run('Opened', now(), d.lead_id);
  if (event === 'replied') db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run('Replied', now(), d.lead_id);
  if (event === 'unsubscribed' || event === 'bounced') {
    const email = db.prepare('SELECT email FROM contacts WHERE id = ?').get(d.contact_id);
    const domain = email ? String(email.email).split('@')[1] : null;
    if (domain) db.prepare('INSERT OR IGNORE INTO suppression (type, value, reason, list) VALUES (?,?,?,?)').run('domain', domain, event === 'bounced' ? 'Hard bounce' : 'Unsubscribed', 'suppression');
  }
  logActivity(req.user.uid, req.user.name, `Recorded email event: ${event}`, 'draft', id);
  res.json({ ok: true });
});

// ---------- templates ----------
router.get('/templates', (req, res) => {
  res.json({ templates: db.prepare('SELECT * FROM email_templates ORDER BY created_at DESC').all() });
});
router.post('/templates', requireRole('manager', 'admin'), (req, res) => {
  const { name, service, tone, subject, body } = req.body || {};
  if (!clean(name, 120) || !clean(subject, 200) || !body) return res.status(400).json({ error: 'Name, subject and body required' });
  const r = db.prepare('INSERT INTO email_templates (name, service, tone, subject, body) VALUES (?,?,?,?,?)').run(clean(name, 120), clean(service, 40), clean(tone, 40), clean(subject, 200), String(body).slice(0, 20000));
  logActivity(req.user.uid, req.user.name, 'Created email template', 'template', Number(r.lastInsertRowid), name);
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});
router.put('/templates/:id', requireRole('manager', 'admin'), (req, res) => {
  const { name, service, tone, subject, body } = req.body || {};
  db.prepare('UPDATE email_templates SET name=COALESCE(?,name), service=COALESCE(?,service), tone=COALESCE(?,tone), subject=COALESCE(?,subject), body=COALESCE(?,body) WHERE id = ?')
    .run(clean(name, 120), clean(service, 40), clean(tone, 40), clean(subject, 200), body ? String(body).slice(0, 20000) : null, Number(req.params.id));
  logActivity(req.user.uid, req.user.name, 'Updated email template', 'template', req.params.id);
  res.json({ ok: true });
});
router.delete('/templates/:id', requireRole('manager', 'admin'), (req, res) => {
  db.prepare('DELETE FROM email_templates WHERE id = ?').run(Number(req.params.id));
  logActivity(req.user.uid, req.user.name, 'Deleted email template', 'template', req.params.id);
  res.json({ ok: true });
});

// ---------- suppression list ----------
router.get('/suppression', (req, res) => {
  res.json({ entries: db.prepare('SELECT * FROM suppression ORDER BY created_at DESC LIMIT 500').all() });
});
router.post('/suppression', requireRole('manager', 'admin'), (req, res) => {
  const { type, value, reason } = req.body || {};
  if (!['email', 'domain'].includes(type) || !clean(value, 200)) return res.status(400).json({ error: 'Type and value required' });
  db.prepare('INSERT OR IGNORE INTO suppression (type, value, reason, list) VALUES (?,?,?,?)').run(type, clean(value, 200).toLowerCase(), clean(reason, 200) || 'Manual entry', 'do_not_contact');
  logActivity(req.user.uid, req.user.name, 'Added suppression entry', 'suppression', null, value);
  res.json({ ok: true });
});
router.delete('/suppression/:id', requireRole('manager', 'admin'), (req, res) => {
  db.prepare('DELETE FROM suppression WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
