// src/components/rapat/ManajemenRapatTab.tsx
// Tab Manajemen Rapat — CRUD, statistik, attendance override, Tutup/Batalkan/Reopen,
// auto-close trigger, dan cetak notulensi PDF.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Plus, Calendar, Users, BarChart3, Pencil, Trash2,
  Eye, CheckCircle2, Clock, TrendingUp, RefreshCw, AlertCircle,
  PlayCircle, XCircle, RotateCcw, Lock, FileCheck2, Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalRapat } from './ModalRapat';
import { generateNotulensiPDF } from '@/lib/generateNotulensiPDF';
import {
  getStatusRapatBadge, getJenisRapatBadge, getKehadiranBadge,
  formatTanggalRapat, formatWaktuRapat, formatTanggalPendek,
  INPUT_CLASS,
  JENIS_RAPAT_OPTIONS,
  KEHADIRAN_RAPAT_OPTIONS,
  autoCloseStaleRapat,
} from './shared';
import type {
  RapatWithRelations, Guru, RapatPesertaWithGuru,
  StatusKehadiranRapat,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type ConfirmAction = {
  type: 'close' | 'cancel' | 'reopen';
  rapat: RapatWithRelations;
};

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

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [printingId, setPrintingId] = useState<string | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const closed = await autoCloseStaleRapat();
      if (closed > 0) {
        showToast('info', `${closed} rapat menggantung di-close otomatis`);
      }

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
  // FILTER + STATS
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
  // HANDLERS — CRUD
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
  // HANDLERS — Close / Cancel / Reopen
  // ==========================================================================
  const handleExecuteAction = async () => {
    if (!confirmAction || !guru?.id) return;
    setActionLoading(true);

    const { type, rapat } = confirmAction;

    try {
      let updatePayload: any = {};
      let logMsg = '';

      if (type === 'close') {
        updatePayload = {
          status: 'Selesai',
          closed_at: new Date().toISOString(),
          closed_by: guru.id,
          close_note: 'Ditutup oleh manager',
        };
        logMsg = `Tutup rapat: ${rapat.judul}`;
      } else if (type === 'cancel') {
        updatePayload = {
          status: 'Dibatalkan',
          closed_at: new Date().toISOString(),
          closed_by: guru.id,
          close_note: 'Dibatalkan oleh manager',
        };
        logMsg = `Batalkan rapat: ${rapat.judul}`;
      } else if (type === 'reopen') {
        updatePayload = {
          status: 'Berlangsung',
          closed_at: null,
          closed_by: null,
          close_note: null,
        };
        logMsg = `Reopen rapat: ${rapat.judul}`;
      }

      const { error } = await supabase
        .from('rapat')
        .update(updatePayload)
        .eq('id', rapat.id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.TODO,
        targetId: rapat.id,
        deskripsi: logMsg,
      });

      showToast('success', logMsg);
      setConfirmAction(null);
      setDetailTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================================
  // HANDLERS — Cetak Notulensi PDF
  // ==========================================================================
  const handleCetakNotulensi = async (rapat: RapatWithRelations) => {
    if (rapat.notulensi_status !== 'Final') {
      showToast('error', 'Notulensi harus difinalisasi dulu sebelum dicetak');
      return;
    }

    setPrintingId(rapat.id);
    try {
      const [notRes, pesertaRes] = await Promise.all([
        supabase
          .from('rapat_notulensi')
          .select('*')
          .eq('rapat_id', rapat.id)
          .single(),
        supabase
          .from('rapat_peserta')
          .select(`
            status_kehadiran,
            jabatan_dalam_rapat,
            guru:gurus!guru_id(nama_lengkap)
          `)
          .eq('rapat_id', rapat.id)
          .order('jabatan_dalam_rapat'),
      ]);

      if (notRes.error) throw notRes.error;

      const notulensi = notRes.data as any;
      if (!notulensi.verification_token) {
        showToast('error', 'Token verifikasi belum tersedia. Coba refresh.');
        return;
      }

      await generateNotulensiPDF({
        nomor_rapat: rapat.nomor_rapat ?? '-',
        judul_rapat: rapat.judul,
        jenis_rapat: rapat.jenis,
        tanggal: rapat.tanggal,
        waktu_mulai: rapat.waktu_mulai,
        waktu_selesai: rapat.waktu_selesai,
        lokasi: rapat.lokasi,
        penyelenggara: rapat.penyelenggara,
        pemimpin_nama: rapat.pemimpin_nama ?? null,
        pemimpin_nip: rapat.pemimpin_nip ?? null,
        notulis_nama: rapat.notulis_nama ?? null,
        notulis_nip: rapat.notulis_nip ?? null,
        total_peserta: rapat.total_peserta ?? 0,
        total_hadir: rapat.total_hadir ?? 0,
        ringkasan: notulensi.ringkasan,
        pembahasan: notulensi.pembahasan,
        keputusan: notulensi.keputusan,
        action_items: Array.isArray(notulensi.action_items) ? notulensi.action_items : [],
        verification_token: notulensi.verification_token,
        peserta: (pesertaRes.data ?? []).map((p: any) => ({
          nama: p.guru?.nama_lengkap ?? '-',
          jabatan: p.jabatan_dalam_rapat,
          kehadiran: p.status_kehadiran,
        })),
      });

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.TODO,
        targetId: rapat.id,
        deskripsi: `Cetak notulensi: ${rapat.nomor_rapat}`,
      });

      showToast('success', 'Notulensi berhasil dicetak');
    } catch (err: any) {
      showToast('error', 'Gagal cetak: ' + (err.message || 'Error'));
    } finally {
      setPrintingId(null);
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
            <div key={j} className={`px-3 py-2.5 rounded-xl border ${getJenisRapatBadge(j)}`}>
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
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisRapatBadge(r.jenis)}`}>
                            {r.jenis}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusRapatBadge(r.status)}`}>
                            {r.status}
                          </span>
                          {r.close_note && r.close_note.includes('Auto-close') && (
                            <span className="text-[9px] font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 inline-flex items-center gap-0.5">
                              <Lock size={8} /> auto
                            </span>
                          )}
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
        size="lg"
      >
        {detailTarget && (
          <RapatDetailManager
            item={detailTarget}
            currentGuruId={guru?.id}
            printingId={printingId}
            onRefresh={fetchAll}
            onAction={(type) => setConfirmAction({ type, rapat: detailTarget })}
            onCetak={handleCetakNotulensi}
          />
        )}
      </Modal>

      {/* CONFIRM ACTION (close/cancel/reopen) */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleExecuteAction}
        title={
          confirmAction?.type === 'close'
            ? 'Tutup Rapat'
            : confirmAction?.type === 'cancel'
            ? 'Batalkan Rapat'
            : 'Reopen Rapat'
        }
        message={
          confirmAction?.type === 'close'
            ? `Tutup rapat "${confirmAction.rapat.judul}" tanpa finalisasi notulensi? Rapat akan ditandai Selesai dan tidak bisa check-in lagi.`
            : confirmAction?.type === 'cancel'
            ? `Batalkan rapat "${confirmAction.rapat.judul}"? Peserta akan melihat status Dibatalkan.`
            : `Buka kembali rapat "${confirmAction?.rapat.judul}"? Status akan kembali ke Berlangsung.`
        }
        variant={
          confirmAction?.type === 'cancel'
            ? 'danger'
            : confirmAction?.type === 'close'
            ? 'warning'
            : 'default'
        }
        confirmLabel={
          confirmAction?.type === 'close'
            ? 'Ya, Tutup'
            : confirmAction?.type === 'cancel'
            ? 'Ya, Batalkan'
            : 'Ya, Reopen'
        }
      />

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
// SUB: Detail dengan Action Buttons + Cetak
// =============================================================================
function RapatDetailManager({
  item, currentGuruId, printingId, onRefresh, onAction, onCetak,
}: {
  item: RapatWithRelations;
  currentGuruId: string | undefined;
  printingId: string | null;
  onRefresh: () => void;
  onAction: (type: 'close' | 'cancel' | 'reopen') => void;
  onCetak: (rapat: RapatWithRelations) => void;
}) {
  const [peserta, setPeserta] = useState<RapatPesertaWithGuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [startingMeeting, setStartingMeeting] = useState(false);

  const canReopen = useMemo(() => {
    if (item.status !== 'Selesai' || !item.closed_at) return false;
    const closedAt = new Date(item.closed_at).getTime();
    const daysSince = (Date.now() - closedAt) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }, [item.status, item.closed_at]);

  const canPrint = item.notulensi_status === 'Final';
  const isPrinting = printingId === item.id;

  const fetchPeserta = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('rapat_peserta')
        .select(`*, guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)`)
        .eq('rapat_id', item.id)
        .order('jabatan_dalam_rapat', { ascending: true });
      setPeserta((data as RapatPesertaWithGuru[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => { fetchPeserta(); }, [fetchPeserta]);

  const handleUpdateKehadiran = async (pesertaId: string, status: StatusKehadiranRapat) => {
    setUpdatingId(pesertaId);
    try {
      const { error } = await supabase
        .from('rapat_peserta')
        .update({ status_kehadiran: status })
        .eq('id', pesertaId);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.TODO,
        targetId: pesertaId,
        deskripsi: `Update kehadiran rapat "${item.judul}": ${status}`,
      });

      showToast('success', `Kehadiran: ${status}`);
      fetchPeserta();
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBukaSesi = async () => {
    setStartingMeeting(true);
    try {
      const { error } = await supabase
        .from('rapat')
        .update({ status: 'Berlangsung' })
        .eq('id', item.id);
      if (error) throw error;

      showToast('success', 'Sesi rapat dibuka!');
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setStartingMeeting(false);
    }
  };

  const stats = useMemo(() => {
    const total = peserta.length;
    const hadir = peserta.filter((p) => p.status_kehadiran === 'Hadir').length;
    const terlambat = peserta.filter((p) => p.status_kehadiran === 'Terlambat').length;
    const izin = peserta.filter((p) => p.status_kehadiran === 'Izin').length;
    const tidakHadir = peserta.filter((p) => p.status_kehadiran === 'Tidak Hadir').length;
    const belum = peserta.filter((p) => p.status_kehadiran === 'Belum Dikonfirmasi').length;
    const persen = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;
    return { total, hadir, terlambat, izin, tidakHadir, belum, persen };
  }, [peserta]);

  return (
    <div className="space-y-3 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisRapatBadge(item.jenis)}`}>
                {item.jenis}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusRapatBadge(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="text-[10px] font-mono text-indigo-400">{item.nomor_rapat ?? '-'}</p>
            <p className="text-sm font-extrabold text-slate-100 mt-0.5">{item.judul}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {formatTanggalRapat(item.tanggal)} · {formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)}
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/60">
          {item.status === 'Akan Datang' && (
            <>
              <button
                onClick={handleBukaSesi}
                disabled={startingMeeting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {startingMeeting ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                Buka Sesi
              </button>
              <button
                onClick={() => onAction('cancel')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer"
              >
                <XCircle size={12} /> Batalkan
              </button>
            </>
          )}

          {item.status === 'Berlangsung' && (
            <>
              <button
                onClick={() => onAction('close')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                <FileCheck2 size={12} /> Tutup Rapat
              </button>
              <button
                onClick={() => onAction('cancel')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer"
              >
                <XCircle size={12} /> Batalkan
              </button>
            </>
          )}

          {item.status === 'Selesai' && canReopen && (
            <button
              onClick={() => onAction('reopen')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer"
            >
              <RotateCcw size={12} /> Reopen (max 7 hari)
            </button>
          )}

          {/* ✅ CETAK NOTULENSI — muncul kalau notulensi Final */}
          {canPrint && (
            <button
              onClick={() => onCetak(item)}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isPrinting ? (
                <><Loader2 size={12} className="animate-spin" /> Cetak...</>
              ) : (
                <><Printer size={12} /> Cetak Notulensi</>
              )}
            </button>
          )}

          {item.close_note && (
            <div className="flex-1 min-w-[200px] text-[10px] text-slate-400 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <Lock size={10} className="shrink-0" />
              <span className="truncate">{item.close_note}</span>
            </div>
          )}
        </div>
      </div>

      {/* INFO GRID */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <DetailBox label="Pemimpin" value={item.pemimpin_nama ?? '-'} />
        <DetailBox label="Notulis" value={item.notulis_nama ?? '-'} />
        <DetailBox label="Lokasi" value={item.lokasi ?? '-'} />
        <DetailBox label="Penyelenggara" value={item.penyelenggara ?? '-'} />
      </div>

      {item.deskripsi && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi</p>
          <p className="text-xs text-slate-200 whitespace-pre-wrap">{item.deskripsi}</p>
        </div>
      )}

      {/* STAT KEHADIRAN */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Statistik Kehadiran
          </h4>
          <span className={`text-base font-extrabold ${
            stats.persen >= 75 ? 'text-emerald-400' :
            stats.persen >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {stats.persen}%
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-3 text-center">
          <MiniStat label="Hadir" value={stats.hadir} color="emerald" />
          <MiniStat label="Terlambat" value={stats.terlambat} color="amber" />
          <MiniStat label="Izin" value={stats.izin} color="blue" />
          <MiniStat label="Tidak" value={stats.tidakHadir} color="rose" />
          <MiniStat label="Belum" value={stats.belum} color="slate" />
        </div>

        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex">
          {stats.total > 0 && (
            <>
              <div className="h-full bg-emerald-500" style={{ width: `${(stats.hadir / stats.total) * 100}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${(stats.terlambat / stats.total) * 100}%` }} />
              <div className="h-full bg-blue-500" style={{ width: `${(stats.izin / stats.total) * 100}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${(stats.tidakHadir / stats.total) * 100}%` }} />
            </>
          )}
        </div>
      </div>

      {/* DAFTAR PESERTA */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Peserta ({peserta.length})
          </h4>
          <span className="text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
            Manager Override
          </span>
        </div>

        {loading ? (
          <Loader2 className="animate-spin text-indigo-400 mx-auto" size={18} />
        ) : peserta.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-4">Belum ada peserta</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {peserta.map((p) => {
              const isUpdating = updatingId === p.id;
              return (
                <div key={p.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/60 rounded-xl p-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold shrink-0">
                    {(p.guru?.nama_lengkap ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {p.guru?.nama_lengkap ?? '-'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {p.jabatan_dalam_rapat}
                      {p.guru?.jenis_ptk ? ` · ${p.guru.jenis_ptk}` : ''}
                    </p>
                  </div>
                  <select
                    value={p.status_kehadiran}
                    onChange={(e) => handleUpdateKehadiran(p.id, e.target.value as StatusKehadiranRapat)}
                    disabled={isUpdating}
                    className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shrink-0 ${getKehadiranBadge(p.status_kehadiran)} bg-slate-950`}
                  >
                    {KEHADIRAN_RAPAT_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color }: {
  label: string; value: number; color: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate';
}) {
  const cm: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    rose: 'text-rose-400',
    slate: 'text-slate-400',
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2">
      <p className={`text-base font-extrabold ${cm[color]}`}>{value}</p>
      <p className="text-[9px] font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}

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