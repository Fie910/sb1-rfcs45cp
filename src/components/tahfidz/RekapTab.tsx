// src/components/tahfidz/RekapTab.tsx
// Rekap hafalan per kelas + export PDF.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, RefreshCw, Loader2, Download, Users, BookMarked, TrendingUp, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { INPUT_CLASS } from './shared';
import { getHalamanSetoran, formatHalaman } from '@/lib/tahfidz/hitungHalaman';
import { exportColoredPdf, PDF_COLORS } from '@/lib/pdf/pdfColoredExport';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzSetoranWithRelations,
} from '@/types/database';

type Props = {
  surahList: TahfidzSurah[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  isManager: boolean;
};

type KelasRekap = {
  kelas_id: number | null;
  nama_kelas: string;
  total_siswa: number;
  total_setoran: number;
  total_halaman: number;
  rata_nilai: number;
  siswa_terlibat: number;
};

function getFirstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLastDayOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function RekapTab({ surahMap, halamanMap }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);

  const [dari, setDari] = useState(getFirstDayOfMonth());
  const [sampai, setSampai] = useState(getLastDayOfMonth());

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('tahfidz_setoran')
        .select(`
          *,
          siswa:siswa_id (id, nisn, nama_lengkap, kelas_id,
            kelas:kelas_id (id, nama_kelas)
          )
        `)
        .gte('tanggal', dari)
        .lte('tanggal', sampai)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      setSetoranList((data as any) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dari, sampai]);

  useEffect(() => { fetchAll(false); }, [fetchAll]);

  const rekapPerKelas = useMemo<KelasRekap[]>(() => {
    const map = new Map<number | null, KelasRekap>();
    const siswaSet = new Map<number | null, Set<number>>();
    const nilaiMap = new Map<number | null, number[]>();

    setoranList.forEach((s) => {
      if (!s.siswa) return;
      const kelasId = s.siswa.kelas_id;
      const kelasNama = s.siswa.kelas?.nama_kelas ?? 'Tanpa Kelas';

      const existing = map.get(kelasId) ?? {
        kelas_id: kelasId,
        nama_kelas: kelasNama,
        total_siswa: 0,
        total_setoran: 0,
        total_halaman: 0,
        rata_nilai: 0,
        siswa_terlibat: 0,
      };

      existing.total_setoran += 1;
      existing.total_halaman += getHalamanSetoran(s, surahMap, halamanMap);
      map.set(kelasId, existing);

      const set = siswaSet.get(kelasId) ?? new Set<number>();
      set.add(s.siswa.id);
      siswaSet.set(kelasId, set);

      if (s.nilai !== null && s.nilai !== undefined) {
        const arr = nilaiMap.get(kelasId) ?? [];
        arr.push(s.nilai);
        nilaiMap.set(kelasId, arr);
      }
    });

    return Array.from(map.values())
      .map((r) => {
        const set = siswaSet.get(r.kelas_id) ?? new Set();
        const nilaiArr = nilaiMap.get(r.kelas_id) ?? [];
        return {
          ...r,
          siswa_terlibat: set.size,
          rata_nilai:
            nilaiArr.length > 0
              ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length
              : 0,
        };
      })
      .sort((a, b) => b.total_halaman - a.total_halaman);
  }, [setoranList, surahMap, halamanMap]);

  const totals = useMemo(() => {
    const totalHalaman = rekapPerKelas.reduce((s, r) => s + r.total_halaman, 0);
    const totalSetoran = rekapPerKelas.reduce((s, r) => s + r.total_setoran, 0);
    const allNilai = setoranList
      .map((s) => s.nilai)
      .filter((n): n is number => n !== null && n !== undefined);
    const rataNilai = allNilai.length > 0 ? allNilai.reduce((a, b) => a + b, 0) / allNilai.length : 0;
    return { totalHalaman, totalSetoran, rataNilai };
  }, [rekapPerKelas, setoranList]);

  const handleExportPdf = () => {
    if (rekapPerKelas.length === 0) {
      showToast('error', 'Tidak ada data untuk diexport');
      return;
    }

    const periodeLabel = `Periode: ${dari} s/d ${sampai}`;

    exportColoredPdf({
      filename: `Rekap_Tahfidz_${dari}_${sampai}.pdf`,
      title: 'REKAP HAFALAN TAHFIDZ QURAN',
      subtitle: periodeLabel,
      orientation: 'p',
      stats: [
        { label: 'Total Setoran', value: totals.totalSetoran, color: PDF_COLORS.indigo },
        { label: 'Total Halaman', value: formatHalaman(totals.totalHalaman), color: PDF_COLORS.emerald },
        { label: 'Rata Nilai', value: totals.rataNilai.toFixed(1), color: PDF_COLORS.amber },
      ],
      columns: [
        { header: 'No', halign: 'center', width: 12 },
        { header: 'Kelas', halign: 'left' },
        { header: 'Siswa', halign: 'center', width: 20 },
        { header: 'Setoran', halign: 'center', width: 22 },
        { header: 'Halaman', halign: 'center', width: 25 },
        { header: 'Rata Nilai', halign: 'center', width: 25 },
      ],
      rows: rekapPerKelas.map((r, i) => ({
        No: i + 1,
        Kelas: r.nama_kelas,
        Siswa: r.siswa_terlibat,
        Setoran: r.total_setoran,
        Halaman: formatHalaman(r.total_halaman),
        'Rata Nilai': r.rata_nilai.toFixed(1),
      })),
      footerNote: 'Laporan Rekap Tahfidz',
    });

    showToast('success', 'PDF sedang diunduh...');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat rekap...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-400" />
          <h2 className="text-base font-extrabold text-slate-100">Rekap Hafalan</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Dari</label>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Sampai</label>
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TotalCard icon={BookMarked} label="Total Setoran" value={totals.totalSetoran} color="indigo" />
        <TotalCard icon={TrendingUp} label="Total Halaman" value={formatHalaman(totals.totalHalaman)} color="emerald" />
        <TotalCard icon={Star} label="Rata Nilai" value={totals.rataNilai.toFixed(1)} color="amber" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">Rekap Per Kelas</h3>
          <span className="text-xs text-slate-500">{rekapPerKelas.length} kelas</span>
        </div>

        {rekapPerKelas.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Tidak ada data di periode ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50">
                <tr className="text-[10px] uppercase font-bold text-slate-500">
                  <th className="px-4 py-2.5 text-left">Kelas</th>
                  <th className="px-4 py-2.5 text-center">Siswa</th>
                  <th className="px-4 py-2.5 text-center">Setoran</th>
                  <th className="px-4 py-2.5 text-center">Halaman</th>
                  <th className="px-4 py-2.5 text-center">Rata Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rekapPerKelas.map((r) => (
                  <tr key={String(r.kelas_id)} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-200 font-bold">{r.nama_kelas}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{r.siswa_terlibat}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{r.total_setoran}</td>
                    <td className="px-4 py-3 text-center font-extrabold text-emerald-400">
                      {formatHalaman(r.total_halaman)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-extrabold ${r.rata_nilai >= 85 ? 'text-emerald-400' : r.rata_nilai >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {r.rata_nilai.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TotalCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: 'indigo' | 'emerald' | 'amber';
}) {
  const c = {
    indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  }[color];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center ${c.text}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
        <p className={`text-xl font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}