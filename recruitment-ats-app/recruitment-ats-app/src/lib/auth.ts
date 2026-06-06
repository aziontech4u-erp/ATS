// Real admin auth for production. PBKDF2-SHA256 password hashing via the
// Web Crypto API, deterministic per-admin salt, single-tenant
// (one admin record per browser).
//
// IMPORTANT — security model
// This is a client-side SPA, so the password *hash* lives in localStorage.
// Anyone with shell access to the browser can read it. PBKDF2 makes brute-
// forcing the hash expensive but it is not a substitute for a real auth
// server. For multi-user or stronger guarantees, swap this module for a
// backend later.

const ADMIN_KEY = 'recruitment_ats_admin_v1';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

export interface AdminRecord {
  email: string;
  name: string;
  saltB64: string;
  hashB64: string;
  /** True until the admin has rotated away from the initial / seeded password. */
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Build-time initial admin (overridden by VITE_INITIAL_ADMIN_* envs) ───
const INITIAL_EMAIL = (
  (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL || 'admin@ats.local'
).toString().trim().toLowerCase();

const INITIAL_PASSWORD = (
  (import.meta as any).env?.VITE_INITIAL_ADMIN_PASSWORD || 'ChangeMe@1234'
).toString();

const INITIAL_NAME = (
  (import.meta as any).env?.VITE_INITIAL_ADMIN_NAME || 'Administrator'
).toString();

// ─── Storage ──────────────────────────────────────────────────────────────

export function loadAdmin(): AdminRecord | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminRecord;
  } catch {
    return null;
  }
}

export function saveAdmin(a: AdminRecord) {
  try {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(a));
  } catch (e) {
    console.warn('admin save failed', e);
  }
}

// ─── Base64 helpers ───────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return salt;
}

// ─── Hashing ──────────────────────────────────────────────────────────────

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // Cast satisfies TS lib variations across SubtleCrypto definitions.
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    key,
    HASH_BITS
  );
  return bufToBase64(bits);
}

/** Constant-time string compare on base64 strings of equal length. */
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Public API ───────────────────────────────────────────────────────────

/** Seed the admin record from build-time defaults if not present. Idempotent. */
export async function ensureSeed(): Promise<AdminRecord> {
  const existing = loadAdmin();
  if (existing) return existing;
  const salt = randomSalt();
  const hash = await hashPassword(INITIAL_PASSWORD, salt);
  const rec: AdminRecord = {
    email: INITIAL_EMAIL,
    name: INITIAL_NAME,
    saltB64: bufToBase64(salt),
    hashB64: hash,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveAdmin(rec);
  return rec;
}

/** Returns the matched admin record on success, null on mismatch / missing. */
export async function verifyPassword(
  email: string,
  password: string
): Promise<AdminRecord | null> {
  const a = loadAdmin();
  if (!a) return null;
  if (a.email !== email.trim().toLowerCase()) return null;
  const salt = base64ToBytes(a.saltB64);
  const candidate = await hashPassword(password, salt);
  return safeEq(candidate, a.hashB64) ? a : null;
}

export type ChangePasswordResult =
  | { ok: true; admin: AdminRecord }
  | { ok: false; error: string };

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const a = loadAdmin();
  if (!a) return { ok: false, error: 'No admin configured.' };

  const verified = await verifyPassword(a.email, currentPassword);
  if (!verified) return { ok: false, error: 'Current password is incorrect.' };

  const strength = validatePasswordStrength(newPassword);
  if (!strength.ok) return { ok: false, error: strength.error };

  if (currentPassword === newPassword) {
    return { ok: false, error: 'New password must differ from the current one.' };
  }

  const salt = randomSalt();
  const hash = await hashPassword(newPassword, salt);
  const next: AdminRecord = {
    ...a,
    saltB64: bufToBase64(salt),
    hashB64: hash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString()
  };
  saveAdmin(next);
  return { ok: true, admin: next };
}

// ─── Password strength ────────────────────────────────────────────────────

export type StrengthResult = { ok: true } | { ok: false; error: string };

export function validatePasswordStrength(p: string): StrengthResult {
  if (!p || p.length < 10) return { ok: false, error: 'Password must be at least 10 characters.' };
  if (!/[a-z]/.test(p)) return { ok: false, error: 'Password must include a lowercase letter.' };
  if (!/[A-Z]/.test(p)) return { ok: false, error: 'Password must include an uppercase letter.' };
  if (!/[0-9]/.test(p)) return { ok: false, error: 'Password must include a digit.' };
  if (!/[^A-Za-z0-9]/.test(p)) return { ok: false, error: 'Password must include a symbol.' };
  return { ok: true };
}

/** 0..4. For UI strength meter. */
export function passwordScore(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
