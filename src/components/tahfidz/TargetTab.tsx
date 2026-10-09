// src/components/tahfidz/TargetTab.tsx
// Set & monitor target hafalan per siswa.
// ✅ Support target range surah+ayat + display.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Target, Search, Loader2, RefreshCw, Plus, Pencil, Trash2, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { INPUT_CLASS } from './shared';
import { getHalamanSetoran, formatHalaman } from '@/lib/tahfidz/hitungHalaman';
import { ModalTarget } from './ModalTarget';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzTarget,
  TahfidzSetoranWithRelations,
} from '@/types/database';

type Props = {
  surahList: TahfidzSurah[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  isManager: boolean;
};

type SiswaOption = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas_nama: string;
};

type TargetRow = {
  siswa: SiswaOption;
  target: TahfidzTarget | null;
  realisasi_halaman: number;
  realisasi_ayat: number;
  persen: number;
};

export function TargetTab({ surahMap, halamanMap }: Props) {
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [targets, setTargets] = useState<TahfidzTarget[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaOption[]>([]);
  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState<number | ''>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    target: TahfidzTarget | null;
    siswa: SiswaOption;
  } | null>(null);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [targetRes, siswaRes, setoranRes, tahunRes] = await Promise.all([
        supabase.from('tahfidz_target').select('*'),
        supabase
          .from('siswas')
          .select('id, nisn, nama_lengkap, kelas_id, kelas:kelas_id (nama_kelas)')
          .eq('status', 'AKTIF')
          .order('nama_lengkap'),
        supabase
          .from('tahfidz_setoran')
          .select('id, siswa_id, tanggal, jenis, surah_mulai, ayat_mulai, surah_selesai, ayat_selesai'),
        supabase.from('tahun_ajarans').select('*').eq('is_aktif', true).maybeSingle(),
      ]);

      setTargets((targetRes.data as TahfidzTarget[]) ?? []);
      setSiswaList(
        (siswaRes.data ?? []).map((s: any) => ({
          id: s.id,
          nisn: s.nisn,
          nama_lengkap: s.nama_lengkap,
          kelas_id: s.kelas_id,
          kelas_nama: s.kelas?.nama_kelas ?? '-',
        }))
      );
      setSetoranList((setoranRes.data as any) ?? []);
      setTahunAjaranAktif(tahunRes.data);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // ===========================================================================
  // ROWS
  // ===========================================================================
  const rows = useMemo<TargetRow[]>(() => {
    const targetMap = new Map<number, TahfidzTarget>();
    targets.forEach((t) => {
      if (tahunAjaranAktif && t.tahun_ajaran_id !== tahunAjaranAktif.id) return;
      targetMap.set(t.siswa_id, t);
    });

    const realisasiHalaman = new Map<number, number>();
    const realisasiAyat = new Map<number, number>();

    setoranList.forEach((s) => {
      const halaman = getHalamanSetoran(s, surahMap, halamanMap);
      realisasiHalaman.set(
        s.siswa_id,
        (realisasiHalaman.get(s.siswa_id) ?? 0) + halaman
      );

      let ayat = 0;
      if (s.surah_mulai === s.surah_selesai) {
        ayat = s.ayat_selesai - s.ayat_mulai + 1;
      } else {
        const surahAwal = surahMap.get(s.surah_mulai);
        const surahAkhir = surahMap.get(s.surah_selesai);
        if (surahAwal) ayat += surahAwal.jumlah_ayat - s.ayat_mulai + 1;
        for (let n = s.surah_mulai + 1; n < s.surah_selesai; n++) {
          const surah = surahMap.get(n);
          if (surah) ayat += surah.jumlah_ayat;
        }
        ayat += s.ayat_selesai;
      }
      realisasiAyat.set(s.siswa_id, (realisasiAyat.get(s.siswa_id) ?? 0) + ayat);
    });

    return siswaList.map((siswa) => {
      const target = targetMap.get(siswa.id) ?? null;
      const halaman = realisasiHalaman.get(siswa.id) ?? 0;
      const ayat = realisasiAyat.get(siswa.id) ?? 0;

      let persen = 0;
      if (target?.target_halaman && target.target_halaman > 0) {
        persen = Math.min(100, (halaman / target.target_halaman) * 100);
      }

      return {
        siswa,
        target,
        realisasi_halaman: halaman,
        realisasi_ayat: ayat,
        persen,
      };
    });
  }, [targets, siswaList, setoranList, surahMap, halamanMap, tahunAjaranAktif]);

  // ===========================================================================
  // FILTERED
  // ===========================================================================
  const filtered = useMemo(() => {
    let result = rows;
    if (filterKelas !== '') {
      result = result.filter((r) => r.siswa.kelas_id === filterKelas);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.siswa.nama_lengkap.toLowerCase().includes(q) ||
          r.siswa.nisn.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      const aHas = a.target ? 1 : 0;
      const bHas = b.target ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return a.persen - b.persen;
    });
  }, [rows, filterKelas, search]);

  const kelasList = useMemo(() => {
    const map = new Map<number, string>();
    siswaList.forEach((s) => {
      if (s.kelas_id && !map.has(s.kelas_id)) {
        map.set(s.kelas_id, s.kelas_nama);
      }
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [siswaList]);

  // ===========================================================================
  // STATS
  // ===========================================================================
  const stats = useMemo(() => {
    const adaTarget = rows.filter((r) => r.target).length;
    const totalHalamanTarget = rows.reduce(
      (sum, r) => sum + (r.target?.target_halaman ?? 0),
      0
    );
    const totalHalamanRealisasi = rows.reduce(
      (sum, r) => sum + r.realisasi_halaman,
      0
    );
    const rataPersen =
      adaTarget > 0
        ? rows.filter((r) => r.target).reduce((s, r) => s + r.persen, 0) / adaTarget
        : 0;
    return { adaTarget, totalHalamanTarget, totalHalamanRealisasi, rataPersen };
  }, [rows]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const handleOpenModal = (siswa: SiswaOption, target: TahfidzTarget | null) => {
    setEditTarget({ target, siswa });
    setModalOpen(true);
  };

  const handleDelete = async (row: TargetRow) => {
    if (!row.target) return;
    const ok = await confirm({
      title: 'Hapus Target',
      message: `Yakin hapus target ${row.siswa.nama_lengkap}?`,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('tahfidz_target')
        .delete()
        .eq('id', row.target.id);
      if (error) throw error;
      showToast('success', 'Target dihapus');
      fetchAll(true);
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat target...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-emerald-400" />
          <h2 className="text-base font-extrabold text-slate-100">Target Hafalan</h2>
          {tahunAjaranAktif && (
            <span className="text-xs text-slate-500">
              T.A. {tahunAjaranAktif.tahun} · {tahunAjaranAktif.semester}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="Siswa Punya Target"
          value={`${stats.adaTarget} / ${rows.length}`}
          color="text-emerald-400"
        />
        <StatBox
          label="Target Halaman"
          value={formatHalaman(stats.totalHalamanTarget)}
          color="text-indigo-400"
        />
        <StatBox
          label="Realisasi"
          value={formatHalaman(stats.totalHalamanRealisasi)}
          color="text-amber-400"
        />
        <StatBox
          label="Rata Capaian"
          value={`${stats.rataPersen.toFixed(0)}%`}
          color="text-rose-400"
        />
      </div>

      {/* Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa..."
              className={INPUT_CLASS + ' pl-9'}
            />
          </div>
          <select
            value={filterKelas}
            onChange={(e) =>
              setFilterKelas(e.target.value === '' ? '' : Number(e.target.value))
            }
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Tidak ada siswa cocok.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((row) => {
              const hasTarget = !!row.target;
              const hasRange =
                row.target?.surah_mulai != null &&
                row.target?.ayat_mulai != null &&
                row.target?.surah_selesai != null &&
                row.target?.ayat_selesai != null;

              const percentColor =
                row.persen >= 100
                  ? 'text-emerald-400'
                  : row.persen >= 70
                  ? 'text-teal-400'
                  : row.persen >= 40
                  ? 'text-amber-400'
                  : 'text-rose-400';

              const barColor =
                row.persen >= 100
                  ? 'bg-emerald-500'
                  : row.persen >= 70
                  ? 'bg-teal-500'
                  : row.persen >= 40
                  ? 'bg-amber-500'
                  : 'bg-rose-500';

              return (
                <div
                  key={row.siswa.id}
                  className="px-4 py-3 hover:bg-slate-800/30 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Siswa */}
                    <div className="flex items-center gap-2 md:w-1/3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 text-xs">
                        {row.siswa.nama_lengkap.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-200 truncate">
                          {row.siswa.nama_lengkap}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {row.siswa.kelas_nama} · {row.siswa.nisn}
                        </p>
                      </div>
                    </div>

                    {/* Progress / Info */}
                    <div className="md:flex-1 min-w-0">
                      {hasTarget && hasRange ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-slate-300 font-bold">
                            📖{' '}
                            {surahMap.get(row.target!.surah_mulai!)?.nama_latin}{' '}
                            {row.target!.ayat_mulai}
                            {' → '}
                            {surahMap.get(row.target!.surah_selesai!)?.nama_latin}{' '}
                            {row.target!.ayat_selesai}
                          </p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">
                              {formatHalaman(row.realisasi_halaman)} /{' '}
                              {row.target!.target_halaman} hal
                            </span>
                            <span className={`font-extrabold ${percentColor}`}>
                              {row.persen.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} transition-all`}
                              style={{ width: `${Math.min(100, row.persen)}%` }}
                            />
                          </div>
                        </div>
                      ) : hasTarget && row.target?.target_halaman ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">
                              {formatHalaman(row.realisasi_halaman)} /{' '}
                              {row.target.target_halaman} hal
                            </span>
                            <span className={`font-extrabold ${percentColor}`}>
                              {row.persen.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} transition-all`}
                              style={{ width: `${Math.min(100, row.persen)}%` }}
                            />
                          </div>
                        </div>
                      ) : hasTarget ? (
                        <p className="text-xs text-slate-500 italic">
                          Target:{' '}
                          {row.target?.target_juz
                            ? `${row.target.target_juz} juz`
                            : ''}
                          {row.target?.target_surah
                            ? ` · ${row.target.target_surah} surah`
                            : ''}
                          {!row.target?.target_juz && !row.target?.target_surah
                            ? 'Belum diset detailnya'
                            : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Belum ada target
                        </p>
                      )}
                    </div>

                    {/* Aksi */}
                    <div className="flex items-center gap-1 md:justify-end">
                      <button
                        onClick={() => handleOpenModal(row.siswa, row.target)}
                        className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
                        title={hasTarget ? 'Edit Target' : 'Set Target'}
                      >
                        {hasTarget ? <Pencil size={14} /> : <Plus size={14} />}
                      </button>
                      {hasTarget && (
                        <button
                          onClick={() => handleDelete(row)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus Target"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <ModalTarget
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditTarget(null);
          fetchAll(true);
        }}
        siswa={editTarget?.siswa ?? null}
        existingTarget={editTarget?.target ?? null}
        tahunAjaranAktif={tahunAjaranAktif}
        surahMap={surahMap}
        halamanMap={halamanMap}
      />
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
      <p className={`text-lg font-extrabold ${color} mt-0.5`}>{value}</p>
    </div>
  );
}