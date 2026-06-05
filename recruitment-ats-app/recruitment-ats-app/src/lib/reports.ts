import type { Candidate, Interview, JobPosting, OfferLetter, Stage } from './types';

export type ReportId =
  | 'pipeline_funnel'
  | 'job_applications'
  | 'source_of_hire'
  | 'recruiter_performance'
  | 'interview_status'
  | 'offer_vs_acceptance'
  | 'time_to_hire'
  | 'time_to_fill'
  | 'nationality'
  | 'gender_diversity'
  | 'skill_based'
  | 'rejected_analysis'
  | 'active_vs_closed_jobs'
  | 'duplicate_detection'
  | 'ai_summary_insights';

export type ReportCategory = 'pipeline' | 'jobs' | 'people' | 'time' | 'quality' | 'ai';

export type ReportRole = 'admin' | 'recruiter' | 'demo';

export interface ReportFilters {
  fromDate: string;            // YYYY-MM-DD or ''
  toDate: string;              // YYYY-MM-DD or ''
  jobId: string;               // job id or ''
  recruiter: string;           // recruiter name/email or ''
  status: Stage | '';
  location: string;
  nationality: string;
  gender: string;
  skill: string;
}

export const EMPTY_FILTERS: ReportFilters = {
  fromDate: '', toDate: '', jobId: '', recruiter: '', status: '',
  location: '', nationality: '', gender: '', skill: ''
};

export type ChartKind = 'bar' | 'pie' | 'funnel' | 'none';

export interface ChartSeries {
  kind: ChartKind;
  data: { label: string; value: number; color?: string }[];
  title?: string;
}

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
}

export interface ReportResult {
  rows: Record<string, string | number>[];
  columns: ReportColumn[];
  chart: ChartSeries;
  insights: string[];           // short AI-style bullets
  drillKey?: string;            // column key whose cell, when clicked, drills to a candidate id
}

export interface ReportSource {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
}

export interface ReportDef {
  id: ReportId;
  name: string;
  category: ReportCategory;
  description: string;
  /** Roles allowed to even see the toggle / report. */
  roles: ReportRole[];
  /** Default-enabled when first loaded. */
  defaultEnabled: boolean;
  compute: (src: ReportSource, f: ReportFilters) => ReportResult;
}

// ─── filter helpers ────────────────────────────────────────────────

function inDateRange(iso: string, f: ReportFilters): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return true;
  if (f.fromDate) {
    const from = new Date(f.fromDate).getTime();
    if (t < from) return false;
  }
  if (f.toDate) {
    const to = new Date(f.toDate).getTime() + 24 * 3600 * 1000 - 1;
    if (t > to) return false;
  }
  return true;
}

function candidateMatches(c: Candidate, f: ReportFilters): boolean {
  if (f.jobId && c.jobId !== f.jobId) return false;
  if (f.status && c.stage !== f.status) return false;
  if (f.location) {
    const loc = (c.personal.location || c.personal.city || c.personal.country || '').toLowerCase();
    if (!loc.includes(f.location.toLowerCase())) return false;
  }
  if (f.nationality) {
    const n = (c.personal.nationality || '').toLowerCase();
    if (n !== f.nationality.toLowerCase()) return false;
  }
  if (f.gender) {
    const g = (c.personal.gender || '').toLowerCase();
    if (g !== f.gender.toLowerCase()) return false;
  }
  if (f.skill) {
    const skills = [...(c.skills.technical || []), ...(c.skills.tools || [])].map((s) => s.toLowerCase());
    if (!skills.includes(f.skill.toLowerCase())) return false;
  }
  return true;
}

function parseDate(s: string): number | null {
  if (!s) return null;
  // try ISO first
  const t = Date.parse(s);
  if (!isNaN(t)) return t;
  // dd-mmm-yyyy / dd Mmm yyyy etc.
  const m = s.match(/(\d{1,2})[\s\-\/]([A-Za-z]{3,})[\s\-\/](\d{2,4})/);
  if (m) {
    const t2 = Date.parse(`${m[1]} ${m[2]} ${m[3]}`);
    if (!isNaN(t2)) return t2;
  }
  return null;
}

// ─── report definitions ──────────────────────────────────────────

const STAGE_ORDER: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

const COLOR_PALETTE = ['#2756e8', '#7c3aed', '#d97706', '#10b981', '#0f766e', '#dc2626', '#0891b2', '#1d4ed8', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6'];

function paletteAt(i: number): string {
  return COLOR_PALETTE[i % COLOR_PALETTE.length];
}

export const REPORT_DEFS: ReportDef[] = [
  // 1. Pipeline funnel
  {
    id: 'pipeline_funnel',
    name: 'Candidate Pipeline Report',
    category: 'pipeline',
    description: 'Stage-wise funnel: Applied → Shortlisted → Interview → Offer → Hired.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const counts: Record<Stage, number> = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 };
      list.forEach((c) => { counts[c.stage]++; });
      const total = list.length || 1;
      const rows = STAGE_ORDER.map((s, i) => ({
        Stage: s.charAt(0).toUpperCase() + s.slice(1),
        Count: counts[s],
        Percentage: `${Math.round((counts[s] / total) * 100)}%`,
        _color: paletteAt(i)
      }));
      const reached = (s: Stage) => list.filter((c) => STAGE_ORDER.indexOf(c.stage) >= STAGE_ORDER.indexOf(s) && c.stage !== 'rejected').length;
      const conv = total > 0 ? Math.round((reached('hired') / total) * 100) : 0;
      return {
        rows: rows.map(({ _color, ...r }) => r),
        columns: [
          { header: 'Stage', key: 'Stage' },
          { header: 'Count', key: 'Count' },
          { header: 'Percentage', key: 'Percentage' }
        ],
        chart: {
          kind: 'funnel',
          title: 'Pipeline Funnel',
          data: rows.filter((r) => r.Stage !== 'Rejected').map((r) => ({ label: r.Stage, value: r.Count, color: r._color }))
        },
        insights: [
          `Overall applied → hired conversion: ${conv}%.`,
          `${counts.interview} candidates currently at interview stage.`,
          counts.rejected > 0 ? `${counts.rejected} candidates rejected to date.` : 'No rejections recorded yet.'
        ]
      };
    }
  },

  // 2. Job-wise applications
  {
    id: 'job_applications',
    name: 'Job-wise Application Report',
    category: 'jobs',
    description: 'How many candidates applied to each job posting.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates, jobs }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const counts = new Map<string, number>();
      list.forEach((c) => counts.set(c.jobId || '__unassigned', (counts.get(c.jobId || '__unassigned') || 0) + 1));
      const rows: Record<string, string | number>[] = jobs.map((j) => ({
        Job: j.title,
        Department: j.department,
        Status: String(j.status),
        Applicants: counts.get(j.id) || 0,
        Openings: j.openings,
        Filled: j.filled
      }));
      const unassigned = counts.get('__unassigned') || 0;
      if (unassigned > 0) rows.push({ Job: '(Unassigned)', Department: '—', Status: '—', Applicants: unassigned, Openings: 0, Filled: 0 });
      const top = [...rows].sort((a, b) => Number(b.Applicants) - Number(a.Applicants)).slice(0, 8);
      return {
        rows,
        columns: [
          { header: 'Job', key: 'Job' },
          { header: 'Department', key: 'Department' },
          { header: 'Status', key: 'Status' },
          { header: 'Applicants', key: 'Applicants' },
          { header: 'Openings', key: 'Openings' },
          { header: 'Filled', key: 'Filled' }
        ],
        chart: {
          kind: 'bar',
          title: 'Applications by Job (top 8)',
          data: top.map((r, i) => ({ label: String(r.Job).slice(0, 22), value: Number(r.Applicants), color: paletteAt(i) }))
        },
        insights: [
          `${jobs.length} job postings tracked, ${jobs.filter((j) => j.status === 'open').length} open.`,
          top[0] ? `Most applications: ${top[0].Job} (${top[0].Applicants}).` : 'No applications recorded.',
          unassigned > 0 ? `${unassigned} candidates not linked to any job.` : 'All candidates are linked to a job.'
        ]
      };
    }
  },

  // 3. Source of hire
  {
    id: 'source_of_hire',
    name: 'Source of Hire Report',
    category: 'jobs',
    description: 'Breakdown of candidate sources: LinkedIn, Referral, Website, etc.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const totals = new Map<string, number>();
      const hires = new Map<string, number>();
      list.forEach((c) => {
        const src = c.source || 'Unknown';
        totals.set(src, (totals.get(src) || 0) + 1);
        if (c.stage === 'hired') hires.set(src, (hires.get(src) || 0) + 1);
      });
      const rows = [...totals.entries()]
        .map(([src, count]) => ({
          Source: src,
          Candidates: count,
          Hires: hires.get(src) || 0,
          'Conv %': count > 0 ? `${Math.round(((hires.get(src) || 0) / count) * 100)}%` : '0%'
        }))
        .sort((a, b) => b.Candidates - a.Candidates);
      return {
        rows,
        columns: [
          { header: 'Source', key: 'Source' },
          { header: 'Candidates', key: 'Candidates' },
          { header: 'Hires', key: 'Hires' },
          { header: 'Conversion', key: 'Conv %' }
        ],
        chart: {
          kind: 'pie',
          title: 'Candidate Source Mix',
          data: rows.map((r, i) => ({ label: r.Source, value: r.Candidates, color: paletteAt(i) }))
        },
        insights: [
          rows[0] ? `Largest source: ${rows[0].Source} (${rows[0].Candidates}).` : 'No source data yet.',
          (() => {
            const best = [...rows].filter((r) => r.Hires > 0).sort((a, b) => parseInt(b['Conv %']) - parseInt(a['Conv %']))[0];
            return best ? `Best converting source: ${best.Source} at ${best['Conv %']}.` : 'No hires recorded.';
          })()
        ]
      };
    }
  },

  // 4. Recruiter performance
  {
    id: 'recruiter_performance',
    name: 'Recruiter Performance Report',
    category: 'people',
    description: 'Interviews and offers handled per interviewer / recruiter.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ interviews, offers }, f) => {
      const ivList = interviews.filter((i) => inDateRange(i.scheduled_at, f));
      const offList = offers.filter((o) => inDateRange(o.sent_date, f));
      const perRec = new Map<string, { interviews: number; completed: number; offersSent: number; accepted: number }>();
      ivList.forEach((iv) => {
        if (f.recruiter && iv.interviewer !== f.recruiter) return;
        const k = iv.interviewer || 'Unassigned';
        const r = perRec.get(k) || { interviews: 0, completed: 0, offersSent: 0, accepted: 0 };
        r.interviews++;
        if (iv.status === 'completed') r.completed++;
        perRec.set(k, r);
      });
      // Offers: no per-recruiter field; allocate by candidate->interview->interviewer if possible
      offList.forEach((o) => {
        const iv = ivList.find((i) => i.candidate_id === o.candidate_id);
        const k = iv?.interviewer || 'Unassigned';
        if (f.recruiter && k !== f.recruiter) return;
        const r = perRec.get(k) || { interviews: 0, completed: 0, offersSent: 0, accepted: 0 };
        r.offersSent++;
        if (o.status === 'accepted') r.accepted++;
        perRec.set(k, r);
      });
      const rows = [...perRec.entries()].map(([k, v]) => ({
        Recruiter: k,
        Interviews: v.interviews,
        Completed: v.completed,
        'Offers Sent': v.offersSent,
        Accepted: v.accepted
      })).sort((a, b) => b.Interviews - a.Interviews);
      return {
        rows,
        columns: [
          { header: 'Recruiter', key: 'Recruiter' },
          { header: 'Interviews', key: 'Interviews' },
          { header: 'Completed', key: 'Completed' },
          { header: 'Offers Sent', key: 'Offers Sent' },
          { header: 'Accepted', key: 'Accepted' }
        ],
        chart: {
          kind: 'bar',
          title: 'Interviews by Recruiter',
          data: rows.slice(0, 8).map((r, i) => ({ label: String(r.Recruiter).slice(0, 18), value: Number(r.Interviews), color: paletteAt(i) }))
        },
        insights: [
          rows[0] ? `Top recruiter by interviews: ${rows[0].Recruiter} (${rows[0].Interviews}).` : 'No interviewer activity yet.',
          `${ivList.filter((i) => i.status === 'completed').length} of ${ivList.length} interviews completed.`
        ]
      };
    }
  },

  // 5. Interview status
  {
    id: 'interview_status',
    name: 'Interview Status Report',
    category: 'pipeline',
    description: 'Breakdown of scheduled / completed / cancelled / no-show interviews.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ interviews }, f) => {
      const list = interviews.filter((i) => inDateRange(i.scheduled_at, f) && (!f.jobId || i.job_id === f.jobId));
      const counts: Record<string, number> = {};
      list.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
      const rows = Object.entries(counts).map(([k, v]) => ({
        Status: k.charAt(0).toUpperCase() + k.slice(1),
        Count: v,
        Percent: `${Math.round((v / Math.max(list.length, 1)) * 100)}%`
      }));
      return {
        rows,
        columns: [
          { header: 'Status', key: 'Status' },
          { header: 'Count', key: 'Count' },
          { header: 'Percent', key: 'Percent' }
        ],
        chart: {
          kind: 'pie',
          title: 'Interview Status Mix',
          data: rows.map((r, i) => ({ label: r.Status, value: Number(r.Count), color: paletteAt(i) }))
        },
        insights: [
          `${list.length} interviews in window.`,
          `${counts['no_show'] || 0} no-shows, ${counts['cancelled'] || 0} cancelled.`
        ]
      };
    }
  },

  // 6. Offer vs Acceptance
  {
    id: 'offer_vs_acceptance',
    name: 'Offer vs Acceptance Report',
    category: 'pipeline',
    description: 'How many offers sent vs accepted / rejected / expired.',
    roles: ['admin', 'recruiter'],
    defaultEnabled: true,
    compute: ({ offers }, f) => {
      const list = offers.filter((o) => inDateRange(o.sent_date, f) && (!f.jobId || o.job_id === f.jobId));
      const counts: Record<string, number> = { sent: 0, accepted: 0, rejected: 0, expired: 0, withdrawn: 0, draft: 0 };
      list.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
      const rows = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => ({
        Status: k.charAt(0).toUpperCase() + k.slice(1),
        Count: v
      }));
      const total = list.length || 1;
      const acc = counts.accepted;
      const responded = counts.accepted + counts.rejected;
      return {
        rows,
        columns: [
          { header: 'Status', key: 'Status' },
          { header: 'Count', key: 'Count' }
        ],
        chart: {
          kind: 'bar',
          title: 'Offer Outcomes',
          data: rows.map((r, i) => ({ label: r.Status, value: Number(r.Count), color: paletteAt(i) }))
        },
        insights: [
          `${list.length} offers in window.`,
          responded > 0 ? `Acceptance rate (vs responded): ${Math.round((acc / responded) * 100)}%.` : 'No responses recorded yet.',
          counts.expired > 0 ? `${counts.expired} offers expired without response.` : 'No expired offers.'
        ]
      };
    }
  },

  // 7. Time-to-hire
  {
    id: 'time_to_hire',
    name: 'Time-to-Hire Report',
    category: 'time',
    description: 'Days from application to offer acceptance, per hire.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ candidates, offers }, f) => {
      const accepted = offers.filter((o) => o.status === 'accepted' && (!f.jobId || o.job_id === f.jobId) && inDateRange(o.responded_date || o.sent_date, f));
      const rows = accepted.map((o) => {
        const c = candidates.find((x) => x.id === o.candidate_id);
        const start = c ? parseDate(c.uploadedAt) : null;
        const end = parseDate(o.responded_date || o.sent_date);
        const days = start && end ? Math.max(0, Math.round((end - start) / 86400000)) : null;
        return {
          Candidate: c?.personal.full_name || o.candidate_id,
          Position: o.position,
          Applied: c?.uploadedAt || '—',
          Accepted: o.responded_date || o.sent_date || '—',
          'Days to Hire': days ?? '—'
        };
      });
      const validDays = rows.map((r) => Number(r['Days to Hire'])).filter((n) => !isNaN(n));
      const avg = validDays.length > 0 ? Math.round(validDays.reduce((s, n) => s + n, 0) / validDays.length) : 0;
      return {
        rows,
        columns: [
          { header: 'Candidate', key: 'Candidate' },
          { header: 'Position', key: 'Position' },
          { header: 'Applied', key: 'Applied' },
          { header: 'Accepted', key: 'Accepted' },
          { header: 'Days to Hire', key: 'Days to Hire' }
        ],
        chart: {
          kind: 'bar',
          title: 'Days to Hire (per accepted offer)',
          data: rows.map((r, i) => ({ label: String(r.Candidate).slice(0, 18), value: Number(r['Days to Hire']) || 0, color: paletteAt(i) })).slice(0, 10)
        },
        insights: [
          `${rows.length} hires in window.`,
          validDays.length > 0 ? `Average time to hire: ${avg} days.` : 'Not enough data to compute average.',
          validDays.length > 0 ? `Fastest: ${Math.min(...validDays)} days · Slowest: ${Math.max(...validDays)} days.` : ''
        ].filter(Boolean)
      };
    }
  },

  // 8. Time-to-fill (per job)
  {
    id: 'time_to_fill',
    name: 'Time-to-Fill Report',
    category: 'time',
    description: 'Days from job posting to first accepted offer per job.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ jobs, offers }, f) => {
      const rows = jobs.filter((j) => !f.jobId || j.id === f.jobId).map((j) => {
        const offered = offers.find((o) => o.job_id === j.id && o.status === 'accepted');
        const start = parseDate(j.posted_date);
        const end = offered ? parseDate(offered.responded_date || offered.sent_date) : null;
        const days = start && end ? Math.max(0, Math.round((end - start) / 86400000)) : null;
        return {
          Job: j.title,
          Department: j.department,
          Posted: j.posted_date,
          Filled: offered?.responded_date || offered?.sent_date || '—',
          'Days to Fill': days ?? (j.status === 'open' ? 'Open' : '—')
        };
      });
      const validDays = rows.map((r) => Number(r['Days to Fill'])).filter((n) => !isNaN(n));
      return {
        rows,
        columns: [
          { header: 'Job', key: 'Job' },
          { header: 'Department', key: 'Department' },
          { header: 'Posted', key: 'Posted' },
          { header: 'Filled', key: 'Filled' },
          { header: 'Days to Fill', key: 'Days to Fill' }
        ],
        chart: {
          kind: 'bar',
          title: 'Days to Fill by Job',
          data: rows.filter((r) => !isNaN(Number(r['Days to Fill']))).map((r, i) => ({ label: String(r.Job).slice(0, 18), value: Number(r['Days to Fill']), color: paletteAt(i) })).slice(0, 10)
        },
        insights: [
          validDays.length > 0 ? `Average time to fill: ${Math.round(validDays.reduce((s, n) => s + n, 0) / validDays.length)} days across ${validDays.length} filled roles.` : 'No filled roles in window.',
          `${jobs.filter((j) => j.status === 'open').length} open positions still hiring.`
        ]
      };
    }
  },

  // 9. Nationality
  {
    id: 'nationality',
    name: 'Candidate Nationality Report',
    category: 'people',
    description: 'Diversity of candidate pool by nationality.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const counts = new Map<string, number>();
      list.forEach((c) => {
        const n = c.personal.nationality || 'Unspecified';
        counts.set(n, (counts.get(n) || 0) + 1);
      });
      const rows = [...counts.entries()]
        .map(([Nat, Count]) => ({ Nationality: Nat, Count, Percent: `${Math.round((Count / Math.max(list.length, 1)) * 100)}%` }))
        .sort((a, b) => b.Count - a.Count);
      return {
        rows,
        columns: [
          { header: 'Nationality', key: 'Nationality' },
          { header: 'Count', key: 'Count' },
          { header: 'Percent', key: 'Percent' }
        ],
        chart: {
          kind: 'pie',
          title: 'Nationality Mix',
          data: rows.slice(0, 10).map((r, i) => ({ label: r.Nationality, value: Number(r.Count), color: paletteAt(i) }))
        },
        insights: [
          `${counts.size} distinct nationalities represented across ${list.length} candidates.`,
          rows[0] ? `Largest group: ${rows[0].Nationality} (${rows[0].Percent}).` : ''
        ].filter(Boolean)
      };
    }
  },

  // 10. Gender diversity
  {
    id: 'gender_diversity',
    name: 'Gender Diversity Report',
    category: 'people',
    description: 'Gender split across candidates and hires.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const counts: Record<string, number> = {};
      list.forEach((c) => {
        const g = c.personal.gender || 'Unspecified';
        counts[g] = (counts[g] || 0) + 1;
      });
      const rows = Object.entries(counts).map(([g, n]) => ({
        Gender: g,
        Candidates: n,
        Percent: `${Math.round((n / Math.max(list.length, 1)) * 100)}%`,
        Hires: list.filter((c) => (c.personal.gender || 'Unspecified') === g && c.stage === 'hired').length
      }));
      return {
        rows,
        columns: [
          { header: 'Gender', key: 'Gender' },
          { header: 'Candidates', key: 'Candidates' },
          { header: 'Percent', key: 'Percent' },
          { header: 'Hires', key: 'Hires' }
        ],
        chart: {
          kind: 'pie',
          title: 'Gender Split',
          data: rows.map((r, i) => ({ label: r.Gender, value: Number(r.Candidates), color: paletteAt(i) }))
        },
        insights: [
          rows[0] ? `Most represented: ${rows[0].Gender} (${rows[0].Percent}).` : 'No data yet.',
          `${list.filter((c) => c.stage === 'hired').length} hires in window.`
        ]
      };
    }
  },

  // 11. Skill-based candidate report
  {
    id: 'skill_based',
    name: 'Skill-based Candidate Report',
    category: 'people',
    description: 'Top technical skills across the candidate pool.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const counts = new Map<string, number>();
      list.forEach((c) => {
        [...(c.skills.technical || []), ...(c.skills.tools || [])].forEach((s) => {
          if (!s) return;
          counts.set(s, (counts.get(s) || 0) + 1);
        });
      });
      const rows = [...counts.entries()]
        .map(([Skill, Count]) => ({ Skill, Candidates: Count }))
        .sort((a, b) => b.Candidates - a.Candidates)
        .slice(0, 30);
      return {
        rows,
        columns: [
          { header: 'Skill', key: 'Skill' },
          { header: 'Candidates', key: 'Candidates' }
        ],
        chart: {
          kind: 'bar',
          title: 'Top Skills',
          data: rows.slice(0, 12).map((r, i) => ({ label: String(r.Skill).slice(0, 18), value: Number(r.Candidates), color: paletteAt(i) }))
        },
        insights: [
          rows[0] ? `Most common skill: ${rows[0].Skill} (${rows[0].Candidates} candidates).` : 'No skill data.',
          `${counts.size} distinct skills indexed.`
        ]
      };
    }
  },

  // 12. Rejected analysis
  {
    id: 'rejected_analysis',
    name: 'Rejected Candidates Analysis',
    category: 'quality',
    description: 'Score distribution and breakdown of rejected candidates.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ candidates }, f) => {
      const list = candidates.filter((c) => c.stage === 'rejected' && candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const buckets = { '80-100': 0, '60-79': 0, '40-59': 0, '0-39': 0 };
      list.forEach((c) => {
        if (c.ai_score >= 80) buckets['80-100']++;
        else if (c.ai_score >= 60) buckets['60-79']++;
        else if (c.ai_score >= 40) buckets['40-59']++;
        else buckets['0-39']++;
      });
      const rows = Object.entries(buckets).map(([Bucket, Count]) => ({ 'AI Score Bucket': Bucket, Count }));
      return {
        rows,
        columns: [
          { header: 'AI Score Bucket', key: 'AI Score Bucket' },
          { header: 'Count', key: 'Count' }
        ],
        chart: {
          kind: 'bar',
          title: 'Rejected by AI-Score Bucket',
          data: rows.map((r, i) => ({ label: String(r['AI Score Bucket']), value: Number(r.Count), color: paletteAt(i) }))
        },
        insights: [
          `${list.length} candidates rejected in window.`,
          buckets['80-100'] > 0 ? `${buckets['80-100']} high-score (80+) candidates were rejected — review your screening criteria.` : 'No high-score rejections.'
        ]
      };
    }
  },

  // 13. Active vs Closed jobs
  {
    id: 'active_vs_closed_jobs',
    name: 'Active vs Closed Jobs Report',
    category: 'jobs',
    description: 'Status breakdown of job postings.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ jobs }) => {
      const counts: Record<string, number> = { draft: 0, open: 0, on_hold: 0, closed: 0 };
      jobs.forEach((j) => { counts[j.status] = (counts[j.status] || 0) + 1; });
      const rows = Object.entries(counts).map(([Status, Count]) => ({ Status: Status.replace('_', ' '), Count }));
      return {
        rows,
        columns: [
          { header: 'Status', key: 'Status' },
          { header: 'Count', key: 'Count' }
        ],
        chart: {
          kind: 'pie',
          title: 'Job Status Mix',
          data: rows.map((r, i) => ({ label: String(r.Status), value: Number(r.Count), color: paletteAt(i) }))
        },
        insights: [
          `${jobs.length} total job postings.`,
          `${counts.open} active, ${counts.closed} closed, ${counts.on_hold} on hold.`
        ]
      };
    }
  },

  // 14. Duplicate detection
  {
    id: 'duplicate_detection',
    name: 'Duplicate Candidate Detection',
    category: 'quality',
    description: 'Candidates with matching email, phone, or name.',
    roles: ['admin'],
    defaultEnabled: true,
    compute: ({ candidates }) => {
      // Group by email lowercased + phone-digits + normalized name
      const groups = new Map<string, Candidate[]>();
      candidates.forEach((c) => {
        const keys: string[] = [];
        const email = (c.personal.email || '').toLowerCase().trim();
        if (email) keys.push('email:' + email);
        const phone = (c.personal.phone || '').replace(/\D/g, '');
        if (phone.length >= 8) keys.push('phone:' + phone.slice(-9));
        const name = (c.personal.full_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (name) keys.push('name:' + name);
        keys.forEach((k) => {
          const arr = groups.get(k) || [];
          arr.push(c);
          groups.set(k, arr);
        });
      });
      // Build unique pairs of duplicates
      const dupSet = new Set<string>();
      const rows: Record<string, string | number>[] = [];
      groups.forEach((arr, key) => {
        if (arr.length <= 1) return;
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const a = arr[i], b = arr[j];
            const sig = [a.id, b.id].sort().join('::');
            if (dupSet.has(sig)) continue;
            dupSet.add(sig);
            rows.push({
              'Match On': key.split(':')[0],
              Candidate: a.personal.full_name || a.id,
              Email: a.personal.email,
              Duplicate: b.personal.full_name || b.id,
              'Duplicate Email': b.personal.email
            });
          }
        }
      });
      return {
        rows,
        columns: [
          { header: 'Match On', key: 'Match On' },
          { header: 'Candidate', key: 'Candidate' },
          { header: 'Email', key: 'Email' },
          { header: 'Duplicate', key: 'Duplicate' },
          { header: 'Duplicate Email', key: 'Duplicate Email' }
        ],
        chart: { kind: 'none', data: [] },
        insights: [
          rows.length === 0 ? 'No duplicates detected — clean dataset.' : `${rows.length} potential duplicate pairs found — review and merge.`,
          rows.length > 0 ? 'Tip: dedup matches use email, phone (last 9 digits), and normalized name.' : ''
        ].filter(Boolean)
      };
    }
  },

  // 15. AI insights summary (cross-report)
  {
    id: 'ai_summary_insights',
    name: 'AI Candidate Summary Insights',
    category: 'ai',
    description: 'AI-generated cross-cutting insights and trends.',
    roles: ['admin', 'recruiter', 'demo'],
    defaultEnabled: true,
    compute: ({ candidates, jobs, interviews, offers }, f) => {
      const list = candidates.filter((c) => candidateMatches(c, f) && inDateRange(c.uploadedAt, f));
      const high = list.filter((c) => c.ai_score >= 80);
      const avg = list.length > 0 ? Math.round(list.reduce((s, c) => s + c.ai_score, 0) / list.length) : 0;
      const hired = list.filter((c) => c.stage === 'hired').length;
      const openJobs = jobs.filter((j) => j.status === 'open').length;
      const acceptedOffers = offers.filter((o) => o.status === 'accepted').length;
      const respondedOffers = offers.filter((o) => ['accepted', 'rejected'].includes(o.status)).length;
      // Trend: compare this 30d window vs previous 30d
      const now = Date.now();
      const inLast30 = (iso: string) => {
        const t = parseDate(iso);
        return t != null && now - t <= 30 * 86400000;
      };
      const inPrev30 = (iso: string) => {
        const t = parseDate(iso);
        return t != null && now - t > 30 * 86400000 && now - t <= 60 * 86400000;
      };
      const recent = candidates.filter((c) => inLast30(c.uploadedAt)).length;
      const prior = candidates.filter((c) => inPrev30(c.uploadedAt)).length;
      const delta = prior === 0 ? null : Math.round(((recent - prior) / prior) * 100);

      const rows = [
        { Metric: 'Total Candidates', Value: list.length },
        { Metric: 'High-Score Candidates (≥80)', Value: high.length },
        { Metric: 'Average AI Score', Value: `${avg}%` },
        { Metric: 'Hired Candidates', Value: hired },
        { Metric: 'Active Job Postings', Value: openJobs },
        { Metric: 'Interviews Scheduled', Value: interviews.filter((i) => i.status === 'scheduled').length },
        { Metric: 'Offer Acceptance Rate', Value: respondedOffers > 0 ? `${Math.round((acceptedOffers / respondedOffers) * 100)}%` : '—' },
        { Metric: 'Last-30d Inflow', Value: recent },
        { Metric: 'Trend vs Prior 30d', Value: delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%` }
      ];
      return {
        rows,
        columns: [
          { header: 'Metric', key: 'Metric' },
          { header: 'Value', key: 'Value' }
        ],
        chart: {
          kind: 'bar',
          title: 'KPI Snapshot',
          data: [
            { label: 'Candidates', value: list.length, color: paletteAt(0) },
            { label: 'High-Score', value: high.length, color: paletteAt(1) },
            { label: 'Hired', value: hired, color: paletteAt(2) },
            { label: 'Open Jobs', value: openJobs, color: paletteAt(3) }
          ]
        },
        insights: [
          delta !== null ? `Candidate inflow ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)}% vs prior 30 days.` : 'Not enough history for trend.',
          high.length > 0 ? `${high.length} candidates scored 80+ — prioritise outreach.` : 'No high-score candidates in window.',
          openJobs > 0 && list.length === 0 ? 'Open roles but no candidates yet — boost sourcing.' : '',
          respondedOffers > 0 && acceptedOffers / respondedOffers < 0.5 ? 'Offer acceptance below 50% — review compensation benchmark.' : ''
        ].filter(Boolean)
      };
    }
  }
];

// ─── enabled-state persistence ────────────────────────────────────

const ENABLED_KEY = 'recruitment_ats_reports_enabled_v1';

export function loadReportEnabled(): Record<ReportId, boolean> {
  try {
    const raw = localStorage.getItem(ENABLED_KEY);
    if (!raw) return defaultEnabledMap();
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const def = defaultEnabledMap();
    REPORT_DEFS.forEach((r) => {
      if (parsed[r.id] === false) def[r.id] = false;
      else if (parsed[r.id] === true) def[r.id] = true;
    });
    return def;
  } catch {
    return defaultEnabledMap();
  }
}

export function saveReportEnabled(map: Record<ReportId, boolean>) {
  try {
    localStorage.setItem(ENABLED_KEY, JSON.stringify(map));
  } catch {}
}

function defaultEnabledMap(): Record<ReportId, boolean> {
  const m = {} as Record<ReportId, boolean>;
  REPORT_DEFS.forEach((r) => { m[r.id] = r.defaultEnabled; });
  return m;
}

export function visibleReportsFor(role: ReportRole, enabled: Record<ReportId, boolean>): ReportDef[] {
  return REPORT_DEFS.filter((r) => r.roles.includes(role) && enabled[r.id] !== false);
}
