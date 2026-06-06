import { useRef, useState } from 'react';
import {
  Upload, Search, FileText, User, Briefcase, GraduationCap,
  Sparkles, FileCode, Mail, Phone, MapPin, Clock,
  Award, Check, AlertCircle, X
} from 'lucide-react';
import type { Candidate, Stage, JobPosting } from '../lib/types';
import { readFile, parseResume, PROCESSING_STEPS } from '../lib/resumeParser';
import { findDuplicates } from '../lib/dedup';
import { uid } from '../lib/storage';
import {
  getInitials, avatarColor, stageColors, scoreColor, scoreLabel
} from '../lib/utils';
import { useUi } from '../lib/uiContext';

interface ResumeParserViewProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  apiKey: string;
  onAddCandidate: (c: Candidate) => void;
  onUpdateCandidate: (id: string, patch: Partial<Candidate>) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const STAGES: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
type Tab = 'profile' | 'experience' | 'education' | 'skills' | 'ai' | 'raw';

export default function ResumeParserView({
  candidates,
  jobs,
  apiKey,
  onAddCandidate,
  onUpdateCandidate,
  onToast
}: ResumeParserViewProps) {
  const { t } = useUi();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [currentFile, setCurrentFile] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [editField, setEditField] = useState<string | null>(null);
  // Session-only queue of IDs parsed in this visit. No auto-clear — the
  // recruiter explicitly hits "Clear All" below when they're done.
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());

  function clearSession() {
    setSessionIds(new Set());
    setSelectedId(null);
    setTab('profile');
  }
  // Bulk-upload progress
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; duplicates: number; added: number }>({
    current: 0, total: 0, duplicates: 0, added: 0
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = candidates.find((c) => c.id === selectedId);

  const filtered = candidates.filter((c) => {
    if (!sessionIds.has(c.id)) return false; // parser shows only this-session items
    if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        c.personal.full_name,
        c.current_title,
        c.personal.email,
        c.personal.nationality,
        c.personal.location,
        ...(c.skills.technical || []),
        ...(c.skills.soft || [])
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function processFiles(files: FileList | File[]) {
    if (busy || !files || files.length === 0) return;
    const fileList = Array.from(files);
    setBusy(true);
    setBulkProgress({ current: 0, total: fileList.length, duplicates: 0, added: 0 });

    // Local tracking copy so dedup sees in-progress additions
    let workingList = [...candidates];
    let duplicatesSkipped = 0;
    let addedCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setCurrentFile(file.name);
      setCurrentStep(-1);
      setBulkProgress((p) => ({ ...p, current: i + 1 }));

      // Skip step animation in bulk mode (>3 files) to speed things up
      const fastMode = fileList.length > 3;
      for (let s = 0; s < PROCESSING_STEPS.length; s++) {
        setCurrentStep(s);
        await new Promise((r) => setTimeout(r, fastMode ? 80 : (s <= 1 ? 420 : 220)));
      }

      const text = await readFile(file);
      const parsed = await parseResume(text, file.name, apiKey);

      const candidate: Candidate = {
        id: uid(),
        filename: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        uploadedAt: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        stage: 'applied',
        source: 'Upload',
        rawText: text,
        ...parsed
      };

      // ── Duplicate check ──
      const duplicates = findDuplicates(candidate, workingList);
      const highConfidence = duplicates.find((d) => d.confidence >= 0.90);

      if (highConfidence) {
        duplicatesSkipped++;
        setBulkProgress((p) => ({ ...p, duplicates: p.duplicates + 1 }));
        if (fileList.length === 1) {
          // Single upload: prompt the user
          const choice = confirm(
            `⚠ Possible duplicate detected!\n\n` +
            `New: ${candidate.personal.full_name}\n` +
            `Existing: ${highConfidence.match.personal.full_name}\n\n` +
            `Reason: ${highConfidence.reasons.join(', ')}\n` +
            `Confidence: ${Math.round(highConfidence.confidence * 100)}%\n\n` +
            `Click OK to ADD anyway as a separate record, or Cancel to SKIP.`
          );
          if (!choice) {
            onToast(`Skipped duplicate: ${candidate.personal.full_name}`, 'info');
            continue;
          }
        } else {
          // Bulk upload: silently skip, log to toast at end
          continue;
        }
      }

      onAddCandidate(candidate);
      workingList = [...workingList, candidate];
      addedCount++;
      setBulkProgress((p) => ({ ...p, added: p.added + 1 }));
      // Add to this-session queue so the parser list shows it
      setSessionIds((prev) => {
        const next = new Set(prev);
        next.add(candidate.id);
        return next;
      });

      // For single uploads or last file in bulk, select it
      if (fileList.length === 1 || i === fileList.length - 1) {
        setSelectedId(candidate.id);
        setTab('profile');
      }

      if (fileList.length === 1) {
        onToast(
          `✅ ${candidate.personal.full_name || file.name} extracted (Score: ${candidate.ai_score}%)`,
          'success'
        );
      }
    }

    setBusy(false);
    setCurrentStep(-1);
    setCurrentFile('');

    // Bulk summary
    if (fileList.length > 1) {
      const msgParts = [`Bulk upload complete: ${addedCount} added`];
      if (duplicatesSkipped > 0) msgParts.push(`${duplicatesSkipped} duplicates skipped`);
      onToast(msgParts.join(' · '), duplicatesSkipped > 0 ? 'info' : 'success');
    }

    // Clear bulk progress after a delay so user sees the final state.
    // Note: parsed items persist in the list until the user explicitly hits
    // the "Clear All" button below.
    setTimeout(() => setBulkProgress({ current: 0, total: 0, duplicates: 0, added: 0 }), 4000);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }

  function triggerBulkUpload() {
    // Re-open the file picker for multiple files (same as clicking the upload zone)
    fileInputRef.current?.click();
  }

  function updateField(path: string, value: any) {
    if (!selected) return;
    const parts = path.split('.');
    const patch: any = { ...selected };
    let target = patch;
    for (let i = 0; i < parts.length - 1; i++) {
      target[parts[i]] = { ...target[parts[i]] };
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] =
      parts[parts.length - 1] === 'total_experience_years'
        ? parseInt(value) || 0
        : value;
    onUpdateCandidate(selected.id, patch);
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── LEFT PANEL: Upload + Candidate List ── */}
      <div className="flex w-72 flex-shrink-0 flex-col border-r border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Upload Zone */}
        <div className="p-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
              dragOver
                ? 'border-brand-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-blue-200 bg-slate-50 hover:border-brand-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-blue-900/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              multiple
              onChange={(e) => e.target.files && processFiles(e.target.files)}
              className="hidden"
            />
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-brand-500 dark:bg-blue-900/40 dark:text-blue-300">
              <Upload size={18} />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {busy ? t('parser.parsing', { file: currentFile }) : t('parser.dropTitle')}
            </div>
            <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
              {t('parser.dropSub')}
            </div>
          </div>
        </div>

        {/* Bulk Progress (shown when uploading >1 file) */}
        {bulkProgress.total > 1 && (
          <div className="mx-3 mb-2 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-2.5 dark:border-blue-900/60 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
              <span className="text-brand-500 dark:text-blue-300">📦 {t('parser.bulkUpload')}</span>
              <span className="text-slate-600 dark:text-slate-300">
                {bulkProgress.current} / {bulkProgress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-600 transition-all"
                style={{
                  width: `${(bulkProgress.current / Math.max(bulkProgress.total, 1)) * 100}%`
                }}
              />
            </div>
            <div className="mt-1.5 flex gap-3 text-[11px]">
              <span className="font-semibold text-green-700 dark:text-green-400">✓ {t('parser.added', { n: bulkProgress.added })}</span>
              {bulkProgress.duplicates > 0 && (
                <span className="font-semibold text-amber-700 dark:text-amber-300">⚠ {t('parser.dupes', { n: bulkProgress.duplicates })}</span>
              )}
            </div>
          </div>
        )}

        {/* Processing Steps */}
        {busy && (
          <div className="mx-3 mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-1.5 text-sm font-bold text-brand-500 dark:text-blue-300">⚙ {t('parser.aiParsing')}</div>
            {PROCESSING_STEPS.map((step, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              return (
                <div
                  key={i}
                  className={`mb-0.5 flex items-center gap-1.5 rounded px-1.5 py-1 ${
                    done ? 'bg-green-50 dark:bg-green-900/30' : active ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-slate-800'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      done ? 'bg-green-600' : active ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    {done ? '✓' : active ? '◉' : i + 1}
                  </div>
                  <span
                    className={`text-[11px] ${
                      done
                        ? 'text-green-700 font-medium dark:text-green-300'
                        : active
                        ? 'text-brand-500 font-semibold dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {step}
                  </span>
                  {active && <div className="spinner ml-auto !h-3 !w-3" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="mx-3 mb-1.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
          <Search size={12} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('parser.searchPlaceholder')}
            className="w-full bg-transparent text-sm outline-none dark:text-slate-100"
          />
        </div>

        {/* Stage Filters */}
        <div className="mx-3 mb-2 flex flex-wrap gap-1">
          {(['all', ...STAGES] as const).map((s) => {
            const active = stageFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-brand-200 bg-blue-50 text-brand-500 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-slate-600 dark:text-slate-400">
              <FileText size={28} className="mx-auto mb-2 opacity-40" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {sessionIds.size ? t('parser.noMatches') : t('parser.ready')}
              </div>
              <div className="mt-1 text-xs">
                {sessionIds.size ? t('parser.tryFilter') : t('parser.readyHint')}
              </div>
            </div>
          ) : (
            filtered.map((c) => {
              const stageStyle = stageColors(c.stage);
              const sel = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id);
                    setTab('profile');
                  }}
                  className={`mb-1 flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                    sel
                      ? 'border-brand-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: avatarColor(c.personal.full_name) }}
                  >
                    {getInitials(c.personal.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {c.personal.full_name || 'Unknown'}
                    </div>
                    <div className="truncate text-xs text-slate-700 dark:text-slate-300">
                      {c.current_title || c.filename}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div
                      className="text-sm font-bold"
                      style={{ color: scoreColor(c.ai_score) }}
                    >
                      {c.ai_score}%
                    </div>
                    <div
                      className="mt-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold"
                      style={{ background: stageStyle.bg, color: stageStyle.fg }}
                    >
                      {stageStyle.label}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom action bar: Add More + Clear All */}
        <div className="border-t border-slate-100 p-3 flex gap-2 dark:border-slate-800">
          <button
            onClick={triggerBulkUpload}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-2.5 text-base font-semibold text-brand-500 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            <Upload size={14} />
            {busy ? t('parser.parsingDots') : sessionIds.size > 0 ? t('parser.addMore', { n: sessionIds.size }) : t('parser.uploadResumes')}
          </button>
          <button
            onClick={clearSession}
            disabled={busy || sessionIds.size === 0}
            title={t('parser.clearAll')}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-base font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-rose-900/60 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50"
          >
            <X size={14} /> {t('parser.clearAll')}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: Profile View ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-600 dark:text-slate-400">
            <div className="mb-3 text-5xl">📄</div>
            <div className="mb-1 text-base font-semibold text-slate-700 dark:text-slate-300">
              {t('parser.getStarted')}
            </div>
            <div className="max-w-sm text-sm text-slate-400 leading-relaxed dark:text-slate-500">
              {t('parser.getStartedHint')}
            </div>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <ProfileHeader
              candidate={selected}
              jobs={jobs}
              onStageChange={(s) => onUpdateCandidate(selected.id, { stage: s })}
              onJobLink={(jobId) => onUpdateCandidate(selected.id, { jobId })}
            />

            {/* Tabs */}
            <div className="flex flex-shrink-0 overflow-x-auto border-b border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
              {(
                [
                  ['profile', 'Personal', User],
                  ['experience', 'Experience', Briefcase],
                  ['education', 'Education', GraduationCap],
                  ['skills', 'Skills', Sparkles],
                  ['ai', 'AI Insights', Sparkles],
                  ['raw', 'Raw Text', FileCode]
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${
                    tab === k
                      ? 'border-brand-500 font-semibold text-brand-500 dark:text-blue-300'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
              {tab === 'profile' && (
                <ProfileTab
                  candidate={selected}
                  editField={editField}
                  setEditField={setEditField}
                  onUpdate={updateField}
                />
              )}
              {tab === 'experience' && <ExperienceTab candidate={selected} />}
              {tab === 'education' && <EducationTab candidate={selected} />}
              {tab === 'skills' && <SkillsTab candidate={selected} />}
              {tab === 'ai' && <AIInsightsTab candidate={selected} />}
              {tab === 'raw' && (
                <RawTab
                  candidate={selected}
                  onCopy={() => {
                    navigator.clipboard.writeText(selected.rawText || '');
                    onToast('Copied raw text', 'success');
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function ProfileHeader({
  candidate: c,
  jobs,
  onStageChange,
  onJobLink
}: {
  candidate: Candidate;
  jobs: JobPosting[];
  onStageChange: (s: Stage) => void;
  onJobLink: (jobId: string) => void;
}) {
  const sc = scoreColor(c.ai_score);
  const circ = 2 * Math.PI * 30;
  const fill = circ * (1 - c.ai_score / 100);
  const openJobs = jobs.filter((j) => j.status === 'open');

  return (
    <div className="flex-shrink-0 border-b border-blue-100 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: avatarColor(c.personal.full_name) }}
        >
          {getInitials(c.personal.full_name)}
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
            {c.personal.full_name || 'Unknown'}
          </div>
          <div className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{c.current_title || '—'}</div>

          {/* Contact Pills */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {c.personal.email && (
              <Pill icon={Mail} bg="#eff3ff" fg="#2756e8">
                {c.personal.email}
              </Pill>
            )}
            {c.personal.phone && (
              <Pill icon={Phone} bg="#ecfeff" fg="#0891b2">
                {c.personal.phone}
              </Pill>
            )}
            {(c.personal.location || c.personal.city) && (
              <Pill icon={MapPin} bg="#f7f9ff" fg="#7b8db0">
                {c.personal.location || c.personal.city}
              </Pill>
            )}
            {c.total_experience_years > 0 && (
              <Pill icon={Clock} bg="#f0fdf4" fg="#15803d">
                {c.total_experience_years} yrs exp
              </Pill>
            )}
            {c.omanization_eligible && (
              <Pill icon={Award} bg="#ccfbf1" fg="#0f766e">
                🇴🇲 Omanization
              </Pill>
            )}
          </div>

          {/* Stage Buttons */}
          <div className="mt-2 flex flex-wrap gap-1">
            {STAGES.map((s) => {
              const stageStyle = stageColors(s);
              const active = c.stage === s;
              return (
                <button
                  key={s}
                  onClick={() => onStageChange(s)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-${active ? 'bold' : 'medium'} transition-colors`}
                  style={
                    active
                      ? { background: stageStyle.fg, color: '#fff' }
                      : { background: stageStyle.bg, color: stageStyle.fg }
                  }
                >
                  {stageStyle.label}
                </button>
              );
            })}
          </div>

          {/* Job Link */}
          {openJobs.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide dark:text-slate-400">
                Job:
              </span>
              <select
                value={c.jobId || ''}
                onChange={(e) => onJobLink(e.target.value)}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Not assigned</option>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.department}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Score Circle */}
        <div className="flex-shrink-0 text-center">
          <svg width="70" height="70" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r="30" fill="none" stroke="#f0f2f8" strokeWidth="7" className="dark:[stroke:#334155]" />
            <circle
              className="score-ring"
              cx="35"
              cy="35"
              r="30"
              fill="none"
              stroke={sc}
              strokeWidth="7"
              strokeDasharray={circ}
              strokeDashoffset={fill}
              strokeLinecap="round"
              transform="rotate(-90 35 35)"
            />
            <text
              x="35"
              y="40"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill={sc}
              fontFamily="DM Sans, sans-serif"
            >
              {c.ai_score}
            </text>
          </svg>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">AI SCORE</div>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children, bg, fg }: any) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      <Icon size={10} />
      {children}
    </span>
  );
}

function Card({ children, title, color = '#2756e8' }: any) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <div
          className="mb-2 text-xs font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function FieldRow({
  label,
  value,
  field,
  editField,
  setEditField,
  onUpdate
}: {
  label: string;
  value: string;
  field: string;
  editField: string | null;
  setEditField: (s: string | null) => void;
  onUpdate: (path: string, value: any) => void;
}) {
  const editing = editField === field;
  return (
    <div className="flex items-start gap-2 border-b border-slate-50 py-1 dark:border-slate-800">
      <div className="w-28 flex-shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
        {label}
      </div>
      {editing ? (
        <input
          autoFocus
          defaultValue={value}
          onBlur={(e) => {
            onUpdate(field, e.target.value);
            setEditField(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditField(null);
          }}
          className="flex-1 rounded border border-brand-500 px-2 py-0.5 text-sm outline-none dark:bg-slate-800 dark:text-slate-100"
        />
      ) : (
        <div
          onClick={() => setEditField(field)}
          className={`flex-1 cursor-pointer rounded px-1.5 py-0.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
            value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {value || '— click to edit —'}
        </div>
      )}
    </div>
  );
}

function ProfileTab({
  candidate: c,
  editField,
  setEditField,
  onUpdate
}: {
  candidate: Candidate;
  editField: string | null;
  setEditField: (s: string | null) => void;
  onUpdate: (path: string, value: any) => void;
}) {
  const p = c.personal;
  const fr = (label: string, value: string, field: string) => (
    <FieldRow
      label={label}
      value={value}
      field={field}
      editField={editField}
      setEditField={setEditField}
      onUpdate={onUpdate}
    />
  );
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div>
        <Card title="Personal Information" color="#2756e8">
          {fr('Full Name', p.full_name, 'personal.full_name')}
          {fr('Email', p.email, 'personal.email')}
          {fr('Phone', p.phone, 'personal.phone')}
          {fr('Location', p.location, 'personal.location')}
          {fr('City', p.city, 'personal.city')}
          {fr('Country', p.country, 'personal.country')}
          {fr('Nationality', p.nationality, 'personal.nationality')}
          {fr('Gender', p.gender, 'personal.gender')}
          {fr('Date of Birth', p.date_of_birth, 'personal.date_of_birth')}
          {fr('Marital Status', p.marital_status, 'personal.marital_status')}
        </Card>
      </div>
      <div className="space-y-3">
        <Card title="Professional" color="#0891b2">
          {fr('Current Title', c.current_title, 'current_title')}
          {fr('Experience Yrs', String(c.total_experience_years), 'total_experience_years')}
          {fr('Notice Period', c.notice_period, 'notice_period')}
          {fr('Expected Salary', c.expected_salary, 'expected_salary')}
          {fr('Visa Status', c.visa_status, 'visa_status')}
          {fr('Source', c.source, 'source')}
        </Card>
        <Card title="Online Profiles" color="#7c3aed">
          {fr('LinkedIn', p.linkedin, 'personal.linkedin')}
          {fr('Website', p.website, 'personal.website')}
        </Card>
        <Card title="Summary" color="#15803d">
          <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {c.professional_summary || (
              <span className="text-slate-600 dark:text-slate-400">No summary extracted</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExperienceTab({ candidate: c }: { candidate: Candidate }) {
  const ex = c.work_experience || [];
  if (!ex.length) {
    return (
      <Card>
        <div className="py-7 text-center">
          <Briefcase size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">No work experience extracted</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add an AI key for detailed extraction
          </div>
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-2.5">
      {ex.map((e, i) => (
        <div key={i} className="rounded-xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{e.title}</div>
              <div className="text-sm font-medium text-brand-500 dark:text-blue-300">{e.company}</div>
              {e.location && (
                <div className="text-xs text-slate-700 dark:text-slate-300">{e.location}</div>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {e.start_date} — {e.current ? 'Present' : e.end_date}
              </div>
              {e.duration && (
                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">{e.duration}</div>
              )}
            </div>
          </div>
          {(e.responsibilities || []).length > 0 && (
            <div className="mt-1.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Responsibilities
              </div>
              <ul className="ml-3.5 list-disc space-y-0.5">
                {e.responsibilities.map((r, j) => (
                  <li key={j} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(e.achievements || []).length > 0 && (
            <div className="mt-1.5">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
                Achievements
              </div>
              <ul className="ml-3.5 list-disc space-y-0.5">
                {e.achievements.map((a, j) => (
                  <li key={j} className="text-sm leading-relaxed text-green-700 dark:text-green-300">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EducationTab({ candidate: c }: { candidate: Candidate }) {
  const ed = c.education || [];
  const ce = c.certifications || [];
  const aw = c.awards || [];
  return (
    <div className="space-y-2.5">
      {ed.length === 0 ? (
        <Card>
          <div className="py-6 text-center text-slate-600 dark:text-slate-400">
            <GraduationCap size={32} className="mx-auto mb-1.5 text-slate-300 dark:text-slate-600" />
            No education extracted
          </div>
        </Card>
      ) : (
        ed.map((e, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {e.degree}
                  {e.field && ` — ${e.field}`}
                </div>
                <div className="mt-0.5 text-sm font-medium text-brand-500 dark:text-blue-300">
                  {e.institution}
                </div>
                {e.grade && (
                  <div className="mt-0.5 text-xs text-green-700 dark:text-green-400">Grade: {e.grade}</div>
                )}
              </div>
              <div className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {e.start_year}
                {e.end_year && ` — ${e.end_year}`}
              </div>
            </div>
          </Card>
        ))
      )}
      {ce.length > 0 && (
        <>
          <div className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Certifications
          </div>
          {ce.map((x, i) => (
            <div key={i} className="rounded-lg border border-blue-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{x.name}</div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {x.issuer}
                {x.year && ` · ${x.year}`}
                {x.expiry && ` · Expires: ${x.expiry}`}
              </div>
            </div>
          ))}
        </>
      )}
      {aw.length > 0 && (
        <>
          <div className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Awards
          </div>
          {aw.map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-blue-100 bg-white p-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {typeof a === 'string' ? a : JSON.stringify(a)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SkillsTab({ candidate: c }: { candidate: Candidate }) {
  const sk = c.skills;
  const tagList = (items: string[], bg: string, fg: string) =>
    items && items.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {items.map((s, i) => (
          <span
            key={i}
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: bg, color: fg }}
          >
            {s}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-xs text-slate-600 dark:text-slate-400">None detected</span>
    );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="space-y-3">
        <Card title="Technical Skills" color="#2756e8">
          {tagList(sk.technical, '#eff3ff', '#2756e8')}
        </Card>
        <Card title="Soft Skills" color="#15803d">
          {tagList(sk.soft, '#f0fdf4', '#15803d')}
        </Card>
        <Card title="Languages" color="#0891b2">
          {tagList(sk.languages, '#ecfeff', '#0891b2')}
        </Card>
      </div>
      <div className="space-y-3">
        <Card title="Tools & Platforms" color="#7c3aed">
          {tagList(sk.tools, '#ede9fe', '#7c3aed')}
        </Card>
        <Card title="Certifications" color="#d97706">
          {tagList(sk.certifications, '#fffbeb', '#d97706')}
        </Card>
        {c.projects.length > 0 && (
          <Card title="Projects" color="#0f766e">
            <div className="space-y-2">
              {c.projects.map((p, i) => (
                <div key={i} className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                  <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">{p.description}</div>
                  {p.tech_used.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tech_used.map((t, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function AIInsightsTab({ candidate: c }: { candidate: Candidate }) {
  const sc = scoreColor(c.ai_score);
  const circ = 2 * Math.PI * 26;
  const fill = circ * (1 - c.ai_score / 100);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="text-center">
            <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#f0f2f8" strokeWidth="7" className="dark:[stroke:#334155]" />
              <circle
                className="score-ring"
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke={sc}
                strokeWidth="7"
                strokeDasharray={circ}
                strokeDashoffset={fill}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
              <text
                x="32"
                y="36"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill={sc}
                fontFamily="DM Sans, sans-serif"
              >
                {c.ai_score}
              </text>
            </svg>
            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              {scoreLabel(c.ai_score)}
            </div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-300">
              <Check size={11} /> Strengths
            </div>
            {c.ai_strengths.length > 0 ? (
              c.ai_strengths.map((s, i) => (
                <div key={i} className="py-0.5 text-sm text-green-700 dark:text-green-300">
                  • {s}
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-400">Add AI key for insights</div>
            )}
          </div>
          <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-900/20">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
              <AlertCircle size={11} /> Concerns
            </div>
            {c.ai_concerns.length > 0 ? (
              c.ai_concerns.map((s, i) => (
                <div key={i} className="py-0.5 text-sm text-rose-600 dark:text-rose-300">
                  • {s}
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-400">None flagged</div>
            )}
          </div>
        </div>
      </div>

      <Card title="Recommended Roles" color="#7c3aed">
        {c.recommended_roles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {c.recommended_roles.map((r, i) => (
              <span
                key={i}
                className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                {r}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Add AI key for role recommendations
          </span>
        )}
      </Card>

      <Card title="File Details" color="#0891b2">
        <div className="flex flex-wrap gap-3 text-sm text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1">
            <FileText size={12} /> {c.filename}
          </span>
          <span>{c.fileSize}</span>
          <span>📅 {c.uploadedAt}</span>
          <span>🔗 {c.source}</span>
          {c.omanization_eligible && (
            <span className="text-teal-700 dark:text-teal-300">🇴🇲 Omanization eligible</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function RawTab({ candidate: c, onCopy }: { candidate: Candidate; onCopy: () => void }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Raw Text — {(c.rawText || '').length} chars from {c.filename}
        </div>
        <button
          onClick={onCopy}
          className="rounded bg-blue-50 px-3 py-1 text-xs font-medium text-brand-500 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-600 whitespace-pre-wrap break-words dark:bg-slate-800 dark:text-slate-300">
        {c.rawText || 'No text was extracted from this file.\n\nTip: For image-based PDFs, an AI key with vision capability is required.'}
      </pre>
    </Card>
  );
}
