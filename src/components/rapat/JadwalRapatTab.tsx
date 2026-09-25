// src/components/rapat/JadwalRapatTab.tsx
// Tab Jadwal Rapat — kalender & list rapat + self check-in + notulis override.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Calendar, Clock, MapPin, Users, Filter, X,
  Eye, CheckCircle2, AlertCircle, CalendarCheck, PlayCircle,
  UserCheck, UserX, Clock3, FileText, User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  getStatusRapatBadge, getJenisRapatBadge, getKehadiranBadge,
  formatTanggalRapat, formatTanggalPendek, formatWaktuRapat,
  isToday, isPast, daysFromNow,
  INPUT_CLASS,
  JENIS_RAPAT_OPTIONS, STATUS_RAPAT_OPTIONS,
  KEHADIRAN_RAPAT_OPTIONS,
} from './shared';
import type {
  RapatWithRelations, RapatPesertaWithGuru,
  StatusKehadiranRapat, StatusRapat,
} from '@/types/database';

export function JadwalRapatTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<RapatWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTimeframe, setFilterTimeframe] = useState<'semua' | 'akan_datang' | 'bulan_ini' | 'selesai'>('akan_datang');

  const [detailTarget, setDetailTarget] = useState<RapatWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const { data: rapatIds } = await supabase
        .from('rapat_peserta')
        .select('rapat_id')
        .eq('guru_id', guru.id);

      const idsFromPeserta = (rapatIds ?? []).map((r: any) => r.rapat_id);

      let query = supabase
        .from('v_rapat_lengkap')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('waktu_mulai', { ascending: false });

      const orConditions = [
        'is_public.eq.true',
        `created_by.eq.${guru.id}`,
        `pemimpin_rapat_id.eq.${guru.id}`,
        `notulis_id.eq.${guru.id}`,
      ];
      if (idsFromPeserta.length > 0) {
        orConditions.push(`id.in.(${idsFromPeserta.join(',')})`);
      }
      query = query.or(orConditions.join(','));

      const { data, error } = await query;
      if (error) throw error;

      setList((data as RapatWithRelations[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat rapat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (filterJenis && r.jenis !== filterJenis) return false;
      if (filterStatus && r.status !== filterStatus) return false;

      if (filterTimeframe === 'akan_datang') {
        if (r.status !== 'Akan Datang' && r.status !== 'Berlangsung') return false;
        if (daysFromNow(r.tanggal) < 0 && r.status !== 'Berlangsung') return false;
      } else if (filterTimeframe === 'bulan_ini') {
        const now = new Date();
        const d = new Date(`${r.tanggal}T00:00:00+07:00`);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (filterTimeframe === 'selesai') {
        if (r.status !== 'Selesai' && r.status !== 'Dibatalkan') return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          r.judul.toLowerCase().includes(q) ||
          (r.nomor_rapat ?? '').toLowerCase().includes(q) ||
          (r.lokasi ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, filterStatus, filterTimeframe, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const akanDatang = list.filter((r) => r.status === 'Akan Datang').length;
    const selesai = list.filter((r) => r.status === 'Selesai').length;
    const berlangsung = list.filter((r) => r.status === 'Berlangsung').length;
    return { total, akanDatang, selesai, berlangsung };
  }, [list]);

  const resetFilter = () => {
    setSearch(''); setFilterJenis(''); setFilterStatus(''); setFilterTimeframe('akan_datang');
  };
  const hasFilter = search || filterJenis || filterStatus || filterTimeframe !== 'akan_datang';

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
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Calendar} label="Total Rapat" value={stats.total} color="indigo" />
        <KpiCard icon={CalendarCheck} label="Akan Datang" value={stats.akanDatang} color="blue" />
        <KpiCard icon={AlertCircle} label="Berlangsung" value={stats.berlangsung} color="amber" />
        <KpiCard icon={CheckCircle2} label="Selesai" value={stats.selesai} color="emerald" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'akan_datang' as const, label: 'Akan Datang' },
            { key: 'bulan_ini' as const, label: 'Bulan Ini' },
            { key: 'selesai' as const, label: 'Selesai' },
            { key: 'semua' as const, label: 'Semua' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilterTimeframe(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                filterTimeframe === t.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, nomor, lokasi..."
            className={INPUT_CLASS}
          />
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Jenis</option>
            {JENIS_RAPAT_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Status</option>
            {STATUS_RAPAT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Calendar size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada rapat cocok' : 'Belum ada rapat'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <RapatCard
              key={item.id}
              item={item}
              currentGuruId={guru?.id}
              onDetail={() => setDetailTarget(item)}
            />
          ))}
        </div>
      )}

      {/* MODAL DETAIL */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Rapat"
        size="lg"
      >
        {detailTarget && (
          <DetailRapatContent
            item={detailTarget}
            currentGuruId={guru?.id}
            currentGuruRole={guru?.role}
            onRefresh={fetchAll}
          />
        )}
      </Modal>
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function RapatCard({
  item, currentGuruId, onDetail,
}: {
  item: RapatWithRelations;
  currentGuruId: string | undefined;
  onDetail: () => void;
}) {
  const isPemimpin = item.pemimpin_rapat_id === currentGuruId;
  const isNotulis = item.notulis_id === currentGuruId;
  const today = isToday(item.tanggal);
  const past = isPast(item.tanggal);

  return (
    <div
      className={`bg-slate-900 rounded-2xl border p-4 hover:border-slate-700 transition ${
        today ? 'border-indigo-500/40 bg-indigo-950/20' : 'border-slate-800'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-14 shrink-0 rounded-xl border text-center py-2 ${
          today
            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            : past
            ? 'bg-slate-950 border-slate-800 text-slate-500'
            : 'bg-slate-950 border-slate-800 text-slate-300'
        }`}>
          <p className="text-[9px] font-bold uppercase">
            {new Date(item.tanggal + 'T00:00:00+07:00').toLocaleDateString('id-ID', { month: 'short' })}
          </p>
          <p className="text-xl font-extrabold leading-tight">
            {new Date(item.tanggal + 'T00:00:00+07:00').getDate()}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisRapatBadge(item.jenis)}`}>
                  {item.jenis}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusRapatBadge(item.status)}`}>
                  {item.status}
                </span>
                {isPemimpin && (
                  <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    Pemimpin
                  </span>
                )}
                {isNotulis && (
                  <span className="text-[9px] font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                    Notulis
                  </span>
                )}
                {today && (
                  <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                    HARI INI
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-100 mt-1 truncate">
                {item.judul}
              </p>
              <p className="text-[10px] font-mono text-indigo-400">
                {item.nomor_rapat ?? '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock size={10} /> {formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)}
            </span>
            {item.lokasi && (
              <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                <MapPin size={10} /> {item.lokasi}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users size={10} /> {item.total_hadir ?? 0}/{item.total_peserta ?? 0} hadir
            </span>
            {item.has_notulensi && (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={10} /> Notulensi {item.notulensi_status === 'Final' ? 'Final' : 'Draft'}
              </span>
            )}
          </div>

          <div className="flex justify-end mt-3 pt-3 border-t border-slate-800">
            <button
              onClick={onDetail}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer"
            >
              <Eye size={11} /> Lihat Detail & Kehadiran
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Detail Content (dengan attendance system)
// =============================================================================
function DetailRapatContent({
  item, currentGuruId, currentGuruRole, onRefresh,
}: {
  item: RapatWithRelations;
  currentGuruId: string | undefined;
  currentGuruRole: string | undefined;
  onRefresh: () => void;
}) {
  const [pesertaList, setPesertaList] = useState<RapatPesertaWithGuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [startingMeeting, setStartingMeeting] = useState(false);

  const isPemimpin = item.pemimpin_rapat_id === currentGuruId;
  const isNotulis = item.notulis_id === currentGuruId;
  const canManage = isPemimpin || isNotulis;

  // Cek apakah user ini peserta (dan dapat barisnya)
  const myPesertaRow = pesertaList.find((p) => p.guru_id === currentGuruId);
  const isPeserta = Boolean(myPesertaRow);
  const isMeetingStarted = item.status === 'Berlangsung' || item.status === 'Selesai';
  const canSelfCheckin = isPeserta && item.status !== 'Dibatalkan' && item.status !== 'Draft';

  // ==========================================================================
  // FETCH PESERTA
  // ==========================================================================
  const fetchPeserta = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('rapat_peserta')
        .select(`
          *,
          guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)
        `)
        .eq('rapat_id', item.id)
        .order('jabatan_dalam_rapat', { ascending: true });
      setPesertaList((data as RapatPesertaWithGuru[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => { fetchPeserta(); }, [fetchPeserta]);

  // ==========================================================================
  // SELF CHECK-IN
  // ==========================================================================
  const handleSelfCheckin = async (status: StatusKehadiranRapat) => {
    if (!myPesertaRow) return;
    setUpdatingId(myPesertaRow.id);
    try {
      const { error } = await supabase
        .from('rapat_peserta')
        .update({
          status_kehadiran: status,
          catatan: `Self check-in: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`,
        })
        .eq('id', myPesertaRow.id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.TODO,
        targetId: myPesertaRow.id,
        deskripsi: `Self check-in rapat "${item.judul}": ${status}`,
      });

      showToast('success', `Konfirmasi tersimpan: ${status}`);
      fetchPeserta();
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================================================
  // NOTULIS / PEMIMPIN — OVERRIDE KEHADIRAN
  // ==========================================================================
  const handleUpdateKehadiran = async (pesertaId: string, status: StatusKehadiranRapat) => {
    setUpdatingId(pesertaId);
    try {
      const { error } = await supabase
        .from('rapat_peserta')
        .update({ status_kehadiran: status })
        .eq('id', pesertaId);
      if (error) throw error;

      showToast('success', `Kehadiran diperbarui: ${status}`);
      fetchPeserta();
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal update: ' + (err.message || 'Error'));
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================================================================
  // BUKA SESI RAPAT (notulis/pemimpin)
  // ==========================================================================
  const handleBukaSesi = async () => {
    if (!canManage) return;
    setStartingMeeting(true);
    try {
      const { error } = await supabase
        .from('rapat')
        .update({ status: 'Berlangsung' })
        .eq('id', item.id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.TODO,
        targetId: item.id,
        deskripsi: `Buka sesi rapat: ${item.judul}`,
      });

      showToast('success', 'Sesi rapat dibuka! Peserta bisa check-in.');
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setStartingMeeting(false);
    }
  };

  // ==========================================================================
  // STATS
  // ==========================================================================
  const attendanceStats = useMemo(() => {
    const total = pesertaList.length;
    const hadir = pesertaList.filter((p) => p.status_kehadiran === 'Hadir').length;
    const terlambat = pesertaList.filter((p) => p.status_kehadiran === 'Terlambat').length;
    const izin = pesertaList.filter((p) => p.status_kehadiran === 'Izin').length;
    const tidakHadir = pesertaList.filter((p) => p.status_kehadiran === 'Tidak Hadir').length;
    const belum = pesertaList.filter((p) => p.status_kehadiran === 'Belum Dikonfirmasi').length;
    const persen = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;
    return { total, hadir, terlambat, izin, tidakHadir, belum, persen };
  }, [pesertaList]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
      {/* HEADER */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisRapatBadge(item.jenis)}`}>
                {item.jenis}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusRapatBadge(item.status)}`}>
                {item.status}
              </span>
              {isToday(item.tanggal) && (
                <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 animate-pulse">
                  HARI INI
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-slate-100">{item.judul}</h3>
            <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
              {item.nomor_rapat ?? '-'}
            </p>
          </div>

          {/* TOMBOL BUKA SESI (kalau belum dimulai & canManage) */}
          {canManage && item.status === 'Akan Datang' && (
            <button
              onClick={handleBukaSesi}
              disabled={startingMeeting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {startingMeeting ? (
                <><Loader2 size={13} className="animate-spin" /> Memulai...</>
              ) : (
                <><PlayCircle size={13} /> Buka Sesi Rapat</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          SELF CHECK-IN PANEL — muncul kalau user = peserta
          ============================================================ */}
      {canSelfCheckin && myPesertaRow && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck size={14} className="text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Konfirmasi Kehadiran Anda
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SelfCheckinButton
              status="Hadir"
              current={myPesertaRow.status_kehadiran}
              onClick={() => handleSelfCheckin('Hadir')}
              disabled={updatingId === myPesertaRow.id}
              icon={CheckCircle2}
              color="emerald"
            />
            <SelfCheckinButton
              status="Terlambat"
              current={myPesertaRow.status_kehadiran}
              onClick={() => handleSelfCheckin('Terlambat')}
              disabled={updatingId === myPesertaRow.id}
              icon={Clock3}
              color="amber"
            />
            <SelfCheckinButton
              status="Izin"
              current={myPesertaRow.status_kehadiran}
              onClick={() => handleSelfCheckin('Izin')}
              disabled={updatingId === myPesertaRow.id}
              icon={FileText}
              color="blue"
            />
            <SelfCheckinButton
              status="Tidak Hadir"
              current={myPesertaRow.status_kehadiran}
              onClick={() => handleSelfCheckin('Tidak Hadir')}
              disabled={updatingId === myPesertaRow.id}
              icon={UserX}
              color="rose"
            />
          </div>

          <p className="text-[10px] text-slate-500 mt-2.5 text-center">
            Status saat ini:{' '}
            <span className={`font-bold ${getKehadiranBadge(myPesertaRow.status_kehadiran).split(' ')[1]}`}>
              {myPesertaRow.status_kehadiran}
            </span>
            {' '}· Bisa diubah kapan saja selama rapat belum selesai
          </p>
        </div>
      )}

      {/* INFO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <InfoBox icon={Calendar} label="Tanggal" value={formatTanggalRapat(item.tanggal)} />
        <InfoBox icon={Clock} label="Waktu" value={formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)} />
        <InfoBox icon={MapPin} label="Lokasi" value={item.lokasi ?? '-'} />
        <InfoBox icon={Users} label="Penyelenggara" value={item.penyelenggara ?? '-'} />
        <InfoBox icon={User} label="Pemimpin" value={item.pemimpin_nama ?? '-'} />
        <InfoBox icon={FileText} label="Notulis" value={item.notulis_nama ?? '-'} />
      </div>

      {item.deskripsi && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi</p>
          <p className="text-xs text-slate-200 whitespace-pre-wrap">{item.deskripsi}</p>
        </div>
      )}

      {/* ============================================================
          STAT BAR KEHADIRAN
          ============================================================ */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Statistik Kehadiran
          </h4>
          <span className={`text-base font-extrabold ${
            attendanceStats.persen >= 75 ? 'text-emerald-400' :
            attendanceStats.persen >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {attendanceStats.persen}%
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-3 text-center">
          <MiniStat label="Hadir" value={attendanceStats.hadir} color="emerald" />
          <MiniStat label="Terlambat" value={attendanceStats.terlambat} color="amber" />
          <MiniStat label="Izin" value={attendanceStats.izin} color="blue" />
          <MiniStat label="Tidak" value={attendanceStats.tidakHadir} color="rose" />
          <MiniStat label="Belum" value={attendanceStats.belum} color="slate" />
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex">
          {attendanceStats.total > 0 && (
            <>
              <div className="h-full bg-emerald-500" style={{ width: `${(attendanceStats.hadir / attendanceStats.total) * 100}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${(attendanceStats.terlambat / attendanceStats.total) * 100}%` }} />
              <div className="h-full bg-blue-500" style={{ width: `${(attendanceStats.izin / attendanceStats.total) * 100}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${(attendanceStats.tidakHadir / attendanceStats.total) * 100}%` }} />
            </>
          )}
        </div>
      </div>

      {/* ============================================================
          DAFTAR PESERTA
          ============================================================ */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Peserta ({pesertaList.length})
          </h4>
          {canManage && (
            <span className="text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
              Anda bisa ubah kehadiran
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-4">
            <Loader2 size={16} className="animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : pesertaList.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-4">Belum ada peserta</p>
        ) : (
          <div className="space-y-2">
            {pesertaList.map((p) => {
              const isMe = p.guru_id === currentGuruId;
              const isUpdating = updatingId === p.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 border rounded-xl p-2.5 ${
                    isMe
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-slate-900/60 border-slate-800/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isMe
                      ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}>
                    {(p.guru?.nama_lengkap ?? '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-slate-200 truncate">
                        {p.guru?.nama_lengkap ?? '-'}
                      </p>
                      {isMe && (
                        <span className="text-[9px] font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {p.jabatan_dalam_rapat}
                      {p.guru?.jenis_ptk ? ` · ${p.guru.jenis_ptk}` : ''}
                    </p>
                  </div>

                  {/* NOTULIS/PEMIMPIN: dropdown | PESERTA BIASA: badge */}
                  {canManage && !isMe ? (
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
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${getKehadiranBadge(p.status_kehadiran)}`}>
                      {isUpdating ? '...' : p.status_kehadiran}
                    </span>
                  )}
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
// SUB: Self Check-in Button
// =============================================================================
function SelfCheckinButton({
  status, current, onClick, disabled, icon: Icon, color,
}: {
  status: StatusKehadiranRapat;
  current: StatusKehadiranRapat;
  onClick: () => void;
  disabled: boolean;
  icon: any;
  color: 'emerald' | 'amber' | 'blue' | 'rose';
}) {
  const isActive = current === status;
  const CM: Record<string, { active: string; inactive: string }> = {
    emerald: {
      active: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
      inactive: 'bg-slate-950 border-slate-800 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400',
    },
    amber: {
      active: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
      inactive: 'bg-slate-950 border-slate-800 text-slate-400 hover:border-amber-500/40 hover:text-amber-400',
    },
    blue: {
      active: 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20',
      inactive: 'bg-slate-950 border-slate-800 text-slate-400 hover:border-blue-500/40 hover:text-blue-400',
    },
    rose: {
      active: 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20',
      inactive: 'bg-slate-950 border-slate-800 text-slate-400 hover:border-rose-500/40 hover:text-rose-400',
    },
  };
  const c = CM[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 ${
        isActive ? c.active : c.inactive
      }`}
    >
      <Icon size={16} />
      <span>{status}</span>
      {isActive && <span className="text-[9px] opacity-80">✓ Tersimpan</span>}
    </button>
  );
}

// =============================================================================
// SUB
// =============================================================================
function InfoBox({ icon: Icon, label, value }: {
  icon: any; label: string; value: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-1">
        <Icon size={10} /> {label}
      </div>
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

type KpiColor = 'indigo' | 'blue' | 'amber' | 'emerald';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
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