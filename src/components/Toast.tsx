// src/components/Toast.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, X, Undo2 } from 'lucide-react';
import { playSuccess, playError } from '@/lib/sound';
import { haptic } from '@/lib/haptics';

type ToastType = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  undo?: {
    label: string;
    onUndo: () => void;
  };
};

type ActiveTimer = {
  timeout: number;
  onCommit?: () => void | Promise<void>;
};

let toastId = 0;
const listeners = new Set<(toasts: ToastMessage[]) => void>();
let currentToasts: ToastMessage[] = [];
const timers = new Map<number, ActiveTimer>();

// =============================================================================
// INTERNAL HELPERS
// =============================================================================
function pushToast(toast: Omit<ToastMessage, 'id'>): number {
  const id = ++toastId;
  currentToasts = [...currentToasts, { ...toast, id }];
  listeners.forEach((l) => l(currentToasts));
  return id;
}

function removeToast(id: number) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  listeners.forEach((l) => l(currentToasts));
}

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer.timeout);
    timers.delete(id);
  }
}

// =============================================================================
// PUBLIC API — Basic Toast
// =============================================================================
function showToastBase(type: ToastType, message: string) {
  const duration = 4000;
  const id = pushToast({ type, message, duration });
  const timeout = window.setTimeout(() => {
    removeToast(id);
    timers.delete(id);
  }, duration);
  timers.set(id, { timeout });
}

export function showToast(type: ToastType, message: string) {
  if (type === 'success') {
    playSuccess();
    haptic('success');
  } else if (type === 'error') {
    playError();
    haptic('error');
  } else {
    haptic('light');
  }
  showToastBase(type, message);
}

// =============================================================================
// PUBLIC API — Toast dengan Undo
// =============================================================================
type ShowToastUndoOptions = {
  message: string;
  duration?: number;
  undoLabel?: string;
  onUndo: () => void;
  onCommit?: () => void | Promise<void>;
};

/**
 * Toast dengan tombol "Urungkan".
 *
 * - `onUndo` dipanggil kalau user klik "Urungkan" → restore data ke UI
 * - `onCommit` dipanggil setelah `duration` habis (user TIDAK undo)
 *   → di sini tempatnya melakukan server delete sungguhan
 * - Kalau user klik X (dismiss) → `onCommit` langsung dipanggil
 *   (menutup toast = setuju hapus)
 */
export function showToastUndo({
  message,
  duration = 5000,
  undoLabel = 'Urungkan',
  onUndo,
  onCommit,
}: ShowToastUndoOptions) {
  const id = pushToast({
    type: 'success',
    message,
    duration,
    undo: {
      label: undoLabel,
      onUndo: () => {
        clearTimer(id);
        removeToast(id);
        haptic('light');
        onUndo();
      },
    },
  });

  const timeout = window.setTimeout(async () => {
    removeToast(id);
    timers.delete(id);
    if (onCommit) {
      try {
        await onCommit();
      } catch (err) {
        console.error('[ToastUndo] onCommit error:', err);
      }
    }
  }, duration);

  timers.set(id, { timeout, onCommit });
}

// =============================================================================
// CONTAINER
// =============================================================================
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const handleClose = (id: number) => {
    const toast = currentToasts.find((t) => t.id === id);
    // Kalau toast punya undo dan user tutup manual (X),
    // artinya user menyetujui hapus → panggil onCommit sekarang
    if (toast?.undo) {
      const timer = timers.get(id);
      if (timer?.onCommit) {
        Promise.resolve(timer.onCommit()).catch(console.error);
      }
    }
    clearTimer(id);
    removeToast(id);
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
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 bg-white rounded-xl shadow-lg border border-slate-200 border-l-4 ${borders[t.type]} px-4 py-3 animate-[slideIn_0.2s_ease-out]`}
        >
          <div className="mt-0.5">{icons[t.type]}</div>
          <p className="text-sm text-slate-700 flex-1">{t.message}</p>

          {t.undo ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={t.undo.onUndo}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <Undo2 size={12} />
                {t.undo.label}
              </button>
              <button
                onClick={() => handleClose(t.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                title="Tutup (hapus permanen)"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleClose(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}