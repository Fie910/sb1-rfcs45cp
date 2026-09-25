// src/components/rapat/JadwalRapatTab.tsx
// Tab Jadwal Rapat — kalender & list rapat untuk semua user.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Calendar, Clock, MapPin, Users, Filter, X,
  Eye, CheckCircle2, AlertCircle, CalendarCheck, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import {
  getStatusRapatBadge, getJenisRapatBadge, getKehadiranBadge,
  formatTanggalRapat, formatTanggalPendek, formatWaktuRapat,
  isToday, isPast, daysFromNow,
  INPUT_CLASS, LABEL_CLASS,
  JENIS_RAPAT_OPTIONS, STATUS_RAPAT_OPTIONS,
} from './shared';
import type {
  RapatWithRelations, RapatPesertaWithGuru, StatusRapat,
} from '@/types/database';

export function JadwalRapatTab() {
  const { guru } = useAuth();
  const [list, setList] = useState<RapatWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTimeframe, setFilterTimeframe] = useState<'semua' | 'akan_datang' | 'bulan_ini' | 'selesai'>('akan_datang');

  // Modal
  const [detailTarget, setDetailTarget] = useState<RapatWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      // Rapat yang: public, atau saya terlibat (peserta/pemimpin/notulis/creator)
      const { data: rapatIds } = await supabase
        .from('rapat_peserta')
        .select('rapat_id')
        .eq('guru_id', guru.id);

      const idsFromPeserta = (rapatIds ?? []).map((r: any) => r.rapat_id);

      // Build query filter
      let query = supabase
        .from('v_rapat_lengkap')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('waktu_mulai', { ascending: false });

      // Filter visibility: public OR saya terlibat
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

      // Timeframe
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

        {/* Timeframe chips */}
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

        {/* Search + selects */}
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
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba ubah filter' : 'Rapat akan muncul di sini'}
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
        {/* Date box */}
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
              <Users size={10} /> {item.total_peserta ?? 0} peserta
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
              <Eye size={11} /> Lihat Detail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: Detail Content
// =============================================================================
function DetailRapatContent({
  item, currentGuruId, onRefresh,
}: {
  item: RapatWithRelations;
  currentGuruId: string | undefined;
  onRefresh: () => void;
}) {
  const [pesertaList, setPesertaList] = useState<RapatPesertaWithGuru[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isPemimpin = item.pemimpin_rapat_id === currentGuruId;
  const isNotulis = item.notulis_id === currentGuruId;
  const canManage = isPemimpin || isNotulis;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('rapat_peserta')
        .select(`
          *,
          guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)
        `)
        .eq('rapat_id', item.id)
        .order('jabatan_dalam_rapat');
      setPesertaList((data as RapatPesertaWithGuru[]) ?? []);
      setLoading(false);
    })();
  }, [item.id]);

  const handleUpdateKehadiran = async (pesertaId: string, status: string) => {
    setUpdatingId(pesertaId);
    try {
      const { error } = await supabase
        .from('rapat_peserta')
        .update({ status_kehadiran: status })
        .eq('id', pesertaId);
      if (error) throw error;
      showToast('success', 'Kehadiran diperbarui');
      const { data } = await supabase
        .from('rapat_peserta')
        .select(`
          *,
          guru:gurus!guru_id(id, nama_lengkap, nip, jenis_ptk)
        `)
        .eq('rapat_id', item.id)
        .order('jabatan_dalam_rapat');
      setPesertaList((data as RapatPesertaWithGuru[]) ?? []);
      onRefresh();
    } catch (err: any) {
      showToast('error', 'Gagal update: ' + (err.message || 'Error'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
      {/* HEADER */}
      <div className={`bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border rounded-2xl p-5 ${getStatusRapatBadge(item.status).replace('text-', 'border-').replace('bg-', 'bg-')}`}>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisRapatBadge(item.jenis)}`}>
                {item.jenis}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusRapatBadge(item.status)}`}>
                {item.status}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-100">{item.judul}</h3>
            <p className="text-[11px] font-mono text-indigo-400 mt-0.5">
              {item.nomor_rapat ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* INFO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <InfoBox icon={Calendar} label="Tanggal" value={formatTanggalRapat(item.tanggal)} />
        <InfoBox icon={Clock} label="Waktu" value={formatWaktuRapat(item.waktu_mulai, item.waktu_selesai)} />
        <InfoBox icon={MapPin} label="Lokasi" value={item.lokasi ?? '-'} />
        <InfoBox icon={Users} label="Penyelenggara" value={item.penyelenggara ?? '-'} />
        <InfoBox icon={Users} label="Pemimpin" value={item.pemimpin_nama ?? '-'} />
        <InfoBox icon={Users} label="Notulis" value={item.notulis_nama ?? '-'} />
      </div>

      {item.deskripsi && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Deskripsi</p>
          <p className="text-xs text-slate-200 whitespace-pre-wrap">{item.deskripsi}</p>
        </div>
      )}

      {/* PESERTA */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Peserta ({pesertaList.length})
          </h4>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-emerald-400 font-bold">
              ✓ {pesertaList.filter((p) => p.status_kehadiran === 'Hadir').length} hadir
            </span>
          </div>
        </div>

        {loading ? (
          <Loader2 className="animate-spin text-indigo-400 mx-auto" size={20} />
        ) : pesertaList.length === 0 ? (
          <p className="text-[11px] text-slate-500 text-center py-4">Belum ada peserta</p>
        ) : (
          <div className="space-y-2">
            {pesertaList.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/60 rounded-xl p-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                  {(p.guru?.nama_lengkap ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">
                    {p.guru?.nama_lengkap ?? '-'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {p.jabatan_dalam_rapat} {p.guru?.jenis_ptk ? `· ${p.guru.jenis_ptk}` : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${getKehadiranBadge(p.status_kehadiran)}`}>
                  {p.status_kehadiran}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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