// src/components/KeyboardShortcutCheatSheet.tsx
import { Modal } from '@/components/Modal';
import { Keyboard, Command, ArrowRight } from 'lucide-react';

export function KeyboardShortcutCheatSheet({ 
  open, 
  onClose 
}: { 
  open: boolean; 
  onClose: () => void 
}) {
  const shortcuts = [
    { keys: ['Ctrl', 'K'], desc: 'Buka Command Palette (Pencarian Global)' },
    { divider: 'Navigasi Cepat' },
    { keys: ['G', 'D'], desc: 'Pergi ke Dashboard' },
    { keys: ['G', 'A'], desc: 'Pergi ke Agenda & Presensi' },
    { keys: ['G', 'I'], desc: 'Pergi ke Izin & Delegasi' },
    { keys: ['G', 'P'], desc: 'Pergi ke Dashboard Piket' },
    { keys: ['G', 'R'], desc: 'Pergi ke Rapat & Notulensi' },
    { keys: ['G', 'T'], desc: 'Pergi ke Todo List' },
    { keys: ['G', 'K'], desc: 'Pergi ke Kalender Akademik' },
    { keys: ['G', 'S'], desc: 'Pergi ke Tata Kelola Surat' },
    { divider: 'Sistem' },
    { keys: ['?'], desc: 'Tampilkan Cheat Sheet ini' },
    { keys: ['Esc'], desc: 'Tutup Modal / Cheat Sheet' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" size="md">
      <div className="space-y-5">
        <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl text-indigo-300">
          <div className="p-2 bg-indigo-500/20 rounded-xl">
            <Keyboard size={20} />
          </div>
          <p className="text-xs leading-relaxed">
            Gunakan pintasan ini untuk bernavigasi lebih cepat seperti di aplikasi desktop. Tekan tombol secara berurutan (misal: tekan <b>G</b>, lepas, lalu tekan <b>D</b>).
          </p>
        </div>

        <div className="space-y-1">
          {shortcuts.map((s, i) => {
            if ('divider' in s) {
              return (
                <div key={i} className="pt-4 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {s.divider}
                  </p>
                </div>
              );
            }

            return (
              <div key={i} className="flex items-center justify-between p-2.5 hover:bg-slate-800/40 rounded-xl transition-colors">
                <span className="text-xs text-slate-300 font-medium">{s.desc}</span>
                <div className="flex gap-1.5 items-center">
                  {s.keys?.map((k, idx) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <kbd className="px-2 py-1 bg-slate-950 border border-slate-700 rounded-md text-[10px] font-bold text-slate-300 font-mono shadow-sm min-w-[24px] text-center">
                        {k}
                      </kbd>
                      {idx < (s.keys?.length || 0) - 1 && (
                        <ArrowRight size={10} className="text-slate-600" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}