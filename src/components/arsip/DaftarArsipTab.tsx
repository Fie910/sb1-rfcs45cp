// src/components/arsip/DaftarArsipTab.tsx
// Tab Daftar Arsip — grid/list dokumen dengan filter & search.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, FolderArchive, Search, Filter, X, Eye, Download,
  FileText, Image as ImageIcon, Sheet, Folder, Plus, Grid3x3,
  List, Calendar, HardDrive, TrendingUp, AlertTriangle, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ModalDetailArsip } from './ModalDetailArsip';
import { ModalUploadArsip } from './ModalUploadArsip';
import {
  getStatusDokumenBadge, getKategoriBadge, getAksesLevelBadge,
  getStorageProviderBadge, getRetensiBadge, formatFileSize, formatTanggalArsip,
  isArsipManager,
  INPUT_CLASS,
} from './shared';
import type {
  ArsipWithRelations, ArsipKategori, Guru,
} from '@/types/database';

type ViewMode = 'grid' | 'list';

export function DaftarArsipTab() {
  const { guru } = useAuth();
  const isManager = isArsipManager(guru?.role);

  const [list, setList] = useState<ArsipWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<ArsipKategori[]>([]);
  const [guruList, setGuruList] = useState<Pick<Guru, 'id' | 'nama_lengkap' | 'nip'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAkses, setFilterAkses] = useState('');
  const [showExpiringOnly, setShowExpiringOnly] = useState(false);

  // Modals
  const [detailTarget, setDetailTarget] = useState<ArsipWithRelations | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guru?.id) return;
    setLoading(true);
    try {
      const [dokRes, katRes, guruRes] = await Promise.all([
        supabase
          .from('v_arsip_lengkap')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
        supabase
          .from('arsip_kategori')
          .select('*')
          .eq('is_aktif', true)
          .order('urutan_tampil'),
        supabase
          .from('gurus')
          .select('id, nama_lengkap, nip')
          .order('nama_lengkap'),
      ]);

      if (dokRes.error) throw dokRes.error;

      setList((dokRes.data as ArsipWithRelations[]) ?? []);
      setKategoriList((katRes.data as ArsipKategori[]) ?? []);
      setGuruList((guruRes.data as any[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat arsip: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guru?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((d) => {
      if (filterKategori && d.kategori_id !== filterKategori) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterAkses && d.kategori_akses_level !== filterAkses) return false;

      if (showExpiringOnly) {
        const badge = getRetensiBadge(d.tanggal_retensi);
        if (!badge) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          d.judul.toLowerCase().includes(q) ||
          (d.nomor_dokumen ?? '').toLowerCase().includes(q) ||
          (d.deskripsi ?? '').toLowerCase().includes(q) ||
          (d.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterKategori, filterStatus, filterAkses, showExpiringOnly, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const aktif = list.filter((d) => d.status === 'Aktif').length;
    const draft = list.filter((d) => d.status === 'Draft').length;
    const obsolete = list.filter((d) => d.status === 'Obsolete').length;
    const expiring = list.filter((d) => getRetensiBadge(d.tanggal_retensi) !== null).length;
    const totalBytes = list.reduce((sum, d) => sum + (d.file_size ?? 0), 0);
    return { total, aktif, draft, obsolete, expiring, totalBytes };
  }, [list]);

  const resetFilter = () => {
    setSearch('');
    setFilterKategori('');
    setFilterStatus('');
    setFilterAkses('');
    setShowExpiringOnly(false);
  };
  const hasFilter = search || filterKategori || filterStatus || filterAkses || showExpiringOnly;

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <FolderArchive className="text-indigo-400" size={20} /> Daftar Arsip
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} dokumen · {formatFileSize(stats.totalBytes)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Grid view"
            >
              <Grid3x3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
          >
            <Plus size={16} /> Upload Dokumen
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={FolderArchive} label="Total" value={stats.total} color="indigo" />
        <KpiCard icon={Star} label="Aktif" value={stats.aktif} color="emerald" />
        <KpiCard icon={FileText} label="Draft" value={stats.draft} color="slate" />
        <KpiCard icon={AlertTriangle} label="Obsolete" value={stats.obsolete} color="amber" />
        <KpiCard icon={HardDrive} label="Akan Retensi" value={stats.expiring} color="rose" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, nomor, tag..."
              className={INPUT_CLASS + ' pl-10'}
            />
          </div>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Kategori</option>
            {kategoriList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Status</option>
            <option value="Draft">Draft</option>
            <option value="Aktif">Aktif</option>
            <option value="Obsolete">Obsolete</option>
            <option value="Dicabut">Dicabut</option>
            <option value="Selesai">Selesai</option>
          </select>
          <select
            value={filterAkses}
            onChange={(e) => setFilterAkses(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Akses</option>
            <option value="Public">Public</option>
            <option value="Internal">Internal</option>
            <option value="Confidential">Confidential</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowExpiringOnly(!showExpiringOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
              showExpiringOnly
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400'
            }`}
          >
            <AlertTriangle size={11} /> Hanya yang akan retensi
          </button>
        </div>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <FolderArchive size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada dokumen cocok' : 'Belum ada dokumen'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba ubah filter' : 'Klik "Upload Dokumen" untuk memulai'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <ArsipCardGrid
              key={item.id}
              item={item}
              onDetail={() => setDetailTarget(item)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Dokumen</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-center px-4 py-3">Versi</th>
                  <th className="text-center px-4 py-3">Ukuran</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((item) => (
                  <ArsipRowList
                    key={item.id}
                    item={item}
                    onDetail={() => setDetailTarget(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      <ModalDetailArsip
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onRefresh={fetchAll}
        dokumen={detailTarget}
        kategoriList={kategoriList}
        guruList={guruList}
        currentGuruId={guru?.id ?? ''}
        currentGuruRole={guru?.role}
      />

      {/* MODAL UPLOAD */}
      <ModalUploadArsip
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSaved={fetchAll}
        kategoriList={kategoriList}
        guruList={guruList}
        currentGuruId={guru?.id ?? ''}
      />
    </div>
  );
}

// =============================================================================
// SUB: Grid Card
// =============================================================================
function ArsipCardGrid({
  item, onDetail,
}: {
  item: ArsipWithRelations;
  onDetail: () => void;
}) {
  const retensiBadge = getRetensiBadge(item.tanggal_retensi);
  const FileIcon = getFileIconComponent(item.file_type);

  return (
    <div
      className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer group overflow-hidden flex flex-col"
      onClick={onDetail}
    >
      {/* Thumbnail area */}
      <div className={`h-28 flex items-center justify-center border-b border-slate-800 ${
        item.file_type === 'application/pdf'
          ? 'bg-gradient-to-br from-rose-950/30 to-slate-900'
          : item.file_type?.startsWith('image/')
          ? 'bg-gradient-to-br from-emerald-950/30 to-slate-900'
          : 'bg-gradient-to-br from-indigo-950/30 to-slate-900'
      }`}>
        <FileIcon size={42} className={
          item.file_type === 'application/pdf'
            ? 'text-rose-400'
            : item.file_type?.startsWith('image/')
            ? 'text-emerald-400'
            : 'text-indigo-400'
        } />
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getKategoriBadge(item.kategori_warna)}`}>
            {item.kategori_nama}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusDokumenBadge(item.status)}`}>
            {item.status}
          </span>
        </div>

        <p className="text-sm font-bold text-slate-100 truncate mb-1">
          {item.judul}
        </p>
        <p className="text-[10px] font-mono text-indigo-400 truncate mb-2">
          {item.nomor_dokumen ?? '-'}
        </p>

        {item.deskripsi && (
          <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
            {item.deskripsi}
          </p>
        )}

        <div className="mt-auto pt-2 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <FileText size={9} /> v{item.versi_aktif_nomor ?? 1}
            </span>
            <span className="inline-flex items-center gap-1">
              <HardDrive size={9} /> {formatFileSize(item.file_size)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye size={9} /> {item.total_views ?? 0}
            </span>
          </div>

          {retensiBadge && (
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${retensiBadge.style}`}>
              <AlertTriangle size={8} /> Retensi: {retensiBadge.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: List Row
// =============================================================================
function ArsipRowList({
  item, onDetail,
}: {
  item: ArsipWithRelations;
  onDetail: () => void;
}) {
  const retensiBadge = getRetensiBadge(item.tanggal_retensi);

  return (
    <tr className="hover:bg-slate-800/30 transition">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-200 truncate max-w-[300px]">
            {item.judul}
          </p>
          <p className="text-[10px] font-mono text-indigo-400">
            {item.nomor_dokumen ?? '-'}
          </p>
          {retensiBadge && (
            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1 ${retensiBadge.style}`}>
              <AlertTriangle size={8} /> Retensi: {retensiBadge.label}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getKategoriBadge(item.kategori_warna)}`}>
          {item.kategori_nama}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs font-bold text-slate-300">
          v{item.versi_aktif_nomor ?? 1}
        </span>
        <p className="text-[10px] text-slate-500">{item.total_versi ?? 1} versi</p>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-xs text-slate-300">
          {formatFileSize(item.file_size)}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusDokumenBadge(item.status)}`}>
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onDetail}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer"
        >
          <Eye size={11} /> Detail
        </button>
      </td>
    </tr>
  );
}

// =============================================================================
// HELPERS
// =============================================================================
function getFileIconComponent(mimeType: string | null | undefined) {
  if (!mimeType) return FileText;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return Sheet;
  return FileText;
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  slate: { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof FolderArchive; label: string; value: number; color: KpiColor;
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