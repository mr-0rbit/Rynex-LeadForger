/**
 * Rynex API Client
 */

const TOKEN_KEY = 'rynex_auth_token';
const USER_KEY = 'rynex_user_profile';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('rynex:unauthorized'));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/api/auth/me'),
  getDemoAccounts: () => request('/api/auth/demo-accounts'),
  getUsers: () => request('/api/auth/users'),

  // Dashboard & Analytics
  getDashboard: () => request('/api/dashboard'),
  getAnalytics: () => request('/api/analytics'),
  getActivity: (page = 1) => request(`/api/activity?page=${page}`),

  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return request(`/api/leads?${qs.toString()}`);
  },
  getLead: (id) => request(`/api/leads/${id}`),
  updateLeadStatus: (id, status) => request(`/api/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  bulkLeadAction: (ids, action, value) => request('/api/leads/bulk', { method: 'POST', body: JSON.stringify({ ids, action, value }) }),
  addNote: (id, body) => request(`/api/leads/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  addTask: (id, task) => request(`/api/leads/${id}/tasks`, { method: 'POST', body: JSON.stringify(task) }),
  addTag: (id, name) => request(`/api/leads/${id}/tags`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteTag: (id, tagId) => request(`/api/leads/${id}/tags/${tagId}`, { method: 'DELETE' }),
  prospectLead: (payload) => request('/api/leads/prospect', { method: 'POST', body: JSON.stringify(payload) }),
  purgeDemoLeads: () => request('/api/leads/demo', { method: 'DELETE' }),

  // Meta options
  getMeta: () => request('/api/meta'),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),

  // Companies & Contacts & Evidence
  getCompanies: (page = 1, q = '') => request(`/api/companies?page=${page}&q=${encodeURIComponent(q)}`),
  getContacts: (page = 1, q = '') => request(`/api/contacts?page=${page}&q=${encodeURIComponent(q)}`),
  getEvidence: (page = 1, type = '', q = '') => request(`/api/evidence?page=${page}&type=${type}&q=${encodeURIComponent(q)}`),

  // Jobs
  getMethods: () => request('/api/methods'),
  getJobs: () => request('/api/jobs'),
  getJob: (id) => request(`/api/jobs/${id}`),
  startJob: (payload) => request('/api/jobs', { method: 'POST', body: JSON.stringify(payload) }),
  cancelJob: (id) => request(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  getJobLeads: (id) => request(`/api/jobs/${id}/leads`),

  // Outreach & Campaigns
  getCampaigns: () => request('/api/campaigns'),
  createCampaign: (campaign) => request('/api/campaigns', { method: 'POST', body: JSON.stringify(campaign) }),
  getCampaign: (id) => request(`/api/campaigns/${id}`),
  updateCampaignStatus: (id, status) => request(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  suggestCampaignLeads: (id) => request(`/api/campaigns/${id}/suggest`, { method: 'POST' }),
  addCampaignLeads: (id, ids) => request(`/api/campaigns/${id}/leads`, { method: 'POST', body: JSON.stringify({ ids }) }),

  // Emails
  getEmailContext: (leadId) => request(`/api/emails/context/${leadId}`),
  generateEmail: (payload) => request('/api/emails/generate', { method: 'POST', body: JSON.stringify(payload) }),
  saveDraft: (payload) => request('/api/emails/drafts', { method: 'POST', body: JSON.stringify(payload) }),
  getDrafts: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.append(k, v); });
    return request(`/api/emails/drafts?${qs.toString()}`);
  },
  getDraft: (id) => request(`/api/emails/drafts/${id}`),
  updateDraft: (id, payload) => request(`/api/emails/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  recordDraftEvent: (id, event) => request(`/api/emails/drafts/${id}/events`, { method: 'POST', body: JSON.stringify({ event }) }),
  getTemplates: () => request('/api/templates'),

  // Suppression
  getSuppression: () => request('/api/suppression'),
  addSuppression: (payload) => request('/api/suppression', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSuppression: (id) => request(`/api/suppression/${id}`, { method: 'DELETE' }),

  // Settings & Integrations
  getSettings: () => request('/api/settings'),
  updateSettings: (payload) => request('/api/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getIntegrations: () => request('/api/integrations'),
  updateIntegration: (key, payload) => request(`/api/integrations/${key}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // Exports & Imports
  getExportHistory: () => request('/api/exports/history'),
  parseImport: (payload) => request('/api/imports/parse', { method: 'POST', body: JSON.stringify(payload) }),
  validateImport: (payload) => request('/api/imports/validate', { method: 'POST', body: JSON.stringify(payload) }),
  commitImport: (payload) => request('/api/imports/commit', { method: 'POST', body: JSON.stringify(payload) }),
  getExportUrl: (format = 'csv', filters = {}) => {
    const qs = new URLSearchParams({ format, ...filters });
    return `/api/exports/leads?${qs.toString()}`;
  },

  // Niche Lead Generation & AI Contextual Outreach
  findNicheLeads: (payload) => request('/api/niche/find', { method: 'POST', body: JSON.stringify(payload) }),
  saveNicheLeads: (payload) => request('/api/niche/save', { method: 'POST', body: JSON.stringify(payload) }),
  getSavedNicheLeads: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.append(k, v); });
    return request(`/api/niche/saved?${qs.toString()}`);
  },
  updateSavedNicheLead: (id, payload) => request(`/api/niche/saved/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSavedNicheLead: (id) => request(`/api/niche/saved/${id}`, { method: 'DELETE' }),
  generateNicheEmail: (payload) => request('/api/niche/email', { method: 'POST', body: JSON.stringify(payload) }),
  quickAuditDomain: (domain) => request('/api/niche/quick-audit', { method: 'POST', body: JSON.stringify({ domain }) }),
  getNicheSettings: () => request('/api/niche/settings'),
  saveNicheSettings: (payload) => request('/api/niche/settings', { method: 'POST', body: JSON.stringify(payload) }),
  testApiKey: (payload) => request('/api/niche/test-key', { method: 'POST', body: JSON.stringify(payload) })
};
