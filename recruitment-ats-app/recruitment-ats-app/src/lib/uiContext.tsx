import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './i18n';
import { tr } from './i18n';
import {
  ensureSeed, verifyPassword, changePassword as changeAdminPassword,
  loadAdmin, type ChangePasswordResult
} from './auth';

export type Theme = 'light' | 'dark';

export interface AuthUser {
  email: string;
  name: string;
  role: 'admin' | 'recruiter';
  mustChangePassword: boolean;
}

const THEME_KEY = 'recruitment_ats_theme';
const LANG_KEY = 'recruitment_ats_lang';
const AUTH_KEY = 'recruitment_ats_session';

interface UiContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';

  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<ChangePasswordResult>;
}

const UiContext = createContext<UiContextValue | null>(null);

function loadTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === 'dark' || raw === 'light') return raw;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function loadLang(): Lang {
  const raw = localStorage.getItem(LANG_KEY);
  return raw === 'ar' ? 'ar' : 'en';
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.email || !parsed.role) return null;
    // Legacy session record (no mustChangePassword field) — assume false.
    // It'll be re-derived from the admin record on next refresh anyway.
    return {
      email: parsed.email,
      name: parsed.name || parsed.email.split('@')[0] || 'User',
      role: parsed.role === 'recruiter' ? 'recruiter' : 'admin',
      mustChangePassword: parsed.mustChangePassword === true
    };
  } catch {
    return null;
  }
}

function persistSession(u: AuthUser | null) {
  if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
  else localStorage.removeItem(AUTH_KEY);
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [lang, setLangState] = useState<Lang>(loadLang);
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  // Seed the admin record on first launch + keep the session in sync with
  // the latest mustChangePassword state from the admin record.
  useEffect(() => {
    let cancelled = false;
    ensureSeed().then((admin) => {
      if (cancelled) return;
      const current = loadUser();
      if (current && current.email === admin.email && current.mustChangePassword !== admin.mustChangePassword) {
        const next = { ...current, mustChangePassword: admin.mustChangePassword };
        persistSession(next);
        setUser(next);
      } else if (current && current.email !== admin.email) {
        // Session points at a stale admin (e.g. env defaults changed). Drop it.
        persistSession(null);
        setUser(null);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<UiContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((p) => (p === 'dark' ? 'light' : 'dark')),

    lang,
    setLang: setLangState,
    t: (k, v) => tr(lang, k, v),
    dir: lang === 'ar' ? 'rtl' : 'ltr',

    user,

    signIn: async (email, password) => {
      const e = email.trim().toLowerCase();
      if (!e || !password) {
        return { ok: false, error: tr(lang, 'login.invalid') };
      }
      const admin = await verifyPassword(e, password);
      if (!admin) {
        return { ok: false, error: tr(lang, 'login.invalid') };
      }
      const u: AuthUser = {
        email: admin.email,
        name: admin.name,
        role: 'admin',
        mustChangePassword: admin.mustChangePassword
      };
      persistSession(u);
      setUser(u);
      return { ok: true };
    },

    signOut: () => {
      persistSession(null);
      setUser(null);
    },

    changePassword: async (currentPassword, newPassword) => {
      const result = await changeAdminPassword(currentPassword, newPassword);
      if (result.ok && user) {
        const next: AuthUser = { ...user, mustChangePassword: false };
        persistSession(next);
        setUser(next);
      }
      return result;
    }
  }), [theme, lang, user]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}

// Expose the configured admin email so the login screen can show a hint of
// the expected email without leaking the password.
export function getAdminEmailHint(): string {
  return loadAdmin()?.email || '';
}
