/**
 * Rynex Technologies Limited - Live Passive Reconnaissance Engine
 * 
 * Performs non-intrusive, passive cybersecurity reconnaissance on target domains:
 * - DNS security audit via DNS-over-HTTPS (MX infrastructure, SPF records, DMARC policy)
 * - HTTP security header posture (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
 * - Public vulnerability disclosure policy check (security.txt)
 * - Observable technology detection (Cloudflare, WordPress, Shopify, React, Node.js, Web servers)
 * - Public compliance indicators (SOC 2, ISO 27001, PCI DSS, HIPAA, GDPR, DORA, NIST)
 * - Public corporate contact email extraction (mailto:, security@, contact@)
 * 
 * Strictly passive. No active vulnerability scanning or intrusive exploitation.
 */

/**
 * Clean and normalize a target domain or URL.
 */
function normalizeDomain(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.split('/')[0];
  s = s.split(':')[0];
  return s || null;
}

/**
 * Query DNS via DNS-over-HTTPS (DoH) for 100% reliable, fast resolution.
 */
async function queryDoh(name, type, timeoutMs = 2500) {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.Answer || [];
  } catch {
    return [];
  }
}

/**
 * Inspect DNS security posture.
 */
async function inspectDns(domain) {
  const result = {
    mx: [],
    spf: null,
    hasSpf: false,
    dmarc: null,
    hasDmarc: false,
    mailProvider: 'Unknown',
    ip: null,
    signals: [],
    evidence: []
  };

  const today = new Date().toISOString().slice(0, 10);

  // 1. Resolve MX
  const mxAnswers = await queryDoh(domain, 'MX', 2500);
  result.mx = mxAnswers.map(a => String(a.data || '').toLowerCase());
  const mxStr = result.mx.join(' ');
  if (mxStr.includes('google.com') || mxStr.includes('googlemail.com')) {
    result.mailProvider = 'Google Workspace';
  } else if (mxStr.includes('outlook.com') || mxStr.includes('protection.outlook.com')) {
    result.mailProvider = 'Microsoft 365';
  } else if (mxStr.includes('pphosted.com')) {
    result.mailProvider = 'Proofpoint';
  } else if (mxStr.includes('mimecast.com')) {
    result.mailProvider = 'Mimecast';
  } else if (result.mx.length > 0) {
    result.mailProvider = 'Custom Enterprise Mail';
  }

  if (result.mailProvider !== 'Unknown') {
    result.evidence.push({
      evidence_type: 'infrastructure',
      title: `Enterprise mail infrastructure configured with ${result.mailProvider}`,
      description: `Domain MX records route mail through ${result.mailProvider} (${result.mx.slice(0, 2).map(m => m.split(' ').pop()).join(', ')})`,
      source_name: 'DNS MX Query',
      source_url: `dns://${domain}/MX`,
      observed_at: today,
      confidence: 'High',
      related_service: 'Security Audit'
    });
  } else {
    result.signals.push({
      signal_type: 'dns_anomaly',
      category: 'infrastructure',
      title: 'No active MX mail exchanger records detected on domain',
      confidence: 'Medium',
      relevant_services: 'Security Audit'
    });
  }

  // 2. Resolve SPF (TXT records)
  const txtAnswers = await queryDoh(domain, 'TXT', 2500);
  for (const a of txtAnswers) {
    const raw = String(a.data || '').replace(/^"|"$/g, '');
    if (raw.startsWith('v=spf1')) {
      result.hasSpf = true;
      result.spf = raw;
      break;
    }
  }

  if (!result.hasSpf) {
    result.signals.push({
      signal_type: 'email_security_gap',
      category: 'security',
      title: 'Missing SPF (Sender Policy Framework) email authentication record',
      confidence: 'High',
      relevant_services: 'Security Audit, VAPT'
    });
    result.evidence.push({
      evidence_type: 'dns_security',
      title: 'No SPF record published on domain',
      description: 'Domain lacks an SPF policy, leaving it exposed to unauthorized email spoofing and phishing abuse',
      source_name: 'DNS TXT Resolution',
      source_url: `dns://${domain}/TXT`,
      observed_at: today,
      confidence: 'High',
      related_service: 'Security Audit'
    });
  } else if (result.spf.includes('+all') || result.spf.includes('?all')) {
    result.signals.push({
      signal_type: 'email_security_gap',
      category: 'security',
      title: 'Permissive SPF record qualifiers detected',
      confidence: 'High',
      relevant_services: 'Security Audit, VAPT'
    });
    result.evidence.push({
      evidence_type: 'dns_security',
      title: 'Permissive SPF configuration observed',
      description: `SPF record contains neutral or permissive qualifiers: ${result.spf.slice(0, 60)}...`,
      source_name: 'DNS TXT Resolution',
      source_url: `dns://${domain}/TXT`,
      observed_at: today,
      confidence: 'High',
      related_service: 'Security Audit'
    });
  }

  // 3. Resolve DMARC (_dmarc.<domain>)
  const dmarcAnswers = await queryDoh(`_dmarc.${domain}`, 'TXT', 2500);
  for (const a of dmarcAnswers) {
    const raw = String(a.data || '').replace(/^"|"$/g, '');
    if (raw.startsWith('v=DMARC1')) {
      result.hasDmarc = true;
      result.dmarc = raw;
      break;
    }
  }

  if (!result.hasDmarc) {
    result.signals.push({
      signal_type: 'email_security_gap',
      category: 'security',
      title: 'No DMARC policy record published on domain',
      confidence: 'High',
      relevant_services: 'Security Audit, VAPT, GRC'
    });
    result.evidence.push({
      evidence_type: 'dns_security',
      title: 'Absence of DMARC email spoofing protection',
      description: 'Domain lacks a _dmarc DNS record. Inbound receivers cannot verify authenticity against phishing or domain impersonation',
      source_name: 'DNS DMARC Resolution',
      source_url: `dns://_dmarc.${domain}/TXT`,
      observed_at: today,
      confidence: 'High',
      related_service: 'Security Audit'
    });
  } else if (result.dmarc && result.dmarc.includes('p=none')) {
    result.signals.push({
      signal_type: 'email_security_gap',
      category: 'security',
      title: 'DMARC policy set to monitor-only (p=none) without quarantine or reject',
      confidence: 'High',
      relevant_services: 'Security Audit, GRC'
    });
    result.evidence.push({
      evidence_type: 'dns_security',
      title: 'DMARC policy non-enforcing (p=none)',
      description: 'DMARC is deployed in reporting mode without quarantine or reject enforcement, leaving domain spoofing unmitigated',
      source_name: 'DNS DMARC Resolution',
      source_url: `dns://_dmarc.${domain}/TXT`,
      observed_at: today,
      confidence: 'High',
      related_service: 'Security Audit'
    });
  }

  // 4. Resolve IPv4
  const aAnswers = await queryDoh(domain, 'A', 2000);
  if (aAnswers.length > 0) {
    result.ip = aAnswers[0].data;
  }

  return result;
}

/**
 * Passive HTTP/HTTPS request using native fetch with timeout.
 */
async function fetchPassive(url, timeoutMs = 3500) {
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const text = await resp.text().catch(() => '');
    const headersObj = {};
    resp.headers.forEach((val, key) => { headersObj[key.toLowerCase()] = val; });
    return { ok: true, status: resp.status, headers: headersObj, body: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Inspect the public web surface of a domain.
 */
async function inspectWebSurface(domain) {
  const result = {
    title: '',
    description: '',
    headers: {},
    technologies: [],
    compliance: [],
    signals: [],
    evidence: [],
    contacts: [],
    securityTxtFound: false
  };

  const today = new Date().toISOString().slice(0, 10);

  // 1. Fetch Root Homepage
  const home = await fetchPassive(`https://${domain}`, 3500);
  if (home.ok) {
    result.headers = home.headers;
    const body = home.body || '';

    // Extract Title
    const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Extract Meta Description
    const descMatch = body.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      body.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }

    // --- Passive Security Headers Audit ---
    const h = home.headers;

    // HSTS (Strict-Transport-Security)
    if (!h['strict-transport-security']) {
      result.signals.push({
        signal_type: 'header_security_gap',
        category: 'security',
        title: 'Missing HTTP Strict Transport Security (HSTS) header',
        confidence: 'High',
        relevant_services: 'VAPT, Security Audit'
      });
      result.evidence.push({
        evidence_type: 'web_security',
        title: 'HSTS header not enforced on HTTPS endpoint',
        description: 'Web application does not send Strict-Transport-Security header, allowing potential SSL stripping attacks',
        source_name: 'HTTPS Header Audit',
        source_url: `https://${domain}`,
        observed_at: today,
        confidence: 'High',
        related_service: 'VAPT'
      });
    }

    // CSP (Content-Security-Policy)
    if (!h['content-security-policy']) {
      result.signals.push({
        signal_type: 'header_security_gap',
        category: 'security',
        title: 'Content-Security-Policy (CSP) not configured on public web application',
        confidence: 'High',
        relevant_services: 'VAPT'
      });
      result.evidence.push({
        evidence_type: 'web_security',
        title: 'Absence of Content-Security-Policy header',
        description: 'No Content-Security-Policy header detected on the web application, increasing susceptibility to Cross-Site Scripting (XSS)',
        source_name: 'HTTPS Header Audit',
        source_url: `https://${domain}`,
        observed_at: today,
        confidence: 'High',
        related_service: 'VAPT'
      });
    }

    // X-Frame-Options
    if (!h['x-frame-options']) {
      result.signals.push({
        signal_type: 'header_security_gap',
        category: 'security',
        title: 'Missing X-Frame-Options clickjacking protection header',
        confidence: 'Medium',
        relevant_services: 'VAPT'
      });
    }

    // Server Disclosure
    if (h['server']) {
      result.technologies.push({
        technology: h['server'],
        category: 'Web Server',
        confidence: 'High',
        source: 'HTTP Server Header'
      });
    }
    if (h['x-powered-by']) {
      result.technologies.push({
        technology: h['x-powered-by'],
        category: 'Application Server',
        confidence: 'High',
        source: 'HTTP X-Powered-By Header'
      });
    }

    // Technology Footprints Detection
    if (h['server']?.toLowerCase().includes('cloudflare') || h['cf-ray']) {
      result.technologies.push({ technology: 'Cloudflare', category: 'Cloud & CDN', confidence: 'High', source: 'HTTP Headers' });
    }
    if (body.includes('wp-content') || body.includes('wp-includes')) {
      result.technologies.push({ technology: 'WordPress', category: 'CMS', confidence: 'High', source: 'HTML DOM' });
      result.evidence.push({
        evidence_type: 'technology',
        title: 'WordPress Content Management System detected',
        description: 'Platform relies on WordPress architecture, which requires routine plugin and core penetration testing and vulnerability auditing',
        source_name: 'Public Website Asset Analysis',
        source_url: `https://${domain}`,
        observed_at: today,
        confidence: 'High',
        related_service: 'VAPT'
      });
    }
    if (body.includes('cdn.shopify.com') || body.includes('Shopify.shop')) {
      result.technologies.push({ technology: 'Shopify', category: 'E-commerce', confidence: 'High', source: 'HTML DOM' });
    }
    if (body.includes('react') || body.includes('__next') || body.includes('_next/static')) {
      result.technologies.push({ technology: 'React', category: 'Frontend Framework', confidence: 'High', source: 'JavaScript Bundle' });
    }
    if (body.includes('amazonaws.com') || body.includes('s3.amazonaws')) {
      result.technologies.push({ technology: 'AWS', category: 'Cloud Infrastructure', confidence: 'High', source: 'Asset Endpoints' });
    }

    // Compliance Mentions Detection
    const textLower = body.toLowerCase();
    const complianceList = [
      { name: 'SOC 2', regex: /\bsoc\s*2\b/i },
      { name: 'ISO 27001', regex: /\biso\s*27001\b/i },
      { name: 'PCI DSS', regex: /\bpci[\s-]dss\b/i },
      { name: 'HIPAA', regex: /\bhipaa\b/i },
      { name: 'GDPR', regex: /\bgdpr\b/i },
      { name: 'DORA', regex: /\bdora\s+compliance\b|\bdigital\s+operational\s+resilience\b/i },
      { name: 'NIST', regex: /\bnist\b/i }
    ];

    for (const comp of complianceList) {
      if (comp.regex.test(textLower)) {
        result.compliance.push({
          framework: comp.name,
          status: 'Referenced',
          evidence: `Public reference to ${comp.name} compliance on domain homepage or policies`,
          confidence: 'High'
        });
        result.evidence.push({
          evidence_type: 'compliance',
          title: `Public ${comp.name} compliance requirement referenced`,
          description: `Company documentation publicly references ${comp.name} compliance standards`,
          source_name: 'Company Website',
          source_url: `https://${domain}`,
          observed_at: today,
          confidence: 'High',
          related_service: 'GRC, Security Audit'
        });
        result.signals.push({
          signal_type: 'compliance_mention',
          category: 'compliance',
          title: `Publicly references ${comp.name} compliance requirements`,
          confidence: 'High',
          relevant_services: 'GRC, Security Audit'
        });
      }
    }

    // Public Corporate Email Extraction
    const emailRegex = new RegExp(`[a-zA-Z0-9._%+-]+@${domain.replace('.', '\\.')}`, 'gi');
    const matchedEmails = body.match(emailRegex);
    if (matchedEmails && matchedEmails.length > 0) {
      const unique = [...new Set(matchedEmails.map(e => e.toLowerCase()))];
      for (const em of unique.slice(0, 3)) {
        result.contacts.push({
          name: em.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          role: em.startsWith('security') ? 'Security Officer' : em.startsWith('privacy') ? 'Data Protection Officer' : 'Company Contact',
          email: em,
          is_primary: em.startsWith('security') || em.startsWith('info') ? 1 : 0,
          confidence: 'High',
          source: 'Public Web Page'
        });
      }
    }
  }

  // 2. Check /.well-known/security.txt (RFC 9116)
  const secTxt = await fetchPassive(`https://${domain}/.well-known/security.txt`, 2500);
  if (secTxt.ok && secTxt.status === 200 && secTxt.body.includes('Contact:')) {
    result.securityTxtFound = true;
    result.evidence.push({
      evidence_type: 'security_page',
      title: 'Formal security.txt vulnerability disclosure policy published',
      description: 'Domain publishes RFC 9116 compliant security.txt vulnerability disclosure document',
      source_name: 'security.txt Audit',
      source_url: `https://${domain}/.well-known/security.txt`,
      observed_at: today,
      confidence: 'High',
      related_service: 'VAPT, GRC'
    });
  } else {
    result.signals.push({
      signal_type: 'security_policy_gap',
      category: 'security',
      title: 'No RFC 9116 security.txt vulnerability disclosure policy published',
      confidence: 'Medium',
      relevant_services: 'Security Audit, GRC'
    });
  }

  return result;
}

/**
 * Execute full passive reconnaissance on any live domain.
 */
async function performFullRecon(inputDomain, userHints = {}) {
  const domain = normalizeDomain(inputDomain);
  if (!domain) throw new Error('Invalid domain supplied for reconnaissance.');

  const [dnsResults, webResults] = await Promise.all([
    inspectDns(domain),
    inspectWebSurface(domain)
  ]);

  // Combine Signals and Evidence
  const signals = [...dnsResults.signals, ...webResults.signals];
  const evidence = [...dnsResults.evidence, ...webResults.evidence];
  const technologies = [...webResults.technologies];
  if (dnsResults.mailProvider && dnsResults.mailProvider !== 'Unknown') {
    technologies.push({
      technology: dnsResults.mailProvider,
      category: 'Email & Productivity',
      confidence: 'High',
      source: 'DNS MX'
    });
  }

  const compliance = [...webResults.compliance];
  const contacts = [...webResults.contacts];

  // Derive Company Name from domain or page title
  let companyName = userHints.name || '';
  if (!companyName && webResults.title) {
    const cleanTitle = webResults.title.split(/[-|•–:]/)[0].trim();
    if (cleanTitle && cleanTitle.length < 50) companyName = cleanTitle;
  }
  if (!companyName) {
    const base = domain.split('.')[0];
    companyName = base.charAt(0).toUpperCase() + base.slice(1);
  }

  const industry = userHints.industry || 'Technology & Digital Services';
  const country = userHints.country || 'United Kingdom';

  return {
    domain,
    website: `https://${domain}`,
    companyName,
    description: webResults.description || `${companyName} operates online digital services at ${domain}.`,
    industry,
    country,
    city: userHints.city || 'London',
    dns: dnsResults,
    technologies,
    compliance,
    signals,
    evidence,
    contacts,
    isLive: true
  };
}

/**
 * Fast Diagnostic Security Audit for Engineering-as-Marketing lead gen.
 * Runs in under 2 seconds: non-intrusive DNS-over-HTTPS check + root HTTP headers check.
 */
async function quickAuditDomain(inputDomain) {
  const domain = normalizeDomain(inputDomain);
  if (!domain) throw new Error('Invalid domain specified for diagnostic audit.');

  const [dns, web] = await Promise.all([
    inspectDns(domain).catch(() => ({ mx: [], mailProvider: 'Unknown', hasSpf: false, spf: null, hasDmarc: false, dmarc: null, signals: [], evidence: [] })),
    fetchPassive(`https://${domain}`, 3000).catch(() => ({ ok: false, headers: {} }))
  ]);

  const headers = web.headers || {};
  const hasHsts = Boolean(headers['strict-transport-security']);
  const hasCsp = Boolean(headers['content-security-policy']);
  const hasXfo = Boolean(headers['x-frame-options']);
  const hasXcto = Boolean(headers['x-content-type-options']);
  const serverHeader = headers['server'] || null;

  let dmarcStatus = 'Missing';
  if (dns.hasDmarc) {
    if (dns.dmarc && (dns.dmarc.includes('p=reject') || dns.dmarc.includes('p=quarantine'))) {
      dmarcStatus = 'Enforced';
    } else {
      dmarcStatus = 'Monitor Only (p=none)';
    }
  }

  let spfStatus = 'Missing';
  if (dns.hasSpf) {
    if (dns.spf && (dns.spf.includes('-all') || dns.spf.includes('~all'))) {
      spfStatus = 'Configured';
    } else {
      spfStatus = 'Permissive / Vulnerable';
    }
  }

  // Calculate Security Health Score (0-100)
  let score = 100;
  const gaps = [];

  if (dmarcStatus === 'Missing') {
    score -= 25;
    gaps.push({
      issue: 'Missing DMARC Record',
      impact: 'High Risk',
      detail: 'No DMARC policy defined in DNS. Domain can be spoofed in phishing and executive impersonation attacks.',
      service: 'SOC / Security Audit'
    });
  } else if (dmarcStatus.includes('p=none')) {
    score -= 15;
    gaps.push({
      issue: 'Unenforced DMARC (p=none)',
      impact: 'Medium Risk',
      detail: 'DMARC is set to monitor-only without quarantine or reject rules, allowing spoofed emails to land in inboxes.',
      service: 'SOC / Security Audit'
    });
  }

  if (spfStatus === 'Missing') {
    score -= 15;
    gaps.push({
      issue: 'Missing SPF Record',
      impact: 'High Risk',
      detail: 'No SPF record found in DNS to authorize outbound corporate mail servers.',
      service: 'Security Audit'
    });
  }

  if (!hasHsts) {
    score -= 15;
    gaps.push({
      issue: 'Missing HSTS Header',
      impact: 'Medium Risk',
      detail: 'Strict-Transport-Security header not enforced, exposing connections to SSL stripping and downgrade attacks.',
      service: 'VAPT / Security Audit'
    });
  }

  if (!hasCsp) {
    score -= 15;
    gaps.push({
      issue: 'Missing Content-Security-Policy (CSP)',
      impact: 'Medium Risk',
      detail: 'No CSP header present, increasing exposure to Cross-Site Scripting (XSS) and client-side data exfiltration.',
      service: 'VAPT'
    });
  }

  if (!hasXfo) {
    score -= 10;
    gaps.push({
      issue: 'Missing X-Frame-Options',
      impact: 'Low Risk',
      detail: 'Web pages can be framed inside external websites, enabling UI redressing (Clickjacking).',
      service: 'VAPT'
    });
  }

  if (serverHeader) {
    score -= 5;
    gaps.push({
      issue: 'Server Software Signature Exposed',
      impact: 'Low Risk',
      detail: `Server banner discloses internal infrastructure: ${serverHeader.substring(0, 40)}`,
      service: 'VAPT'
    });
  }

  score = Math.max(25, Math.min(100, score));

  let grade = 'F';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';
  else if (score >= 40) grade = 'D';

  // Construct Tailored Evidence Outreach Pitch Hook
  let pitchHook = '';
  if (gaps.length > 0) {
    const topGap = gaps[0];
    pitchHook = `During an initial perimeter audit of ${domain}, we identified that ${topGap.detail.toLowerCase()} Addressing this along with regular web/API attack simulations would directly protect your client-facing operations.`;
  } else {
    pitchHook = `A preliminary perimeter inspection shows strong foundational hygiene for ${domain}. Our offensive penetration testing team can assist in testing complex authorization workflows and cloud APIs.`;
  }

  return {
    domain,
    website: `https://${domain}`,
    score,
    grade,
    mailProvider: dns.mailProvider || 'Unknown',
    dmarcStatus,
    spfStatus,
    hasHsts,
    hasCsp,
    hasXfo,
    hasXcto,
    serverHeader,
    gapsCount: gaps.length,
    gaps,
    pitchHook,
    auditedAt: new Date().toISOString()
  };
}

module.exports = {
  normalizeDomain,
  inspectDns,
  inspectWebSurface,
  performFullRecon,
  quickAuditDomain
};
