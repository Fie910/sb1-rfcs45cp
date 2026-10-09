// src/components/tahfidz/RekomendasiLatihanSection.tsx
// Auto-rekomendasi latihan per siswa.
// Logic: ambil penilaian TERAKHIR per ayat. Kalau Perlu Ulang/Cukup → masuk rekomendasi.
// Kalau sudah Lancar di penilaian terakhir → tuntas (keluar dari list).

import { useState, useEffect, useMemo } from 'react';
import {
  Target, Loader2, BookOpen, ChevronRight, CheckCircle2,
  AlertCircle, XCircle, Sparkles, ListChecks, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuranText } from '@/hooks/useQuranText';
import { getSemesterDateRange, type SemesterType } from '@/lib/tahfidz/semester';
import type { TahfidzSurah } from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  siswaId: number;
  surahMap: Map<number, TahfidzSurah>;
  onOpenMurojaah?: (surah: number, ayatMulai: number, ayatSelesai: number) => void;
};

type RekomendasiItem = {
  surah_nomor: number;
  ayat_nomor: number;
  kualitas_terakhir: string;
  tanggal_terakhir: string;
  total_pernah_dinilai: number;
};

type RekomendasiGroup = {
  surah_nomor: number;
  items: RekomendasiItem[];
};

// =============================================================================
// COMPONENT
// =============================================================================
export function RekomendasiLatihanSection({ siswaId, onOpenMurojaah }: Props) {
  const { getAyatText, getSurahMeta } = useQuranText();

  const [loading, setLoading] = useState(true);
  const [rekomendasi, setRekomendasi] = useState<RekomendasiItem[]>([]);
  const [expandedSurah, setExpandedSurah] = useState<Set<number>>(new Set());

  // ===========================================================================
  // FETCH
  // ===========================================================================
  useEffect(() => {
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
          setRekomendasi([]);
          return;
        }

        const dateRange = getSemesterDateRange(
          tahunAktif.tahun,
          tahunAktif.semester as SemesterType
        );

        // 2. Ambil setoran siswa dalam semester ini
        const { data: setoranList } = await supabase
          .from('tahfidz_setoran')
          .select('id, tanggal')
          .eq('siswa_id', siswaId)
          .gte('tanggal', dateRange.start)
          .lte('tanggal', dateRange.end)
          .order('tanggal', { ascending: true });

        if (!setoranList || setoranList.length === 0) {
          setRekomendasi([]);
          return;
        }

        const setoranIds = setoranList.map((s) => s.id);
        const setoranTanggalMap = new Map(setoranList.map((s) => [s.id, s.tanggal]));

        // 3. Ambil semua ayat dinilai
        const { data: ayatData } = await supabase
          .from('tahfidz_setoran_ayat')
          .select('setoran_id, surah_nomor, ayat_nomor, kualitas')
          .in('setoran_id', setoranIds);

        if (!ayatData || ayatData.length === 0) {
          setRekomendasi([]);
          return;
        }

        // 4. Group by ayat → cari penilaian TERAKHIR per ayat
        type AyatRiwayat = {
          kualitas: string;
          tanggal: string;
          total: number;
        };
        const ayatMap = new Map<string, AyatRiwayat>();

        ayatData.forEach((row: any) => {
          const key = `${row.surah_nomor}:${row.ayat_nomor}`;
          const tanggal = setoranTanggalMap.get(row.setoran_id) ?? '1970-01-01';

          const existing = ayatMap.get(key);
          if (!existing || tanggal > existing.tanggal) {
            ayatMap.set(key, {
              kualitas: row.kualitas,
              tanggal,
              total: (existing?.total ?? 0) + 1,
            });
          } else if (existing) {
            existing.total += 1;
          }
        });

        // 5. Filter: kualitas terakhir = Perlu Ulang / Cukup
        const list: RekomendasiItem[] = [];
        ayatMap.forEach((value, key) => {
          const [surahStr, ayatStr] = key.split(':');
          const surah = Number(surahStr);
          const ayat = Number(ayatStr);

          if (value.kualitas === 'Perlu Ulang' || value.kualitas === 'Cukup') {
            list.push({
              surah_nomor: surah,
              ayat_nomor: ayat,
              kualitas_terakhir: value.kualitas,
              tanggal_terakhir: value.tanggal,
              total_pernah_dinilai: value.total,
            });
          }
        });

        // 6. Sort: Perlu Ulang dulu, lalu surah+ayat
        list.sort((a, b) => {
          const order: Record<string, number> = { 'Perlu Ulang': 1, Cukup: 2 };
          const diff = (order[a.kualitas_terakhir] ?? 9) - (order[b.kualitas_terakhir] ?? 9);
          if (diff !== 0) return diff;
          if (a.surah_nomor !== b.surah_nomor) return a.surah_nomor - b.surah_nomor;
          return a.ayat_nomor - b.ayat_nomor;
        });

        setRekomendasi(list);
      } catch (err) {
        console.warn('[RekomendasiLatihan] Error:', err);
        setRekomendasi([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [siswaId]);

  // ===========================================================================
  // GROUP BY SURAH
  // ===========================================================================
  const groups = useMemo<RekomendasiGroup[]>(() => {
    const map = new Map<number, RekomendasiItem[]>();
    rekomendasi.forEach((r) => {
      if (!map.has(r.surah_nomor)) map.set(r.surah_nomor, []);
      map.get(r.surah_nomor)!.push(r);
    });
    return Array.from(map.entries())
      .map(([surah_nomor, items]) => ({ surah_nomor, items }))
      .sort((a, b) => a.surah_nomor - b.surah_nomor);
  }, [rekomendasi]);

  // ===========================================================================
  // STATS
  // ===========================================================================
  const stats = useMemo(() => {
    const perlu = rekomendasi.filter((r) => r.kualitas_terakhir === 'Perlu Ulang').length;
    const cukup = rekomendasi.filter((r) => r.kualitas_terakhir === 'Cukup').length;
    return { total: rekomendasi.length, perlu, cukup };
  }, [rekomendasi]);

  const toggleSurah = (surahNomor: number) => {
    setExpandedSurah((prev) => {
      const next = new Set(prev);
      if (next.has(surahNomor)) next.delete(surahNomor);
      else next.add(surahNomor);
      return next;
    });
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Rekomendasi Latihan</h3>
        </div>
        <div className="text-center py-6">
          <Loader2 size={20} className="animate-spin text-amber-400 mx-auto" />
        </div>
      </div>
    );
  }

  if (rekomendasi.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-amber-400" />
          <h3 className="text-sm font-bold text-slate-100">Rekomendasi Latihan</h3>
        </div>
        <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
          <CheckCircle2 size={28} className="mx-auto text-emerald-500/60 mb-2" />
          <p className="text-xs text-slate-400 font-semibold">
            Tidak ada rekomendasi latihan 🎉
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Semua ayat yang pernah dinilai sudah lancar di penilaian terakhir
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Rekomendasi Latihan
            </h3>
            <p className="text-[10px] text-slate-500">
              {stats.total} ayat perlu diulang
              {stats.perlu > 0 && ` · ${stats.perlu} prioritas tinggi`}
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 flex items-start gap-2">
        <ListChecks size={12} className="shrink-0 mt-0.5" />
        <span>
          Rekomendasi ini diambil dari <strong>penilaian terakhir</strong> per ayat.
          Ayat yang sudah <strong>Lancar</strong> di penilaian terakhir tidak muncul di sini.
        </span>
      </div>

      {/* Groups per Surah */}
      <div className="space-y-2">
        {groups.map((g) => {
          const surahMeta = getSurahMeta(g.surah_nomor);
          const isExpanded = expandedSurah.has(g.surah_nomor);
          const perluCount = g.items.filter((i) => i.kualitas_terakhir === 'Perlu Ulang').length;
          const cukupCount = g.items.filter((i) => i.kualitas_terakhir === 'Cukup').length;

          return (
            <div
              key={g.surah_nomor}
              className="bg-slate-950/60 border border-slate-800/60 rounded-xl overflow-hidden"
            >
              {/* Surah Header */}
              <button
                onClick={() => toggleSurah(g.surah_nomor)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-900/60 transition cursor-pointer"
              >
                <ChevronRight
                  size={14}
                  className={`text-slate-500 transition-transform shrink-0 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />

                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xs font-extrabold shrink-0">
                  {g.surah_nomor}
                </div>

                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-slate-200">
                    {surahMeta?.nama_latin ?? `Surah ${g.surah_nomor}`}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {g.items.length} ayat perlu diulang
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {perluCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                      ✗ {perluCount}
                    </span>
                  )}
                  {cukupCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      ~ {cukupCount}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded: List Ayat */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-slate-800/60 pt-2">
                  {g.items.map((item) => {
                    const text = getAyatText(item.surah_nomor, item.ayat_nomor);
                    const isPerluUlang = item.kualitas_terakhir === 'Perlu Ulang';

                    const colorConfig = isPerluUlang
                      ? {
                          bg: 'bg-rose-500/5',
                          border: 'border-rose-500/30',
                          text: 'text-rose-400',
                          icon: XCircle,
                          label: 'Perlu Ulang',
                        }
                      : {
                          bg: 'bg-amber-500/5',
                          border: 'border-amber-500/30',
                          text: 'text-amber-400',
                          icon: AlertCircle,
                          label: 'Cukup',
                        };
                    const Icon = colorConfig.icon;

                    return (
                      <div
                        key={`${item.surah_nomor}-${item.ayat_nomor}`}
                        className={`rounded-lg border ${colorConfig.bg} ${colorConfig.border} p-2.5`}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <div className={`inline-flex items-center justify-center min-w-[28px] h-7 rounded-md bg-slate-900 border ${colorConfig.border} ${colorConfig.text} font-bold text-xs shrink-0`}>
                            {item.ayat_nomor}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${colorConfig.border} ${colorConfig.text} text-[9px] font-bold`}>
                                <Icon size={8} /> {colorConfig.label}
                              </span>
                              {item.total_pernah_dinilai > 1 && (
                                <span className="text-[9px] text-slate-500">
                                  {item.total_pernah_dinilai}x dinilai
                                </span>
                              )}
                            </div>
                            {text && (
                              <p
                                className="text-right text-sm leading-relaxed text-slate-200"
                                dir="rtl"
                                style={{ fontFamily: 'Amiri, "Traditional Arabic", serif' }}
                              >
                                {text}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Button */}
                        {onOpenMurojaah && (
                          <button
                            onClick={() =>
                              onOpenMurojaah(item.surah_nomor, item.ayat_nomor, item.ayat_nomor)
                            }
                            className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer border border-slate-700"
                          >
                            <BookOpen size={10} />
                            Buat Setoran Murojaah <ArrowRight size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}