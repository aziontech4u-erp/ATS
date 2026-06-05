import { useState } from 'react';
import { X, Key, Trash2, AlertTriangle } from 'lucide-react';
import { clearAllData } from '../lib/storage';

interface SettingsModalProps {
  open: boolean;
  apiKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
  onClearData: () => void;
}

export default function SettingsModal({
  open,
  apiKey,
  onSave,
  onClose,
  onClearData
}: SettingsModalProps) {
  const [keyDraft, setKeyDraft] = useState(apiKey);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 fade-in">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-bold text-slate-900">Settings</div>
            <div className="text-[11px] text-slate-500">Configure your ATS application</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* AI Key */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <Key size={14} className="text-brand-500" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                AI Provider Key (Optional)
              </span>
            </div>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-... (Anthropic) or sk-... (OpenAI)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Add an Anthropic or OpenAI API key for full AI-powered resume extraction. Without a
              key, the parser uses regex fallback (limited accuracy). Your key is stored locally in
              your browser only.
            </p>
            <button
              onClick={() => onSave(keyDraft.trim())}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Save API Key
            </button>
          </div>

          {/* Danger zone */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500" />
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wide">
                Danger Zone
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Permanently delete all candidates, jobs, interviews, and offers from your browser
              storage. This cannot be undone.
            </p>
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
              >
                <Trash2 size={14} />
                Clear All Data
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearAllData();
                    onClearData();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Yes, Delete Everything
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
