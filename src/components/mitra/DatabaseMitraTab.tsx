// src/components/mitra/DatabaseMitraTab.tsx
// Tab Database Mitra — list, filter, CRUD.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Building2, Search, Filter, X, Eye, Pencil, Trash2, Plus,
  Star, FileSignature, Users, CheckCircle2, AlertCircle, Globe, Phone,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalMitra } from './ModalMitra';
import { ModalDetailMitra } from './ModalDetailMitra';
import {
  getStatusMitraBadge, getJenisMitraBadge, getRatingStars,
  isMitraManager,
  INPUT_CLASS,
} from './shared';
import {
  JENIS_MITRA_OPTIONS, STATUS_MITRA_OPTIONS,
} from '@/types/database';
import type { MitraWithRelations } from '@/types/database';

export function DatabaseMitraTab() {
  const { guru } = useAuth();
  const isManager = isMitraManager(guru?.role);

  const [list, setList] = useState<MitraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MitraWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<MitraWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MitraWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_mitra_lengkap')
        .select('*')
        .order('nama');

      if (error) throw error;
      setList((data as MitraWithRelations[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat mitra: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((m) => {
      if (filterJenis && m.jenis_mitra !== filterJenis) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          m.nama.toLowerCase().includes(q) ||
          (m.kode_mitra ?? '').toLowerCase().includes(q) ||
          (m.bidang_industri ?? '').toLowerCase().includes(q) ||
          (m.kota ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, filterStatus, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const aktif = list.filter((m) => m.status === 'Aktif').length;
    const withMou = list.filter((m) => (m.total_mou_aktif ?? 0) > 0).length;
    const expiringSoon = list.filter((m) => (m.mou_expiring_soon ?? 0) > 0).length;
    const totalSiswaPKL = list.reduce((s, m) => s + (m.total_siswa_pkl ?? 0), 0);
    return { total, aktif, withMou, expiringSoon, totalSiswaPKL };
  }, [list]);

  const resetFilter = () => {
    setSearch(''); setFilterJenis(''); setFilterStatus('');
  };
  const hasFilter = search || filterJenis || filterStatus;

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (item: MitraWithRelations) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('mitra')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus mitra: ${deleteTarget.nama}`,
      });
      showToast('success', 'Mitra dihapus');
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
            <Building2 className="text-indigo-400" size={20} /> Database Mitra
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} mitra · {stats.totalSiswaPKL} siswa pernah PKL
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
          >
            <Plus size={16} /> Mitra Baru
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Total Mitra" value={stats.total} color="indigo" />
        <KpiCard icon={CheckCircle2} label="Aktif" value={stats.aktif} color="emerald" />
        <KpiCard icon={FileSignature} label="Punya MoU Aktif" value={stats.withMou} color="teal" />
        <KpiCard icon={AlertCircle} label="MoU Akan Expired" value={stats.expiringSoon} color="amber" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter
          </div>
          {hasFilter && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, kota..."
              className={INPUT_CLASS + ' pl-10'}
            />
          </div>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Jenis</option>
            {JENIS_MITRA_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Status</option>
            {STATUS_MITRA_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Building2 size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada mitra cocok' : 'Belum ada mitra'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <MitraCard
              key={item.id}
              item={item}
              isManager={isManager}
              onDetail={() => setDetailTarget(item)}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      <ModalMitra
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchAll}
        editing={editing}
        currentGuruId={guru?.id ?? ''}
      />

      <ModalDetailMitra
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onRefresh={fetchAll}
        mitra={detailTarget}
        isManager={isManager}
        onEdit={() => {
          if (detailTarget) {
            setDetailTarget(null);
            handleOpenEdit(detailTarget);
          }
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Mitra"
        message={`Yakin hapus "${deleteTarget?.nama}"? Semua MoU & riwayat kerjasama akan ikut terhapus.`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function MitraCard({
  item, isManager, onDetail, onEdit, onDelete,
}: {
  item: MitraWithRelations;
  isManager: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer group overflow-hidden flex flex-col"
      onClick={onDetail}
    >
      {/* Header */}
      <div className="p-4 flex items-start gap-3 border-b border-slate-800">
        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
          {item.logo_url ? (
            <img src={item.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={18} className="text-indigo-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisMitraBadge(item.jenis_mitra)}`}>
              {item.jenis_mitra}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusMitraBadge(item.status)}`}>
              {item.status}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-100 truncate">{item.nama}</p>
          <p className="text-[10px] font-mono text-indigo-400">{item.kode_mitra ?? '-'}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col space-y-3">
        {item.bidang_industri && (
          <p className="text-[11px] text-slate-400 truncate">
            🏭 {item.bidang_industri}
          </p>
        )}

        {item.kota && (
          <p className="text-[11px] text-slate-400 truncate">
            📍 {item.kota}{item.provinsi ? `, ${item.provinsi}` : ''}
          </p>
        )}

        {item.pic_nama && (
          <p className="text-[11px] text-slate-400 truncate">
            👤 {item.pic_nama}{item.pic_jabatan ? ` (${item.pic_jabatan})` : ''}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-amber-400 font-bold">
            {getRatingStars(item.rating)}
          </span>
          <span className="text-[10px] text-slate-500">({item.rating}/5)</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
          <div className="text-center">
            <p className="text-base font-extrabold text-emerald-400">{item.total_mou_aktif ?? 0}</p>
            <p className="text-[9px] font-bold uppercase text-slate-500">MoU Aktif</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold text-indigo-400">{item.total_siswa_pkl ?? 0}</p>
            <p className="text-[9px] font-bold uppercase text-slate-500">Siswa PKL</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold text-teal-400">{item.total_siswa_direkrut ?? 0}</p>
            <p className="text-[9px] font-bold uppercase text-slate-500">Direkrut</p>
          </div>
        </div>

        {item.mou_expiring_soon && item.mou_expiring_soon > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle size={10} />
            {item.mou_expiring_soon} MoU akan expired &lt; 30 hari
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onDetail(); }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer"
        >
          <Eye size={11} /> Detail
        </button>
        {isManager && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              title="Hapus"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'teal' | 'amber';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Building2; label: string; value: number; color: KpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}