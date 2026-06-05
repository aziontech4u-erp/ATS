import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Inbox, Paperclip, Mail as MailIcon, Trash2, RefreshCw, Plus, X,
  CheckCircle2, Loader2, Sparkles, Upload, ChevronRight, ScanLine
} from 'lucide-react';
import type { Candidate, JobPosting, MailItem, MailAttachment } from '../lib/types';
import {
  loadMail, saveMail, upsertMail, deleteMail,
  fileToAttachment, attachmentToFile, isResumeAttachment,
  parseEmlFile
} from '../lib/mailbox';
import { uid, loadApiKey } from '../lib/storage';
import { readFile, parseResume } from '../lib/resumeParser';
import { findCandidateByContact } from '../lib/intake';

interface Props {
  candidates: Candidate[];
  jobs: JobPosting[];
  onAddCandidate: (c: Candidate) => void;
  onUpdateCandidate: (id: string, patch: Partial<Candidate>) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function MailInboxView({ candidates, jobs, onAddCandidate, onUpdateCandidate, onToast }: Props) {
  void jobs;
  const [items, setItems] = useState<MailItem[]>(() => loadMail());
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id || null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unprocessed' | 'processed'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveMail(items); }, [items]);

  const filtered = useMemo(() => {
    return items.filter((m) => filterStatus === 'all' ? true : m.status === filterStatus);
  }, [items, filterStatus]);

  const selected = items.find((m) => m.id === selectedId) || null;

  async function ingestFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const newItems: MailItem[] = [];
    for (const f of arr) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (ext === 'eml') {
        try {
          const parsed = await parseEmlFile(f);
          newItems.push({
            id: uid(),
            fromName: parsed.fromName,
            fromEmail: parsed.fromEmail,
            subject: parsed.subject,
            receivedAt: parsed.receivedAt,
            body: parsed.body,
            attachments: parsed.attachments,
            status: 'unprocessed',
            fromEml: true
          });
        } catch (e) {
          onToast(`Failed to parse ${f.name}`, 'error');
        }
      } else {
        // Treat as a direct resume drop — wrap as a placeholder mail
        const att = await fileToAttachment(f);
        newItems.push({
          id: uid(),
          fromName: '',
          fromEmail: '',
          subject: `Resume: ${f.name}`,
          receivedAt: new Date().toISOString(),
          body: '(Direct file upload — no email body)',
          attachments: [att],
          status: 'unprocessed',
          fromEml: false
        });
      }
    }
    const next = [...newItems, ...items];
    setItems(next);
    if (newItems[0]) setSelectedId(newItems[0].id);
    onToast(`${newItems.length} mail item${newItems.length === 1 ? '' : 's'} added`, 'success');
  }

  async function processAttachment(mail: MailItem, att: MailAttachment) {
    if (!isResumeAttachment(att)) {
      onToast('Attachment is not a resume (PDF/DOCX/TXT)', 'error');
      return;
    }
    setProcessing(mail.id);
    try {
      const file = attachmentToFile(att);
      const text = await readFile(file);
      const apiKey = loadApiKey();
      const parsed = await parseResume(text, file.name, apiKey);

      // Decide whether to update existing or create new
      const fallbackEmail = parsed.personal.email || mail.fromEmail;
      const fallbackPhone = parsed.personal.phone || '';
      const existing = findCandidateByContact(candidates, fallbackEmail, fallbackPhone);

      if (existing) {
        onUpdateCandidate(existing.id, {
          ...parsed,
          rawText: text,
          source: existing.source || 'Mail Inbox'
        });
        const updatedMail: MailItem = { ...mail, status: 'processed', candidateId: existing.id };
        setItems((prev) => prev.map((m) => m.id === mail.id ? updatedMail : m));
        upsertMail(updatedMail);
        onToast(`Updated existing candidate: ${existing.personal.full_name || existing.id}`, 'success');
      } else {
        const candidate: Candidate = {
          id: uid(),
          filename: att.filename,
          fileSize: `${(att.sizeBytes / 1024).toFixed(1)} KB`,
          uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          stage: 'applied',
          source: mail.fromEml ? 'Email Forward' : 'Mail Inbox',
          rawText: text,
          ...parsed
        };
        // Prefer email/name from the mail header if parser missed
        if (!candidate.personal.email && mail.fromEmail) candidate.personal.email = mail.fromEmail;
        if (!candidate.personal.full_name && mail.fromName) candidate.personal.full_name = mail.fromName;
        onAddCandidate(candidate);
        const updatedMail: MailItem = { ...mail, status: 'processed', candidateId: candidate.id };
        setItems((prev) => prev.map((m) => m.id === mail.id ? updatedMail : m));
        upsertMail(updatedMail);
        onToast(`Candidate created: ${candidate.personal.full_name || att.filename}`, 'success');
      }
    } catch (e) {
      console.error(e);
      onToast('Failed to parse resume: ' + (e as Error).message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  function remove(id: string) {
    if (!confirm('Delete this mail item?')) return;
    setItems((prev) => prev.filter((m) => m.id !== id));
    deleteMail(id);
    if (selectedId === id) setSelectedId(null);
  }

  function markIgnored(id: string) {
    setItems((prev) => prev.map((m) => m.id === id ? { ...m, status: 'ignored' } : m));
  }

  return (
    <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Left rail: list */}
      <aside className="flex w-80 flex-shrink-0 flex-col border-e border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Inbox size={15} className="text-brand-500" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Mail Inbox</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-brand-500 dark:bg-blue-900/40 dark:text-blue-300">
              {items.filter((m) => m.status === 'unprocessed').length}
            </span>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Add mail entry"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Drop / Upload zone */}
        <div className="p-3">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-3 text-center transition-all ${
              dragOver
                ? 'border-brand-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-blue-200 bg-slate-50 hover:border-brand-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-blue-900/20'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".eml,.pdf,.doc,.docx,.txt,.rtf"
              multiple
              onChange={(e) => e.target.files && ingestFiles(e.target.files)}
              className="hidden"
            />
            <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-brand-500 dark:bg-blue-900/40 dark:text-blue-300">
              <Upload size={14} />
            </div>
            <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">
              Drop .eml or resume files
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              EML · PDF · DOCX · TXT
            </div>
          </div>
        </div>

        {/* Status filter */}
        <div className="mx-3 mb-2 flex gap-1">
          {(['all', 'unprocessed', 'processed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex-1 rounded-md px-2 py-1 text-[10.5px] font-semibold capitalize transition-colors ${
                filterStatus === s
                  ? 'bg-brand-500 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-slate-400">
              <MailIcon size={28} className="mx-auto mb-2 opacity-40" />
              <div className="text-[11px] font-semibold text-slate-500">No mail yet</div>
              <div className="mt-1 text-[10px]">Drop a .eml file or resume above</div>
            </div>
          ) : (
            filtered.map((m) => {
              const active = m.id === selectedId;
              const resumeCount = m.attachments.filter(isResumeAttachment).length;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`mb-1 flex w-full items-start gap-2 rounded-lg border p-2 text-start transition-colors ${
                    active
                      ? 'border-brand-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    m.status === 'unprocessed' ? 'bg-amber-500'
                      : m.status === 'processed' ? 'bg-green-500'
                      : 'bg-slate-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                        {m.fromName || m.fromEmail || '(unknown sender)'}
                      </span>
                      <span className="flex-shrink-0 text-[9px] text-slate-400">
                        {new Date(m.receivedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <div className="truncate text-[10.5px] text-slate-600 dark:text-slate-300">
                      {m.subject}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Paperclip size={9} /> {m.attachments.length}
                      </span>
                      {resumeCount > 0 && (
                        <span className="rounded bg-amber-50 px-1.5 py-px font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {resumeCount} resume
                        </span>
                      )}
                      {m.candidateId && (
                        <span className="rounded bg-green-50 px-1.5 py-px font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          linked
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Detail pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
            <MailIcon size={48} className="mb-3 opacity-30" />
            <div className="mb-1 text-base font-semibold">No mail selected</div>
            <p className="max-w-sm text-xs">Drop .eml files exported from Gmail / Outlook, or drop resume files directly. The Mail Inbox stages incoming applications before they hit the candidate database.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-blue-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">{selected.subject}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span><span className="font-semibold text-slate-700 dark:text-slate-200">From:</span> {selected.fromName} &lt;{selected.fromEmail || 'unknown'}&gt;</span>
                  <span>·</span>
                  <span>{new Date(selected.receivedAt).toLocaleString()}</span>
                  <span>·</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    selected.status === 'unprocessed' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : selected.status === 'processed' ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {selected.status === 'unprocessed' && (
                  <button
                    onClick={() => markIgnored(selected.id)}
                    title="Mark as ignored"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  onClick={() => remove(selected.id)}
                  title="Delete"
                  className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected.attachments.length > 0 && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Paperclip size={11} /> Attachments ({selected.attachments.length})
                  </div>
                  <div className="space-y-2">
                    {selected.attachments.map((a, i) => {
                      const isResume = isResumeAttachment(a);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{a.filename}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {a.mime} · {(a.sizeBytes / 1024).toFixed(1)} KB
                              {isResume && <span className="ms-2 rounded bg-amber-50 px-1.5 py-px font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">resume</span>}
                            </div>
                          </div>
                          {isResume && selected.status !== 'processed' && (
                            <button
                              onClick={() => processAttachment(selected, a)}
                              disabled={processing === selected.id}
                              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                            >
                              {processing === selected.id ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
                              {processing === selected.id ? 'Parsing…' : 'Parse → Create Candidate'}
                            </button>
                          )}
                          {selected.status === 'processed' && selected.candidateId && (
                            <span className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[10.5px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                              <CheckCircle2 size={11} /> Candidate created
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Body</div>
                <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 dark:text-slate-200">{selected.body || '(no body)'}</pre>
              </div>
            </div>
          </>
        )}
      </div>

      {showAdd && (
        <AddMailModal
          onClose={() => setShowAdd(false)}
          onCreate={(item) => {
            setItems((prev) => [item, ...prev]);
            setSelectedId(item.id);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

// ─── manual Add Mail entry ───────────────────────────────────────

function AddMailModal({ onClose, onCreate }: { onClose: () => void; onCreate: (m: MailItem) => void }) {
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [att, setAtt] = useState<MailAttachment[]>([]);

  async function pickFiles(files: FileList | null) {
    if (!files) return;
    const next: MailAttachment[] = [];
    for (const f of Array.from(files)) {
      next.push(await fileToAttachment(f));
    }
    setAtt((prev) => [...prev, ...next]);
  }

  function create() {
    if (!fromEmail.trim() && !subject.trim()) return;
    onCreate({
      id: uid(),
      fromName, fromEmail, subject: subject || '(no subject)',
      receivedAt: new Date().toISOString(),
      body,
      attachments: att,
      status: 'unprocessed'
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Add Mail Entry</div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X size={18} /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <FormField label="From Name">
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputCls} placeholder="Jane Candidate" />
          </FormField>
          <FormField label="From Email *">
            <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className={inputCls} type="email" placeholder="jane@example.com" />
          </FormField>
          <FormField label="Subject *">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="Application for Senior Engineer" />
          </FormField>
          <FormField label="Body">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputCls + ' resize-y'} placeholder="Email body..." />
          </FormField>
          <FormField label="Attach Resume">
            <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.rtf" onChange={(e) => pickFiles(e.target.files)} className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-brand-500 dark:file:bg-blue-900/40 dark:file:text-blue-300" />
            {att.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {att.map((a, i) => (
                  <span key={i} className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10.5px] dark:bg-slate-800">
                    <Paperclip size={9} /> {a.filename}
                    <button onClick={() => setAtt((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={create} className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600">
            <Sparkles size={13} /> Add to Inbox
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
