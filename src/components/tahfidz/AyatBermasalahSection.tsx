// src/components/tahfidz/AyatBermasalahSection.tsx
// Statistik "ayat sering perlu ulang" — top 20 ayat bermasalah per semester.
// Berguna untuk guru: identifikasi ayat yang perlu diulang massal.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingDown, Loader2, RefreshCw, ChevronRight, Users,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useQuranText } from '@/hooks/useQuranText';
import { getSemesterDateRange, type SemesterType } from '@/lib/tahfidz/semester';
import type { TahfidzSurah } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  surahMap: Map<number, TahfidzSurah>;
};

type AyatStat = {
  surah_nomor: number;
  ayat_nomor: number;
  perlu_ulang_count: number;
  cukup_count: number;
  lancar_count: number;
  total_dinilai: number;
  persen_perlu_ulang: number;
};

type SiswaDetail = {
  siswa_id: number;
  nama_lengkap: string;
  nisn: string;
  kelas_nama: string;
  kualitas: string;
  tanggal: string;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function AyatBermasalahSection({ surahMap }: Props) {
  const { getAyatText, getSurahMeta } = useQuranText();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AyatStat[]>([]);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<any>(null);

  // Modal detail
  const [detailAyat, setDetailAyat] = useState<AyatStat | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailList, setDetailList] = useState<SiswaDetail[]>([]);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Ambil tahun ajaran aktif
      const { data: tahunAktif } = await supabase
        .from('tahun_ajarans')
        .select('id, tahun, semester')
        .eq('is_aktif', true)
        .maybeSingle();

      setTahunAjaranAktif(tahunAktif);
      if (!tahunAktif) {
        setStats([]);
        return;
      }

      const dateRange = getSemesterDateRange(
        tahunAktif.tahun,
        tahunAktif.semester as SemesterType
      );

      // 2. Ambil semua setoran dalam semester → get ID list
      const { data: setoranList } = await supabase
        .from('tahfidz_setoran')
        .select('id')
        .gte('tanggal', dateRange.start)
        .lte('tanggal', dateRange.end);

      if (!setoranList || setoranList.length === 0) {
        setStats([]);
        return;
      }

      const setoranIds = setoranList.map((s) => s.id);

      // 3. Ambil semua ayat dinilai dari setoran tersebut
      const { data: ayatData } = await supabase
        .from('tahfidz_setoran_ayat')
        .select('surah_nomor, ayat_nomor, kualitas')
        .in('setoran_id', setoranIds);

      if (!ayatData || ayatData.length === 0) {
        setStats([]);
        return;
      }

      // 4. Aggregate per ayat
      const map = new Map<
        string,
        {
          surah_nomor: number;
          ayat_nomor: number;
          perlu_ulang_count: number;
          cukup_count: number;
          lancar_count: number;
        }
      >();

      ayatData.forEach((row: any) => {
        const key = `${row.surah_nomor}:${row.ayat_nomor}`;
        const existing = map.get(key) ?? {
          surah_nomor: row.surah_nomor,
          ayat_nomor: row.ayat_nomor,
          perlu_ulang_count: 0,
          cukup_count: 0,
          lancar_count: 0,
        };

        if (row.kualitas === 'Perlu Ulang') existing.perlu_ulang_count += 1;
        else if (row.kualitas === 'Cukup') existing.cukup_count += 1;
        else if (row.kualitas === 'Lancar') existing.lancar_count += 1;

        map.set(key, existing);
      });

      // 5. Convert + filter + sort
      const list: AyatStat[] = Array.from(map.values())
        .filter((a) => a.perlu_ulang_count > 0) // hanya yang ada masalah
        .map((a) => {
          const total = a.perlu_ulang_count + a.cukup_count + a.lancar_count;
          return {
            ...a,
            total_dinilai: total,
            persen_perlu_ulang: total > 0 ? (a.perlu_ulang_count / total) * 100 : 0,
          };
        })
        .sort((a, b) => {
          // Sort: Perlu Ulang terbanyak, lalu persentase tertinggi
          if (b.perlu_ulang_count !== a.perlu_ulang_count)
            return b.perlu_ulang_count - a.perlu_ulang_count;
          return b.persen_perlu_ulang - a.persen_perlu_ulang;
        })
        .slice(0, 20);

      setStats(list);
    } catch (err: any) {
      console.warn('[AyatBermasalah] Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  // ===========================================================================
  // FETCH DETAIL saat ayat diklik
  // ===========================================================================
  useEffect(() => {
    if (!detailAyat || !tahunAjaranAktif) {
      setDetailList([]);
      return;
    }

    (async () => {
      setDetailLoading(true);
      try {
        const dateRange = getSemesterDateRange(
          tahunAjaranAktif.tahun,
          tahunAjaranAktif.semester as SemesterType
        );

        // Get setoran IDs semester ini
        const { data: setoranData } = await supabase
          .from('tahfidz_setoran')
          .select(`
            id, tanggal,
            siswa:siswa_id (id, nama_lengkap, nisn,
              kelas:kelas_id (nama_kelas)
            )
          `)
          .gte('tanggal', dateRange.start)
          .lte('tanggal', dateRange.end);

        if (!setoranData) {
          setDetailList([]);
          return;
        }

        const setoranMap = new Map<string, any>();
        setoranData.forEach((s: any) => setoranMap.set(s.id, s));

        const setoranIds = setoranData.map((s: any) => s.id);
        if (setoranIds.length === 0) {
          setDetailList([]);
          return;
        }

        // Get ayat dinilai untuk surah+ayat ini
        const { data: ayatData } = await supabase
          .from('tahfidz_setoran_ayat')
          .select('setoran_id, kualitas')
          .in('setoran_id', setoranIds)
          .eq('surah_nomor', detailAyat.surah_nomor)
          .eq('ayat_nomor', detailAyat.ayat_nomor);

        const list: SiswaDetail[] = (ayatData ?? [])
          .map((a: any) => {
            const setoran = setoranMap.get(a.setoran_id);
            if (!setoran) return null;
            return {
              siswa_id: setoran.siswa?.id ?? 0,
              nama_lengkap: setoran.siswa?.nama_lengkap ?? '—',
              nisn: setoran.siswa?.nisn ?? '—',
              kelas_nama: setoran.siswa?.kelas?.nama_kelas ?? '—',
              kualitas: a.kualitas,
              tanggal: setoran.tanggal,
            };
          })
          .filter((x): x is SiswaDetail => x !== null)
          .sort((a, b) => {
            // Perlu Ulang dulu, lalu Cukup, lalu Lancar
            const order: Record<string, number> = {
              'Perlu Ulang': 1,
              Cukup: 2,
              Lancar: 3,
            };
            const diff = (order[a.kualitas] ?? 9) - (order[b.kualitas] ?? 9);
            if (diff !== 0) return diff;
            return a.nama_lengkap.localeCompare(b.nama_lengkap);
          });

        setDetailList(list);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [detailAyat, tahunAjaranAktif]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={16} className="text-rose-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Ayat Sering Perlu Ulang
          </h3>
        </div>
        <div className="text-center py-8">
          <Loader2 size={24} className="animate-spin text-rose-400 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <TrendingDown size={14} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Ayat Sering Perlu Ulang
              </h3>
              <p className="text-[10px] text-slate-500">
                Top 20 ayat dengan nilai "Perlu Ulang" terbanyak
                {tahunAjaranAktif && (
                  <span className="ml-1 text-slate-400">
                    · {tahunAjaranAktif.semester} {tahunAjaranAktif.tahun}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Content */}
        {stats.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <TrendingDown size={28} className="mx-auto text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">
              {!tahunAjaranAktif
                ? 'Tidak ada tahun ajaran aktif'
                : 'Belum ada ayat dengan nilai "Perlu Ulang" semester ini'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {stats.map((a, idx) => {
              const surahMeta = getSurahMeta(a.surah_nomor);
              const text = getAyatText(a.surah_nomor, a.ayat_nomor);

              return (
                <button
                  key={`${a.surah_nomor}-${a.ayat_nomor}`}
                  onClick={() => setDetailAyat(a)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 hover:border-rose-500/40 transition cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    {/* Rank Badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                        idx === 0
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : idx < 3
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-indigo-400">
                          {surahMeta?.nama_latin ?? `Surah ${a.surah_nomor}`}:
                          {a.ayat_nomor}
                        </span>
                      </div>
                      {text && (
                        <p
                          className="text-right text-sm leading-relaxed text-slate-200 line-clamp-2 mb-1.5"
                          dir="rtl"
                          style={{ fontFamily: 'Amiri, "Traditional Arabic", serif' }}
                        >
                          {text}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold">
                          ✗ {a.perlu_ulang_count} Perlu Ulang
                        </span>
                        {a.cukup_count > 0 && (
                          <span className="text-amber-400 font-bold">
                            ~ {a.cukup_count} Cukup
                          </span>
                        )}
                        {a.lancar_count > 0 && (
                          <span className="text-emerald-400 font-bold">
                            ✓ {a.lancar_count} Lancar
                          </span>
                        )}
                        <span className="text-slate-500">
                          · {a.total_dinilai}x dinilai
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={14}
                      className="text-slate-600 group-hover:text-rose-400 transition shrink-0 mt-2"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Detail */}
      <Modal
        open={!!detailAyat}
        onClose={() => setDetailAyat(null)}
        title="Detail Ayat"
        size="lg"
      >
        {detailAyat && (
          <div className="space-y-4">
            {/* Info Ayat */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-indigo-400 mb-1">
                    {getSurahMeta(detailAyat.surah_nomor)?.nama_latin}:
                    {detailAyat.ayat_nomor}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {getSurahMeta(detailAyat.surah_nomor)?.arti}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-extrabold text-rose-400">
                    {detailAyat.perlu_ulang_count}
                  </p>
                  <p className="text-[9px] text-slate-500 uppercase">
                    perlu ulang
                  </p>
                </div>
              </div>

              {getAyatText(detailAyat.surah_nomor, detailAyat.ayat_nomor) && (
                <p
                  className="text-right text-lg leading-loose text-slate-100 p-3 rounded-lg bg-slate-900 border border-slate-800"
                  dir="rtl"
                  style={{ fontFamily: 'Amiri, "Traditional Arabic", serif' }}
                >
                  {getAyatText(detailAyat.surah_nomor, detailAyat.ayat_nomor)}
                </p>
              )}
            </div>

            {/* Siswa List */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-200">
                  Siswa yang pernah dinilai ({detailList.length})
                </p>
              </div>

              {detailLoading ? (
                <div className="text-center py-8">
                  <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" />
                </div>
              ) : detailList.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Tidak ada data
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {detailList.map((d, i) => {
                    const kualitasColor =
                      d.kualitas === 'Perlu Ulang'
                        ? 'text-rose-400'
                        : d.kualitas === 'Cukup'
                        ? 'text-amber-400'
                        : 'text-emerald-400';

                    return (
                      <div
                        key={`${d.siswa_id}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800/60"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 text-xs">
                          {d.nama_lengkap.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-200 truncate">
                            {d.nama_lengkap}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {d.kelas_nama} · {d.nisn}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${kualitasColor}`}>
                            {d.kualitas}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {d.tanggal}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDetailAyat(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}