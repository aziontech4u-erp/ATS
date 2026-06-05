import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ResumeParserView from './components/ResumeParserView';
import CandidatesView from './components/CandidatesView';
import AdvancedSearch from './components/AdvancedSearch';
import JobsView from './components/JobsView';
import PipelineView from './components/PipelineView';
import InterviewsView from './components/InterviewsView';
import OffersView from './components/OffersView';
import ReportsView from './components/ReportsView';
import SettingsModal from './components/SettingsModal';
import LoginView from './components/LoginView';
import CompanySettingsView from './components/CompanySettingsView';
import IntakeFormView from './components/IntakeFormView';
import CalendarView from './components/CalendarView';
import { loadReminders, buildEvents, countToday } from './lib/calendar';
import Toast, { type ToastMessage } from './components/Toast';
import {
  loadState, saveState, loadApiKey, saveApiKey, uid
} from './lib/storage';
import type {
  Candidate, JobPosting, Interview, OfferLetter, AppView
} from './lib/types';
import { useUi } from './lib/uiContext';

export default function App() {
  // ── State ──
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Refresh counter — bump when calendar storage changes so sidebar badges recompute.
  const [badgeTick, setBadgeTick] = useState(0);

  const { user } = useUi();

  // ── Public intake form route (no auth required) ──
  // Triggers: ?intake=1  OR  path ends with /ats-jobform
  const isIntake = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('intake') === '1' ||
    /\/ats-jobform\/?$/.test(window.location.pathname)
  );
  if (isIntake) {
    return <IntakeFormView />;
  }

  // ── Load initial state ──
  useEffect(() => {
    const data = loadState();
    setCandidates(data.candidates);
    setJobs(data.jobs);
    setInterviews(data.interviews);
    setOffers(data.offers);
    setApiKey(loadApiKey());
    setLoaded(true);
  }, []);

  // ── Persist on every change ──
  useEffect(() => {
    if (loaded) {
      saveState({ candidates, jobs, interviews, offers });
    }
  }, [candidates, jobs, interviews, offers, loaded]);

  // ── Sidebar badge counts (calendar today) ──
  // Recomputes when the user navigates (cheap) or when Calendar bumps the tick.
  const calendarToday = useMemo(() => {
    const events = buildEvents(loadReminders(), interviews);
    return countToday(events);
  }, [badgeTick, activeView, interviews]);

  const bumpBadges = useCallback(() => setBadgeTick((t) => t + 1), []);

  // ── Toast helper ──
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToasts((prev) => [...prev, { id: uid(), message, type }]);
    },
    []
  );
  const dismissToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Candidate actions ──
  const addCandidate = (c: Candidate) => setCandidates((prev) => [c, ...prev]);
  const updateCandidate = (id: string, patch: Partial<Candidate>) =>
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCandidate = (id: string) =>
    setCandidates((prev) => prev.filter((c) => c.id !== id));

  // ── Job actions ──
  const addJob = (j: JobPosting) => setJobs((prev) => [j, ...prev]);
  const updateJob = (id: string, patch: Partial<JobPosting>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const deleteJob = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  // ── Interview actions ──
  const addInterview = (i: Interview) => setInterviews((prev) => [i, ...prev]);
  const updateInterview = (id: string, patch: Partial<Interview>) =>
    setInterviews((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const deleteInterview = (id: string) =>
    setInterviews((prev) => prev.filter((i) => i.id !== id));

  // ── Offer actions ──
  const addOffer = (o: OfferLetter) => setOffers((prev) => [o, ...prev]);
  const updateOffer = (id: string, patch: Partial<OfferLetter>) =>
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const deleteOffer = (id: string) =>
    setOffers((prev) => prev.filter((o) => o.id !== id));

  // ── API key ──
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    saveApiKey(key);
    showToast(
      key ? '✓ AI key saved — full extraction enabled' : 'API key cleared',
      'success'
    );
    setSettingsOpen(false);
  };

  const handleClearData = () => {
    setCandidates([]);
    setJobs([]);
    setInterviews([]);
    setOffers([]);
    showToast('All data cleared', 'success');
    setSettingsOpen(false);
  };

  // ── Auth gate ──
  if (!user) {
    return (
      <>
        <LoginView />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // ── Render ──
  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-slate-950">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        activeView={activeView}
        onNavigate={(v) => { setActiveView(v); bumpBadges(); }}
        candidateCount={candidates.length}
        jobCount={jobs.length}
        interviewCount={interviews.filter((i) => i.status === 'scheduled').length}
        offerCount={offers.filter((o) => o.status === 'sent').length}
        calendarToday={calendarToday}
        apiKeyConnected={!!apiKey}
        onToggleSettings={() => setSettingsOpen(true)}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {activeView === 'dashboard' && (
          <Dashboard
            candidates={candidates}
            jobs={jobs}
            interviews={interviews}
            offers={offers}
            apiKeyConnected={!!apiKey}
            onNavigate={setActiveView}
          />
        )}
        {activeView === 'parser' && (
          <ResumeParserView
            candidates={candidates}
            jobs={jobs}
            apiKey={apiKey}
            onAddCandidate={addCandidate}
            onUpdateCandidate={updateCandidate}
            onToast={showToast}
          />
        )}
        {activeView === 'candidates' && (
          <CandidatesView
            candidates={candidates}
            jobs={jobs}
            onAddCandidate={addCandidate}
            onUpdateCandidate={updateCandidate}
            onDeleteCandidate={deleteCandidate}
            onViewParser={() => setActiveView('parser')}
            onToast={showToast}
          />
        )}
        {activeView === 'search' && (
          <AdvancedSearch
            candidates={candidates}
            jobs={jobs}
            onViewCandidate={() => setActiveView('candidates')}
          />
        )}
        {activeView === 'jobs' && (
          <JobsView
            jobs={jobs}
            candidates={candidates}
            onAddJob={addJob}
            onUpdateJob={updateJob}
            onDeleteJob={deleteJob}
            onToast={showToast}
          />
        )}
        {activeView === 'pipeline' && (
          <PipelineView
            candidates={candidates}
            jobs={jobs}
            onUpdateCandidate={updateCandidate}
            onToast={showToast}
          />
        )}
        {activeView === 'interviews' && (
          <InterviewsView
            interviews={interviews}
            candidates={candidates}
            jobs={jobs}
            onAddInterview={addInterview}
            onUpdateInterview={updateInterview}
            onDeleteInterview={deleteInterview}
            onToast={showToast}
          />
        )}
        {activeView === 'offers' && (
          <OffersView
            offers={offers}
            candidates={candidates}
            jobs={jobs}
            onAddOffer={addOffer}
            onUpdateOffer={updateOffer}
            onDeleteOffer={deleteOffer}
            onToast={showToast}
          />
        )}
        {activeView === 'reports' && (
          <ReportsView
            candidates={candidates}
            jobs={jobs}
            interviews={interviews}
            offers={offers}
          />
        )}
        {activeView === 'calendar' && (
          <CalendarView
            candidates={candidates}
            jobs={jobs}
            interviews={interviews}
          />
        )}
        {activeView === 'company' && (
          <CompanySettingsView onToast={showToast} />
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        apiKey={apiKey}
        onSave={handleSaveApiKey}
        onClose={() => setSettingsOpen(false)}
        onClearData={handleClearData}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
