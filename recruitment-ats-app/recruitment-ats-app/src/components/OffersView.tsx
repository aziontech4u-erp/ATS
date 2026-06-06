import { useState } from 'react';
import { Plus, FileSignature, X, Trash2, Send, Check, AlertCircle } from 'lucide-react';
import type { OfferLetter, Candidate, JobPosting } from '../lib/types';
import { uid } from '../lib/storage';
import { formatDate, formatCurrency, avatarColor, getInitials } from '../lib/utils';
import { useUi } from '../lib/uiContext';

interface OffersViewProps {
  offers: OfferLetter[];
  candidates: Candidate[];
  jobs: JobPosting[];
  onAddOffer: (o: OfferLetter) => void;
  onUpdateOffer: (id: string, patch: Partial<OfferLetter>) => void;
  onDeleteOffer: (id: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const today = new Date().toISOString().slice(0, 10);
const inFuture = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const EMPTY: Omit<OfferLetter, 'id'> = {
  candidate_id: '',
  job_id: '',
  position: '',
  salary: 1000,
  currency: 'OMR',
  start_date: inFuture(30),
  expiry_date: inFuture(14),
  benefits: [],
  status: 'draft',
  sent_date: today
};

const STATUS_COLORS: Record<OfferLetter['status'], { bg: string; fg: string }> = {
  draft:     { bg: '#f1f5f9', fg: '#475569' },
  sent:      { bg: '#eff3ff', fg: '#2756e8' },
  accepted:  { bg: '#dcfce7', fg: '#15803d' },
  rejected:  { bg: '#fee2e2', fg: '#991b1b' },
  expired:   { bg: '#fef3c7', fg: '#b45309' },
  withdrawn: { bg: '#f1f5f9', fg: '#475569' }
};

export default function OffersView({
  offers,
  candidates,
  jobs,
  onAddOffer,
  onUpdateOffer,
  onDeleteOffer,
  onToast
}: OffersViewProps) {
  const { t } = useUi();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [filter, setFilter] = useState<OfferLetter['status'] | 'all'>('all');
  const STATUS_LABEL: Record<typeof filter, string> = {
    all: t('jobs.all'),
    draft: t('offers.status.draft'),
    sent: t('offers.status.sent'),
    accepted: t('offers.status.accepted'),
    rejected: t('offers.status.rejected'),
    expired: t('offers.status.expired'),
    withdrawn: t('offers.status.withdrawn')
  };

  function save() {
    if (!draft.candidate_id) {
      onToast('Select a candidate', 'error');
      return;
    }
    if (!draft.position) {
      onToast('Position is required', 'error');
      return;
    }
    onAddOffer({ id: uid(), ...draft });
    onToast(`Offer created${draft.status === 'sent' ? ' and marked as sent' : ''}`, 'success');
    setShowForm(false);
    setDraft(EMPTY);
  }

  const filtered =
    filter === 'all' ? offers : offers.filter((o) => o.status === filter);

  function previewLetter(o: OfferLetter) {
    const candidate = candidates.find((c) => c.id === o.candidate_id);
    const job = jobs.find((j) => j.id === o.job_id);
    const html = `<!DOCTYPE html>
<html><head><title>Offer Letter — ${candidate?.personal.full_name}</title>
<style>
body{font-family:Georgia,serif;max-width:720px;margin:32px auto;padding:32px;color:#1e293b;line-height:1.7}
h1{font-size:22px;text-align:center;margin-bottom:8px}
.sub{text-align:center;color:#64748b;font-size:11px;margin-bottom:24px}
.box{background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}
.row:last-child{border:0}.row b{color:#0f172a}
.foot{margin-top:32px;padding-top:16px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b}
</style></head><body>
<h1>OFFER OF EMPLOYMENT</h1>
<div class="sub">Issued: ${formatDate(o.sent_date)} · Expires: ${formatDate(o.expiry_date)}</div>
<p>Dear <strong>${candidate?.personal.full_name || ''}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${o.position}</strong>${job ? ` in the ${job.department} department` : ''}, subject to the terms below.</p>
<div class="box">
<div class="row"><span>Position</span><b>${o.position}</b></div>
<div class="row"><span>Salary</span><b>${formatCurrency(o.salary, o.currency)} per month</b></div>
<div class="row"><span>Start Date</span><b>${formatDate(o.start_date)}</b></div>
<div class="row"><span>Offer Expires</span><b>${formatDate(o.expiry_date)}</b></div>
${o.benefits.length ? `<div class="row"><span>Benefits</span><b>${o.benefits.join(', ')}</b></div>` : ''}
</div>
<p>Please indicate your acceptance by signing this offer and returning it before ${formatDate(o.expiry_date)}.</p>
<p>We look forward to welcoming you to the team.</p>
<br/><p>Sincerely,<br/><strong>Human Resources</strong></p>
<div class="foot">This offer is conditional upon successful reference checks and any pre-employment requirements.</div>
</body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('offers.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('offers.count', { n: offers.length })}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={14} />
          {t('offers.new')}
        </button>
      </div>

      <div className="mb-3 flex gap-1.5">
        {(['all', 'draft', 'sent', 'accepted', 'rejected', 'expired'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold transition-colors ${
              filter === s
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileSignature size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">{t('offers.empty')}</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
          >
            {t('offers.createFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const c = candidates.find((x) => x.id === o.candidate_id);
            const status = STATUS_COLORS[o.status];
            return (
              <div key={o.id} className="rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  {c && (
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: avatarColor(c.personal.full_name) }}
                    >
                      {getInitials(c.personal.full_name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {c?.personal.full_name || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-brand-500 font-medium dark:text-blue-300">
                          {o.position}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                        style={{ background: status.bg, color: status.fg }}
                      >
                        {o.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>
                        <strong>{formatCurrency(o.salary, o.currency)}</strong>/mo
                      </span>
                      <span>{t('offers.startLabel')}: {formatDate(o.start_date)}</span>
                      <span>{t('offers.expiresLabel')}: {formatDate(o.expiry_date)}</span>
                    </div>
                    {o.benefits.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {o.benefits.map((b, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        onClick={() => previewLetter(o)}
                        className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-brand-500 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                      >
                        📄 {t('offers.previewLetter')}
                      </button>
                      <select
                        value={o.status}
                        onChange={(e) =>
                          onUpdateOffer(o.id, {
                            status: e.target.value as OfferLetter['status'],
                            responded_date:
                              ['accepted', 'rejected'].includes(e.target.value)
                                ? today
                                : o.responded_date
                          })
                        }
                        className="rounded border border-slate-200 px-2 py-0.5 text-[10px] outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                      <button
                        onClick={() => {
                          if (confirm(t('offers.confirmDelete'))) {
                            onDeleteOffer(o.id);
                            onToast(t('offers.deletedToast'), 'success');
                          }
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="text-base font-bold text-slate-900 dark:text-slate-100">{t('offers.modalTitle')}</div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('offers.field.candidate')}
                </label>
                <select
                  value={draft.candidate_id}
                  onChange={(e) => {
                    const c = candidates.find((x) => x.id === e.target.value);
                    setDraft({
                      ...draft,
                      candidate_id: e.target.value,
                      position: draft.position || c?.current_title || '',
                      job_id: c?.jobId || draft.job_id
                    });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select candidate...</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.personal.full_name || c.filename}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('offers.field.position')}
                </label>
                <input
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="e.g. Senior Site Engineer"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('offers.field.job')}
                </label>
                <select
                  value={draft.job_id}
                  onChange={(e) => setDraft({ ...draft, job_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">None</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('offers.field.salary')}
                  </label>
                  <input
                    type="number"
                    value={draft.salary}
                    onChange={(e) =>
                      setDraft({ ...draft, salary: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('offers.field.currency')}
                  </label>
                  <select
                    value={draft.currency}
                    onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="OMR">OMR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="AED">AED</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('offers.field.startDate')}
                  </label>
                  <input
                    type="date"
                    value={draft.start_date}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('offers.field.expiryDate')}
                  </label>
                  <input
                    type="date"
                    value={draft.expiry_date}
                    onChange={(e) => setDraft({ ...draft, expiry_date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('offers.field.benefits')}
                </label>
                <input
                  value={draft.benefits.join(', ')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      benefits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    })
                  }
                  placeholder={t('offers.field.benefitsPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('offers.field.initialStatus')}
                </label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="draft">{t('offers.status.draft')}</option>
                  <option value="sent">{t('offers.status.sent')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                {t('offers.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
