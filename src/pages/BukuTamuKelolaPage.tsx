// src/pages/BukuTamuKelolaPage.tsx
// Buku Tamu — PROTECTED, list view + kelola status + hapus.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, Search, Loader2, Clock, Building, User, X,
  FileText, CheckCircle2, XCircle, LogOut, Users, ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type {
  BukuTamuWithRelations,
  StatusBukuTamu,
} from '@/types/database';

const KATEGORI_OPTIONS = [
  'Kemitraan DUDI',
  'Orang Tua / BK',
  'Kedinasan',
  'Alumni / Umum',
  'Lainnya',
];

export function BukuTamuKelolaPage() {
  const [list, setList] = useState<BukuTamuWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');

  const [detailItem, setDetailItem] = useState<BukuTamuWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BukuTamuWithRelations | null>(null);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('buku_tamu')
      .select(
        '*, gurus(id, nama_lengkap), divisis(id, nama_divisi), siswas(id, nama_lengkap, nisn)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      showToast('error', 'Gagal memuat buku tamu: ' + error.message);
    } else {
      setList((data as BukuTamuWithRelations[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ===========================================================================
  // FILTER
  // ===========================================================================
  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesKat =
        selectedKategori === 'semua' || item.kategori === selectedKategori;
      const query = searchQuery.toLowerCase();
      const nama = item.nama_tamu.toLowerCase();
      const instansi = (item.instansi || '').toLowerCase();
      const keperluan = item.keperluan.toLowerCase();
      const guru = (item.gurus?.nama_lengkap || '').toLowerCase();

      const matchesSearch =
        nama.includes(query) ||
        instansi.includes(query) ||
        keperluan.includes(query) ||
        guru.includes(query);

      return matchesKat && matchesSearch;
    });
  }, [list, selectedKategori, searchQuery]);

  // ===========================================================================
  // KPI
  // ===========================================================================
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: list.length,
      hariIni: list.filter((i) => i.waktu_masuk?.startsWith(today)).length,
      menunggu: list.filter((i) => i.status === 'menunggu').length,
      selesai: list.filter((i) => i.status === 'selesai').length,
    };
  }, [list]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const handleUpdateStatus = async (id: string, status: StatusBukuTamu) => {
    const updateData: Partial<BukuTamuWithRelations> = { status };
    if (status === 'selesai') {
      updateData.waktu_keluar = new Date().toISOString();
    }

    const { error } = await supabase.from('buku_tamu').update(updateData).eq('id', id);
    if (error) {
      showToast('error', 'Gagal update status: ' + error.message);
    } else {
      showToast('success', `Status: ${status}`);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('buku_tamu').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Catatan tamu dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  const formatWaktu = (t: string | null) =>
    t
      ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WIB'
      : '-';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'menunggu':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'bertemu':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'selesai':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <UserCheck size={26} />
            </div>
            Kelola Buku Tamu
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Rekap kunjungan tamu & kelola status kehadiran
          </p>
        </div>
        <Link
          to="/buku_tamu"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer shrink-0"
        >
          <ExternalLink size={14} />
          Buka Form Tamu
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total Tamu" value={stats.total} color="indigo" />
        <KpiCard icon={Clock} label="Hari Ini" value={stats.hariIni} color="blue" />
        <KpiCard icon={Loader2} label="Menunggu" value={stats.menunggu} color="amber" />
        <KpiCard icon={CheckCircle2} label="Selesai" value={stats.selesai} color="emerald" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-3 sm:p-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Cari tamu, instansi, keperluan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-slate-200 placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedKategori('semua')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer border ${
              selectedKategori === 'semua'
                ? 'bg-indigo-600/90 text-white border-indigo-400/40'
                : 'bg-slate-950/40 text-slate-400 border-slate-800/60'
            }`}
          >
            Semua
          </button>
          {KATEGORI_OPTIONS.map((kat) => (
            <button
              key={kat}
              onClick={() => setSelectedKategori(kat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer border ${
                selectedKategori === kat
                  ? 'bg-indigo-600/90 text-white border-indigo-400/40'
                  : 'bg-slate-950/40 text-slate-400 border-slate-800/60'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>
      </div>

      {/* LIST — MOBILE */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin text-indigo-400 mx-auto" size={24} />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 p-8 rounded-2xl text-center">
            <UserCheck size={36} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs text-slate-400">Belum ada catatan tamu</p>
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {item.foto_url ? (
                    <img
                      src={item.foto_url}
                      alt={item.nama_tamu}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-700/80 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <User size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-slate-100 text-sm">
                      {item.nama_tamu}
                    </h2>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Building size={11} className="text-slate-500" />
                      {item.instansi || 'Perorangan'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${getStatusBadge(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 text-[11px]">Tujuan:</span>
                  <span className="font-medium">
                    {item.gurus?.nama_lengkap || item.divisis?.nama_divisi || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-500 text-[11px]">Kategori:</span>
                  <span className="text-[10px] font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {item.kategori}
                  </span>
                </div>
                <p className="text-slate-400 pt-1 border-t border-slate-800/60 line-clamp-2">
                  {item.keperluan}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock size={11} />
                  {formatWaktu(item.waktu_masuk)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDetailItem(item)}
                    className="p-2 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    <FileText size={15} />
                  </button>
                  {item.status === 'menunggu' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'bertemu')}
                      className="p-2 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 cursor-pointer"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  {item.status !== 'selesai' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'selesai')}
                      className="p-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                    >
                      <LogOut size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-2 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 cursor-pointer"
                  >
                    <XCircle size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* LIST — DESKTOP */}
      <div className="hidden md:block bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="animate-spin text-indigo-400 mx-auto" size={28} />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16">
            <UserCheck size={44} className="mx-auto mb-3 text-slate-600" />
            <p className="text-sm text-slate-400">Belum ada catatan tamu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800/80 uppercase text-[11px] tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4">Tamu & Instansi</th>
                  <th className="px-5 py-4">Pihak Dituju</th>
                  <th className="px-5 py-4">Kategori & Keperluan</th>
                  <th className="px-5 py-4">Waktu Masuk</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={item.nama_tamu}
                            className="w-10 h-10 rounded-2xl object-cover border border-slate-700/80 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                            <User size={18} />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-100 leading-tight">
                            {item.nama_tamu}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Building size={12} className="text-slate-500" />{' '}
                            {item.instansi || 'Perorangan / Umum'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {item.gurus?.nama_lengkap ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20 w-fit">
                          <User size={13} /> {item.gurus.nama_lengkap}
                        </div>
                      ) : item.divisis?.nama_divisi ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 w-fit">
                          <Users size={13} /> Divisi {item.divisis.nama_divisi}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider bg-slate-950/60 text-slate-300 px-2 py-0.5 rounded border border-slate-800/80 mb-1">
                        {item.kategori}
                      </span>
                      <p className="text-xs text-slate-400 truncate" title={item.keperluan}>
                        {item.keperluan}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock size={13} className="text-slate-500" />
                        <span>{formatWaktu(item.waktu_masuk)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-medium border ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                          title="Detail"
                        >
                          <FileText size={16} />
                        </button>
                        {item.status === 'menunggu' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'bertemu')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/15 cursor-pointer"
                            title="Tandai Bertemu"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {item.status !== 'selesai' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'selesai')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/15 cursor-pointer"
                            title="Tandai Selesai"
                          >
                            <LogOut size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                          title="Hapus"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETAIL */}
      {detailItem && (
        <Modal
          open={!!detailItem}
          onClose={() => setDetailItem(null)}
          title="Detail Kunjungan Tamu"
          size="md"
        >
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              {detailItem.foto_url ? (
                <img
                  src={detailItem.foto_url}
                  alt={detailItem.nama_tamu}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon size={22} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                  {detailItem.nama_tamu}
                </h3>
                <p className="text-xs text-slate-400">
                  {detailItem.instansi || 'Perorangan / Umum'}
                </p>
                <p className="text-xs text-indigo-400 mt-0.5">
                  HP: {detailItem.no_hp || '-'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Kategori:</span>
                <span className="font-medium text-slate-200">{detailItem.kategori}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500">Tujuan:</span>
                <span className="font-medium text-slate-200">
                  {detailItem.gurus?.nama_lengkap ||
                    detailItem.divisis?.nama_divisi ||
                    '-'}
                </span>
              </div>
              <div className="border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-500 block mb-1">Keperluan:</span>
                <p className="text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  {detailItem.keperluan}
                </p>
              </div>
            </div>

            {detailItem.tanda_tangan_url && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Tanda Tangan Digital
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex justify-center">
                  <img
                    src={detailItem.tanda_tangan_url}
                    alt="Tanda Tangan"
                    className="h-20 object-contain filter invert opacity-90"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan Tamu"
        message="Apakah Anda yakin ingin menghapus catatan kunjungan tamu ini?"
      />
    </div>
  );
}

// =============================================================================
// SUB — KPI CARD
// =============================================================================
type KpiColor = 'indigo' | 'blue' | 'amber' | 'emerald';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: KpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-lg font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}