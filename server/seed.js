/**
 * Demo-mode seeder: creates default users, settings, templates, tags and a
 * realistic SYNTHETIC dataset (clearly marked demo). Run once automatically
 * on first server start (or via `npm run seed -- --force`).
 */
const { db, setSetting, logActivity, now } = require('./db');
const intel = require('./engines/intel');
const providers = require('./providers');
const { hashPassword } = require('./auth');

const COUNTS = {
  companies: 1250, leadsRatio: 0.78, campaigns: 4, draftsPerStatus: [8, 5, 6, 4, 10],
  tasks: 14, notes: 22, activityDays: 45
};

function seedUsers() {
  const users = [
    { email: 'admin@rynex.io', password: 'Admin@123', name: 'Ayesha Malik', role: 'admin' },
    { email: 'manager@rynex.io', password: 'Manager@123', name: 'Daniel Okoro', role: 'manager' },
    { email: 'researcher@rynex.io', password: 'Research@123', name: 'Sara Iqbal', role: 'researcher' },
    { email: 'sales@rynex.io', password: 'Sales@123', name: 'Tom Berger', role: 'sales' }
  ];
  const ids = {};
  for (const u of users) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (existing) { ids[u.role] = existing.id; continue; }
    const r = db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)')
      .run(u.email, hashPassword(u.password), u.name, u.role);
    ids[u.role] = Number(r.lastInsertRowid);
  }
  return ids;
}

function seedSettings() {
  if (db.prepare('SELECT key FROM settings WHERE key=?').get('general')) return;
  setSetting('general', {
    company_name: 'Rynex Technologies Limited',
    services: 'VAPT | SOC | GRC | Security Audits',
    default_country: 'United Kingdom',
    default_services: ['VAPT', 'GRC', 'Security Audit'],
    default_score_threshold: 70,
    demo_mode: true
  });
  setSetting('leadgen', {
    enabled_methods: ['business_directory', 'search_engine', 'website_intel', 'tech_intel', 'security_signals', 'compliance_signals', 'job_intel', 'contact_discovery'],
    search_limit: 250, enrichment: true, dedup: true, dedup_strict_domain: true
  });
  setSetting('scoring', { weights: intel.DEFAULT_WEIGHTS, qualification_threshold: 75, high_intent_threshold: 60 });
  setSetting('outreach', {
    provider: 'SMTP (configure in Integrations)', daily_limit: 200, signature: 'Rynex Technologies Limited\nVAPT | SOC | GRC | Security Audits',
    unsubscribe_footer: true, require_approval: true
  });
  setSetting('display', { freshness_days: 90 });
}

function seedTags() {
  const tags = ['High Priority', 'SaaS', 'SOC2', 'Healthcare', 'VAPT', 'Cloud', 'Startup', 'Enterprise', 'Follow Up'];
  for (const t of tags) {
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(t);
  }
}

function seedTemplates() {
  const n = db.prepare('SELECT COUNT(*) c FROM email_templates').get().c;
  if (n > 0) return;
  const t = [
    {
      name: 'VAPT — Public Application Focus', service: 'VAPT', tone: 'Direct',
      subject: 'Security assessment support for {{company}}',
      body: 'Hello {{first_name}},\n\nI noticed that {{company}} {{evidence_1}}.\n\nGiven this development, an external security assessment may be relevant, particularly around the security of your public-facing applications.\n\nRynex Technologies provides VAPT and security assessment services that help organizations identify weaknesses before they become operational or compliance issues.\n\nIf this is currently part of your security roadmap, I would be happy to discuss how we could support your team.\n\nKind regards,\nRynex Technologies Limited'
    },
    {
      name: 'GRC — Compliance Preparation', service: 'GRC', tone: 'Consultative',
      subject: 'Compliance readiness for {{company}}',
      body: 'Hello {{first_name}},\n\nWhile researching {{company}}, I saw that {{evidence_1}}.\n\nTeams preparing for {{compliance}} often find that an early gap assessment saves significant rework later.\n\nRynex Technologies provides governance, risk and compliance advisory, including readiness assessments and internal audits.\n\nIf a compliance programme is on your roadmap, I would be glad to compare notes.\n\nKind regards,\nRynex Technologies Limited'
    },
    {
      name: 'SOC — Monitoring Gaps', service: 'SOC', tone: 'Advisory',
      subject: 'Detection and response coverage at {{company}}',
      body: 'Hello {{first_name}},\n\nI noticed that {{company}} {{evidence_1}}.\n\nAs security teams grow, many companies reach a point where 24/7 monitoring becomes difficult to staff internally.\n\nRynex Technologies operates a security operations centre (SOC) that extends your team with round-the-clock detection and response.\n\nHappy to share how organisations of your size typically structure this.\n\nKind regards,\nRynex Technologies Limited'
    },
    {
      name: 'Security Audit — Enterprise Vendor Readiness', service: 'Security Audit', tone: 'Formal',
      subject: 'Vendor security readiness for {{company}}',
      body: 'Hello {{first_name}},\n\nCongratulations on {{evidence_1}}.\n\nNew enterprise customers frequently introduce vendor security review requirements, and an independent audit is often the fastest way to evidence your controls.\n\nRynex Technologies provides independent security audits aligned to common enterprise questionnaires.\n\nIf helpful, I can share the checklist we typically see from enterprise buyers.\n\nKind regards,\nRynex Technologies Limited'
    }
  ];
  for (const x of t) {
    db.prepare('INSERT INTO email_templates (name, service, tone, subject, body, is_default) VALUES (?,?,?,?,?,0)').run(x.name, x.service, x.tone, x.subject, x.body);
  }
}

function seedSuppression() {
  db.prepare('INSERT OR IGNORE INTO suppression (type, value, reason, list) VALUES (?,?,?,?)').run('domain', 'suppressed-example.com', 'Requested opt-out', 'do_not_contact');
}

/** Bulk-seed the synthetic dataset. */
function seedData() {
  const existing = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
  if (existing > 0) return { seeded: false, leads: existing };

  providers.seedRng(20260921);
  const weights = intel.getWeights(intel.DEFAULT_WEIGHTS);
  const days = COUNTS.activityDays;

  const insCompany = db.prepare(`INSERT INTO companies (name, website, domain, industry, business_model, description, country, city, employee_count, revenue_band, founded_year, is_demo, enriched, data_confidence, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)`);
  const insContact = db.prepare(`INSERT INTO contacts (company_id, name, role, email, phone, linkedin_url, email_status, is_primary, confidence, source, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insTech = db.prepare(`INSERT INTO company_technologies (company_id, technology, category, confidence, source, detected_at) VALUES (?,?,?,?,?,?)`);
  const insEvidence = db.prepare(`INSERT INTO lead_evidence (lead_id, evidence_type, title, description, source_name, source_url, observed_at, confidence, related_service, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insSignal = db.prepare(`INSERT INTO lead_signals (lead_id, signal_type, category, title, confidence, relevant_services, detected_at) VALUES (?,?,?,?,?,?,?)`);
  const insCompliance = db.prepare(`INSERT INTO company_compliance (company_id, framework, status, evidence, confidence, detected_at) VALUES (?,?,?,?,?,?)`);
  const insSource = db.prepare(`INSERT INTO lead_sources (lead_id, method, provider, source_name, source_url, retrieved_at, confidence) VALUES (?,?,?,?,?,?,?)`);
  const insLead = db.prepare(`INSERT INTO leads (company_id, primary_contact_id, status, lead_score, score_category, company_fit_score, security_signal_score, intent_score, service_fit_score, data_quality_score, intent, recommended_service, service_relevance, confidence, source, source_url, discovery_method, is_demo, created_at, updated_at, last_contacted_at, next_followup_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)`);
  const insTag = db.prepare(`INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?,?)`);
  const tagIds = db.prepare('SELECT id, name FROM tags').all();

  const statusPool = [
    ...Array(30).fill('New'), ...Array(8).fill('Researching'), ...Array(12).fill('Qualified'),
    ...Array(6).fill('High Intent'), ...Array(8).fill('Contacted'), ...Array(6).fill('Email Sent'),
    ...Array(4).fill('Opened'), ...Array(3).fill('Replied'), ...Array(2).fill('Meeting Requested'),
    ...Array(1).fill('Meeting Booked'), ...Array(2).fill('Proposal Sent'), ...Array(1).fill('Won'),
    ...Array(2).fill('Lost'), ...Array(1).fill('Not Interested'), ...Array(1).fill('Do Not Contact')
  ];
  const countries = Object.keys(intel.COUNTRIES);

  const tx = db.transaction(() => {
    let leadsMade = 0;
    const seenDomains = new Set();
    for (let i = 0; i < COUNTS.companies; i++) {
      const country = countries[Math.floor(providers.int(0, countries.length - 1))];
      const c = providers.synthCompany(country, null);
      c.source = 'Demo Business Directory';
      c.source_url = `https://directory.example.com/listing/${c.domain}`;
      c.method = 'Business Directory Discovery';
      let n = 1;
      while (seenDomains.has(c.domain)) { c.domain = c.domain.replace(/\.\w+$/, (m) => `${n++}${m}`); }
      if (n > 1) { c.name = `${c.name} ${n}`; c.website = `https://www.${c.domain}`; }
      seenDomains.add(c.domain);
      const created = new Date(Date.now() - providers.int(0, days - 1) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const cr = insCompany.run(c.name, c.website, c.domain, c.industry, c.business_model, c.description, c.country, c.city, c.employee_count, c.revenue_band, c.founded_year, c.data_confidence, created, created);
      const companyId = Number(cr.lastInsertRowid);

      const tech = (() => { providers.seedRng(companyId * 7919); const n = providers.int(1, 6); const s = new Set(); const out = []; for (let k = 0; k < n; k++) { const t = intel.TECHNOLOGIES[providers.int(0, intel.TECHNOLOGIES.length - 1)]; if (!s.has(t.name)) { s.add(t.name); out.push(t); } } return out; })();
      for (const t of tech) insTech.run(companyId, t.name, t.category, 'Medium', 'Public website headers (passive)', created);

      if (providers.int(1, 100) > COUNTS.leadsRatio * 100) continue;

      const contacts = providers.synthContacts(c);
      let primaryId = null;
      for (const ct of contacts) {
        const ccr = insContact.run(companyId, ct.name, ct.role, ct.email, ct.phone, ct.linkedin_url, ct.email_status, ct.is_primary, ct.confidence, ct.source, created);
        if (ct.is_primary) primaryId = Number(ccr.lastInsertRowid);
      }

      const evidence = providers.synthEvidence(c);
      const signals = [];
      const compliance = [];
      for (const e of evidence) {
        if (e.evidence_type === 'job_posting') signals.push({ signal_type: 'security_hiring', category: 'hiring', title: e.title, confidence: e.confidence, relevant_services: 'VAPT, SOC, Security Audit' });
        else if (e.evidence_type === 'compliance') { signals.push({ signal_type: 'compliance_mention', category: 'compliance', title: e.title, confidence: e.confidence, relevant_services: 'GRC, Security Audit' }); const fw = intel.COMPLIANCE_FRAMEWORKS.find((f) => e.title.includes(f.fw)); if (fw) compliance.push({ framework: fw.fw, status: 'Required', evidence: e.description, confidence: e.confidence }); }
        else if (e.evidence_type === 'website') signals.push({ signal_type: 'app_launch', category: 'technology', title: e.title, confidence: e.confidence, relevant_services: 'VAPT' });
        else if (e.evidence_type === 'expansion') signals.push({ signal_type: 'market_expansion', category: 'event', title: e.title, confidence: e.confidence, relevant_services: 'GRC' });
        else if (e.evidence_type === 'security_page') signals.push({ signal_type: 'security_page', category: 'security', title: e.title, confidence: e.confidence, relevant_services: 'GRC, Security Audit' });
      }

      const score = intel.scoreLead(c, { signals, compliance, tech, evidence, contacts, weights });
      const status = statusPool[providers.int(0, statusPool.length - 1)];
      const lastContacted = ['Contacted', 'Email Sent', 'Opened', 'Replied', 'Meeting Requested', 'Meeting Booked', 'Proposal Sent', 'Won', 'Lost', 'Not Interested', 'Do Not Contact'].includes(status)
        ? new Date(Date.now() - providers.int(1, 30) * 86400000).toISOString().slice(0, 10) : null;
      const followup = ['Replied', 'Meeting Requested', 'Proposal Sent'].includes(status)
        ? new Date(Date.now() + providers.int(1, 14) * 86400000).toISOString().slice(0, 10) : null;

      const lr = insLead.run(
        companyId, primaryId, status, score.lead_score, score.score_category,
        score.breakdown.company_fit, score.breakdown.security_signals, score.breakdown.intent, score.breakdown.service_fit, score.breakdown.data_quality,
        score.intent, score.relevance.primary.service, JSON.stringify(score.relevance.all), c.data_confidence,
        c.source, c.source_url, c.method, created, created, lastContacted, followup
      );
      const leadId = Number(lr.lastInsertRowid);
      leadsMade++;

      for (const e of evidence) insEvidence.run(leadId, e.evidence_type, e.title, e.description, e.source_name, e.source_url, e.observed_at, e.confidence, e.related_service, created);
      for (const s of signals) insSignal.run(leadId, s.signal_type, s.category, s.title, s.confidence, s.relevant_services, created);
      for (const cm of compliance) insCompliance.run(companyId, cm.framework, cm.status, cm.evidence, cm.confidence, created);
      insSource.run(leadId, c.method, 'Demo Provider', c.source, c.source_url, created, 'Medium');

      // tags driven by attributes
      const wants = [];
      if (score.lead_score >= 80) wants.push('High Priority');
      if (/saas/i.test(c.industry)) wants.push('SaaS');
      if (compliance.some((x) => x.framework === 'SOC 2')) wants.push('SOC2');
      if (/health/i.test(c.industry)) wants.push('Healthcare');
      if (tech.some((t) => ['AWS', 'Azure', 'Google Cloud'].includes(t.name))) wants.push('Cloud');
      if (c.employee_count <= 10) wants.push('Startup');
      if (c.employee_count > 500) wants.push('Enterprise');
      if (score.lead_score >= 75 && status === 'New') wants.push('Follow Up');
      for (const w of wants) { const tg = tagIds.find((t) => t.name === w); if (tg) insTag.run(leadId, tg.id); }
    }
    return leadsMade;
  });
  const leads = tx();
  return { seeded: true, leads };
}

function seedCampaignsAndOutreach(adminId, salesId) {
  const n = db.prepare('SELECT COUNT(*) c FROM campaigns').get().c;
  if (n > 0) return;

  const campaigns = [
    { name: 'UK SaaS Security Outreach', desc: 'UK SaaS companies, 10-200 employees, score 75+, VAPT focus.', seg: { countries: ['United Kingdom'], industries: ['SaaS'], employeesMin: 10, employeesMax: 200, minScore: 75 }, service: 'VAPT', pers: 'Deep Research', status: 'Active' },
    { name: 'DACH FinTech Compliance', desc: 'Germany FinTech with compliance signals, GRC focus.', seg: { countries: ['Germany'], industries: ['FinTech'], minScore: 70, hasCompliance: true }, service: 'GRC', pers: 'Deep Research', status: 'Active' },
    { name: 'US Healthcare Security Audits', desc: 'US healthcare, HIPAA signals, audit focus.', seg: { countries: ['United States'], industries: ['Healthcare'], minScore: 65 }, service: 'Security Audit', pers: 'Standard', status: 'Draft' },
    { name: 'Global E-commerce VAPT Wave 1', desc: 'Global e-commerce businesses with public platforms.', seg: { industries: ['E-commerce'], minScore: 60 }, service: 'VAPT', pers: 'Deep Research', status: 'Paused' }
  ];
  const leadRows = db.prepare(`SELECT l.id, l.recommended_service, l.lead_score, c.country, c.industry FROM leads l JOIN companies c ON c.id=l.company_id WHERE l.status IN ('New','Qualified','High Intent')`).all();
  const insCL = db.prepare('INSERT OR IGNORE INTO campaign_leads (campaign_id, lead_id) VALUES (?,?)');
  for (const camp of campaigns) {
    const r = db.prepare('INSERT INTO campaigns (name, description, segment_json, primary_service, personalization, status, created_by) VALUES (?,?,?,?,?,?,?)')
      .run(camp.name, camp.desc, JSON.stringify(camp.seg), camp.service, camp.pers, camp.status, adminId);
    const cid = Number(r.lastInsertRowid);
    const matches = leadRows
      .filter((l) => (!camp.seg.countries || camp.seg.countries.includes(l.country))
        && (!camp.seg.industries || camp.seg.industries.includes(l.industry))
        && l.lead_score >= (camp.seg.minScore || 0))
      .slice(0, 40);
    for (const m of matches) insCL.run(cid, m.id);
  }

  // Email drafts across the workflow + events
  const insDraft = db.prepare(`INSERT INTO email_drafts (lead_id, campaign_id, contact_id, personalization, subject, body, status, evidence_confidence, safety_checks, created_at, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insEvent = db.prepare(`INSERT INTO email_events (draft_id, lead_id, event, occurred_at) VALUES (?,?,?,?)`);
  const statuses = ['Draft', 'Pending Review', 'Approved', 'Scheduled', 'Sent', 'Sent', 'Sent', 'Sent'];
  const candidateLeads = db.prepare(`SELECT l.id, l.recommended_service, c.name company, c.domain, ct.name contact, ct.email, ct.role FROM leads l JOIN companies c ON c.id=l.company_id LEFT JOIN contacts ct ON ct.id=l.primary_contact_id WHERE ct.email IS NOT NULL ORDER BY l.lead_score DESC LIMIT 60`).all();
  let i = 0;
  for (const st of statuses) {
    for (let k = 0; k < COUNTS.draftsPerStatus[statuses.indexOf(st)] % 12 + (st === 'Sent' ? 10 : 2); k++) {
      const L = candidateLeads[i % candidateLeads.length]; i++;
      const first = (L.contact || 'there').split(' ')[0];
      const subject = `${L.recommended_service} support for ${L.company}`;
      const body = `Hello ${first},\n\nI noticed that ${L.company} operates a customer-facing platform and recently drew our attention during market research.\n\nGiven this, an external security assessment may be relevant, particularly around validating the security of your public-facing applications.\n\nRynex Technologies provides vulnerability assessment and penetration testing that can help identify weaknesses before they become operational or compliance issues.\n\nIf this is currently part of your security roadmap, I would be happy to discuss how we could support your team.\n\nKind regards,\nRynex Technologies Limited`;
      const sentAt = st === 'Sent' ? new Date(Date.now() - providers.int(1, 25) * 86400000).toISOString().slice(0, 19).replace('T', ' ') : null;
      const d = insDraft.run(L.id, null, null, 'Deep Research', subject, body, st, 'High', '{}', new Date(Date.now() - providers.int(1, 30) * 86400000).toISOString().slice(0, 19).replace('T', ' '), sentAt);
      const did = Number(d.lastInsertRowid);
      if (st === 'Sent') {
        insEvent.run(did, L.id, 'sent', sentAt);
        if (providers.int(1, 100) <= 55) insEvent.run(did, L.id, 'opened', new Date(new Date(sentAt).getTime() + 3600e3).toISOString().slice(0, 19).replace('T', ' '));
        if (providers.int(1, 100) <= 12) insEvent.run(did, L.id, 'replied', new Date(new Date(sentAt).getTime() + 86400e3).toISOString().slice(0, 19).replace('T', ' '));
        if (providers.int(1, 100) <= 6) insEvent.run(did, L.id, 'bounced', new Date(new Date(sentAt).getTime() + 7200e3).toISOString().slice(0, 19).replace('T', ' '));
        if (providers.int(1, 100) <= 3) insEvent.run(did, L.id, 'unsubscribed', new Date(new Date(sentAt).getTime() + 172800e3).toISOString().slice(0, 19).replace('T', ' '));
      }
    }
  }

  // Tasks + notes
  const insTask = db.prepare(`INSERT INTO tasks (lead_id, title, type, due_date, priority, status, assigned_to, created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const insNote = db.prepare(`INSERT INTO notes (lead_id, user_id, body, created_at) VALUES (?,?,?,?)`);
  const topLeads = db.prepare(`SELECT id FROM leads ORDER BY lead_score DESC LIMIT ${Math.max(COUNTS.tasks, COUNTS.notes)}`).all();
  const taskTypes = [
    ['Follow up on intro email', 'Follow up'], ['Send VAPT proposal', 'Send proposal'],
    ['Schedule discovery call', 'Schedule meeting'], ['Deep-dive company research', 'Research company'],
    ['Verify contact email', 'Verify contact'], ['Review generated email', 'Review email'],
    ['Call prospect', 'Call prospect']
  ];
  topLeads.slice(0, COUNTS.tasks).forEach((l, idx) => {
    const [title, type] = taskTypes[idx % taskTypes.length];
    insTask.run(l.id, title, type, new Date(Date.now() + providers.int(-5, 14) * 86400000).toISOString().slice(0, 10), ['High', 'Medium', 'Low'][idx % 3], idx % 5 === 0 ? 'Completed' : 'Open', idx % 2 ? salesId : adminId, now());
  });
  const noteBodies = [
    'Contacted CTO on 21 Sep. Potential VAPT requirement before enterprise launch. Follow up next week.',
    'Security manager confirmed SOC 2 audit planned for Q4. Interested in gap assessment.',
    'Left voicemail with IT manager. Also asked about ISO 27001 scope on LinkedIn.',
    'Company uses AWS heavily; likely cloud security assessment fit. Verify budget owner.',
    'Referred by partner. Wants pricing for full VAPT + retest.'
  ];
  topLeads.slice(0, COUNTS.notes).forEach((l, idx) => {
    insNote.run(l.id, idx % 2 ? adminId : salesId, noteBodies[idx % noteBodies.length], now());
  });

  // Historical job records (search history)
  const insJob = db.prepare(`INSERT INTO lead_generation_jobs (name, user_id, target_json, methods_json, status, stage, progress_json, stats_json, is_demo, started_at, completed_at, created_at) VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`);
  const jobs = [
    ['UK + Germany SaaS Sweep', { countries: ['United Kingdom', 'Germany'], industries: ['SaaS'], employeesMin: 10, employeesMax: 250 }, ['business_directory', 'search_engine'], { discovered: 482, duplicates_removed: 61, enriched: 421, qualified: 187, high_intent: 44, high_score: 96 }],
    ['Global FinTech Compliance Signals', { industries: ['FinTech'], minScore: 70 }, ['compliance_signals', 'search_engine'], { discovered: 310, duplicates_removed: 38, enriched: 272, qualified: 141, high_intent: 52, high_score: 78 }],
    ['US Healthcare Audit Targets', { countries: ['United States'], industries: ['Healthcare'], minScore: 65 }, ['business_directory', 'job_intel'], { discovered: 265, duplicates_removed: 22, enriched: 243, qualified: 98, high_intent: 31, high_score: 61 }],
    ['Nordics E-commerce VAPT', { industries: ['E-commerce'], employeesMax: 500 }, ['business_directory', 'website_intel', 'contact_discovery'], { discovered: 198, duplicates_removed: 17, enriched: 181, qualified: 72, high_intent: 19, high_score: 40 }]
  ];
  jobs.forEach((j, idx) => {
    const created = new Date(Date.now() - (idx * 7 + 3) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    insJob.run(j[0], adminId, JSON.stringify(j[1]), JSON.stringify(j[2]), 'completed', 'Qualification', '{}', JSON.stringify(j[3]), created, created, created);
  });
}

function main() {
  const users = seedUsers();
  seedSettings();
  seedTags();
  seedTemplates();
  seedSuppression();
  const res = seedData();
  seedCampaignsAndOutreach(users.admin, users.sales);
  logActivity(null, 'system', 'Demo data seeded', 'system', null, `Synthetic dataset: ${res.leads || 'existing'} leads`);
  console.log(`[seed] users OK, settings OK. ${res.seeded ? `Seeded ${res.leads} demo leads.` : `Existing data found (${res.leads} leads) - skipped.`}`);
}

if (require.main === module) main();
module.exports = { main };
