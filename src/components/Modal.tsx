// src/components/Modal.tsx
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Info } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full ${sizeClass} bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-800/80 max-h-[90vh] overflow-hidden flex flex-col backdrop-blur-xl z-10`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-800/80">
          <h2 className="text-lg font-extrabold text-slate-100 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// ConfirmModal — Diperluas dengan variant & custom labels
// ---------------------------------------------------------------------------

type ConfirmVariant = 'danger' | 'warning' | 'default';

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};

const VARIANT_STYLES: Record<
  ConfirmVariant,
  {
    icon: typeof AlertTriangle;
    iconClass: string;
    iconBg: string;
    confirmClass: string;
    defaultConfirmLabel: string;
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-rose-400',
    iconBg: 'bg-rose-500/15 border-rose-500/30 shadow-rose-500/10',
    confirmClass:
      'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-500/20',
    defaultConfirmLabel: 'Ya, Hapus',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/30 shadow-amber-500/10',
    confirmClass:
      'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20',
    defaultConfirmLabel: 'Ya, Lanjutkan',
  },
  default: {
    icon: Info,
    iconClass: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15 border-indigo-500/30 shadow-indigo-500/10',
    confirmClass:
      'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/20',
    defaultConfirmLabel: 'Ya',
  },
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  variant = 'danger',
}: ConfirmModalProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;
  const finalConfirmLabel = confirmLabel ?? styles.defaultConfirmLabel;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 shadow-lg ${styles.iconBg} ${styles.iconClass}`}
          >
            <Icon size={20} />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mt-1">{message}</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition-all cursor-pointer ${styles.confirmClass}`}
          >
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}