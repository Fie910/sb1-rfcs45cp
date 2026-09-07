import { type ReactNode } from 'react';
import { X, AlertTriangle } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;

  const sizeClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/10">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mt-1">{message}</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            Ya, Hapus
          </button>
        </div>
      </div>
    </Modal>
  );
}