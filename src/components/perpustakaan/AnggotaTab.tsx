// src/components/perpustakaan/AnggotaTab.tsx
// Tab Anggota — manajemen keanggotaan perpustakaan.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Users, Pencil, Trash2, Eye, Filter,
  CreditCard, Printer, GraduationCap, User, Briefcase,
  UserCircle, CheckSquare, Square,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalAnggota } from './ModalAnggota';
import { PrintKartuAnggota } from './PrintKartuAnggota';
import {
  getStatusAnggotaBadge, getTipeAnggotaBadge, isPustakawan,
  formatDateShort, formatRupiah, INPUT_CLASS,
  STATUS_ANGGOTA_OPTIONS, TIPE_ANGGOTA_OPTIONS,
  DURASI_KEANGGOTAAN_BULAN,
} from './shared';
import type {
  PerpusAnggota, PerpusAnggotaWithRelations, Siswa, Kelas, Guru, TipeAnggota,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

const getTipeIcon = (tipe: string) => {
  switch (tipe) {
    case 'Siswa': return GraduationCap;
    case 'Guru': return User;
    case 'Tendik': return Briefcase;
    default: return UserCircle;
  }
};

export function AnggotaTab() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const [list, setList] = useState<PerpusAnggotaWithRelations[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Selection (untuk print kartu massal)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PerpusAnggota | null>(null);
  const [detailTarget, setDetailTarget] = useState<PerpusAnggotaWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerpusAnggotaWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [anggotaRes, siswaRes, guruRes] = await Promise.all([
        supabase.from('perpus_anggota').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn, kelas:kelas_id (id, nama_kelas)),
          guru:guru_id (id, nama_lengkap, nip)
        `).order('created_at', { ascending: false }),
        supabase.from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at, kelas:kelas_id (id, nama_kelas)')
          .eq('status', 'AKTIF').order('nama_lengkap'),
        supabase.from('gurus').select('id, nip, nama_lengkap, email, role').order('nama_lengkap'),
      ]);

      if (anggotaRes.error) throw anggotaRes.error;

      setList((anggotaRes.data as unknown as PerpusAnggotaWithRelations[]) || []);
      setSiswaList((siswaRes.data as unknown as SiswaWithKelas[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast('error', 'Gagal memuat anggota: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // FILTERED + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((a) => {
      if (filterTipe && a.tipe !== filterTipe) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          a.nama_lengkap.toLowerCase().includes(q) ||
          a.kode_anggota.toLowerCase().includes(q) ||
          (a.siswa?.nisn ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterTipe, filterStatus, search]);

  const stats = useMemo(() => {
    return {
      total: list.length,
      aktif: list.filter((a) => a.status === 'Aktif').length,
      siswa: list.filter((a) => a.tipe === 'Siswa').length,
      guru: list.filter((a) => a.tipe === 'Guru' || a.tipe === 'Tendik').length,
      denda: list.reduce((s, a) => s + Number(a.total_denda ?? 0), 0),
    };
  }, [list]);

  // ==========================================================================
  // SELECTION
  // ==========================================================================
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filtered.map((a) => a.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectedAnggota = useMemo(
    () => list.filter((a) => selectedIds.has(a.id)),
    [list, selectedIds]
  );

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  const clearSelection = () => setSelectedIds(new Set());

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => { setEditingItem(null); setModalOpen(true); };
  const handleOpenEdit = (a: PerpusAnggotaWithRelations) => {
    setEditingItem(a as PerpusAnggota); setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('perpus_anggota').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE', modul: MODUL_PERPUS, targetId: deleteTarget.id,
        deskripsi: `Hapus anggota perpus: ${deleteTarget.nama_lengkap}`,
      });

      showToast('success', 'Anggota dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) { showToast('error', 'Gagal hapus: ' + (err.message || 'Error')); }
  };

  const resetFilter = () => { setSearch(''); setFilterTipe(''); setFilterStatus(''); };
  const hasFilter = search || filterTipe || filterStatus;

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Kode Anggota', 'Tipe', 'Nama', 'NISN/NIP', 'Kelas/Jabatan',
    'Tgl Daftar', 'Berlaku Sampai', 'Status', 'Denda',
  ];
  const exportRows = filtered.map((a) => [
    a.kode_anggota,
    a.tipe,
    a.nama_lengkap,
    a.siswa?.nisn ?? a.guru?.nip ?? '-',
    a.siswa?.kelas?.nama_kelas ?? '-',
    a.tanggal_daftar,
    a.tanggal_expired ?? '-',
    a.status,
    a.total_denda,
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
            <Users className="text-indigo-400" size={20} /> Anggota Perpustakaan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} anggota ditampilkan
            {selectedIds.size > 0 && (
              <span className="text-indigo-400 font-bold"> · {selectedIds.size} dipilih</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs transition cursor-pointer">
              <X size={14} /> Batal Pilih
            </button>
          )}
          {isManager && (
            <button onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
              <Plus size={14} /> Daftar Anggota
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Users} label="Total Anggota" value={stats.total} color="indigo" />
        <KpiCard icon={CheckSquare} label="Aktif" value={stats.aktif} color="emerald" />
        <KpiCard icon={GraduationCap} label="Siswa" value={stats.siswa} color="purple" />
        <KpiCard icon={User} label="Guru & Staf" value={stats.guru} color="teal" />
        <KpiCard icon={CreditCard} label="Total Denda" value={formatRupiah(stats.denda)} color="amber" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter & Pencarian
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode anggota, NISN/NIP..."
              className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterTipe} onChange={(e) => setFilterTipe(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Tipe</option>
            {TIPE_ANGGOTA_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Status</option>
            {STATUS_ANGGOTA_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* TOOLBAR AKSI MASSAL */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800 flex-wrap">
          <div>
            {selectedIds.size > 0 ? (
              <button onClick={() => setPrintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
                <Printer size={14} /> Cetak Kartu ({selectedIds.size})
              </button>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Pilih anggota dengan checkbox untuk mencetak kartu QR
              </p>
            )}
          </div>
          <ExportImportButtons
            filename={`anggota_perpus_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Anggota Perpustakaan"
            headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat anggota...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Users size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada anggota cocok' : 'Belum ada anggota terdaftar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Daftar Anggota" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">
                    <button onClick={toggleSelectAll}
                      className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 transition cursor-pointer">
                      {isAllFilteredSelected
                        ? <CheckSquare size={16} className="text-indigo-400" />
                        : <Square size={16} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">Anggota</th>
                  <th className="text-left px-4 py-3">Kode</th>
                  <th className="text-left px-4 py-3">Kelas/NIP</th>
                  <th className="text-left px-4 py-3">Tgl Daftar</th>
                  <th className="text-left px-4 py-3">Berlaku</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((a) => {
                  const TipeIcon = getTipeIcon(a.tipe);
                  const isSelected = selectedIds.has(a.id);
                  return (
                    <tr key={a.id}
                      className={`hover:bg-slate-800/30 transition-colors group ${isSelected ? 'bg-indigo-500/[0.06]' : ''}`}>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleSelect(a.id)}
                          className="inline-flex items-center justify-center text-slate-400 hover:text-indigo-400 transition cursor-pointer">
                          {isSelected
                            ? <CheckSquare size={16} className="text-indigo-400" />
                            : <Square size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                            <TipeIcon size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[200px]">
                              {a.nama_lengkap}
                            </p>
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${getTipeAnggotaBadge(a.tipe)}`}>
                              {a.tipe}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-mono font-bold text-indigo-400">
                          {a.kode_anggota}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {a.siswa?.kelas?.nama_kelas ? `Kelas ${a.siswa.kelas.nama_kelas}`
                          : a.guru?.nip ? `NIP. ${a.guru.nip}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateShort(a.tanggal_daftar)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {a.tanggal_expired ? formatDateShort(a.tanggal_expired) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusAnggotaBadge(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setDetailTarget(a)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                            title="Detail">
                            <Eye size={14} />
                          </button>
                          {isManager && (
                            <>
                              <button onClick={() => handleOpenEdit(a)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget(a)}
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

      {/* ==================== MODAL FORM ==================== */}
      <ModalAnggota
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        anggota={editingItem}
        siswaList={siswaList}
        guruList={guruList}
        onSaved={fetchAll}
      />

      {/* ==================== MODAL DETAIL ==================== */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Anggota" size="md">
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                  {(() => {
                    const I = getTipeIcon(detailTarget.tipe);
                    return <I size={24} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-100 text-base truncate">
                    {detailTarget.nama_lengkap}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-indigo-400 mt-0.5">
                    {detailTarget.kode_anggota}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTipeAnggotaBadge(detailTarget.tipe)}`}>
                      {detailTarget.tipe}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusAnggotaBadge(detailTarget.status)}`}>
                      {detailTarget.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <DetailBox label="NISN / NIP"
                value={detailTarget.siswa?.nisn ?? detailTarget.guru?.nip ?? '-'} />
              <DetailBox label="Kelas / Jabatan"
                value={detailTarget.siswa?.kelas?.nama_kelas ?? '-'} />
              <DetailBox label="Tgl Daftar" value={formatDateShort(detailTarget.tanggal_daftar)} />
              <DetailBox label="Berlaku Sampai"
                value={detailTarget.tanggal_expired ? formatDateShort(detailTarget.tanggal_expired) : 'Selamanya'} />
            </div>

            {detailTarget.total_denda > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-amber-500 mb-1">
                  Total Denda Belum Dibayar
                </p>
                <p className="text-lg font-extrabold text-amber-400">
                  {formatRupiah(detailTarget.total_denda)}
                </p>
              </div>
            )}

            {detailTarget.catatan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Catatan</p>
                <p className="text-xs text-slate-300 leading-relaxed">{detailTarget.catatan}</p>
              </div>
            )}

            <div className="flex justify-between gap-2.5 pt-4 border-t border-slate-800">
              <button
                onClick={() => { setDetailTarget(null); setSelectedIds(new Set([detailTarget.id])); setPrintModalOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer">
                <Printer size={13} /> Cetak Kartu
              </button>
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== PRINT KARTU ==================== */}
      <PrintKartuAnggota
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        anggotaList={selectedAnggota}
      />

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Anggota"
        message={`Yakin hapus anggota "${deleteTarget?.nama_lengkap}" (${deleteTarget?.kode_anggota})? Semua riwayat peminjaman akan ikut terhapus.`}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'purple' | 'teal' | 'amber';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Users; label: string; value: string | number; color: KpiColor;
}) {
  const c = CM[color];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0`}>
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