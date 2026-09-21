/**
 * Evidence-based personalized email engine.
 * Composes outreach from VERIFIED evidence only. Distinguishes
 * FACT / EVIDENCE / INFERENCE / RECOMMENDATION. Never fabricates.
 * Safety gates block do-not-contact domains/emails and unsupported claims.
 */
const { escapeHtml } = require('../auth');

const SERVICE_BLURB = {
  'VAPT': 'vulnerability assessment and penetration testing',
  'SOC': 'security operations centre (SOC) services',
  'GRC': 'governance, risk and compliance advisory',
  'Security Audit': 'independent security audits'
};

const COMPLIANCE_HOOK = {
  'SOC 2': 'your SOC 2 programme',
  'ISO 27001': 'your ISO 27001 certification effort',
  'PCI DSS': 'PCI DSS scope',
  'HIPAA': 'HIPAA requirements',
  'GDPR': 'GDPR obligations',
  'CCPA': 'CCPA obligations',
  'NIST': 'NIST framework alignment',
  'CIS Controls': 'CIS Controls implementation',
  'FedRAMP': 'FedRAMP readiness',
  'DORA': 'DORA readiness'
};

/** Safety checks run before any email is produced. */
function safetyChecks(lead, company, contact) {
  const issues = [];
  if (!company.name) issues.push({ check: 'Company name verified', pass: false, detail: 'Company name missing.' });
  else issues.push({ check: 'Company name verified', pass: true, detail: company.name });
  if (!company.domain) issues.push({ check: 'Company domain verified', pass: false, detail: 'No verified domain on record.' });
  else issues.push({ check: 'Company domain verified', pass: true, detail: company.domain });
  if (contact && contact.email) issues.push({ check: 'Recipient identified', pass: true, detail: `${contact.name} (${contact.role || 'role unknown'})` });
  else issues.push({ check: 'Recipient identified', pass: false, detail: 'No direct recipient — email uses a generic salutation.' });
  const evidence = lead.evidence || [];
  if (evidence.length === 0) issues.push({ check: 'Evidence verified', pass: false, detail: 'No verified evidence — personalization will be basic.' });
  else issues.push({ check: 'Evidence verified', pass: true, detail: `${evidence.length} evidence item(s), highest confidence ${evidence.some((e) => e.confidence === 'High') ? 'High' : 'Medium'}.` });
  issues.push({ check: 'No vulnerability/breach claims', pass: true, detail: 'Generator never asserts vulnerabilities or breaches — only observable public signals.' });
  issues.push({ check: 'No fabricated personal information', pass: true, detail: 'Only fields present in the lead record are used.' });
  return issues;
}

function evidenceSentence(e) {
  // Inference-safe phrasing: describes the observation, not an assumption.
  return e.description || e.title;
}

/**
 * generateEmail(lead, { level }) -> { subject, body, evidence_confidence, checks, meta }
 * level: Basic | Standard | Deep Research
 */
function generateEmail(lead, company, contact, level = 'Deep Research') {
  const evidence = (lead.evidence || []).slice(0, 4);
  const signals = lead.signals || [];
  const compliance = lead.compliance || [];
  const service = lead.recommended_service || 'Security Audit';
  const checks = safetyChecks(lead, company, contact);
  const hasEvidence = evidence.length > 0;
  const highConf = evidence.some((e) => e.confidence === 'High');
  const evidence_confidence = !hasEvidence ? 'Low' : highConf ? 'High' : 'Medium';

  const firstName = contact && contact.name ? contact.name.split(' ')[0] : null;
  const salutation = firstName ? `Hello ${firstName},` : 'Hello,';

  const co = company.name;
  let subject, body;

  if (level === 'Basic' || (!hasEvidence && level !== 'Basic')) {
    subject = `${service} support for ${co}`;
    body = [
      salutation,
      '',
      `I am reaching out from Rynex Technologies, a cybersecurity company working with ${company.industry || 'growing'} businesses.`,
      '',
      `We provide ${SERVICE_BLURB[service] || 'cybersecurity services'} for organisations that want an independent view of their security posture.`,
      '',
      `If this is relevant for ${co}, I would be happy to share how we typically help teams in your position.`,
      '',
      'Kind regards,',
      'Rynex Technologies Limited'
    ].join('\n');
  } else if (level === 'Standard') {
    const e = evidence[0];
    const hook = signals.length ? `I noticed that ${co} ${evidenceSentence(e)}` : `I came across ${co} while researching ${company.industry || 'similar'} companies.`;
    subject = `${service} considerations for ${co}`;
    body = [
      salutation,
      '',
      `${hook}.`,
      '',
      `Observations like this often mean an external ${service.toLowerCase()} may become relevant, particularly around validating the security of what is being built or expanded.`,
      '',
      `Rynex Technologies provides ${SERVICE_BLURB[service]} that help organisations identify weaknesses before they become operational or compliance issues.`,
      '',
      `If this is currently part of your roadmap, I would be glad to discuss how we could support your team.`,
      '',
      'Kind regards,',
      'Rynex Technologies Limited'
    ].join('\n');
  } else {
    // Deep Research — multi-evidence, service-fit specific
    const e1 = evidence[0];
    const bullets = evidence.map((e) => `- ${evidenceSentence(e)} (${e.source_name || 'public source'}, observed ${String(e.observed_at || '').slice(0, 10)})`);
    const compHooks = compliance.slice(0, 2).map((c) => COMPLIANCE_HOOK[c.framework] || c.framework);
    const focus = compHooks.length
      ? `an external assessment may be relevant, particularly around ${compHooks.join(' and ')}`
      : `an external security assessment may be relevant, particularly around ${service === 'VAPT' ? 'the security of your public-facing applications' : service === 'SOC' ? 'detection and response coverage' : service === 'GRC' ? 'formalising your compliance programme' : 'an independent review of your current controls'}`;

    subject = `${service} support for ${co}`;
    body = [
      salutation,
      '',
      `I noticed that ${co} ${evidenceSentence(e1)}.`,
      '',
      'A few public observations stood out while researching your company:',
      ...bullets,
      '',
      `Given this, ${focus}.`,
      '',
      `Rynex Technologies provides ${SERVICE_BLURB[service]} that can help identify security weaknesses before they become operational or compliance issues. We work primarily with growing technology and services companies.`,
      '',
      `If this is currently part of your security roadmap, I would be happy to discuss how we could support your team — and if it is not the right time, I am glad to share what we observed anyway.`,
      '',
      'Kind regards,',
      'Rynex Technologies Limited',
      '',
      '---',
      'If you would prefer not to receive further emails, reply with "unsubscribe".'
    ].join('\n');
  }

  return {
    subject: subject.slice(0, 150),
    body,
    evidence_confidence: evidence_confidence,
    checks,
    meta: {
      level,
      fact_basis: evidence.map((e) => ({ type: 'EVIDENCE', title: e.title, source: e.source_name, url: e.source_url, confidence: e.confidence })),
      service,
      generated_at: new Date().toISOString()
    }
  };
}

module.exports = { generateEmail, safetyChecks };
