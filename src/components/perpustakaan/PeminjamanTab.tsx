// src/components/perpustakaan/PeminjamanTab.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Send, RotateCcw, Trash2, Eye, Filter,
  Book, User, Calendar, Clock, AlertTriangle, CheckCircle2,
  BookOpen, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalPeminjaman } from './ModalPeminjaman';
import { ModalPengembalian } from './ModalPengembalian';
import {
  getStatusPeminjamanBadge, isPustakawan,
  formatDateShort, formatRupiah,
  calculateHariTerlambat, isOverdue, sisaHariSebelumJatuhTempo,
  INPUT_CLASS,
} from './shared';
import type {
  PerpusPeminjamanWithRelations,
  PerpusAnggotaWithRelations, PerpusBukuWithRelations,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type ViewTab = 'aktif' | 'selesai' | 'semua';

export function PeminjamanTab() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const [list, setList] = useState<PerpusPeminjamanWithRelations[]>([]);
  const [anggotaList, setAnggotaList] = useState<PerpusAnggotaWithRelations[]>([]);
  const [bukuList, setBukuList] = useState<PerpusBukuWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewTab, setViewTab] = useState<ViewTab>('aktif');
  const [search, setSearch] = useState('');

  const [modalPeminjamanOpen, setModalPeminjamanOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<PerpusPeminjamanWithRelations | null>(null);
  const [detailTarget, setDetailTarget] = useState<PerpusPeminjamanWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerpusPeminjamanWithRelations | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pinjamRes, anggotaRes, bukuRes] = await Promise.all([
        supabase.from('perpus_peminjaman').select(`
          *,
          anggota:anggota_id (
            id, kode_anggota, tipe, nama_lengkap, status,
            siswa:siswa_id (id, nama_lengkap, nisn, kelas:kelas_id (id, nama_kelas)),
            guru:guru_id (id, nama_lengkap, nip)
          ),
          buku:buku_id (id, kode_buku, judul, pengarang, cover_url),
          petugas_pinjam:petugas_pinjam_id (id, nama_lengkap),
          petugas_kembali:petugas_kembali_id (id, nama_lengkap)
        `).order('created_at', { ascending: false }),
        // Ambil semua anggota (untuk scan detection)
        supabase.from('perpus_anggota').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn, kelas:kelas_id (id, nama_kelas)),
          guru:guru_id (id, nama_lengkap, nip)
        `).order('nama_lengkap'),
        // Ambil semua buku aktif (untuk scan detection)
        supabase.from('perpus_buku').select(`
          *,
          rak:rak_id (id, nama, lokasi)
        `).eq('is_aktif', true).order('judul'),
      ]);

      if (pinjamRes.error) throw pinjamRes.error;

      setList((pinjamRes.data as unknown as PerpusPeminjamanWithRelations[]) || []);
      setAnggotaList((anggotaRes.data as unknown as PerpusAnggotaWithRelations[]) || []);
      setBukuList((bukuRes.data as unknown as PerpusBukuWithRelations[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat peminjaman: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const stats = useMemo(() => {
    const aktif = list.filter((p) => p.status === 'Dipinjam').length;
    const terlambat = list.filter((p) => isOverdue(p.tanggal_jatuh_tempo, p.status)).length;
    const selesaiBulanIni = list.filter((p) => {
      if (p.status !== 'Dikembalikan' || !p.tanggal_kembali) return false;
      const now = new Date();
      const kmb = new Date(p.tanggal_kembali);
      return kmb.getMonth() === now.getMonth() && kmb.getFullYear() === now.getFullYear();
    }).length;
    const totalDenda = list
      .filter((p) => p.status !== 'Dikembalikan')
      .reduce((s, p) => s + (calculateHariTerlambat(p.tanggal_jatuh_tempo) * 500), 0);
    return { aktif, terlambat, selesaiBulanIni, totalDenda, totalTransaksi: list.length };
  }, [list]);

  const viewFiltered = useMemo(() => {
    return list.filter((p) => {
      if (viewTab === 'aktif') {
        if (p.status !== 'Dipinjam' && p.status !== 'Terlambat') return false;
      } else if (viewTab === 'selesai') {
        if (p.status !== 'Dikembalikan' && p.status !== 'Hilang') return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          (p.buku?.judul ?? '').toLowerCase().includes(q) ||
          (p.anggota?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (p.anggota?.kode_anggota ?? '').toLowerCase().includes(q) ||
          (p.buku?.kode_buku ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, viewTab, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!window.confirm(
      deleteTarget.status === 'Dikembalikan'
        ? 'Hapus transaksi ini?'
        : 'Peminjaman masih aktif. Hapus akan mengembalikan stok buku. Lanjutkan?'
    )) return;

    try {
      const { error } = await supabase.from('perpus_peminjaman').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      if (deleteTarget.status === 'Dipinjam' || deleteTarget.status === 'Terlambat') {
        const { data: bukuData } = await supabase.from('perpus_buku')
          .select('jumlah_tersedia').eq('id', deleteTarget.buku_id).single();
        if (bukuData) {
          await supabase.from('perpus_buku')
            .update({ jumlah_tersedia: bukuData.jumlah_tersedia + 1 })
            .eq('id', deleteTarget.buku_id);
        }
      }

      await logActivity({
        aksi: 'DELETE', modul: MODUL_PERPUS, targetId: deleteTarget.id,
        deskripsi: `Hapus peminjaman: ${deleteTarget.buku?.judul} — ${deleteTarget.anggota?.nama_lengkap}`,
      });

      showToast('success', 'Peminjaman dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) { showToast('error', 'Gagal hapus: ' + (err.message || 'Error')); }
  };

  const exportHeaders = [
    'Tgl Pinjam', 'Jatuh Tempo', 'Tgl Kembali', 'Anggota', 'Kode Anggota',
    'Buku', 'Kode Buku', 'Status', 'Denda',
  ];
  const exportRows = viewFiltered.map((p) => [
    p.tanggal_pinjam, p.tanggal_jatuh_tempo, p.tanggal_kembali ?? '-',
    p.anggota?.nama_lengkap ?? '-', p.anggota?.kode_anggota ?? '-',
    p.buku?.judul ?? '-', p.buku?.kode_buku ?? '-',
    p.status, p.denda,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Send className="text-indigo-400" size={20} /> Peminjaman Buku
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {viewFiltered.length} dari {list.length} transaksi ditampilkan
          </p>
        </div>
        {isManager && (
          <button onClick={() => setModalPeminjamanOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
            <Plus size={14} /> Pinjam Buku
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={BookOpen} label="Total Transaksi" value={stats.totalTransaksi} color="indigo" />
        <KpiCard icon={Clock} label="Sedang Dipinjam" value={stats.aktif} color="amber" />
        <KpiCard icon={AlertTriangle} label="Terlambat" value={stats.terlambat} color="rose" pulse={stats.terlambat > 0} />
        <KpiCard icon={CheckCircle2} label="Selesai Bulan Ini" value={stats.selesaiBulanIni} color="emerald" />
        <KpiCard icon={TrendingUp} label="Total Denda Aktif" value={formatRupiah(stats.totalDenda)} color="orange" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex gap-1">
        {([
          { key: 'aktif', label: 'Aktif', count: stats.aktif + stats.terlambat },
          { key: 'selesai', label: 'Selesai', count: list.length - stats.aktif - stats.terlambat },
          { key: 'semua', label: 'Semua', count: list.length },
        ] as const).map((t) => {
          const active = viewTab === t.key;
          return (
            <button key={t.key} onClick={() => setViewTab(t.key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Pencarian
          </div>
          {search && (
            <button onClick={() => setSearch('')}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul buku, nama anggota, kode..."
            className={`${INPUT_CLASS} pl-10`} />
        </div>
        <div className="flex justify-end">
          <ExportImportButtons
            filename={`peminjaman_perpus_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Peminjaman Perpustakaan"
            headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat transaksi...</div>
      ) : viewFiltered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <BookOpen size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {viewTab === 'aktif' ? 'Tidak ada peminjaman aktif' :
             viewTab === 'selesai' ? 'Belum ada pengembalian' :
             search ? 'Tidak ada transaksi cocok' : 'Belum ada transaksi'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Buku & Anggota</th>
                  <th className="text-left px-4 py-3">Tgl Pinjam</th>
                  <th className="text-left px-4 py-3">Jatuh Tempo</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Denda</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {viewFiltered.map((p) => {
                  const overdue = isOverdue(p.tanggal_jatuh_tempo, p.status);
                  const hariTelat = overdue ? calculateHariTerlambat(p.tanggal_jatuh_tempo) : 0;
                  const sisa = !overdue && p.status === 'Dipinjam'
                    ? sisaHariSebelumJatuhTempo(p.tanggal_jatuh_tempo) : null;
                  const dendaRealtime = overdue ? hariTelat * 500 : p.denda;
                  const canReturn = p.status === 'Dipinjam' || p.status === 'Terlambat';

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-14 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {p.buku?.cover_url ? (
                              <img src={p.buku.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Book size={16} className="text-slate-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[220px]">
                              {p.buku?.judul ?? '-'}
                            </p>
                            <p className="text-[10px] font-mono text-indigo-400">
                              {p.buku?.kode_buku ?? '-'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[220px]">
                              <User size={9} className="inline mr-1" />
                              {p.anggota?.nama_lengkap ?? '-'}
                              {p.anggota?.siswa?.kelas?.nama_kelas && ` · ${p.anggota.siswa.kelas.nama_kelas}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateShort(p.tanggal_pinjam)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className={`${overdue ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                          {formatDateShort(p.tanggal_jatuh_tempo)}
                        </div>
                        {overdue && <p className="text-[10px] text-rose-500">+{hariTelat} hari</p>}
                        {sisa !== null && sisa <= 3 && sisa >= 0 && (
                          <p className="text-[10px] text-amber-400">Tersisa {sisa} hari</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusPeminjamanBadge(
                          overdue ? 'Terlambat' : p.status
                        )}`}>
                          {overdue ? 'Terlambat' : p.status}
                        </span>
                        {p.tanggal_kembali && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Kembali: {formatDateShort(p.tanggal_kembali)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {dendaRealtime > 0 ? (
                          <span className="text-xs font-bold text-amber-400 font-mono">
                            {formatRupiah(dendaRealtime)}
                          </span>
                        ) : <span className="text-slate-600 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canReturn && isManager && (
                            <button onClick={() => setReturnTarget(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold transition cursor-pointer">
                              <RotateCcw size={10} /> Kembalikan
                            </button>
                          )}
                          <button onClick={() => setDetailTarget(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer">
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <button onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalPeminjaman open={modalPeminjamanOpen}
        onClose={() => setModalPeminjamanOpen(false)}
        anggotaList={anggotaList} bukuList={bukuList} onSaved={fetchAll} />

      <ModalPengembalian open={!!returnTarget}
        onClose={() => setReturnTarget(null)}
        peminjaman={returnTarget} onSaved={fetchAll} />

      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Peminjaman" size="md">
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {detailTarget.buku?.cover_url ? (
                    <img src={detailTarget.buku.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : <Book size={20} className="text-slate-500" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-100 text-sm">{detailTarget.buku?.judul ?? '-'}</p>
                  <p className="text-[10px] font-mono text-indigo-400">{detailTarget.buku?.kode_buku ?? '-'}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{detailTarget.buku?.pengarang ?? '-'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <DetailBox label="Peminjam" value={detailTarget.anggota?.nama_lengkap ?? '-'} />
              <DetailBox label="Kode Anggota" value={detailTarget.anggota?.kode_anggota ?? '-'} />
              <DetailBox label="Tgl Pinjam" value={formatDateShort(detailTarget.tanggal_pinjam)} />
              <DetailBox label="Jatuh Tempo" value={formatDateShort(detailTarget.tanggal_jatuh_tempo)} />
              {detailTarget.tanggal_kembali && (
                <DetailBox label="Tgl Kembali" value={formatDateShort(detailTarget.tanggal_kembali)} />
              )}
              <DetailBox label="Status"
                value={isOverdue(detailTarget.tanggal_jatuh_tempo, detailTarget.status)
                  ? 'Terlambat' : detailTarget.status} />
            </div>

            {detailTarget.denda > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-amber-400 mb-1">Denda</p>
                <p className="text-lg font-extrabold text-amber-300">{formatRupiah(detailTarget.denda)}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title="Hapus Peminjaman"
        message={`Yakin hapus transaksi "${deleteTarget?.buku?.judul}" — ${deleteTarget?.anggota?.nama_lengkap}?`} />
    </div>
  );
}

type KpiColor = 'indigo' | 'amber' | 'rose' | 'emerald' | 'orange';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
};

function KpiCard({ icon: Icon, label, value, color, pulse = false }: {
  icon: typeof BookOpen; label: string; value: string | number; color: KpiColor; pulse?: boolean;
}) {
  const c = CM[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 ${pulse ? 'ring-1 ring-current ' + c.text : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text} truncate`}>{value}</p>
      </div>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
    </div>
  );
}