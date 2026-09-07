import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
};

let toastId = 0;
const listeners = new Set<(toasts: ToastMessage[]) => void>();
let currentToasts: ToastMessage[] = [];

export function showToast(type: ToastType, message: string) {
  const id = ++toastId;
  currentToasts = [...currentToasts, { id, type, message }];
  listeners.forEach((l) => l(currentToasts));
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l(currentToasts));
  }, 4000);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const remove = (id: number) => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    setToasts(currentToasts);
  };

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 size={20} className="text-emerald-600" />,
    error: <XCircle size={20} className="text-red-600" />,
    info: <Info size={20} className="text-blue-600" />,
  };

  const borders: Record<ToastType, string> = {
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    info: 'border-l-blue-500',
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 bg-white rounded-xl shadow-lg border border-slate-200 border-l-4 ${borders[t.type]} px-4 py-3 animate-[slideIn_0.2s_ease-out]`}
        >
          <div className="mt-0.5">{icons[t.type]}</div>
          <p className="text-sm text-slate-700 flex-1">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
