import { useMemo, useState } from 'react';
import {
  Sparkles, Send, CheckCircle2, AlertCircle, Moon, Sun, Globe,
  Mail, Phone, Globe2
} from 'lucide-react';
import { loadState, saveState, uid } from '../lib/storage';
import {
  emptyIntake, findCandidateByContact, pushPendingIntake
} from '../lib/intake';
import { loadCompanySettings } from '../lib/companySettings';
import type { Candidate, IntakeData, NoticePeriod } from '../lib/types';
import { useUi } from '../lib/uiContext';

/**
 * Public intake form. Rendered when the URL has ?intake=1 or path /ats-jobform.
 * Reads pre-fill params from query string: email, name, phone, jobId, applyingFor.
 * On submit:
 *   1. Updates / creates the matching candidate in localStorage
 *   2. POSTs to the configured webhook (if any) for n8n / Zapier
 *   3. Always pushes to a local pending-intakes queue as a safety net
 */
export default function IntakeFormView() {
  const { theme, toggleTheme, lang, setLang } = useUi();
  const company = useMemo(() => loadCompanySettings(), []);
  const companyName = company.profile.name || 'ZIONTECH';
  const companyEmail = company.profile.email || 'admin@zionteck.com';
  const companyPhone = company.profile.phone || '+968 9789 2123';
  const companyWebsite = company.profile.website || 'www.zionteck.com';
  const logo = company.profile.logoDataUrl;

  // Pre-fill from URL
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      email: sp.get('email') || '',
      name: sp.get('name') || '',
      phone: sp.get('phone') || '',
      jobId: sp.get('jobId') || '',
      applyingFor: sp.get('applyingFor') || '',
      token: sp.get('token') || ''
    };
  }, []);

  const job = useMemo(() => {
    if (!params.jobId) return null;
    const st = loadState();
    return st.jobs.find((j) => j.id === params.jobId) || null;
  }, [params.jobId]);

  const [fullName, setFullName] = useState(params.name);
  const [email, setEmail] = useState(params.email);
  const [phone, setPhone] = useState(params.phone);
  const initial = emptyIntake();
  initial.applyingFor = params.applyingFor || job?.title || '';
  const [data, setData] = useState<IntakeData>(initial);
  const [skillsRaw, setSkillsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setData((p) => ({ ...p, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!fullName.trim() || !email.trim()) {
      setErr('Name and email are required.');
      return;
    }
    if (!data.applyingFor.trim()) { setErr('Applying Job for is required.'); return; }
    if (!data.gender) { setErr('Gender is required.'); return; }
    if (!data.nationality.trim()) { setErr('Nationality is required.'); return; }
    if (!data.availability.trim()) { setErr('Availability is required.'); return; }
    if (!data.confirmRelocateOman || !data.confirmGccExperience || !data.confirmValidPassport) {
      setErr('All three confirmation items are required.');
      return;
    }
    setSubmitting(true);
    const intake: IntakeData = {
      ...data,
      submittedAt: new Date().toISOString(),
      source: 'intake_form',
      skills: skillsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    };

    // 1. Persist into localStorage candidate record
    try {
      const state = loadState();
      const existing = findCandidateByContact(state.candidates, email, phone);
      if (existing) {
        const patched: Candidate = {
          ...existing,
          personal: {
            ...existing.personal,
            full_name: existing.personal.full_name || fullName,
            email: existing.personal.email || email,
            phone: existing.personal.phone || phone,
            location: existing.personal.location || intake.currentLocation,
            nationality: existing.personal.nationality || intake.nationality,
            gender: existing.personal.gender || intake.gender
          },
          jobId: existing.jobId || params.jobId || '',
          intake,
          notice_period: existing.notice_period || (intake.noticePeriod ? intake.noticePeriod.replace('_', ' ') : ''),
          expected_salary: existing.expected_salary || intake.expectedSalary,
          total_experience_years: existing.total_experience_years || intake.totalExperienceYears,
          skills: {
            ...existing.skills,
            technical: Array.from(new Set([...(existing.skills.technical || []), ...intake.skills]))
          }
        };
        const candidates = state.candidates.map((c) => c.id === existing.id ? patched : c);
        saveState({ ...state, candidates });
      } else {
        const candidate: Candidate = {
          id: uid(),
          filename: 'intake-form',
          fileSize: '0 KB',
          uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          stage: 'applied',
          source: 'Intake Form',
          rawText: '',
          personal: {
            full_name: fullName,
            email,
            phone,
            location: intake.currentLocation,
            city: '', country: '',
            linkedin: '', website: '',
            nationality: intake.nationality,
            gender: intake.gender,
            date_of_birth: '',
            marital_status: ''
          },
          professional_summary: '',
          current_title: intake.applyingFor,
          total_experience_years: intake.totalExperienceYears,
          skills: { technical: intake.skills, soft: [], languages: [], tools: [], certifications: [] },
          work_experience: [],
          education: [],
          certifications: [],
          projects: [],
          awards: [],
          publications: [],
          volunteer: [],
          visa_status: '',
          notice_period: intake.noticePeriod ? intake.noticePeriod.replace('_', ' ') : '',
          expected_salary: intake.expectedSalary,
          ai_score: 60,
          ai_strengths: [],
          ai_concerns: [],
          recommended_roles: [],
          omanization_eligible: false,
          jobId: params.jobId || '',
          intake
        };
        saveState({ ...state, candidates: [candidate, ...state.candidates] });
      }
    } catch (e2) {
      console.warn('local save failed', e2);
    }

    // 2. Optional webhook POST (n8n / Zapier)
    const webhook = company.intakeWebhook;
    if (webhook?.enabled && webhook.url) {
      try {
        await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ats.intake_submitted',
            company: companyName,
            jobId: params.jobId,
            token: params.token,
            candidate: { fullName, email, phone },
            intake
          })
        });
      } catch (e3) {
        console.warn('webhook failed (non-blocking)', e3);
      }
    }

    // 3. Pending queue (always)
    pushPendingIntake({
      intake,
      email, fullName, phone,
      jobId: params.jobId,
      receivedAt: new Date().toISOString()
    });

    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Profile Submitted</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Thanks {fullName.split(' ')[0] || ''} — your details have been received. The {companyName} recruitment team will review and reach out shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Top utility toolbar */}
      <div className="mx-auto mb-3 flex max-w-2xl items-center justify-end gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Globe size={12} />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>

      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-2xl rounded-2xl border border-blue-100 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="logo" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-700 text-sm font-bold text-white">
                {companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {companyName} [ATS] - Job Form
              </h1>
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <Sparkles size={10} /> Complete your application{job ? ` for ${job.title}` : ''}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            This information helps us match you faster with the right opportunity. Profiles with complete
            details are prioritised for shortlisting. Fields marked <span className="text-rose-500 font-semibold">*</span> are required.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <Section title="Position">
            <Grid>
              <Field label="Applying Job for *">
                <Input value={data.applyingFor} onChange={(v) => set('applyingFor', v)} placeholder="e.g. Senior Banking Officer" required />
              </Field>
              <Field label="Availability for Interview *">
                <Input value={data.availability} onChange={(v) => set('availability', v)} placeholder="Weekdays after 5pm" required />
              </Field>
            </Grid>
          </Section>

          <Section title="Contact">
            <Grid>
              <Field label="Full Name *"><Input value={fullName} onChange={setFullName} placeholder="Full Name" required /></Field>
              <Field label="Email *"><Input value={email} onChange={setEmail} type="email" placeholder="name@example.com" required /></Field>
              <Field label="Phone (WhatsApp)"><Input value={phone} onChange={setPhone} placeholder="+968 ..." /></Field>
              <Field label="Current Location"><Input value={data.currentLocation} onChange={(v) => set('currentLocation', v)} placeholder="City, Country" /></Field>
            </Grid>
          </Section>

          <Section title="Personal">
            <Grid>
              <Field label="Gender *">
                <Select value={data.gender} onChange={(v) => set('gender', v)} required>
                  <option value="">— Select —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </Field>
              <Field label="Nationality *">
                <Input value={data.nationality} onChange={(v) => set('nationality', v)} placeholder="e.g. Indian / Omani / Filipino" required />
              </Field>
            </Grid>
          </Section>

          <Section title="Compensation">
            <Grid>
              <Field label="Current Salary"><Input value={data.currentSalary} onChange={(v) => set('currentSalary', v)} placeholder="OMR 800" /></Field>
              <Field label="Expected Salary"><Input value={data.expectedSalary} onChange={(v) => set('expectedSalary', v)} placeholder="OMR 1200" /></Field>
            </Grid>
          </Section>

          <Section title="Experience">
            <Grid>
              <Field label="Total Experience (years)">
                <Input value={String(data.totalExperienceYears)} onChange={(v) => set('totalExperienceYears', parseInt(v) || 0)} type="number" />
              </Field>
              <Field label="Notice Period">
                <Select value={data.noticePeriod} onChange={(v) => set('noticePeriod', v as NoticePeriod)}>
                  <option value="">— Select —</option>
                  <option value="immediate">Immediate</option>
                  <option value="15_days">15 days</option>
                  <option value="30_days">30 days</option>
                  <option value="60_days">60 days</option>
                  <option value="90_days">90 days</option>
                </Select>
              </Field>
              <Field label="Skills (comma separated)">
                <Input value={skillsRaw} onChange={setSkillsRaw} placeholder="React, Node.js, SQL, Banking, Audit" />
              </Field>
            </Grid>
          </Section>

          <Section title="Confirmation *">
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                Please confirm the following. All three are required.
              </p>
              <ConfirmCheckbox
                checked={data.confirmRelocateOman}
                onChange={(v) => set('confirmRelocateOman', v)}
                label="Willing to relocate to OMAN / Muscat"
              />
              <ConfirmCheckbox
                checked={data.confirmGccExperience}
                onChange={(v) => set('confirmGccExperience', v)}
                label="GCC / Middle East Working Experience"
              />
              <ConfirmCheckbox
                checked={data.confirmValidPassport}
                onChange={(v) => set('confirmValidPassport', v)}
                label="Valid Passport"
              />
            </div>
          </Section>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            <Send size={14} />
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>

          <div className="text-center text-[11px] text-slate-400">
            By submitting, you agree the recruitment team may contact you about this and similar opportunities.
          </div>
        </div>

        {/* Footer with company contact */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-600 sm:grid-cols-3 dark:text-slate-300">
            <a href={`mailto:${companyEmail}`} className="flex items-center gap-1.5 hover:text-brand-500 dark:hover:text-blue-300">
              <Mail size={11} /> {companyEmail}
            </a>
            <a href={`https://wa.me/${companyPhone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-brand-500 dark:hover:text-blue-300">
              <Phone size={11} /> {companyPhone}
            </a>
            <a href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-brand-500 dark:hover:text-blue-300">
              <Globe2 size={11} /> {companyWebsite}
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── form primitives ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-500 dark:text-blue-300">{title}</div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
function Input(props: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <input
      type={props.type || 'text'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      required={props.required}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
  );
}
function Select({ value, onChange, children, required }: { value: string; onChange: (v: string) => void; children: React.ReactNode; required?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      {children}
    </select>
  );
}
function ConfirmCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-slate-800/60">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-500"
      />
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  );
}
