// src/components/mitra/MouKerjasamaTab.tsx
// Tab MoU & Kerjasama — list, filter, expiry tracking, CRUD.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, FileSignature, Search, Filter, X, Eye, Pencil, Trash2, Plus,
  AlertTriangle, CheckCircle2, Clock, Calendar, Building2, ExternalLink,
  Copy, History, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalMou } from './ModalMou';
import { ModalDetailMou } from './ModalDetailMou';
import {
  getStatusMouBadge, getExpiryStatusBadge, getExpiryStatusLabel,
  formatTanggal, daysToExpiry,
  isMitraManager,
  INPUT_CLASS,
} from './shared';
import {
  JENIS_MOU_OPTIONS, STATUS_MOU_OPTIONS,
} from '@/types/database';
import type { MouWithRelations, MitraWithRelations } from '@/types/database';

type ExpiryFilter = 'semua' | 'aktif' | 'expiring_h30' | 'expired';

export function MouKerjasamaTab() {
  const { guru } = useAuth();
  const isManager = isMitraManager(guru?.role);

  const [list, setList] = useState<MouWithRelations[]>([]);
  const [mitraList, setMitraList] = useState<MitraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMitra, setFilterMitra] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('semua');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MouWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<MouWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MouWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mouRes, mitraRes] = await Promise.all([
        supabase
          .from('v_mou_lengkap')
          .select('*')
          .order('tanggal_selesai', { ascending: true }),
        supabase
          .from('v_mitra_lengkap')
          .select('*')
          .eq('status', 'Aktif')
          .order('nama'),
      ]);

      if (mouRes.error) throw mouRes.error;

      setList((mouRes.data as MouWithRelations[]) ?? []);
      setMitraList((mitraRes.data as MitraWithRelations[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat MoU: ' + (err.message || 'Error'));
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
      if (filterJenis && m.jenis_mou !== filterJenis) return false;
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterMitra && m.mitra_id !== filterMitra) return false;

      // Expiry filter
      if (expiryFilter === 'aktif' && m.status !== 'Aktif') return false;
      if (expiryFilter === 'expiring_h30') {
        if (m.status !== 'Aktif') return false;
        const days = daysToExpiry(m.tanggal_selesai);
        if (days < 0 || days > 30) return false;
      }
      if (expiryFilter === 'expired') {
        if (m.status !== 'Aktif') return false;
        if (daysToExpiry(m.tanggal_selesai) >= 0) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          m.judul.toLowerCase().includes(q) ||
          (m.nomor_mou ?? '').toLowerCase().includes(q) ||
          (m.mitra_nama ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, filterStatus, filterMitra, expiryFilter, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const aktif = list.filter((m) => m.status === 'Aktif').length;
    const expiring30 = list.filter((m) => {
      if (m.status !== 'Aktif') return false;
      const days = daysToExpiry(m.tanggal_selesai);
      return days >= 0 && days <= 30;
    }).length;
    const expired = list.filter((m) => {
      if (m.status !== 'Aktif') return false;
      return daysToExpiry(m.tanggal_selesai) < 0;
    }).length;
    return { total, aktif, expiring30, expired };
  }, [list]);

  const resetFilter = () => {
    setSearch(''); setFilterJenis(''); setFilterStatus('');
    setFilterMitra(''); setExpiryFilter('semua');
  };
  const hasFilter = search || filterJenis || filterStatus || filterMitra || expiryFilter !== 'semua';

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    if (mitraList.length === 0) {
      showToast('error', 'Belum ada mitra. Buat mitra dulu di tab Database Mitra.');
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (item: MouWithRelations) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('mou')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus MoU: ${deleteTarget.nomor_mou} — ${deleteTarget.mitra_nama}`,
      });
      showToast('success', 'MoU dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const handleCopyNomor = (nomor: string | null) => {
    if (!nomor) return;
    navigator.clipboard.writeText(nomor);
    showToast('success', 'Nomor disalin');
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
            <FileSignature className="text-indigo-400" size={20} /> MoU & Kerjasama
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} MoU · {stats.aktif} aktif
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
          >
            <Plus size={16} /> MoU Baru
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={FileSignature} label="Total MoU" value={stats.total} color="indigo" />
        <KpiCard icon={CheckCircle2} label="Aktif" value={stats.aktif} color="emerald" />
        <KpiCard icon={Clock} label="Expiring ≤ 30 Hari" value={stats.expiring30} color="amber" />
        <KpiCard icon={AlertTriangle} label="Expired" value={stats.expired} color="rose" />
      </div>

      {/* EXPIRY QUICK FILTER */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'semua' as const, label: 'Semua', icon: FileSignature },
          { key: 'aktif' as const, label: 'Aktif', icon: CheckCircle2 },
          { key: 'expiring_h30' as const, label: `Akan Expired (${stats.expiring30})`, icon: Clock },
          { key: 'expired' as const, label: `Expired (${stats.expired})`, icon: AlertTriangle },
        ].map((t) => {
          const Icon = t.icon;
          const active = expiryFilter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setExpiryFilter(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                active
                  ? t.key === 'expired'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                    : t.key === 'expiring_h30'
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={11} />
              {t.label}
            </button>
          );
        })}
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, nomor, mitra..."
              className={INPUT_CLASS + ' pl-10'}
            />
          </div>
          <select
            value={filterMitra}
            onChange={(e) => setFilterMitra(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Mitra</option>
            {mitraList.map((m) => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Jenis</option>
            {JENIS_MOU_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Status</option>
            {STATUS_MOU_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <FileSignature size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada MoU cocok' : 'Belum ada MoU'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {!hasFilter && isManager ? 'Klik "MoU Baru" untuk memulai' : null}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <MouCard
              key={item.id}
              item={item}
              isManager={isManager}
              onDetail={() => setDetailTarget(item)}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => setDeleteTarget(item)}
              onCopyNomor={() => handleCopyNomor(item.nomor_mou)}
            />
          ))}
        </div>
      )}

      {/* MODALS */}
      <ModalMou
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchAll}
        editing={editing}
        mitraList={mitraList}
        currentGuruId={guru?.id ?? ''}
      />

      <ModalDetailMou
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onRefresh={fetchAll}
        mou={detailTarget}
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
        title="Hapus MoU"
        message={`Yakin hapus MoU "${deleteTarget?.nomor_mou}"? File & riwayat terkait akan ikut terhapus.`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function MouCard({
  item, isManager, onDetail, onEdit, onDelete, onCopyNomor,
}: {
  item: MouWithRelations;
  isManager: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyNomor: () => void;
}) {
  const days = daysToExpiry(item.tanggal_selesai);
  const isExpired = item.status === 'Aktif' && days < 0;
  const isH7 = item.status === 'Aktif' && days >= 0 && days <= 7;
  const isH30 = item.status === 'Aktif' && days > 7 && days <= 30;

  return (
    <div
      className={`bg-slate-900 rounded-2xl border transition cursor-pointer group ${
        isExpired
          ? 'border-rose-500/40 bg-rose-950/10'
          : isH7
          ? 'border-rose-500/30 bg-rose-950/5'
          : isH30
          ? 'border-amber-500/30 bg-amber-950/5'
          : 'border-slate-800 hover:border-indigo-500/40'
      }`}
      onClick={onDetail}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
            isExpired
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              : isH7
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              : isH30
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
          }`}>
            <FileSignature size={18} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusMouBadge(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {item.jenis_mou}
                  </span>
                  {item.expiry_status && item.expiry_status !== 'Aman' && item.status === 'Aktif' && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5 ${getExpiryStatusBadge(item.expiry_status)}`}>
                      <AlertTriangle size={8} />
                      {getExpiryStatusLabel(item.expiry_status)}
                    </span>
                  )}
                  {item.parent_mou_nomor && (
                    <span className="text-[9px] font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 inline-flex items-center gap-0.5">
                      <History size={8} /> Perpanjangan
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-100">{item.judul}</p>
              </div>

              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
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

            {/* Nomor MoU */}
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-mono text-indigo-400">{item.nomor_mou ?? '-'}</p>
              {item.nomor_mou && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCopyNomor(); }}
                  className="p-0.5 rounded text-slate-500 hover:text-indigo-400 transition cursor-pointer"
                  title="Copy nomor"
                >
                  <Copy size={10} />
                </button>
              )}
            </div>

            {/* Mitra */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                {item.mitra_logo ? (
                  <img src={item.mitra_logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={11} className="text-indigo-400" />
                )}
              </div>
              <p className="text-xs text-slate-300 font-semibold truncate">
                {item.mitra_nama ?? '-'}
              </p>
            </div>

            {/* Periode */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 mb-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 inline-flex items-center gap-1">
                  <Calendar size={10} /> Periode
                </span>
                <span className="text-slate-300 font-semibold">
                  {formatTanggal(item.tanggal_mulai)} — {formatTanggal(item.tanggal_selesai)}
                </span>
              </div>
              {item.durasi_bulan && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Durasi</span>
                  <span className="text-slate-300 font-semibold">{item.durasi_bulan} bulan</span>
                </div>
              )}
              {item.status === 'Aktif' && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                  <span className="text-slate-500 inline-flex items-center gap-1">
                    <Clock size={10} /> Sisa waktu
                  </span>
                  <span className={`font-bold ${
                    days < 0 ? 'text-rose-400' :
                    days <= 7 ? 'text-rose-400' :
                    days <= 30 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {days < 0 ? `Lewat ${Math.abs(days)} hari` : `${days} hari`}
                  </span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onDetail(); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer"
                >
                  <Eye size={11} /> Detail
                </button>
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 text-[10px] font-bold transition"
                  >
                    <ExternalLink size={11} /> File
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof FileSignature; label: string; value: number; color: KpiColor;
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