import {
  LayoutDashboard,
  ScanLine,
  Users,
  Search,
  Briefcase,
  GitBranch,
  Calendar,
  FileSignature,
  BarChart3,
  Settings,
  Sparkles,
  Building2,
  Sun,
  Moon,
  Globe,
  LogOut
} from 'lucide-react';
import type { AppView } from '../lib/types';
import { useUi } from '../lib/uiContext';

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  candidateCount: number;
  jobCount: number;
  interviewCount: number;
  offerCount: number;
  apiKeyConnected: boolean;
  onToggleSettings: () => void;
}

interface NavItem {
  view: AppView;
  i18nKey: string;
  icon: any;
  badge?: 'candidates' | 'jobs' | 'interviews' | 'offers';
}

const navItems: NavItem[] = [
  { view: 'dashboard', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { view: 'parser', i18nKey: 'nav.parser', icon: ScanLine },
  { view: 'candidates', i18nKey: 'nav.candidates', icon: Users, badge: 'candidates' },
  { view: 'search', i18nKey: 'nav.search', icon: Search },
  { view: 'jobs', i18nKey: 'nav.jobs', icon: Briefcase, badge: 'jobs' },
  { view: 'pipeline', i18nKey: 'nav.pipeline', icon: GitBranch },
  { view: 'interviews', i18nKey: 'nav.interviews', icon: Calendar, badge: 'interviews' },
  { view: 'offers', i18nKey: 'nav.offers', icon: FileSignature, badge: 'offers' },
  { view: 'reports', i18nKey: 'nav.reports', icon: BarChart3 },
  { view: 'company', i18nKey: 'nav.company', icon: Building2 }
];

export default function Sidebar({
  activeView,
  onNavigate,
  candidateCount,
  jobCount,
  interviewCount,
  offerCount,
  apiKeyConnected,
  onToggleSettings
}: SidebarProps) {
  const { t, theme, toggleTheme, lang, setLang, user, signOut } = useUi();
  const counts = {
    candidates: candidateCount,
    jobs: jobCount,
    interviews: interviewCount,
    offers: offerCount
  };

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-blue-100 px-4 py-3.5 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-700 text-xs font-bold text-white">
          AT
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900 leading-tight dark:text-slate-100">{t('nav.brand')}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold dark:text-slate-500">{t('nav.brandSub')}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.view;
          const count = item.badge ? counts[item.badge] : null;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                active
                  ? 'bg-blue-50 text-brand-500 font-semibold dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-50 font-medium dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} className={active ? 'text-brand-500 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'} />
              <span className="flex-1 text-start">{t(item.i18nKey)}</span>
              {count != null && count > 0 && (
                <span
                  className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme + language toggles */}
      <div className="border-t border-blue-100 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {theme === 'dark' ? t('nav.theme.light') : t('nav.theme.dark')}
          </button>
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            title={t('nav.language')}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Globe size={13} />
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
      </div>

      {/* AI Status & Settings & user */}
      <div className="border-t border-blue-100 p-3 dark:border-slate-800">
        <div
          className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-medium ${
            apiKeyConnected
              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          <Sparkles size={14} />
          <span className="flex-1">{apiKeyConnected ? t('nav.aiConnected') : t('nav.aiNotConnected')}</span>
        </div>
        <button
          onClick={onToggleSettings}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 font-medium dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings size={14} />
          <span>{t('nav.settings')}</span>
        </button>
        {user && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">{user.name}</div>
              <div className="truncate text-[9px] uppercase tracking-wider text-slate-400">{user.role}</div>
            </div>
            <button
              onClick={signOut}
              title={t('login.signOut')}
              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
