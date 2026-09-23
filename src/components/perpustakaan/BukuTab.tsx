// src/components/perpustakaan/BukuTab.tsx
// Tab Katalog Buku — manajemen buku perpustakaan.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Book, Pencil, Trash2, Eye, Filter,
  Settings, Library, Hash, BookOpen, TrendingUp, ExternalLink,
  LayoutGrid, List, User, Building2, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalBuku } from './ModalBuku';
import { KategoriManagerModal } from './KategoriManagerModal';
import { RakManagerModal } from './RakManagerModal';
import {
  getKondisiBukuBadge, isPustakawan, formatDateShort,
  INPUT_CLASS, KONDISI_BUKU_OPTIONS,
} from './shared';
import type {
  PerpusBuku, PerpusBukuWithRelations, PerpusKategori, PerpusRak,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

export function BukuTab() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const [list, setList] = useState<PerpusBukuWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<PerpusKategori[]>([]);
  const [rakList, setRakList] = useState<PerpusRak[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterRak, setFilterRak] = useState('');
  const [filterKondisi, setFilterKondisi] = useState('');
  const [filterTersedia, setFilterTersedia] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PerpusBuku | null>(null);
  const [kategoriModalOpen, setKategoriModalOpen] = useState(false);
  const [rakModalOpen, setRakModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PerpusBukuWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerpusBukuWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bukuRes, kategoriRes, rakRes] = await Promise.all([
        supabase.from('perpus_buku').select(`
          *,
          kategori:kategori_id (id, nama, kode_dewey, warna),
          rak:rak_id (id, nama, lokasi)
        `).order('created_at', { ascending: false }),
        supabase.from('perpus_kategori').select('*').order('kode_dewey'),
        supabase.from('perpus_rak').select('*').eq('is_aktif', true).order('nama'),
      ]);

      if (bukuRes.error) throw bukuRes.error;

      setList((bukuRes.data as unknown as PerpusBukuWithRelations[]) || []);
      setKategoriList((kategoriRes.data as PerpusKategori[]) || []);
      setRakList((rakRes.data as PerpusRak[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat data buku: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTERED + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((b) => {
      if (filterKategori && b.kategori_id !== filterKategori) return false;
      if (filterRak && b.rak_id !== filterRak) return false;
      if (filterKondisi && b.kondisi !== filterKondisi) return false;
      if (filterTersedia === 'tersedia' && b.jumlah_tersedia <= 0) return false;
      if (filterTersedia === 'habis' && b.jumlah_tersedia > 0) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          b.judul.toLowerCase().includes(q) ||
          (b.pengarang ?? '').toLowerCase().includes(q) ||
          (b.penerbit ?? '').toLowerCase().includes(q) ||
          (b.kode_buku ?? '').toLowerCase().includes(q) ||
          (b.isbn ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterKategori, filterRak, filterKondisi, filterTersedia, search]);

  const stats = useMemo(() => {
    const totalJudul = list.length;
    const totalEksemplar = list.reduce((s, b) => s + b.jumlah_total, 0);
    const totalTersedia = list.reduce((s, b) => s + b.jumlah_tersedia, 0);
    const totalDipinjam = totalEksemplar - totalTersedia;
    const rusak = list.filter((b) => b.kondisi !== 'Baik').length;
    return { totalJudul, totalEksemplar, totalTersedia, totalDipinjam, rusak };
  }, [list]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: PerpusBukuWithRelations) => {
    setEditingItem(item as PerpusBuku);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('perpus_buku').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: MODUL_PERPUS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus buku: ${deleteTarget.judul} (${deleteTarget.kode_buku})`,
      });

      showToast('success', 'Buku dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => {
    setSearch('');
    setFilterKategori('');
    setFilterRak('');
    setFilterKondisi('');
    setFilterTersedia('');
  };

  const hasFilter = search || filterKategori || filterRak || filterKondisi || filterTersedia;

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Kode', 'Judul', 'Pengarang', 'Penerbit', 'Tahun', 'ISBN',
    'Kategori', 'Rak', 'Total', 'Tersedia', 'Kondisi',
  ];
  const exportRows = filtered.map((b) => [
    b.kode_buku ?? '-',
    b.judul,
    b.pengarang ?? '-',
    b.penerbit ?? '-',
    b.tahun_terbit ?? '-',
    b.isbn ?? '-',
    b.kategori?.nama ?? '-',
    b.rak?.nama ?? '-',
    b.jumlah_total,
    b.jumlah_tersedia,
    b.kondisi,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Book className="text-indigo-400" size={20} /> Katalog Buku
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} buku ditampilkan
          </p>
        </div>

        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setKategoriModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 font-bold text-xs transition-colors cursor-pointer"
            >
              <Settings size={14} /> Kategori
            </button>
            <button
              onClick={() => setRakModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 font-bold text-xs transition-colors cursor-pointer"
            >
              <Library size={14} /> Rak
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Tambah Buku
            </button>
          </div>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Book} label="Judul Buku" value={stats.totalJudul} color="indigo" />
        <KpiCard icon={Library} label="Total Eksemplar" value={stats.totalEksemplar} color="purple" />
        <KpiCard icon={BookOpen} label="Tersedia" value={stats.totalTersedia} color="emerald" />
        <KpiCard icon={TrendingUp} label="Sedang Dipinjam" value={stats.totalDipinjam} color="amber" />
        <KpiCard icon={X} label="Rusak" value={stats.rusak} color="rose" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter & Pencarian
          </div>
          {hasFilter && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, pengarang, kode, ISBN..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>

          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs`}
          >
            <option value="">Semua Kategori</option>
            {kategoriList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.kode_dewey ? `[${k.kode_dewey}] ` : ''}{k.nama}
              </option>
            ))}
          </select>

          <select
            value={filterRak}
            onChange={(e) => setFilterRak(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs`}
          >
            <option value="">Semua Rak</option>
            {rakList.map((r) => (
              <option key={r.id} value={r.id}>{r.nama}</option>
            ))}
          </select>

          <select
            value={filterKondisi}
            onChange={(e) => setFilterKondisi(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs`}
          >
            <option value="">Semua Kondisi</option>
            {KONDISI_BUKU_OPTIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>

          <select
            value={filterTersedia}
            onChange={(e) => setFilterTersedia(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer text-xs`}
          >
            <option value="">Semua Status</option>
            <option value="tersedia">Tersedia</option>
            <option value="habis">Habis Dipinjam</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Grid"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tampilan Tabel"
            >
              <List size={14} />
            </button>
          </div>

          <ExportImportButtons
            filename={`katalog_buku_${new Date().toISOString().slice(0, 10)}`}
            title="Katalog Buku Perpustakaan"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat katalog buku...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Book size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada buku yang cocok' : 'Belum ada buku terdaftar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Tambah Buku" untuk memulai.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        // ==================== GRID VIEW ====================
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all group cursor-pointer"
              onClick={() => setDetailTarget(b)}
            >
              {/* COVER */}
              <div className="aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden relative">
                {b.cover_url ? (
                  <img
                    src={b.cover_url}
                    alt={b.judul}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-700 p-4">
                    <Book size={48} />
                    <p className="text-[10px] mt-2 text-center line-clamp-2">{b.judul}</p>
                  </div>
                )}

                {/* STOK BADGE */}
                <div className="absolute top-2 right-2">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur ${
                    b.jumlah_tersedia > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {b.jumlah_tersedia > 0 ? `${b.jumlah_tersedia} tersedia` : 'Habis'}
                  </span>
                </div>

                {/* CONDITION BADGE */}
                {b.kondisi !== 'Baik' && (
                  <div className="absolute top-2 left-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur ${getKondisiBukuBadge(b.kondisi)}`}>
                      {b.kondisi}
                    </span>
                  </div>
                )}
              </div>

              {/* INFO */}
              <div className="p-3 space-y-1.5">
                <p className="text-[9px] font-mono text-indigo-400 truncate">
                  {b.kode_buku ?? '-'}
                </p>
                <h3 className="font-bold text-slate-100 text-xs leading-tight line-clamp-2 min-h-[2rem]">
                  {b.judul}
                </h3>
                <p className="text-[10px] text-slate-500 truncate">
                  {b.pengarang ?? 'Tanpa pengarang'}
                </p>
                {b.kategori && (
                  <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {b.kategori.kode_dewey ?? ''} {b.kategori.nama}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS (Manager only) */}
              {isManager && (
                <div className="px-3 pb-3 flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(b); }}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition cursor-pointer"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // ==================== TABLE VIEW ====================
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Buku</th>
                  <th className="text-left px-4 py-3">Pengarang & Penerbit</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-left px-4 py-3">Rak</th>
                  <th className="text-center px-4 py-3">Stok</th>
                  <th className="text-left px-4 py-3">Kondisi</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-14 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                          {b.cover_url ? (
                            <img src={b.cover_url} alt={b.judul} className="w-full h-full object-cover" />
                          ) : (
                            <Book size={16} className="text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-100 text-xs truncate max-w-[200px]">{b.judul}</p>
                          <p className="text-[10px] font-mono text-indigo-400">{b.kode_buku ?? '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-300 truncate max-w-[180px]">{b.pengarang ?? '-'}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{b.penerbit ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {b.kategori ? (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {b.kategori.kode_dewey ?? ''} {b.kategori.nama}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-300">{b.rak?.nama ?? '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className={`text-base font-extrabold ${
                          b.jumlah_tersedia > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {b.jumlah_tersedia}/{b.jumlah_total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getKondisiBukuBadge(b.kondisi)}`}>
                        {b.kondisi}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDetailTarget(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye size={14} />
                        </button>
                        {isManager && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(b)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(b)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL FORM ==================== */}
      <ModalBuku
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        buku={editingItem}
        kategoriList={kategoriList}
        rakList={rakList}
        onSaved={fetchAll}
      />

      {/* ==================== MODAL KATEGORI ==================== */}
      <KategoriManagerModal
        open={kategoriModalOpen}
        onClose={() => setKategoriModalOpen(false)}
        kategoriList={kategoriList}
        onChanged={fetchAll}
      />

      {/* ==================== MODAL RAK ==================== */}
      <RakManagerModal
        open={rakModalOpen}
        onClose={() => setRakModalOpen(false)}
        rakList={rakList}
        onChanged={fetchAll}
      />

      {/* ==================== MODAL DETAIL ==================== */}
      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title="Detail Buku"
        size="lg"
      >
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className="flex gap-4">
              {/* Cover */}
              <div className="w-32 h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shrink-0">
                {detailTarget.cover_url ? (
                  <img src={detailTarget.cover_url} alt={detailTarget.judul} className="w-full h-full object-cover" />
                ) : (
                  <Book size={40} className="text-slate-600" />
                )}
              </div>

              {/* Info Utama */}
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] font-mono font-bold text-indigo-400">
                    {detailTarget.kode_buku ?? '-'}
                  </p>
                  <h3 className="font-bold text-slate-100 text-base leading-tight mt-0.5">
                    {detailTarget.judul}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {detailTarget.kategori && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                      {detailTarget.kategori.kode_dewey ?? ''} {detailTarget.kategori.nama}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md border ${getKondisiBukuBadge(detailTarget.kondisi)} font-bold`}>
                    {detailTarget.kondisi}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md border font-bold ${
                    detailTarget.jumlah_tersedia > 0
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {detailTarget.jumlah_tersedia > 0 ? 'Tersedia' : 'Habis Dipinjam'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 pt-1">
                  {detailTarget.pengarang && (
                    <p className="flex items-center gap-1.5">
                      <User size={11} className="text-slate-500" />
                      {detailTarget.pengarang}
                    </p>
                  )}
                  {detailTarget.penerbit && (
                    <p className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-slate-500" />
                      {detailTarget.penerbit}
                      {detailTarget.tahun_terbit && ` · ${detailTarget.tahun_terbit}`}
                    </p>
                  )}
                  {detailTarget.isbn && (
                    <p className="flex items-center gap-1.5 font-mono">
                      <Hash size={11} className="text-slate-500" />
                      ISBN: {detailTarget.isbn}
                    </p>
                  )}
                  {detailTarget.rak && (
                    <p className="flex items-center gap-1.5">
                      <Library size={11} className="text-slate-500" />
                      {detailTarget.rak.nama}
                      {detailTarget.rak.lokasi && ` · ${detailTarget.rak.lokasi}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Mini */}
            <div className="grid grid-cols-3 gap-2.5">
              <DetailBox label="Total Eksemplar" value={String(detailTarget.jumlah_total)} />
              <DetailBox label="Tersedia" value={String(detailTarget.jumlah_tersedia)} valueClass="text-emerald-400" />
              <DetailBox label="Dipinjam" value={String(detailTarget.jumlah_total - detailTarget.jumlah_tersedia)} valueClass="text-amber-400" />
            </div>

            {/* Sinopsis */}
            {detailTarget.sinopsis && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sinopsis</p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {detailTarget.sinopsis}
                </p>
              </div>
            )}

            {/* Catatan */}
            {detailTarget.catatan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Catatan</p>
                <p className="text-xs text-slate-300 leading-relaxed">{detailTarget.catatan}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button
                onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Buku"
        message={`Yakin hapus buku "${deleteTarget?.judul}" (${deleteTarget?.kode_buku})? Semua riwayat peminjaman buku ini akan ikut terhapus.`}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
type KpiColor = 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Book; label: string; value: number; color: KpiColor;
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

function DetailBox({ label, value, valueClass = 'text-slate-200' }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-extrabold ${valueClass}`}>{value}</p>
    </div>
  );
}