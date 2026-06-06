import { useState } from 'react';
import { Plus, Calendar, Clock, Video, MapPin, X, Trash2, ExternalLink } from 'lucide-react';
import type { Interview, Candidate, JobPosting } from '../lib/types';
import { uid } from '../lib/storage';
import { formatDateTime, avatarColor, getInitials } from '../lib/utils';
import { useUi } from '../lib/uiContext';

interface InterviewsViewProps {
  interviews: Interview[];
  candidates: Candidate[];
  jobs: JobPosting[];
  onAddInterview: (i: Interview) => void;
  onUpdateInterview: (id: string, patch: Partial<Interview>) => void;
  onDeleteInterview: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const EMPTY: Omit<Interview, 'id'> = {
  candidate_id: '',
  job_id: '',
  type: 'technical',
  scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  duration_minutes: 60,
  location: '',
  meeting_link: '',
  interviewer: '',
  status: 'scheduled'
};

const STATUS_COLORS: Record<Interview['status'], { bg: string; fg: string }> = {
  scheduled:   { bg: '#eff3ff', fg: '#2756e8' },
  completed:   { bg: '#dcfce7', fg: '#15803d' },
  cancelled:   { bg: '#fee2e2', fg: '#991b1b' },
  rescheduled: { bg: '#fef3c7', fg: '#b45309' },
  no_show:     { bg: '#fee2e2', fg: '#991b1b' }
};

export default function InterviewsView({
  interviews,
  candidates,
  jobs,
  onAddInterview,
  onUpdateInterview,
  onDeleteInterview,
  onToast
}: InterviewsViewProps) {
  const { t } = useUi();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState<Interview['status'] | 'all' | 'upcoming'>('upcoming');
  const FILTER_LABEL: Record<typeof filter, string> = {
    upcoming: t('inter.upcoming'),
    all: t('inter.all'),
    scheduled: t('inter.scheduled'),
    completed: t('inter.completed'),
    cancelled: t('inter.cancelled'),
    rescheduled: t('inter.scheduled'),
    no_show: t('inter.cancelled')
  };

  function save() {
    if (!draft.candidate_id) {
      onToast('Select a candidate', 'error');
      return;
    }
    if (!draft.scheduled_at) {
      onToast('Schedule date required', 'error');
      return;
    }
    onAddInterview({ id: uid(), ...draft });
    onToast('Interview scheduled', 'success');
    setShowForm(false);
    setDraft(EMPTY);
  }

  let filtered = interviews;
  if (filter === 'upcoming') {
    filtered = interviews.filter(
      (i) => i.status === 'scheduled' && new Date(i.scheduled_at) >= new Date()
    );
  } else if (filter !== 'all') {
    filtered = interviews.filter((i) => i.status === filter);
  }
  filtered = [...filtered].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('inter.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('inter.count', { n: interviews.length })}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={14} />
          {t('inter.schedule')}
        </button>
      </div>

      <div className="mb-3 flex gap-1.5">
        {(['upcoming', 'all', 'scheduled', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
              filter === s
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {FILTER_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <Calendar size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">{t('inter.empty')}</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
          >
            {t('inter.scheduleFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => {
            const candidate = candidates.find((c) => c.id === i.candidate_id);
            const job = jobs.find((j) => j.id === i.job_id);
            const status = STATUS_COLORS[i.status];
            return (
              <div key={i.id} className="rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  {candidate && (
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: avatarColor(candidate.personal.full_name) }}
                    >
                      {getInitials(candidate.personal.full_name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {candidate?.personal.full_name || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {job?.title || candidate?.current_title || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ background: status.bg, color: status.fg }}
                        >
                          {i.status}
                        </span>
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {i.type}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        {formatDateTime(i.scheduled_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-slate-400" />
                        {i.duration_minutes} min
                      </span>
                      {i.interviewer && (
                        <span>
                          <strong>{t('inter.interviewer')}:</strong> {i.interviewer}
                        </span>
                      )}
                      {i.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-slate-400" />
                          {i.location}
                        </span>
                      )}
                      {i.meeting_link && (
                        <a
                          href={i.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-brand-500 hover:underline dark:text-blue-300"
                        >
                          <Video size={11} />
                          {t('inter.joinMeeting')}
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                    {i.feedback && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <strong>{t('inter.feedback')}:</strong> {i.feedback}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <select
                        value={i.status}
                        onChange={(e) =>
                          onUpdateInterview(i.id, { status: e.target.value as any })
                        }
                        className="rounded border border-slate-200 px-2 py-0.5 text-[10px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rescheduled">Rescheduled</option>
                        <option value="no_show">No Show</option>
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(t('inter.confirmDelete'))) {
                            onDeleteInterview(i.id);
                            onToast(t('inter.deletedToast'), 'success');
                          }
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{t('inter.modalTitle')}</div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.candidate')}
                </label>
                <select
                  value={draft.candidate_id}
                  onChange={(e) => setDraft({ ...draft, candidate_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select candidate...</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.personal.full_name || c.filename}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.job')}
                </label>
                <select
                  value={draft.job_id}
                  onChange={(e) => setDraft({ ...draft, job_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('inter.field.type')}
                  </label>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="phone">{t('inter.type.phone')}</option>
                    <option value="video">{t('inter.type.video')}</option>
                    <option value="technical">{t('inter.type.technical')}</option>
                    <option value="panel">{t('inter.type.panel')}</option>
                    <option value="final">{t('inter.type.final')}</option>
                    <option value="cultural">{t('inter.type.cultural')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('inter.field.duration')}
                  </label>
                  <input
                    type="number"
                    value={draft.duration_minutes}
                    onChange={(e) =>
                      setDraft({ ...draft, duration_minutes: parseInt(e.target.value) || 60 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.scheduledAt')}
                </label>
                <input
                  type="datetime-local"
                  value={draft.scheduled_at}
                  onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.interviewer')}
                </label>
                <input
                  value={draft.interviewer}
                  onChange={(e) => setDraft({ ...draft, interviewer: e.target.value })}
                  placeholder="Interviewer name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.location')}
                </label>
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  placeholder="Office, address, or 'Online'"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('inter.field.meetingLink')}
                </label>
                <input
                  value={draft.meeting_link}
                  onChange={(e) => setDraft({ ...draft, meeting_link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                {t('inter.schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
