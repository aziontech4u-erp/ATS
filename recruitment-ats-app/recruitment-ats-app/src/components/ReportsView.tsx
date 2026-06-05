import type { Candidate, JobPosting, Interview, OfferLetter, Stage } from '../lib/types';
import { stageColors, scoreColor } from '../lib/utils';
import { TrendingUp, Award, Users, Briefcase } from 'lucide-react';

interface ReportsViewProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
}

export default function ReportsView({
  candidates,
  jobs,
  interviews,
  offers
}: ReportsViewProps) {
  // Stage distribution
  const stageDist: Record<Stage, number> = {
    applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0
  };
  candidates.forEach((c) => stageDist[c.stage]++);

  // Score buckets
  const scoreBuckets = { excellent: 0, good: 0, fair: 0, weak: 0 };
  candidates.forEach((c) => {
    if (c.ai_score >= 80) scoreBuckets.excellent++;
    else if (c.ai_score >= 60) scoreBuckets.good++;
    else if (c.ai_score >= 40) scoreBuckets.fair++;
    else scoreBuckets.weak++;
  });

  // Source breakdown
  const sources: Record<string, number> = {};
  candidates.forEach((c) => {
    sources[c.source || 'Upload'] = (sources[c.source || 'Upload'] || 0) + 1;
  });

  // Nationality breakdown
  const nationalities: Record<string, number> = {};
  candidates.forEach((c) => {
    const n = c.personal.nationality || 'Unspecified';
    nationalities[n] = (nationalities[n] || 0) + 1;
  });
  const nationalityList = Object.entries(nationalities).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Top skills
  const skillCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    (c.skills.technical || []).forEach((s) => {
      skillCounts[s] = (skillCounts[s] || 0) + 1;
    });
  });
  const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Conversion funnel
  const total = candidates.length || 1;
  const screenedPlus = candidates.filter((c) =>
    ['screening', 'interview', 'offer', 'hired'].includes(c.stage)
  ).length;
  const interviewPlus = candidates.filter((c) =>
    ['interview', 'offer', 'hired'].includes(c.stage)
  ).length;
  const offerPlus = candidates.filter((c) =>
    ['offer', 'hired'].includes(c.stage)
  ).length;
  const hired = candidates.filter((c) => c.stage === 'hired').length;

  // Job stats
  const openJobs = jobs.filter((j) => j.status === 'open').length;
  const totalOpenings = jobs.reduce((s, j) => s + j.openings, 0);
  const totalFilled = jobs.reduce((s, j) => s + j.filled, 0);

  // Omanization rate
  const omanEligible = candidates.filter((c) => c.omanization_eligible).length;
  const omanRate = candidates.length > 0 ? Math.round((omanEligible / candidates.length) * 100) : 0;

  // Avg AI score
  const avgScore = candidates.length > 0
    ? Math.round(candidates.reduce((s, c) => s + c.ai_score, 0) / candidates.length)
    : 0;

  // Offer acceptance rate
  const respondedOffers = offers.filter((o) => ['accepted', 'rejected'].includes(o.status));
  const acceptedOffers = offers.filter((o) => o.status === 'accepted').length;
  const acceptanceRate = respondedOffers.length > 0
    ? Math.round((acceptedOffers / respondedOffers.length) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-xs text-slate-500">Hiring metrics and pipeline insights</p>
      </div>

      {/* Top KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard icon={Users} label="Total Candidates" value={candidates.length} color="#2756e8" />
        <MetricCard icon={Award} label="Avg AI Score" value={`${avgScore}%`} color="#15803d" />
        <MetricCard icon={Briefcase} label="Active Jobs" value={openJobs} color="#7c3aed" />
        <MetricCard icon={TrendingUp} label="Offer Acceptance" value={`${acceptanceRate}%`} color="#d97706" />
      </div>

      {/* Conversion Funnel */}
      <div className="mb-5 rounded-xl border border-blue-100 bg-white p-5">
        <div className="mb-3 text-sm font-bold text-slate-900">Hiring Funnel</div>
        <div className="space-y-2.5">
          <FunnelBar label="Total Applicants" count={candidates.length} total={total} color="#2756e8" />
          <FunnelBar label="Screened & Beyond" count={screenedPlus} total={total} color="#7c3aed" />
          <FunnelBar label="Reached Interview" count={interviewPlus} total={total} color="#d97706" />
          <FunnelBar label="Received Offer" count={offerPlus} total={total} color="#10b981" />
          <FunnelBar label="Hired" count={hired} total={total} color="#0f766e" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stage Distribution */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">Candidates by Stage</div>
          <div className="space-y-2">
            {(Object.keys(stageDist) as Stage[]).map((s) => {
              const style = stageColors(s);
              const count = stageDist[s];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s}>
                  <div className="mb-0.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold" style={{ color: style.fg }}>{style.label}</span>
                    <span className="font-bold text-slate-600">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: style.fg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Distribution */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">AI Score Distribution</div>
          <div className="space-y-2">
            <ScoreBar label="Excellent (80-100)" count={scoreBuckets.excellent} total={total} color="#15803d" />
            <ScoreBar label="Good (60-79)" count={scoreBuckets.good} total={total} color="#d97706" />
            <ScoreBar label="Fair (40-59)" count={scoreBuckets.fair} total={total} color="#7c3aed" />
            <ScoreBar label="Weak (0-39)" count={scoreBuckets.weak} total={total} color="#dc2626" />
          </div>
        </div>

        {/* Top Skills */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">Top 10 Technical Skills</div>
          {topSkills.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No skills data yet
            </div>
          ) : (
            <div className="space-y-1.5">
              {topSkills.map(([skill, count], i) => {
                const max = topSkills[0][1];
                const pct = (count / max) * 100;
                return (
                  <div key={skill} className="flex items-center gap-2">
                    <div className="w-6 text-[10px] font-bold text-slate-400">#{i + 1}</div>
                    <div className="flex-1">
                      <div className="mb-0.5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700">{skill}</span>
                        <span className="font-bold text-brand-500">{count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nationality breakdown */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 flex items-center justify-between text-sm font-bold text-slate-900">
            <span>Candidate Nationality</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
              🇴🇲 {omanRate}% Omanization Eligible
            </span>
          </div>
          {nationalityList.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">No data yet</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {nationalityList.map(([nat, count]) => (
                <div
                  key={nat}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"
                >
                  <span className="text-[11px] font-medium text-slate-700">{nat}</span>
                  <span className="text-[11px] font-bold text-brand-500">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source breakdown */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">Candidate Sources</div>
          {Object.keys(sources).length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">No data yet</div>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(sources).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-700">{src}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-brand-500">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job/Hiring stats */}
        <div className="rounded-xl border border-blue-100 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">Job Posting Summary</div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Total Jobs" value={jobs.length} />
            <Stat label="Open Jobs" value={openJobs} color="#15803d" />
            <Stat label="Total Openings" value={totalOpenings} />
            <Stat label="Positions Filled" value={totalFilled} color="#7c3aed" />
            <Stat label="Total Interviews" value={interviews.length} />
            <Stat label="Total Offers" value={offers.length} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: color + '20', color }}
        >
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function FunnelBar({
  label, count, total, color
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-slate-600">
          {count} <span className="text-slate-400">({pct}%)</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ScoreBar({
  label, count, total, color
}: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-[11px] font-medium text-slate-600">{label}</div>
      <div className="flex-1">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <div className="w-12 text-right text-[11px] font-bold" style={{ color }}>
        {count}
      </div>
    </div>
  );
}

function Stat({ label, value, color = '#0f172a' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}
