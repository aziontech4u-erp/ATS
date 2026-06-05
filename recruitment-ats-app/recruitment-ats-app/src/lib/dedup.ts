// ─────────────────────────────────────────────────────────────
// DEDUPLICATION ENGINE
// Detects duplicate candidates using a layered approach:
//   1. Email exact match  (confidence 1.0)
//   2. Phone exact match  (confidence 0.95)
//   3. Name + DOB         (confidence 0.90)
//   4. Fuzzy name match   (confidence 0.70-0.85)
//
// Merge strategy: longer/non-empty wins per field, skills are unioned,
// work_experience is unioned by company+title key.
// ─────────────────────────────────────────────────────────────

import type { Candidate } from './types';

export interface DuplicateMatch {
  candidate: Candidate;
  match: Candidate;
  confidence: number;          // 0..1
  reasons: string[];           // human-readable
}

// ─── HELPERS ────────────────────────────────────────────────

function normalizeEmail(e: string): string {
  return (e || '').toLowerCase().trim().replace(/\s+/g, '');
}

function normalizePhone(p: string): string {
  return (p || '').replace(/[^\d]/g, '').replace(/^0+/, '');
}

function normalizeName(n: string): string {
  return (n || '')
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|prof|sir|madam)\.?\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Levenshtein distance (small implementation, sufficient for names)
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Token-set similarity: how many tokens overlap (handles "John Doe" vs "Doe, John")
  const ta = new Set(na.split(/\s+/));
  const tb = new Set(nb.split(/\s+/));
  const intersection = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  const tokenScore = union > 0 ? intersection / union : 0;
  // Char-level similarity
  const maxLen = Math.max(na.length, nb.length);
  const charScore = maxLen > 0 ? 1 - levenshtein(na, nb) / maxLen : 0;
  return (tokenScore * 0.6) + (charScore * 0.4);
}

// ─── DUPLICATE DETECTION ─────────────────────────────────────

/**
 * Given a candidate (typically being added), find all existing candidates
 * that look like duplicates. Returns matches sorted by confidence desc.
 * Excludes the candidate itself if it's already in the list (by id).
 */
export function findDuplicates(
  candidate: Candidate,
  existing: Candidate[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  const candEmail = normalizeEmail(candidate.personal.email);
  const candPhone = normalizePhone(candidate.personal.phone);
  const candName = normalizeName(candidate.personal.full_name);
  const candDob = (candidate.personal.date_of_birth || '').trim();

  for (const other of existing) {
    if (other.id === candidate.id) continue;

    const reasons: string[] = [];
    let confidence = 0;

    const otherEmail = normalizeEmail(other.personal.email);
    const otherPhone = normalizePhone(other.personal.phone);
    const otherName = normalizeName(other.personal.full_name);
    const otherDob = (other.personal.date_of_birth || '').trim();

    // Layer 1: Email exact match (strongest signal)
    if (candEmail && otherEmail && candEmail === otherEmail) {
      confidence = Math.max(confidence, 1.0);
      reasons.push(`Same email (${candidate.personal.email})`);
    }

    // Layer 2: Phone exact match (digits-only, 7+)
    if (candPhone && otherPhone && candPhone.length >= 7 && candPhone === otherPhone) {
      confidence = Math.max(confidence, 0.95);
      reasons.push(`Same phone (${candidate.personal.phone})`);
    }

    // Layer 3: Name + DOB (both present, both match)
    if (candName && otherName && candDob && otherDob && candDob === otherDob) {
      const nameMatch = nameSimilarity(candidate.personal.full_name, other.personal.full_name);
      if (nameMatch >= 0.7) {
        confidence = Math.max(confidence, 0.90);
        reasons.push(`Same name + DOB (similarity ${Math.round(nameMatch * 100)}%)`);
      }
    }

    // Layer 4: Fuzzy name match (only when other layers don't fire — avoid false positives)
    if (reasons.length === 0 && candName && otherName) {
      const sim = nameSimilarity(candidate.personal.full_name, other.personal.full_name);
      if (sim >= 0.85) {
        confidence = Math.max(confidence, 0.70 + (sim - 0.85) * 1.0); // 0.70..0.85
        reasons.push(`Very similar name (${Math.round(sim * 100)}% match)`);
      }
    }

    if (reasons.length > 0) {
      matches.push({ candidate, match: other, confidence, reasons });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Bulk scan: returns all duplicate pairs across the entire candidate list.
 * Each pair is reported once (no reverse duplicates).
 */
export function findAllDuplicates(candidates: Candidate[]): DuplicateMatch[] {
  const allMatches: DuplicateMatch[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    const matches = findDuplicates(candidates[i], candidates.slice(i + 1));
    for (const m of matches) {
      const pairKey = [m.candidate.id, m.match.id].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      allMatches.push(m);
    }
  }
  return allMatches.sort((a, b) => b.confidence - a.confidence);
}

// ─── MERGE ───────────────────────────────────────────────────

/** Picks the more-complete value from two candidates. */
function pickLonger(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

/** Merges arrays of strings, case-insensitive deduplication. */
function mergeStringArrays(a: string[] = [], b: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a, ...b]) {
    const k = item.toLowerCase().trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(item.trim());
    }
  }
  return out;
}

/**
 * Merges two candidates into one. Keeps the higher AI score, longer text fields,
 * unioned skills/experience. The PRIMARY candidate's id and metadata wins.
 */
export function mergeCandidates(primary: Candidate, secondary: Candidate): Candidate {
  // Pick the newer record's stage if it's further along the pipeline
  const STAGE_ORDER: Record<string, number> = {
    applied: 0, screening: 1, interview: 2, offer: 3, hired: 4, rejected: -1
  };
  const stage =
    (STAGE_ORDER[secondary.stage] ?? 0) > (STAGE_ORDER[primary.stage] ?? 0)
      ? secondary.stage
      : primary.stage;

  // Merge work_experience by company+title key
  const expMap = new Map<string, typeof primary.work_experience[0]>();
  for (const w of [...primary.work_experience, ...secondary.work_experience]) {
    const key = (w.company + '|' + w.title).toLowerCase().trim();
    if (!expMap.has(key)) {
      expMap.set(key, w);
    } else {
      // Merge: keep the one with more bullets
      const existing = expMap.get(key)!;
      if (w.responsibilities.length > existing.responsibilities.length) {
        expMap.set(key, w);
      }
    }
  }

  // Merge education by institution+start_year
  const eduMap = new Map<string, typeof primary.education[0]>();
  for (const e of [...primary.education, ...secondary.education]) {
    const key = (e.institution + '|' + e.start_year).toLowerCase().trim();
    if (!eduMap.has(key)) eduMap.set(key, e);
  }

  // Merge certifications by name
  const certMap = new Map<string, typeof primary.certifications[0]>();
  for (const c of [...primary.certifications, ...secondary.certifications]) {
    const key = c.name.toLowerCase().trim();
    if (key && !certMap.has(key)) certMap.set(key, c);
  }

  return {
    ...primary,
    personal: {
      full_name: pickLonger(primary.personal.full_name, secondary.personal.full_name),
      email: primary.personal.email || secondary.personal.email,
      phone: primary.personal.phone || secondary.personal.phone,
      location: pickLonger(primary.personal.location, secondary.personal.location),
      city: primary.personal.city || secondary.personal.city,
      country: primary.personal.country || secondary.personal.country,
      linkedin: primary.personal.linkedin || secondary.personal.linkedin,
      website: primary.personal.website || secondary.personal.website,
      nationality: primary.personal.nationality || secondary.personal.nationality,
      gender: primary.personal.gender || secondary.personal.gender,
      date_of_birth: primary.personal.date_of_birth || secondary.personal.date_of_birth,
      marital_status: primary.personal.marital_status || secondary.personal.marital_status
    },
    professional_summary: pickLonger(primary.professional_summary, secondary.professional_summary),
    current_title: primary.current_title || secondary.current_title,
    total_experience_years: Math.max(primary.total_experience_years, secondary.total_experience_years),
    skills: {
      technical: mergeStringArrays(primary.skills.technical, secondary.skills.technical),
      soft: mergeStringArrays(primary.skills.soft, secondary.skills.soft),
      languages: mergeStringArrays(primary.skills.languages, secondary.skills.languages),
      tools: mergeStringArrays(primary.skills.tools, secondary.skills.tools),
      certifications: mergeStringArrays(primary.skills.certifications, secondary.skills.certifications)
    },
    work_experience: [...expMap.values()],
    education: [...eduMap.values()],
    certifications: [...certMap.values()],
    projects: mergeStringArrays(primary.projects.map((p) => JSON.stringify(p)), secondary.projects.map((p) => JSON.stringify(p))).map((s) => JSON.parse(s)),
    awards: mergeStringArrays(primary.awards, secondary.awards),
    publications: mergeStringArrays(primary.publications, secondary.publications),
    volunteer: mergeStringArrays(primary.volunteer, secondary.volunteer),
    visa_status: primary.visa_status || secondary.visa_status,
    notice_period: primary.notice_period || secondary.notice_period,
    expected_salary: primary.expected_salary || secondary.expected_salary,
    ai_score: Math.max(primary.ai_score, secondary.ai_score),
    ai_strengths: mergeStringArrays(primary.ai_strengths, secondary.ai_strengths),
    ai_concerns: primary.ai_concerns,
    recommended_roles: mergeStringArrays(primary.recommended_roles, secondary.recommended_roles),
    omanization_eligible: primary.omanization_eligible || secondary.omanization_eligible,
    stage,
    notes: [primary.notes, secondary.notes].filter(Boolean).join('\n\n--- merged ---\n\n'),
    rating: Math.max(primary.rating || 0, secondary.rating || 0),
    rawText: pickLonger(primary.rawText, secondary.rawText)
  };
}
