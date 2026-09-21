/**
 * Lead Generation pipeline: runs as a background job (setTimeout-sliced so the
 * web server is never blocked). Stages follow the enrichment pipeline:
 * Discovery -> Dedup -> Company Enrichment -> Contact Enrichment -> Tech Intel
 * -> Security Signals -> Compliance -> Intent -> Scoring -> Qualification.
 * Job lifecycle: pending/running/completed/partially_completed/failed/cancelled.
 */
const { db, getSetting, setSetting, logActivity, now } = require('../db');
const intel = require('./intel');
const providers = require('../providers');
const { clean } = require('../auth');

const STAGES = [
  'Discovery', 'Deduplication', 'Company Enrichment', 'Contact Enrichment',
  'Technology Intelligence', 'Security Signals', 'Compliance Signals',
  'Intent Analysis', 'Lead Scoring', 'Qualification'
];

const running = new Map(); // jobId -> { cancelled: bool }

function getJob(id) {
  return db.prepare('SELECT * FROM lead_generation_jobs WHERE id = ?').get(id);
}

function updateJob(id, fields) {
  const allowed = ['status', 'stage', 'progress_json', 'stats_json', 'error', 'started_at', 'completed_at'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in fields) { sets.push(`${k} = ?`); vals.push(fields[k]); }
  if (!sets.length) return;
  vals.push(id);
  db.prepare(`UPDATE lead_generation_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

function setProgress(jobId, stageIndex, pct, stats) {
  const progress = {};
  STAGES.forEach((s, i) => {
    progress[s] = i < stageIndex ? 100 : i === stageIndex ? Math.round(pct) : 0;
  });
  updateJob(jobId, { stage: STAGES[stageIndex], progress_json: JSON.stringify(progress) });
  if (stats) updateJob(jobId, { stats_json: JSON.stringify(stats) });
}

/** Normalized company key for dedup. */
function dedupKey(c) {
  const dom = (c.domain || '').toLowerCase().replace(/^www\./, '');
  if (dom) return `d:${dom}`;
  return `n:${(c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')}:${(c.country || '').toLowerCase()}`;
}

function isSuppressed(domain, email) {
  if (domain) {
    const hit = db.prepare(`SELECT 1 FROM suppression WHERE type='domain' AND lower(value)=lower(?)`).get(domain);
    if (hit) return true;
  }
  if (email) {
    const ed = String(email).split('@')[1];
    if (ed) {
      const hit = db.prepare(`SELECT 1 FROM suppression WHERE type='domain' AND lower(value)=lower(?)`).get(ed);
      if (hit) return true;
    }
  }
  return false;
}

/**
 * Create and start a lead generation job.
 * target: { countries, industries, employeesMin, employeesMax, revenue, minScore, freshnessDays, personalization }
 * methods: array of method keys
 */
function startJob(user, name, target, methods) {
  const res = db.prepare(
    `INSERT INTO lead_generation_jobs (name, user_id, target_json, methods_json, status, stage, is_demo, created_at)
     VALUES (?, ?, ?, ?, 'pending', 'Queued', 1, ?)`
  ).run(clean(name, 120) || 'Lead Generation Job', user.id, JSON.stringify(target || {}), JSON.stringify(methods || []), now());
  const jobId = Number(res.lastInsertRowid);
  logActivity(user.id, user.name, 'Started lead generation job', 'job', jobId, name);
  setTimeout(() => runJob(jobId), 50);
  return jobId;
}

async function runJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  const state = { cancelled: false };
  running.set(jobId, state);
  const target = JSON.parse(job.target_json || '{}');
  const methods = JSON.parse(job.methods_json || '[]');
  const planned = Math.min(Math.max(Number(target.maxLeads) || 250, 50), 2000);
  const stats = { discovered: 0, duplicates_removed: 0, enriched: 0, qualified: 0, high_intent: 0, high_score: 0, errors: [] };

  updateJob(jobId, { status: 'running', started_at: now() });
  const weights = intel.getWeights(getSetting('general', {}));
  const minScore = Number(target.minScore) || 0;
  const empMin = target.employeesMin != null ? Number(target.employeesMin) : null;
  const empMax = target.employeesMax != null ? Number(target.employeesMax) : null;

  const tick = () => new Promise((r) => setTimeout(r, 15)); // yield to event loop

  try {
    // Stage 0: Discovery (via enabled providers, sliced for responsiveness)
    const activeMethods = methods.length ? methods : ['business_directory', 'search_engine'];
    const perMethod = Math.ceil(planned / Math.max(activeMethods.length, 1));
    const raw = [];
    const provs = {
      business_directory: new providers.DemoDirectoryProvider(),
      search_engine: new providers.DemoSearchProvider()
    };
    for (let m = 0; m < activeMethods.length; m++) {
      if (state.cancelled) break;
      const mk = activeMethods[m];
      const prov = provs[mk] || provs.business_directory;
      try {
        const batch = await prov.discover(target, perMethod);
        raw.push(...batch);
      } catch (e) {
        stats.errors.push(`Method ${mk}: ${e.message}`);
      }
      stats.discovered = raw.length;
      setProgress(jobId, 0, ((m + 1) / activeMethods.length) * 100, stats);
      await tick();
    }
    if (state.cancelled) return finish(jobId, 'cancelled', stats);

    // Stage 1: Deduplication
    const seen = new Set();
    const unique = [];
    for (let i = 0; i < raw.length; i++) {
      const k = dedupKey(raw[i]);
      if (seen.has(k)) { stats.duplicates_removed++; continue; }
      // also check existing DB
      const exists = raw[i].domain
        ? db.prepare('SELECT id FROM companies WHERE domain = ?').get(raw[i].domain.toLowerCase())
        : db.prepare('SELECT id FROM companies WHERE lower(name)=lower(?) AND country=?').get(raw[i].name, raw[i].country);
      if (exists) { stats.duplicates_removed++; continue; }
      seen.add(k);
      unique.push(raw[i]);
      if (i % 200 === 0) { setProgress(jobId, 1, (i / raw.length) * 100, stats); await tick(); }
    }
    setProgress(jobId, 1, 100, stats);

    // Enrichment providers
    const enrichProv = new providers.DemoEnrichmentProvider();
    const techProv = new providers.DemoTechnologyProvider();
    const contactProv = new providers.DemoContactProvider();

    const created = [];
    for (let i = 0; i < unique.length; i++) {
      if (state.cancelled) break;
      const c = unique[i];
      try {
        // Stage 2: company enrichment
        await enrichProv.enrich(c);
        // size filters
        if ((empMin != null && c.employee_count < empMin) || (empMax != null && c.employee_count > empMax)) continue;

        // Stage 3: contacts (outside the transaction so suppression can skip the whole record)
        const contacts = await contactProv.find(c);
        if (isSuppressed(c.domain, (contacts.find((x) => x.is_primary) || contacts[0] || {}).email)) continue;

        // Stage 4: technologies
        const tech = await techProv.detect(c);
        // Stage 5/6 input: evidence
        const evidence = providers.synthEvidence(c);

        const tx = db.transaction(() => {
          const ins = db.prepare(
            `INSERT INTO companies (name, website, domain, industry, business_model, description, country, city, employee_count, revenue_band, founded_year, is_demo, enriched, data_confidence)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`
          ).run(c.name, c.website, c.domain, c.industry, c.business_model, c.description, c.country, c.city, c.employee_count, c.revenue_band, c.founded_year, c.enriched, c.data_confidence);
          const companyId = Number(ins.lastInsertRowid);

          let primaryId = null;
          for (const ct of contacts) {
            const r = db.prepare(
              `INSERT INTO contacts (company_id, name, role, email, phone, linkedin_url, email_status, is_primary, confidence, source)
               VALUES (?,?,?,?,?,?,?,?,?,?)`
            ).run(companyId, ct.name, ct.role, ct.email, ct.phone, ct.linkedin_url, ct.email_status, ct.is_primary, ct.confidence, ct.source);
            if (ct.is_primary) primaryId = Number(r.lastInsertRowid);
          }

          // Stage 4 insert: technologies
          for (const t of tech) {
            db.prepare(`INSERT INTO company_technologies (company_id, technology, category, confidence, source) VALUES (?,?,?,?,?)`)
              .run(companyId, t.technology, t.category, t.confidence, t.source);
          }

          // Stage 5/6: signals + compliance (derived from evidence generated for demo)
          const signals = [];
          const compliance = [];
          for (const e of evidence) {
            if (e.evidence_type === 'job_posting') {
              signals.push({ signal_type: 'security_hiring', category: 'hiring', title: e.title, confidence: e.confidence, relevant_services: 'VAPT, SOC, Security Audit' });
            } else if (e.evidence_type === 'compliance') {
              signals.push({ signal_type: 'compliance_mention', category: 'compliance', title: e.title, confidence: e.confidence, relevant_services: 'GRC, Security Audit' });
              const fw = intel.COMPLIANCE_FRAMEWORKS.find((f) => e.title.includes(f.fw));
              if (fw) compliance.push({ framework: fw.fw, status: 'Required', evidence: e.description, confidence: e.confidence });
            } else if (e.evidence_type === 'website') {
              signals.push({ signal_type: 'app_launch', category: 'technology', title: e.title, confidence: e.confidence, relevant_services: 'VAPT' });
            } else if (e.evidence_type === 'expansion') {
              signals.push({ signal_type: 'market_expansion', category: 'event', title: e.title, confidence: e.confidence, relevant_services: 'GRC' });
            } else if (e.evidence_type === 'security_page') {
              signals.push({ signal_type: 'security_page', category: 'security', title: e.title, confidence: e.confidence, relevant_services: 'GRC, Security Audit' });
            }
          }
          // Stage 7: intent + Stage 8: scoring
          const score = intel.scoreLead(c, { signals, compliance, tech, evidence, contacts, weights, target });

          const lr = db.prepare(
            `INSERT INTO leads (company_id, primary_contact_id, status, lead_score, score_category, company_fit_score, security_signal_score, intent_score, service_fit_score, data_quality_score,
              intent, recommended_service, service_relevance, confidence, source, source_url, discovery_method, is_demo)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
          ).run(
            companyId, primaryId, score.lead_score >= 75 ? 'Qualified' : 'New', score.lead_score, score.score_category,
            score.breakdown.company_fit, score.breakdown.security_signals, score.breakdown.intent, score.breakdown.service_fit, score.breakdown.data_quality,
            score.intent, score.relevance.primary.service, JSON.stringify(score.relevance.all), c.data_confidence,
            c.source, c.source_url, c.method
          );
          const leadId = Number(lr.lastInsertRowid);

          for (const e of evidence) {
            db.prepare(
              `INSERT INTO lead_evidence (lead_id, evidence_type, title, description, source_name, source_url, observed_at, confidence, related_service)
               VALUES (?,?,?,?,?,?,?,?,?)`
            ).run(leadId, e.evidence_type, e.title, e.description, e.source_name, e.source_url, e.observed_at, e.confidence, e.related_service);
          }
          for (const s of signals) {
            db.prepare(`INSERT INTO lead_signals (lead_id, signal_type, category, title, confidence, relevant_services) VALUES (?,?,?,?,?,?)`)
              .run(leadId, s.signal_type, s.category, s.title, s.confidence, s.relevant_services);
          }
          for (const cm of compliance) {
            db.prepare(`INSERT INTO company_compliance (company_id, framework, status, evidence, confidence) VALUES (?,?,?,?,?)`)
              .run(companyId, cm.framework, cm.status, cm.evidence, cm.confidence);
          }
          db.prepare(`INSERT INTO lead_sources (lead_id, method, provider, source_name, source_url, confidence) VALUES (?,?,?,?,?,?)`)
            .run(leadId, c.method, 'Demo Provider', c.source, c.source_url, 'Medium');

          stats.enriched++;
          if (score.lead_score >= minScore && minScore > 0) { stats.qualified++; }
          else if (minScore === 0 && score.lead_score >= 75) { stats.qualified++; }
          if (score.intent_score >= 60) stats.high_intent++;
          if (score.lead_score >= 75) stats.high_score++;

          created.push(leadId);
        });
        tx();
      } catch (e) {
        stats.errors.push(`Lead ${c.name}: ${e.message}`);
      }

      // progress across stages 2..9 spread over the lead loop
      const f = i / Math.max(unique.length, 1);
      const stageIdx = 2 + Math.min(7, Math.floor(f * 8));
      const stagePct = ((f * 8) % 1) * 100;
      setProgress(jobId, stageIdx, stagePct, stats);
      if (i % 25 === 0) await tick();
    }
    setProgress(jobId, 9, 100, stats);
    if (state.cancelled) return finish(jobId, 'cancelled', stats);
    finish(jobId, stats.errors.length ? 'partially_completed' : 'completed', stats);
  } catch (e) {
    stats.errors.push(e.message);
    updateJob(jobId, { status: 'failed', error: e.message, completed_at: now(), stats_json: JSON.stringify(stats) });
    running.delete(jobId);
  }
}

function finish(jobId, status, stats) {
  updateJob(jobId, { status, completed_at: now(), stats_json: JSON.stringify(stats) });
  running.delete(jobId);
}

function cancelJob(jobId) {
  const state = running.get(jobId);
  if (state) { state.cancelled = true; return true; }
  const job = getJob(jobId);
  if (job && (job.status === 'pending' || job.status === 'running')) {
    updateJob(jobId, { status: 'cancelled', completed_at: now() });
    return true;
  }
  return false;
}

module.exports = { startJob, runJob, cancelJob, STAGES, running, dedupKey };
