import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Filter, Download, FileSpreadsheet, FileText,
  Settings2, Sparkles, ChevronRight, X
} from 'lucide-react';
import type { Candidate, Interview, JobPosting, OfferLetter, Stage } from '../lib/types';
import {
  REPORT_DEFS, EMPTY_FILTERS, loadReportEnabled, saveReportEnabled,
  visibleReportsFor,
  type ReportDef, type ReportFilters, type ReportId, type ReportRole
} from '../lib/reports';
import ReportChart from './ReportCharts';
import { downloadCSV, downloadExcel, downloadPDF } from '../lib/utils';
import { useUi } from '../lib/uiContext';

interface Props {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
}

export default function ReportsView({ candidates, jobs, interviews, offers }: Props) {
  const { user, t } = useUi();
  const role: ReportRole = (user?.role as ReportRole) || 'admin';

  const [enabled, setEnabled] = useState<Record<ReportId, boolean>>(() => loadReportEnabled());
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [activeId, setActiveId] = useState<ReportId | null>(null);
  const [managing, setManaging] = useState(false);

  const available = useMemo(() => visibleReportsFor(role, enabled), [role, enabled]);
  useEffect(() => {
    // Pick first visible report if current selection becomes disabled / not allowed.
    if (!activeId || !available.find((r) => r.id === activeId)) {
      setActiveId(available[0]?.id || null);
    }
  }, [available, activeId]);

  const activeDef: ReportDef | null = activeId ? available.find((r) => r.id === activeId) || null : null;

  const result = useMemo(() => {
    if (!activeDef) return null;
    return activeDef.compute({ candidates, jobs, interviews, offers }, filters);
  }, [activeDef, candidates, jobs, interviews, offers, filters]);

  // Distinct values to fill filter dropdowns
  const nationalities = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => { const n = (c.personal.nationality || '').trim(); if (n) set.add(n); });
    return [...set].sort();
  }, [candidates]);
  const skills = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      [...(c.skills.technical || []), ...(c.skills.tools || [])].forEach((s) => s && set.add(s.trim()));
    });
    return [...set].sort();
  }, [candidates]);
  const recruiters = useMemo(() => {
    const set = new Set<string>();
    interviews.forEach((i) => { if (i.interviewer) set.add(i.interviewer); });
    return [...set].sort();
  }, [interviews]);

  function setFilter<K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) {
    setFilters((p) => ({ ...p, [k]: v }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const filename = (ext: string) => `${activeDef?.id || 'report'}-${new Date().toISOString().slice(0, 10)}.${ext}`;

  function exportCSV() {
    if (!result || result.rows.length === 0) return;
    downloadCSV(result.rows as any, filename('csv'));
  }
  async function exportExcel() {
    if (!result || result.rows.length === 0) return;
    await downloadExcel(result.rows as any, filename('xlsx'), activeDef?.name || 'Report');
  }
  async function exportPDF() {
    if (!result || result.rows.length === 0) return;
    await downloadPDF(result.rows as any, filename('pdf'), activeDef?.name || 'Report', result.columns);
  }

  function toggleReport(id: ReportId, value: boolean) {
    const next = { ...enabled, [id]: value };
    setEnabled(next);
    saveReportEnabled(next);
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left rail: report list */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-e border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-brand-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('reports.title')}</span>
          </div>
          {role === 'admin' && (
            <button
              onClick={() => setManaging(true)}
              title={t('reports.manageTip')}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings2 size={14} />
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {available.length === 0 ? (
            <div className="px-3 py-8 text-center text-[11px] text-slate-400">
              {t('reports.noEnabled')}
              {role === 'admin' && (
                <button onClick={() => setManaging(true)} className="mt-2 block w-full rounded bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white">{t('reports.manage')}</button>
              )}
            </div>
          ) : (
            available.map((r) => {
              const active = r.id === activeId;
              return (
                <button
                  key={r.id}
                  onClick={() => setActiveId(r.id)}
                  className={`mb-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-[11.5px] transition-colors ${
                    active
                      ? 'bg-blue-50 text-brand-500 font-semibold dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-50 font-medium dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex-1">{r.name}</span>
                  <ChevronRight size={12} className="opacity-50" />
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* Right pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{activeDef?.name || t('reports.title')}</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{activeDef?.description || t('reports.subtitle')}</p>
          </div>
          {activeDef && result && (
            <div className="flex flex-wrap gap-2">
              <button onClick={exportCSV} className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
                <Download size={12} /> CSV
              </button>
              <button onClick={exportExcel} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-green-700 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-800 dark:text-green-300">
                <FileSpreadsheet size={12} /> Excel
              </button>
              <button onClick={exportPDF} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-300">
                <FileText size={12} /> PDF
              </button>
            </div>
          )}
        </div>

        {/* Filters bar */}
        <div className="border-b border-blue-100 bg-white px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Filter size={12} /> {t('reports.filters')}
            </div>
            <FilterDate value={filters.fromDate} onChange={(v) => setFilter('fromDate', v)} placeholder={t('reports.filter.from')} />
            <FilterDate value={filters.toDate}   onChange={(v) => setFilter('toDate', v)}   placeholder={t('reports.filter.to')} />
            <FilterSelect value={filters.jobId} onChange={(v) => setFilter('jobId', v)}>
              <option value="">{t('reports.filter.allJobs')}</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </FilterSelect>
            <FilterSelect value={filters.status} onChange={(v) => setFilter('status', v as Stage | '')}>
              <option value="">{t('reports.filter.allStatuses')}</option>
              <option value="applied">{t('stage.applied')}</option>
              <option value="screening">{t('stage.screening')}</option>
              <option value="interview">{t('stage.interview')}</option>
              <option value="offer">{t('stage.offer')}</option>
              <option value="hired">{t('stage.hired')}</option>
              <option value="rejected">{t('stage.rejected')}</option>
            </FilterSelect>
            <FilterSelect value={filters.recruiter} onChange={(v) => setFilter('recruiter', v)}>
              <option value="">{t('reports.filter.allRecruiters')}</option>
              {recruiters.map((r) => <option key={r} value={r}>{r}</option>)}
            </FilterSelect>
            <FilterSelect value={filters.nationality} onChange={(v) => setFilter('nationality', v)}>
              <option value="">{t('reports.filter.allNationalities')}</option>
              {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
            </FilterSelect>
            <FilterSelect value={filters.gender} onChange={(v) => setFilter('gender', v)}>
              <option value="">{t('reports.filter.allGenders')}</option>
              <option value="Male">{t('reports.gender.male')}</option>
              <option value="Female">{t('reports.gender.female')}</option>
              <option value="Other">{t('reports.gender.other')}</option>
            </FilterSelect>
            <FilterSelect value={filters.skill} onChange={(v) => setFilter('skill', v)}>
              <option value="">{t('reports.filter.allSkills')}</option>
              {skills.slice(0, 200).map((s) => <option key={s} value={s}>{s}</option>)}
            </FilterSelect>
            <input
              value={filters.location}
              onChange={(e) => setFilter('location', e.target.value)}
              placeholder={t('reports.filter.locationContains')}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {Object.values(filters).some((v) => v) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <X size={11} /> {t('reports.filter.clear')}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!activeDef ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400 dark:border-slate-700">
              {t('reports.noSelected')}
            </div>
          ) : !result ? null : (
            <>
              {/* Insights */}
              {result.insights.length > 0 && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-900/50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500 dark:text-blue-300">
                    <Sparkles size={12} /> {t('reports.insights')}
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    {result.insights.map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-brand-500" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Chart */}
              {result.chart.kind !== 'none' && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  {result.chart.title && (
                    <div className="mb-3 text-xs font-bold text-slate-900 dark:text-slate-100">{result.chart.title}</div>
                  )}
                  <ReportChart series={result.chart} />
                </div>
              )}

              {/* Table */}
              <div className="rounded-xl border border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {t('reports.details', { n: result.rows.length })}
                </div>
                {result.rows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-xs text-slate-400">{t('reports.noMatch')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          {result.columns.map((c) => (
                            <th key={c.key} className="px-3 py-2 text-start font-semibold">{c.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {result.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            {result.columns.map((c) => (
                              <td key={c.key} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                {String(row[c.key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {managing && (
        <ManageReportsModal
          enabled={enabled}
          onToggle={toggleReport}
          onClose={() => setManaging(false)}
          role={role}
        />
      )}
    </div>
  );
}

// ─── small filter inputs ───────────────────────────────────────────

function FilterDate({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={placeholder}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
    />
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      {children}
    </select>
  );
}

// ─── manage-reports modal (admin) ─────────────────────────────────

function ManageReportsModal({
  enabled, onToggle, onClose, role
}: {
  enabled: Record<ReportId, boolean>;
  onToggle: (id: ReportId, value: boolean) => void;
  onClose: () => void;
  role: ReportRole;
}) {
  const { t } = useUi();
  const grouped = useMemo(() => {
    const map = new Map<string, ReportDef[]>();
    REPORT_DEFS.forEach((r) => {
      const arr = map.get(r.category) || [];
      arr.push(r);
      map.set(r.category, arr);
    });
    return [...map.entries()];
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('reports.manageTitle')}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('reports.manageSub')}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {role !== 'admin' && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
              {t('reports.adminOnly')}
            </div>
          )}
          {grouped.map(([cat, defs]) => (
            <div key={cat} className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {cat.replace('_', ' ')}
              </div>
              <div className="space-y-1">
                {defs.map((d) => {
                  const on = enabled[d.id] !== false;
                  return (
                    <label key={d.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{d.name}</div>
                        <div className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">{d.description}</div>
                        <div className="mt-0.5 text-[9.5px] uppercase tracking-wider text-slate-400">{t('reports.rolesPrefix')} {d.roles.join(', ')}</div>
                      </div>
                      <span
                        onClick={() => role === 'admin' && onToggle(d.id, !on)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'} ${role !== 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
