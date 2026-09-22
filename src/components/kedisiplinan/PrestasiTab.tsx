// src/components/kedisiplinan/PrestasiTab.tsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, AlertTriangle, Pencil, Trash2,
  Calendar, User, Eye, Trophy, Filter, Settings,
  Award, ExternalLink, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalPrestasi } from './ModalPrestasi';
import { KategoriPrestasiManagerModal } from './KategoriPrestasiManagerModal';
import {
  getKategoriPrestasiBadge, getTingkatPrestasiBadge, getTingkatPrestasiIcon,
  getPoinPrestasiColor, formatDateShort, isKedisiplinanManager,
  INPUT_CLASS, TINGKAT_PRESTASI_OPTIONS,
} from './shared';
import type {
  KesiswaanPrestasi, KesiswaanPrestasiWithRelations,
  KesiswaanKategoriPrestasi, Siswa, Kelas,
} from '@/types/database';

const MODUL_KEDISIPLINAN = (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

export function PrestasiTab() {
  const { guru } = useAuth();
  const isManager = isKedisiplinanManager(guru?.role);

  const [list, setList] = useState<KesiswaanPrestasiWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<KesiswaanKategoriPrestasi[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('');
  const [filterBulan, setFilterBulan] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KesiswaanPrestasi | null>(null);
  const [kategoriModalOpen, setKategoriModalOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<KesiswaanPrestasiWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KesiswaanPrestasiWithRelations | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [prestasiRes, kategoriRes, siswaRes] = await Promise.all([
        supabase.from('kesiswaan_prestasi').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn, kelas:kelas_id (id, nama_kelas)),
          pencatat:pencatat_id (id, nama_lengkap),
          kategori:kategori_id (id, nama, kategori)
        `).order('tanggal', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('kesiswaan_kategori_prestasi').select('*')
          .eq('is_aktif', true).order('kategori').order('nama'),
        supabase.from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF').order('nama_lengkap'),
      ]);
      if (prestasiRes.error) throw prestasiRes.error;
      setList((prestasiRes.data as unknown as KesiswaanPrestasiWithRelations[]) || []);
      setKategoriList((kategoriRes.data as KesiswaanKategoriPrestasi[]) || []);
      setSiswaList((siswaRes.data as unknown as SiswaWithKelas[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat data: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filterKategori && p.kategori_id !== filterKategori) return false;
      if (filterTingkat && p.tingkat !== filterTingkat) return false;
      if (filterBulan && !p.tanggal.startsWith(filterBulan)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          p.nama_prestasi.toLowerCase().includes(q) ||
          (p.siswa?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (p.siswa?.nisn ?? '').toLowerCase().includes(q) ||
          (p.penyelenggara ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterKategori, filterTingkat, filterBulan, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const bulanIni = new Date().toISOString().slice(0, 7);
    const bulanIniCount = list.filter((p) => p.tanggal.startsWith(bulanIni)).length;
    const totalPoin = list.reduce((s, p) => s + p.poin, 0);
    const siswaUnik = new Set(list.map((p) => p.siswa_id)).size;
    return { total, bulanIniCount, totalPoin, siswaUnik };
  }, [list]);

  const handleOpenCreate = () => { setEditingItem(null); setModalOpen(true); };
  const handleOpenEdit = (item: KesiswaanPrestasiWithRelations) => {
    setEditingItem(item as KesiswaanPrestasi); setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('kesiswaan_prestasi').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({ aksi: 'DELETE', modul: MODUL_KEDISIPLINAN, targetId: deleteTarget.id,
        deskripsi: `Hapus prestasi: ${deleteTarget.nama_prestasi} — ${deleteTarget.siswa?.nama_lengkap}` });
      showToast('success', 'Prestasi dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) { showToast('error', 'Gagal hapus: ' + (err.message || 'Error')); }
  };

  const resetFilter = () => {
    setSearch(''); setFilterKategori(''); setFilterTingkat(''); setFilterBulan('');
  };
  const hasFilter = search || filterKategori || filterTingkat || filterBulan;

  const exportHeaders = ['Tanggal', 'NISN', 'Nama Siswa', 'Kelas', 'Kategori', 'Nama Prestasi', 'Tingkat', 'Peringkat', 'Poin', 'Penyelenggara'];
  const exportRows = filtered.map((p) => [
    p.tanggal, p.siswa?.nisn ?? '-', p.siswa?.nama_lengkap ?? '-',
    p.siswa?.kelas?.nama_kelas ?? '-', p.kategori?.kategori ?? '-',
    p.nama_prestasi, p.tingkat, p.peringkat ?? '-', p.poin, p.penyelenggara ?? '-',
  ]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Trophy className="text-emerald-400" size={20} /> Catatan Prestasi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} prestasi ditampilkan
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setKategoriModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/20 font-bold text-xs transition-colors cursor-pointer">
            <Settings size={14} /> Kelola Kategori
          </button>
          <button onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors cursor-pointer">
            <Plus size={14} /> Catat Prestasi
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Trophy} label="Total Prestasi" value={stats.total} color="emerald" />
        <KpiCard icon={Calendar} label="Bulan Ini" value={stats.bulanIniCount} color="teal" />
        <KpiCard icon={Star} label="Total Poin" value={stats.totalPoin} color="amber" />
        <KpiCard icon={User} label="Siswa Berprestasi" value={stats.siswaUnik} color="indigo" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-emerald-400" /> Filter & Pencarian
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / NISN / prestasi..." className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Kategori</option>
            {kategoriList.map((k) => (
              <option key={k.id} value={k.id}>{k.nama} ({k.poin_default}p)</option>
            ))}
          </select>
          <select value={filterTingkat} onChange={(e) => setFilterTingkat(e.target.value)}
            className={`${INPUT_CLASS} cursor-pointer`}>
            <option value="">Semua Tingkat</option>
            {TINGKAT_PRESTASI_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="month" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'} />
        </div>
        <div className="flex justify-end">
          <ExportImportButtons filename={`prestasi_siswa_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Prestasi Siswa" headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat data prestasi...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Trophy size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada prestasi cocok' : 'Belum ada prestasi'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter atau ubah kata kunci.' : 'Klik "Catat Prestasi" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Siswa</th>
                  <th className="text-left px-4 py-3">Prestasi</th>
                  <th className="text-left px-4 py-3">Tingkat</th>
                  <th className="text-right px-4 py-3">Poin</th>
                  <th className="text-left px-4 py-3">Tanggal</th>
                  <th className="text-left px-4 py-3">Pencatat</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((p) => {
                  const TingkatIcon = getTingkatPrestasiIcon(p.tingkat);
                  return (
                    <tr key={p.id}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => setDetailTarget(p)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                            <TingkatIcon size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[180px]">
                              {p.siswa?.nama_lengkap ?? '-'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {p.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {p.siswa?.nisn ?? '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-200 text-xs truncate max-w-[240px]">
                          {p.nama_prestasi}
                        </p>
                        {p.peringkat && (
                          <p className="text-[10px] text-amber-400 font-bold">{p.peringkat}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getTingkatPrestasiBadge(p.tingkat)}`}>
                          {p.tingkat}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-extrabold ${getPoinPrestasiColor(p.poin)}`}>
                          +{p.poin}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateShort(p.tanggal)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {p.pencatat?.nama_lengkap ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setDetailTarget(p); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Detail">
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Hapus">
                                <Trash2 size={14} />
                              </button>
                            </>
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

      {/* MODAL FORM */}
      <ModalPrestasi open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        prestasi={editingItem} kategoriList={kategoriList}
        siswaList={siswaList} onSaved={fetchAll} />

      {/* MODAL KATEGORI */}
      <KategoriPrestasiManagerModal open={kategoriModalOpen}
        onClose={() => setKategoriModalOpen(false)}
        kategoriList={kategoriList} onChanged={fetchAll} />

      {/* MODAL DETAIL */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Prestasi" size="md">
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Award size={22} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-100">{detailTarget.siswa?.nama_lengkap ?? '-'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {detailTarget.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {detailTarget.siswa?.nisn ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <DetailBox label="Tanggal" value={formatDateShort(detailTarget.tanggal)} />
              <DetailBox label="Poin" value={`+${detailTarget.poin}`}
                valueClass={getPoinPrestasiColor(detailTarget.poin)} />
              <DetailBox label="Tingkat" value={detailTarget.tingkat} />
              <DetailBox label="Peringkat" value={detailTarget.peringkat ?? '-'} />
              <DetailBox label="Kategori" value={detailTarget.kategori?.kategori ?? '-'} />
              <DetailBox label="Pencatat" value={detailTarget.pencatat?.nama_lengkap ?? '-'} />
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Nama Prestasi</p>
              <p className="text-sm text-slate-200 font-semibold">{detailTarget.nama_prestasi}</p>
            </div>

            {detailTarget.penyelenggara && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Penyelenggara</p>
                <p className="text-xs text-slate-300">{detailTarget.penyelenggara}</p>
              </div>
            )}

            {detailTarget.bukti_url && (
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1.5">Bukti</p>
                <a href={detailTarget.bukti_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-3 py-2 rounded-xl transition">
                  <ExternalLink size={12} /> Buka Bukti
                </a>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title="Hapus Prestasi"
        message={`Yakin hapus prestasi "${deleteTarget?.nama_prestasi}" — ${deleteTarget?.siswa?.nama_lengkap}?`} />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'emerald' | 'teal' | 'amber' | 'indigo';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Trophy; label: string; value: number; color: KpiColor;
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
      <p className={`text-xs font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}