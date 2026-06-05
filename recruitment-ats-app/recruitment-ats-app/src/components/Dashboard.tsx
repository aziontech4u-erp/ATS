import {
  Users, Briefcase, Calendar, FileSignature, TrendingUp, Award,
  ArrowRight, Sparkles, Upload, ScanLine, AlertTriangle, Search
} from 'lucide-react';
import type { Candidate, JobPosting, Interview, OfferLetter, AppView, Stage } from '../lib/types';
import { stageColors, avatarColor, getInitials, scoreColor } from '../lib/utils';
import { findAllDuplicates } from '../lib/dedup';

interface DashboardProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
  apiKeyConnected: boolean;
  onNavigate: (v: AppView) => void;
}

export default function Dashboard({
  candidates,
  jobs,
  interviews,
  offers,
  apiKeyConnected,
  onNavigate
}: DashboardProps) {
  const openJobs = jobs.filter((j) => j.status === 'open');
  const upcoming = interviews
    .filter((i) => i.status === 'scheduled' && new Date(i.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const pendingOffers = offers.filter((o) => o.status === 'sent');
  const totalOpenings = openJobs.reduce((s, j) => s + j.openings, 0);
  const totalFilled = jobs.reduce((s, j) => s + j.filled, 0);

  // Stage distribution
  const stageDist: Record<Stage, number> = {
    applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0
  };
  candidates.forEach((c) => stageDist[c.stage]++);

  const topCandidates = [...candidates]
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 5);

  // Duplicates
  const duplicates = candidates.length > 1 ? findAllDuplicates(candidates) : [];
  const highConfidenceDupes = duplicates.filter((d) => d.confidence >= 0.85);

  // Top skills distribution
  const skillCounts: Record<string, number> = {};
  for (const c of candidates) {
    for (const s of [...(c.skills.technical || []), ...(c.skills.tools || [])]) {
      const k = s.trim();
      if (k) skillCounts[k] = (skillCounts[k] || 0) + 1;
    }
  }
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500">Recruitment overview & hiring pipeline</p>
        </div>
        <button
          onClick={() => onNavigate('parser')}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-md hover:opacity-90"
        >
          <Upload size={14} />
          Parse Resume
        </button>
      </div>

      {/* AI Status Banner */}
      {!apiKeyConnected && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-200 text-amber-700">
            <Sparkles size={16} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-amber-900">
              Unlock AI-powered resume parsing
            </div>
            <div className="text-[11px] text-amber-700">
              Add an OpenAI or Anthropic API key in Settings to extract full candidate profiles
              automatically.
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Alert */}
      {highConfidenceDupes.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-200 text-rose-700">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-rose-900">
              {highConfidenceDupes.length} potential duplicate{highConfidenceDupes.length > 1 ? 's' : ''} detected
            </div>
            <div className="text-[11px] text-rose-700">
              {highConfidenceDupes.slice(0, 2).map((d, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  <strong>{d.candidate.personal.full_name}</strong> ≈{' '}
                  <strong>{d.match.personal.full_name}</strong> ({Math.round(d.confidence * 100)}%)
                </span>
              ))}
              {highConfidenceDupes.length > 2 && ` · +${highConfidenceDupes.length - 2} more`}
            </div>
          </div>
          <button
            onClick={() => onNavigate('candidates')}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700"
          >
            Review
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI
          icon={Users}
          label="Candidates"
          value={candidates.length}
          sub={`${stageDist.applied} new`}
          color="#2756e8"
          onClick={() => onNavigate('candidates')}
        />
        <KPI
          icon={Briefcase}
          label="Open Jobs"
          value={openJobs.length}
          sub={`${totalOpenings} openings`}
          color="#15803d"
          onClick={() => onNavigate('jobs')}
        />
        <KPI
          icon={Calendar}
          label="Interviews"
          value={upcoming.length}
          sub="Upcoming"
          color="#d97706"
          onClick={() => onNavigate('interviews')}
        />
        <KPI
          icon={FileSignature}
          label="Pending Offers"
          value={pendingOffers.length}
          sub={`${offers.filter((o) => o.status === 'accepted').length} accepted`}
          color="#7c3aed"
          onClick={() => onNavigate('offers')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Pipeline Stage Distribution */}
        <div className="rounded-xl border border-blue-100 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Hiring Pipeline
            </div>
            <button
              onClick={() => onNavigate('pipeline')}
              className="flex items-center gap-1 text-[10px] font-semibold text-brand-500 hover:underline"
            >
              View pipeline <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {(Object.keys(stageDist) as Stage[]).map((s) => {
              const style = stageColors(s);
              return (
                <div
                  key={s}
                  className="rounded-lg p-2.5 text-center"
                  style={{ background: style.bg }}
                >
                  <div className="text-2xl font-bold" style={{ color: style.fg }}>
                    {stageDist[s]}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.fg }}>
                    {style.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hiring Progress */}
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Hiring Progress
            </div>
            <TrendingUp size={14} className="text-green-600" />
          </div>
          <div className="space-y-3">
            <ProgressBar label="Positions Filled" current={totalFilled} total={Math.max(totalOpenings + totalFilled, 1)} color="#15803d" />
            <ProgressBar label="Offers Accepted" current={offers.filter((o) => o.status === 'accepted').length} total={Math.max(offers.length, 1)} color="#7c3aed" />
            <ProgressBar label="Interview Complete" current={interviews.filter((i) => i.status === 'completed').length} total={Math.max(interviews.length, 1)} color="#d97706" />
          </div>
        </div>

        {/* Top Candidates */}
        <div className="rounded-xl border border-blue-100 bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Top Candidates by AI Score
            </div>
            <Award size={14} className="text-amber-500" />
          </div>
          {topCandidates.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <ScanLine size={32} className="mx-auto mb-2 opacity-40" />
              <div className="text-xs font-semibold text-slate-500">No candidates yet</div>
              <button
                onClick={() => onNavigate('parser')}
                className="mt-3 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                Parse first resume →
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {topCandidates.map((c) => {
                const style = stageColors(c.stage);
                return (
                  <div
                    key={c.id}
                    onClick={() => onNavigate('candidates')}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: avatarColor(c.personal.full_name) }}
                    >
                      {getInitials(c.personal.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {c.personal.full_name || 'Unknown'}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {c.current_title || c.filename}
                      </div>
                    </div>
                    <div
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: style.bg, color: style.fg }}
                    >
                      {style.label}
                    </div>
                    <div className="text-sm font-bold" style={{ color: scoreColor(c.ai_score) }}>
                      {c.ai_score}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Interviews */}
        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Upcoming Interviews
            </div>
            <button
              onClick={() => onNavigate('interviews')}
              className="text-[10px] font-semibold text-brand-500 hover:underline"
            >
              View all
            </button>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-6 text-center text-slate-400">
              <Calendar size={28} className="mx-auto mb-1.5 opacity-40" />
              <div className="text-[11px] font-semibold text-slate-500">No upcoming interviews</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcoming.slice(0, 5).map((i) => {
                const candidate = candidates.find((c) => c.id === i.candidate_id);
                return (
                  <div key={i.id} className="rounded-lg bg-slate-50 p-2">
                    <div className="text-[11px] font-semibold text-slate-900">
                      {candidate?.personal.full_name || 'Unknown'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {i.type} · {new Date(i.scheduled_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Skills Distribution */}
        <div className="rounded-xl border border-blue-100 bg-white p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Top Skills in Talent Pool
            </div>
            <button
              onClick={() => onNavigate('search')}
              className="flex items-center gap-1 text-[10px] font-semibold text-brand-500 hover:underline"
            >
              <Search size={11} /> Advanced search
            </button>
          </div>
          {topSkills.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No skills data yet — upload some resumes
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {topSkills.map(([skill, count]) => {
                const max = topSkills[0][1];
                const pct = (count / max) * 100;
                return (
                  <button
                    key={skill}
                    onClick={() => onNavigate('search')}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-left hover:bg-blue-50 hover:border-brand-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700 truncate" title={skill}>
                        {skill}
                      </span>
                      <span className="text-[11px] font-bold text-brand-500 ml-1 flex-shrink-0">
                        {count}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon, label, value, sub, color, onClick
}: any) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-blue-100 bg-white p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="mb-2 flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: color + '20', color }}
        >
          <Icon size={16} />
        </div>
        <ArrowRight size={14} className="text-slate-300" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-0.5 text-[10px] text-slate-400">{sub}</div>
    </button>
  );
}

function ProgressBar({
  label, current, total, color
}: { label: string; current: number; total: number; color: string }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold" style={{ color }}>
          {current}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
