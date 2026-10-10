// src/components/dashboard/ModalKustomShortcut.tsx
// Modal kustom shortcut — pilih, reorder, simpan.
// ✅ Options difilter berdasarkan role user (via hasAccess).

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, X, Plus, GripVertical, ChevronUp, ChevronDown,
  RotateCcw, Info, Check, Search, Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/utils/audit';
import { PAGE_CONFIG, COLOR_MAP, type ShortcutConfig } from './ShortcutGrid';
import { canAccessTahfidz } from '@/components/tahfidz/shared';
import type { PageKey } from '@/config/navigation';

// =============================================================================
// KONSTANTA
// =============================================================================
const DEFAULT_SHORTCUTS = [
  'kalender_akademik',
  'agenda',
  'izin',
  'presensi',
  'kehadiran_piket_penyambutan',
  'piket',
  'todo',
  'tugas_disposisi',
  'saran_pengaduan',
  'hris',
  'rapat',
];

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentShortcuts: { page_key: string; urutan: number }[];
  guruId: string;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalKustomShortcut({
  open, onClose, onSaved, currentShortcuts, guruId,
}: Props) {
  const { guru, hasAccess } = useAuth();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // ==========================================================================
  // FILTER PAGE_CONFIG BY ROLE
  // ==========================================================================

const accessibleKeys = useMemo(() => {
  return Object.keys(PAGE_CONFIG).filter((key) => {
    // hasAccess() butuh PageKey — page_key di sini kebetulan sama
    if (!hasAccess(key as PageKey)) return false;

    // ✅ Custom access filter: tahfidz hanya untuk guru tahfidz + manager
    if (key === 'tahfidz' && !canAccessTahfidz(guru)) return false;

    return true;
  });
}, [hasAccess, guru]);   // ← tambah `guru` ke deps

  // Cek apakah user bisa akses shortcut tertentu
  const canAccess = (key: string) => accessibleKeys.includes(key);

  // ==========================================================================
  // LOAD saat open
  // ==========================================================================
  useEffect(() => {
    if (!open) return;

    // Filter shortcut yang sudah disimpan: buang yang tidak accessible
    const keys = currentShortcuts
      .filter((s) => PAGE_CONFIG[s.page_key] && canAccess(s.page_key))
      .sort((a, b) => a.urutan - b.urutan)
      .map((s) => s.page_key);

    setSelectedKeys(keys);
    setSearch('');
    setDraggingIndex(null);
    setDragOverIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentShortcuts, accessibleKeys]);

  // ==========================================================================
  // DERIVED
  // ==========================================================================
  const unselectedKeys = accessibleKeys.filter((k) => !selectedKeys.includes(k));

  const filteredAvailable = search.trim()
    ? unselectedKeys.filter((k) =>
        PAGE_CONFIG[k].label.toLowerCase().includes(search.toLowerCase())
      )
    : unselectedKeys;

  // ==========================================================================
  // HANDLERS — SELECTION
  // ==========================================================================
  const handleAdd = (key: string) => {
    if (selectedKeys.includes(key)) return;
    if (!canAccess(key)) return;
    setSelectedKeys([...selectedKeys, key]);
  };

  const handleRemove = (key: string) => {
    setSelectedKeys(selectedKeys.filter((k) => k !== key));
  };

  const handleClearAll = () => {
    setSelectedKeys([]);
  };

  // ==========================================================================
  // HANDLERS — REORDER
  // ==========================================================================
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const arr = [...selectedKeys];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    setSelectedKeys(arr);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedKeys.length - 1) return;
    const arr = [...selectedKeys];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    setSelectedKeys(arr);
  };

  // ==========================================================================
  // HANDLERS — DRAG & DROP
  // ==========================================================================
  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggingIndex === null || draggingIndex === index) {
      setDraggingIndex(null);
      setDragOverIndex(null);
      return;
    }
    const arr = [...selectedKeys];
    const [moved] = arr.splice(draggingIndex, 1);
    arr.splice(index, 0, moved);
    setSelectedKeys(arr);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  // ==========================================================================
  // HANDLERS — RESET & SAVE
  // ==========================================================================
  const handleReset = () => {
    // Filter DEFAULT_SHORTCUTS: hanya yang user bisa akses
    const filtered = DEFAULT_SHORTCUTS.filter((k) => canAccess(k));
    setSelectedKeys(filtered);
    setShowReset(false);
    showToast('info', `Shortcut direset ke default (${filtered.length} menu)`);
  };

  const handleSave = async () => {
    if (selectedKeys.length === 0) {
      showToast('error', 'Minimal pilih 1 shortcut');
      return;
    }

    setSaving(true);
    try {
      // 1. Delete existing
      const { error: delErr } = await supabase
        .from('user_dashboard_shortcuts')
        .delete()
        .eq('guru_id', guruId);
      if (delErr) throw delErr;

      // 2. Insert baru dengan urutan baru
      const rows = selectedKeys.map((key, i) => ({
        guru_id: guruId,
        page_key: key,
        urutan: i + 1,
      }));

      const { error: insErr } = await supabase
        .from('user_dashboard_shortcuts')
        .insert(rows);
      if (insErr) throw insErr;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.AUTH,
        targetId: guruId,
        deskripsi: `Update shortcut dashboard (${rows.length} item)`,
      });

      showToast('success', `${rows.length} shortcut disimpan`);
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <>
      <Modal open={open} onClose={onClose} title="Atur Shortcut" size="lg">
        <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">

          {/* INFO */}
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Pilih shortcut yang tampil di dashboard Anda.{' '}
              <strong className="text-slate-300">Seret</strong> atau gunakan{' '}
              <strong className="text-slate-300">tombol panah</strong> untuk mengatur urutan.
              <span className="block mt-1 text-[10px] text-indigo-300/70">
                🔒 Menu yang tampil disesuaikan dengan hak akses role Anda ({accessibleKeys.length} menu tersedia).
              </span>
            </div>
          </div>

          {/* ==================== TERPILIH ==================== */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <Check size={12} /> Terpilih ({selectedKeys.length})
              </label>
              {selectedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {selectedKeys.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-800 rounded-xl">
                <p className="text-[11px] text-slate-500">Belum ada shortcut terpilih</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Pilih dari daftar di bawah</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {selectedKeys.map((key, index) => {
                  const cfg = PAGE_CONFIG[key];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  const colors = COLOR_MAP[cfg.color] ?? COLOR_MAP.indigo;
                  const isDragging = draggingIndex === index;
                  const isDragOver = dragOverIndex === index && draggingIndex !== index;

                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 bg-slate-950/60 border rounded-xl p-2.5 transition ${
                        isDragging
                          ? 'opacity-40 border-indigo-500/40'
                          : isDragOver
                          ? 'border-indigo-500/60 bg-indigo-500/5 scale-[1.01]'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 shrink-0 select-none">
                        <GripVertical size={14} />
                      </div>

                      {/* Nomor */}
                      <span className="text-[10px] font-mono font-bold text-slate-500 w-5 shrink-0 text-center">
                        {index + 1}
                      </span>

                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${colors.bg} ${colors.border} ${colors.text}`}>
                        <Icon size={14} />
                      </div>

                      {/* Label */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {cfg.label}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Naik"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === selectedKeys.length - 1}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Turun"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(key)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ==================== TERSEDIA ==================== */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Plus size={12} /> Tambah Shortcut
              <span className="text-slate-600 font-normal normal-case">
                ({unselectedKeys.length} tersedia)
              </span>
            </label>

            {unselectedKeys.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-slate-800 rounded-xl">
                <p className="text-[11px] text-emerald-400 font-bold">
                  ✓ Semua menu yang bisa Anda akses sudah dipilih
                </p>
              </div>
            ) : (
              <>
                {unselectedKeys.length > 4 && (
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari menu..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {filteredAvailable.map((key) => {
                    const cfg = PAGE_CONFIG[key];
                    const Icon = cfg.icon;
                    const colors = COLOR_MAP[cfg.color] ?? COLOR_MAP.indigo;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleAdd(key)}
                        className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-500/5 rounded-xl p-2 transition cursor-pointer text-left group"
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition group-hover:scale-110 ${colors.bg} ${colors.border} ${colors.text}`}>
                          <Icon size={12} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-300 truncate flex-1">
                          {cfg.label}
                        </p>
                        <Plus size={11} className="text-slate-600 group-hover:text-indigo-400 transition shrink-0" />
                      </button>
                    );
                  })}
                  {filteredAvailable.length === 0 && search.trim() && (
                    <p className="text-[11px] text-slate-500 text-center py-3 col-span-full">
                      Menu &quot;{search}&quot; tidak ditemukan
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ==================== FOOTER ==================== */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={11} /> Reset Default
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || selectedKeys.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save size={14} /> Simpan</>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* CONFIRM RESET */}
      <ConfirmModal
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={handleReset}
        title="Reset Shortcut"
        message="Reset ke pengaturan default? Shortcut Anda akan digantikan dengan menu standar sesuai role Anda."
        variant="warning"
        confirmLabel="Ya, Reset"
      />
    </>
  );
}