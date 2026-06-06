import { useMemo, useState } from 'react';
import {
  X, ArrowRight, CheckCircle2, AlertTriangle, Users
} from 'lucide-react';
import type { Candidate, IntakeData } from '../lib/types';
import { useUi } from '../lib/uiContext';
import { findDuplicates } from '../lib/dedup';
import { getInitials, avatarColor, formatDate } from '../lib/utils';

interface Props {
  /** Either two candidates (direct pair merge) or one with auto-find. */
  primary: Candidate;
  secondary?: Candidate | null;
  candidates: Candidate[];
  onMerge: (merged: Candidate, removeId: string) => void;
  onClose: () => void;
}

// What scalar fields the recruiter can choose from
type ScalarKey =
  | 'personal.full_name' | 'personal.email' | 'personal.phone'
  | 'personal.location'  | 'personal.city'  | 'personal.country'
  | 'personal.nationality' | 'personal.gender' | 'personal.date_of_birth'
  | 'personal.marital_status' | 'personal.linkedin' | 'personal.website'
  | 'current_title' | 'total_experience_years' | 'expected_salary'
  | 'notice_period' | 'visa_status' | 'professional_summary'
  | 'jobId' | 'source' | 'stage' | 'ai_score';

const SCALAR_LABEL_KEYS: Record<ScalarKey, string> = {
  'personal.full_name': 'field.fullNameReq',
  'personal.email': 'field.email',
  'personal.phone': 'field.phone',
  'personal.location': 'field.locationFull',
  'personal.city': 'field.city',
  'personal.country': 'field.country',
  'personal.nationality': 'field.nationality',
  'personal.gender': 'field.gender',
  'personal.date_of_birth': 'field.dob',
  'personal.marital_status': 'field.maritalStatus',
  'personal.linkedin': 'field.linkedin',
  'personal.website': 'field.website',
  'current_title': 'field.currentTitle',
  'total_experience_years': 'field.expYears',
  'expected_salary': 'field.expectedSalary',
  'notice_period': 'field.noticePeriod',
  'visa_status': 'field.visaStatus',
  'professional_summary': 'field.summary',
  'jobId': 'field.jobLinked',
  'source': 'field.source',
  'stage': 'field.stage',
  'ai_score': 'field.aiScore'
};

function get(c: Candidate, key: ScalarKey): string {
  const [a, b] = key.split('.') as ['personal' | 'top', string];
  if (a === 'personal') return String((c.personal as any)[b] ?? '');
  return String((c as any)[key] ?? '');
}

function setVal(c: Candidate, key: ScalarKey, value: string): Candidate {
  const parts = key.split('.');
  if (parts.length === 1) {
    const k = parts[0] as keyof Candidate;
    return { ...c, [k]: ['total_experience_years', 'ai_score'].includes(parts[0]) ? Number(value) || 0 : value } as Candidate;
  }
  // personal.<field>
  return { ...c, personal: { ...c.personal, [parts[1]]: value } };
}

function dedupArr<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function unionStrings(a: string[] = [], b: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...a, ...b]) {
    const k = s.trim().toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(s.trim());
    }
  }
  return out;
}

/** Pick the richer (most truthy) intake record. */
function pickIntake(a: IntakeData | undefined, b: IntakeData | undefined): IntakeData | undefined {
  if (!a) return b;
  if (!b) return a;
  // Whichever has the later submittedAt wins, but union skills.
  const newer = (a.submittedAt || '') >= (b.submittedAt || '') ? a : b;
  const older = newer === a ? b : a;
  return {
    ...newer,
    skills: unionStrings(newer.skills, older.skills)
  };
}

export default function MergeCandidatesModal({
  primary, secondary, candidates, onMerge, onClose
}: Props) {
  const { t } = useUi();
  const candidates_without_primary = useMemo(
    () => candidates.filter((c) => c.id !== primary.id),
    [candidates, primary.id]
  );
  const detected = useMemo(
    () => findDuplicates(primary, candidates_without_primary),
    [primary, candidates_without_primary]
  );

  const [B, setB] = useState<Candidate | null>(secondary ?? detected[0]?.match ?? null);

  // For each scalar field, true → use primary's value, false → use B's
  const [usePrimary, setUsePrimary] = useState<Partial<Record<ScalarKey, boolean>>>({});

  // When B changes, default each field's pick to "whichever is non-empty / longer"
  const defaultPick = useMemo<Partial<Record<ScalarKey, boolean>>>(() => {
    if (!B) return {};
    const m: Partial<Record<ScalarKey, boolean>> = {};
    (Object.keys(SCALAR_LABEL_KEYS) as ScalarKey[]).forEach((k) => {
      const pv = get(primary, k);
      const bv = get(B, k);
      if (!pv && bv) m[k] = false;
      else if (pv && !bv) m[k] = true;
      else if (bv.length > pv.length) m[k] = false;
      else m[k] = true;
    });
    return m;
  }, [primary, B]);

  const picks: Partial<Record<ScalarKey, boolean>> = { ...defaultPick, ...usePrimary };

  if (!B) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
        <div className="w-full max-w-md rounded-xl bg-white p-5 text-center shadow-2xl dark:bg-slate-900">
          <Users size={32} className="mx-auto mb-2 text-slate-400" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('merge.noDuplicate', { name: primary.personal.full_name || primary.personal.email })}
          </div>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  function buildMerged(): Candidate {
    let merged = { ...primary };
    (Object.keys(SCALAR_LABEL_KEYS) as ScalarKey[]).forEach((k) => {
      const fromPrimary = picks[k] !== false; // default true if undefined
      const value = fromPrimary ? get(primary, k) : get(B!, k);
      merged = setVal(merged, k, value);
    });

    // Arrays / nested are always unioned
    merged.skills = {
      technical: unionStrings(primary.skills.technical, B!.skills.technical),
      soft:      unionStrings(primary.skills.soft,      B!.skills.soft),
      languages: unionStrings(primary.skills.languages, B!.skills.languages),
      tools:     unionStrings(primary.skills.tools,     B!.skills.tools),
      certifications: unionStrings(primary.skills.certifications, B!.skills.certifications)
    };

    merged.work_experience = dedupArr(
      [...(primary.work_experience || []), ...(B!.work_experience || [])],
      (e) => `${(e.company || '').toLowerCase()}::${(e.title || '').toLowerCase()}::${(e.start_date || '')}`
    );
    merged.education = dedupArr(
      [...(primary.education || []), ...(B!.education || [])],
      (e) => `${(e.institution || '').toLowerCase()}::${(e.degree || '').toLowerCase()}::${(e.end_year || '')}`
    );
    merged.certifications = dedupArr(
      [...(primary.certifications || []), ...(B!.certifications || [])],
      (c) => `${(c.name || '').toLowerCase()}::${(c.issuer || '').toLowerCase()}`
    );
    merged.projects = dedupArr(
      [...(primary.projects || []), ...(B!.projects || [])],
      (p) => (p.name || '').toLowerCase()
    );
    merged.awards = unionStrings(primary.awards as any, B!.awards as any) as any;
    merged.publications = unionStrings(primary.publications as any, B!.publications as any) as any;

    // Notes — concatenate
    const notesA = (primary.notes || '').trim();
    const notesB = (B!.notes || '').trim();
    merged.notes = notesA && notesB && notesA !== notesB ? `${notesA}\n\n— from duplicate —\n${notesB}` : (notesA || notesB);

    // AI strengths / concerns / recommended_roles unioned
    merged.ai_strengths = unionStrings(primary.ai_strengths, B!.ai_strengths);
    merged.ai_concerns  = unionStrings(primary.ai_concerns, B!.ai_concerns);
    merged.recommended_roles = unionStrings(primary.recommended_roles, B!.recommended_roles);

    // Intake — whichever has the later submission, with unioned skills
    merged.intake = pickIntake(primary.intake, B!.intake);

    // omanization_eligible — sticky if either says yes
    merged.omanization_eligible = !!(primary.omanization_eligible || B!.omanization_eligible);

    // Keep primary's id + uploadedAt, but record source of merge in source if it changed
    return merged;
  }

  function confirmMerge() {
    if (!B) return;
    const aName = primary.personal.full_name || primary.personal.email || primary.id.slice(0, 6);
    const bName = B.personal.full_name || B.personal.email || B.id.slice(0, 6);
    if (!confirm(t('merge.confirmTitle', { a: aName, b: bName }) + '\n\n' + t('merge.confirmBody'))) return;
    onMerge(buildMerged(), B.id);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">{t('merge.title')}</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('merge.subtitle')}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        {/* Detected duplicates picker */}
        {detected.length > 0 && (
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('merge.pickDup')}
            </div>
            <div className="flex flex-wrap gap-2">
              {detected.map((d) => (
                <button
                  key={d.match.id}
                  onClick={() => { setB(d.match); setUsePrimary({}); }}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                    B && B.id === d.match.id
                      ? 'border-brand-500 bg-blue-50 text-brand-500 font-semibold dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: avatarColor(d.match.personal.full_name) }}>
                    {getInitials(d.match.personal.full_name)}
                  </div>
                  <span className="truncate max-w-[12rem]">{d.match.personal.full_name || d.match.personal.email}</span>
                  <span className="rounded-full bg-amber-50 px-1.5 text-[9.5px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{Math.round(d.confidence * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Side-by-side header */}
        <div className="grid grid-cols-12 border-b border-slate-100 px-5 py-3 text-[10.5px] font-bold uppercase tracking-wider dark:border-slate-800">
          <div className="col-span-3 text-slate-500 dark:text-slate-400">{t('merge.fieldsHeader')}</div>
          <div className="col-span-4 text-emerald-700 dark:text-emerald-300">{t('merge.primary')}</div>
          <div className="col-span-1 text-center"><ArrowRight size={11} className="mx-auto text-slate-400" /></div>
          <div className="col-span-4 text-rose-700 dark:text-rose-300">{t('merge.secondary')}</div>
        </div>

        {/* Field rows */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {(Object.keys(SCALAR_LABEL_KEYS) as ScalarKey[]).map((k) => {
            const pv = get(primary, k);
            const bv = get(B, k);
            if (!pv && !bv) return null;
            const fromPrimary = picks[k] !== false;
            return (
              <div key={k} className="grid grid-cols-12 items-center gap-2 border-b border-slate-50 py-1.5 dark:border-slate-800/60">
                <div className="col-span-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">{t(SCALAR_LABEL_KEYS[k])}</div>
                <label className={`col-span-4 flex cursor-pointer items-start gap-1.5 rounded-md border px-2 py-1 text-[11px] ${fromPrimary ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30' : 'border-transparent'}`}>
                  <input
                    type="radio"
                    name={k}
                    checked={fromPrimary}
                    onChange={() => setUsePrimary((p) => ({ ...p, [k]: true }))}
                    className="mt-0.5 h-3 w-3 accent-brand-500"
                  />
                  <span className={`flex-1 break-words ${pv ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 italic'}`}>
                    {pv || '—'}
                  </span>
                </label>
                <div className="col-span-1 text-center text-[10px] text-slate-300">↔</div>
                <label className={`col-span-4 flex cursor-pointer items-start gap-1.5 rounded-md border px-2 py-1 text-[11px] ${!fromPrimary ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/30' : 'border-transparent'}`}>
                  <input
                    type="radio"
                    name={k}
                    checked={!fromPrimary}
                    onChange={() => setUsePrimary((p) => ({ ...p, [k]: false }))}
                    className="mt-0.5 h-3 w-3 accent-brand-500"
                  />
                  <span className={`flex-1 break-words ${bv ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 italic'}`}>
                    {bv || '—'}
                  </span>
                </label>
              </div>
            );
          })}

          {/* Auto-merged summary */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <CheckCircle2 size={11} /> Auto-merged
            </div>
            <ul className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
              <li>• Skills / tools / soft skills / languages / certifications — unioned</li>
              <li>• Work experience + education + projects — unioned and de-duplicated</li>
              <li>• Notes — concatenated</li>
              <li>• AI strengths / concerns / recommended roles — unioned</li>
              <li>• Intake form data — whichever was submitted later (skills unioned)</li>
              <li>• Omanization eligibility — sticky (true if either side is true)</li>
              <li>• Uploaded date: {formatDate(primary.uploadedAt) || primary.uploadedAt} (primary kept)</li>
            </ul>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            {t('merge.confirmBody')}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={confirmMerge}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <CheckCircle2 size={13} />
            {t('merge.button')}
          </button>
        </div>
      </div>
    </div>
  );
}
