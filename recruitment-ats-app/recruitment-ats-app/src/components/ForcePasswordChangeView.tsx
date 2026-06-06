import { useState } from 'react';
import {
  Lock, KeyRound, AlertTriangle, CheckCircle2, Loader2, Eye, EyeOff, LogOut
} from 'lucide-react';
import { useUi } from '../lib/uiContext';
import { passwordScore, STRENGTH_LABELS } from '../lib/auth';

/**
 * Full-screen forced password change. Rendered when user.mustChangePassword
 * is true so the admin cannot reach the rest of the app without rotating
 * away from the initial / seeded password.
 */
export default function ForcePasswordChangeView() {
  const { user, changePassword, signOut, theme, toggleTheme } = useUi();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const score = passwordScore(next);
  const strengthLabel = STRENGTH_LABELS[score] ?? '';
  const strengthColor = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-green-500'][score] || 'bg-slate-300';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (next !== confirm) {
      setErr('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* utility toolbar */}
      <div className="absolute top-4 end-4 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light' : 'Dark'}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={signOut}
          title="Sign Out"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <LogOut size={13} /> Sign Out
        </button>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-blue-100 bg-white p-7 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">Set a New Password</h1>
            <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              You're signed in with the initial password. Choose a strong password
              before continuing — the initial one will stop working once you save.
            </p>
            {user?.email && (
              <div className="mt-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">{user.email}</div>
            )}
          </div>
        </div>

        {done ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900/60 dark:bg-green-900/20">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-green-700 dark:text-green-300" />
            <div className="text-sm font-bold text-green-800 dark:text-green-200">Password updated</div>
            <p className="mt-1 text-[11.5px] text-green-700 dark:text-green-300/80">
              Loading the workspace…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Current Password">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <Lock size={13} className="text-slate-400" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoFocus
                  className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurrent((p) => !p)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  {showCurrent ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </Field>

            <Field label="New Password">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <KeyRound size={13} className="text-slate-400" />
                <input
                  type={showNext ? 'text' : 'password'}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  required
                  minLength={10}
                  className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNext((p) => !p)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  {showNext ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex h-1 flex-1 gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`flex-1 transition-colors ${i < score ? strengthColor : ''}`}
                    />
                  ))}
                </div>
                <span className="w-20 text-end text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {next ? strengthLabel : ''}
                </span>
              </div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                10+ characters with upper, lower, digit and symbol.
              </p>
            </Field>

            <Field label="Confirm New Password">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-800">
                <KeyRound size={13} className="text-slate-400" />
                <input
                  type={showNext ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="flex-1 bg-transparent text-xs outline-none text-slate-900 dark:text-slate-100"
                  autoComplete="new-password"
                />
              </div>
            </Field>

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              {busy ? 'Saving…' : 'Update Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
