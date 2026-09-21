/**
 * Intelligence engines: signal catalogs, transparent scoring, service relevance.
 * Every score is explainable — the same inputs always produce the same score,
 * and every component returns the reasoning that led to it.
 */

// ---------- catalogs ----------
const INDUSTRIES = [
  'SaaS', 'Software House', 'FinTech', 'Healthcare', 'E-commerce', 'Manufacturing',
  'Logistics', 'Education', 'Law Firm', 'Accounting', 'Real Estate', 'Insurance',
  'Professional Services', 'Startup', 'IT Services', 'MSP', 'Media', 'Travel'
];

const REVENUE_BANDS = ['<$100K', '$100K-$500K', '$500K-$1M', '$1M-$5M', '$5M-$10M', '$10M+'];

const COUNTRIES = {
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Leeds'],
  'United States': ['New York', 'Austin', 'San Francisco', 'Chicago', 'Seattle', 'Boston'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
  'UAE': ['Dubai', 'Abu Dhabi'],
  'Saudi Arabia': ['Riyadh', 'Jeddah'],
  'Singapore': ['Singapore'],
  'Netherlands': ['Amsterdam', 'Rotterdam'],
  'France': ['Paris', 'Lyon'],
  'Pakistan': ['Karachi', 'Lahore', 'Islamabad']
};

const SECURITY_SIGNAL_TYPES = [
  { type: 'security_hiring', label: 'Cybersecurity hiring', weight: 9, services: 'VAPT, SOC, Security Audit' },
  { type: 'compliance_mention', label: 'Public compliance requirement', weight: 8, services: 'GRC, Security Audit' },
  { type: 'security_page', label: 'Public security/trust page', weight: 5, services: 'GRC, Security Audit' },
  { type: 'cloud_migration', label: 'Cloud infrastructure expansion', weight: 5, services: 'VAPT, Security Audit' },
  { type: 'customer_data', label: 'Handles sensitive customer data', weight: 6, services: 'VAPT, SOC' },
  { type: 'vendor_questionnaire', label: 'Vendor security questionnaire requirement', weight: 7, services: 'GRC, Security Audit' },
  { type: 'enterprise_customers', label: 'Recent enterprise customer acquisition', weight: 6, services: 'GRC, VAPT' },
  { type: 'market_expansion', label: 'New market expansion', weight: 4, services: 'GRC' },
  { type: 'incident_public', label: 'Publicly disclosed security incident', weight: 10, services: 'VAPT, SOC, Security Audit' },
  { type: 'app_launch', label: 'New customer-facing application launch', weight: 5, services: 'VAPT' },
  { type: 'infra_expansion', label: 'Infrastructure expansion', weight: 4, services: 'Security Audit' },
  { type: 'security_questionnaire_req', label: 'Requires third-party security assessments', weight: 7, services: 'VAPT, GRC' }
];

const SECURITY_ROLES = [
  'Security Engineer', 'SOC Analyst', 'Security Analyst', 'CISO', 'Compliance Manager',
  'GRC Analyst', 'Penetration Tester', 'DevSecOps Engineer', 'Cloud Security Engineer',
  'Risk Manager', 'Information Security Manager'
];

const COMPLIANCE_FRAMEWORKS = [
  { fw: 'SOC 2', services: 'Security Audit, GRC, VAPT' },
  { fw: 'ISO 27001', services: 'GRC, Security Audit' },
  { fw: 'PCI DSS', services: 'VAPT, GRC, Security Audit' },
  { fw: 'HIPAA', services: 'GRC, Security Audit' },
  { fw: 'GDPR', services: 'GRC' },
  { fw: 'CCPA', services: 'GRC' },
  { fw: 'NIST', services: 'GRC, Security Audit' },
  { fw: 'CIS Controls', services: 'Security Audit' },
  { fw: 'FedRAMP', services: 'GRC, Security Audit' },
  { fw: 'DORA', services: 'GRC, SOC' }
];

const TECHNOLOGIES = [
  { name: 'AWS', category: 'Cloud' }, { name: 'Azure', category: 'Cloud' },
  { name: 'Google Cloud', category: 'Cloud' }, { name: 'Cloudflare', category: 'Cloud' },
  { name: 'Kubernetes', category: 'Infrastructure' }, { name: 'Docker', category: 'Infrastructure' },
  { name: 'WordPress', category: 'CMS' }, { name: 'Shopify', category: 'E-commerce' },
  { name: 'Magento', category: 'E-commerce' }, { name: 'React', category: 'Frontend' },
  { name: 'Node.js', category: 'Backend' }, { name: 'PHP', category: 'Backend' },
  { name: 'Laravel', category: 'Backend' }, { name: 'Django', category: 'Backend' },
  { name: 'Salesforce', category: 'CRM' }, { name: 'Microsoft 365', category: 'Productivity' }
];

// Technologies that increase security-relevance (public attack surface / regulated workloads)
const HIGH_RELEVANCE_TECH = new Set(['AWS', 'Azure', 'Google Cloud', 'Kubernetes', 'WordPress', 'Shopify', 'Magento', 'Node.js', 'PHP']);

const SERVICES = ['VAPT', 'SOC', 'GRC', 'Security Audit'];

const LEAD_STATUSES = [
  'New', 'Researching', 'Qualified', 'High Intent', 'Contacted', 'Email Sent', 'Opened',
  'Replied', 'Meeting Requested', 'Meeting Booked', 'Proposal Sent', 'Won', 'Lost',
  'Not Interested', 'Do Not Contact'
];

const OPEN_STATUSES = ['New', 'Researching', 'Qualified', 'High Intent'];

const SCORE_CATEGORIES = (s) =>
  s >= 90 ? 'Very High Potential' : s >= 75 ? 'High Potential' : s >= 50 ? 'Medium Potential' : s >= 25 ? 'Low Potential' : 'Very Low Potential';

const SCORE_INTENT = (s) =>
  s >= 80 ? 'Very High' : s >= 60 ? 'High' : s >= 40 ? 'Medium' : s >= 20 ? 'Low' : 'Very Low';

// ---------- scoring engine ----------
// Weights come from settings so administrators can tune them. Default 20 each.
const DEFAULT_WEIGHTS = { company_fit: 20, security_signals: 20, intent: 20, service_fit: 20, data_quality: 20 };

function getWeights(settings) {
  const w = (settings && settings.score_weights) || DEFAULT_WEIGHTS;
  const total = Object.values(w).reduce((a, b) => a + Number(b || 0), 0) || 1;
  // normalize to a 100-point scale while keeping the admin's relative weights
  const norm = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) norm[k] = Math.round(100 * Number(w[k] || 0) / total);
  return norm;
}

/**
 * scoreLead(company, ctx) -> { lead_score, category, intent, breakdown, reasoning }
 * ctx: { signals:[], compliance:[], tech:[], evidence:[], contacts:[], weights, target }
 * Deterministic, evidence-driven, no randomness.
 */
function scoreLead(company, ctx) {
  const weights = ctx.weights || getWeights(ctx.settings);
  const target = ctx.target || {};
  const reasons = { company_fit: [], security_signals: [], intent: [], service_fit: [], data_quality: [] };

  // --- Company Fit ---
  let fit = 0;
  const industry = (company.industry || '').toLowerCase();
  const targetIndustries = (target.industries || []).map((i) => i.toLowerCase());
  if (targetIndustries.length === 0) { fit += 7; reasons.company_fit.push('Industry within general SMB target.'); }
  else if (targetIndustries.some((i) => industry.includes(i) || i.includes(industry))) {
    fit += 10; reasons.company_fit.push(`Industry (${company.industry}) matches campaign targeting.`);
  } else { fit += 3; reasons.company_fit.push(`Industry (${company.industry}) is adjacent to targeting.`); }

  const emp = Number(company.employee_count || 0);
  if (emp >= 10 && emp <= 250) { fit += 7; reasons.company_fit.push(`Employee count (${emp}) sits in the SMB service sweet spot.`); }
  else if (emp > 250 && emp <= 1000) { fit += 4; reasons.company_fit.push(`Employee count (${emp}) is above typical SMB range.`); }
  else { fit += 2; reasons.company_fit.push(`Employee count (${emp || 'unknown'}) is outside the primary range.`); }

  const bm = (company.business_model || '').toLowerCase();
  if (['saas', 'e-commerce', 'fintech', 'online'].some((k) => bm.includes(k))) {
    fit += 5; reasons.company_fit.push('Business model relies on online/customer-facing platforms.');
  } else { fit += 3; }

  if (company.country && (target.countries || []).length && target.countries.includes(company.country)) {
    fit += 3; reasons.company_fit.push(`Located in a target geography (${company.country}).`);
  } else { fit += 1; }

  // --- Security Signals ---
  const sigs = ctx.signals || [];
  let sec = 0;
  const SIG_MAX = 24; // raw cap before normalization
  for (const s of sigs) {
    const def = SECURITY_SIGNAL_TYPES.find((d) => d.type === s.signal_type);
    const w = def ? def.weight : 4;
    sec += s.confidence === 'High' ? w : s.confidence === 'Medium' ? w * 0.7 : w * 0.4;
  }
  if (sigs.length) {
    reasons.security_signals.push(`${sigs.length} publicly observable security signal(s) detected, strongest: "${sigs[0].title || sigs[0].signal_type}".`);
  } else {
    reasons.security_signals.push('No direct security signals observed; score driven by industry context.');
  }
  const compliance = ctx.compliance || [];
  sec += compliance.length * 3;
  if (compliance.length) reasons.security_signals.push(`Public references to ${compliance.map((c) => c.framework).join(', ')} indicate compliance requirements.`);
  const tech = ctx.tech || [];
  const hiTech = tech.filter((t) => HIGH_RELEVANCE_TECH.has(t.technology));
  sec += Math.min(6, hiTech.length * 2);
  if (hiTech.length) reasons.security_signals.push(`Infrastructure technologies (${hiTech.map((t) => t.technology).join(', ')}) expand the public attack surface.`);

  // --- Intent ---
  let intent = 0;
  const hiring = sigs.filter((s) => s.signal_type === 'security_hiring' || s.category === 'hiring');
  if (hiring.length) { intent += 12; reasons.intent.push('Actively hiring for in-house security roles — evidence of current security investment.'); }
  const prep = compliance.filter((c) => /in progress|preparing|required/i.test(c.status || ''));
  if (prep.length) { intent += 10; reasons.intent.push(`Compliance preparation observed (${prep.map((c) => c.framework).join('/')}).`); }
  else if (compliance.length) { intent += 6; reasons.intent.push('Established compliance requirements suggest ongoing audit needs.'); }
  if (sigs.some((s) => s.signal_type === 'enterprise_customers')) { intent += 8; reasons.intent.push('New enterprise customers typically trigger vendor security assessments.'); }
  if (sigs.some((s) => s.signal_type === 'market_expansion' || s.signal_type === 'app_launch')) { intent += 6; reasons.intent.push('Recent expansion/launch activity raises external-assessment likelihood.'); }
  const recent = (ctx.evidence || []).some((e) => {
    if (!e.observed_at) return false;
    const days = (Date.now() - new Date(e.observed_at).getTime()) / 86400000;
    return days <= 90;
  });
  if (recent) { intent += 5; reasons.intent.push('Supporting evidence observed within the last 90 days (fresh).'); }

  // --- Service Fit ---
  const rel = serviceRelevance(company, ctx);
  let service = Math.round(rel.primary.score / 10); // 0-10
  reasons.service_fit.push(rel.primary.reasoning);

  // --- Data Quality ---
  let dq = 0;
  const fields = ['name', 'website', 'domain', 'industry', 'country', 'city', 'employee_count'];
  const filled = fields.filter((f) => company[f] !== null && company[f] !== undefined && company[f] !== '').length;
  dq += Math.round(10 * filled / fields.length);
  const contacts = ctx.contacts || [];
  if (contacts.some((c) => c.email)) { dq += 6; reasons.data_quality.push('Direct contact with business email available.'); }
  else if (contacts.length) { dq += 3; }
  else { reasons.data_quality.push('No direct contact found yet — enrichment recommended.'); }
  const conf = (company.data_confidence || 'Medium');
  dq += conf === 'High' ? 4 : conf === 'Medium' ? 2 : 0;

  // normalize each to its weight
  const parts = {
    company_fit: Math.min(weights.company_fit, Math.round((fit / 25) * weights.company_fit)),
    security_signals: Math.min(weights.security_signals, Math.round((sec / SIG_MAX) * weights.security_signals)),
    intent: Math.min(weights.intent, Math.round((intent / 41) * weights.intent)),
    service_fit: Math.min(weights.service_fit, Math.round((service / 10) * weights.service_fit)),
    data_quality: Math.min(weights.data_quality, Math.round((dq / 20) * weights.data_quality))
  };
  const lead_score = Object.values(parts).reduce((a, b) => a + b, 0);
  const intentScore = Math.min(100, Math.round((intent / 41) * 100));

  return {
    lead_score,
    score_category: SCORE_CATEGORIES(lead_score),
    intent: SCORE_INTENT(intentScore),
    intent_score: intentScore,
    breakdown: parts,
    reasoning: reasons,
    relevance: rel
  };
}

// ---------- service relevance ----------
function serviceRelevance(company, ctx) {
  const reasons = { VAPT: [], SOC: [], GRC: [], 'Security Audit': [] };
  let vapt = 35, soc = 25, grc = 30, audit = 35;
  const bm = (company.business_model || '').toLowerCase();
  const industry = (company.industry || '').toLowerCase();

  if (['saas', 'e-commerce', 'fintech', 'online', 'marketplace'].some((k) => bm.includes(k) || industry.includes(k))) {
    vapt += 30; audit += 25;
    reasons.VAPT.push('High because the company operates a public-facing online application.');
    reasons['Security Audit'].push('Public-facing application increases external assessment value.');
  }
  const tech = (ctx.tech || []).map((t) => t.technology);
  if (tech.some((t) => ['AWS', 'Azure', 'Google Cloud', 'Kubernetes'].includes(t))) {
    vapt += 15; audit += 10;
    reasons.VAPT.push('Cloud infrastructure usage expands the external attack surface.');
  }
  const comp = ctx.compliance || [];
  if (comp.some((c) => ['SOC 2', 'ISO 27001', 'NIST', 'FedRAMP', 'DORA'].includes(c.framework))) {
    grc += 35; audit += 20;
    reasons.GRC.push(`High because the company publicly references ${comp.map((c) => c.framework).filter((f) => ['SOC 2', 'ISO 27001', 'NIST', 'FedRAMP', 'DORA'].includes(f)).join('/')} compliance.`);
  }
  if (comp.some((c) => c.framework === 'PCI DSS')) {
    vapt += 20;
    reasons.VAPT.push('PCI DSS scope requires regular penetration testing.');
  }
  if (comp.some((c) => c.framework === 'HIPAA')) {
    grc += 15; audit += 10;
    reasons.GRC.push('HIPAA-regulated data handling implies audit requirements.');
  }
  const sigs = ctx.signals || [];
  if (sigs.some((s) => s.signal_type === 'security_hiring')) {
    soc += 20; vapt += 10;
    reasons.SOC.push('Moderate because the company is expanding its security operations.');
  }
  if (sigs.some((s) => s.signal_type === 'incident_public')) {
    soc += 30; vapt += 20; audit += 15;
    reasons.SOC.push('Recent public incident indicates detection and response gaps.');
  }
  if (sigs.some((s) => s.signal_type === 'customer_data')) {
    vapt += 10; audit += 10;
    reasons.VAPT.push('Handles sensitive customer information.');
  }
  if (['accounting', 'law firm', 'insurance', 'professional services'].some((k) => industry.includes(k))) {
    grc += 15;
    reasons.GRC.push('Regulated professional-services sector carries advisory obligations.');
  }

  const clamp = (n) => Math.max(5, Math.min(97, n));
  const scored = [
    { service: 'VAPT', score: clamp(vapt), reasoning: reasons.VAPT.join(' ') || 'General external testing value for an online business.' },
    { service: 'SOC', score: clamp(soc), reasoning: reasons.SOC.join(' ') || 'No current evidence of a dedicated monitoring requirement.' },
    { service: 'GRC', score: clamp(grc), reasoning: reasons.GRC.join(' ') || 'Standard advisory relevance for a growing company.' },
    { service: 'Security Audit', score: clamp(audit), reasoning: reasons['Security Audit'].join(' ') || 'Baseline assessment relevance.' }
  ].sort((a, b) => b.score - a.score);

  return { primary: scored[0], all: scored, secondary: scored.slice(1, 3) };
}

module.exports = {
  INDUSTRIES, REVENUE_BANDS, COUNTRIES, SECURITY_SIGNAL_TYPES, SECURITY_ROLES,
  COMPLIANCE_FRAMEWORKS, TECHNOLOGIES, SERVICES, LEAD_STATUSES, OPEN_STATUSES,
  SCORE_CATEGORIES, SCORE_INTENT, DEFAULT_WEIGHTS, getWeights, scoreLead, serviceRelevance
};
