// src/components/bk/KonselingTab.tsx
// Tab Konseling — manajemen sesi konseling Individual/Kelompok/Klasikal/Online.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  X,
  MessageSquare,
  User,
  Users,
  GraduationCap,
  Pencil,
  Trash2,
  Lock,
  Calendar,
  Clock,
  UserCheck,
  List,
  LayoutGrid,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { ModalKonseling } from './ModalKonseling';
import {
  getBidangBadge,
  getStatusKonselingBadge,
  getTipeKonselingIcon,
  formatDateShort,
  formatWaktuRange,
  isBkManager,
  INPUT_CLASS,
  TIPE_KONSELING_OPTIONS,
  STATUS_KONSELING_OPTIONS,
} from './shared';
import type {
  BkKonseling,
  BkKonselingWithRelations,
  BkKategoriMasalah,
  Guru,
  Kelas,
  Siswa,
  TipeKonseling,
} from '@/types/database';

export function KonselingTab() {
  const { guru } = useAuth();
  const isManager = isBkManager(guru?.role);

  const [list, setList] = useState<BkKonselingWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<BkKategoriMasalah[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BkKonseling | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BkKonselingWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [konselingRes, kategoriRes, kelasRes, siswaRes, guruRes] = await Promise.all([
        supabase
          .from('bk_konseling')
          .select(`
            *,
            siswa:siswa_id (id, nama_lengkap, nisn),
            guru_bk:guru_bk_id (id, nama_lengkap),
            kategori:kategori_id (id, nama, bidang),
            kelas:kelas_id (id, nama_kelas)
          `)
          .order('tanggal', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('bk_kategori_masalah').select('*').order('nama'),
        supabase.from('kelas').select('*').order('nama_kelas'),
        supabase
          .from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at')
          .eq('status', 'AKTIF')
          .order('nama_lengkap'),
        supabase
          .from('gurus')
          .select('id, nip, nama_lengkap, email, role')
          .order('nama_lengkap'),
      ]);

      if (konselingRes.error) throw konselingRes.error;

      setList((konselingRes.data as unknown as BkKonselingWithRelations[]) || []);
      setKategoriList((kategoriRes.data as BkKategoriMasalah[]) || []);
      setKelasList((kelasRes.data as Kelas[]) || []);
      setSiswaList((siswaRes.data as Siswa[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat data konseling: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ==========================================================================
  // FILTERED + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((k) => {
      if (filterTipe && k.tipe !== filterTipe) return false;
      if (filterStatus && k.status !== filterStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          k.topik.toLowerCase().includes(q) ||
          (k.kode_sesi ?? '').toLowerCase().includes(q) ||
          (k.siswa?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (k.kelompok_nama ?? '').toLowerCase().includes(q) ||
          (k.kelas?.nama_kelas ?? '').toLowerCase().includes(q) ||
          (k.guru_bk?.nama_lengkap ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [list, filterTipe, filterStatus, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const individual = list.filter(
      (k) => k.tipe === 'Individual' || k.tipe === 'Online'
    ).length;
    const kelompok = list.filter((k) => k.tipe === 'Kelompok').length;
    const klasikal = list.filter((k) => k.tipe === 'Klasikal').length;
    const selesaiHariIni = list.filter(
      (k) =>
        k.status === 'Selesai' &&
        k.tanggal === new Date().toISOString().split('T')[0]
    ).length;
    return { total, individual, kelompok, klasikal, selesaiHariIni };
  }, [list]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: BkKonselingWithRelations) => {
    setEditingItem(item as BkKonseling);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('bk_konseling')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.BK,
        targetId: deleteTarget.id,
        deskripsi: `Hapus sesi konseling: ${deleteTarget.topik}`,
      });

      showToast('success', 'Sesi konseling dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => {
    setSearch('');
    setFilterTipe('');
    setFilterStatus('');
  };

  const hasFilter = search || filterTipe || filterStatus;

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Kode Sesi',
    'Tanggal',
    'Waktu',
    'Tipe',
    'Siswa/Kelompok/Kelas',
    'Guru BK',
    'Kategori',
    'Topik',
    'Status',
  ];

  const exportRows = filtered.map((k) => {
    const target =
      k.tipe === 'Individual' || k.tipe === 'Online'
        ? k.siswa?.nama_lengkap ?? '-'
        : k.tipe === 'Kelompok'
        ? `Kelompok: ${k.kelompok_nama ?? '-'}`
        : `Kelas: ${k.kelas?.nama_kelas ?? '-'}`;

    return [
      k.kode_sesi ?? '-',
      k.tanggal,
      formatWaktuRange(k.waktu_mulai, k.waktu_selesai),
      k.tipe,
      target,
      k.guru_bk?.nama_lengkap ?? '-',
      k.kategori?.nama ?? '-',
      k.topik,
      k.status,
    ];
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <MessageSquare className="text-purple-400" size={20} />
            Sesi Konseling
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} sesi ditampilkan
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Sesi Baru
          </button>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
            <MessageSquare size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Total Sesi</p>
            <p className="text-base font-extrabold text-slate-100">{stats.total}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
            <User size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Individual</p>
            <p className="text-base font-extrabold text-indigo-400">{stats.individual}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Kelompok</p>
            <p className="text-base font-extrabold text-blue-400">{stats.kelompok}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <GraduationCap size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Klasikal</p>
            <p className="text-base font-extrabold text-teal-400">{stats.klasikal}</p>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-slate-500">Selesai Hari Ini</p>
            <p className="text-base font-extrabold text-emerald-400">
              {stats.selesaiHariIni}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, topik, siswa, guru BK..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterTipe}
              onChange={(e) => setFilterTipe(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Tipe</option>
              {TIPE_KONSELING_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Status</option>
              {STATUS_KONSELING_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Tabel"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tampilan Grid"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            {hasFilter && (
              <button
                onClick={resetFilter}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <ExportImportButtons
            filename={`sesi_konseling_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Sesi Konseling BK"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat sesi konseling...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <MessageSquare size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada sesi yang cocok' : 'Belum ada sesi konseling'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter
              ? 'Coba reset filter atau ubah kata kunci.'
              : isManager
              ? 'Klik "Sesi Baru" untuk mencatat konseling.'
              : 'Hubungi Guru BK untuk informasi lebih lanjut.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        // ==================== TABLE VIEW ====================
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Sesi</th>
                  <th className="text-left px-4 py-3">Tipe</th>
                  <th className="text-left px-4 py-3">Siswa/Kelompok/Kelas</th>
                  <th className="text-left px-4 py-3">Guru BK</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((k) => {
                  const TipeIcon = getTipeKonselingIcon(k.tipe);
                  const canEdit = isManager;
                  const targetName =
                    k.tipe === 'Individual' || k.tipe === 'Online'
                      ? k.siswa?.nama_lengkap ?? '-'
                      : k.tipe === 'Kelompok'
                      ? k.kelompok_nama ?? '-'
                      : k.kelas?.nama_kelas ?? '-';

                  return (
                    <tr
                      key={k.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-[11px] font-mono text-purple-400 font-bold">
                            {k.kode_sesi ?? '-'}
                          </p>
                          <p className="font-bold text-slate-100 text-xs truncate max-w-[220px] mt-0.5">
                            {k.topik}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={10} />
                              {formatDateShort(k.tanggal)}
                            </span>
                            {(k.waktu_mulai || k.waktu_selesai) && (
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatWaktuRange(k.waktu_mulai, k.waktu_selesai)}
                              </span>
                            )}
                            {k.is_rahasia && (
                              <span
                                className="flex items-center gap-1 text-amber-400"
                                title="Sesi rahasia"
                              >
                                <Lock size={10} />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TipeIcon size={13} className="text-slate-400" />
                          <span className="text-xs text-slate-300">{k.tipe}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-300 truncate max-w-[180px] inline-block">
                          {targetName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-300">
                          {k.guru_bk?.nama_lengkap ?? '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {k.kategori ? (
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBidangBadge(
                              k.kategori.bidang
                            )}`}
                          >
                            {k.kategori.nama}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusKonselingBadge(
                            k.status
                          )}`}
                        >
                          {k.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenEdit(k)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(k)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ==================== GRID VIEW ====================
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((k) => {
            const TipeIcon = getTipeKonselingIcon(k.tipe);
            const targetName =
              k.tipe === 'Individual' || k.tipe === 'Online'
                ? k.siswa?.nama_lengkap ?? '-'
                : k.tipe === 'Kelompok'
                ? k.kelompok_nama ?? '-'
                : k.kelas?.nama_kelas ?? '-';

            return (
              <div
                key={k.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-purple-500/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                      <TipeIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono text-purple-400 font-bold">
                        {k.kode_sesi ?? '-'}
                      </p>
                      <p className="text-[10px] text-slate-500">{k.tipe}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getStatusKonselingBadge(
                      k.status
                    )}`}
                  >
                    {k.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-100 text-sm leading-tight line-clamp-2 mb-2">
                  {k.topik}
                </h3>

                <div className="space-y-1.5 text-[11px] text-slate-400 mb-3">
                  <div className="flex items-center gap-1.5">
                    <User size={11} className="text-slate-500" />
                    <span className="truncate">{targetName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-slate-500" />
                    <span>{formatDateShort(k.tanggal)}</span>
                  </div>
                  {k.guru_bk && (
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={11} className="text-slate-500" />
                      <span className="truncate">{k.guru_bk.nama_lengkap}</span>
                    </div>
                  )}
                </div>

                {k.kategori && (
                  <div className="mb-3">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBidangBadge(
                        k.kategori.bidang
                      )}`}
                    >
                      {k.kategori.nama}
                    </span>
                  </div>
                )}

                {isManager && (
                  <div className="flex gap-1.5 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleOpenEdit(k)}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(k)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      <ModalKonseling
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        konseling={editingItem}
        kategoriList={kategoriList}
        kelasList={kelasList}
        siswaList={siswaList}
        guruList={guruList}
        onSaved={fetchAll}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Sesi Konseling"
        message={`Yakin hapus sesi "${deleteTarget?.topik}" (${deleteTarget?.kode_sesi ?? '-'})? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}