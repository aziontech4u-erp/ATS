import type { CalendarReminder, Interview } from './types';

const KEY = 'recruitment_ats_reminders_v1';

export function loadReminders(): CalendarReminder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CalendarReminder[];
  } catch {
    return [];
  }
}

export function saveReminders(items: CalendarReminder[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function upsertReminder(r: CalendarReminder) {
  const list = loadReminders();
  const idx = list.findIndex((x) => x.id === r.id);
  if (idx >= 0) list[idx] = r;
  else list.push(r);
  saveReminders(list);
}

export function deleteReminder(id: string) {
  saveReminders(loadReminders().filter((r) => r.id !== id));
}

// ─── Aggregation ──────────────────────────────────────────────────

export type CalEventKind = 'interview' | 'reminder';
export type CalEventSeverity = 'info' | 'past' | 'today' | 'upcoming';

export interface CalEvent {
  id: string;
  kind: CalEventKind;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  title: string;
  subtitle?: string;
  notes?: string;
  candidateId?: string;
  jobId?: string;
  done?: boolean;
  raw: CalendarReminder | Interview;
}

export function toLocalDateKey(d: Date): string {
  // YYYY-MM-DD in local timezone
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function interviewToEvent(iv: Interview): CalEvent | null {
  if (!iv.scheduled_at) return null;
  const d = new Date(iv.scheduled_at);
  if (isNaN(d.getTime())) return null;
  const date = toLocalDateKey(d);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return {
    id: `iv:${iv.id}`,
    kind: 'interview',
    date,
    time,
    title: `${iv.type.charAt(0).toUpperCase() + iv.type.slice(1)} Interview`,
    subtitle: iv.interviewer || iv.location || iv.meeting_link,
    notes: iv.notes,
    candidateId: iv.candidate_id,
    jobId: iv.job_id,
    done: iv.status === 'completed' || iv.status === 'cancelled' || iv.status === 'no_show',
    raw: iv
  };
}

function reminderToEvent(r: CalendarReminder): CalEvent {
  return {
    id: `rm:${r.id}`,
    kind: 'reminder',
    date: r.date,
    time: r.time,
    title: r.title,
    subtitle: r.kind.replace('_', ' '),
    notes: r.notes,
    candidateId: r.candidateId,
    jobId: r.jobId,
    done: r.done,
    raw: r
  };
}

export function buildEvents(reminders: CalendarReminder[], interviews: Interview[]): CalEvent[] {
  const fromIv = interviews.map(interviewToEvent).filter(Boolean) as CalEvent[];
  const fromRm = reminders.map(reminderToEvent);
  return [...fromIv, ...fromRm].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });
}

export function eventsByDate(events: CalEvent[]): Record<string, CalEvent[]> {
  const map: Record<string, CalEvent[]> = {};
  events.forEach((e) => {
    (map[e.date] = map[e.date] || []).push(e);
  });
  return map;
}

export function countToday(events: CalEvent[], today = new Date()): number {
  const key = toLocalDateKey(today);
  return events.filter((e) => e.date === key && !e.done).length;
}
