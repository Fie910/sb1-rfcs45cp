// src/components/tahfidz/SertifikatTab.tsx
// Tab list siswa untuk cetak sertifikat tahfidz.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award, Search, Loader2, RefreshCw, Printer, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { INPUT_CLASS } from './shared';
import { getHalamanSetoran, formatHalaman } from '@/lib/tahfidz/hitungHalaman';
import { ModalSertifikat } from './ModalSertifikat';
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

type SiswaRow = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas_nama: string;
  total_halaman: number;
  total_setoran: number;
  last_tanggal: string | null;
};

export function SertifikatTab({ surahMap, halamanMap }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);
  const [siswaList, setSiswaList] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState<number | ''>('');

  const [selectedSiswa, setSelectedSiswa] = useState<SiswaRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [siswaRes, setoranRes] = await Promise.all([
        supabase
          .from('siswas')
          .select('id, nisn, nama_lengkap, kelas_id, kelas:kelas_id (nama_kelas)')
          .eq('status', 'AKTIF')
          .order('nama_lengkap'),
        supabase
          .from('tahfidz_setoran')
          .select('id, siswa_id, tanggal, surah_mulai, ayat_mulai, surah_selesai, ayat_selesai'),
      ]);

      setSiswaList(siswaRes.data ?? []);
      setSetoranList((setoranRes.data as any) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(false); }, [fetchAll]);

  const rows = useMemo<SiswaRow[]>(() => {
    const halamanMapAgg = new Map<number, number>();
    const countMap = new Map<number, number>();
    const lastMap = new Map<number, string>();

    setoranList.forEach((s) => {
      halamanMapAgg.set(
        s.siswa_id,
        (halamanMapAgg.get(s.siswa_id) ?? 0) + getHalamanSetoran(s, surahMap, halamanMap)
      );
      countMap.set(s.siswa_id, (countMap.get(s.siswa_id) ?? 0) + 1);
      const last = lastMap.get(s.siswa_id);
      if (!last || s.tanggal > last) lastMap.set(s.siswa_id, s.tanggal);
    });

    return siswaList.map((s) => ({
      id: s.id,
      nisn: s.nisn,
      nama_lengkap: s.nama_lengkap,
      kelas_id: s.kelas_id,
      kelas_nama: s.kelas?.nama_kelas ?? '-',
      total_halaman: halamanMapAgg.get(s.id) ?? 0,
      total_setoran: countMap.get(s.id) ?? 0,
      last_tanggal: lastMap.get(s.id) ?? null,
    }));
  }, [siswaList, setoranList, surahMap, halamanMap]);

  const filtered = useMemo(() => {
    let result = rows;
    if (filterKelas !== '') result = result.filter((r) => r.kelas_id === filterKelas);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) => r.nama_lengkap.toLowerCase().includes(q) || r.nisn.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.total_halaman - a.total_halaman);
  }, [rows, filterKelas, search]);

  const kelasList = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((r) => {
      if (r.kelas_id && !map.has(r.kelas_id)) map.set(r.kelas_id, r.kelas_nama);
    });
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }));
  }, [rows]);

  const handleOpenModal = (row: SiswaRow) => {
    if (row.total_halaman <= 0) {
      showToast('error', 'Siswa belum punya setoran hafalan');
      return;
    }
    setSelectedSiswa(row);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat data siswa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award size={18} className="text-emerald-400" />
          <h2 className="text-base font-extrabold text-slate-100">Cetak Sertifikat</h2>
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

      <div className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
        <Award size={14} className="shrink-0 mt-0.5" />
        <span>
          Pilih siswa, tentukan pencapaian, dan cetak sertifikat A4 landscape siap
          tanda tangan basah. Siswa tanpa setoran tidak akan muncul.
        </span>
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
            onChange={(e) => setFilterKelas(e.target.value === '' ? '' : Number(e.target.value))}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Kelas</option>
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Tidak ada siswa cocok.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((row) => {
              const eligible = row.total_halaman >= 0.5;
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0 text-xs">
                    {row.nama_lengkap.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-200 truncate">{row.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-500">{row.kelas_nama} · {row.nisn}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-emerald-400">{formatHalaman(row.total_halaman)}</p>
                    <p className="text-[9px] text-slate-500 uppercase">halaman</p>
                  </div>
                  <button
                    onClick={() => handleOpenModal(row)}
                    disabled={!eligible}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Printer size={12} />
                    Cetak
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalSertifikat
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedSiswa(null); }}
        siswa={selectedSiswa}
        surahMap={surahMap}
        halamanMap={halamanMap}
      />
    </div>
  );
}