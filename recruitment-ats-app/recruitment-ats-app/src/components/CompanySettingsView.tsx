import { useMemo, useState } from 'react';
import {
  Building2, Users as UsersIcon, Bell, Plug, Palette, ShieldCheck,
  ScrollText, Database, Upload, Save, Trash2, Plus, Download, Image as ImageIcon
} from 'lucide-react';
import type {
  CompanySettings, UserAccount
} from '../lib/types';
import {
  loadCompanySettings, saveCompanySettings, pushAudit
} from '../lib/companySettings';
import { useUi } from '../lib/uiContext';
import { uid } from '../lib/storage';

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type Tab = 'company' | 'users' | 'notifications' | 'integrations' | 'appearance' | 'security' | 'audit' | 'backup';

const TABS: { id: Tab; key: string; icon: any }[] = [
  { id: 'company',       key: 'company.tab.company',       icon: Building2 },
  { id: 'users',         key: 'company.tab.users',         icon: UsersIcon },
  { id: 'notifications', key: 'company.tab.notifications', icon: Bell },
  { id: 'integrations',  key: 'company.tab.integrations',  icon: Plug },
  { id: 'appearance',    key: 'company.tab.appearance',    icon: Palette },
  { id: 'security',      key: 'company.tab.security',      icon: ShieldCheck },
  { id: 'audit',         key: 'company.tab.audit',         icon: ScrollText },
  { id: 'backup',        key: 'company.tab.backup',        icon: Database }
];

export default function CompanySettingsView({ onToast }: Props) {
  const { t, user } = useUi();
  const [tab, setTab] = useState<Tab>('company');
  const [settings, setSettings] = useState<CompanySettings>(() => loadCompanySettings());
  const [dirty, setDirty] = useState(false);

  function patch(next: CompanySettings, action?: string, target?: string) {
    let withAudit = next;
    if (action) {
      withAudit = pushAudit(next, user?.email || 'system', action, target || '');
    }
    setSettings(withAudit);
    setDirty(true);
  }

  function saveAll() {
    saveCompanySettings(settings);
    setDirty(false);
    onToast(t('company.savedToast'), 'success');
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('company.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('company.subtitle')}</p>
        </div>
        <button
          onClick={saveAll}
          disabled={!dirty}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white ${
            dirty ? 'bg-brand-500 hover:bg-brand-600' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
          }`}
        >
          <Save size={13} />
          {t('company.save')}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sub-nav */}
        <nav className="flex w-52 flex-col gap-1 border-e border-blue-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          {TABS.map(({ id, key, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  active
                    ? 'bg-blue-50 text-brand-500 font-semibold dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                <span className="flex-1 text-start">{t(key)}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'company' && <CompanyTab settings={settings} patch={patch} />}
          {tab === 'users' && <UsersTab settings={settings} patch={patch} />}
          {tab === 'notifications' && <NotificationsTab settings={settings} patch={patch} />}
          {tab === 'integrations' && <IntegrationsTab settings={settings} patch={patch} />}
          {tab === 'appearance' && <AppearanceTab settings={settings} patch={patch} />}
          {tab === 'security' && <SecurityTab settings={settings} patch={patch} />}
          {tab === 'audit' && <AuditTab settings={settings} />}
          {tab === 'backup' && <BackupTab settings={settings} setSettings={setSettings} onToast={onToast} />}
        </div>
      </div>
    </div>
  );
}

// ── Reusable bits ───────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function TextField({
  value, onChange, type = 'text', placeholder
}: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <span
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`}
        />
      </span>
    </label>
  );
}

// ── Company / Logo ──────────────────────────────────────────────

function CompanyTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const p = settings.profile;
  function set<K extends keyof typeof p>(key: K, val: (typeof p)[K]) {
    patch({ ...settings, profile: { ...p, [key]: val } }, 'updated_company_profile', String(key));
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <>
      <Card title="Logo">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            {p.logoDataUrl ? (
              <img src={p.logoDataUrl} alt="logo" className="max-h-full max-w-full rounded-lg object-contain" />
            ) : (
              <ImageIcon size={22} className="text-slate-400" />
            )}
          </div>
          <label className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-brand-500 hover:bg-blue-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
            <Upload size={13} />
            Upload Logo
            <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
          </label>
          {p.logoDataUrl && (
            <button
              onClick={() => set('logoDataUrl', '')}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-900/30 dark:text-rose-300"
            >
              Remove
            </button>
          )}
        </div>
      </Card>

      <Card title="Profile">
        <div className="grid grid-cols-2 gap-3">
          <Row label="Display Name"><TextField value={p.name} onChange={(v) => set('name', v)} /></Row>
          <Row label="Legal Name"><TextField value={p.legalName} onChange={(v) => set('legalName', v)} /></Row>
          <Row label="Industry"><TextField value={p.industry} onChange={(v) => set('industry', v)} /></Row>
          <Row label="Company Size"><TextField value={p.size} onChange={(v) => set('size', v)} placeholder="1-10, 11-50, 51-200..." /></Row>
          <Row label="Website"><TextField value={p.website} onChange={(v) => set('website', v)} placeholder="https://..." /></Row>
          <Row label="Email"><TextField value={p.email} onChange={(v) => set('email', v)} type="email" /></Row>
          <Row label="Phone"><TextField value={p.phone} onChange={(v) => set('phone', v)} /></Row>
          <Row label="Tax / VAT ID"><TextField value={p.taxId} onChange={(v) => set('taxId', v)} /></Row>
          <Row label="Address"><TextField value={p.addressLine} onChange={(v) => set('addressLine', v)} /></Row>
          <Row label="City"><TextField value={p.city} onChange={(v) => set('city', v)} /></Row>
          <Row label="Country"><TextField value={p.country} onChange={(v) => set('country', v)} /></Row>
        </div>
      </Card>
    </>
  );
}

// ── Users & Roles ───────────────────────────────────────────────

function UsersTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const [draft, setDraft] = useState<UserAccount>({
    id: '', name: '', email: '', role: 'Recruiter', status: 'invited',
    createdAt: new Date().toISOString()
  });

  function add() {
    if (!draft.name.trim() || !draft.email.trim()) return;
    const u: UserAccount = { ...draft, id: uid() };
    patch({ ...settings, users: [u, ...settings.users] }, 'invited_user', u.email);
    setDraft({ ...draft, name: '', email: '' });
  }

  function remove(id: string) {
    const u = settings.users.find((x) => x.id === id);
    patch({ ...settings, users: settings.users.filter((x) => x.id !== id) }, 'removed_user', u?.email || id);
  }

  function update(id: string, fields: Partial<UserAccount>) {
    patch(
      { ...settings, users: settings.users.map((u) => (u.id === id ? { ...u, ...fields } : u)) },
      'updated_user',
      id
    );
  }

  return (
    <>
      <Card title="Invite User">
        <div className="grid grid-cols-4 gap-2">
          <TextField value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Full name" />
          <TextField value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="email@company.com" type="email" />
          <select
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value as UserAccount['role'] })}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="Admin">Admin</option>
            <option value="Recruiter">Recruiter</option>
            <option value="Hiring Manager">Hiring Manager</option>
            <option value="Viewer">Viewer</option>
          </select>
          <button
            onClick={add}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={13} /> Invite
          </button>
        </div>
      </Card>

      <Card title={`Team (${settings.users.length})`}>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2 text-start">Name</th>
              <th className="py-2 text-start">Email</th>
              <th className="py-2 text-start">Role</th>
              <th className="py-2 text-start">Status</th>
              <th className="py-2 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {settings.users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 text-slate-800 dark:text-slate-100">{u.name}</td>
                <td className="py-2 text-slate-600 dark:text-slate-300">{u.email}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={(e) => update(u.id, { role: e.target.value as UserAccount['role'] })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Recruiter">Recruiter</option>
                    <option value="Hiring Manager">Hiring Manager</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </td>
                <td className="py-2">
                  <select
                    value={u.status}
                    onChange={(e) => update(u.id, { status: e.target.value as UserAccount['status'] })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="invited">Invited</option>
                  </select>
                </td>
                <td className="py-2 text-end">
                  <button
                    onClick={() => remove(u.id)}
                    className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ── Notifications ───────────────────────────────────────────────

function NotificationsTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const n = settings.notifications;
  function set<K extends keyof typeof n>(key: K, val: (typeof n)[K]) {
    patch({ ...settings, notifications: { ...n, [key]: val } }, 'updated_notifications', String(key));
  }
  return (
    <Card title="Email & In-App">
      <div className="grid grid-cols-2 gap-2">
        <Toggle on={n.emailNewCandidate}      onChange={(v) => set('emailNewCandidate', v)}      label="Email me when a new candidate is added" />
        <Toggle on={n.emailInterviewReminder} onChange={(v) => set('emailInterviewReminder', v)} label="Interview reminders by email" />
        <Toggle on={n.emailOfferStatus}       onChange={(v) => set('emailOfferStatus', v)}       label="Offer accepted / declined alerts" />
        <Toggle on={n.inAppMentions}          onChange={(v) => set('inAppMentions', v)}          label="In-app mentions and comments" />
        <Toggle on={n.dailyDigest}            onChange={(v) => set('dailyDigest', v)}            label="Daily digest summary" />
      </div>
    </Card>
  );
}

// ── Integrations ────────────────────────────────────────────────

function IntegrationsTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const webhook = settings.intakeWebhook || { url: '', enabled: false };
  function setWebhook(next: Partial<typeof webhook>) {
    patch({ ...settings, intakeWebhook: { ...webhook, ...next } }, 'updated_intake_webhook', '');
  }
  return (
    <>
      <Card title="Candidate Intake Webhook">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          When the public intake form is submitted, the ATS will POST a JSON payload to this URL so n8n,
          Zapier, or your own automation can pick it up. Leave disabled to skip the call.
        </p>
        <div className="grid grid-cols-12 gap-2 items-center">
          <label className="col-span-12 sm:col-span-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Webhook URL</label>
          <input
            value={webhook.url}
            onChange={(e) => setWebhook({ url: e.target.value })}
            placeholder="https://n8n.example.com/webhook/ats-intake"
            className="col-span-12 sm:col-span-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            onClick={() => setWebhook({ enabled: !webhook.enabled })}
            className={`col-span-12 sm:col-span-2 rounded-lg px-3 py-2 text-xs font-semibold ${
              webhook.enabled
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {webhook.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="mt-2 text-[10px] text-slate-400">
          Payload shape: <code>{`{ type:"ats.intake_submitted", company, jobId, candidate, intake }`}</code>
        </div>
      </Card>

      <Card title="About External Integrations">
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          The ATS runs entirely in your browser, so it can't directly connect to LinkedIn, Indeed, Gmail,
          Outlook, Google Calendar, Zoom, Teams, or BambooHR — those require server-side OAuth + token
          storage. The recommended path is to use the <strong>Candidate Intake Webhook</strong> above and
          wire those services in <code>n8n</code> or <code>Zapier</code>:
        </p>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-[11px] text-slate-500 dark:text-slate-400">
          <li>Intake submitted → webhook fires → n8n posts to Slack, creates a Trello card, writes a row to Google Sheets, etc.</li>
          <li>n8n on-receive → cron-poll Gmail / Outlook for new resume mail → POST a normalised candidate record to your hosted ATS API.</li>
          <li>n8n on-schedule → query your candidate list nightly → push reminders to WhatsApp / Email.</li>
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          If you add a server later, the OAuth integration cards can come back — until then, they're omitted
          to avoid showing controls that don't do anything.
        </p>
      </Card>
    </>
  );
}

// ── Appearance ──────────────────────────────────────────────────

function AppearanceTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const { theme, toggleTheme, lang, setLang } = useUi();
  const a = settings.appearance;
  function set<K extends keyof typeof a>(key: K, val: (typeof a)[K]) {
    patch({ ...settings, appearance: { ...a, [key]: val } }, 'updated_appearance', String(key));
  }
  return (
    <>
      <Card title="Theme">
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-slate-700 dark:text-slate-200"
        >
          Current: {theme === 'dark' ? 'Dark' : 'Light'} (click to toggle)
        </button>
      </Card>
      <Card title="Language">
        <div className="flex gap-2">
          <button
            onClick={() => setLang('en')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${lang === 'en' ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
          >English</button>
          <button
            onClick={() => setLang('ar')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${lang === 'ar' ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
          >العربية</button>
        </div>
      </Card>
      <Card title="Density">
        <div className="flex gap-2">
          {(['compact', 'comfortable'] as const).map((d) => (
            <button
              key={d}
              onClick={() => set('density', d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${a.density === d ? 'bg-brand-500 text-white' : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
            >{d}</button>
          ))}
        </div>
      </Card>
      <Card title="Accent Color">
        <input type="color" value={a.accent} onChange={(e) => set('accent', e.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 dark:border-slate-700" />
      </Card>
    </>
  );
}

// ── Security ────────────────────────────────────────────────────

function SecurityTab({ settings, patch }: { settings: CompanySettings; patch: (s: CompanySettings, action?: string, target?: string) => void }) {
  const s = settings.security;
  function set<K extends keyof typeof s>(key: K, val: (typeof s)[K]) {
    patch({ ...settings, security: { ...s, [key]: val } }, 'updated_security', String(key));
  }
  return (
    <>
      <Card title="Access">
        <div className="grid grid-cols-2 gap-2">
          <Toggle on={s.mfaRequired} onChange={(v) => set('mfaRequired', v)} label="Require multi-factor authentication" />
        </div>
      </Card>
      <Card title="Policies">
        <div className="grid grid-cols-2 gap-3">
          <Row label="Session Timeout (minutes)">
            <TextField value={String(s.sessionTimeoutMinutes)} onChange={(v) => set('sessionTimeoutMinutes', Math.max(5, parseInt(v) || 0))} type="number" />
          </Row>
          <Row label="Minimum Password Length">
            <TextField value={String(s.passwordMinLength)} onChange={(v) => set('passwordMinLength', Math.max(6, parseInt(v) || 0))} type="number" />
          </Row>
        </div>
      </Card>
      <Card title="IP Allow-list">
        <TextField
          value={s.ipAllowlist.join(', ')}
          onChange={(v) => set('ipAllowlist', v.split(',').map((x) => x.trim()).filter(Boolean))}
          placeholder="10.0.0.0/8, 192.168.1.1 (comma separated, empty = allow all)"
        />
      </Card>
    </>
  );
}

// ── Audit Log ───────────────────────────────────────────────────

function AuditTab({ settings }: { settings: CompanySettings }) {
  const rows = useMemo(() => settings.audit.slice(0, 100), [settings.audit]);
  return (
    <Card title={`Recent Activity (${settings.audit.length})`}>
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">No audit events recorded yet.</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-2 text-start">When</th>
              <th className="py-2 text-start">Actor</th>
              <th className="py-2 text-start">Action</th>
              <th className="py-2 text-start">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 text-slate-600 dark:text-slate-300">{new Date(r.at).toLocaleString()}</td>
                <td className="py-2 text-slate-800 dark:text-slate-100">{r.actor}</td>
                <td className="py-2 text-slate-700 dark:text-slate-200">{r.action}</td>
                <td className="py-2 text-slate-500 dark:text-slate-400">{r.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ── Backup ──────────────────────────────────────────────────────

function BackupTab({
  settings, setSettings, onToast
}: { settings: CompanySettings; setSettings: (s: CompanySettings) => void; onToast: (m: string, t?: any) => void }) {
  function exportAll() {
    const dump = {
      version: 1,
      exportedAt: new Date().toISOString(),
      ats: localStorage.getItem('recruitment_ats_v1'),
      company: localStorage.getItem('recruitment_ats_company_v1')
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ats-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Backup downloaded', 'success');
  }

  function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.ats) localStorage.setItem('recruitment_ats_v1', parsed.ats);
        if (parsed.company) localStorage.setItem('recruitment_ats_company_v1', parsed.company);
        onToast('Backup restored — reload to apply', 'success');
      } catch (err) {
        onToast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Card title="Export Backup">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Download all candidates, jobs, interviews, offers and company settings as a single JSON file.
        </p>
        <button
          onClick={exportAll}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Download size={13} /> Download Backup
        </button>
      </Card>
      <Card title="Restore Backup">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          Restore a previously exported backup file. Existing data will be replaced.
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-brand-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
          <Upload size={13} /> Restore from File
          <input type="file" accept="application/json" onChange={importBackup} className="hidden" />
        </label>
      </Card>
    </>
  );
}
