// src/components/tahfidz/ProgressSiswaTab.tsx
// List siswa + drill-down detail progress hafalan per siswa.
// ✅ A1: Tampilkan penilaian per ayat (kalau ada) di riwayat setoran.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Search, Loader2, RefreshCw, ArrowLeft, BookMarked,
  TrendingUp, Calendar, Star, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import {
  INPUT_CLASS, getJenisSetoranBadge, getKualitasBadge,
  getNilaiBadge, formatTanggalShort,
} from './shared';
import {
  getHalamanSetoran, hitungTotalAyatSetoran,
  formatHalaman, formatRentangHafalan,
} from '@/lib/tahfidz/hitungHalaman';
import { useQuranText } from '@/hooks/useQuranText';
import { RekomendasiLatihanSection } from './RekomendasiLatihanSection';
import { ModalSetoranAyat } from './ModalSetoranAyat';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzSetoranWithRelations,
  KualitasHafalan,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  surahList: TahfidzSurah[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  isManager: boolean;
};

type SiswaWithStats = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas_nama: string;
  total_setoran: number;
  total_tahfidz: number;
  total_halaman: number;
  rata_nilai: number;
  terakhir_setoran: string | null;
};

type KelasOption = { id: number; nama_kelas: string };

type SetoranAyatDetail = {
  id: number;
  setoran_id: string;
  surah_nomor: number;
  ayat_nomor: number;
  kualitas: KualitasHafalan;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ProgressSiswaTab({ surahMap, halamanMap }: Props) {
  const { getAyatText, loading: loadingQuran } = useQuranText();

  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaWithStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);

  // ✅ NEW: Map setoran_id → daftar ayat dinilai
  const [ayatMap, setAyatMap] = useState<Map<string, SetoranAyatDetail[]>>(new Map());
  const [loadingAyat, setLoadingAyat] = useState(false);

  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState<number | ''>('');

  const [rekomendasiKey, setRekomendasiKey] = useState(0);

  const [murojaahPrefill, setMurojaahPrefill] = useState<{
  surah: number;
  ayatMulai: number;
  ayatSelesai: number;
} | null>(null);

  // ===========================================================================
  // FETCH LIST + KELAS
  // ===========================================================================
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [setoranRes, kelasRes] = await Promise.all([
        supabase
          .from('tahfidz_setoran')
          .select(`
            *,
            siswa:siswa_id (id, nisn, nama_lengkap, kelas_id,
              kelas:kelas_id (id, nama_kelas)
            ),
            guru:guru_tahfidz_id (id, nama_lengkap)
          `)
          .order('tanggal', { ascending: false }),
        supabase.from('kelas').select('id, nama_kelas').order('nama_kelas'),
      ]);

      setSetoranList((setoranRes.data as any) ?? []);
      setKelasList((kelasRes.data as KelasOption[]) ?? []);
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
  // ✅ NEW: FETCH AYAT saat detail siswa dipilih
  // ===========================================================================
  useEffect(() => {
    if (!selectedSiswa) {
      setAyatMap(new Map());
      return;
    }

    (async () => {
      setLoadingAyat(true);
      try {
        // Ambil semua setoran siswa ini
        const setoranIds = setoranList
          .filter((s) => s.siswa?.id === selectedSiswa.id)
          .map((s) => s.id);

        if (setoranIds.length === 0) {
          setAyatMap(new Map());
          return;
        }

        // Query ayat dinilai untuk setoran-setoran tersebut
        const { data } = await supabase
          .from('tahfidz_setoran_ayat')
          .select('id, setoran_id, surah_nomor, ayat_nomor, kualitas')
          .in('setoran_id', setoranIds)
          .order('surah_nomor', { ascending: true })
          .order('ayat_nomor', { ascending: true });

        const map = new Map<string, SetoranAyatDetail[]>();
        (data ?? []).forEach((row: any) => {
          if (!map.has(row.setoran_id)) map.set(row.setoran_id, []);
          map.get(row.setoran_id)!.push(row);
        });

        setAyatMap(map);
      } catch (err) {
        console.warn('[ProgressSiswa] Gagal load ayat:', err);
      } finally {
        setLoadingAyat(false);
      }
    })();
  }, [selectedSiswa, setoranList]);

  // ===========================================================================
  // STATS AGREGAT PER SISWA
  // ===========================================================================
  const siswaStats = useMemo<SiswaWithStats[]>(() => {
    const map = new Map<number, SiswaWithStats>();

    setoranList.forEach((s) => {
      if (!s.siswa) return;
      const existing = map.get(s.siswa.id) ?? {
        id: s.siswa.id,
        nisn: s.siswa.nisn,
        nama_lengkap: s.siswa.nama_lengkap,
        kelas_id: s.siswa.kelas_id,
        kelas_nama: s.siswa.kelas?.nama_kelas ?? '-',
        total_setoran: 0,
        total_tahfidz: 0,
        total_halaman: 0,
        rata_nilai: 0,
        terakhir_setoran: null,
      };

      existing.total_setoran += 1;
      if (s.jenis === 'Tahfidz') existing.total_tahfidz += 1;
      existing.total_halaman += getHalamanSetoran(s, surahMap, halamanMap);

      if (!existing.terakhir_setoran || s.tanggal > existing.terakhir_setoran) {
        existing.terakhir_setoran = s.tanggal;
      }

      map.set(s.siswa.id, existing);
    });

    const nilaiMap = new Map<number, number[]>();
    setoranList.forEach((s) => {
      if (!s.siswa || s.nilai === null || s.nilai === undefined) return;
      const arr = nilaiMap.get(s.siswa.id) ?? [];
      arr.push(s.nilai);
      nilaiMap.set(s.siswa.id, arr);
    });

    return Array.from(map.values()).map((s) => {
      const nilaiArr = nilaiMap.get(s.id) ?? [];
      return {
        ...s,
        rata_nilai:
          nilaiArr.length > 0
            ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length
            : 0,
      };
    });
  }, [setoranList, surahMap, halamanMap]);

  const filtered = useMemo(() => {
    let result = siswaStats;
    if (filterKelas !== '') {
      result = result.filter((s) => s.kelas_id === filterKelas);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_lengkap.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      if (b.total_halaman !== a.total_halaman)
        return b.total_halaman - a.total_halaman;
      return a.nama_lengkap.localeCompare(b.nama_lengkap);
    });
  }, [siswaStats, filterKelas, search]);

  const riwayatSiswa = useMemo(() => {
    if (!selectedSiswa) return [];
    return setoranList
      .filter((s) => s.siswa?.id === selectedSiswa.id)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }, [setoranList, selectedSiswa]);

  // ===========================================================================
  // RENDER — DETAIL
  // ===========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat progress siswa...</p>
      </div>
    );
  }

  if (view === 'detail' && selectedSiswa) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setView('list');
            setSelectedSiswa(null);
          }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
        >
          <ArrowLeft size={14} /> Kembali ke List
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-extrabold text-xl shrink-0">
              {selectedSiswa.nama_lengkap.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-slate-100">
                {selectedSiswa.nama_lengkap}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedSiswa.kelas_nama} · NISN {selectedSiswa.nisn}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <MiniStat label="Total Setoran" value={selectedSiswa.total_setoran} color="text-indigo-400" />
            <MiniStat label="Hafalan Baru" value={selectedSiswa.total_tahfidz} color="text-emerald-400" />
            <MiniStat label="Halaman" value={formatHalaman(selectedSiswa.total_halaman)} color="text-amber-400" />
            <MiniStat label="Rata Nilai" value={selectedSiswa.rata_nilai.toFixed(1)} color="text-rose-400" />
          </div>
        </div>

        {/* ✅ Section Rekomendasi Latihan */}
        <RekomendasiLatihanSection
          siswaId={selectedSiswa.id}
          surahMap={surahMap}
          onOpenMurojaah={(surah, ayatMulai, ayatSelesai) => {
            setMurojaahPrefill({ surah, ayatMulai, ayatSelesai });
          }}
        />

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Riwayat Setoran ({riwayatSiswa.length})
              </h3>
            </div>
            {loadingAyat && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> Memuat ayat...
              </span>
            )}
          </div>

          {riwayatSiswa.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-xs">Belum ada setoran</p>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {riwayatSiswa.map((item) => (
                <RiwayatItem
                  key={item.id}
                  setoran={item}
                  ayatList={ayatMap.get(item.id) ?? []}
                  surahMap={surahMap}
                  halamanMap={halamanMap}
                  getAyatText={getAyatText}
                />
              ))}
            </div>
          )}
        </div>
              {/* Modal Murojaah dari Rekomendasi */}
      {murojaahPrefill && (
        <ModalSetoranAyat
          open={!!murojaahPrefill}
          onClose={() => setMurojaahPrefill(null)}
          onSaved={() => {
            setMurojaahPrefill(null);
            fetchAll(true);
          }}
          surahMap={surahMap}
          halamanMap={halamanMap}
          currentGuruId={null}
          initialData={{
            siswa_id: String(selectedSiswa?.id ?? ''),
            jenis: 'Murojaah',
            surah_mulai: murojaahPrefill.surah,
            ayat_mulai: murojaahPrefill.ayatMulai,
            surah_selesai: murojaahPrefill.surah,
            ayat_selesai: murojaahPrefill.ayatSelesai,
          }}
        />
      )}
      </div>
    );
  }

  // ===========================================================================
  // RENDER — LIST
  // ===========================================================================
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-emerald-400" />
          <h2 className="text-base font-extrabold text-slate-100">
            Progress Hafalan Siswa
          </h2>
          <span className="text-xs text-slate-500">({filtered.length} siswa)</span>
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

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
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
              <option key={k.id} value={k.id}>{k.nama_kelas}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl text-center py-16">
          <Users size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {search || filterKelas !== ''
              ? 'Tidak ada siswa cocok filter.'
              : 'Belum ada data setoran.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedSiswa(s);
                setView('detail');
              }}
              className="text-left bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-4 transition group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-extrabold shrink-0">
                  {s.nama_lengkap.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-100 truncate group-hover:text-emerald-300 transition">
                    {s.nama_lengkap}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {s.kelas_nama} · {s.nisn}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <StatMini label="Setoran" value={s.total_setoran} icon={BookMarked} />
                    <StatMini label="Halaman" value={formatHalaman(s.total_halaman)} icon={TrendingUp} />
                    <StatMini label="Nilai" value={s.rata_nilai.toFixed(0)} icon={Star} />
                  </div>
                  {s.terakhir_setoran && (
                    <p className="text-[10px] text-slate-500 mt-2">
                      Terakhir: {formatTanggalShort(s.terakhir_setoran)}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB — RIWAYAT ITEM (dengan expander per-ayat)
// =============================================================================
function RiwayatItem({
  setoran,
  ayatList,
  surahMap,
  halamanMap,
  getAyatText,
}: {
  setoran: TahfidzSetoranWithRelations;
  ayatList: SetoranAyatDetail[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  getAyatText: (surah: number, ayat: number) => string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const halaman = getHalamanSetoran(setoran, surahMap, halamanMap);
  const ayat = hitungTotalAyatSetoran(setoran, surahMap);
  const hasAyat = ayatList.length > 0;

  // Stats ayat
  const stats = useMemo(() => {
    const lancar = ayatList.filter((a) => a.kualitas === 'Lancar').length;
    const cukup = ayatList.filter((a) => a.kualitas === 'Cukup').length;
    const perlu = ayatList.filter((a) => a.kualitas === 'Perlu Ulang').length;
    return { total: ayatList.length, lancar, cukup, perlu };
  }, [ayatList]);

  return (
    <div className="hover:bg-slate-800/20 transition">
      {/* Main Info */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${getJenisSetoranBadge(setoran.jenis)}`}>
                {setoran.jenis}
              </span>
              {setoran.kualitas && (
                <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${getKualitasBadge(setoran.kualitas)}`}>
                  {setoran.kualitas}
                </span>
              )}
              {hasAyat && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                  <CheckCircle2 size={9} /> Per Ayat
                </span>
              )}
              <span className="text-[10px] text-slate-500">
                {formatTanggalShort(setoran.tanggal)}
              </span>
            </div>
            <p className="text-xs text-slate-200">
              {formatRentangHafalan(setoran, surahMap)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {ayat} ayat · {formatHalaman(halaman)} halaman
              {setoran.guru && ` · oleh ${setoran.guru.nama_lengkap}`}
            </p>
            {setoran.catatan && (
              <p className="text-[10px] text-slate-400 italic mt-1">
                "{setoran.catatan}"
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-lg font-extrabold ${getNilaiBadge(setoran.nilai)}`}>
              {setoran.nilai ?? '—'}
            </p>
            <p className="text-[9px] text-slate-500 uppercase">nilai</p>
          </div>
        </div>

        {/* Expander Toggle */}
        {hasAyat && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 text-xs font-bold text-slate-300 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Lihat penilaian per ayat ({stats.total})</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {stats.lancar > 0 && (
                <span className="text-emerald-400">✓ {stats.lancar}</span>
              )}
              {stats.cukup > 0 && (
                <span className="text-amber-400">~ {stats.cukup}</span>
              )}
              {stats.perlu > 0 && (
                <span className="text-rose-400">✗ {stats.perlu}</span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Ayat Detail */}
      {hasAyat && expanded && (
        <div className="px-4 pb-4 space-y-1.5">
          {ayatList.map((a) => (
            <AyatDetailRow
              key={`${a.surah_nomor}-${a.ayat_nomor}`}
              ayat={a}
              surahMap={surahMap}
              text={getAyatText(a.surah_nomor, a.ayat_nomor)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB — AYAT DETAIL ROW
// =============================================================================
function AyatDetailRow({
  ayat,
  surahMap,
  text,
}: {
  ayat: SetoranAyatDetail;
  surahMap: Map<number, TahfidzSurah>;
  text: string | null;
}) {
  const kualitasConfig: Record<string, { bg: string; border: string; text: string; icon: any }> = {
    Lancar: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    Cukup: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertCircle },
    'Perlu Ulang': { bg: 'bg-rose-500/5', border: 'border-rose-500/30', text: 'text-rose-400', icon: XCircle },
  };

  const c = kualitasConfig[ayat.kualitas] ?? kualitasConfig['Lancar'];
  const Icon = c.icon;

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${c.bg} ${c.border}`}>
      {/* Ayat Number */}
      <div className={`inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg bg-slate-900 border ${c.border} ${c.text} font-bold text-xs shrink-0`}>
        {ayat.ayat_nomor}
      </div>

      {/* Arabic Text */}
      <div className="flex-1 min-w-0">
        {text ? (
          <p
            className="text-right text-base leading-loose text-slate-100"
            dir="rtl"
            style={{ fontFamily: 'Amiri, "Traditional Arabic", serif' }}
          >
            {text}
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">
            Teks tidak tersedia
          </p>
        )}
      </div>

      {/* Badge Kualitas */}
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${c.border} ${c.text} text-[10px] font-bold shrink-0`}>
        <Icon size={10} />
        {ayat.kualitas}
      </span>
    </div>
  );
}

// =============================================================================
// SUB
// =============================================================================
function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="text-center px-2 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
      <p className={`text-lg font-extrabold ${color}`}>{value}</p>
      <p className="text-[9px] uppercase font-bold text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatMini({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: any;
}) {
  return (
    <div className="text-center px-1.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
      <Icon size={10} className="mx-auto text-emerald-400 mb-0.5" />
      <p className="text-xs font-extrabold text-slate-100">{value}</p>
      <p className="text-[8px] uppercase text-slate-500">{label}</p>
    </div>
  );
}