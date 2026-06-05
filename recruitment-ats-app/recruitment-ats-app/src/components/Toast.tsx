import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  useEffect(() => {
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss(t.id), 3500)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const styles = {
          success: 'bg-green-50 border-green-200 text-green-700',
          error: 'bg-rose-50 border-rose-200 text-rose-700',
          info: 'bg-blue-50 border-blue-200 text-blue-700'
        }[t.type];
        const Icon =
          t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
        return (
          <div
            key={t.id}
            className={`slide-in flex items-center gap-2 rounded-lg border ${styles} px-3 py-2 text-xs font-medium shadow-lg max-w-sm`}
          >
            <Icon size={16} />
            <span className="flex-1">{t.message}</span>
            <button onClick={() => onDismiss(t.id)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
