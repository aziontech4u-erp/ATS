import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import type { Candidate, Stage, JobPosting } from '../lib/types';
import { stageColors, avatarColor, getInitials, scoreColor } from '../lib/utils';

const STAGES: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

interface PipelineViewProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  onUpdateCandidate: (id: string, patch: Partial<Candidate>) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PipelineView({
  candidates,
  jobs,
  onUpdateCandidate,
  onToast
}: PipelineViewProps) {
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const visible = jobFilter === 'all'
    ? candidates
    : candidates.filter((c) => c.jobId === jobFilter);

  function handleDrop(stage: Stage) {
    if (!draggedId) return;
    const c = candidates.find((x) => x.id === draggedId);
    if (c && c.stage !== stage) {
      onUpdateCandidate(draggedId, { stage });
      onToast(`Moved ${c.personal.full_name} → ${stage}`, 'success');
    }
    setDraggedId(null);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-blue-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Drag candidates between stages</p>
        </div>
        <div className="flex items-center gap-2">
          <Briefcase size={13} className="text-slate-400" />
          <select
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">All Jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        <div className="flex h-full gap-3" style={{ minWidth: '1400px' }}>
          {STAGES.map((stage) => {
            const stageItems = visible.filter((c) => c.stage === stage);
            const style = stageColors(stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
                className="flex w-60 flex-shrink-0 flex-col rounded-xl border border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className="flex items-center justify-between rounded-t-xl border-b border-slate-100 px-3 py-2.5 dark:border-slate-800"
                  style={{ background: style.bg }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: style.fg }}>
                    {style.label}
                  </div>
                  <div
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold"
                    style={{ color: style.fg }}
                  >
                    {stageItems.length}
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                  {stageItems.length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-slate-300 dark:text-slate-600">
                      Drop here
                    </div>
                  ) : (
                    stageItems.map((c) => {
                      const job = jobs.find((j) => j.id === c.jobId);
                      return (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={() => setDraggedId(c.id)}
                          onDragEnd={() => setDraggedId(null)}
                          className={`cursor-move rounded-lg border border-slate-200 bg-white p-2.5 hover:border-brand-500 hover:shadow-sm transition-all dark:border-slate-700 dark:bg-slate-800 ${
                            draggedId === c.id ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ background: avatarColor(c.personal.full_name) }}
                            >
                              {getInitials(c.personal.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                                {c.personal.full_name || 'Unknown'}
                              </div>
                              <div className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                                {c.current_title || c.filename}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div
                              className="text-[10px] font-bold"
                              style={{ color: scoreColor(c.ai_score) }}
                            >
                              {c.ai_score}%
                            </div>
                            {job && (
                              <div className="truncate rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-brand-500 max-w-[120px] dark:bg-blue-900/40 dark:text-blue-300">
                                {job.title}
                              </div>
                            )}
                          </div>
                          {c.total_experience_years > 0 && (
                            <div className="mt-1 text-[9px] text-slate-500 dark:text-slate-400">
                              {c.total_experience_years}y exp
                              {c.personal.nationality && ` · ${c.personal.nationality}`}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
