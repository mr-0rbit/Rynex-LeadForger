/**
 * Express API routes for Niche Lead Generation, Persistence, and Contextual AI Outreach.
 */
const express = require('express');
const { db, getSetting, setSetting, logActivity, now } = require('../db');
const { authenticate } = require('../auth');
const { findLeadsForNiche } = require('../engines/niche_finder');
const { generateContextualEmail, callOpenAI, callGemini, callGroq } = require('../engines/ai_emailer');
const pythonBridge = require('../engines/python_bridge');

const router = express.Router();
router.use(authenticate);

/**
 * Mask an API key for safe display in UI (e.g. sk-proj...ab12)
 */
function maskKey(key) {
  if (!key || key.length < 8) return '';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

// -------------------------------------------------------------
// 1. DISCOVER LEADS BY NICHE (POWERED BY PYTHON CYBER ENGINE)
// -------------------------------------------------------------
router.post('/find', async (req, res) => {
  const { niche, location, serviceKey, limit, yourOffer, searchProvider } = req.body || {};
  if (!niche || !niche.trim()) {
    return res.status(400).json({ error: 'Niche query is required' });
  }

  const settings = getSetting('niche_app_settings', {});
  const targetService = serviceKey || 'vapt';
  const targetLimit = Math.min(30, Math.max(3, parseInt(limit) || 10));
  const effectiveOffer = yourOffer ? yourOffer.trim() : settings.default_offer || '';

  try {
    let result = null;
    try {
      // Primary: Execute enhanced Python Cyber Intelligence Engine
      result = await pythonBridge.findLeads({
        niche: niche.trim(),
        location: location ? location.trim() : '',
        serviceKey: targetService,
        limit: targetLimit,
        yourOffer: effectiveOffer
      });
    } catch (pyErr) {
      console.warn('[niche_routes] Python engine notice, fallback to local resolver:', pyErr.message);
    }

    if (!result || !result.leads || result.leads.length === 0) {
      // Fallback: Local verified real-time engine
      result = await findLeadsForNiche({
        niche: niche.trim(),
        location: location ? location.trim() : '',
        serviceKey: targetService,
        limit: targetLimit,
        yourOffer: effectiveOffer,
        searchApiKey: settings.search_api_key || null,
        searchProvider: searchProvider || settings.search_provider || 'builtin'
      });
    }

    logActivity(req.user.uid, req.user.name, `Discovered ${result.leads.length} leads for niche: ${niche}`, 'niche_leads', null, `Service: ${targetService} | Location: ${location || 'Global'}`);
    res.json(result);
  } catch (err) {
    console.error('[niche_routes] Find error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to discover leads for specified niche' });
  }
});

// -------------------------------------------------------------
// 1B. INSTANT SECURITY AUDIT (ENGINEERING-AS-MARKETING)
// -------------------------------------------------------------
router.post('/quick-audit', async (req, res) => {
  const { domain } = req.body || {};
  if (!domain || !domain.trim()) {
    return res.status(400).json({ error: 'Domain is required for security diagnostic' });
  }

  try {
    let audit = null;
    try {
      audit = await pythonBridge.quickAudit(domain.trim());
    } catch (pyErr) {
      console.warn('[niche_routes] Python quick-audit notice, using local realrecon:', pyErr.message);
    }

    if (!audit || !audit.grade) {
      const { quickAuditDomain } = require('../engines/realrecon');
      audit = await quickAuditDomain(domain.trim());
    }

    logActivity(req.user.uid, req.user.name, `Ran instant diagnostic audit on ${domain}`, 'security_audit', null, `Grade: ${audit.grade}`);
    res.json(audit);
  } catch (err) {
    console.error('[niche_routes] Quick audit error:', err.message);
    res.status(500).json({ error: err.message || 'Diagnostic audit failed' });
  }
});

// -------------------------------------------------------------
// 2. SAVE LEADS (SINGLE OR BULK)
// -------------------------------------------------------------
router.post('/save', (req, res) => {
  const { leads, lead } = req.body || {};
  const listToSave = Array.isArray(leads) ? leads : (lead ? [lead] : []);

  if (listToSave.length === 0) {
    return res.status(400).json({ error: 'No leads provided to save' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO saved_niche_leads (
      company_name, domain, website, niche, location, description,
      detected_need, tech_stack, contact_email, contact_phone,
      evidence_url, evidence_label, contact_page_url, contact_person, contact_title, contact_linkedin,
      status, notes, your_offer, lead_score, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let savedCount = 0;
  const ids = [];

  for (const item of listToSave) {
    if (!item.company_name) continue;

    // Check if duplicate domain exists in saved leads
    if (item.domain) {
      const existing = db.prepare('SELECT id FROM saved_niche_leads WHERE domain = ?').get(item.domain);
      if (existing) {
        ids.push(existing.id);
        continue;
      }
    }

    const contactPerson = item.contact_person || item.primary_contact?.name || item.decision_makers?.primaryPersona?.title || '';
    const contactTitle = item.contact_title || item.primary_contact?.title || item.decision_makers?.primaryPersona?.title || '';
    const contactLinkedin = item.contact_linkedin || item.primary_contact?.linkedinSearchUrl || item.primary_contact?.linkedinUrl || item.decision_makers?.primaryPersona?.linkedinSearchUrl || '';

    const info = insertStmt.run(
      item.company_name,
      item.domain || '',
      item.website || '',
      item.niche || '',
      item.location || '',
      item.description || '',
      item.detected_need || '',
      item.tech_stack || '',
      item.contact_email || '',
      item.contact_phone || '',
      item.evidence_url || '',
      item.evidence_label || '',
      item.contact_page_url || '',
      contactPerson,
      contactTitle,
      contactLinkedin,
      item.status || 'New',
      item.notes || '',
      item.your_offer || '',
      item.lead_score || 70,
      now(),
      now()
    );

    ids.push(Number(info.lastInsertRowid));
    savedCount++;
  }

  logActivity(req.user.uid, req.user.name, `Saved ${savedCount} niche leads`, 'saved_niche_leads', null, `Total requested: ${listToSave.length}`);
  res.json({ ok: true, savedCount, ids });
});

// -------------------------------------------------------------
// 3. GET SAVED LEADS
// -------------------------------------------------------------
router.get('/saved', (req, res) => {
  const { status, q, niche, page = 1, pageSize = 50 } = req.query;
  const where = [];
  const params = [];

  if (status && status !== 'All') {
    where.push('status = ?');
    params.push(status);
  }
  if (niche) {
    where.push('niche LIKE ?');
    params.push(`%${niche}%`);
  }
  if (q) {
    where.push('(company_name LIKE ? OR domain LIKE ? OR description LIKE ? OR detected_need LIKE ? OR contact_email LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM saved_niche_leads ${whereClause}`).get(...params);
  const total = countRow ? countRow.total : 0;

  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(pageSize);
  const leads = db.prepare(`
    SELECT * FROM saved_niche_leads
    ${whereClause}
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  // Summary counts by status
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM saved_niche_leads GROUP BY status
  `).all();

  res.json({
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    leads,
    statusCounts
  });
});

// -------------------------------------------------------------
// 4. UPDATE SAVED LEAD (STATUS, NOTES, DETAILS)
// -------------------------------------------------------------
router.patch('/saved/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM saved_niche_leads WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  const {
    status, notes, contact_email, contact_phone, detected_need, your_offer, lead_score,
    evidence_url, evidence_label, contact_page_url, contact_person, contact_title, contact_linkedin
  } = req.body || {};

  db.prepare(`
    UPDATE saved_niche_leads SET
      status = COALESCE(?, status),
      notes = COALESCE(?, notes),
      contact_email = COALESCE(?, contact_email),
      contact_phone = COALESCE(?, contact_phone),
      detected_need = COALESCE(?, detected_need),
      your_offer = COALESCE(?, your_offer),
      lead_score = COALESCE(?, lead_score),
      evidence_url = COALESCE(?, evidence_url),
      evidence_label = COALESCE(?, evidence_label),
      contact_page_url = COALESCE(?, contact_page_url),
      contact_person = COALESCE(?, contact_person),
      contact_title = COALESCE(?, contact_title),
      contact_linkedin = COALESCE(?, contact_linkedin),
      updated_at = ?
    WHERE id = ?
  `).run(
    status !== undefined ? status : null,
    notes !== undefined ? notes : null,
    contact_email !== undefined ? contact_email : null,
    contact_phone !== undefined ? contact_phone : null,
    detected_need !== undefined ? detected_need : null,
    your_offer !== undefined ? your_offer : null,
    lead_score !== undefined ? Number(lead_score) : null,
    evidence_url !== undefined ? evidence_url : null,
    evidence_label !== undefined ? evidence_label : null,
    contact_page_url !== undefined ? contact_page_url : null,
    contact_person !== undefined ? contact_person : null,
    contact_title !== undefined ? contact_title : null,
    contact_linkedin !== undefined ? contact_linkedin : null,
    now(),
    id
  );

  res.json({ ok: true, id });
});

// -------------------------------------------------------------
// 5. DELETE SAVED LEAD
// -------------------------------------------------------------
router.delete('/saved/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM saved_niche_leads WHERE id = ?').run(id);
  res.json({ ok: true, id });
});

// -------------------------------------------------------------
// 6. GENERATE CONTEXTUAL OUTREACH EMAIL
// -------------------------------------------------------------
router.post('/email', async (req, res) => {
  const { lead, yourOffer, tone, provider, apiKey, sequenceStage, serviceKey } = req.body || {};
  if (!lead || !lead.company_name) {
    return res.status(400).json({ error: 'Lead data with company name is required' });
  }

  const settings = getSetting('niche_app_settings', {});
  const senderProfile = {
    name: settings.sender_name || req.user.name || 'Ayesha Malik',
    title: settings.sender_title || 'Business Development',
    company: settings.sender_company || 'Rynex Security',
    website: settings.website || 'https://rynexsecurity.com',
    from_email: settings.from_email || 'info@rynexsecurity.com',
    postal_address: settings.postal_address || 'Rynex Security, Karachi, Pakistan'
  };

  // Determine which API key to use
  let keyToUse = apiKey;
  const targetProvider = provider || (settings.openai_key ? 'openai' : settings.gemini_key ? 'gemini' : 'builtin');

  if (!keyToUse) {
    if (targetProvider === 'openai') keyToUse = settings.openai_key;
    else if (targetProvider === 'gemini') keyToUse = settings.gemini_key;
    else if (targetProvider === 'groq') keyToUse = settings.groq_key;
  }

  try {
    let emailResult = null;

    if (targetProvider === 'builtin' || !keyToUse) {
      try {
        emailResult = await pythonBridge.generateEmail({
          lead,
          serviceKey: serviceKey || lead.need_service || 'vapt',
          sequenceStage: sequenceStage || 'initial',
          yourOffer: yourOffer || lead.your_offer || settings.default_offer || '',
          senderName: senderProfile.name,
          senderTitle: senderProfile.title,
          senderCompany: senderProfile.company,
          website: senderProfile.website,
          contactEmail: senderProfile.from_email
        });
      } catch (pyErr) {
        console.warn('[niche_routes] Python email generator notice, fallback to JS template:', pyErr.message);
      }
    }

    if (!emailResult) {
      emailResult = await generateContextualEmail({
        lead,
        yourOffer: yourOffer || lead.your_offer || settings.default_offer || '',
        senderProfile,
        tone: tone || 'Consultative Problem-Solver',
        sequenceStage: sequenceStage || 'initial',
        serviceKey: serviceKey || 'vapt',
        provider: targetProvider,
        apiKey: keyToUse
      });
    }

    logActivity(req.user.uid, req.user.name, `Generated outreach email (${emailResult.sequenceStage}) for ${lead.company_name}`, 'ai_email', null, `Model: ${emailResult.modelUsed}`);
    res.json(emailResult);
  } catch (err) {
    console.error('[niche_routes] Email generation error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate contextual outreach email' });
  }
});

// -------------------------------------------------------------
// 7. GET & UPDATE USER SETTINGS & API KEYS & SMTP
// -------------------------------------------------------------
router.get('/settings', (req, res) => {
  const s = getSetting('niche_app_settings', {});
  res.json({
    openai_configured: !!s.openai_key,
    gemini_configured: !!s.gemini_key,
    groq_configured: !!s.groq_key,
    search_configured: !!s.search_api_key,
    smtp_configured: !!s.smtp_password,
    openai_masked: maskKey(s.openai_key),
    gemini_masked: maskKey(s.gemini_key),
    groq_masked: maskKey(s.groq_key),
    search_masked: maskKey(s.search_api_key),
    search_provider: s.search_provider || 'builtin',
    default_offer: s.default_offer || 'Penetration testing (VAPT), 24/7 SOC monitoring, and GRC compliance readiness',
    sender_name: s.sender_name || 'Ayesha Malik',
    sender_title: s.sender_title || 'Business Development',
    sender_company: s.sender_company || 'Rynex Security',
    website: s.website || 'https://rynexsecurity.com',
    from_email: s.from_email || 'info@rynexsecurity.com',
    smtp_host: s.smtp_host || 'smtp.gmail.com',
    smtp_port: s.smtp_port || 587,
    smtp_user: s.smtp_user || 'info@rynexsecurity.com',
    postal_address: s.postal_address || 'Rynex Security, Karachi, Pakistan'
  });
});

router.post('/settings', (req, res) => {
  const current = getSetting('niche_app_settings', {});
  const {
    openai_key,
    gemini_key,
    groq_key,
    search_api_key,
    search_provider,
    default_offer,
    sender_name,
    sender_title,
    sender_company,
    website,
    from_email,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_password,
    postal_address
  } = req.body || {};

  const updated = {
    ...current,
    openai_key: openai_key !== undefined ? (openai_key.trim() || null) : current.openai_key,
    gemini_key: gemini_key !== undefined ? (gemini_key.trim() || null) : current.gemini_key,
    groq_key: groq_key !== undefined ? (groq_key.trim() || null) : current.groq_key,
    search_api_key: search_api_key !== undefined ? (search_api_key.trim() || null) : current.search_api_key,
    search_provider: search_provider || current.search_provider || 'builtin',
    default_offer: default_offer !== undefined ? default_offer.trim() : current.default_offer,
    sender_name: sender_name !== undefined ? sender_name.trim() : current.sender_name,
    sender_title: sender_title !== undefined ? sender_title.trim() : current.sender_title,
    sender_company: sender_company !== undefined ? sender_company.trim() : current.sender_company,
    website: website !== undefined ? website.trim() : current.website,
    from_email: from_email !== undefined ? from_email.trim() : current.from_email,
    smtp_host: smtp_host !== undefined ? smtp_host.trim() : current.smtp_host,
    smtp_port: smtp_port !== undefined ? parseInt(smtp_port) : current.smtp_port,
    smtp_user: smtp_user !== undefined ? smtp_user.trim() : current.smtp_user,
    smtp_password: smtp_password !== undefined && smtp_password.trim() ? smtp_password.trim() : current.smtp_password,
    postal_address: postal_address !== undefined ? postal_address.trim() : current.postal_address
  };

  setSetting('niche_app_settings', updated);
  logActivity(req.user.uid, req.user.name, 'Updated AI, search, and SMTP configurations', 'settings');
  res.json({ ok: true });
});

// -------------------------------------------------------------
// 8. TEST API KEYS (LIVE CONNECTIVITY CHECK)
// -------------------------------------------------------------
router.post('/test-key', async (req, res) => {
  const { provider, apiKey } = req.body || {};
  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider and apiKey are required' });
  }

  const start = Date.now();
  try {
    if (provider === 'openai') {
      await callOpenAI(apiKey, 'Hello, reply with the single word "READY".');
      return res.json({ ok: true, provider, latencyMs: Date.now() - start, message: 'OpenAI API key is valid and connected!' });
    } else if (provider === 'gemini') {
      await callGemini(apiKey, 'Reply with the word READY');
      return res.json({ ok: true, provider, latencyMs: Date.now() - start, message: 'Google Gemini API key is valid and connected!' });
    } else if (provider === 'groq') {
      await callGroq(apiKey, 'Reply with the word READY');
      return res.json({ ok: true, provider, latencyMs: Date.now() - start, message: 'Groq API key is valid and connected!' });
    } else {
      return res.status(400).json({ error: 'Unsupported test provider' });
    }
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'API key test failed' });
  }
});

module.exports = router;
