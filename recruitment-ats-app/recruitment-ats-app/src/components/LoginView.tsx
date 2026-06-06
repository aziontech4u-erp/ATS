import { useState } from 'react';
import { Sparkles, Mail, Lock, LogIn, Moon, Sun, Globe, Loader2 } from 'lucide-react';
import { useUi } from '../lib/uiContext';

export default function LoginView() {
  const { t, signIn, theme, toggleTheme, lang, setLang } = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await signIn(email, password);
    if (!res.ok) setErr(res.error);
    setBusy(false);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Theme + language toolbar */}
      <div className="absolute top-4 end-4 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          title={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Globe size={14} />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-7 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-700 text-sm font-bold text-white shadow-md">
            AT
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-50">{t('login.title')}</div>
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <Sparkles size={10} /> {t('login.subtitle')}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('login.email')}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
              <Mail size={14} className="text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
                placeholder="name@company.com"
                autoComplete="username"
                autoFocus
                required
                disabled={busy}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('login.password')}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
              <Lock size={14} className="text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </div>
          </label>

          {err && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
            {busy ? t('login.signingIn') : t('login.signin')}
          </button>
        </form>
      </div>
    </div>
  );
}
