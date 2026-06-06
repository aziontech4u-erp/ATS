import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Plus, X,
  Trash2, CheckCircle2, Clock, Bell, Sparkles
} from 'lucide-react';
import type {
  Candidate, Interview, JobPosting, CalendarReminder, CalendarReminderKind
} from '../lib/types';
import {
  loadReminders, saveReminders, upsertReminder, deleteReminder,
  buildEvents, eventsByDate, startOfMonth, endOfMonth, toLocalDateKey,
  type CalEvent
} from '../lib/calendar';
import { uid } from '../lib/storage';
import { useUi } from '../lib/uiContext';

interface Props {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
}

const WEEKDAY_KEYS = ['wd.sun', 'wd.mon', 'wd.tue', 'wd.wed', 'wd.thu', 'wd.fri', 'wd.sat'];

export default function CalendarView({ candidates, jobs, interviews }: Props) {
  const { t } = useUi();
  const [reminders, setReminders] = useState<CalendarReminder[]>(() => loadReminders());
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateKey(new Date()));
  const [editing, setEditing] = useState<CalendarReminder | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { saveReminders(reminders); }, [reminders]);

  const events = useMemo(() => buildEvents(reminders, interviews), [reminders, interviews]);
  const eventMap = useMemo(() => eventsByDate(events), [events]);

  // Grid: leading empty cells before day 1, then days, padded to a 6-row grid
  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const cells: { key: string; date: string; inMonth: boolean; day: number }[] = [];
    // Leading days
    for (let i = first.getDay(); i > 0; i--) {
      const d = new Date(first.getFullYear(), first.getMonth(), 1 - i);
      cells.push({ key: 'lead-' + i, date: toLocalDateKey(d), inMonth: false, day: d.getDate() });
    }
    // In-month days
    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      cells.push({ key: 'm-' + day, date: toLocalDateKey(d), inMonth: true, day });
    }
    // Trailing pad to 42
    let extra = 1;
    while (cells.length < 42) {
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + extra);
      cells.push({ key: 't-' + extra, date: toLocalDateKey(d), inMonth: false, day: d.getDate() });
      extra++;
    }
    return cells;
  }, [cursor]);

  const todayKey = toLocalDateKey(new Date());
  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.date >= todayKey && !e.done)
      .slice(0, 12);
  }, [events, todayKey]);

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayKey && !e.done), [events, todayKey]);

  function go(months: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + months, 1));
  }

  function openCreate(date?: string) {
    setEditing(null);
    setSelectedDate(date || toLocalDateKey(new Date()));
    setShowCreate(true);
  }
  function openEdit(r: CalendarReminder) {
    setEditing(r);
    setSelectedDate(r.date);
    setShowCreate(true);
  }
  function saveReminder(r: CalendarReminder) {
    setReminders((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = r;
      else next.push(r);
      return next;
    });
    upsertReminder(r);
    setShowCreate(false);
    setEditing(null);
  }
  function removeReminder(id: string) {
    if (!confirm(t('cal.confirmDelete'))) return;
    setReminders((prev) => prev.filter((x) => x.id !== id));
    deleteReminder(id);
  }
  function toggleDone(r: CalendarReminder) {
    const next = { ...r, done: !r.done };
    setReminders((prev) => prev.map((x) => x.id === r.id ? next : x));
    upsertReminder(next);
  }

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <CalIcon size={18} className="text-brand-500" />
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">{monthLabel}</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => go(-1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft size={15} /></button>
              <button onClick={() => setCursor(startOfMonth(new Date()))} className="rounded border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t('cal.todayBtn')}</button>
              <button onClick={() => go(1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight size={15} /></button>
            </div>
          </div>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={13} /> {t('cal.addReminder')}
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-blue-100 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          {WEEKDAY_KEYS.map((k) => (
            <div key={k} className="px-2 py-1.5 text-center">{t(k)}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-7 overflow-y-auto">
          {grid.map((cell) => {
            const dayEvents = eventMap[cell.date] || [];
            const isToday = cell.date === todayKey;
            const isSelected = cell.date === selectedDate;
            return (
              <button
                key={cell.key}
                onClick={() => { setSelectedDate(cell.date); openCreate(cell.date); }}
                className={`flex h-full min-h-[90px] flex-col items-stretch border-b border-e border-slate-100 p-1.5 text-start transition-colors dark:border-slate-800 ${
                  cell.inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950'
                } ${isSelected ? 'ring-1 ring-inset ring-brand-500' : ''} hover:bg-blue-50/40 dark:hover:bg-blue-900/10`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isToday ? 'bg-brand-500 text-white'
                      : cell.inMonth ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'
                  }`}>
                    {cell.day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="rounded-full bg-blue-50 px-1.5 text-[9px] font-bold text-brand-500 dark:bg-blue-900/40 dark:text-blue-300">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`truncate rounded px-1 py-px text-[9.5px] font-medium ${
                        e.kind === 'interview'
                          ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      } ${e.done ? 'line-through opacity-60' : ''}`}
                      title={e.title}
                    >
                      {e.time ? `${e.time} ` : ''}{e.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9.5px] font-semibold text-slate-400">{t('cal.moreSuffix', { n: dayEvents.length - 3 })}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right side panel: Today + Upcoming */}
      <aside className="hidden w-72 flex-shrink-0 flex-col border-s border-blue-100 bg-white p-3 lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-500 dark:text-blue-300">
          <Bell size={12} /> {t('cal.today')}
        </div>
        <div className="mb-4 space-y-1.5">
          {todayEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400 dark:border-slate-700">
              {t('cal.noTodayItems')}
            </div>
          ) : todayEvents.map((e) => (
            <EventRow key={e.id} e={e} candidates={candidates} jobs={jobs} onToggle={toggleDone} onEdit={openEdit} onRemove={removeReminder} />
          ))}
        </div>

        <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Sparkles size={12} /> {t('cal.upcoming')}
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          {upcomingEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400 dark:border-slate-700">
              {t('cal.noUpcoming')}
            </div>
          ) : upcomingEvents.map((e) => (
            <EventRow key={e.id} e={e} candidates={candidates} jobs={jobs} onToggle={toggleDone} onEdit={openEdit} onRemove={removeReminder} />
          ))}
        </div>
      </aside>

      {showCreate && (
        <ReminderModal
          initial={editing}
          defaultDate={selectedDate}
          candidates={candidates}
          jobs={jobs}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSave={saveReminder}
        />
      )}
    </div>
  );
}

// ─── Event row in side panel ──────────────────────────────────────

function EventRow({
  e, candidates, jobs, onToggle, onEdit, onRemove
}: {
  e: CalEvent;
  candidates: Candidate[];
  jobs: JobPosting[];
  onToggle: (r: CalendarReminder) => void;
  onEdit: (r: CalendarReminder) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useUi();
  const candidate = e.candidateId ? candidates.find((c) => c.id === e.candidateId) : null;
  const job = e.jobId ? jobs.find((j) => j.id === e.jobId) : null;
  const isReminder = e.kind === 'reminder';

  return (
    <div className={`group rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 ${e.done ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {e.time && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <Clock size={10} /> {e.time}
              </span>
            )}
            <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${
              isReminder ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            }`}>
              {isReminder ? t('cal.kind.' + (e.raw as CalendarReminder).kind) : t('cal.kindInterview')}
            </span>
          </div>
          <div className={`mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-100 ${e.done ? 'line-through' : ''}`}>{e.title}</div>
          {(candidate || job) && (
            <div className="mt-0.5 truncate text-[10.5px] text-slate-500 dark:text-slate-400">
              {candidate ? candidate.personal.full_name : ''}{candidate && job ? ' · ' : ''}{job ? job.title : ''}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {isReminder && (
            <>
              <button onClick={() => onToggle(e.raw as CalendarReminder)} title="Toggle done" className="rounded p-1 text-slate-500 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-900/30">
                <CheckCircle2 size={12} />
              </button>
              <button onClick={() => onEdit(e.raw as CalendarReminder)} title="Edit" className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-brand-500 dark:hover:bg-blue-900/30">
                <Plus size={12} />
              </button>
              <button onClick={() => onRemove((e.raw as CalendarReminder).id)} title="Delete" className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reminder create/edit modal ────────────────────────────────────

function ReminderModal({
  initial, defaultDate, candidates, jobs, onClose, onSave
}: {
  initial: CalendarReminder | null;
  defaultDate: string;
  candidates: Candidate[];
  jobs: JobPosting[];
  onClose: () => void;
  onSave: (r: CalendarReminder) => void;
}) {
  const { t } = useUi();
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [time, setTime] = useState(initial?.time || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [kind, setKind] = useState<CalendarReminderKind>(initial?.kind || 'reminder');
  const [candidateId, setCandidateId] = useState(initial?.candidateId || '');
  const [jobId, setJobId] = useState(initial?.jobId || '');

  function save() {
    if (!title.trim() || !date) return;
    onSave({
      id: initial?.id || uid(),
      title: title.trim(),
      date,
      time,
      notes,
      kind,
      candidateId: candidateId || undefined,
      jobId: jobId || undefined,
      createdAt: initial?.createdAt || new Date().toISOString(),
      done: initial?.done || false
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{initial ? t('cal.modal.edit') : t('cal.modal.new')}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <Fld label={t('cal.field.title')}><input value={title} onChange={(e) => setTitle(e.target.value)} className={ipt} /></Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label={t('cal.field.date')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${ipt} dark:[color-scheme:dark]`} /></Fld>
            <Fld label={t('cal.field.time')}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${ipt} dark:[color-scheme:dark]`} /></Fld>
          </div>
          <Fld label={t('cal.field.kind')}>
            <select value={kind} onChange={(e) => setKind(e.target.value as CalendarReminderKind)} className={ipt}>
              <option value="reminder">{t('cal.kind.reminder')}</option>
              <option value="follow_up">{t('cal.kind.follow_up')}</option>
              <option value="task">{t('cal.kind.task')}</option>
              <option value="other">{t('cal.kind.other')}</option>
            </select>
          </Fld>
          <div className="grid grid-cols-2 gap-3">
            <Fld label={t('cal.field.candidate')}>
              <select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className={ipt}>
                <option value="">{t('cal.none')}</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.personal.full_name || c.personal.email || c.id}</option>)}
              </select>
            </Fld>
            <Fld label={t('cal.field.job')}>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={ipt}>
                <option value="">{t('cal.none')}</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </Fld>
          </div>
          <Fld label={t('cal.field.notes')}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${ipt} resize-y`} /></Fld>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{t('common.cancel')}</button>
          <button onClick={save} className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600">{initial ? t('common.save') : t('cal.add')}</button>
        </div>
      </div>
    </div>
  );
}

const ipt = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
