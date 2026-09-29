// src/components/dashboard/ModalKustomShortcut.tsx
// STUB — akan diimplementasi lengkap di Batch 9C.

import { Modal } from '@/components/Modal';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentShortcuts: { page_key: string; urutan: number }[];
  guruId: string;
};

export function ModalKustomShortcut({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Atur Shortcut" size="md">
      <div className="text-center py-12">
        <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto mb-3" />
        <p className="text-sm text-slate-400">
          Fitur atur shortcut akan segera hadir
        </p>
        <p className="text-xs text-slate-500 mt-1">Batch 9C</p>
      </div>
    </Modal>
  );
}