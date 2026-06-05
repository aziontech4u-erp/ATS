import type { CompanySettings, AuditEntry } from './types';
import { uid } from './storage';

const KEY = 'recruitment_ats_company_v1';

export function defaultCompanySettings(): CompanySettings {
  return {
    profile: {
      name: 'Acme Recruitment',
      legalName: 'Acme Recruitment LLC',
      industry: 'Staffing & Recruiting',
      size: '11-50',
      website: '',
      email: '',
      phone: '',
      addressLine: '',
      city: '',
      country: 'Oman',
      taxId: '',
      logoDataUrl: ''
    },
    users: [
      {
        id: uid(),
        name: 'Demo Admin',
        email: 'demo@ats.local',
        role: 'Admin',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ],
    notifications: {
      emailNewCandidate: true,
      emailInterviewReminder: true,
      emailOfferStatus: true,
      inAppMentions: true,
      dailyDigest: false
    },
    integrations: [
      { id: uid(), name: 'LinkedIn Jobs', category: 'job_board', connected: false },
      { id: uid(), name: 'Indeed',        category: 'job_board', connected: false },
      { id: uid(), name: 'Bayt',          category: 'job_board', connected: false },
      { id: uid(), name: 'Gmail / Outlook', category: 'email', connected: false },
      { id: uid(), name: 'Google Calendar', category: 'calendar', connected: false },
      { id: uid(), name: 'Microsoft Teams', category: 'video', connected: false },
      { id: uid(), name: 'Zoom', category: 'video', connected: false },
      { id: uid(), name: 'BambooHR', category: 'hr', connected: false },
      { id: uid(), name: 'Google Drive', category: 'storage', connected: false }
    ],
    appearance: {
      density: 'comfortable',
      accent: '#2756e8',
      sidebarCollapsed: false
    },
    security: {
      mfaRequired: false,
      sessionTimeoutMinutes: 60,
      passwordMinLength: 8,
      ipAllowlist: []
    },
    audit: [],
    intakeWebhook: { url: '', enabled: false }
  };
}

export function loadCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultCompanySettings();
    const parsed = JSON.parse(raw) as Partial<CompanySettings>;
    const def = defaultCompanySettings();
    return {
      profile: { ...def.profile, ...(parsed.profile || {}) },
      users: parsed.users && parsed.users.length ? parsed.users : def.users,
      notifications: { ...def.notifications, ...(parsed.notifications || {}) },
      integrations: parsed.integrations && parsed.integrations.length ? parsed.integrations : def.integrations,
      appearance: { ...def.appearance, ...(parsed.appearance || {}) },
      security: { ...def.security, ...(parsed.security || {}) },
      audit: parsed.audit || [],
      intakeWebhook: { ...def.intakeWebhook!, ...(parsed.intakeWebhook || {}) }
    };
  } catch {
    return defaultCompanySettings();
  }
}

export function saveCompanySettings(s: CompanySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    console.warn('Company settings save failed', err);
  }
}

export function pushAudit(s: CompanySettings, actor: string, action: string, target: string): CompanySettings {
  const entry: AuditEntry = {
    id: uid(),
    at: new Date().toISOString(),
    actor,
    action,
    target
  };
  return { ...s, audit: [entry, ...s.audit].slice(0, 200) };
}
