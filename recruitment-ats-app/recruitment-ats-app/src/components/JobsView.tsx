import { useState } from 'react';
import { Plus, Briefcase, Users, MapPin, DollarSign, X, Trash2, Edit2 } from 'lucide-react';
import type { JobPosting, Candidate } from '../lib/types';
import { uid } from '../lib/storage';
import { formatDate, formatCurrency } from '../lib/utils';

interface JobsViewProps {
  jobs: JobPosting[];
  candidates: Candidate[];
  onAddJob: (job: JobPosting) => void;
  onUpdateJob: (id: string, patch: Partial<JobPosting>) => void;
  onDeleteJob: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const EMPTY_JOB: Omit<JobPosting, 'id'> = {
  title: '',
  department: '',
  location: 'Muscat',
  branch: 'HQ',
  employment_type: 'full_time',
  openings: 1,
  filled: 0,
  salary_min: 500,
  salary_max: 1000,
  currency: 'OMR',
  status: 'draft',
  description: '',
  requirements: [],
  skills_required: [],
  posted_date: new Date().toISOString().slice(0, 10),
  closing_date: ''
};

const STATUS_COLORS: Record<JobPosting['status'], { bg: string; fg: string }> = {
  draft:   { bg: '#f1f5f9', fg: '#475569' },
  open:    { bg: '#dcfce7', fg: '#15803d' },
  on_hold: { bg: '#fef3c7', fg: '#b45309' },
  closed:  { bg: '#fee2e2', fg: '#991b1b' }
};

export default function JobsView({
  jobs,
  candidates,
  onAddJob,
  onUpdateJob,
  onDeleteJob,
  onToast
}: JobsViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<JobPosting, 'id'>>(EMPTY_JOB);
  const [statusFilter, setStatusFilter] = useState<JobPosting['status'] | 'all'>('all');

  function openCreate() {
    setDraft(EMPTY_JOB);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(job: JobPosting) {
    const { id, ...rest } = job;
    setDraft(rest);
    setEditingId(id);
    setShowForm(true);
  }

  function save() {
    if (!draft.title.trim()) {
      onToast('Job title is required', 'error');
      return;
    }
    if (draft.salary_min > draft.salary_max) {
      onToast('Min salary cannot exceed max', 'error');
      return;
    }

    if (editingId) {
      onUpdateJob(editingId, draft);
      onToast('Job updated', 'success');
    } else {
      onAddJob({ id: uid(), ...draft });
      onToast(`Job "${draft.title}" created`, 'success');
    }
    setShowForm(false);
  }

  const filtered = jobs.filter((j) => statusFilter === 'all' || j.status === statusFilter);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Job Postings</h1>
          <p className="text-xs text-slate-500">
            {filtered.length} of {jobs.length} positions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={14} />
          New Job
        </button>
      </div>

      {/* Status filter */}
      <div className="mb-3 flex gap-1.5">
        {(['all', 'draft', 'open', 'on_hold', 'closed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
              statusFilter === s
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Briefcase size={48} className="mx-auto mb-3 text-slate-300" />
            <div className="text-sm font-semibold text-slate-500">No jobs yet</div>
            <button
              onClick={openCreate}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Create first job
            </button>
          </div>
        ) : (
          filtered.map((j) => {
            const linked = candidates.filter((c) => c.jobId === j.id);
            const sc = STATUS_COLORS[j.status];
            return (
              <div
                key={j.id}
                className="rounded-xl border border-blue-100 bg-white p-4 hover:shadow-md transition-shadow"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-900">{j.title}</div>
                    <div className="text-[11px] text-slate-500">{j.department}</div>
                  </div>
                  <div
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{ background: sc.bg, color: sc.fg }}
                  >
                    {j.status.replace('_', ' ')}
                  </div>
                </div>

                <div className="mb-3 space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-slate-400" />
                    {j.location} · {j.branch}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign size={11} className="text-slate-400" />
                    {formatCurrency(j.salary_min, j.currency)} —{' '}
                    {formatCurrency(j.salary_max, j.currency)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={11} className="text-slate-400" />
                    {j.filled}/{j.openings} filled · {linked.length} applicants
                  </div>
                </div>

                {j.skills_required.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {j.skills_required.slice(0, 4).map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-medium text-brand-500"
                      >
                        {s}
                      </span>
                    ))}
                    {j.skills_required.length > 4 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                        +{j.skills_required.length - 4}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="text-[10px] text-slate-400">
                    Posted {formatDate(j.posted_date)}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(j)}
                      className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-brand-500"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${j.title}"?`)) {
                          onDeleteJob(j.id);
                          onToast('Job deleted', 'success');
                        }
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Job Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Job' : 'New Job Posting'}
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Title*">
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="e.g. Senior Site Engineer"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Department">
                  <input
                    value={draft.department}
                    onChange={(e) => setDraft({ ...draft, department: e.target.value })}
                    placeholder="e.g. Civil Engineering"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={draft.location}
                    onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Branch">
                  <select
                    value={draft.branch}
                    onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="HQ">HQ (Muscat)</option>
                    <option value="Sohar">Sohar</option>
                    <option value="Salalah">Salalah</option>
                    <option value="Nizwa">Nizwa</option>
                    <option value="Sur">Sur</option>
                  </select>
                </Field>
                <Field label="Employment Type">
                  <select
                    value={draft.employment_type}
                    onChange={(e) =>
                      setDraft({ ...draft, employment_type: e.target.value as any })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="open">Open</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
                <Field label="Openings">
                  <input
                    type="number"
                    min={1}
                    value={draft.openings}
                    onChange={(e) =>
                      setDraft({ ...draft, openings: parseInt(e.target.value) || 1 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Filled">
                  <input
                    type="number"
                    min={0}
                    value={draft.filled}
                    onChange={(e) =>
                      setDraft({ ...draft, filled: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Salary Min (OMR)">
                  <input
                    type="number"
                    min={0}
                    value={draft.salary_min}
                    onChange={(e) =>
                      setDraft({ ...draft, salary_min: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Salary Max (OMR)">
                  <input
                    type="number"
                    min={0}
                    value={draft.salary_max}
                    onChange={(e) =>
                      setDraft({ ...draft, salary_max: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
                <Field label="Closing Date">
                  <input
                    type="date"
                    value={draft.closing_date}
                    onChange={(e) => setDraft({ ...draft, closing_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                </Field>
              </div>

              <Field label="Description" className="mt-3">
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                  placeholder="Job description, scope, expectations..."
                />
              </Field>

              <Field label="Required Skills (comma-separated)" className="mt-3">
                <input
                  value={draft.skills_required.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      skills_required: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder="e.g. AutoCAD, Revit, Project Management"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                {editingId ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, children, className = ''
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
