// src/components/rapat/ManajemenRapatTab.tsx
// Tab Manajemen Rapat — CRUD rapat, statistik, rekap.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Plus, Calendar, Users, BarChart3, Pencil, Trash2,
  Eye, CheckCircle2, Clock, TrendingUp, RefreshCw, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalRapat } from './ModalRapat';
import {
  getStatusRapatBadge, getJenisRapatBadge, getKehadiranBadge,
  formatTanggalRapat, formatWaktuRapat, formatTanggalPendek,
  INPUT_CLASS,
  JENIS_RAPAT_OPTIONS,
} from './shared';
import type {
  RapatWithRelations, Guru, RapatPesertaWithGuru,
} from '@/types/database';

export function ManajemenRapatTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<RapatWithRelations[]>([]);
  const [guruList, setGuruList] = useState<Pick<Guru, 'id' | 'nama_lengkap' | 'nip' | 'jenis_ptk'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterJenis, setFilterJenis] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RapatWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RapatWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<RapatWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rapatRes, guruRes] = await Promise.all([
        supabase
          .from('v_rapat_lengkap')
          .select('*')
          .order('tanggal', { ascending: false }),
        supabase
          .from('gurus')
          .select('id, nama_lengkap, nip, jenis_ptk')
          .order('nama_lengkap'),
      ]);
      if (rapatRes.error) throw rapatRes.error;
      setList((rapatRes.data as RapatWithRelations[]) ?? []);
      setGuruList((guruRes.data as any[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (filterJenis && r.jenis !== filterJenis) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          r.judul.toLowerCase().includes(q) ||
          (r.nomor_rapat ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, search]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = list.length;
    const byStatus: Record<string, number> = {};
    list.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    });
    const byJenis: Record<string, number> = {};
    list.forEach((r) => {
      byJenis[r.jenis] = (byJenis[r.jenis] ?? 0) + 1;
    });
    const denganNotulensi = list.filter((r) => r.has_notulensi).length;
    const notulensiFinal = list.filter((r) => r.notulensi_status === 'Final').length;

    return { total, byStatus, byJenis, denganNotulensi, notulensiFinal };
  }, [list]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: RapatWithRelations) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('rapat')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.TODO,
        targetId: deleteTarget.id,
        deskripsi: `Hapus rapat: ${deleteTarget.judul}`,
      });
      showToast('success', 'Rapat dihapus');
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
            <BarChart3 className="text-indigo-400" size={20} /> Manajemen Rapat
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} rapat · {stats.denganNotulensi} dengan notulensi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
          >
            <Plus size={16} /> Buat Rapat
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Calendar} label="Total Rapat" value={stats.total} color="indigo" />
        <KpiCard icon={Clock} label="Akan Datang" value={stats.byStatus['Akan Datang'] ?? 0} color="blue" />
        <KpiCard icon={CheckCircle2} label="Selesai" value={stats.byStatus['Selesai'] ?? 0} color="emerald" />
        <KpiCard icon={AlertCircle} label="Dibatalkan" value={stats.byStatus['Dibatalkan'] ?? 0} color="rose" />
        <KpiCard icon={TrendingUp} label="Notulensi Final" value={stats.notulensiFinal} color="purple" />
      </div>

      {/* DISTRIBUSI JENIS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
          Distribusi Per Jenis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {JENIS_RAPAT_OPTIONS.filter((j) => (stats.byJenis[j] ?? 0) > 0).map((j) => (
            <div
              key={j}
              className={`px-3 py-2.5 rounded-xl border ${getJenisRapatBadge(j)}`}
            >
              <p className="text-[10px] font-bold opacity-80">{j}</p>
              <p className="text-xl font-extrabold mt-0.5">{stats.byJenis[j] ?? 0}</p>
            </div>
          ))}
          {Object.keys(stats.byJenis).length === 0 && (
            <p className="text-[11px] text-slate-500 col-span-4 text-center py-4">
              Belum ada data
            </p>
          )}
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari judul atau nomor rapat..."
          className={INPUT_CLASS}
        />
        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value)}
          className={INPUT_CLASS + ' cursor-pointer'}
        >
          <option value="">Semua Jenis</option>
          {JENIS_RAPAT_OPTIONS.map((j) => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Calendar size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">Belum ada rapat</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Rapat</th>
                  <th className="text-left px-4 py-3">Jadwal</th>
                  <th className="text-center px-4 py-3">Peserta</th>
                  <th className="text-center px-4 py-3">Notulensi</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisRapatBadge(r.jenis)}`}>
                            {r.jenis}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusRapatBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="font-bold text-slate-200 truncate max-w-[260px]">
                          {r.judul}
                        </p>
                        <p className="text-[10px] font-mono text-indigo-400">
                          {r.nomor_rapat ?? '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300 font-semibold">
                        {formatTanggalPendek(r.tanggal)}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatWaktuRapat(r.waktu_mulai, r.waktu_selesai)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-bold text-slate-300">
                        {r.total_hadir ?? 0}/{r.total_peserta ?? 0}
                      </span>
                      <p className="text-[10px] text-slate-500">hadir</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.notulensi_status ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          r.notulensi_status === 'Final'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {r.notulensi_status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setDetailTarget(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                          title="Detail"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREATE/EDIT */}
      <ModalRapat
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAll}
        editing={editing}
        guruList={guruList}
        currentGuruId={guru?.id ?? ''}
      />

      {/* MODAL DETAIL */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Rapat"
        size="md"
      >
        {detailTarget && <RapatDetail item={detailTarget} />}
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Rapat"
        message={`Yakin hapus rapat "${deleteTarget?.judul}"? Semua notulensi & peserta akan ikut terhapus.`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Detail
// =============================================================================
function RapatDetail({ item }: { item: RapatWithRelations }) {
  const [peserta, setPeserta] = useState<RapatPesertaWithGuru[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('rapat_peserta')
        .select(`*, guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)`)
        .eq('rapat_id', item.id);
      setPeserta((data as RapatPesertaWithGuru[]) ?? []);
    })();
  }, [item.id]);

  return (
    <div className="space-y-3 pt-1">
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] font-mono text-indigo-400">{item.nomor_rapat}</p>
        <p className="text-sm font-bold text-slate-100 mt-0.5">{item.judul}</p>
        <p className="text-xs text-slate-400 mt-1">
          {formatTanggalRapat(item.tanggal)} · {formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] uppercase text-slate-500">Pemimpin</p>
          <p className="font-bold text-slate-200 truncate">{item.pemimpin_nama ?? '-'}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] uppercase text-slate-500">Notulis</p>
          <p className="font-bold text-slate-200 truncate">{item.notulis_nama ?? '-'}</p>
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
        <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">
          Peserta ({peserta.length})
        </p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {peserta.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-300 truncate">
                {p.guru?.nama_lengkap ?? '-'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getKehadiranBadge(p.status_kehadiran)}`}>
                {p.status_kehadiran}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'blue' | 'emerald' | 'rose' | 'purple';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Calendar; label: string; value: number; color: KpiColor;
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