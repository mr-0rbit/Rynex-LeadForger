/**
 * Modular data-provider abstraction (spec §48).
 *
 * Interfaces: LeadSourceProvider, SearchProvider, CompanyEnrichmentProvider,
 *             TechnologyProvider, ContactProvider, EmailProvider
 *
 * Demo providers generate clearly-marked SYNTHETIC data so the platform is fully
 * usable without external API keys. Real integrations plug in by registering a
 * provider with the same interface and enabling it in Settings > Integrations.
 * No provider here performs intrusive scanning — passive/public data only.
 */
const intel = require('./engines/intel');
const { db } = require('./db');

// ---------- deterministic-ish synthetic name generation ----------
const NAME_A = ['Northstar', 'Vertex', 'BluePeak', 'Nova', 'Atlas', 'Quantum', 'Silverline', 'Bright', 'Cobalt', 'Meridian', 'Halcyon', 'Ironvale', 'Lumen', 'Orbit', 'Pinnacle', 'Redwood', 'Summit', 'Trailblaze', 'Umbra', 'Vantage', 'Westgate', 'Zenith', 'Aurora', 'Beacon', 'Crestline', 'Delta', 'Everline', 'Foxglove', 'Granite', 'Horizon'];
const NAME_B = ['Cloud', 'Pay', 'Health', 'Commerce', 'Software', 'Data', 'Systems', 'Digital', 'Analytics', 'Logistics', 'Legal', 'Capital', 'Labs', 'Works', 'Group', 'Networks', 'Solutions', 'Robotics', 'Media', 'Store', 'Learning', 'Insure', 'Freight', 'Consulting'];
const NAME_C = ['Inc', 'Ltd', 'Group', 'GmbH', 'LLC', 'Pty', 'SAS', 'BV'];
const TLD = { 'United Kingdom': 'co.uk', 'United States': 'com', 'Germany': 'de', 'Canada': 'ca', 'Australia': 'com.au', 'UAE': 'ae', 'Saudi Arabia': 'sa', 'Singapore': 'sg', 'Netherlands': 'nl', 'France': 'fr', 'Pakistan': 'pk' };

const FIRST = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Priya', 'Ahmed', 'Lena', 'Tom', 'Aisha', 'Carlos', 'Nina', 'Ryan', 'Fatima', 'Lucas', 'Olivia', 'Daniel', 'Mei', 'Omar', 'Sophie'];
const LAST = ['Walker', 'Chen', 'Khan', 'Meyer', 'Osei', 'Silva', 'Novak', 'Haddad', 'Fischer', 'Okafor', 'Rossi', 'Andersen', 'Murphy', 'Aziz', 'Dubois', 'Tanaka', 'Costa', 'Novak', 'Ivanov', 'Bennett'];
const ROLES = ['CTO', 'CEO', 'Head of IT', 'IT Manager', 'Head of Engineering', 'CISO', 'Operations Director', 'Founder', 'Head of Product', 'Technical Director', 'Compliance Manager', 'Information Security Manager'];

let rngState = 987654321;
function rnd() { rngState = (rngState * 1103515245 + 12345) % 2147483648; return rngState / 2147483648; }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
function int(min, max) { return Math.floor(min + rnd() * (max - min + 1)); }
function seedRng(seed) { rngState = seed || 987654321; }
function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20); }

function synthCompany(country, industry) {
  const countryKey = country && intel.COUNTRIES[country] ? country : pick(Object.keys(intel.COUNTRIES));
  const city = pick(intel.COUNTRIES[countryKey]);
  const name = `${pick(NAME_A)} ${pick(NAME_B)}${rnd() < 0.35 ? ' ' + pick(NAME_C) : ''}`;
  const domain = `${slug(name)}.${TLD[countryKey] || 'com'}`;
  const emp = pick([int(1, 10), int(11, 50), int(11, 50), int(51, 200), int(51, 200), int(201, 500), int(501, 1000)]);
  const revenue = emp <= 10 ? '<$100K' : emp <= 50 ? pick(['$100K-$500K', '$500K-$1M']) : emp <= 200 ? pick(['$1M-$5M', '$5M-$10M']) : '$10M+';
  return {
    name, domain, website: `https://www.${domain}`, industry: industry || pick(intel.INDUSTRIES),
    business_model: pick(['SaaS', 'Online platform', 'Services', 'Product', 'Marketplace', 'B2B Services']),
    country: countryKey, city, employee_count: emp, revenue_band: revenue,
    founded_year: int(2005, 2024),
    data_confidence: pick(['High', 'Medium', 'High']),
    description: `${name} is a ${industry || 'technology'} business based in ${city}, ${countryKey}, serving business customers with digital products and services.`
  };
}

function synthContacts(company) {
  const n = company.employee_count > 100 ? int(1, 3) : rnd() < 0.75 ? int(1, 2) : 0;
  const out = [];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    while (seen.has(name)) name = `${pick(FIRST)} ${pick(LAST)}`;
    seen.add(name);
    const role = i === 0 ? pick(['CTO', 'CEO', 'Head of IT', 'IT Manager', 'Technical Director']) : pick(ROLES);
    const email = `${name.toLowerCase().replace(' ', '.')}@${company.domain}`;
    out.push({
      name, role, email, phone: rnd() < 0.5 ? `+${int(1, 99)} ${int(20, 79)} ${int(1000000, 9999999)}` : null,
      linkedin_url: rnd() < 0.6 ? `https://www.linkedin.com/in/${slug(name)}-${int(100, 999)}` : null,
      email_status: rnd() < 0.8 ? 'valid' : 'unverified', is_primary: i === 0 ? 1 : 0,
      confidence: pick(['High', 'Medium', 'High', 'Medium', 'Low']), source: 'Public business listing'
    });
  }
  return out;
}

function synthEvidence(company) {
  const items = [];
  const daysAgo = () => new Date(Date.now() - int(1, 120) * 86400000).toISOString().slice(0, 10);
  if (rnd() < 0.45) {
    const role = pick(intel.SECURITY_ROLES);
    items.push({
      evidence_type: 'job_posting', title: `Company is hiring a ${role}`,
      description: `is currently hiring a ${role}`,
      source_name: 'Public job board', source_url: `https://jobs.example.com/${company.domain}/${role.toLowerCase().replace(/ /g, '-')}`,
      observed_at: daysAgo(), confidence: pick(['High', 'High', 'Medium']), related_service: 'SOC, VAPT, Security Audit'
    });
  }
  if (rnd() < 0.35) {
    const fw = pick(intel.COMPLIANCE_FRAMEWORKS).fw;
    items.push({
      evidence_type: 'compliance', title: `${fw} requirement referenced publicly`,
      description: `publicly references ${fw} compliance requirements`,
      source_name: 'Company website', source_url: `https://www.${company.domain}/compliance`,
      observed_at: daysAgo(), confidence: pick(['High', 'Medium']), related_service: 'GRC, Security Audit'
    });
  }
  if (rnd() < 0.3) {
    items.push({
      evidence_type: 'website', title: 'Operates a customer-facing web application',
      description: 'operates a customer-facing platform that handles account data',
      source_name: 'Company website', source_url: `https://www.${company.domain}`,
      observed_at: daysAgo(), confidence: 'High', related_service: 'VAPT'
    });
  }
  if (rnd() < 0.2) {
    items.push({
      evidence_type: 'expansion', title: 'Recent market or product expansion',
      description: 'recently announced an expansion into new markets',
      source_name: 'Press release', source_url: `https://www.${company.domain}/news`,
      observed_at: daysAgo(), confidence: 'Medium', related_service: 'GRC'
    });
  }
  if (rnd() < 0.12) {
    items.push({
      evidence_type: 'security_page', title: 'Public security/trust page published',
      description: 'publishes a dedicated trust and security page',
      source_name: 'Company website', source_url: `https://www.${company.domain}/security`,
      observed_at: daysAgo(), confidence: 'Medium', related_service: 'GRC, Security Audit'
    });
  }
  return items;
}

// ---------- provider interfaces ----------
class LeadSourceProvider {
  constructor(key, name, type) { this.key = key; this.name = name; this.type = type; }
  async discover(target, limit) { throw new Error('not implemented'); }
}

/** Generates synthetic, clearly-marked demo companies. */
class DemoDirectoryProvider extends LeadSourceProvider {
  constructor() { super('demo_directory', 'Demo Business Directory (Synthetic)', 'LeadSourceProvider'); }
  async discover(target, limit) {
    seedRng(Date.now() % 100000 + limit);
    const countries = (target.countries && target.countries.length) ? target.countries : Object.keys(intel.COUNTRIES);
    const industries = (target.industries && target.industries.length) ? target.industries : null;
    const out = [];
    for (let i = 0; i < limit; i++) {
      const c = synthCompany(pick(countries), industries ? pick(industries) : null);
      c.source = 'Demo Business Directory';
      c.source_url = `https://directory.example.com/listing/${c.domain}`;
      c.method = 'Business Directory Discovery';
      out.push(c);
    }
    return out;
  }
}

class DemoSearchProvider extends LeadSourceProvider {
  constructor() { super('demo_search', 'Demo Search Engine (Synthetic)', 'SearchProvider'); }
  buildQueries(target) {
    const inds = (target.industries && target.industries.length) ? target.industries : ['SaaS companies', 'software companies', 'ecommerce companies', 'healthcare companies'];
    const hooks = ['"SOC 2"', '"ISO 27001"', 'cybersecurity', '"security audit"', '"penetration testing"'];
    const countries = (target.countries && target.countries.length) ? target.countries : [''];
    const queries = [];
    for (const ind of inds) for (const h of hooks) for (const c of countries.slice(0, 3)) {
      queries.push(`"${ind.toLowerCase()}" ${h}${c ? ` ${c}` : ''}`.trim());
    }
    return queries;
  }
  async discover(target, limit) {
    seedRng(Date.now() % 100000 + limit * 7);
    const countries = (target.countries && target.countries.length) ? target.countries : Object.keys(intel.COUNTRIES);
    const out = [];
    for (let i = 0; i < limit; i++) {
      const c = synthCompany(pick(countries), target.industries && target.industries.length ? pick(target.industries) : null);
      c.source = 'Demo Search Engine';
      c.source_url = 'https://search.example.com/' + encodeURIComponent(this.buildQueries(target)[i % 5]);
      c.method = 'Search Engine Discovery';
      out.push(c);
    }
    return out;
  }
}

class DemoEnrichmentProvider {
  constructor() { this.key = 'demo_enrichment'; this.name = 'Demo Company Enrichment (Synthetic)'; this.type = 'CompanyEnrichmentProvider'; }
  async enrich(company) {
    company.enriched = 1;
    company.data_confidence = pick(['High', 'Medium', 'High']);
    return company;
  }
}

class DemoTechnologyProvider {
  constructor() { this.key = 'demo_tech'; this.name = 'Demo Technology Detection (Synthetic)'; this.type = 'TechnologyProvider'; }
  async detect(company) {
    seedRng(company.domain.length * 7919 + company.name.length);
    const n = int(2, 6);
    const picked = new Set();
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = pick(intel.TECHNOLOGIES);
      if (picked.has(t.name)) continue;
      picked.add(t.name);
      out.push({ technology: t.name, category: t.category, confidence: pick(['High', 'Medium']), source: 'Public website headers (passive)' });
    }
    return out;
  }
}

class DemoContactProvider {
  constructor() { this.key = 'demo_contacts'; this.name = 'Demo Contact Discovery (Synthetic)'; this.type = 'ContactProvider'; }
  async find(company) { return synthContacts(company); }
}

module.exports = {
  LeadSourceProvider, DemoDirectoryProvider, DemoSearchProvider,
  DemoEnrichmentProvider, DemoTechnologyProvider, DemoContactProvider,
  synthCompany, synthContacts, synthEvidence, pick, int, seedRng, slug
};
