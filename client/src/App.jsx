import React, { useState, useEffect } from 'react';
import { api, setSession, clearSession, getCachedUser } from './api';
import {
  IconDashboard, IconTarget, IconLightning, IconMail, IconAnalytics,
  IconDatabase, IconSettings, IconSearch, IconShield, IconCheck,
  IconAlert, IconLogout, IconClose, IconDownload, IconPlus,
  IconFilter, IconRefresh, IconGlobe, IconExternalLink, IconFileText,
  IconCopy, IconTrash, IconSparkles, IconKey, IconBookmark,
  IconPhone, IconBuilding, IconUser
} from './icons.jsx';

export default function App() {
  const [user, setUser] = useState(getCachedUser());
  const [activeTab, setActiveTab] = useState('niche');
  const [notification, setNotification] = useState(null);

  // Selected lead passed to Email Studio
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState(null);

  // Global settings state
  const [appSettings, setAppSettings] = useState({
    openai_configured: false,
    gemini_configured: false,
    groq_configured: false,
    search_configured: false,
    search_provider: 'builtin',
    default_offer: 'Cybersecurity Vulnerability Assessment & Compliance Advisory',
    sender_name: '',
    sender_company: 'Rynex Technologies'
  });

  // Global unauthorized listener
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      notify('Session expired. Please sign in.', 'warning');
    };
    window.addEventListener('rynex:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rynex:unauthorized', onUnauthorized);
  }, []);

  // Fetch settings on load
  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const data = await api.getNicheSettings();
      setAppSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    notify(`Authenticated as ${userData.role.toUpperCase()}: ${userData.name}`, 'success');
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    notify('Signed out successfully.', 'info');
  };

  const handleOpenEmailStudio = (lead) => {
    setSelectedLeadForEmail(lead);
    setActiveTab('email');
  };

  if (!user) {
    return <LoginView onLogin={handleLoginSuccess} notify={notify} />;
  }

  return (
    <div className="flex h-screen bg-[#000000] text-white overflow-hidden font-sans selection:bg-[#00D4FF]/30 selection:text-[#00D4FF]">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded text-xs font-mono flex items-center gap-2 border shadow-2xl transition-all ${
          notification.type === 'error' ? 'bg-[#150000] border-rose-800 text-rose-300' :
          notification.type === 'success' ? 'bg-[#00150d] border-emerald-800 text-emerald-300' :
          notification.type === 'warning' ? 'bg-[#151000] border-amber-800 text-amber-300' :
          'bg-[#00111a] border-[#00D4FF]/60 text-[#00D4FF]'
        }`}>
          <span>[{notification.type.toUpperCase()}]</span>
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[#080808] border-r border-[#1a1a1a] flex flex-col flex-shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#0a0a0a] border border-[#00D4FF] flex items-center justify-center font-mono font-black text-[#00D4FF] text-sm tracking-tighter">
              RX
            </div>
            <div>
              <div className="font-bold text-xs tracking-wider text-white uppercase font-mono">RYNEX TECHNOLOGIES</div>
              <div className="text-[10px] text-[#00D4FF] font-mono tracking-widest">LEAD INTELLIGENCE</div>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#141414] text-[9px] text-[#777777] font-mono uppercase tracking-wider flex justify-between">
            <span>NICHE GEN</span><span>SAVE LEADS</span><span>AI OUTREACH</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2.5 space-y-1 flex-1 overflow-y-auto">
          {[
            { id: 'niche', label: 'Find Leads (Niche)', icon: <IconSearch /> },
            { id: 'saved', label: 'Saved Leads Pipeline', icon: <IconBookmark /> },
            { id: 'email', label: 'AI Email Studio', icon: <IconSparkles /> },
            { id: 'settings', label: 'API Keys & Settings', icon: <IconKey /> },
          ].map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded text-xs font-medium flex items-center gap-2.5 transition-all font-mono ${
                  active
                    ? 'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/40 shadow-sm'
                    : 'text-[#888888] hover:text-white hover:bg-[#121212]'
                }`}
              >
                <span className={active ? 'text-[#00D4FF]' : 'text-[#666666]'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#141414]">
            <div className="px-3 text-[10px] font-mono uppercase text-[#555555] tracking-wider mb-2">Engine Status</div>
            <div className="px-3 space-y-1.5 text-[11px] font-mono text-[#777777]">
              <div className="flex items-center justify-between">
                <span>OpenAI:</span>
                <span className={appSettings.openai_configured ? 'text-emerald-400' : 'text-zinc-500'}>
                  {appSettings.openai_configured ? 'Active' : 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Gemini:</span>
                <span className={appSettings.gemini_configured ? 'text-emerald-400' : 'text-zinc-500'}>
                  {appSettings.gemini_configured ? 'Active' : 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discovery:</span>
                <span className="text-[#00D4FF]">
                  {appSettings.search_provider === 'serpapi' ? 'SerpAPI' : appSettings.search_provider === 'tavily' ? 'Tavily' : 'Live Web'}
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* User profile footer */}
        <div className="p-3.5 border-t border-[#1a1a1a] bg-[#050505]">
          <div className="flex items-center justify-between">
            <div className="overflow-hidden pr-2">
              <p className="text-xs font-semibold truncate text-white">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]"></span>
                <span className="text-[10px] uppercase tracking-wider text-[#888888]">{user.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-[#666666] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors"
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
        {activeTab === 'niche' && (
          <NicheFinderView
            notify={notify}
            appSettings={appSettings}
            onOpenEmailStudio={handleOpenEmailStudio}
          />
        )}
        {activeTab === 'saved' && (
          <SavedLeadsView
            notify={notify}
            onOpenEmailStudio={handleOpenEmailStudio}
          />
        )}
        {activeTab === 'email' && (
          <AiEmailStudioView
            notify={notify}
            lead={selectedLeadForEmail}
            appSettings={appSettings}
            onLeadUpdated={() => {}}
          />
        )}
        {activeTab === 'settings' && (
          <ApiSettingsView
            notify={notify}
            appSettings={appSettings}
            onSettingsSaved={loadSettings}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// 1. NICHE FINDER VIEW (DISCOVER & SAVE LEADS)
// ============================================================================
function NicheFinderView({ notify, appSettings, onOpenEmailStudio }) {
  const [strategyTab, setStrategyTab] = useState('sector'); // 'sector' | 'diagnostic' | 'intent'
  const [serviceKey, setServiceKey] = useState('vapt');
  const [niche, setNiche] = useState('Cyber Security');
  const [location, setLocation] = useState('Karachi');
  const [yourOffer, setYourOffer] = useState('Penetration testing (VAPT) and attack simulations for web apps, APIs, networks, and cloud');
  const [limit, setLimit] = useState(10);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStep, setSearchStep] = useState('');
  const [results, setResults] = useState(null);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [savingIndices, setSavingIndices] = useState(new Set());
  const [savedIndices, setSavedIndices] = useState(new Set());

  // Engineering as Marketing: Instant Domain Diagnostic Scanner (#15)
  const [diagnosticDomain, setDiagnosticDomain] = useState('');
  const [isAuditingDomain, setIsAuditingDomain] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);

  // Inline diagnostic audit cache for results cards
  const [inlineAudits, setInlineAudits] = useState({});
  const [inlineAuditing, setInlineAuditing] = useState(new Set());

  // 5 Specialized Cybersecurity Services offered by Rynex Security
  const rynexCyberServices = [
    {
      key: 'vapt',
      label: 'VAPT',
      fullName: 'Penetration Testing',
      badge: 'Web Apps & APIs',
      offer: 'Penetration testing (VAPT) and real-world attack simulations for web apps, APIs, networks, and cloud environments'
    },
    {
      key: 'soc',
      label: 'SOC',
      fullName: '24/7 Security Monitoring',
      badge: 'Threat Hunting',
      offer: '24/7 SOC continuous security monitoring, threat detection, and rapid incident response'
    },
    {
      key: 'grc',
      label: 'GRC',
      fullName: 'Compliance Readiness',
      badge: 'ISO 27001 / SOC 2 / PCI DSS',
      offer: 'GRC compliance readiness and gap assessments for ISO 27001, SOC 2, and PCI DSS'
    },
    {
      key: 'audits',
      label: 'Security Audits',
      fullName: 'Independent Architecture Audits',
      badge: 'Cloud & Infrastructure',
      offer: 'Independent architecture, cloud infrastructure, and configuration security audits'
    },
    {
      key: 'trainings',
      label: 'Trainings',
      fullName: 'Cyber Security Trainings',
      badge: 'Staff Awareness & Phishing',
      offer: 'Hands-on employee cyber awareness training and realistic simulated phishing exercises'
    }
  ];

  // User configuration industries & expanded global/regional locations
  const configIndustries = [
    { label: 'Fintech', niche: 'Fintech and payment technology companies', offer: 'SOC 2 & PCI DSS Penetration Testing, Attack Simulations, and API Security' },
    { label: 'Software House', niche: 'Software house and custom development agencies', offer: 'Web Application VAPT, Code Security Review, and Cloud Hardening' },
    { label: 'E-Commerce', niche: 'Direct to consumer e-commerce retail stores', offer: 'Checkout Security, Payment Integration Hardening, and Mobile UX' },
    { label: 'Healthcare', niche: 'Healthcare clinics, hospitals, and medical providers', offer: 'HIPAA Compliance Security Audit and Patient Data Protection' },
    { label: 'Bank', niche: 'Commercial banks and financial institutions', offer: 'Comprehensive VAPT, 24/7 SOC Monitoring, and Regulatory GRC Support' },
    { label: 'Telecom', niche: 'Telecommunications and network providers', offer: 'Large Attack Surface Penetration Testing and Continuous Monitoring' },
    { label: 'Logistics', niche: 'Supply chain and logistics technology companies', offer: 'Infrastructure Security Assessment and Ransomware Defense' },
    { label: 'Managed IT', niche: 'Managed IT service providers and MSPs', offer: 'Offensive Security VAPT Partnerships and White-label Audits' }
  ];

  // High-Intent Presets for Intent Strategy Tab
  const configIntentPresets = [
    { label: 'Fintechs Scaling APIs', niche: 'Fintech companies with high-volume APIs', service: 'vapt', offer: 'Offensive API and Web Penetration Testing (VAPT)' },
    { label: 'E-Commerce & Retail Stores', niche: 'E-commerce and online retail stores', service: 'vapt', offer: 'Payment Gateway Security and Checkout VAPT' },
    { label: 'Banks & Financial Networks', niche: 'Commercial banks and financial institutions', service: 'soc', offer: '24/7 Security Operations Center Monitoring & Threat Detection' },
    { label: 'Digital Health & Telemedicine', niche: 'Healthcare clinics and telemedicine platforms', service: 'grc', offer: 'HIPAA & ISO 27001 Compliance Readiness and Patient Record Protection' },
    { label: 'Cloud SaaS Microservices', niche: 'Cloud software and SaaS platforms', service: 'audits', offer: 'Independent AWS/Azure Cloud Infrastructure & IAM Security Audits' },
    { label: 'Enterprise Logistics & Supply Chain', niche: 'Corporate logistics and supply chain enterprises', service: 'trainings', offer: 'Employee Phishing Simulations and Cyber Awareness Training' }
  ];

  const configLocations = ['Karachi', 'Lahore', 'Islamabad', 'Dubai', 'Riyadh', 'London', 'Global'];

  const handleSelectService = (srv) => {
    setServiceKey(srv.key);
    setYourOffer(srv.offer);
  };

  const handleSelectIndustry = (s) => {
    setNiche(s.niche);
    setYourOffer(s.offer);
  };

  const handleSelectLocation = (loc) => {
    setLocation(loc);
  };

  const handleSelectIntentPreset = (p) => {
    setNiche(p.niche);
    setServiceKey(p.service);
    setYourOffer(p.offer);
    notify(`Applied intent trigger: ${p.label}`, 'info');
  };

  // Run Instant Diagnostic on any domain (Engineering as Marketing)
  const handleRunDiagnostic = async (domainToAudit) => {
    const raw = domainToAudit || diagnosticDomain;
    const target = (raw || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!target) {
      notify('Please enter a target domain or website to audit', 'warning');
      return;
    }
    setIsAuditingDomain(true);
    setDiagnosticResult(null);
    try {
      const res = await api.quickAuditDomain(target);
      setDiagnosticResult(res);
      notify(`Completed diagnostic audit for ${res.domain} (Grade: ${res.grade})`, 'success');
    } catch (err) {
      notify(err.message || 'Diagnostic audit failed', 'error');
    } finally {
      setIsAuditingDomain(false);
    }
  };

  // Inline audit for any lead card in results
  const handleRunInlineAudit = async (lead) => {
    if (!lead.domain) return;
    const nextAuditing = new Set(inlineAuditing);
    nextAuditing.add(lead.domain);
    setInlineAuditing(nextAuditing);
    try {
      const res = await api.quickAuditDomain(lead.domain);
      setInlineAudits((prev) => ({ ...prev, [lead.domain]: res }));
      notify(`Audited ${lead.domain}: Grade ${res.grade} (${res.score}/100)`, 'success');
    } catch (err) {
      notify(`Audit failed for ${lead.domain}: ${err.message}`, 'error');
    } finally {
      const finishAuditing = new Set(inlineAuditing);
      finishAuditing.delete(lead.domain);
      setInlineAuditing(finishAuditing);
    }
  };

  const handleOpenStudioWithAudit = (lead, audit) => {
    const leadWithAudit = {
      ...lead,
      diagnostic: audit || inlineAudits[lead.domain] || null
    };
    onOpenEmailStudio(leadWithAudit);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!niche.trim()) {
      notify('Please enter a target niche or industry query', 'warning');
      return;
    }

    setIsSearching(true);
    setSearchStep(`Finding client companies needing ${serviceKey.toUpperCase()}...`);
    setSelectedIndices(new Set());
    setSavedIndices(new Set());

    try {
      setTimeout(() => setSearchStep('Filtering directories and excluding cybersecurity vendors...'), 1200);
      setTimeout(() => setSearchStep('Inspecting business context and resolving decision-makers...'), 2400);

      const res = await api.findNicheLeads({
        niche: niche.trim(),
        location: location.trim(),
        serviceKey: serviceKey,
        limit: parseInt(limit),
        yourOffer: yourOffer.trim()
      });

      setResults(res);
      notify(`Discovered ${res.total} prospective clients for ${res.targetService}`, 'success');
    } catch (err) {
      console.error(err);
      notify(err.message || 'Error finding leads for this niche', 'error');
    } finally {
      setIsSearching(false);
      setSearchStep('');
    }
  };

  const toggleSelectAll = () => {
    if (!results || !results.leads) return;
    if (selectedIndices.size === results.leads.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(results.leads.map((_, i) => i)));
    }
  };

  const toggleSelectOne = (idx) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleSaveSingle = async (idx, lead) => {
    const nextSaving = new Set(savingIndices);
    nextSaving.add(idx);
    setSavingIndices(nextSaving);

    try {
      await api.saveNicheLeads({ lead });
      const nextSaved = new Set(savedIndices);
      nextSaved.add(idx);
      setSavedIndices(nextSaved);
      notify(`Saved ${lead.company_name} to database`, 'success');
    } catch (err) {
      notify(err.message || 'Failed to save lead', 'error');
    } finally {
      const finishSaving = new Set(savingIndices);
      finishSaving.delete(idx);
      setSavingIndices(finishSaving);
    }
  };

  const handleSaveSelected = async () => {
    if (selectedIndices.size === 0) {
      notify('No leads selected', 'warning');
      return;
    }
    const leadsToSave = Array.from(selectedIndices).map((i) => results.leads[i]);
    try {
      const res = await api.saveNicheLeads({ leads: leadsToSave });
      const nextSaved = new Set(savedIndices);
      selectedIndices.forEach((i) => nextSaved.add(i));
      setSavedIndices(nextSaved);
      notify(`Saved ${res.savedCount} leads to your pipeline`, 'success');
    } catch (err) {
      notify(err.message || 'Failed to bulk save leads', 'error');
    }
  };

  const isCyberNiche = !niche || niche.toLowerCase().includes('cyber') || niche.toLowerCase().includes('security');

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider mb-1">
          <IconSearch />
          <span>Client Lead Discovery Engine</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Find Leads Needing Cybersecurity Services</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Select your outreach strategy below: discover high-need prospective clients across target sectors, run live diagnostic audits on any company domain for cold email evidence, or target accounts with immediate hiring and infrastructure triggers.
        </p>
      </div>

      {/* Strategy Selection Tabs (Multi-Strategy Engine) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#222222] pb-3">
        <button
          type="button"
          onClick={() => setStrategyTab('sector')}
          className={`px-3.5 py-2 rounded text-xs font-mono flex items-center gap-2 border transition-all cursor-pointer ${
            strategyTab === 'sector'
              ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF] shadow-sm shadow-[#00D4FF]/20 font-semibold'
              : 'bg-[#111111] text-zinc-400 border-[#262626] hover:text-white hover:border-[#3a3a3a]'
          }`}
        >
          <IconTarget className="w-3.5 h-3.5" />
          <span>Sector & Regional Discovery</span>
        </button>

        <button
          type="button"
          onClick={() => setStrategyTab('diagnostic')}
          className={`px-3.5 py-2 rounded text-xs font-mono flex items-center gap-2 border transition-all cursor-pointer ${
            strategyTab === 'diagnostic'
              ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF] shadow-sm shadow-[#00D4FF]/20 font-semibold'
              : 'bg-[#111111] text-zinc-400 border-[#262626] hover:text-white hover:border-[#3a3a3a]'
          }`}
        >
          <IconShield className="w-3.5 h-3.5" />
          <span>Instant Diagnostic Scanner</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00D4FF]/20 text-[#00D4FF] uppercase tracking-wider font-semibold">Live Audit</span>
        </button>

        <button
          type="button"
          onClick={() => setStrategyTab('intent')}
          className={`px-3.5 py-2 rounded text-xs font-mono flex items-center gap-2 border transition-all cursor-pointer ${
            strategyTab === 'intent'
              ? 'bg-[#00D4FF]/15 text-[#00D4FF] border-[#00D4FF] shadow-sm shadow-[#00D4FF]/20 font-semibold'
              : 'bg-[#111111] text-zinc-400 border-[#262626] hover:text-white hover:border-[#3a3a3a]'
          }`}
        >
          <IconLightning className="w-3.5 h-3.5" />
          <span>Hiring & Trigger Signals</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase tracking-wider font-semibold">High Intent</span>
        </button>
      </div>

      {/* STRATEGY 2: INSTANT DIAGNOSTIC SCANNER (ENGINEERING AS MARKETING) */}
      {strategyTab === 'diagnostic' && (
        <div className="space-y-5">
          <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider">
                  <IconShield className="w-4 h-4 text-[#00D4FF]" />
                  <span>Engineering-as-Marketing Diagnostic</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">Audit Any Prospect Domain Live</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Performs non-intrusive DNS-over-HTTPS & HTTP security header analysis. Identifies missing DMARC (email spoofing), open SPF, missing HSTS, or exposed server headers to use as undeniable proof in cold outreach.
                </p>
              </div>
            </div>

            {/* Input Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={diagnosticDomain}
                  onChange={(e) => setDiagnosticDomain(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRunDiagnostic();
                    }
                  }}
                  placeholder="Enter domain (e.g. systemsltd.com, finja.pk, careem.com, aramco.com)"
                  className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-4 py-2.5 rounded text-sm text-white placeholder-zinc-600 font-mono"
                />
              </div>

              <button
                type="button"
                disabled={isAuditingDomain || !diagnosticDomain.trim()}
                onClick={() => handleRunDiagnostic()}
                className="px-5 py-2.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#00D4FF]/20 cursor-pointer"
              >
                {isAuditingDomain ? (
                  <>
                    <IconRefresh className="w-4 h-4 animate-spin" />
                    <span>Auditing Security Surface...</span>
                  </>
                ) : (
                  <>
                    <IconShield className="w-4 h-4" />
                    <span>Run Diagnostic Audit</span>
                  </>
                )}
              </button>
            </div>

            {/* Sample Domain Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-mono text-zinc-500 mr-1">Quick Sample Domains:</span>
              {['systemsltd.com', 'finja.pk', 'careem.com', 'telenor.com.pk'].map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => {
                    setDiagnosticDomain(d);
                    handleRunDiagnostic(d);
                  }}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#151515] hover:bg-[#202020] text-zinc-300 hover:text-[#00D4FF] border border-[#262626] transition-colors cursor-pointer"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Diagnostic Result Card */}
          {diagnosticResult && (
            <div className="bg-[#090909] border border-[#222222] rounded-lg p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a1a1a] pb-4">
                <div>
                  <div className="text-[11px] font-mono text-zinc-400">Diagnostic Surface Report</div>
                  <h3 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mt-0.5">
                    <span>{diagnosticResult.domain}</span>
                    <a
                      href={`https://${diagnosticResult.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-500 hover:text-[#00D4FF]"
                    >
                      <IconExternalLink className="w-4 h-4" />
                    </a>
                  </h3>
                  <div className="text-[10px] font-mono text-zinc-500 mt-1">
                    Audited at {new Date(diagnosticResult.auditedAt).toLocaleTimeString()} | Non-Intrusive Passive Inspection
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right font-mono">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">Surface Health</div>
                    <div className="text-sm font-bold text-white">{diagnosticResult.score}/100</div>
                  </div>
                  <div
                    className={`w-14 h-14 rounded-lg flex items-center justify-center font-mono text-2xl font-black border ${
                      ['A+', 'A'].includes(diagnosticResult.grade)
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                        : diagnosticResult.grade === 'B'
                        ? 'bg-sky-950/40 text-sky-400 border-sky-500/60'
                        : diagnosticResult.grade === 'C'
                        ? 'bg-amber-950/40 text-amber-400 border-amber-500/60'
                        : 'bg-rose-950/40 text-rose-400 border-rose-500/60 shadow-lg shadow-rose-500/10'
                    }`}
                  >
                    {diagnosticResult.grade}
                  </div>
                </div>
              </div>

              {/* 4 Technical Indicators Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* DMARC */}
                <div className="bg-[#111111] border border-[#222222] rounded p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>DMARC Record</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        diagnosticResult.dmarcStatus === 'PASS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : diagnosticResult.dmarcStatus === 'MISSING'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {diagnosticResult.dmarcStatus}
                    </span>
                  </div>
                  <div className="text-xs text-white font-mono truncate">
                    {diagnosticResult.dmarcRecord ? diagnosticResult.dmarcRecord.slice(0, 32) + '...' : 'No DMARC found'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {diagnosticResult.dmarcStatus === 'MISSING'
                      ? 'Spoofable: Anyone can send fake emails from this domain'
                      : 'Email sender verification configured'}
                  </div>
                </div>

                {/* SPF */}
                <div className="bg-[#111111] border border-[#222222] rounded p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>SPF Record</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        diagnosticResult.spfStatus === 'PASS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {diagnosticResult.spfStatus}
                    </span>
                  </div>
                  <div className="text-xs text-white font-mono truncate">
                    {diagnosticResult.spfRecord ? diagnosticResult.spfRecord.slice(0, 32) + '...' : 'No SPF found'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {diagnosticResult.spfStatus === 'PASS'
                      ? 'Authorized outbound mail servers defined'
                      : 'Missing outbound mail server validation'}
                  </div>
                </div>

                {/* HSTS */}
                <div className="bg-[#111111] border border-[#222222] rounded p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>HSTS Header</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        diagnosticResult.hasHsts
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {diagnosticResult.hasHsts ? 'ENFORCED' : 'MISSING'}
                    </span>
                  </div>
                  <div className="text-xs text-white font-mono">
                    {diagnosticResult.hasHsts ? 'Strict-Transport-Security: Active' : 'HTTP Downgrade Risk'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {diagnosticResult.hasHsts ? 'SSL stripping attacks prevented' : 'Vulnerable to Man-in-the-Middle SSL stripping'}
                  </div>
                </div>

                {/* CSP / Security Headers */}
                <div className="bg-[#111111] border border-[#222222] rounded p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>CSP & Anti-Clickjack</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        diagnosticResult.hasCsp && diagnosticResult.hasXfo
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {diagnosticResult.hasCsp && diagnosticResult.hasXfo ? 'SECURED' : 'PARTIAL'}
                    </span>
                  </div>
                  <div className="text-xs text-white font-mono">
                    CSP: {diagnosticResult.hasCsp ? 'Active' : 'Missing'} | Frame: {diagnosticResult.hasXfo ? 'Protected' : 'Missing'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Server: {diagnosticResult.serverHeader || 'Protected/Hidden'}
                  </div>
                </div>
              </div>

              {/* Identified Gaps / Vulnerabilities */}
              {diagnosticResult.gaps && diagnosticResult.gaps.length > 0 && (
                <div className="bg-[#120a0a] border border-rose-950/60 rounded-lg p-3.5 space-y-2">
                  <div className="text-[11px] font-mono uppercase text-rose-400 font-semibold tracking-wider flex items-center gap-1.5">
                    <IconAlert className="w-3.5 h-3.5 text-rose-400" />
                    <span>Identified Attack Surface Gaps ({diagnosticResult.gaps.length}):</span>
                  </div>
                  <ul className="space-y-1 text-xs text-rose-200/90 font-mono">
                    {diagnosticResult.gaps.map((gap, i) => {
                      const issueText = typeof gap === 'string' ? gap : (gap.issue ? `${gap.issue}: ${gap.detail || gap.impact}` : JSON.stringify(gap));
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{issueText}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Cold Outreach Hook (Evidence Leverage) */}
              <div className="bg-[#001724] border border-[#00D4FF]/40 rounded-lg p-3.5 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-[#00D4FF] font-semibold tracking-wider flex items-center gap-1.5">
                  <IconLightning className="w-3.5 h-3.5 text-[#00D4FF]" />
                  <span>Evidence-Backed Cold Outreach Hook:</span>
                </div>
                <p className="text-xs text-zinc-200 font-mono leading-relaxed bg-[#00101a] p-2.5 rounded border border-[#003852]">
                  "{diagnosticResult.pitchHook}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-xs font-mono text-zinc-400">
                  Ready to contact this prospect with technical findings.
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const gapsSummary = (diagnosticResult.gaps || []).map((g) => (typeof g === 'string' ? g : g.issue)).join('; ');
                      const pseudoLead = {
                        company_name: diagnosticResult.domain,
                        domain: diagnosticResult.domain,
                        website: `https://${diagnosticResult.domain}`,
                        niche: 'Cybersecurity Client Prospect',
                        location: 'Global',
                        description: `Domain diagnostic audit performed on ${diagnosticResult.domain}. Letter grade: ${diagnosticResult.grade} (${diagnosticResult.score}/100). Identified gaps: ${gapsSummary}`,
                        lead_score: Math.max(70, 100 - diagnosticResult.score + 20),
                        detected_need: diagnosticResult.pitchHook,
                        diagnostic: diagnosticResult
                      };
                      api.saveNicheLeads({ lead: pseudoLead }).then(() => {
                        notify(`Saved ${diagnosticResult.domain} to pipeline`, 'success');
                      }).catch((err) => {
                        notify(err.message || 'Failed to save lead', 'error');
                      });
                    }}
                    className="px-4 py-2 rounded bg-[#141414] hover:bg-[#202020] text-zinc-200 border border-[#333333] text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <IconBookmark className="w-3.5 h-3.5" />
                    <span>Save to Pipeline</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const gapsSummary = (diagnosticResult.gaps || []).map((g) => (typeof g === 'string' ? g : g.issue)).join('; ');
                      const pseudoLead = {
                        company_name: diagnosticResult.domain,
                        domain: diagnosticResult.domain,
                        website: `https://${diagnosticResult.domain}`,
                        niche: 'Enterprise Client',
                        location: 'Global',
                        description: `Attack surface audit: Grade ${diagnosticResult.grade} (${diagnosticResult.score}/100). Gaps: ${gapsSummary}`,
                        lead_score: 95,
                        detected_need: diagnosticResult.pitchHook,
                        diagnostic: diagnosticResult,
                        primary_contact: {
                          title: 'Chief Technology Officer (CTO)',
                          department: 'Engineering & Information Security'
                        }
                      };
                      handleOpenStudioWithAudit(pseudoLead, diagnosticResult);
                    }}
                    className="px-4 py-2 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold text-xs font-mono flex items-center gap-1.5 transition-all shadow-md shadow-[#00D4FF]/20 cursor-pointer"
                  >
                    <IconMail className="w-3.5 h-3.5 text-black" />
                    <span>Draft Outreach Using Audit Evidence</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STRATEGY 3 INTENT PRESETS BANNER */}
      {strategyTab === 'intent' && (
        <div className="bg-[#0e0c05] border border-amber-900/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-wider">
            <IconLightning className="w-4 h-4 text-amber-400" />
            <span>High-Intent Trigger Presets</span>
          </div>
          <p className="text-xs text-zinc-300">
            Click any trigger below to immediately configure the lead finder for organizations actively experiencing risk shifts or compliance audit requirements:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {configIntentPresets.map((preset, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSelectIntentPreset(preset)}
                className="p-3 rounded text-left font-mono border border-amber-950/70 hover:border-amber-500/60 bg-[#161205] hover:bg-[#201a08] transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                  {preset.label}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  Service: <span className="text-[#00D4FF] font-semibold">{preset.service.toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                  Target: {preset.niche}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FORM: QUERY FORMULATION (For Sector & Intent Modes) */}
      {strategyTab !== 'diagnostic' && (
        <form onSubmit={handleSearch} className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-5 space-y-5">
          {/* 1. Cyber Security Service Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-200 uppercase tracking-wider font-semibold">
                Select Cybersecurity Service You Offer:
              </span>
              <span className="text-zinc-500 text-[11px]">
                Engine targets companies with high need for this service
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {rynexCyberServices.map((srv) => {
                const active = serviceKey === srv.key;
                return (
                  <button
                    type="button"
                    key={srv.key}
                    onClick={() => handleSelectService(srv)}
                    className={`p-3 rounded text-left font-mono border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF] shadow-md shadow-[#00D4FF]/10'
                        : 'bg-[#121212] hover:bg-[#181818] text-zinc-300 border-[#262626] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div className="text-xs font-bold truncate">{srv.label}</div>
                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">{srv.fullName}</div>
                    <div className={`text-[9px] mt-1.5 px-1.5 py-0.5 rounded inline-block ${active ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#080808] text-zinc-500'}`}>
                      {srv.badge}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Target Niche & Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#1a1a1a]">
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <label className="text-zinc-300 uppercase tracking-wider">
                  Target Industry / Niche *
                </label>
                {isCyberNiche && (
                  <span className="text-[10px] text-[#00D4FF] font-sans">
                    Auto-searching companies needing {serviceKey.toUpperCase()} (Excluding vendors)
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. Cyber Security (or enter Fintech, Software House, Healthcare, E-commerce...)"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3.5 py-2.5 rounded text-sm text-white placeholder-zinc-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Location / Regional Hub
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Karachi, Dubai, Riyadh, London, or Global"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3.5 py-2.5 rounded text-sm text-white placeholder-zinc-600 font-mono"
              />
            </div>
          </div>

          {/* 3. Quick Chips */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-zinc-500 mr-1">Target Client Industries:</span>
              {configIndustries.map((s, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectIndustry(s)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#151515] hover:bg-[#202020] text-zinc-300 hover:text-[#00D4FF] border border-[#262626] transition-colors cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-zinc-500 mr-1">Target Locations:</span>
              {configLocations.map((loc, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleSelectLocation(loc)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#151515] hover:bg-[#202020] text-[#00D4FF] border border-[#262626] transition-colors cursor-pointer"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Offer Pitch & Limit */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-[#1a1a1a]">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Specific Pitch Proposition
              </label>
              <input
                type="text"
                value={yourOffer}
                onChange={(e) => setYourOffer(e.target.value)}
                placeholder="What specific cybersecurity deliverable are you pitching?"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Leads Count
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono"
              >
                <option value="5">5 Leads</option>
                <option value="10">10 Leads</option>
                <option value="15">15 Leads</option>
                <option value="20">20 Leads</option>
              </select>
            </div>
          </div>

          {/* Submit & Progress */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
              {isSearching ? (
                <span className="text-[#00D4FF] flex items-center gap-2 animate-pulse">
                  <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                  <span>{searchStep || 'Searching for client leads...'}</span>
                </span>
              ) : results ? (
                <span>Target: <span className="text-[#00D4FF] font-semibold">{results.targetService}</span> | {results.total} client leads discovered</span>
              ) : (
                <span>Active Service: <span className="text-[#00D4FF] font-bold">{serviceKey.toUpperCase()}</span> (Competitor exclusion enabled)</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#00D4FF]/20 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <IconRefresh className="w-4 h-4 animate-spin" />
                  <span>Finding Clients...</span>
                </>
              ) : (
                <>
                  <IconTarget className="w-4 h-4" />
                  <span>Find Clients Needing {serviceKey.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Results Section */}
      {results && results.leads && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between bg-[#0e0e0e] border border-[#222222] p-3 rounded-lg">
            <div className="flex items-center gap-3 font-mono text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={selectedIndices.size > 0 && selectedIndices.size === results.leads.length}
                  onChange={toggleSelectAll}
                  className="rounded border-zinc-700 bg-zinc-900 text-[#00D4FF] focus:ring-[#00D4FF]"
                />
                <span>Select All ({results.leads.length})</span>
              </label>
              <span className="text-zinc-600">|</span>
              <span className="text-[#00D4FF]">{selectedIndices.size} selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveSelected}
                disabled={selectedIndices.size === 0}
                className="px-3.5 py-1.5 rounded bg-[#161616] hover:bg-[#222222] text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <IconBookmark className="w-3.5 h-3.5" />
                <span>Save Selected ({selectedIndices.size})</span>
              </button>
            </div>
          </div>

          {/* Leads Table / Cards */}
          <div className="space-y-3">
            {results.leads.map((lead, idx) => {
              const isSelected = selectedIndices.has(idx);
              const isSaving = savingIndices.has(idx);
              const isSaved = savedIndices.has(idx);
              const inlineAudit = inlineAudits[lead.domain];
              const isAuditingInline = inlineAuditing.has(lead.domain);

              return (
                <div
                  key={idx}
                  className={`bg-[#0a0a0a] border rounded-lg p-4 transition-all space-y-3 ${
                    isSelected ? 'border-[#00D4FF]/60 bg-[#00111a]/20' : 'border-[#222222] hover:border-[#333333]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Checkbox and Info */}
                    <div className="flex items-start gap-3.5 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(idx)}
                        className="mt-1 rounded border-zinc-700 bg-zinc-900 text-[#00D4FF] focus:ring-[#00D4FF]"
                      />

                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="font-bold text-base text-white tracking-wide">{lead.company_name}</h3>
                          {lead.domain && (
                            <a
                              href={lead.website || `https://${lead.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-mono text-[#00D4FF] hover:underline flex items-center gap-1"
                            >
                              <span>{lead.domain}</span>
                              <IconExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161616] text-zinc-400 border border-[#2a2a2a]">
                            Fit: {lead.lead_score}/100
                          </span>
                          {inlineAudit && (
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                ['A+', 'A'].includes(inlineAudit.grade)
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700'
                                  : inlineAudit.grade === 'B'
                                  ? 'bg-sky-950/60 text-sky-400 border-sky-700'
                                  : inlineAudit.grade === 'C'
                                  ? 'bg-amber-950/60 text-amber-400 border-amber-700'
                                  : 'bg-rose-950/60 text-rose-400 border-rose-700'
                              }`}
                            >
                              Audit Grade: {inlineAudit.grade} ({inlineAudit.score}/100)
                            </span>
                          )}
                        </div>

                        {/* Intent Signals */}
                        {lead.intent_signals && lead.intent_signals.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {lead.intent_signals.map((sig, sIdx) => {
                              const label = typeof sig === 'string' ? sig : (sig.label || sig.type);
                              return (
                                <span
                                  key={sIdx}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/30 text-amber-300 border border-amber-800/50 flex items-center gap-1"
                                >
                                  <IconLightning className="w-2.5 h-2.5 text-amber-400" />
                                  <span>{label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Description */}
                        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                          {lead.description}
                        </p>

                        {/* Contact Details & Corporate Outreach Intelligence */}
                        <div className="bg-[#0c1017] border border-[#1e293b] rounded-lg p-3 space-y-2.5 text-xs font-mono">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#182335] pb-2">
                            <span className="text-[10px] uppercase font-bold text-[#00D4FF] tracking-wider flex items-center gap-1.5">
                              <IconBuilding className="w-3.5 h-3.5 text-[#00D4FF]" />
                              <span>Verified Corporate Contact Channels:</span>
                            </span>
                            {(lead.hq_address || lead.location) && (
                              <span className="text-[10px] text-zinc-400">
                                HQ: {lead.hq_address || lead.location}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                            {/* Phone */}
                            <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                              <IconPhone className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="text-zinc-500 text-[11px]">Phone:</span>
                              {lead.contact_phone ? (
                                <a
                                  href={`tel:${lead.contact_phone.replace(/[^\d+]/g, '')}`}
                                  className="text-emerald-300 hover:underline font-mono truncate"
                                  title="Call corporate contact line"
                                >
                                  {lead.contact_phone}
                                </a>
                              ) : (
                                <span className="text-zinc-500 text-[11px]">Available on site</span>
                              )}
                            </div>

                            {/* Corporate Email */}
                            <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                              <IconMail className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                              <span className="text-zinc-500 text-[11px]">Email:</span>
                              {lead.contact_email ? (
                                <a
                                  href={`mailto:${lead.contact_email}`}
                                  className="text-sky-300 hover:underline font-mono truncate"
                                  title="Direct outreach inbox"
                                >
                                  {lead.contact_email}
                                </a>
                              ) : (
                                <span className="text-zinc-500 text-[11px]">Inquire via site</span>
                              )}
                            </div>

                            {/* Contact Page */}
                            <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                              <IconExternalLink className="w-3.5 h-3.5 text-[#00D4FF] flex-shrink-0" />
                              <span className="text-zinc-500 text-[11px]">Office:</span>
                              {lead.contact_page_url ? (
                                <a
                                  href={lead.contact_page_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#00D4FF] hover:underline font-mono truncate inline-flex items-center gap-1"
                                >
                                  <span>Official Contact Page</span>
                                </a>
                              ) : (
                                <a
                                  href={lead.website || `https://${lead.domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#00D4FF] hover:underline font-mono truncate"
                                >
                                  <span>Visit Website</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Decision-Maker Persona & LinkedIn Search */}
                          {lead.decision_makers && lead.decision_makers.primaryPersona && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#182335]">
                              <div className="flex flex-wrap items-center gap-2">
                                <IconUser className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-zinc-400 text-[11px]">Key Persona:</span>
                                <span className="text-white font-semibold">{lead.decision_makers.primaryPersona.title}</span>
                                {lead.email_pattern && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#171717] text-zinc-400 border border-[#2d2d2d]">
                                    Format: {lead.email_pattern}
                                  </span>
                                )}
                              </div>

                              <a
                                href={lead.decision_makers.primaryPersona.linkedinSearchUrl || lead.decision_makers.primaryPersona.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0a66c2]/20 hover:bg-[#0a66c2]/35 text-[#58a6ff] border border-[#0a66c2]/40 text-[11px] font-mono transition-colors"
                              >
                                <span>Find on LinkedIn</span>
                                <IconExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Context of Need & Opportunity + Clickable Evidence Link */}
                        <div className="bg-[#05070a] border border-[#1e293b] p-3.5 rounded-lg text-xs space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#141d2b] pb-2">
                            <div className="text-[10px] font-mono uppercase text-[#00D4FF] tracking-wider flex items-center gap-1.5 font-bold">
                              <IconShield className="w-3.5 h-3.5 text-[#00D4FF]" />
                              <span>Context of Need & Opportunity:</span>
                            </div>

                            {lead.evidence_url && (
                              <a
                                href={lead.evidence_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] hover:text-white border border-[#00D4FF]/30 text-[11px] font-mono transition-colors group shadow-sm shadow-[#00D4FF]/10"
                                title="Click to view the public page or evidence triggering this service requirement"
                              >
                                <span>Need Identified From: {lead.evidence_label || 'Corporate Portal'}</span>
                                <IconExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </a>
                            )}
                          </div>

                          <div className="text-zinc-200 font-mono text-[11px] leading-relaxed whitespace-pre-line">
                            {lead.detected_need}
                          </div>
                        </div>

                        {/* Inline Diagnostic Result (if run) */}
                        {inlineAudit && (
                          <div className="bg-[#0c0d12] border border-[#00D4FF]/30 p-2.5 rounded text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-[#00D4FF] uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <IconShield className="w-3 h-3" />
                                <span>Domain Surface Findings ({inlineAudit.domain}):</span>
                              </span>
                              <span className="text-zinc-400 font-mono">
                                DMARC: {inlineAudit.dmarcStatus} | SPF: {inlineAudit.spfStatus} | HSTS: {inlineAudit.hasHsts ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                            {inlineAudit.gaps && inlineAudit.gaps.length > 0 && (
                              <div className="text-[11px] text-rose-300 font-mono">
                                Gaps: {inlineAudit.gaps.slice(0, 2).map((g) => (typeof g === 'string' ? g : (g.issue || g.detail))).join('; ')}
                              </div>
                            )}
                            <div className="text-[11px] text-zinc-300 font-mono italic">
                              Angle: "{inlineAudit.pitchHook}"
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex flex-row md:flex-col items-end justify-between gap-2 min-w-[140px] pt-1">
                      <button
                        onClick={() => handleSaveSingle(idx, lead)}
                        disabled={isSaving || isSaved}
                        className={`w-full px-3 py-1.5 rounded text-xs font-mono flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                            : 'bg-[#141414] hover:bg-[#202020] text-zinc-200 border-[#333333]'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Saved</span>
                          </>
                        ) : isSaving ? (
                          <>
                            <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <IconBookmark className="w-3.5 h-3.5" />
                            <span>Save Lead</span>
                          </>
                        )}
                      </button>

                      {/* Inline Audit Trigger Button */}
                      {lead.domain && !inlineAudit && (
                        <button
                          onClick={() => handleRunInlineAudit(lead)}
                          disabled={isAuditingInline}
                          className="w-full px-3 py-1.5 rounded bg-[#111111] hover:bg-[#1a1a1a] text-zinc-300 hover:text-[#00D4FF] border border-[#2b2b2b] hover:border-[#00D4FF]/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isAuditingInline ? (
                            <>
                              <IconRefresh className="w-3.5 h-3.5 animate-spin text-[#00D4FF]" />
                              <span>Auditing...</span>
                            </>
                          ) : (
                            <>
                              <IconShield className="w-3.5 h-3.5 text-[#00D4FF]" />
                              <span>Audit Domain</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenStudioWithAudit(lead)}
                        className="w-full px-3 py-1.5 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <IconMail className="w-3.5 h-3.5" />
                        <span>Write Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. SAVED LEADS VIEW (PIPELINE & STATUS TRACKING)
// ============================================================================
function SavedLeadsView({ notify, onOpenEmailStudio }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState([]);
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Active modal note state
  const [editingNoteLead, setEditingNoteLead] = useState(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadSavedLeads();
  }, [activeStatus, search]);

  const loadSavedLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getSavedNicheLeads({
        status: activeStatus,
        q: search.trim(),
        pageSize: 100
      });
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setStatusCounts(data.statusCounts || []);
    } catch (err) {
      console.error(err);
      notify('Failed to load saved leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.updateSavedNicheLead(id, { status: newStatus });
      setLeads(leads.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
      notify(`Status updated to "${newStatus}"`, 'success');
      loadSavedLeads();
    } catch (err) {
      notify('Failed to update status', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete lead "${name}" from saved list?`)) return;
    try {
      await api.deleteSavedNicheLead(id);
      setLeads(leads.filter((l) => l.id !== id));
      setTotal(total - 1);
      notify(`Removed lead "${name}"`, 'info');
    } catch (err) {
      notify('Failed to delete lead', 'error');
    }
  };

  const handleOpenNoteModal = (lead) => {
    setEditingNoteLead(lead);
    setNoteText(lead.notes || '');
  };

  const handleSaveNote = async () => {
    if (!editingNoteLead) return;
    try {
      await api.updateSavedNicheLead(editingNoteLead.id, { notes: noteText });
      setLeads(leads.map((l) => (l.id === editingNoteLead.id ? { ...l, notes: noteText } : l)));
      notify('Notes saved', 'success');
      setEditingNoteLead(null);
    } catch (err) {
      notify('Failed to save notes', 'error');
    }
  };

  const handleExportCsv = () => {
    if (leads.length === 0) {
      notify('No saved leads to export', 'warning');
      return;
    }
    const headers = [
      'Company',
      'Domain',
      'Phone',
      'Email',
      'Contact Page',
      'Decision Maker Persona',
      'LinkedIn Search',
      'Niche',
      'Location',
      'Evidence Source URL',
      'Evidence Source Label',
      'Context of Need / Opportunity',
      'Status',
      'Notes',
      'Created At'
    ];
    const rows = leads.map((l) => [
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.domain || '').replace(/"/g, '""')}"`,
      `"${(l.contact_phone || '').replace(/"/g, '""')}"`,
      `"${(l.contact_email || '').replace(/"/g, '""')}"`,
      `"${(l.contact_page_url || '').replace(/"/g, '""')}"`,
      `"${(l.contact_person || l.contact_title ? `${l.contact_person} (${l.contact_title})` : '').replace(/"/g, '""')}"`,
      `"${(l.contact_linkedin || '').replace(/"/g, '""')}"`,
      `"${(l.niche || '').replace(/"/g, '""')}"`,
      `"${(l.location || '').replace(/"/g, '""')}"`,
      `"${(l.evidence_url || '').replace(/"/g, '""')}"`,
      `"${(l.evidence_label || '').replace(/"/g, '""')}"`,
      `"${(l.detected_need || '').replace(/"/g, '""')}"`,
      `"${(l.status || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
      `"${(l.created_at || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rynex_saved_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('CSV exported successfully', 'success');
  };

  const statusOptions = ['New', 'Contacted', 'Meeting Booked', 'Qualified', 'Closed'];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider mb-1">
            <IconBookmark />
            <span>Persistent Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Saved Leads Pipeline ({total})</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage your discovered prospects, corporate contact channels, evidence sources, and outreach status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 hover:text-white border border-[#333333] text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <IconDownload className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0a0a0a] border border-[#222222] p-4 rounded-lg space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {['All', ...statusOptions].map((st) => {
            const countObj = statusCounts.find((c) => c.status === st);
            const count = st === 'All' ? total : (countObj ? countObj.count : 0);
            const active = activeStatus === st;
            return (
              <button
                key={st}
                onClick={() => setActiveStatus(st)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#00D4FF] text-black font-semibold'
                    : 'bg-[#141414] hover:bg-[#202020] text-zinc-400 border border-[#2a2a2a]'
                }`}
              >
                <span>{st}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${active ? 'bg-black/20 text-black' : 'bg-black text-zinc-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved leads by company, domain, need, or notes..."
            className="w-full bg-[#111111] border border-[#2a2a2a] focus:border-[#00D4FF] focus:outline-none px-3.5 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
          />
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-zinc-500 font-mono text-xs">
          <IconRefresh className="w-4 h-4 animate-spin mr-2 text-[#00D4FF]" />
          <span>Loading saved pipeline...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#222222] rounded-lg p-12 text-center space-y-3">
          <IconBookmark className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No Saved Leads Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {search || activeStatus !== 'All'
              ? 'No leads matched your filter criteria.'
              : 'Go to "Find Leads" to discover prospects in your target niche and save them to this pipeline.'}
          </p>
        </div>
      ) : (
        <div className="border border-[#222222] rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs font-mono min-w-[950px]">
            <thead className="bg-[#0e0e0e] border-b border-[#222222] text-zinc-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 font-semibold w-[220px]">Company & Location</th>
                <th className="p-3 font-semibold w-[230px]">Corporate Contacts</th>
                <th className="p-3 font-semibold min-w-[280px]">Context of Need & Evidence</th>
                <th className="p-3 font-semibold w-[180px]">Decision-Maker</th>
                <th className="p-3 font-semibold w-[130px]">Status</th>
                <th className="p-3 font-semibold text-right w-[110px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a] bg-[#050505]">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#0c0c0c] transition-colors">
                  {/* Company & Location */}
                  <td className="p-3 font-sans align-top">
                    <div className="font-bold text-white text-sm">{lead.company_name}</div>
                    {lead.domain && (
                      <a
                        href={lead.website || `https://${lead.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-[#00D4FF] hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span>{lead.domain}</span>
                        <IconExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <div className="text-zinc-500 text-[10px] font-mono mt-1">
                      {lead.niche || 'B2B'} | {lead.location || 'Global'}
                    </div>
                  </td>

                  {/* Corporate Contacts */}
                  <td className="p-3 align-top space-y-1.5 font-mono">
                    {/* Phone */}
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <IconPhone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      {lead.contact_phone ? (
                        <a
                          href={`tel:${lead.contact_phone.replace(/[^\d+]/g, '')}`}
                          className="text-emerald-300 hover:underline text-[11px] truncate"
                          title="Corporate telephone"
                        >
                          {lead.contact_phone}
                        </a>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">No direct phone</span>
                      )}
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-1.5 text-zinc-300">
                      <IconMail className="w-3 h-3 text-sky-400 flex-shrink-0" />
                      {lead.contact_email ? (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="text-sky-300 hover:underline text-[11px] truncate"
                          title="Direct outreach inbox"
                        >
                          {lead.contact_email}
                        </a>
                      ) : (
                        <span className="text-zinc-500 text-[11px]">No direct email</span>
                      )}
                    </div>

                    {/* Contact Page */}
                    {lead.contact_page_url && (
                      <div className="flex items-center gap-1.5 text-zinc-300 pt-0.5">
                        <IconExternalLink className="w-3 h-3 text-[#00D4FF] flex-shrink-0" />
                        <a
                          href={lead.contact_page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D4FF] hover:underline text-[10px] truncate"
                        >
                          Official Contact Page
                        </a>
                      </div>
                    )}
                  </td>

                  {/* Context of Need & Evidence */}
                  <td className="p-3 align-top space-y-2">
                    <div className="text-zinc-300 text-[11px] line-clamp-3 bg-[#0a0a0a] p-2 rounded border border-[#1f1f1f] leading-relaxed font-mono">
                      {lead.detected_need || 'General modernization & security'}
                    </div>
                    {lead.evidence_url && (
                      <a
                        href={lead.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] hover:text-white border border-[#00D4FF]/30 text-[10px] font-mono transition-colors"
                        title="Click to inspect evidence source"
                      >
                        <IconExternalLink className="w-2.5 h-2.5" />
                        <span>Source: {lead.evidence_label || 'Corporate Link'}</span>
                      </a>
                    )}
                  </td>

                  {/* Decision-Maker */}
                  <td className="p-3 align-top font-mono">
                    <div className="text-white text-xs font-semibold">
                      {lead.contact_title || lead.contact_person || 'CTO / CISO'}
                    </div>
                    {lead.contact_linkedin ? (
                      <a
                        href={lead.contact_linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#58a6ff] hover:underline mt-1"
                      >
                        <span>Search LinkedIn</span>
                        <IconExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : lead.domain ? (
                      <a
                        href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent((lead.company_name || '') + ' ' + (lead.contact_title || 'CTO CISO'))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#58a6ff] hover:underline mt-1"
                      >
                        <span>Search LinkedIn</span>
                        <IconExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : null}
                  </td>

                  {/* Status Dropdown */}
                  <td className="p-3 align-top">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`text-xs font-mono px-2 py-1 rounded border focus:outline-none cursor-pointer w-full ${
                        lead.status === 'New' ? 'bg-sky-950/30 text-sky-400 border-sky-800' :
                        lead.status === 'Contacted' ? 'bg-amber-950/30 text-amber-400 border-amber-800' :
                        lead.status === 'Meeting Booked' ? 'bg-indigo-950/30 text-indigo-400 border-indigo-800' :
                        lead.status === 'Qualified' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800' :
                        'bg-zinc-900 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt} className="bg-black text-white">
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-right align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenEmailStudio(lead)}
                        title="Generate Contextual AI Email"
                        className="p-1.5 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 transition-colors cursor-pointer"
                      >
                        <IconMail className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenNoteModal(lead)}
                        title="Edit Notes & Details"
                        className="p-1.5 rounded bg-[#161616] hover:bg-[#252525] text-zinc-300 border border-[#333333] transition-colors cursor-pointer"
                      >
                        <IconFileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(lead.id, lead.company_name)}
                        title="Delete Lead"
                        className="p-1.5 rounded bg-[#161616] hover:bg-rose-950 text-zinc-400 hover:text-rose-400 border border-[#333333] hover:border-rose-800 transition-colors cursor-pointer"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Note Editing Modal */}
      {editingNoteLead && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-[#333333] rounded-lg max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h3 className="text-sm font-bold text-white font-mono">
                Notes for {editingNoteLead.company_name}
              </h3>
              <button
                onClick={() => setEditingNoteLead(null)}
                className="text-zinc-500 hover:text-white"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-400">Add qualification notes, conversation summary, or follow-up dates:</label>
              <textarea
                rows={5}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="e.g. Spoke with CTO, interested in VAPT for upcoming compliance audit next month..."
                className="w-full bg-[#141414] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-3 rounded text-xs text-white font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingNoteLead(null)}
                className="px-3 py-1.5 rounded bg-[#161616] hover:bg-[#202020] text-zinc-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-1.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold text-xs font-mono"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. AI EMAIL STUDIO VIEW (CONTEXTUAL OUTREACH WRITER)
// ============================================================================
function AiEmailStudioView({ notify, lead, appSettings }) {
  const [currentLead, setCurrentLead] = useState(lead || null);
  const [savedLeadsList, setSavedLeadsList] = useState([]);
  const [serviceKey, setServiceKey] = useState('vapt');
  const [sequenceStage, setSequenceStage] = useState('initial');
  const [yourOffer, setYourOffer] = useState(appSettings.default_offer || 'Penetration testing (VAPT), 24/7 SOC monitoring, and GRC compliance readiness');
  const [tone, setTone] = useState('Consultative Problem-Solver');
  const [model, setModel] = useState(
    appSettings.openai_configured ? 'openai' : appSettings.gemini_configured ? 'gemini' : 'builtin'
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [renderedHtml, setRenderedHtml] = useState('');
  const [viewMode, setViewMode] = useState('text'); // 'text' | 'html'
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedHtml, setIsCopiedHtml] = useState(false);

  // Load saved leads for dropdown selector
  useEffect(() => {
    api.getSavedNicheLeads({ pageSize: 100 }).then((data) => {
      setSavedLeadsList(data.leads || []);
      if (!currentLead && data.leads && data.leads.length > 0) {
        setCurrentLead(data.leads[0]);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (lead) setCurrentLead(lead);
  }, [lead]);

  // Generate Email
  const handleGenerate = async () => {
    if (!currentLead) {
      notify('Please select or specify a target lead', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await api.generateNicheEmail({
        lead: currentLead,
        yourOffer: yourOffer.trim(),
        tone,
        sequenceStage,
        serviceKey,
        provider: model
      });

      setEmailResult(res);
      setEditableSubject(res.subject);
      setEditableBody(res.body);
      setRenderedHtml(res.html || '');
      setIsCopied(false);
      setIsCopiedHtml(false);
      notify(`Email generated (${res.sequenceStage}) via ${res.modelUsed}`, 'success');
    } catch (err) {
      console.error(err);
      notify(err.message || 'Failed to generate contextual email', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    const fullText = `Subject: ${editableSubject}\n\n${editableBody}`;
    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    notify('Plain text email copied to clipboard!', 'success');
    setTimeout(() => setIsCopied(false), 3000);
  };

  const handleCopyHtml = () => {
    if (!renderedHtml) return;
    navigator.clipboard.writeText(renderedHtml);
    setIsCopiedHtml(true);
    notify('Branded HTML template copied to clipboard!', 'success');
    setTimeout(() => setIsCopiedHtml(false), 3000);
  };

  const handleMarkContacted = async () => {
    if (!currentLead || !currentLead.id) {
      notify('This lead is not saved in your database yet. Save it first.', 'warning');
      return;
    }
    try {
      await api.updateSavedNicheLead(currentLead.id, { status: 'Contacted' });
      setCurrentLead({ ...currentLead, status: 'Contacted' });
      notify(`Marked ${currentLead.company_name} as "Contacted"`, 'success');
    } catch (err) {
      notify('Failed to update lead status', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider mb-1">
          <IconSparkles />
          <span>Context-Driven AI Outreach Engine & Email Templates</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">AI Contextual Email Studio</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Generate bespoke offensive security outreach emails and complete follow-up sequences, rendered in plain text or Rynex branded HTML.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Setup & Lead Context (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Target Lead Selector */}
          <div className="bg-[#0a0a0a] border border-[#222222] p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Target Prospect
              </label>
              {savedLeadsList.length > 0 && (
                <span className="text-[10px] font-mono text-zinc-500">
                  {savedLeadsList.length} saved leads available
                </span>
              )}
            </div>

            {savedLeadsList.length > 0 ? (
              <select
                value={currentLead ? currentLead.id : ''}
                onChange={(e) => {
                  const found = savedLeadsList.find((l) => String(l.id) === e.target.value);
                  if (found) setCurrentLead(found);
                }}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2.5 rounded text-xs text-white font-mono"
              >
                {savedLeadsList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.company_name} ({l.domain || 'no domain'}) — {l.niche || 'B2B'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs font-mono text-zinc-500 p-2 bg-[#141414] rounded">
                No saved leads yet. You can find leads in "Find Leads".
              </div>
            )}

            {/* Current Lead Context Card */}
            {currentLead && (
              <div className="border border-[#1f1f1f] bg-[#050505] p-3.5 rounded-lg space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{currentLead.company_name}</span>
                  {currentLead.domain && (
                    <span className="text-[#00D4FF] font-mono text-[11px]">{currentLead.domain}</span>
                  )}
                </div>
                <p className="text-zinc-400 text-[11px] line-clamp-2">{currentLead.description}</p>

                {/* Contacts row */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1a1a1a] text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-zinc-300 truncate">
                    <IconPhone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    {currentLead.contact_phone ? (
                      <a href={`tel:${currentLead.contact_phone.replace(/[^\d+]/g, '')}`} className="text-emerald-300 hover:underline truncate">
                        {currentLead.contact_phone}
                      </a>
                    ) : (
                      <span className="text-zinc-500">No phone</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-300 truncate">
                    <IconMail className="w-3 h-3 text-sky-400 flex-shrink-0" />
                    {currentLead.contact_email ? (
                      <a href={`mailto:${currentLead.contact_email}`} className="text-sky-300 hover:underline truncate">
                        {currentLead.contact_email}
                      </a>
                    ) : (
                      <span className="text-zinc-500">No email</span>
                    )}
                  </div>
                </div>

                {/* Need & Evidence */}
                <div className="p-2.5 rounded bg-[#0a0a0a] border border-[#2a2a2a] text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#00D4FF] font-bold">Detected Need:</span>
                    {currentLead.evidence_url && (
                      <a
                        href={currentLead.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-[#00D4FF] hover:underline font-mono"
                      >
                        <span>Evidence: {currentLead.evidence_label || 'Source'}</span>
                        <IconExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="text-zinc-200 font-mono text-[11px] leading-relaxed line-clamp-3">
                    {currentLead.detected_need || 'Penetration testing & compliance'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sequence Stage & Service Configuration */}
          <div className="bg-[#0a0a0a] border border-[#222222] p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                  Rynex Service
                </label>
                <select
                  value={serviceKey}
                  onChange={(e) => setServiceKey(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2 rounded text-xs text-white font-mono"
                >
                  <option value="vapt">VAPT (Penetration Testing)</option>
                  <option value="soc">SOC (24/7 Monitoring)</option>
                  <option value="grc">GRC (Compliance Readiness)</option>
                  <option value="audits">Security Audits (Cloud & Architecture)</option>
                  <option value="trainings">Cyber Security Trainings (Awareness & Phishing)</option>
                  <option value="general">General Security Testing</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                  Sequence Stage
                </label>
                <select
                  value={sequenceStage}
                  onChange={(e) => setSequenceStage(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2 rounded text-xs text-white font-mono"
                >
                  <option value="initial">1. Initial Outreach</option>
                  <option value="followup_1">2. Follow-up 1 (Approach)</option>
                  <option value="followup_2">3. Follow-up 2 (Checklist)</option>
                  <option value="followup_3">4. Follow-up 3 (Final Note)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Outreach Tone & Angle
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2 rounded text-xs text-white font-mono"
              >
                <option value="Consultative Problem-Solver">Consultative Problem-Solver (Offensive security focus)</option>
                <option value="Direct & Value-Driven">Direct & Value-Driven (Concise, 3-sentence hook)</option>
                <option value="Soft Intro">Soft Intro (Low-friction conversational intro)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>AI Writing Model</span>
                <span className="text-[10px] text-zinc-500">API Key Configured in Settings</span>
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2 rounded text-xs text-white font-mono"
              >
                <option value="builtin">Rynex Security Engine (Official Config v2)</option>
                <option value="openai" disabled={!appSettings.openai_configured}>
                  OpenAI GPT-4o-mini {appSettings.openai_configured ? '(Active)' : '(Requires API Key)'}
                </option>
                <option value="gemini" disabled={!appSettings.gemini_configured}>
                  Google Gemini 1.5 Flash {appSettings.gemini_configured ? '(Active)' : '(Requires API Key)'}
                </option>
                <option value="groq" disabled={!appSettings.groq_configured}>
                  Groq Llama-3.3-70B {appSettings.groq_configured ? '(Active)' : '(Requires API Key)'}
                </option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !currentLead}
              className="w-full py-2.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-[#00D4FF]/20 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <IconRefresh className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Contextual Email...</span>
                </>
              ) : (
                <>
                  <IconSparkles className="w-4 h-4" />
                  <span>Generate Outreach Email</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Generated Email Preview (7 cols) */}
        <div className="lg:col-span-7 bg-[#0a0a0a] border border-[#222222] rounded-lg p-5 flex flex-col space-y-4 min-h-[560px]">
          <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-3">
            <div className="flex items-center gap-2">
              <IconMail className="w-4 h-4 text-[#00D4FF]" />
              <span className="font-bold text-xs text-white font-mono uppercase tracking-wider">Outreach Draft Preview</span>
            </div>

            <div className="flex items-center gap-2">
              {emailResult && (
                <div className="flex items-center bg-[#141414] border border-[#2a2a2a] rounded p-0.5 text-[11px] font-mono">
                  <button
                    onClick={() => setViewMode('text')}
                    className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'text' ? 'bg-[#00D4FF] text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Plain Text
                  </button>
                  <button
                    onClick={() => setViewMode('html')}
                    className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'html' ? 'bg-[#00D4FF] text-black font-bold' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Branded HTML
                  </button>
                </div>
              )}
              {emailResult && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
                  {emailResult.modelUsed}
                </span>
              )}
            </div>
          </div>

          {!emailResult ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
              <IconMail className="w-10 h-10 text-zinc-700" />
              <h3 className="text-sm font-semibold text-zinc-400 font-mono">No Email Generated Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm">
                Select a lead on the left, choose your Rynex service and sequence stage, then click "Generate Outreach Email" to create a bespoke email.
              </p>
            </div>
          ) : viewMode === 'html' ? (
            /* Branded HTML Template Preview */
            <div className="flex-1 flex flex-col space-y-3">
              <div className="border border-[#222222] rounded-lg overflow-hidden bg-white min-h-[420px]">
                <iframe
                  title="Branded Email Preview"
                  srcDoc={renderedHtml}
                  className="w-full h-[420px] border-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a1a1a]">
                <button
                  onClick={handleCopyHtml}
                  className={`px-4 py-2 rounded text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    isCopiedHtml
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#161616] hover:bg-[#252525] text-[#00D4FF] border border-[#00D4FF]/40'
                  }`}
                >
                  {isCopiedHtml ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
                  <span>{isCopiedHtml ? 'Copied HTML Code!' : 'Copy Branded HTML Code'}</span>
                </button>

                {currentLead && currentLead.id && (
                  <button
                    onClick={handleMarkContacted}
                    className="px-3.5 py-2 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Mark Lead as Contacted</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Plain Text Preview */
            <div className="flex-1 flex flex-col space-y-3">
              {/* Subject Line Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-zinc-400">Subject Line</label>
                <input
                  type="text"
                  value={editableSubject}
                  onChange={(e) => setEditableSubject(e.target.value)}
                  className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono font-semibold"
                />
              </div>

              {/* Email Body Textarea */}
              <div className="space-y-1 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase text-zinc-400">Email Body</label>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {editableBody.split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={editableBody}
                  onChange={(e) => setEditableBody(e.target.value)}
                  className="w-full flex-1 bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-3.5 rounded text-xs text-zinc-200 font-mono leading-relaxed resize-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyText}
                    className={`px-4 py-2 rounded text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161616] hover:bg-[#252525] text-white border border-[#333333]'
                    }`}
                  >
                    {isCopied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied Text!' : 'Copy Plain Text'}</span>
                  </button>

                  <button
                    onClick={handleCopyHtml}
                    className={`px-3 py-2 rounded text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCopiedHtml
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161616] hover:bg-[#252525] text-[#00D4FF] border border-[#00D4FF]/40'
                    }`}
                  >
                    <IconCopy className="w-3.5 h-3.5" />
                    <span>Copy HTML</span>
                  </button>
                </div>

                {currentLead && currentLead.id && (
                  <button
                    onClick={handleMarkContacted}
                    className="px-3.5 py-2 rounded bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Mark Lead as Contacted</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. API KEYS & SETTINGS VIEW
// ============================================================================
function ApiSettingsView({ notify, appSettings, onSettingsSaved }) {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState(appSettings.search_provider || 'builtin');
  const [defaultOffer, setDefaultOffer] = useState(appSettings.default_offer || '');
  const [senderName, setSenderName] = useState(appSettings.sender_name || '');
  const [senderTitle, setSenderTitle] = useState(appSettings.sender_title || 'Business Development');
  const [senderCompany, setSenderCompany] = useState(appSettings.sender_company || 'Rynex Security');
  const [website, setWebsite] = useState(appSettings.website || 'https://rynexsecurity.com');
  const [fromEmail, setFromEmail] = useState(appSettings.from_email || 'info@rynexsecurity.com');
  const [smtpHost, setSmtpHost] = useState(appSettings.smtp_host || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(appSettings.smtp_port || 587);
  const [smtpUser, setSmtpUser] = useState(appSettings.smtp_user || 'info@rynexsecurity.com');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [postalAddress, setPostalAddress] = useState(appSettings.postal_address || 'Rynex Security, Karachi, Pakistan');

  const [testingProvider, setTestingProvider] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDefaultOffer(appSettings.default_offer || '');
    setSenderName(appSettings.sender_name || '');
    setSenderTitle(appSettings.sender_title || 'Business Development');
    setSenderCompany(appSettings.sender_company || 'Rynex Security');
    setWebsite(appSettings.website || 'https://rynexsecurity.com');
    setFromEmail(appSettings.from_email || 'info@rynexsecurity.com');
    setSmtpHost(appSettings.smtp_host || 'smtp.gmail.com');
    setSmtpPort(appSettings.smtp_port || 587);
    setSmtpUser(appSettings.smtp_user || 'info@rynexsecurity.com');
    setPostalAddress(appSettings.postal_address || 'Rynex Security, Karachi, Pakistan');
    setSearchProvider(appSettings.search_provider || 'builtin');
  }, [appSettings]);

  const handleTestKey = async (provider) => {
    const keyToTest = provider === 'openai' ? openaiKey : provider === 'gemini' ? geminiKey : groqKey;
    if (!keyToTest && !appSettings[`${provider}_configured`]) {
      notify(`Please enter a ${provider.toUpperCase()} API key to test`, 'warning');
      return;
    }

    setTestingProvider(provider);
    try {
      const res = await api.testApiKey({
        provider,
        apiKey: keyToTest || 'configured'
      });
      notify(`${res.message} (Latency: ${res.latencyMs}ms)`, 'success');
    } catch (err) {
      notify(err.message || `Failed to validate ${provider.toUpperCase()} key`, 'error');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        search_provider: searchProvider,
        default_offer: defaultOffer,
        sender_name: senderName,
        sender_title: senderTitle,
        sender_company: senderCompany,
        website: website,
        from_email: fromEmail,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        postal_address: postalAddress
      };
      if (openaiKey.trim()) payload.openai_key = openaiKey.trim();
      if (geminiKey.trim()) payload.gemini_key = geminiKey.trim();
      if (groqKey.trim()) payload.groq_key = groqKey.trim();
      if (searchApiKey.trim()) payload.search_api_key = searchApiKey.trim();
      if (smtpPassword.trim()) payload.smtp_password = smtpPassword.trim();

      await api.saveNicheSettings(payload);
      notify('Settings, API keys, and SMTP configuration saved successfully', 'success');
      setOpenaiKey('');
      setGeminiKey('');
      setGroqKey('');
      setSearchApiKey('');
      setSmtpPassword('');
      if (onSettingsSaved) onSettingsSaved();
    } catch (err) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#00D4FF] uppercase tracking-wider mb-1">
          <IconKey />
          <span>Configuration & Integrations</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">API Keys & Outbound Profile</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure your LLM API keys (OpenAI, Gemini, Groq) for custom cold email generation and optional Search APIs.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Card 1: AI Email Writing Keys */}
        <div className="bg-[#0a0a0a] border border-[#222222] p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <IconSparkles className="w-4 h-4 text-[#00D4FF]" />
            <span>AI Writing Models (OpenAI / Gemini / Groq)</span>
          </h3>

          {/* OpenAI */}
          <div className="space-y-1.5 border-b border-[#1a1a1a] pb-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-zinc-200">OpenAI API Key (GPT-4o-mini)</label>
              <span className={`text-[10px] px-2 py-0.5 rounded ${appSettings.openai_configured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'}`}>
                {appSettings.openai_configured ? `Active (${appSettings.openai_masked})` : 'Not Configured'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={appSettings.openai_configured ? 'Paste new key to replace' : 'sk-proj-...'}
                className="flex-1 bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestKey('openai')}
                disabled={testingProvider === 'openai'}
                className="px-3 py-2 rounded bg-[#161616] hover:bg-[#222222] text-zinc-300 hover:text-white border border-[#333333] text-xs font-mono disabled:opacity-50 cursor-pointer"
              >
                {testingProvider === 'openai' ? 'Testing...' : 'Test Key'}
              </button>
            </div>
          </div>

          {/* Google Gemini */}
          <div className="space-y-1.5 border-b border-[#1a1a1a] pb-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-zinc-200">Google Gemini API Key (1.5 Flash)</label>
              <span className={`text-[10px] px-2 py-0.5 rounded ${appSettings.gemini_configured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'}`}>
                {appSettings.gemini_configured ? `Active (${appSettings.gemini_masked})` : 'Not Configured'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={appSettings.gemini_configured ? 'Paste new key to replace' : 'AIzaSy...'}
                className="flex-1 bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestKey('gemini')}
                disabled={testingProvider === 'gemini'}
                className="px-3 py-2 rounded bg-[#161616] hover:bg-[#222222] text-zinc-300 hover:text-white border border-[#333333] text-xs font-mono disabled:opacity-50 cursor-pointer"
              >
                {testingProvider === 'gemini' ? 'Testing...' : 'Test Key'}
              </button>
            </div>
          </div>

          {/* Groq */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="text-zinc-200">Groq API Key (Optional, Llama-3.3-70B)</label>
              <span className={`text-[10px] px-2 py-0.5 rounded ${appSettings.groq_configured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'}`}>
                {appSettings.groq_configured ? `Active (${appSettings.groq_masked})` : 'Not Configured'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder={appSettings.groq_configured ? 'Paste new key to replace' : 'gsk_...'}
                className="flex-1 bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
              <button
                type="button"
                onClick={() => handleTestKey('groq')}
                disabled={testingProvider === 'groq'}
                className="px-3 py-2 rounded bg-[#161616] hover:bg-[#222222] text-zinc-300 hover:text-white border border-[#333333] text-xs font-mono disabled:opacity-50 cursor-pointer"
              >
                {testingProvider === 'groq' ? 'Testing...' : 'Test Key'}
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Search Provider */}
        <div className="bg-[#0a0a0a] border border-[#222222] p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <IconSearch className="w-4 h-4 text-[#00D4FF]" />
            <span>Lead Generation Search Provider</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Active Search Engine</label>
              <select
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value)}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2 rounded text-xs text-white font-mono"
              >
                <option value="builtin">Built-in Live Web Discovery (Free, no key needed)</option>
                <option value="serpapi">SerpAPI (Google Organic Search)</option>
                <option value="tavily">Tavily AI Search</option>
              </select>
            </div>

            {searchProvider !== 'builtin' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-zinc-300">Search API Key</label>
                <input
                  type="password"
                  value={searchApiKey}
                  onChange={(e) => setSearchApiKey(e.target.value)}
                  placeholder={appSettings.search_configured ? 'Paste new search key' : 'Enter SerpAPI or Tavily key'}
                  className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Sender Profile & Company Branding */}
        <div className="bg-[#0a0a0a] border border-[#222222] p-5 rounded-lg space-y-4">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <IconTarget className="w-4 h-4 text-[#00D4FF]" />
            <span>Sender Profile & Rynex Branding</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Your Sender Name</label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Ayesha Malik"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Job Title</label>
              <input
                type="text"
                value={senderTitle}
                onChange={(e) => setSenderTitle(e.target.value)}
                placeholder="e.g. Business Development"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Company Name</label>
              <input
                type="text"
                value={senderCompany}
                onChange={(e) => setSenderCompany(e.target.value)}
                placeholder="e.g. Rynex Security"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Official Website URL</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://rynexsecurity.com"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Postal Address (Compliance Footer)</label>
              <input
                type="text"
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                placeholder="e.g. Rynex Security, Tech Hub, Karachi, Pakistan"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-300">Default Service Offer / Value Proposition</label>
            <textarea
              rows={2}
              value={defaultOffer}
              onChange={(e) => setDefaultOffer(e.target.value)}
              placeholder="e.g. Penetration testing (VAPT), 24/7 SOC monitoring, and GRC compliance readiness"
              className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none p-2.5 rounded text-xs text-white placeholder-zinc-600 font-mono"
            />
          </div>
        </div>

        {/* Card 4: Gmail SMTP Dispatcher Settings */}
        <div className="bg-[#0a0a0a] border border-[#222222] p-5 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <IconMail className="w-4 h-4 text-[#00D4FF]" />
              <span>Gmail SMTP Dispatcher (Optional Direct Send)</span>
            </h3>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${appSettings.smtp_configured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-400'}`}>
              {appSettings.smtp_configured ? 'SMTP Configured' : 'Credentials Empty'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">SMTP Host</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">Port (587 STARTTLS)</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">From / Reply-To Email</label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="info@rynexsecurity.com"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">SMTP Username</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="info@rynexsecurity.com"
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-300">SMTP App Password</label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={appSettings.smtp_configured ? '•••••••••••• (Configured)' : 'Google App Password'}
                className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3 py-2 rounded text-xs text-white placeholder-zinc-600 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#00D4FF]/20 cursor-pointer"
          >
            {isSaving ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconCheck className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 5. LOGIN VIEW
// ============================================================================
function LoginView({ onLogin, notify }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { label: 'Administrator', email: 'admin@rynex.io', pass: 'Admin@123', role: 'Full Access' },
    { label: 'Security Manager', email: 'manager@rynex.io', pass: 'Manager@123', role: 'Campaigns & Review' },
    { label: 'Lead Researcher', email: 'researcher@rynex.io', pass: 'Research@123', role: 'Niche Discovery' },
    { label: 'Cyber Sales Rep', email: 'sales@rynex.io', pass: 'Sales@123', role: 'Outreach & Deals' }
  ];

  const handleLogin = async (loginEmail, loginPass) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail || email, password: loginPass || password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      setSession(data.token, data.user);
      onLogin(data.user);
    } catch (err) {
      notify(err.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-6 selection:bg-[#00D4FF]/30 selection:text-[#00D4FF]">
      <div className="max-w-md w-full space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded bg-[#0a0a0a] border border-[#00D4FF] mx-auto flex items-center justify-center font-mono font-black text-[#00D4FF] text-xl tracking-tighter shadow-lg shadow-[#00D4FF]/20">
            RX
          </div>
          <h1 className="text-xl font-bold font-mono tracking-wider text-white uppercase">RYNEX TECHNOLOGIES</h1>
          <p className="text-xs font-mono text-[#00D4FF] tracking-widest uppercase">GLOBAL LEAD INTELLIGENCE & OUTREACH</p>
          <div className="flex justify-center gap-3 text-[10px] text-zinc-500 font-mono tracking-widest uppercase pt-1">
            <span>NICHE GENERATOR</span>
            <span>LEAD SAVING</span>
            <span>CONTEXTUAL AI</span>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="bg-[#0a0a0a] border border-[#222222] p-6 rounded-lg space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@rynex.io"
              className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3.5 py-2.5 rounded text-xs text-white placeholder-zinc-600 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#111111] border border-[#333333] focus:border-[#00D4FF] focus:outline-none px-3.5 py-2.5 rounded text-xs text-white placeholder-zinc-600 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-[#00D4FF] hover:bg-[#00b8dc] text-black font-semibold font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#00D4FF]/20"
          >
            {loading ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconShield className="w-4 h-4" />}
            <span>Sign In to Platform</span>
          </button>
        </form>

        {/* 1-Click Quick Demo Access */}
        <div className="bg-[#080808] border border-[#1a1a1a] p-4 rounded-lg space-y-2.5">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider text-center">
            Instant 1-Click Authentication:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((acc, i) => (
              <button
                key={i}
                onClick={() => handleLogin(acc.email, acc.pass)}
                disabled={loading}
                className="text-left p-2.5 rounded bg-[#101010] hover:bg-[#181818] border border-[#222222] hover:border-[#00D4FF]/50 transition-all font-mono cursor-pointer"
              >
                <div className="text-xs font-semibold text-white truncate">{acc.label}</div>
                <div className="text-[10px] text-zinc-500 truncate">{acc.role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
