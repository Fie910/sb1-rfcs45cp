// src/components/arsip/KelolaKategoriTab.tsx
// Tab Kelola Kategori — CRUD kategori arsip.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, FolderTree, Plus, Pencil, Trash2, Search,
  FolderOpen, X, Shield, Clock, Hash,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalKategori } from './ModalKategori';
import {
  getAksesLevelBadge, getKategoriBadge,
  INPUT_CLASS,
} from './shared';
import type { ArsipKategori } from '@/types/database';

export function KelolaKategoriTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<(ArsipKategori & { total_dokumen?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ArsipKategori | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArsipKategori | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [katRes, countRes] = await Promise.all([
        supabase.from('arsip_kategori').select('*').order('urutan_tampil'),
        supabase.from('arsip_dokumen').select('kategori_id').is('deleted_at', null),
      ]);

      if (katRes.error) throw katRes.error;

      // Hitung total per kategori
      const countMap = new Map<string, number>();
      (countRes.data ?? []).forEach((d: any) => {
        countMap.set(d.kategori_id, (countMap.get(d.kategori_id) ?? 0) + 1);
      });

      const enriched = (katRes.data as ArsipKategori[]).map((k) => ({
        ...k,
        total_dokumen: countMap.get(k.id) ?? 0,
      }));

      setList(enriched);
    } catch (err: any) {
      showToast('error', 'Gagal memuat kategori: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (k) =>
        k.nama.toLowerCase().includes(q) ||
        (k.deskripsi ?? '').toLowerCase().includes(q)
    );
  }, [list, search]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: ArsipKategori) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Cek jumlah dokumen
      const { count } = await supabase
        .from('arsip_dokumen')
        .select('*', { count: 'exact', head: true })
        .eq('kategori_id', deleteTarget.id)
        .is('deleted_at', null);

      if (count && count > 0) {
        showToast('error', `Tidak bisa hapus — masih ada ${count} dokumen di kategori ini`);
        setDeleteTarget(null);
        return;
      }

      const { error } = await supabase
        .from('arsip_kategori')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus kategori arsip: ${deleteTarget.nama}`,
      });
      showToast('success', 'Kategori dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <FolderTree className="text-indigo-400" size={20} /> Kelola Kategori
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {list.length} kategori · {list.reduce((s, k) => s + (k.total_dokumen ?? 0), 0)} dokumen total
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
        >
          <Plus size={16} /> Kategori Baru
        </button>
      </div>

      {/* SEARCH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kategori..."
            className={INPUT_CLASS + ' pl-10'}
          />
        </div>
      </div>

      {/* GRID */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <FolderOpen size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {list.length === 0 ? 'Belum ada kategori' : 'Tidak ada yang cocok'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((k) => (
            <KategoriCard
              key={k.id}
              item={k}
              onEdit={() => handleOpenEdit(k)}
              onDelete={() => setDeleteTarget(k)}
            />
          ))}
        </div>
      )}

      {/* MODAL */}
      <ModalKategori
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAll}
        editing={editing}
      />

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kategori"
        message={`Yakin hapus kategori "${deleteTarget?.nama}"? Kategori hanya bisa dihapus kalau tidak ada dokumen di dalamnya.`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function KategoriCard({
  item, onEdit, onDelete,
}: {
  item: ArsipKategori & { total_dokumen?: number };
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 hover:border-indigo-500/40 transition">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getKategoriBadge(item.warna)}`}>
          <FolderOpen size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">
                {item.nama}
              </p>
              <p className="text-[10px] text-slate-500">
                {item.total_dokumen ?? 0} dokumen
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                title="Edit"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Hapus"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {item.deskripsi && (
            <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
              {item.deskripsi}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 ${getAksesLevelBadge(item.akses_level)}`}>
              <Shield size={8} /> {item.akses_level}
            </span>
            <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 inline-flex items-center gap-0.5">
              <Clock size={8} /> {item.retensi_default_bulan} bln
            </span>
            {!item.is_aktif && (
              <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                Non-aktif
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}