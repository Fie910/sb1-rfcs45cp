// src/components/tahfidz/PetaHafalanSection.tsx
// Peta Hafalan — visualisasi semua ayat satu surah dengan warna kualitas terakhir.
// Berguna untuk guru & siswa lihat progress hafalan secara visual.

import { useState, useEffect, useMemo } from 'react';
import {
  Map as MapIcon, Loader2, BookOpen, CheckCircle2, AlertCircle, XCircle,
  Info, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuranText } from '@/hooks/useQuranText';
import { getSemesterDateRange, type SemesterType } from '@/lib/tahfidz/semester';
import type { TahfidzSurah, KualitasHafalan } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  siswaId: number;
  surahMap: Map<number, TahfidzSurah>;
};

type AyatStatus = {
  ayat: number;
  kualitas: KualitasHafalan | null;
  tanggal: string | null;
  count: number;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function PetaHafalanSection({ siswaId, surahMap }: Props) {
  const { getAyatText, getSurahMeta, loading: loadingQuran } = useQuranText();

  const [loading, setLoading] = useState(true);
  const [selectedSurah, setSelectedSurah] = useState<number>(1);
  const [ayatMap, setAyatMap] = useState<Map<number, AyatStatus>>(new Map());
  const [lastFetchedSurah, setLastFetchedSurah] = useState<number | null>(null);

  // ===========================================================================
  // FETCH AYAT DATA untuk surah terpilih
  // ===========================================================================
  useEffect(() => {
    if (!siswaId) return;

    (async () => {
      setLoading(true);
      try {
        // 1. Ambil tahun ajaran aktif
        const { data: tahunAktif } = await supabase
          .from('tahun_ajarans')
          .select('id, tahun, semester')
          .eq('is_aktif', true)
          .maybeSingle();

        if (!tahunAktif) {
          setAyatMap(new Map());
          return;
        }

        const dateRange = getSemesterDateRange(
          tahunAktif.tahun,
          tahunAktif.semester as SemesterType
        );

        // 2. Ambil setoran siswa surah ini semester ini
        const { data: setoranList } = await supabase
          .from('tahfidz_setoran')
          .select('id, tanggal')
          .eq('siswa_id', siswaId)
          .eq('surah_mulai', selectedSurah)
          .eq('surah_selesai', selectedSurah)
          .gte('tanggal', dateRange.start)
          .lte('tanggal', dateRange.end)
          .order('tanggal', { ascending: true });

        if (!setoranList || setoranList.length === 0) {
          setAyatMap(new Map());
          setLastFetchedSurah(selectedSurah);
          return;
        }

        const setoranIds = setoranList.map((s) => s.id);
        const setoranTanggalMap = new Map(
          setoranList.map((s) => [s.id, s.tanggal])
        );

        // 3. Ambil ayat dinilai
        const { data: ayatData } = await supabase
          .from('tahfidz_setoran_ayat')
          .select('setoran_id, ayat_nomor, kualitas')
          .in('setoran_id', setoranIds)
          .eq('surah_nomor', selectedSurah);

        // 4. Aggregate per ayat → ambil yang TERAKHIR
        const sortedAyat = [...(ayatData ?? [])].sort((a: any, b: any) => {
          const aTgl = setoranTanggalMap.get(a.setoran_id) ?? '';
          const bTgl = setoranTanggalMap.get(b.setoran_id) ?? '';
          return aTgl.localeCompare(bTgl);
        });

        const map = new Map<number, AyatStatus>();
        sortedAyat.forEach((row: any) => {
          const existing = map.get(row.ayat_nomor);
          map.set(row.ayat_nomor, {
            ayat: row.ayat_nomor,
            kualitas: row.kualitas,
            tanggal: setoranTanggalMap.get(row.setoran_id) ?? null,
            count: (existing?.count ?? 0) + 1,
          });
        });

        setAyatMap(map);
        setLastFetchedSurah(selectedSurah);
      } catch (err) {
        console.warn('[PetaHafalan] Error:', err);
        setAyatMap(new Map());
      } finally {
        setLoading(false);
      }
    })();
  }, [siswaId, selectedSurah]);

  // ===========================================================================
  // SURAH META
  // ===========================================================================
  const surahMeta = useMemo(() => {
    return surahMap.get(selectedSurah) ?? null;
  }, [surahMap, selectedSurah]);

  // ===========================================================================
  // STATISTIK PER SUrah
  // ===========================================================================
  const stats = useMemo(() => {
    let lancar = 0, cukup = 0, perlu = 0, belum = 0;
    const totalAyat = surahMeta?.jumlah_ayat ?? 0;
    
    for (let i = 1; i <= totalAyat; i++) {
      const status = ayatMap.get(i);
      if (!status || !status.kualitas) {
        belum++;
      } else if (status.kualitas === 'Lancar') {
        lancar++;
      } else if (status.kualitas === 'Cukup') {
        cukup++;
      } else if (status.kualitas === 'Perlu Ulang') {
        perlu++;
      }
    }
    const dinilai = lancar + cukup + perlu;
    const persen = totalAyat > 0 ? (dinilai / totalAyat) * 100 : 0;
    return { lancar, cukup, perlu, belum, totalAyat, dinilai, persen };
  }, [ayatMap, surahMeta]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  const surahList = Array.from(surahMap.values()).sort((a, b) => a.nomor - b.nomor);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
            <MapIcon size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Peta Hafalan</h3>
            <p className="text-[10px] text-slate-500">
              Warna ayat = kualitas terakhir (semester ini)
            </p>
          </div>
        </div>

        {/* Pilih Surah */}
        <select
          value={selectedSurah}
          onChange={(e) => setSelectedSurah(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-purple-500/50 max-w-[200px]"
        >
          {surahList.map((s) => (
            <option key={s.nomor} value={s.nomor}>
              {s.nomor}. {s.nama_latin}
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500" />
          <span className="text-slate-400">Lancar</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500" />
          <span className="text-slate-400">Cukup</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500" />
          <span className="text-slate-400">Perlu Ulang</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-700 border border-slate-600" />
          <span className="text-slate-400">Belum dinilai</span>
        </span>
      </div>

      {/* Info Banner */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 flex items-start gap-2">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>
          Peta ini diambil dari <strong>penilaian terakhir per ayat</strong> semester ini.
          Klik ayat untuk lihat detail.
        </span>
      </div>

      {/* Stats Bar */}
      {surahMeta && stats.totalAyat > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-sm font-extrabold text-emerald-400">{stats.lancar}</p>
            <p className="text-[8px] uppercase font-bold text-emerald-400/70">Lancar</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-sm font-extrabold text-amber-400">{stats.cukup}</p>
            <p className="text-[8px] uppercase font-bold text-amber-400/70">Cukup</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-sm font-extrabold text-rose-400">{stats.perlu}</p>
            <p className="text-[8px] uppercase font-bold text-rose-400/70">Perlu Ulang</p>
          </div>
          <div className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-center">
            <p className="text-sm font-extrabold text-slate-400">{stats.belum}</p>
            <p className="text-[8px] uppercase font-bold text-slate-500">Belum</p>
          </div>
        </div>
      )}

      {/* Peta Ayat */}
      {loading || loadingQuran ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-purple-400 mx-auto" />
        </div>
      ) : !surahMeta ? (
        <p className="text-xs text-slate-500 text-center py-8">
          Surah tidak ditemukan
        </p>
      ) : (
        <>
          {/* Grid Ayat */}
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 max-h-[400px] overflow-y-auto custom-scrollbar">
            {Array.from({ length: surahMeta.jumlah_ayat }, (_, i) => i + 1).map(
              (ayatNum) => {
                const status = ayatMap.get(ayatNum);
                const text = getAyatText(selectedSurah, ayatNum);

                const colorClass = !status?.kualitas
                  ? 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
                  : status.kualitas === 'Lancar'
                  ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/40'
                  : status.kualitas === 'Cukup'
                  ? 'bg-amber-500/30 border-amber-500/50 text-amber-300 hover:bg-amber-500/40'
                  : 'bg-rose-500/30 border-rose-500/50 text-rose-300 hover:bg-rose-500/40';

                const title = status?.kualitas
                  ? `Ayat ${ayatNum} · ${status.kualitas}\nTerakhir: ${status.tanggal ?? '-'}\nDinilai ${status.count}x${text ? '\n\n' + text.slice(0, 100) + (text.length > 100 ? '...' : '') : ''}`
                  : `Ayat ${ayatNum} · Belum dinilai`;

                return (
                  <button
                    key={ayatNum}
                    title={title}
                    className={`aspect-square rounded-md border ${colorClass} font-bold text-[10px] transition cursor-pointer flex items-center justify-center`}
                  >
                    {ayatNum}
                  </button>
                );
              }
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>
                Progress: <strong className="text-slate-200">{stats.dinilai}</strong> /{' '}
                <strong className="text-slate-200">{stats.totalAyat}</strong> ayat dinilai
              </span>
              <span className={`font-extrabold ${
                stats.persen >= 100 ? 'text-emerald-400' :
                stats.persen >= 70 ? 'text-teal-400' :
                stats.persen >= 40 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {stats.persen.toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stats.persen >= 100 ? 'bg-emerald-500' :
                  stats.persen >= 70 ? 'bg-teal-500' :
                  stats.persen >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, stats.persen)}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}