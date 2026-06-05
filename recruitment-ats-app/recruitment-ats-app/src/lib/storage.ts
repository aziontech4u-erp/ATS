// ─────────────────────────────────────────────────────────────
// PERSISTENT STORAGE (localStorage with versioning)
// ─────────────────────────────────────────────────────────────

import type { Candidate, JobPosting, Interview, OfferLetter } from './types';

const STORAGE_KEY = 'recruitment_ats_v1';
const API_KEY_STORAGE = 'recruitment_ats_apikey';

interface StoredState {
  version: number;
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
}

export function loadState(): {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { candidates: [], jobs: [], interviews: [], offers: [] };
    }
    const parsed = JSON.parse(raw) as StoredState;
    return {
      candidates: parsed.candidates || [],
      jobs: parsed.jobs || [],
      interviews: parsed.interviews || [],
      offers: parsed.offers || []
    };
  } catch {
    return { candidates: [], jobs: [], interviews: [], offers: [] };
  }
}

export function saveState(state: {
  candidates: Candidate[];
  jobs: JobPosting[];
  interviews: Interview[];
  offers: OfferLetter[];
}) {
  try {
    const data: StoredState = { version: 1, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Storage save failed', err);
  }
}

export function loadApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function saveApiKey(key: string) {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
  }
}

export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}
