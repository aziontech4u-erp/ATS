import { useMemo, useState } from 'react';
import {
  Search, Download, Trash2, Eye, FileSpreadsheet, FileText, Users,
  Plus, X, Edit2, UserPlus, Save, Mail, Briefcase,
  Clock, Award, Calendar, Filter
} from 'lucide-react';
import type { Candidate, Stage, JobPosting } from '../lib/types';
import { uid } from '../lib/storage';
import {
  getInitials, avatarColor, stageColors, scoreColor,
  downloadCSV, downloadExcel, downloadPDF
} from '../lib/utils';
import NationalityAutocomplete from './NationalityAutocomplete';
import { useUi } from '../lib/uiContext';

interface CandidatesViewProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  onAddCandidate: (c: Candidate) => void;
  onUpdateCandidate: (id: string, patch: Partial<Candidate>) => void;
  onDeleteCandidate: (id: string) => void;
  onViewParser: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ModalMode = 'create' | 'edit' | 'view' | null;

// Helper: build a blank candidate for the "Create New" form
function blankCandidate(): Candidate {
  return {
    id: '',
    filename: 'manual-entry',
    fileSize: '0 KB',
    uploadedAt: new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }),
    stage: 'applied',
    source: 'Manual',
    rawText: '',
    personal: {
      full_name: '', email: '', phone: '', location: '', city: '', country: '',
      linkedin: '', website: '', nationality: '', gender: '',
      date_of_birth: '', marital_status: ''
    },
    professional_summary: '',
    current_title: '',
    total_experience_years: 0,
    skills: { technical: [], soft: [], languages: [], tools: [], certifications: [] },
    work_experience: [],
    education: [],
    certifications: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    visa_status: '',
    notice_period: '',
    expected_salary: '',
    ai_score: 50,
    ai_strengths: [],
    ai_concerns: [],
    recommended_roles: [],
    omanization_eligible: false,
    jobId: '',
    notes: '',
    rating: 0
  };
}

export default function CandidatesView({
  candidates,
  jobs,
  onAddCandidate,
  onUpdateCandidate,
  onDeleteCandidate,
  onViewParser,
  onToast
}: CandidatesViewProps) {
  const { t } = useUi();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [scoreFilter, setScoreFilter] = useState<'all' | '80+' | '60-79' | '<60'>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');           // job id or 'all' or 'none'
  const [nationalityFilter, setNationalityFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal state
  const [mode, setMode] = useState<ModalMode>(null);
  const [draft, setDraft] = useState<Candidate>(blankCandidate());

  // Distinct values for filter dropdowns
  const nationalities = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      const n = (c.personal.nationality || '').trim();
      if (n) set.add(n);
    });
    return [...set].sort();
  }, [candidates]);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      (c.skills.technical || []).forEach((s) => s && set.add(s.trim()));
      (c.skills.tools || []).forEach((s) => s && set.add(s.trim()));
    });
    return [...set].sort();
  }, [candidates]);

  function clearFilters() {
    setSearch('');
    setStageFilter('all');
    setScoreFilter('all');
    setJobFilter('all');
    setNationalityFilter('all');
    setSkillFilter('all');
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }

  function openCreate() {
    setDraft(blankCandidate());
    setMode('create');
  }
  function openEdit(c: Candidate) {
    setDraft(JSON.parse(JSON.stringify(c))); // deep clone
    setMode('edit');
  }
  function openView(c: Candidate) {
    setDraft(c);
    setMode('view');
  }
  function closeModal() {
    setMode(null);
  }

  function saveCandidate() {
    if (!draft.personal.full_name.trim()) {
      onToast('Full name is required', 'error');
      return;
    }
    // Email format check (optional field but if provided, validate)
    if (draft.personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.personal.email)) {
      onToast('Please enter a valid email address', 'error');
      return;
    }

    if (mode === 'create') {
      const newCandidate: Candidate = { ...draft, id: uid() };
      onAddCandidate(newCandidate);
      onToast(`Added ${draft.personal.full_name}`, 'success');
    } else if (mode === 'edit') {
      onUpdateCandidate(draft.id, draft);
      onToast(`Updated ${draft.personal.full_name}`, 'success');
    }
    closeModal();
  }

  const filtered = candidates.filter((c) => {
    if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
    if (scoreFilter === '80+' && c.ai_score < 80) return false;
    if (scoreFilter === '60-79' && (c.ai_score < 60 || c.ai_score >= 80)) return false;
    if (scoreFilter === '<60' && c.ai_score >= 60) return false;
    if (jobFilter === 'none' && c.jobId) return false;
    if (jobFilter !== 'all' && jobFilter !== 'none' && c.jobId !== jobFilter) return false;
    if (nationalityFilter !== 'all' && (c.personal.nationality || '').trim() !== nationalityFilter) return false;
    if (skillFilter !== 'all') {
      const skills = [...(c.skills.technical || []), ...(c.skills.tools || [])].map((s) => s.toLowerCase());
      if (!skills.includes(skillFilter.toLowerCase())) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        c.personal.full_name, c.current_title, c.personal.email,
        c.personal.nationality, c.personal.location,
        ...(c.skills.technical || [])
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const visibleIds = filtered.map((c) => c.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedCandidates = candidates.filter((c) => selected.has(c.id));
  const exportScope = selectedCandidates.length > 0 ? selectedCandidates : filtered;

  function buildExportRows() {
    return exportScope.map((c) => ({
      Name: c.personal.full_name,
      Email: c.personal.email,
      Phone: c.personal.phone,
      Title: c.current_title,
      'Experience (Years)': c.total_experience_years,
      Location: c.personal.location || c.personal.city,
      Nationality: c.personal.nationality,
      'AI Score': c.ai_score,
      Stage: c.stage,
      'Technical Skills': (c.skills.technical || []).join('; '),
      Tools: (c.skills.tools || []).join('; '),
      Languages: (c.skills.languages || []).join('; '),
      Certifications: (c.certifications || []).map((x) => x.name).join('; '),
      Uploaded: c.uploadedAt,
      Filename: c.filename
    }));
  }

  function exportCSV() {
    if (exportScope.length === 0) return onToast('Nothing to export', 'info');
    downloadCSV(buildExportRows(), `candidates-${new Date().toISOString().slice(0, 10)}.csv`);
    onToast(`Exported ${exportScope.length} candidates to CSV`, 'success');
  }
  async function exportExcel() {
    if (exportScope.length === 0) return onToast('Nothing to export', 'info');
    onToast('Preparing Excel file…', 'info');
    try {
      await downloadExcel(
        buildExportRows(),
        `candidates-${new Date().toISOString().slice(0, 10)}.xlsx`,
        'Candidates'
      );
      onToast(`Exported ${exportScope.length} candidates to Excel`, 'success');
    } catch (err) {
      console.error(err);
      onToast('Excel export failed', 'error');
    }
  }
  async function exportPDF() {
    if (exportScope.length === 0) return onToast('Nothing to export', 'info');
    onToast('Preparing PDF…', 'info');
    try {
      const columns = [
        { header: 'Name', key: 'Name' },
        { header: 'Title', key: 'Title' },
        { header: 'Email', key: 'Email' },
        { header: 'Phone', key: 'Phone' },
        { header: 'Exp', key: 'Experience (Years)' },
        { header: 'Score', key: 'AI Score' },
        { header: 'Stage', key: 'Stage' },
        { header: 'Location', key: 'Location' },
        { header: 'Tools', key: 'Tools' }
      ];
      await downloadPDF(
        buildExportRows(),
        `candidates-${new Date().toISOString().slice(0, 10)}.pdf`,
        'Candidates Report',
        columns
      );
      onToast(`Exported ${exportScope.length} candidates to PDF`, 'success');
    } catch (err) {
      console.error(err);
      onToast('PDF export failed: ' + (err as Error).message, 'error');
    }
  }

  const anyFilter = stageFilter !== 'all' || scoreFilter !== 'all' || jobFilter !== 'all'
    || nationalityFilter !== 'all' || skillFilter !== 'all' || search.trim().length > 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('cand.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('cand.countLabel', { filtered: filtered.length, total: candidates.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <UserPlus size={13} />
            {t('cand.add')}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-brand-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"
          >
            <Download size={13} /> {t('cand.exportCsv')}
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-800 dark:text-green-300"
          >
            <FileSpreadsheet size={13} /> {t('cand.exportExcel')}
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-300"
          >
            <FileText size={13} /> {t('cand.exportPdf')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <Search size={14} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('cand.searchPlaceholder')}
            className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">{t('cand.allStages')}</option>
          <option value="applied">Applied</option>
          <option value="screening">Screening</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">{t('cand.allJobs')}</option>
          <option value="none">{t('cand.noJobLinked')}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <select
          value={nationalityFilter}
          onChange={(e) => setNationalityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">{t('cand.allNationalities')}</option>
          {nationalities.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">{t('cand.allSkills')}</option>
          {allSkills.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value as any)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">{t('cand.allScores')}</option>
          <option value="80+">Score 80+</option>
          <option value="60-79">Score 60-79</option>
          <option value="<60">Score &lt; 60</option>
        </select>
        {anyFilter && (
          <button
            onClick={clearFilters}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Filter size={12} /> {t('cand.clearFilters')}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-100 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900/60 dark:bg-blue-900/30">
          <div className="flex items-center gap-2 font-semibold text-brand-500 dark:text-blue-300">
            <Filter size={13} />
            {t('cand.selected', { n: selected.size })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCSV} className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-brand-500 hover:bg-blue-50 border border-blue-200 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-300">
              <Download size={12} /> CSV
            </button>
            <button onClick={exportExcel} className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-green-700 hover:bg-green-50 border border-green-200 dark:bg-slate-800 dark:border-slate-700 dark:text-green-300">
              <FileSpreadsheet size={12} /> Excel
            </button>
            <button onClick={exportPDF} className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 dark:bg-slate-800 dark:border-slate-700 dark:text-rose-300">
              <FileText size={12} /> PDF
            </button>
            <button onClick={() => setSelected(new Set())} className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">No candidates found</div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {candidates.length === 0
                ? 'Add a candidate manually or upload resumes via the Resume Parser'
                : 'Try changing your filters'}
            </p>
            {candidates.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
              >
                <UserPlus size={13} /> Add First Candidate
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="w-8 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => toggleSelectAll(visibleIds)}
                      className="h-3.5 w-3.5 cursor-pointer accent-brand-500"
                      aria-label="Select all visible"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t('cand.colCandidate')}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t('cand.colTitle')}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t('cand.colContact')}</th>
                  <th className="px-3 py-2.5 text-center font-semibold">{t('cand.colScore')}</th>
                  <th className="px-3 py-2.5 text-center font-semibold">{t('cand.colStage')}</th>
                  <th className="px-3 py-2.5 text-start font-semibold">{t('cand.colJob')}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{t('cand.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => {
                  const style = stageColors(c.stage);
                  const job = jobs.find((j) => j.id === c.jobId);
                  const isSelected = selected.has(c.id);
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isSelected ? 'bg-blue-50/60 dark:bg-blue-900/20' : ''}`}>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          className="h-3.5 w-3.5 cursor-pointer accent-brand-500"
                          aria-label={`Select ${c.personal.full_name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ background: avatarColor(c.personal.full_name) }}
                          >
                            {getInitials(c.personal.full_name)}
                          </div>
                          <div>
                            <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                              {c.personal.full_name || 'Unknown'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {c.personal.nationality || c.personal.country || c.source}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] font-medium text-slate-900 dark:text-slate-100">
                          {c.current_title || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {c.total_experience_years > 0 ? `${c.total_experience_years} years` : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[11px] text-slate-700 dark:text-slate-200">
                          {c.personal.email || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {c.personal.phone || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className="text-sm font-bold"
                          style={{ color: scoreColor(c.ai_score) }}
                        >
                          {c.ai_score}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <select
                          value={c.stage}
                          onChange={(e) =>
                            onUpdateCandidate(c.id, { stage: e.target.value as Stage })
                          }
                          className="rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold outline-none cursor-pointer"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          <option value="applied">Applied</option>
                          <option value="screening">Screening</option>
                          <option value="interview">Interview</option>
                          <option value="offer">Offer</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        {job ? (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-brand-500 dark:bg-blue-900/40 dark:text-blue-300">
                            {job.title}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openView(c)}
                            title="View profile"
                            className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-brand-500 dark:text-slate-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            title="Edit"
                            className="rounded p-1 text-slate-500 hover:bg-green-50 hover:text-green-700 dark:text-slate-400 dark:hover:bg-green-900/30 dark:hover:text-green-300"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${c.personal.full_name}?`)) {
                                onDeleteCandidate(c.id);
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  next.delete(c.id);
                                  return next;
                                });
                                onToast('Candidate deleted', 'success');
                              }
                            }}
                            title="Delete"
                            className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CRUD Modal ── */}
      {mode && (
        <CandidateModal
          mode={mode}
          draft={draft}
          setDraft={setDraft}
          jobs={jobs}
          onSave={saveCandidate}
          onClose={closeModal}
          onSwitchToEdit={() => setMode('edit')}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CANDIDATE MODAL — handles create/edit/view modes
// ─────────────────────────────────────────────────────────────

interface ModalProps {
  mode: 'create' | 'edit' | 'view';
  draft: Candidate;
  setDraft: (c: Candidate) => void;
  jobs: JobPosting[];
  onSave: () => void;
  onClose: () => void;
  onSwitchToEdit: () => void;
}

type Tab = 'personal' | 'professional' | 'skills' | 'experience' | 'education' | 'notes';

function CandidateModal({
  mode, draft, setDraft, jobs, onSave, onClose, onSwitchToEdit
}: ModalProps) {
  const [tab, setTab] = useState<Tab>('personal');
  const readOnly = mode === 'view';

  // Helpers to mutate the draft
  const updatePersonal = (field: string, value: string) => {
    setDraft({ ...draft, personal: { ...draft.personal, [field]: value } });
  };
  const updateField = (field: keyof Candidate, value: any) => {
    setDraft({ ...draft, [field]: value });
  };
  const updateSkillList = (key: 'technical' | 'soft' | 'tools' | 'languages', value: string) => {
    setDraft({
      ...draft,
      skills: {
        ...draft.skills,
        [key]: value.split(',').map((s) => s.trim()).filter(Boolean)
      }
    });
  };

  const title = {
    create: 'Add New Candidate',
    edit: `Edit ${draft.personal.full_name || 'Candidate'}`,
    view: draft.personal.full_name || 'Candidate Profile'
  }[mode];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="flex h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {mode !== 'create' && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: avatarColor(draft.personal.full_name) }}
              >
                {getInitials(draft.personal.full_name)}
              </div>
            )}
            <div>
              <div className="text-base font-bold text-slate-900">{title}</div>
              <div className="text-[11px] text-slate-500">
                {mode === 'view' && draft.current_title ? draft.current_title : null}
                {mode === 'create' && 'Manual entry'}
                {mode === 'edit' && 'Editing candidate details'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && (
              <button
                onClick={onSwitchToEdit}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-brand-500 hover:bg-blue-100"
              >
                <Edit2 size={13} /> Edit
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 overflow-x-auto border-b border-slate-100 bg-slate-50">
          {([
            ['personal', 'Personal', Mail],
            ['professional', 'Professional', Briefcase],
            ['skills', 'Skills', Award],
            ['experience', 'Experience', Clock],
            ['education', 'Education', Calendar],
            ['notes', 'Notes', FileText]
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-[11px] transition-colors ${
                tab === k
                  ? 'border-brand-500 font-semibold text-brand-500 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'personal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full Name *" readOnly={readOnly}>
                  <Input
                    value={draft.personal.full_name}
                    onChange={(v) => updatePersonal('full_name', v)}
                    readOnly={readOnly}
                    placeholder="John Doe"
                  />
                </Field>
                <Field label="Email" readOnly={readOnly}>
                  <Input
                    value={draft.personal.email}
                    onChange={(v) => updatePersonal('email', v)}
                    readOnly={readOnly}
                    type="email"
                    placeholder="name@example.com"
                  />
                </Field>
                <Field label="Phone" readOnly={readOnly}>
                  <Input
                    value={draft.personal.phone}
                    onChange={(v) => updatePersonal('phone', v)}
                    readOnly={readOnly}
                    placeholder="+968 9XXX XXXX"
                  />
                </Field>
                <Field label="Date of Birth" readOnly={readOnly}>
                  <Input
                    value={draft.personal.date_of_birth}
                    onChange={(v) => updatePersonal('date_of_birth', v)}
                    readOnly={readOnly}
                    placeholder="DD-MM-YYYY"
                  />
                </Field>
                <Field label="City" readOnly={readOnly}>
                  <Input
                    value={draft.personal.city}
                    onChange={(v) => updatePersonal('city', v)}
                    readOnly={readOnly}
                    placeholder="Muscat"
                  />
                </Field>
                <Field label="Country" readOnly={readOnly}>
                  <Input
                    value={draft.personal.country}
                    onChange={(v) => updatePersonal('country', v)}
                    readOnly={readOnly}
                    placeholder="Oman"
                  />
                </Field>
                <Field label="Nationality" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.personal.nationality} readOnly />
                  ) : (
                    <NationalityAutocomplete
                      value={draft.personal.nationality}
                      onChange={(v) => updatePersonal('nationality', v)}
                      placeholder="Omani / Indian / etc."
                    />
                  )}
                </Field>
                <Field label="Gender" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.personal.gender} readOnly />
                  ) : (
                    <select
                      value={draft.personal.gender}
                      onChange={(e) => updatePersonal('gender', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  )}
                </Field>
                <Field label="Marital Status" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.personal.marital_status} readOnly />
                  ) : (
                    <select
                      value={draft.personal.marital_status}
                      onChange={(e) => updatePersonal('marital_status', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="">—</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                    </select>
                  )}
                </Field>
                <Field label="LinkedIn" readOnly={readOnly}>
                  <Input
                    value={draft.personal.linkedin}
                    onChange={(v) => updatePersonal('linkedin', v)}
                    readOnly={readOnly}
                    placeholder="linkedin.com/in/username"
                  />
                </Field>
                <Field label="Website" readOnly={readOnly}>
                  <Input
                    value={draft.personal.website}
                    onChange={(v) => updatePersonal('website', v)}
                    readOnly={readOnly}
                    placeholder="https://yourwebsite.com"
                  />
                </Field>
              </div>
              <Field label="Location (full)" readOnly={readOnly}>
                <Input
                  value={draft.personal.location}
                  onChange={(v) => updatePersonal('location', v)}
                  readOnly={readOnly}
                  placeholder="City, Country"
                />
              </Field>
            </div>
          )}

          {tab === 'professional' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current Title" readOnly={readOnly}>
                  <Input
                    value={draft.current_title}
                    onChange={(v) => updateField('current_title', v)}
                    readOnly={readOnly}
                    placeholder="Senior Engineer"
                  />
                </Field>
                <Field label="Experience (Years)" readOnly={readOnly}>
                  <Input
                    value={String(draft.total_experience_years)}
                    onChange={(v) => updateField('total_experience_years', parseInt(v) || 0)}
                    readOnly={readOnly}
                    type="number"
                    placeholder="5"
                  />
                </Field>
                <Field label="Expected Salary" readOnly={readOnly}>
                  <Input
                    value={draft.expected_salary}
                    onChange={(v) => updateField('expected_salary', v)}
                    readOnly={readOnly}
                    placeholder="OMR 1500"
                  />
                </Field>
                <Field label="Notice Period" readOnly={readOnly}>
                  <Input
                    value={draft.notice_period}
                    onChange={(v) => updateField('notice_period', v)}
                    readOnly={readOnly}
                    placeholder="30 days"
                  />
                </Field>
                <Field label="Visa Status" readOnly={readOnly}>
                  <Input
                    value={draft.visa_status}
                    onChange={(v) => updateField('visa_status', v)}
                    readOnly={readOnly}
                    placeholder="Resident / Sponsored / Free Visa"
                  />
                </Field>
                <Field label="Source" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.source} readOnly />
                  ) : (
                    <select
                      value={draft.source}
                      onChange={(e) => updateField('source', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="Manual">Manual Entry</option>
                      <option value="Upload">Resume Upload</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Referral">Referral</option>
                      <option value="Job Board">Job Board</option>
                      <option value="Website">Company Website</option>
                      <option value="Agency">Recruitment Agency</option>
                    </select>
                  )}
                </Field>
                <Field label="Stage" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.stage} readOnly />
                  ) : (
                    <select
                      value={draft.stage}
                      onChange={(e) => updateField('stage', e.target.value as Stage)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="applied">Applied</option>
                      <option value="screening">Screening</option>
                      <option value="interview">Interview</option>
                      <option value="offer">Offer</option>
                      <option value="hired">Hired</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  )}
                </Field>
                <Field label="Job Linked" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={jobs.find((j) => j.id === draft.jobId)?.title || ''} readOnly />
                  ) : (
                    <select
                      value={draft.jobId || ''}
                      onChange={(e) => updateField('jobId', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="">Not linked</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>{j.title}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="AI Score (0-100)" readOnly={readOnly}>
                  <Input
                    value={String(draft.ai_score)}
                    onChange={(v) => updateField('ai_score', Math.max(0, Math.min(100, parseInt(v) || 0)))}
                    readOnly={readOnly}
                    type="number"
                    placeholder="50"
                  />
                </Field>
                <Field label="Omanization Eligible" readOnly={readOnly}>
                  {readOnly ? (
                    <Input value={draft.omanization_eligible ? 'Yes' : 'No'} readOnly />
                  ) : (
                    <select
                      value={draft.omanization_eligible ? 'yes' : 'no'}
                      onChange={(e) => updateField('omanization_eligible', e.target.value === 'yes')}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  )}
                </Field>
              </div>
              <Field label="Professional Summary" readOnly={readOnly}>
                <TextArea
                  value={draft.professional_summary}
                  onChange={(v) => updateField('professional_summary', v)}
                  readOnly={readOnly}
                  rows={5}
                  placeholder="Brief professional bio, key strengths, career goals..."
                />
              </Field>
            </div>
          )}

          {tab === 'skills' && (
            <div className="space-y-3">
              <Field label="Technical Skills (comma-separated)" readOnly={readOnly}>
                <TextArea
                  value={(draft.skills.technical || []).join(', ')}
                  onChange={(v) => updateSkillList('technical', v)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder="React, Node.js, Python, SQL"
                />
              </Field>
              <Field label="Tools & Platforms (comma-separated)" readOnly={readOnly}>
                <TextArea
                  value={(draft.skills.tools || []).join(', ')}
                  onChange={(v) => updateSkillList('tools', v)}
                  readOnly={readOnly}
                  rows={2}
                  placeholder="AWS, Docker, Jira, Figma"
                />
              </Field>
              <Field label="Soft Skills (comma-separated)" readOnly={readOnly}>
                <TextArea
                  value={(draft.skills.soft || []).join(', ')}
                  onChange={(v) => updateSkillList('soft', v)}
                  readOnly={readOnly}
                  rows={2}
                  placeholder="Leadership, Communication, Problem Solving"
                />
              </Field>
              <Field label="Languages (comma-separated)" readOnly={readOnly}>
                <Input
                  value={(draft.skills.languages || []).join(', ')}
                  onChange={(v) => updateSkillList('languages', v)}
                  readOnly={readOnly}
                  placeholder="English, Arabic, Hindi"
                />
              </Field>
            </div>
          )}

          {tab === 'experience' && (
            <ExperienceEditor
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
            />
          )}

          {tab === 'education' && (
            <EducationEditor
              draft={draft}
              setDraft={setDraft}
              readOnly={readOnly}
            />
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              <Field label="Recruiter Notes" readOnly={readOnly}>
                <TextArea
                  value={draft.notes || ''}
                  onChange={(v) => updateField('notes', v)}
                  readOnly={readOnly}
                  rows={8}
                  placeholder="Interview impressions, references, follow-up actions..."
                />
              </Field>
              <Field label="Manual Rating (0-5)" readOnly={readOnly}>
                <Input
                  value={String(draft.rating || 0)}
                  onChange={(v) => updateField('rating', Math.max(0, Math.min(5, parseInt(v) || 0)))}
                  readOnly={readOnly}
                  type="number"
                  placeholder="0"
                />
              </Field>
              {mode === 'view' && draft.rawText && (
                <Field label="Raw Resume Text" readOnly>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
                    {draft.rawText.slice(0, 4000)}
                    {draft.rawText.length > 4000 && '\n\n... (truncated)'}
                  </pre>
                </Field>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <div className="text-[10px] text-slate-400">
            {mode !== 'create' && `Uploaded: ${draft.uploadedAt} · ID: ${draft.id.slice(0, 6)}…`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button
                onClick={onSave}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                <Save size={13} />
                {mode === 'create' ? 'Add Candidate' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable form components ──────────────────────────────────

function Field({ label, children, readOnly = false }: { label: string; children: React.ReactNode; readOnly?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value, onChange, readOnly = false, type = 'text', placeholder = ''
}: {
  value: string; onChange?: (v: string) => void;
  readOnly?: boolean; type?: string; placeholder?: string;
}) {
  if (readOnly) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 min-h-[36px]">
        {value || <span className="text-slate-400">—</span>}
      </div>
    );
  }
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
    />
  );
}

function TextArea({
  value, onChange, readOnly = false, rows = 3, placeholder = ''
}: {
  value: string; onChange?: (v: string) => void;
  readOnly?: boolean; rows?: number; placeholder?: string;
}) {
  if (readOnly) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap min-h-[60px]">
        {value || <span className="text-slate-400">—</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-y"
    />
  );
}

// ── Experience editor (add/remove rows) ────────────────────────

function ExperienceEditor({
  draft, setDraft, readOnly
}: { draft: Candidate; setDraft: (c: Candidate) => void; readOnly: boolean }) {
  const list = draft.work_experience || [];

  function addExp() {
    setDraft({
      ...draft,
      work_experience: [
        ...list,
        {
          company: '', title: '', start_date: '', end_date: '',
          duration: '', location: '', current: false,
          responsibilities: [], achievements: []
        }
      ]
    });
  }
  function removeExp(idx: number) {
    setDraft({ ...draft, work_experience: list.filter((_, i) => i !== idx) });
  }
  function updateExp(idx: number, field: string, value: any) {
    const next = [...list];
    (next[idx] as any)[field] = value;
    setDraft({ ...draft, work_experience: next });
  }

  if (readOnly && list.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
        No work experience added
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((exp, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Position #{idx + 1}
            </span>
            {!readOnly && (
              <button
                onClick={() => removeExp(idx)}
                className="rounded p-1 text-rose-500 hover:bg-rose-50"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Company" readOnly={readOnly}>
              <Input value={exp.company} onChange={(v) => updateExp(idx, 'company', v)} readOnly={readOnly} />
            </Field>
            <Field label="Title" readOnly={readOnly}>
              <Input value={exp.title} onChange={(v) => updateExp(idx, 'title', v)} readOnly={readOnly} />
            </Field>
            <Field label="Start Date" readOnly={readOnly}>
              <Input value={exp.start_date} onChange={(v) => updateExp(idx, 'start_date', v)} readOnly={readOnly} placeholder="Jan 2020" />
            </Field>
            <Field label="End Date" readOnly={readOnly}>
              <Input value={exp.current ? 'Present' : exp.end_date} onChange={(v) => updateExp(idx, 'end_date', v)} readOnly={readOnly || exp.current} placeholder="Dec 2023" />
            </Field>
            <Field label="Location" readOnly={readOnly}>
              <Input value={exp.location} onChange={(v) => updateExp(idx, 'location', v)} readOnly={readOnly} />
            </Field>
            <Field label="Currently Working Here" readOnly={readOnly}>
              {readOnly ? (
                <Input value={exp.current ? 'Yes' : 'No'} readOnly />
              ) : (
                <select
                  value={exp.current ? 'yes' : 'no'}
                  onChange={(e) => updateExp(idx, 'current', e.target.value === 'yes')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              )}
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Responsibilities (one per line)" readOnly={readOnly}>
              <TextArea
                value={(exp.responsibilities || []).join('\n')}
                onChange={(v) => updateExp(idx, 'responsibilities', v.split('\n').filter(Boolean))}
                readOnly={readOnly}
                rows={4}
                placeholder="Designed and built X&#10;Managed team of Y"
              />
            </Field>
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={addExp}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 py-3 text-xs font-semibold text-brand-500 hover:bg-blue-100"
        >
          <Plus size={13} /> Add Work Experience
        </button>
      )}
    </div>
  );
}

// ── Education editor ───────────────────────────────────────────

function EducationEditor({
  draft, setDraft, readOnly
}: { draft: Candidate; setDraft: (c: Candidate) => void; readOnly: boolean }) {
  const list = draft.education || [];

  function addEdu() {
    setDraft({
      ...draft,
      education: [
        ...list,
        { institution: '', degree: '', field: '', start_year: '', end_year: '', grade: '', honors: '' }
      ]
    });
  }
  function removeEdu(idx: number) {
    setDraft({ ...draft, education: list.filter((_, i) => i !== idx) });
  }
  function updateEdu(idx: number, field: string, value: any) {
    const next = [...list];
    (next[idx] as any)[field] = value;
    setDraft({ ...draft, education: next });
  }

  if (readOnly && list.length === 0) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
        No education added
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((edu, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Education #{idx + 1}
            </span>
            {!readOnly && (
              <button
                onClick={() => removeEdu(idx)}
                className="rounded p-1 text-rose-500 hover:bg-rose-50"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Institution" readOnly={readOnly}>
              <Input value={edu.institution} onChange={(v) => updateEdu(idx, 'institution', v)} readOnly={readOnly} placeholder="University of Oxford" />
            </Field>
            <Field label="Degree" readOnly={readOnly}>
              <Input value={edu.degree} onChange={(v) => updateEdu(idx, 'degree', v)} readOnly={readOnly} placeholder="B.Sc / M.Tech / MBA" />
            </Field>
            <Field label="Field of Study" readOnly={readOnly}>
              <Input value={edu.field} onChange={(v) => updateEdu(idx, 'field', v)} readOnly={readOnly} placeholder="Computer Science" />
            </Field>
            <Field label="Grade / GPA" readOnly={readOnly}>
              <Input value={edu.grade} onChange={(v) => updateEdu(idx, 'grade', v)} readOnly={readOnly} placeholder="3.8 / First Class" />
            </Field>
            <Field label="Start Year" readOnly={readOnly}>
              <Input value={edu.start_year} onChange={(v) => updateEdu(idx, 'start_year', v)} readOnly={readOnly} placeholder="2016" />
            </Field>
            <Field label="End Year" readOnly={readOnly}>
              <Input value={edu.end_year} onChange={(v) => updateEdu(idx, 'end_year', v)} readOnly={readOnly} placeholder="2020" />
            </Field>
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          onClick={addEdu}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 py-3 text-xs font-semibold text-brand-500 hover:bg-blue-100"
        >
          <Plus size={13} /> Add Education
        </button>
      )}
    </div>
  );
}
