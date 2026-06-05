// ─────────────────────────────────────────────────────────────
// ADVANCED SEARCH ENGINE
//
// Features:
//  • Boolean operators: AND, OR, NOT (case-insensitive)
//  • Quoted phrases:   "machine learning"
//  • Multi-field filters: skills, nationality, gender, experience range, role, location
//  • Semantic skill expansion via skillOntology
//  • Relevance scoring: keyword hits + skill match weight + AI score boost
//
// Example queries:
//   python AND (django OR flask) NOT junior
//   "site reliability" AND aws
//   senior developer
// ─────────────────────────────────────────────────────────────

import type { Candidate, Stage } from './types';
import { expandSkill, areSimilar } from './skillOntology';

export interface SearchFilters {
  query: string;                  // boolean query string
  skills: string[];               // required skills (AND logic between them)
  semanticSkills: boolean;        // expand skills via ontology
  nationality: string;            // exact match or substring
  gender: string;                 // exact match
  expMin: number | null;
  expMax: number | null;
  role: string;                   // current title substring
  location: string;               // city/country substring
  stages: Stage[];                // multi-select; empty = all
  scoreMin: number | null;
  omanizationOnly: boolean;
}

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  skills: [],
  semanticSkills: true,
  nationality: '',
  gender: '',
  expMin: null,
  expMax: null,
  role: '',
  location: '',
  stages: [],
  scoreMin: null,
  omanizationOnly: false
};

export interface SearchResult {
  candidate: Candidate;
  score: number;                 // relevance 0..1
  matchedTerms: string[];        // for highlighting
  matchedSkills: string[];       // semantic matches surfaced
}

// ─── BOOLEAN QUERY PARSER ────────────────────────────────────
// Grammar:
//   expr   := term ((AND|OR) term)*
//   term   := NOT? atom
//   atom   := "phrase" | word | (expr)

type Node =
  | { type: 'term'; value: string; negate: boolean }
  | { type: 'and' | 'or'; left: Node; right: Node };

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push(c);
      i++;
      continue;
    }
    if (c === '"') {
      // Quoted phrase
      const end = input.indexOf('"', i + 1);
      if (end === -1) {
        tokens.push(input.slice(i + 1));
        break;
      }
      tokens.push('"' + input.slice(i + 1, end) + '"');
      i = end + 1;
      continue;
    }
    // Word (until whitespace or paren)
    let j = i;
    while (j < input.length && !/[\s()]/.test(input[j])) j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

function parseQuery(input: string): Node | null {
  if (!input.trim()) return null;
  const tokens = tokenize(input);
  let pos = 0;

  function parseExpr(): Node | null {
    let left = parseTerm();
    if (!left) return null;
    while (pos < tokens.length) {
      const op = tokens[pos]?.toUpperCase();
      if (op === 'AND' || op === 'OR') {
        pos++;
        const right = parseTerm();
        if (!right) break;
        left = { type: op === 'AND' ? 'and' : 'or', left, right };
      } else if (op === ')') {
        break;
      } else {
        // Implicit AND (e.g. "python react")
        const right = parseTerm();
        if (!right) break;
        left = { type: 'and', left, right };
      }
    }
    return left;
  }

  function parseTerm(): Node | null {
    if (pos >= tokens.length) return null;
    let negate = false;
    if (tokens[pos]?.toUpperCase() === 'NOT') {
      negate = true;
      pos++;
    }
    if (tokens[pos] === '(') {
      pos++; // consume (
      const inner = parseExpr();
      if (tokens[pos] === ')') pos++;
      if (!inner) return null;
      if (negate) {
        // Wrap in negation by negating all leaves
        return negateNode(inner);
      }
      return inner;
    }
    const tok = tokens[pos];
    if (!tok || tok === ')' || tok.toUpperCase() === 'AND' || tok.toUpperCase() === 'OR') {
      return null;
    }
    pos++;
    const value = tok.startsWith('"') ? tok.slice(1, -1) : tok;
    return { type: 'term', value: value.toLowerCase(), negate };
  }

  function negateNode(n: Node): Node {
    if (n.type === 'term') return { ...n, negate: !n.negate };
    return { type: n.type === 'and' ? 'or' : 'and', left: negateNode(n.left), right: negateNode(n.right) };
  }

  return parseExpr();
}

// ─── EVALUATE QUERY ──────────────────────────────────────────

interface EvalResult {
  matched: boolean;
  hits: string[];      // terms that matched (for highlighting)
  score: number;       // sum of term weights
}

function evalNode(node: Node, haystack: string): EvalResult {
  if (node.type === 'term') {
    const found = haystack.includes(node.value);
    const matched = node.negate ? !found : found;
    return {
      matched,
      hits: found && !node.negate ? [node.value] : [],
      score: matched && !node.negate ? 1 : 0
    };
  }
  const l = evalNode(node.left, haystack);
  const r = evalNode(node.right, haystack);
  if (node.type === 'and') {
    return {
      matched: l.matched && r.matched,
      hits: [...l.hits, ...r.hits],
      score: l.matched && r.matched ? l.score + r.score : 0
    };
  }
  // or
  return {
    matched: l.matched || r.matched,
    hits: [...l.hits, ...r.hits],
    score: l.score + r.score
  };
}

// ─── HAYSTACK BUILDER ────────────────────────────────────────

function buildHaystack(c: Candidate): string {
  return [
    c.personal.full_name,
    c.personal.email,
    c.personal.location,
    c.personal.city,
    c.personal.country,
    c.personal.nationality,
    c.current_title,
    c.professional_summary,
    c.visa_status,
    ...(c.skills.technical || []),
    ...(c.skills.tools || []),
    ...(c.skills.soft || []),
    ...(c.skills.languages || []),
    ...c.work_experience.flatMap((w) => [
      w.company, w.title, w.location,
      ...(w.responsibilities || []),
      ...(w.achievements || [])
    ]),
    ...c.education.flatMap((e) => [e.institution, e.degree, e.field]),
    ...c.certifications.map((x) => x.name),
    ...c.recommended_roles
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();
}

// ─── SEMANTIC SKILL MATCH ────────────────────────────────────

function candidateMatchesSkill(c: Candidate, skill: string, semantic: boolean): { matched: boolean; matchedAs: string | null } {
  const allCandidateSkills = [
    ...(c.skills.technical || []),
    ...(c.skills.tools || []),
    ...(c.skills.soft || [])
  ];
  // Direct match (case-insensitive)
  const direct = allCandidateSkills.find((s) => s.toLowerCase() === skill.toLowerCase());
  if (direct) return { matched: true, matchedAs: direct };

  // Substring match
  const sub = allCandidateSkills.find(
    (s) => s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase())
  );
  if (sub) return { matched: true, matchedAs: sub };

  if (!semantic) return { matched: false, matchedAs: null };

  // Semantic expansion
  const expanded = expandSkill(skill);
  for (const variant of expanded) {
    const found = allCandidateSkills.find(
      (s) => s.toLowerCase() === variant.toLowerCase() || s.toLowerCase().includes(variant.toLowerCase())
    );
    if (found) return { matched: true, matchedAs: found + ' (≈ ' + skill + ')' };
    // Also check if any candidate skill is similar via ontology
    const similar = allCandidateSkills.find((s) => areSimilar(s, skill));
    if (similar) return { matched: true, matchedAs: similar + ' (≈ ' + skill + ')' };
  }

  return { matched: false, matchedAs: null };
}

// ─── MAIN SEARCH FUNCTION ────────────────────────────────────

export function searchCandidates(
  candidates: Candidate[],
  filters: SearchFilters
): SearchResult[] {
  const queryNode = parseQuery(filters.query);
  const results: SearchResult[] = [];

  for (const c of candidates) {
    // ── Apply hard filters first ──
    if (filters.nationality) {
      const nat = c.personal.nationality?.toLowerCase() || '';
      if (!nat.includes(filters.nationality.toLowerCase())) continue;
    }
    if (filters.gender) {
      if ((c.personal.gender || '').toLowerCase() !== filters.gender.toLowerCase()) continue;
    }
    if (filters.expMin != null && c.total_experience_years < filters.expMin) continue;
    if (filters.expMax != null && c.total_experience_years > filters.expMax) continue;
    if (filters.role) {
      if (!(c.current_title || '').toLowerCase().includes(filters.role.toLowerCase())) continue;
    }
    if (filters.location) {
      const loc = `${c.personal.location || ''} ${c.personal.city || ''} ${c.personal.country || ''}`.toLowerCase();
      if (!loc.includes(filters.location.toLowerCase())) continue;
    }
    if (filters.stages.length > 0 && !filters.stages.includes(c.stage)) continue;
    if (filters.scoreMin != null && c.ai_score < filters.scoreMin) continue;
    if (filters.omanizationOnly && !c.omanization_eligible) continue;

    // ── Skills filter (AND logic between required skills) ──
    const matchedSkills: string[] = [];
    let skillsPassed = true;
    for (const skill of filters.skills) {
      const { matched, matchedAs } = candidateMatchesSkill(c, skill, filters.semanticSkills);
      if (!matched) {
        skillsPassed = false;
        break;
      }
      if (matchedAs) matchedSkills.push(matchedAs);
    }
    if (!skillsPassed) continue;

    // ── Boolean query ──
    let queryScore = 0;
    let matchedTerms: string[] = [];
    if (queryNode) {
      const haystack = buildHaystack(c);
      const result = evalNode(queryNode, haystack);
      if (!result.matched) continue;
      queryScore = result.score;
      matchedTerms = [...new Set(result.hits)];
    }

    // ── Relevance score ──
    // Combines: query hits (40%) + skill matches (30%) + AI score (30%)
    const queryWeight = queryNode ? Math.min(queryScore / 5, 1) * 0.4 : 0.2;
    const skillWeight = filters.skills.length > 0 ? (matchedSkills.length / filters.skills.length) * 0.3 : 0.15;
    const aiWeight = (c.ai_score / 100) * 0.3;
    const relevance = queryWeight + skillWeight + aiWeight + 0.05; // small base boost

    results.push({
      candidate: c,
      score: Math.min(relevance, 1),
      matchedTerms,
      matchedSkills
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Counts how many candidates match if we ADD a particular skill to the filters.
 * Used for live filter-count previews ("Python (12)", "React (8)").
 */
export function countByAddingSkill(
  candidates: Candidate[],
  filters: SearchFilters,
  skill: string
): number {
  const newFilters = { ...filters, skills: [...filters.skills, skill] };
  return searchCandidates(candidates, newFilters).length;
}
