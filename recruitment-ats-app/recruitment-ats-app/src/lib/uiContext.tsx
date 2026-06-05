import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './i18n';
import { tr } from './i18n';

export type Theme = 'light' | 'dark';

export interface AuthUser {
  email: string;
  name: string;
  role: 'admin' | 'recruiter' | 'demo';
}

const THEME_KEY = 'recruitment_ats_theme';
const LANG_KEY = 'recruitment_ats_lang';
const AUTH_KEY = 'recruitment_ats_session';

export const DEMO_EMAIL = 'demo@ats.local';
export const DEMO_PASSWORD = 'demo1234';

interface UiContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: 'ltr' | 'rtl';

  user: AuthUser | null;
  signIn: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  signOut: () => void;
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
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
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

  const value = useMemo<UiContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((p) => (p === 'dark' ? 'light' : 'dark')),

    lang,
    setLang: setLangState,
    t: (k, v) => tr(lang, k, v),
    dir: lang === 'ar' ? 'rtl' : 'ltr',

    user,
    signIn: (email, password) => {
      const e = email.trim().toLowerCase();
      if (e === DEMO_EMAIL && password === DEMO_PASSWORD) {
        const u: AuthUser = { email: DEMO_EMAIL, name: 'Demo User', role: 'demo' };
        localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        setUser(u);
        return { ok: true };
      }
      // Allow any non-empty email/password as "admin" for self-hosted use.
      if (e && password && password.length >= 4) {
        const u: AuthUser = { email: e, name: e.split('@')[0] || 'User', role: 'admin' };
        localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        setUser(u);
        return { ok: true };
      }
      return { ok: false, error: tr(lang, 'login.invalid') };
    },
    signOut: () => {
      localStorage.removeItem(AUTH_KEY);
      setUser(null);
    }
  }), [theme, lang, user]);

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}
