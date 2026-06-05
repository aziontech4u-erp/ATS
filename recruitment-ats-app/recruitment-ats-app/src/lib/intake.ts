import type { Candidate, IntakeData, JobPosting } from './types';

const PENDING_KEY = 'recruitment_ats_intake_pending_v1';

export function emptyIntake(): IntakeData {
  return {
    submittedAt: '',
    source: 'intake_form',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    totalExperienceYears: 0,
    relevantExperienceYears: 0,
    willingToRelocate: false,
    preferredLocations: '',
    currentLocation: '',
    visaStatus: '',
    skills: [],
    availability: ''
  };
}

/**
 * Build a public pre-filled intake URL relative to the current app origin.
 * `extra` is an arbitrary key→value map appended as URL params (email, name, jobId, token, …).
 */
export function buildIntakeUrl(extra: Record<string, string | undefined>): string {
  const base = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/`;
  const params = new URLSearchParams({ intake: '1' });
  Object.entries(extra).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return `${base}?${params.toString()}`;
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
  id: 'salary_above_max' | 'long_notice' | 'no_relocate' | 'no_visa';
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
  if (!intake.willingToRelocate) {
    flags.push({
      id: 'no_relocate',
      level: 'info',
      label: 'Not willing to relocate'
    });
  }
  if (intake.visaStatus.toLowerCase().includes('not eligible') ||
      intake.visaStatus.toLowerCase().includes('no visa')) {
    flags.push({
      id: 'no_visa',
      level: 'block',
      label: `Visa: ${intake.visaStatus}`
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
  lines.push(`Total experience: ${i.totalExperienceYears} yrs (relevant: ${i.relevantExperienceYears} yrs).`);
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
  if (i.visaStatus) lines.push(`Visa: ${i.visaStatus}.`);
  lines.push(i.willingToRelocate ? `Willing to relocate${i.preferredLocations ? ' (prefers ' + i.preferredLocations + ')' : ''}.` : 'Not willing to relocate.');
  if (i.skills.length > 0) lines.push(`Skills: ${i.skills.slice(0, 6).join(', ')}${i.skills.length > 6 ? '…' : ''}.`);
  return lines;
}
