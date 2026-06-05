import { useState, useMemo } from 'react';
import {
  Search, Sparkles, X, Eye, Filter, ChevronDown, ChevronRight,
  Briefcase, MapPin, Award, Users, AlertCircle
} from 'lucide-react';
import type { Candidate, JobPosting, Stage } from '../lib/types';
import { searchCandidates, EMPTY_FILTERS, type SearchFilters } from '../lib/search';
import { stageColors, avatarColor, getInitials, scoreColor } from '../lib/utils';
import NationalityAutocomplete from './NationalityAutocomplete';

interface AdvancedSearchProps {
  candidates: Candidate[];
  jobs: JobPosting[];
  onViewCandidate: (c: Candidate) => void;
}

export default function AdvancedSearch({
  candidates,
  jobs,
  onViewCandidate
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [skillInput, setSkillInput] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    skills: true,
    demographics: true,
    experience: true,
    pipeline: false
  });

  // Run the search
  const results = useMemo(() => searchCandidates(candidates, filters), [candidates, filters]);

  // Top skills across all candidates (for the quick-add chips)
  const topSkills = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      for (const s of [...(c.skills.technical || []), ...(c.skills.tools || [])]) {
        const k = s.trim();
        if (k) counts[k] = (counts[k] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [candidates]);

  // Top nationalities for the dropdown
  const allNationalities = useMemo(() => {
    const set = new Set<string>();
    for (const c of candidates) {
      const n = (c.personal.nationality || '').trim();
      if (n) set.add(n);
    }
    return [...set].sort();
  }, [candidates]);

  function addSkill(skill: string) {
    const s = skill.trim();
    if (!s) return;
    if (filters.skills.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    setFilters({ ...filters, skills: [...filters.skills, s] });
    setSkillInput('');
  }
  function removeSkill(skill: string) {
    setFilters({ ...filters, skills: filters.skills.filter((s) => s !== skill) });
  }
  function toggleStage(stage: Stage) {
    setFilters({
      ...filters,
      stages: filters.stages.includes(stage)
        ? filters.stages.filter((s) => s !== stage)
        : [...filters.stages, stage]
    });
  }
  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }

  const activeFilterCount =
    (filters.query ? 1 : 0) +
    filters.skills.length +
    (filters.nationality ? 1 : 0) +
    (filters.gender ? 1 : 0) +
    (filters.expMin != null ? 1 : 0) +
    (filters.expMax != null ? 1 : 0) +
    (filters.role ? 1 : 0) +
    (filters.location ? 1 : 0) +
    filters.stages.length +
    (filters.scoreMin != null ? 1 : 0) +
    (filters.omanizationOnly ? 1 : 0);

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── LEFT: Filters Sidebar ── */}
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-brand-500 dark:text-blue-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Filters
            </span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-[10px] font-semibold text-rose-500 hover:underline dark:text-rose-400"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* ── Skills ── */}
          <FilterSection
            title="Skills"
            isOpen={openSections.skills}
            onToggle={() => setOpenSections({ ...openSections, skills: !openSections.skills })}
            badge={filters.skills.length}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <Search size={11} className="text-slate-400" />
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSkill(skillInput);
                  }}
                  placeholder="Add skill, press Enter"
                  className="flex-1 bg-transparent text-[11px] outline-none dark:text-slate-100"
                />
                {skillInput && (
                  <button
                    onClick={() => addSkill(skillInput)}
                    className="text-[10px] font-semibold text-brand-500 dark:text-blue-300"
                  >
                    Add
                  </button>
                )}
              </div>

              {filters.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {filters.skills.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white"
                    >
                      {s}
                      <button onClick={() => removeSkill(s)} className="hover:opacity-70">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 cursor-pointer dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filters.semanticSkills}
                  onChange={(e) =>
                    setFilters({ ...filters, semanticSkills: e.target.checked })
                  }
                  className="rounded border-slate-300 accent-brand-500"
                />
                <Sparkles size={10} className="text-purple-500" />
                Semantic match (Java ≈ Spring Boot)
              </label>

              {topSkills.length > 0 && (
                <div>
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Popular skills
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {topSkills.slice(0, 12).map(([s, n]) => {
                      const active = filters.skills.some((x) => x.toLowerCase() === s.toLowerCase());
                      return (
                        <button
                          key={s}
                          onClick={() => active ? removeSkill(s) : addSkill(s)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            active
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {s} <span className="opacity-60">({n})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </FilterSection>

          {/* ── Demographics ── */}
          <FilterSection
            title="Demographics"
            isOpen={openSections.demographics}
            onToggle={() => setOpenSections({ ...openSections, demographics: !openSections.demographics })}
            badge={(filters.nationality ? 1 : 0) + (filters.gender ? 1 : 0) + (filters.omanizationOnly ? 1 : 0)}
          >
            <div className="space-y-2">
              <FilterField label="Nationality">
                <NationalityAutocomplete
                  value={filters.nationality}
                  onChange={(v) => setFilters({ ...filters, nationality: v })}
                  extras={allNationalities}
                  placeholder="Any"
                />
              </FilterField>
              <FilterField label="Gender">
                <select
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FilterField>
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 cursor-pointer dark:text-slate-300 pt-1">
                <input
                  type="checkbox"
                  checked={filters.omanizationOnly}
                  onChange={(e) =>
                    setFilters({ ...filters, omanizationOnly: e.target.checked })
                  }
                  className="rounded border-slate-300 accent-brand-500"
                />
                🇴🇲 Omanization-eligible only
              </label>
            </div>
          </FilterSection>

          {/* ── Experience & Role ── */}
          <FilterSection
            title="Experience & Role"
            isOpen={openSections.experience}
            onToggle={() => setOpenSections({ ...openSections, experience: !openSections.experience })}
            badge={(filters.expMin != null ? 1 : 0) + (filters.expMax != null ? 1 : 0) + (filters.role ? 1 : 0) + (filters.location ? 1 : 0)}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <FilterField label="Min years">
                  <input
                    type="number"
                    value={filters.expMin ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        expMin: e.target.value === '' ? null : parseInt(e.target.value)
                      })
                    }
                    placeholder="0"
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </FilterField>
                <FilterField label="Max years">
                  <input
                    type="number"
                    value={filters.expMax ?? ''}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        expMax: e.target.value === '' ? null : parseInt(e.target.value)
                      })
                    }
                    placeholder="40"
                    className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </FilterField>
              </div>
              <FilterField label="Current Role / Title">
                <input
                  value={filters.role}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                  placeholder="e.g. engineer, manager"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </FilterField>
              <FilterField label="Location">
                <input
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  placeholder="e.g. Muscat, Mumbai"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </FilterField>
            </div>
          </FilterSection>

          {/* ── Pipeline ── */}
          <FilterSection
            title="Pipeline"
            isOpen={openSections.pipeline}
            onToggle={() => setOpenSections({ ...openSections, pipeline: !openSections.pipeline })}
            badge={filters.stages.length + (filters.scoreMin != null ? 1 : 0)}
          >
            <div className="space-y-2">
              <FilterField label="Stages (multi-select)">
                <div className="flex flex-wrap gap-1">
                  {(['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as Stage[]).map((s) => {
                    const style = stageColors(s);
                    const active = filters.stages.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStage(s)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors`}
                        style={
                          active
                            ? { background: style.fg, color: '#fff' }
                            : { background: style.bg, color: style.fg }
                        }
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
              </FilterField>
              <FilterField label="Min AI Score">
                <input
                  type="number"
                  min={0} max={100}
                  value={filters.scoreMin ?? ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      scoreMin: e.target.value === '' ? null : parseInt(e.target.value)
                    })
                  }
                  placeholder="0-100"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </FilterField>
            </div>
          </FilterSection>
        </div>
      </aside>

      {/* ── RIGHT: Search bar + results ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="flex-shrink-0 border-b border-blue-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <Search size={14} className="text-slate-400" />
              <input
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                placeholder='Search... e.g.  python AND (django OR flask) NOT junior'
                className="flex-1 bg-transparent text-xs outline-none dark:text-slate-100"
              />
              {filters.query && (
                <button
                  onClick={() => setFilters({ ...filters, query: '' })}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 px-2 dark:text-slate-500">
              <strong>{results.length}</strong> / {candidates.length}
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            Tip: Use <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">AND</code>{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">OR</code>{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">NOT</code>, parens{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">()</code>, and quotes{' '}
            <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">"phrase"</code>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="rounded-xl border border-blue-100 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <AlertCircle size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                {candidates.length === 0 ? 'No candidates in system' : 'No matches found'}
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {activeFilterCount > 0 ? 'Try removing some filters' : 'Adjust your search query'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((r) => {
                const c = r.candidate;
                const style = stageColors(c.stage);
                const job = jobs.find((j) => j.id === c.jobId);
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-blue-100 bg-white p-3 hover:shadow-md transition-shadow cursor-pointer dark:border-slate-800 dark:bg-slate-900"
                    onClick={() => onViewCandidate(c)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: avatarColor(c.personal.full_name) }}
                      >
                        {getInitials(c.personal.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {c.personal.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 flex-wrap dark:text-slate-400">
                              {c.current_title && (
                                <span className="flex items-center gap-1">
                                  <Briefcase size={10} />{c.current_title}
                                </span>
                              )}
                              {c.total_experience_years > 0 && (
                                <span>{c.total_experience_years} yrs</span>
                              )}
                              {(c.personal.location || c.personal.city) && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={10} />{c.personal.location || c.personal.city}
                                </span>
                              )}
                              {c.personal.nationality && <span>{c.personal.nationality}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div
                                className="text-sm font-bold"
                                style={{ color: scoreColor(c.ai_score) }}
                              >
                                {c.ai_score}%
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500">AI score</div>
                            </div>
                            <div className="h-8 w-0.5 bg-slate-100 dark:bg-slate-700" />
                            <div className="text-right">
                              <div className="text-sm font-bold text-purple-600 dark:text-purple-300">
                                {Math.round(r.score * 100)}%
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500">relevance</div>
                            </div>
                          </div>
                        </div>

                        {/* Skill / term highlights */}
                        {(r.matchedSkills.length > 0 || r.matchedTerms.length > 0) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {r.matchedSkills.map((s, i) => (
                              <span
                                key={`s-${i}`}
                                className="rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-semibold text-purple-700 flex items-center gap-1 dark:bg-purple-900/30 dark:text-purple-300"
                              >
                                <Sparkles size={8} />
                                {s}
                              </span>
                            ))}
                            {r.matchedTerms.map((t, i) => (
                              <span
                                key={`t-${i}`}
                                className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-brand-500 dark:bg-blue-900/30 dark:text-blue-300"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: style.bg, color: style.fg }}
                            >
                              {style.label}
                            </span>
                            {job && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {job.title}
                              </span>
                            )}
                            {c.omanization_eligible && (
                              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                                🇴🇲 Eligible
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewCandidate(c);
                            }}
                            className="flex items-center gap-1 rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-brand-500 text-[10px] dark:text-slate-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
                          >
                            <Eye size={11} /> View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable filter section ──────────────────────────────────

function FilterSection({
  title, isOpen, onToggle, badge, children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  badge: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {badge > 0 && (
            <span className="rounded-full bg-brand-500 px-1.5 py-0 text-[9px] font-bold text-white">
              {badge}
            </span>
          )}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-slate-100 p-2.5 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
