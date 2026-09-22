// src/components/kedisiplinan/RekapPoinTab.tsx
// Tab Rekap Poin — akumulasi pelanggaran & prestasi per siswa (dengan netting).

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, X, ClipboardList, AlertTriangle, Trophy,
  User, TrendingUp, TrendingDown, ShieldAlert, Award,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import {
  getRekomendasiSP, getLevelSPBadge, getPoinBersihColor,
  isKedisiplinanManager, INPUT_CLASS,
} from './shared';
import { useAuth } from '@/context/AuthContext';
import type {
  RekapPoinSiswa, LevelSP, Kelas, Siswa,
} from '@/types/database';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

// =============================================================================
// KOMPONEN
// =============================================================================

export function RekapPoinTab() {
  const { guru } = useAuth();
  const isManager = isKedisiplinanManager(guru?.role);

  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [pelanggaranRaw, setPelanggaranRaw] = useState<{ siswa_id: number; poin: number }[]>([]);
  const [prestasiRaw, setPrestasiRaw] = useState<{ siswa_id: number; poin: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [filterSP, setFilterSP] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState<'poin_bersih' | 'pelanggaran' | 'prestasi' | 'nama'>('poin_bersih');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [siswaRes, kelasRes, pelanggaranRes, prestasiRes] = await Promise.all([
        supabase.from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF').order('nama_lengkap'),
        supabase.from('kelas').select('*').order('nama_kelas'),
        supabase.from('kesiswaan_pelanggaran').select('siswa_id, poin'),
        supabase.from('kesiswaan_prestasi').select('siswa_id, poin'),
      ]);

      if (siswaRes.error) throw siswaRes.error;

      setSiswaList((siswaRes.data as unknown as SiswaWithKelas[]) || []);
      setKelasList((kelasRes.data as Kelas[]) || []);
      setPelanggaranRaw(pelanggaranRes.data ?? []);
      setPrestasiRaw(prestasiRes.data ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat rekap: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // AGGREGATE REKAP
  // ==========================================================================
  const rekapList: RekapPoinSiswa[] = useMemo(() => {
    const pelanggaranMap = new Map<number, { total: number; count: number }>();
    const prestasiMap = new Map<number, { total: number; count: number }>();

    pelanggaranRaw.forEach((p) => {
      const cur = pelanggaranMap.get(p.siswa_id) ?? { total: 0, count: 0 };
      pelanggaranMap.set(p.siswa_id, { total: cur.total + p.poin, count: cur.count + 1 });
    });

    prestasiRaw.forEach((p) => {
      const cur = prestasiMap.get(p.siswa_id) ?? { total: 0, count: 0 };
      prestasiMap.set(p.siswa_id, { total: cur.total + p.poin, count: cur.count + 1 });
    });

    return siswaList.map((s) => {
      const pel = pelanggaranMap.get(s.id) ?? { total: 0, count: 0 };
      const pres = prestasiMap.get(s.id) ?? { total: 0, count: 0 };
      const poinBersih = pel.total - pres.total;

      return {
        siswa_id: s.id,
        nisn: s.nisn,
        nama_lengkap: s.nama_lengkap,
        kelas: s.kelas?.nama_kelas ?? '-',
        total_poin_pelanggaran: pel.total,
        total_poin_prestasi: pres.total,
        poin_bersih: poinBersih,
        jumlah_pelanggaran: pel.count,
        jumlah_prestasi: pres.count,
        rekomendasi_sp: getRekomendasiSP(poinBersih),
      };
    });
  }, [siswaList, pelanggaranRaw, prestasiRaw]);

  // ==========================================================================
  // FILTERED + SORTED
  // ==========================================================================
  const filtered = useMemo(() => {
    let result = rekapList.filter((r) => {
      if (filterKelas) {
        const siswa = siswaList.find((s) => s.id === r.siswa_id);
        if (String(siswa?.kelas_id ?? '') !== filterKelas) return false;
      }
      if (filterSP) {
        if (filterSP === 'none' && r.rekomendasi_sp !== null) return false;
        if (filterSP !== 'none' && r.rekomendasi_sp !== filterSP) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !r.nama_lengkap.toLowerCase().includes(q) &&
          !r.nisn.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'nama':
          cmp = a.nama_lengkap.localeCompare(b.nama_lengkap);
          break;
        case 'pelanggaran':
          cmp = a.total_poin_pelanggaran - b.total_poin_pelanggaran;
          break;
        case 'prestasi':
          cmp = a.total_poin_prestasi - b.total_poin_prestasi;
          break;
        case 'poin_bersih':
        default:
          cmp = a.poin_bersih - b.poin_bersih;
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [rekapList, siswaList, filterKelas, filterSP, search, sortBy, sortOrder]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const totalSiswa = filtered.length;
    const siswaDenganPelanggaran = filtered.filter((r) => r.total_poin_pelanggaran > 0).length;
    const siswaBersih = filtered.filter((r) => r.poin_bersih <= 0).length;
    const perluSP = filtered.filter((r) => r.rekomendasi_sp !== null).length;
    const totalPoinBersih = filtered.reduce((s, r) => s + Math.max(0, r.poin_bersih), 0);
    return { totalSiswa, siswaDenganPelanggaran, siswaBersih, perluSP, totalPoinBersih };
  }, [filtered]);

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'NISN', 'Nama Siswa', 'Kelas',
    'Poin Pelanggaran', 'Jumlah Pelanggaran',
    'Poin Prestasi', 'Jumlah Prestasi',
    'Poin Bersih', 'Rekomendasi SP',
  ];
  const exportRows = filtered.map((r) => [
    r.nisn, r.nama_lengkap, r.kelas,
    r.total_poin_pelanggaran, r.jumlah_pelanggaran,
    r.total_poin_prestasi, r.jumlah_prestasi,
    r.poin_bersih, r.rekomendasi_sp ?? '-',
  ]);

  const resetFilter = () => {
    setSearch(''); setFilterKelas(''); setFilterSP('');
  };
  const hasFilter = search || filterKelas || filterSP;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-indigo-400" size={20} /> Rekap Poin Siswa
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Akumulasi poin pelanggaran & prestasi · {filtered.length} dari {rekapList.length} siswa
          </p>
        </div>
      </div>

      {/* INFO NETTING */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
        <TrendingDown size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-indigo-300/90 leading-relaxed">
          <p className="font-bold mb-0.5">Sistem Poin Bersih</p>
          <p className="text-indigo-400/70">
            <strong>Poin Bersih = Poin Pelanggaran − Poin Prestasi</strong>. Prestasi siswa
            dapat "menebus" pelanggaran yang sudah dilakukan. Threshold SP: SP1 = 25 · SP2 = 50 · SP3 = 75.
          </p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={User} label="Total Siswa" value={stats.totalSiswa} color="indigo" />
        <KpiCard icon={AlertTriangle} label="Pernah Melanggar" value={stats.siswaDenganPelanggaran} color="rose" />
        <KpiCard icon={Trophy} label="Bersih/Prestasi" value={stats.siswaBersih} color="emerald" />
        <KpiCard icon={ShieldAlert} label="Perlu SP" value={stats.perluSP} color="amber" pulse={stats.perluSP > 0} />
        <KpiCard icon={TrendingUp} label="Total Poin Aktif" value={stats.totalPoinBersih} color="orange" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter & Sorting
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / NISN..." className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={String(k.id)}>{k.nama_kelas}</option>
            ))}
          </select>
          <select value={filterSP} onChange={(e) => setFilterSP(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Siswa</option>
            <option value="none">Aman (tanpa SP)</option>
            <option value="SP1">Rekomendasi SP1</option>
            <option value="SP2">Rekomendasi SP2</option>
            <option value="SP3">Rekomendasi SP3</option>
          </select>
          <div className="flex gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              className={INPUT_CLASS + ' cursor-pointer text-xs flex-1'}>
              <option value="poin_bersih">Sort: Poin Bersih</option>
              <option value="pelanggaran">Sort: Pelanggaran</option>
              <option value="prestasi">Sort: Prestasi</option>
              <option value="nama">Sort: Nama</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition cursor-pointer"
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}>
              {sortOrder === 'desc' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <ExportImportButtons filename={`rekap_poin_siswa_${new Date().toISOString().slice(0, 10)}`}
            title="Rekap Poin Siswa" headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat rekap poin...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <ClipboardList size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada siswa cocok' : 'Belum ada data siswa'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Pastikan data siswa sudah terdaftar.'}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARD */}
          <div className="block md:hidden space-y-3">
            {filtered.map((r) => (
              <div key={r.siswa_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate">{r.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-500">
                      {r.kelas} · NISN: {r.nisn}
                    </p>
                  </div>
                  {r.rekomendasi_sp && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getLevelSPBadge(r.rekomendasi_sp)}`}>
                      {r.rekomendasi_sp}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2 text-center">
                    <p className="text-rose-400 font-bold uppercase">Pelanggaran</p>
                    <p className="text-base font-extrabold text-rose-400">{r.total_poin_pelanggaran}</p>
                    <p className="text-slate-500">{r.jumlah_pelanggaran}x</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-center">
                    <p className="text-emerald-400 font-bold uppercase">Prestasi</p>
                    <p className="text-base font-extrabold text-emerald-400">{r.total_poin_prestasi}</p>
                    <p className="text-slate-500">{r.jumlah_prestasi}x</p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-center">
                    <p className="text-amber-400 font-bold uppercase">Bersih</p>
                    <p className={`text-base font-extrabold ${getPoinBersihColor(r.poin_bersih)}`}>
                      {r.poin_bersih}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Siswa</th>
                    <th className="text-left px-4 py-3">Kelas</th>
                    <th className="text-center px-4 py-3 text-rose-400">Pelanggaran</th>
                    <th className="text-center px-4 py-3 text-emerald-400">Prestasi</th>
                    <th className="text-center px-4 py-3 text-amber-400">Poin Bersih</th>
                    <th className="text-center px-4 py-3">Rekomendasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((r) => (
                    <tr key={r.siswa_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            r.poin_bersih >= 25
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : r.poin_bersih > 0
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          }`}>
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[180px]">
                              {r.nama_lengkap}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500">
                              NISN: {r.nisn}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{r.kelas}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-base font-extrabold text-rose-400">
                            {r.total_poin_pelanggaran}
                          </span>
                          <span className="text-[9px] text-slate-500">{r.jumlah_pelanggaran}x</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-base font-extrabold text-emerald-400">
                            {r.total_poin_prestasi}
                          </span>
                          <span className="text-[9px] text-slate-500">{r.jumlah_prestasi}x</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-extrabold ${getPoinBersihColor(r.poin_bersih)}`}>
                          {r.poin_bersih}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.rekomendasi_sp ? (
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getLevelSPBadge(r.rekomendasi_sp)}`}>
                            {r.rekomendasi_sp}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 inline-block">
                            ✓ Aman
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'orange';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
};

function KpiCard({ icon: Icon, label, value, color, pulse = false }: {
  icon: typeof User; label: string; value: number; color: KpiColor; pulse?: boolean;
}) {
  const c = CM[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 ${pulse ? 'ring-1 ring-current ' + c.text : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}