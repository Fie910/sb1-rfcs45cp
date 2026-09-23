// src/components/perpustakaan/OPACTab.tsx
// OPAC — Online Public Access Catalog (katalog publik).

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Book, X, Library, LayoutGrid, List, Hash, User,
  Building2, BookOpen, CheckCircle2, XCircle, Eye, Filter,
  Newspaper, Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import {
  getKondisiBukuBadge, getJenisSerialBadge, getJenisSerialIcon,
  formatDateShort, INPUT_CLASS,
} from './shared';
import type {
  PerpusBukuWithRelations, PerpusSerialWithRelations,
  PerpusKategori, PerpusRak,
} from '@/types/database';

type SearchMode = 'buku' | 'serial' | 'semua';
type ViewMode = 'grid' | 'table';

type OPACItem =
  | ({ _type: 'buku' } & PerpusBukuWithRelations)
  | ({ _type: 'serial' } & PerpusSerialWithRelations);

export function OPACTab() {
  const [bukuList, setBukuList] = useState<PerpusBukuWithRelations[]>([]);
  const [serialList, setSerialList] = useState<PerpusSerialWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<PerpusKategori[]>([]);
  const [rakList, setRakList] = useState<PerpusRak[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('buku');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterRak, setFilterRak] = useState('');
  const [filterKetersediaan, setFilterKetersediaan] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Detail
  const [detailTarget, setDetailTarget] = useState<OPACItem | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bukuRes, serialRes, katRes, rakRes] = await Promise.all([
        supabase.from('perpus_buku').select(`
          *, kategori:kategori_id (id, nama, kode_dewey, warna),
          rak:rak_id (id, nama, lokasi)
        `).eq('is_aktif', true).order('judul'),
        supabase.from('perpus_serial').select(`
          *, rak:rak_id (id, nama, lokasi)
        `).eq('is_aktif', true).order('tanggal_terbit', { ascending: false }),
        supabase.from('perpus_kategori').select('*').order('kode_dewey'),
        supabase.from('perpus_rak').select('*').eq('is_aktif', true).order('nama'),
      ]);

      if (bukuRes.error) throw bukuRes.error;

      setBukuList((bukuRes.data as unknown as PerpusBukuWithRelations[]) || []);
      setSerialList((serialRes.data as unknown as PerpusSerialWithRelations[]) || []);
      setKategoriList((katRes.data as PerpusKategori[]) || []);
      setRakList((rakRes.data as PerpusRak[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat katalog: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // SEARCH LOGIC
  // ==========================================================================
  const filteredItems: OPACItem[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: OPACItem[] = [];

    const matchBuku = searchMode === 'buku' || searchMode === 'semua';
    const matchSerial = searchMode === 'serial' || searchMode === 'semua';

    if (matchBuku) {
      bukuList.forEach((b) => {
        if (filterKategori && b.kategori_id !== filterKategori) return;
        if (filterRak && b.rak_id !== filterRak) return;
        if (filterKetersediaan === 'tersedia' && b.jumlah_tersedia <= 0) return;
        if (filterKetersediaan === 'habis' && b.jumlah_tersedia > 0) return;

        if (q) {
          const hit =
            b.judul.toLowerCase().includes(q) ||
            (b.pengarang ?? '').toLowerCase().includes(q) ||
            (b.penerbit ?? '').toLowerCase().includes(q) ||
            (b.isbn ?? '').toLowerCase().includes(q) ||
            (b.kode_buku ?? '').toLowerCase().includes(q) ||
            (b.kategori?.nama ?? '').toLowerCase().includes(q);
          if (!hit) return;
        }
        result.push({ _type: 'buku', ...b });
      });
    }

    if (matchSerial) {
      serialList.forEach((s) => {
        if (filterKategori || filterRak || filterKetersediaan) return; // filter tidak berlaku untuk serial
        if (q) {
          const hit =
            s.nama.toLowerCase().includes(q) ||
            (s.penerbit ?? '').toLowerCase().includes(q) ||
            (s.edisi ?? '').toLowerCase().includes(q);
          if (!hit) return;
        }
        result.push({ _type: 'serial', ...s });
      });
    }

    return result;
  }, [bukuList, serialList, search, searchMode, filterKategori, filterRak, filterKetersediaan]);

  const stats = useMemo(() => ({
    buku: bukuList.length,
    serial: serialList.length,
    tersedia: bukuList.filter((b) => b.jumlah_tersedia > 0).length,
  }), [bukuList, serialList]);

  const resetFilter = () => {
    setSearch(''); setFilterKategori(''); setFilterRak(''); setFilterKetersediaan('');
  };
  const hasFilter = search || filterKategori || filterRak || filterKetersediaan;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Search className="text-indigo-400" size={20} /> Katalog Publik (OPAC)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pencarian buku & serial — terbuka untuk semua warga sekolah
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['buku', 'serial', 'semua'] as SearchMode[]).map((m) => (
            <button key={m} onClick={() => setSearchMode(m)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                searchMode === m
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}>
              {m === 'buku' ? '📚 Buku' : m === 'serial' ? '📰 Serial' : '🌐 Semua'}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH HERO */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 space-y-4">
        <div className="text-center">
          <h3 className="text-base font-bold text-slate-100">
            Cari koleksi perpustakaan
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.buku} judul buku · {stats.serial} serial · {stats.tersedia} buku tersedia
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
          <input type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik judul, pengarang, ISBN, atau kata kunci..."
            className="w-full pl-12 pr-10 py-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition text-sm" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition cursor-pointer">
              <X size={16} />
            </button>
          )}
        </div>

        {/* FILTER CHIPS */}
        {searchMode !== 'serial' && (
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer focus:outline-none focus:border-indigo-500">
              <option value="">Semua Kategori</option>
              {kategoriList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.kode_dewey ? `[${k.kode_dewey}] ` : ''}{k.nama}
                </option>
              ))}
            </select>

            <select value={filterRak} onChange={(e) => setFilterRak(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer focus:outline-none focus:border-indigo-500">
              <option value="">Semua Rak</option>
              {rakList.map((r) => <option key={r.id} value={r.id}>{r.nama}</option>)}
            </select>

            <select value={filterKetersediaan} onChange={(e) => setFilterKetersediaan(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer focus:outline-none focus:border-indigo-500">
              <option value="">Semua Ketersediaan</option>
              <option value="tersedia">Tersedia</option>
              <option value="habis">Habis Dipinjam</option>
            </select>

            {hasFilter && (
              <button onClick={resetFilter}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer">
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* RESULT COUNT + VIEW MODE */}
      {!loading && filteredItems.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-400">
            <span className="text-indigo-400 font-bold">{filteredItems.length}</span> hasil ditemukan
          </p>
          <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>
              <List size={14} />
            </button>
          </div>
        </div>
      )}

      {/* RESULT */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          <div className="animate-pulse">Memuat katalog...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Search size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada hasil ditemukan' : 'Mulai cari koleksi'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {hasFilter
              ? 'Coba ubah kata kunci atau reset filter.'
              : 'Ketik judul buku, pengarang, atau topik di kolom pencarian di atas.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <OPACCard key={`${item._type}-${item.id}`} item={item} onDetail={setDetailTarget} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Tipe</th>
                  <th className="text-left px-4 py-3">Judul</th>
                  <th className="text-left px-4 py-3">Pengarang/Penerbit</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-center px-4 py-3">Ketersediaan</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => (
                  <tr key={`${item._type}-${item.id}`}
                    className="hover:bg-slate-800/30 transition group cursor-pointer"
                    onClick={() => setDetailTarget(item)}>
                    <td className="px-4 py-3">
                      {item._type === 'buku' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                          <Book size={10} /> Buku
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisSerialBadge(item.jenis)}`}>
                          {(() => { const I = getJenisSerialIcon(item.jenis); return <I size={10} />; })()}
                          {item.jenis}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100 text-xs">
                        {item._type === 'buku' ? item.judul : item.nama}
                      </p>
                      {item._type === 'buku' && item.kode_buku && (
                        <p className="text-[10px] font-mono text-indigo-400">{item.kode_buku}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {item._type === 'buku' ? (
                        <>
                          <p className="truncate max-w-[180px]">{item.pengarang ?? '-'}</p>
                          <p className="truncate max-w-[180px] text-[10px]">{item.penerbit ?? '-'}</p>
                        </>
                      ) : (
                        <p className="truncate max-w-[180px]">{item.penerbit ?? '-'}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item._type === 'buku' && item.kategori ? (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {item.kategori.kode_dewey ?? ''} {item.kategori.nama}
                        </span>
                      ) : item._type === 'serial' ? (
                        <span className="text-[10px] text-slate-500">{item.edisi ?? '-'}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item._type === 'buku' ? (
                        item.jumlah_tersedia > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 size={10} /> {item.jumlah_tersedia} tersedia
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle size={10} /> Habis
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          {item.jumlah} eksemplar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Eye size={14} className="inline text-slate-400 group-hover:text-indigo-400 transition" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title={detailTarget?._type === 'buku' ? 'Detail Buku' : 'Detail Serial'} size="md">
        {detailTarget && detailTarget._type === 'buku' && <BukuDetail buku={detailTarget} />}
        {detailTarget && detailTarget._type === 'serial' && <SerialDetail serial={detailTarget} />}
      </Modal>
    </div>
  );
}

// =============================================================================
// OPAC CARD (GRID)
// =============================================================================
function OPACCard({ item, onDetail }: { item: OPACItem; onDetail: (i: OPACItem) => void }) {
  if (item._type === 'buku') {
    return (
      <div onClick={() => onDetail(item)}
        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all group cursor-pointer">
        <div className="aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden relative">
          {item.cover_url ? (
            <img src={item.cover_url} alt={item.judul}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="flex flex-col items-center text-slate-700 p-4">
              <Book size={48} />
              <p className="text-[10px] mt-2 text-center line-clamp-2">{item.judul}</p>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border backdrop-blur ${
              item.jumlah_tersedia > 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {item.jumlah_tersedia > 0 ? `${item.jumlah_tersedia} tersedia` : 'Habis'}
            </span>
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          {item.kode_buku && (
            <p className="text-[9px] font-mono text-indigo-400 truncate">{item.kode_buku}</p>
          )}
          <h3 className="font-bold text-slate-100 text-xs leading-tight line-clamp-2 min-h-[2rem]">
            {item.judul}
          </h3>
          <p className="text-[10px] text-slate-500 truncate">{item.pengarang ?? 'Tanpa pengarang'}</p>
          {item.kategori && (
            <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {item.kategori.kode_dewey ?? ''} {item.kategori.nama}
            </span>
          )}
        </div>
      </div>
    );
  }

  // SERIAL
  const JenisIcon = getJenisSerialIcon(item.jenis);
  return (
    <div onClick={() => onDetail(item)}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-indigo-500/40 transition-all group cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${getJenisSerialBadge(item.jenis)}`}>
          <JenisIcon size={20} />
        </div>
        <div className="min-w-0">
          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisSerialBadge(item.jenis)}`}>
            {item.jenis}
          </span>
          <p className="text-[10px] text-slate-500 mt-1 truncate">{item.edisi ?? 'Tanpa edisi'}</p>
        </div>
      </div>
      <h3 className="font-bold text-slate-100 text-sm leading-tight line-clamp-2 mb-2">
        {item.nama}
      </h3>
      {item.penerbit && <p className="text-[11px] text-slate-500 truncate">{item.penerbit}</p>}
      {item.tanggal_terbit && (
        <p className="text-[10px] text-slate-500 mt-1">
          {formatDateShort(item.tanggal_terbit)}
        </p>
      )}
      <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
        <span className="text-slate-500 uppercase font-bold">Eksemplar</span>
        <span className="font-extrabold text-indigo-400">{item.jumlah}</span>
      </div>
    </div>
  );
}

// =============================================================================
// DETAIL VIEWS
// =============================================================================
function BukuDetail({ buku }: { buku: PerpusBukuWithRelations }) {
  return (
    <div className="space-y-4 pt-1">
      <div className="flex gap-4">
        <div className="w-28 h-40 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center shrink-0">
          {buku.cover_url ? (
            <img src={buku.cover_url} alt={buku.judul} className="w-full h-full object-cover" />
          ) : (
            <Book size={36} className="text-slate-600" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            {buku.kode_buku && (
              <p className="text-[10px] font-mono font-bold text-indigo-400">{buku.kode_buku}</p>
            )}
            <h3 className="font-bold text-slate-100 text-base leading-tight mt-0.5">{buku.judul}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {buku.kategori && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {buku.kategori.kode_dewey ?? ''} {buku.kategori.nama}
              </span>
            )}
            {buku.jumlah_tersedia > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                <CheckCircle2 size={10} /> Tersedia
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                <XCircle size={10} /> Habis Dipinjam
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs text-slate-400">
            {buku.pengarang && <p className="flex items-center gap-1.5"><User size={11} className="text-slate-500" />{buku.pengarang}</p>}
            {buku.penerbit && <p className="flex items-center gap-1.5"><Building2 size={11} className="text-slate-500" />{buku.penerbit}{buku.tahun_terbit && ` · ${buku.tahun_terbit}`}</p>}
            {buku.isbn && <p className="flex items-center gap-1.5 font-mono"><Hash size={11} className="text-slate-500" />{buku.isbn}</p>}
            {buku.rak && <p className="flex items-center gap-1.5"><Library size={11} className="text-slate-500" />{buku.rak.nama}{buku.rak.lokasi && ` · ${buku.rak.lokasi}`}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatBox label="Total" value={buku.jumlah_total} color="text-slate-200" />
        <StatBox label="Tersedia" value={buku.jumlah_tersedia} color="text-emerald-400" />
        <StatBox label="Dipinjam" value={buku.jumlah_total - buku.jumlah_tersedia} color="text-amber-400" />
      </div>

      {buku.sinopsis && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Sinopsis</p>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{buku.sinopsis}</p>
        </div>
      )}
    </div>
  );
}

function SerialDetail({ serial }: { serial: PerpusSerialWithRelations }) {
  const JenisIcon = getJenisSerialIcon(serial.jenis);
  return (
    <div className="space-y-4 pt-1">
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${getJenisSerialBadge(serial.jenis)}`}>
            <JenisIcon size={26} />
          </div>
          <div className="min-w-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getJenisSerialBadge(serial.jenis)}`}>
              {serial.jenis}
            </span>
            <p className="font-bold text-slate-100 text-base mt-1 leading-tight">{serial.nama}</p>
            {serial.edisi && <p className="text-[11px] text-slate-400 mt-0.5">{serial.edisi}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-xs">
        {serial.penerbit && <StatBox label="Penerbit" value={serial.penerbit} color="text-slate-200" />}
        {serial.tanggal_terbit && <StatBox label="Tgl Terbit" value={formatDateShort(serial.tanggal_terbit)} color="text-slate-200" />}
        <StatBox label="Jumlah" value={String(serial.jumlah)} color="text-indigo-400" />
        {serial.rak && <StatBox label="Rak" value={serial.rak.nama} color="text-slate-200" />}
      </div>

      {serial.keterangan && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Keterangan</p>
          <p className="text-xs text-slate-300 leading-relaxed">{serial.keterangan}</p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm font-extrabold truncate ${color}`}>{value}</p>
    </div>
  );
}