import type { Candidate, IntakeData, JobPosting } from './types';

const PENDING_KEY = 'recruitment_ats_intake_pending_v1';

export function emptyIntake(): IntakeData {
  return {
    submittedAt: '',
    source: 'intake_form',
    applyingFor: '',
    gender: '',
    nationality: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    totalExperienceYears: 0,
    currentLocation: '',
    skills: [],
    availability: '',
    confirmRelocateOman: false,
    confirmGccExperience: false,
    confirmValidPassport: false
  };
}

/**
 * Build a public pre-filled intake URL relative to the current app origin.
 * Prefers the clean /ats-jobform path; falls back to ?intake=1 on the root
 * when running locally (e.g. dev server at http://localhost:5174/).
 * `extra` is an arbitrary key→value map appended as URL params (email, name, jobId, token, …).
 */
export function buildIntakeUrl(extra: Record<string, string | undefined>): string {
  const origin = window.location.origin;
  const params = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  // Dev / local: keep ?intake=1 because Vite's dev server doesn't SPA-fallback custom paths.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin);
  if (isLocal) {
    params.set('intake', '1');
    return `${origin}/?${params.toString()}`;
  }
  return `${origin}/ats-jobform${params.toString() ? '?' + params.toString() : ''}`;
}

/** WhatsApp deep-link with an editable message template. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** mailto: link with subject + body. */
export function buildMailtoUrl(email: string, subject: string, body: string): string {
  if (!email) return '';
  const q = new URLSearchParams({ subject, body }).toString();
  return `mailto:${email}?${q}`;
}

export function intakeMessageTemplate(args: {
  name: string;
  companyName: string;
  jobTitle?: string;
  url: string;
}): string {
  const greet = args.name ? `Hi ${args.name},` : 'Hi,';
  const role = args.jobTitle ? ` for the ${args.jobTitle} position` : '';
  return [
    greet,
    '',
    `Thanks for applying${role} at ${args.companyName}.`,
    '',
    'To proceed further, please complete your profile:',
    `👉 ${args.url}`,
    '',
    'Profiles with completed details are prioritized for shortlisting.',
    '',
    `Thanks & Regards,`,
    `${args.companyName} Recruitment Team`
  ].join('\n');
}

/**
 * Match candidates by lowercased email (primary) or phone digits (secondary).
 * Returns the first match or null.
 */
export function findCandidateByContact(
  candidates: Candidate[], email: string, phone: string
): Candidate | null {
  const e = (email || '').trim().toLowerCase();
  const p = (phone || '').replace(/\D/g, '').slice(-9);
  for (const c of candidates) {
    if (e && (c.personal.email || '').toLowerCase().trim() === e) return c;
    if (p && (c.personal.phone || '').replace(/\D/g, '').slice(-9) === p) return c;
  }
  return null;
}

// ─── pending-intake queue (used when no live app instance is open) ──

interface PendingIntake {
  intake: IntakeData;
  email: string;
  fullName: string;
  phone: string;
  jobId: string;
  receivedAt: string;
}

export function loadPendingIntakes(): PendingIntake[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingIntake[];
  } catch {
    return [];
  }
}
export function savePendingIntakes(list: PendingIntake[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch {}
}
export function pushPendingIntake(p: PendingIntake) {
  savePendingIntakes([p, ...loadPendingIntakes()].slice(0, 200));
}

// ─── screening flags ───────────────────────────────────────────────

export interface ScreeningFlag {
  id: 'salary_above_max' | 'long_notice' | 'no_relocate' | 'no_passport' | 'no_gcc_exp';
  level: 'info' | 'warn' | 'block';
  label: string;
}

function parseSalary(s: string): number {
  if (!s) return 0;
  const digits = String(s).replace(/[^\d.]/g, '');
  const n = parseFloat(digits);
  return isNaN(n) ? 0 : n;
}

const LONG_NOTICE_DAYS = 60;
const NOTICE_DAYS: Record<string, number> = {
  immediate: 0, '15_days': 15, '30_days': 30, '60_days': 60, '90_days': 90
};

export function computeScreeningFlags(c: Candidate, jobs: JobPosting[]): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];
  const intake = c.intake;
  if (!intake) return flags;
  const job = jobs.find((j) => j.id === c.jobId);
  const expected = parseSalary(intake.expectedSalary);
  if (job && expected > 0 && job.salary_max > 0 && expected > job.salary_max) {
    flags.push({
      id: 'salary_above_max',
      level: 'warn',
      label: `Expected ${intake.expectedSalary} above max ${job.currency || ''} ${job.salary_max}`
    });
  }
  const noticeDays = NOTICE_DAYS[intake.noticePeriod] ?? -1;
  if (noticeDays > LONG_NOTICE_DAYS) {
    flags.push({
      id: 'long_notice',
      level: 'warn',
      label: `Long notice (${noticeDays}d) — low priority`
    });
  }
  if (!intake.confirmRelocateOman) {
    flags.push({
      id: 'no_relocate',
      level: 'info',
      label: 'Not willing to relocate to Oman'
    });
  }
  if (!intake.confirmValidPassport) {
    flags.push({
      id: 'no_passport',
      level: 'block',
      label: 'No valid passport'
    });
  }
  if (!intake.confirmGccExperience) {
    flags.push({
      id: 'no_gcc_exp',
      level: 'info',
      label: 'No GCC / Middle East experience'
    });
  }
  return flags;
}

// ─── intake AI-style summary ──────────────────────────────────────

export function buildIntakeSummary(c: Candidate, jobs: JobPosting[]): string[] {
  const lines: string[] = [];
  const i = c.intake;
  if (!i) return ['No intake data submitted yet.'];
  const job = jobs.find((j) => j.id === c.jobId);
  if (i.applyingFor) lines.push(`Applying for: ${i.applyingFor}.`);
  if (i.nationality) lines.push(`Nationality: ${i.nationality}${i.gender ? ' · ' + i.gender : ''}.`);
  lines.push(`Total experience: ${i.totalExperienceYears} yrs.`);
  if (i.currentSalary) lines.push(`Current salary: ${i.currentSalary}.`);
  if (i.expectedSalary) {
    const expected = parseSalary(i.expectedSalary);
    if (job && expected > 0 && job.salary_max > 0) {
      const fit = expected <= job.salary_max ? '✓ within budget' : '⚠ above budget';
      lines.push(`Expected: ${i.expectedSalary} (${fit}).`);
    } else {
      lines.push(`Expected: ${i.expectedSalary}.`);
    }
  }
  if (i.noticePeriod) lines.push(`Notice: ${i.noticePeriod.replace('_', ' ')}.`);
  const confirms: string[] = [];
  confirms.push(i.confirmRelocateOman ? '✓ Will relocate to Oman' : '✗ Will not relocate');
  confirms.push(i.confirmGccExperience ? '✓ GCC experience' : '✗ No GCC experience');
  confirms.push(i.confirmValidPassport ? '✓ Valid passport' : '✗ No valid passport');
  lines.push(confirms.join(' · '));
  if (i.skills.length > 0) lines.push(`Skills: ${i.skills.slice(0, 6).join(', ')}${i.skills.length > 6 ? '…' : ''}.`);
  return lines;
}
