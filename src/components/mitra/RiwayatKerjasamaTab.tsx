// src/components/mitra/RiwayatKerjasamaTab.tsx
// Tab Riwayat Kerjasama — list aktivitas (PKL, rekrutmen, dll) + statistik.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, History, Search, Filter, X, Eye, Pencil, Trash2, Plus,
  Building2, Users, Calendar, TrendingUp, FileText, ExternalLink,
  Briefcase, GraduationCap, Award, Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalAktivitasMitra } from './ModalAktivitasMitra';
import {
  getJenisAktivitasBadge, formatTanggal,
  isMitraManager,
  INPUT_CLASS,
} from './shared';
import {
  JENIS_AKTIVITAS_OPTIONS,
} from '@/types/database';
import type {
  MitraAktivitasWithRelations, MitraWithRelations,
} from '@/types/database';

export function RiwayatKerjasamaTab() {
  const { guru } = useAuth();
  const isManager = isMitraManager(guru?.role);

  const [list, setList] = useState<MitraAktivitasWithRelations[]>([]);
  const [mitraList, setMitraList] = useState<MitraWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterMitra, setFilterMitra] = useState('');
  const [filterTahun, setFilterTahun] = useState<string>('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MitraAktivitasWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MitraAktivitasWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aktRes, mitraRes] = await Promise.all([
        supabase
          .from('mitra_aktivitas')
          .select(`
            *,
            mitra:mitra!mitra_id(nama, kode_mitra),
            mou:mou!mou_id(nomor_mou),
            created_by_guru:gurus!created_by(nama_lengkap)
          `)
          .order('tanggal', { ascending: false }),
        supabase
          .from('v_mitra_lengkap')
          .select('*')
          .order('nama'),
      ]);

      if (aktRes.error) throw aktRes.error;

      setList(
        ((aktRes.data as any[]) ?? []).map((a) => ({
          ...a,
          mitra_nama: a.mitra?.nama ?? null,
          kode_mitra: a.mitra?.kode_mitra ?? null,
          mou_nomor: a.mou?.nomor_mou ?? null,
          created_by_nama: a.created_by_guru?.nama_lengkap ?? null,
        }))
      );
      setMitraList((mitraRes.data as MitraWithRelations[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // LIST TAHUN
  // ==========================================================================
  const tahunOptions = useMemo(() => {
    const years = new Set<number>();
    list.forEach((a) => {
      const y = new Date(a.tanggal).getFullYear();
      years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [list]);

  // ==========================================================================
  // FILTER
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((a) => {
      if (filterJenis && a.jenis !== filterJenis) return false;
      if (filterMitra && a.mitra_id !== filterMitra) return false;
      if (filterTahun) {
        const y = new Date(a.tanggal).getFullYear();
        if (String(y) !== filterTahun) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          a.judul.toLowerCase().includes(q) ||
          (a.deskripsi ?? '').toLowerCase().includes(q) ||
          (a.mitra_nama ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterJenis, filterMitra, filterTahun, search]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = list.length;
    const byJenis: Record<string, number> = {};
    list.forEach((a) => {
      byJenis[a.jenis] = (byJenis[a.jenis] ?? 0) + 1;
    });

    const totalSiswaPKL = list
      .filter((a) => a.jenis === 'PKL')
      .reduce((s, a) => s + (a.jumlah_siswa ?? 0), 0);

    const totalSiswaRekrut = list
      .filter((a) => a.jenis === 'Rekrutmen')
      .reduce((s, a) => s + (a.jumlah_siswa ?? 0), 0);

    const totalGuruPelatihan = list
      .filter((a) => a.jenis === 'Pelatihan Guru')
      .reduce((s, a) => s + (a.jumlah_guru ?? 0), 0);

    // Tahun ini
    const thisYear = new Date().getFullYear();
    const tahunIni = list.filter((a) => new Date(a.tanggal).getFullYear() === thisYear).length;

    return {
      total,
      byJenis,
      totalSiswaPKL,
      totalSiswaRekrut,
      totalGuruPelatihan,
      tahunIni,
    };
  }, [list]);

  const resetFilter = () => {
    setSearch(''); setFilterJenis(''); setFilterMitra(''); setFilterTahun('');
  };
  const hasFilter = search || filterJenis || filterMitra || filterTahun;

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    if (mitraList.length === 0) {
      showToast('error', 'Belum ada mitra. Buat mitra dulu di tab Database Mitra.');
      return;
    }
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (item: MitraAktivitasWithRelations) => {
    setEditing(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('mitra_aktivitas')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus aktivitas mitra: ${deleteTarget.judul}`,
      });
      showToast('success', 'Aktivitas dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

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
            <History className="text-indigo-400" size={20} /> Riwayat Kerjasama
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} aktivitas · {stats.tahunIni} tahun ini
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition cursor-pointer active:scale-95"
          >
            <Plus size={16} /> Aktivitas Baru
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={History} label="Total Aktivitas" value={stats.total} color="indigo" />
        <KpiCard icon={Users} label="Siswa PKL" value={stats.totalSiswaPKL} color="emerald" />
        <KpiCard icon={Briefcase} label="Siswa Direkrut" value={stats.totalSiswaRekrut} color="amber" />
        <KpiCard icon={GraduationCap} label="Guru Dilatih" value={stats.totalGuruPelatihan} color="purple" />
      </div>

      {/* DISTRIBUSI JENIS */}
      {Object.keys(stats.byJenis).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
            Distribusi Per Jenis Aktivitas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {JENIS_AKTIVITAS_OPTIONS.filter((j) => (stats.byJenis[j] ?? 0) > 0).map((j) => (
              <button
                key={j}
                onClick={() => setFilterJenis(filterJenis === j ? '' : j)}
                className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                  filterJenis === j
                    ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900'
                    : ''
                } ${getJenisAktivitasBadge(j)}`}
              >
                <p className="text-[10px] font-bold opacity-80 truncate">{j}</p>
                <p className="text-lg font-extrabold mt-0.5">{stats.byJenis[j] ?? 0}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" /> Filter
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
              placeholder="Cari judul atau mitra..."
              className={INPUT_CLASS + ' pl-10'}
            />
          </div>
          <select
            value={filterMitra}
            onChange={(e) => setFilterMitra(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Mitra</option>
            {mitraList.map((m) => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
          <select
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Jenis</option>
            {JENIS_AKTIVITAS_OPTIONS.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="">Semua Tahun</option>
            {tahunOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LIST */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <History size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada aktivitas cocok' : 'Belum ada aktivitas'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <AktivitasCard
              key={item.id}
              item={item}
              isManager={isManager}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* MODAL */}
      <ModalAktivitasMitra
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchAll}
        editing={editing}
        mitraList={mitraList}
        currentGuruId={guru?.id ?? ''}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Aktivitas"
        message={`Yakin hapus "${deleteTarget?.judul}"?`}
      />
    </div>
  );
}

// =============================================================================
// SUB: Card
// =============================================================================
function AktivitasCard({
  item, isManager, onEdit, onDelete,
}: {
  item: MitraAktivitasWithRelations;
  isManager: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-indigo-500/40 transition">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${getJenisAktivitasBadge(item.jenis)}`}>
            <History size={16} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisAktivitasBadge(item.jenis)}`}>
                    {item.jenis}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatTanggal(item.tanggal)}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-100">{item.judul}</p>
              </div>

              {isManager && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={onEdit}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                    title="Edit"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={onDelete}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Hapus"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Mitra */}
            {item.mitra_nama && (
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={11} className="text-slate-500 shrink-0" />
                <p className="text-[11px] text-slate-300 font-semibold truncate">
                  {item.mitra_nama}
                </p>
                {item.kode_mitra && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {item.kode_mitra}
                  </span>
                )}
              </div>
            )}

            {/* Deskripsi */}
            {item.deskripsi && (
              <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">
                {item.deskripsi}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mb-2">
              {item.jumlah_siswa ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                  <Users size={10} /> {item.jumlah_siswa} siswa
                </span>
              ) : null}
              {item.jumlah_guru ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold">
                  <GraduationCap size={10} /> {item.jumlah_guru} guru
                </span>
              ) : null}
              {item.mou_nomor && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  <FileText size={10} /> {item.mou_nomor}
                </span>
              )}
            </div>

            {/* File + created by */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div>
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    <ExternalLink size={10} /> Lihat file
                  </a>
                )}
              </div>
              {item.created_by_nama && (
                <p className="text-[10px] text-slate-500">
                  oleh {item.created_by_nama}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB: KPI
// =============================================================================
type KpiColor = 'indigo' | 'emerald' | 'amber' | 'purple';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof History; label: string; value: number; color: KpiColor;
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