// src/components/tahfidz/SetoranTab.tsx
// Tab utama: list setoran + filter + tambah/edit/hapus.
// ✅ Setoran per-ayat tidak bisa diedit (disabled + tooltip).

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookMarked, Plus, Search, RefreshCw, Loader2, Pencil, Trash2,
  Calendar, User, Award, Filter, BookOpen, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalSetoran } from './ModalSetoran';
import { ModalSetoranAyat } from './ModalSetoranAyat';
import {
  INPUT_CLASS,
  getJenisSetoranBadge,
  getKualitasBadge,
  getNilaiBadge,
  formatTanggalShort,
} from './shared';
import {
  getHalamanSetoran,
  hitungTotalAyatSetoran,
  formatHalaman,
  formatRentangHafalan,
} from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzSetoran,
  TahfidzSetoranWithRelations,
  JenisSetoran,
} from '@/types/database';
import { useAuth } from '@/context/AuthContext';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  surahList: TahfidzSurah[];
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  isManager: boolean;
};

// =============================================================================
// COMPONENT
// =============================================================================
export function SetoranTab({ surahMap, halamanMap, isManager }: Props) {
  const { guru } = useAuth();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [list, setList] = useState<TahfidzSetoranWithRelations[]>([]);

  // ✅ NEW: Set of setoran_id yang punya penilaian per ayat
  const [setoranAyatIds, setSetoranAyatIds] = useState<Set<string>>(new Set());

  // Filter
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState<'' | JenisSetoran>('');
  const [filterTanggalDari, setFilterTanggalDari] = useState('');
  const [filterTanggalSampai, setFilterTanggalSampai] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAyatOpen, setModalAyatOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TahfidzSetoran | null>(null);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let query = supabase
        .from('tahfidz_setoran')
        .select(`
          *,
          siswa:siswa_id (id, nisn, nama_lengkap, kelas_id,
            kelas:kelas_id (id, nama_kelas)
          ),
          guru:guru_tahfidz_id (id, nama_lengkap)
        `)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterJenis) query = query.eq('jenis', filterJenis);
      if (filterTanggalDari) query = query.gte('tanggal', filterTanggalDari);
      if (filterTanggalSampai) query = query.lte('tanggal', filterTanggalSampai);

      const { data, error } = await query;
      if (error) throw error;
      setList((data as any) ?? []);

      // ✅ Fetch semua setoran_id yang punya penilaian per ayat
      const { data: ayatIds } = await supabase
        .from('tahfidz_setoran_ayat')
        .select('setoran_id');

      const ids = new Set<string>((ayatIds ?? []).map((a: any) => a.setoran_id));
      setSetoranAyatIds(ids);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterJenis, filterTanggalDari, filterTanggalSampai]);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  // ===========================================================================
  // FILTERED
  // ===========================================================================
  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((s) => {
      const nama = s.siswa?.nama_lengkap?.toLowerCase() ?? '';
      const nisn = s.siswa?.nisn?.toLowerCase() ?? '';
      const guru = s.guru?.nama_lengkap?.toLowerCase() ?? '';
      return nama.includes(q) || nisn.includes(q) || guru.includes(q);
    });
  }, [list, search]);

  // ===========================================================================
  // STATS CEPAT
  // ===========================================================================
  const stats = useMemo(() => {
    const totalTahfidz = filtered.filter((s) => s.jenis === 'Tahfidz').length;
    const totalMurojaah = filtered.filter((s) => s.jenis === 'Murojaah').length;
    const totalHalaman = filtered.reduce(
      (sum, s) => sum + getHalamanSetoran(s, surahMap, halamanMap),
      0
    );
    return { totalTahfidz, totalMurojaah, totalHalaman };
  }, [filtered, surahMap, halamanMap]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const handleOpenAdd = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: TahfidzSetoran) => {
    // ✅ Setoran per-ayat tidak bisa diedit
    if (setoranAyatIds.has(item.id)) {
      showToast(
        'info',
        'Setoran per ayat tidak bisa diedit. Hapus & buat ulang jika perlu koreksi.'
      );
      return;
    }
    setEditTarget(item);
    setModalOpen(true);
  };

  const handleDelete = async (item: TahfidzSetoranWithRelations) => {
    // ✅ Konfirmasi lebih detail kalau per-ayat
    const isPerAyat = setoranAyatIds.has(item.id);
    const messageExtra = isPerAyat
      ? ' Semua penilaian per ayat akan ikut terhapus.'
      : '';

    const ok = await confirm({
      title: 'Hapus Setoran',
      message: `Yakin hapus setoran ${item.siswa?.nama_lengkap} tanggal ${formatTanggalShort(item.tanggal)}?${messageExtra}`,
      variant: 'danger',
    });
    if (!ok) return;

    try {
      // Setoran ayat punya ON DELETE CASCADE ke tahfidz_setoran
      // Jadi hapus setoran utama otomatis hapus penilaian per ayat
      const { error } = await supabase
        .from('tahfidz_setoran')
        .delete()
        .eq('id', item.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: item.id,
        deskripsi: `Hapus setoran tahfidz: ${item.siswa?.nama_lengkap}${isPerAyat ? ' (per ayat)' : ''}`,
      });

      showToast('success', 'Setoran dihapus');
      fetchAll(true);
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditTarget(null);
    fetchAll(true);
  };

  const handleSavedAyat = () => {
    setModalAyatOpen(false);
    fetchAll(true);
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="animate-spin text-emerald-400 mb-3" size={36} />
        <p className="text-xs text-slate-400">Memuat setoran...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
            <BookMarked size={13} /> {stats.totalTahfidz} Tahfidz
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold">
            <Award size={13} /> {stats.totalMurojaah} Murojaah
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
            📖 {formatHalaman(stats.totalHalaman)} Halaman
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setModalAyatOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
            title="Mode per ayat (detail)"
          >
            <BookOpen size={14} />
            Per Ayat
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
            title="Mode rentang (cepat)"
          >
            <Plus size={14} />
            Tambah Setoran
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-bold">
          <Filter size={13} /> Filter
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa / NISN / guru..."
              className={INPUT_CLASS + ' pl-9'}
            />
          </div>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value as any)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Jenis</option>
            <option value="Tahfidz">Tahfidz</option>
            <option value="Murojaah">Murojaah</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={filterTanggalDari}
              onChange={(e) => setFilterTanggalDari(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Dari"
            />
            <input
              type="date"
              value={filterTanggalSampai}
              onChange={(e) => setFilterTanggalSampai(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Sampai"
            />
          </div>
        </div>
      </div>

      {/* INFO BANNER */}
      <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2">
        <Info size={12} className="shrink-0 mt-0.5 text-indigo-400" />
        <span>
          Setoran dengan badge <strong className="text-indigo-300">Per Ayat</strong>{' '}
          tidak bisa diedit langsung. Untuk koreksi, hapus lalu buat ulang dengan
          mode <strong>Per Ayat</strong>.
        </span>
      </div>

      {/* LIST */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookMarked size={40} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {search || filterJenis || filterTanggalDari
                ? 'Tidak ada setoran cocok dengan filter.'
                : 'Belum ada setoran.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header desktop */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <div className="col-span-3">Siswa</div>
              <div className="col-span-2">Tanggal</div>
              <div className="col-span-3">Hafalan</div>
              <div className="col-span-1 text-center">Jenis</div>
              <div className="col-span-1 text-center">Nilai</div>
              <div className="col-span-2 text-right">Aksi</div>
            </div>

            <div className="divide-y divide-slate-800/60">
              {filtered.map((item) => {
                const halaman = getHalamanSetoran(item, surahMap, halamanMap);
                const totalAyat = hitungTotalAyatSetoran(item, surahMap);
                const isPerAyat = setoranAyatIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-800/30 transition"
                  >
                    {/* Siswa */}
                    <div className="md:col-span-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <User size={14} className="text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {item.siswa?.nama_lengkap ?? '—'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {item.siswa?.kelas?.nama_kelas ?? '-'} ·{' '}
                          {item.siswa?.nisn ?? '-'}
                        </p>
                      </div>
                    </div>

                    {/* Tanggal */}
                    <div className="md:col-span-2 flex md:items-center text-xs text-slate-400">
                      <Calendar size={12} className="mr-1 text-slate-500" />
                      {formatTanggalShort(item.tanggal)}
                    </div>

                    {/* Hafalan */}
                    <div className="md:col-span-3 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <p className="text-xs text-slate-200 truncate">
                          {formatRentangHafalan(item, surahMap)}
                        </p>
                        {isPerAyat && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[9px] font-bold shrink-0">
                            <BookOpen size={8} /> Per Ayat
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {totalAyat} ayat · {formatHalaman(halaman)} halaman
                      </p>
                    </div>

                    {/* Jenis */}
                    <div className="md:col-span-1 flex md:justify-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${getJenisSetoranBadge(item.jenis)}`}
                      >
                        {item.jenis}
                      </span>
                    </div>

                    {/* Nilai + Kualitas */}
                    <div className="md:col-span-1 flex md:flex-col items-center md:justify-center gap-1">
                      <span
                        className={`text-sm font-extrabold ${getNilaiBadge(item.nilai)}`}
                      >
                        {item.nilai ?? '—'}
                      </span>
                      {item.kualitas && (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${getKualitasBadge(item.kualitas)}`}
                        >
                          {item.kualitas}
                        </span>
                      )}
                    </div>

                    {/* Aksi */}
                    <div className="md:col-span-2 flex items-center md:justify-end gap-1">
                      {/* ✅ Edit button — disable kalau per-ayat */}
                      {isPerAyat ? (
                        <button
                          disabled
                          className="p-1.5 rounded-lg text-slate-600 opacity-40 cursor-not-allowed"
                          title="Setoran per ayat tidak bisa diedit (hapus & buat ulang)"
                        >
                          <Pencil size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                      )}

                      {isManager && (
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
              Menampilkan {filtered.length} dari {list.length} setoran
            </div>
          </>
        )}
      </div>

      {/* MODAL RENTANG */}
      <ModalSetoran
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        onSaved={handleSaved}
        surahMap={surahMap}
        halamanMap={halamanMap}
        editTarget={editTarget}
        currentGuruId={guru?.id ?? null}
      />

      {/* MODAL PER AYAT */}
      <ModalSetoranAyat
        open={modalAyatOpen}
        onClose={() => setModalAyatOpen(false)}
        onSaved={handleSavedAyat}
        surahMap={surahMap}
        halamanMap={halamanMap}
        currentGuruId={guru?.id ?? null}
      />
    </div>
  );
}