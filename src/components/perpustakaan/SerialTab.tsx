// src/components/perpustakaan/SerialTab.tsx
// Tab Serial — manajemen majalah/jurnal/koran/buletin.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Pencil, Trash2, Filter, Newspaper,
  BookMarked, FileText, BookOpen, Library, Power, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import { ModalSerial } from './ModalSerial';
import {
  getJenisSerialBadge, getJenisSerialIcon, isPustakawan,
  formatDateShort, INPUT_CLASS, JENIS_SERIAL_OPTIONS,
} from './shared';
import type { PerpusSerial, PerpusSerialWithRelations, PerpusRak, JenisSerial } from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

export function SerialTab() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const [list, setList] = useState<PerpusSerialWithRelations[]>([]);
  const [rakList, setRakList] = useState<PerpusRak[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PerpusSerial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerpusSerialWithRelations | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [serialRes, rakRes] = await Promise.all([
        supabase.from('perpus_serial').select(`
          *, rak:rak_id (id, nama, lokasi)
        `).order('tanggal_terbit', { ascending: false }),
        supabase.from('perpus_rak').select('*').eq('is_aktif', true).order('nama'),
      ]);
      if (serialRes.error) throw serialRes.error;
      setList((serialRes.data as unknown as PerpusSerialWithRelations[]) || []);
      setRakList((rakRes.data as PerpusRak[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat serial: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return list.filter((s) => {
      if (filterJenis && s.jenis !== filterJenis) return false;
      if (!showInactive && !s.is_aktif) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.nama.toLowerCase().includes(q) ||
          (s.penerbit ?? '').toLowerCase().includes(q) ||
          (s.edisi ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [list, filterJenis, search, showInactive]);

  const stats = useMemo(() => {
    return {
      total: list.length,
      majalah: list.filter((s) => s.jenis === 'Majalah').length,
      jurnal: list.filter((s) => s.jenis === 'Jurnal').length,
      koran: list.filter((s) => s.jenis === 'Koran').length,
      eksemplar: list.reduce((sum, s) => sum + s.jumlah, 0),
    };
  }, [list]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('perpus_serial').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({
        aksi: 'DELETE', modul: MODUL_PERPUS, targetId: deleteTarget.id,
        deskripsi: `Hapus serial: ${deleteTarget.nama}`,
      });
      showToast('success', 'Serial dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) { showToast('error', 'Gagal: ' + (err.message || 'Error')); }
  };

  const handleToggleAktif = async (s: PerpusSerialWithRelations) => {
    try {
      const { error } = await supabase.from('perpus_serial')
        .update({ is_aktif: !s.is_aktif }).eq('id', s.id);
      if (error) throw error;
      showToast('success', s.is_aktif ? 'Serial dinonaktifkan' : 'Serial diaktifkan');
      fetchAll();
    } catch (err: any) { showToast('error', 'Gagal: ' + (err.message || 'Error')); }
  };

  const resetFilter = () => { setSearch(''); setFilterJenis(''); };
  const hasFilter = search || filterJenis;

  const exportHeaders = ['Jenis', 'Nama', 'Penerbit', 'Edisi', 'Tgl Terbit', 'Jumlah', 'Rak', 'Status'];
  const exportRows = filtered.map((s) => [
    s.jenis, s.nama, s.penerbit ?? '-', s.edisi ?? '-',
    s.tanggal_terbit ?? '-', s.jumlah, s.rak?.nama ?? '-', s.is_aktif ? 'Aktif' : 'Nonaktif',
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Newspaper className="text-indigo-400" size={20} /> Majalah & Jurnal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} serial ditampilkan
          </p>
        </div>
        {isManager && (
          <button onClick={() => { setEditingItem(null); setModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
            <Plus size={14} /> Tambah Serial
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={Library} label="Total Serial" value={stats.total} color="indigo" />
        <KpiCard icon={BookMarked} label="Majalah" value={stats.majalah} color="pink" />
        <KpiCard icon={FileText} label="Jurnal" value={stats.jurnal} color="purple" />
        <KpiCard icon={Newspaper} label="Koran" value={stats.koran} color="sky" />
        <KpiCard icon={BookOpen} label="Eksemplar" value={stats.eksemplar} color="emerald" />
      </div>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, penerbit, edisi..."
              className={`${INPUT_CLASS} pl-10`} />
          </div>
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="">Semua Jenis</option>
            {JENIS_SERIAL_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-indigo-500 cursor-pointer" />
            <span className="text-[11px] text-slate-400">Tampilkan nonaktif</span>
          </label>
          <ExportImportButtons
            filename={`serial_perpus_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Serial Perpustakaan"
            headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat serial...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <Newspaper size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada serial cocok' : 'Belum ada serial terdaftar'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Tambah Serial" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const JenisIcon = getJenisSerialIcon(s.jenis);
            return (
              <div key={s.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition ${
                  !s.is_aktif ? 'border-slate-800/60 opacity-60' : 'border-slate-800 hover:border-indigo-500/40'
                }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${getJenisSerialBadge(s.jenis)}`}>
                      <JenisIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${getJenisSerialBadge(s.jenis)}`}>
                        {s.jenis}
                      </span>
                      <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                        {s.edisi ?? 'Tanpa edisi'}
                      </p>
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleToggleAktif(s)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          s.is_aktif ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-slate-800'
                        }`}
                        title={s.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}>
                        <Power size={12} />
                      </button>
                      <button onClick={() => { setEditingItem(s as PerpusSerial); setModalOpen(true); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeleteTarget(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-slate-100 text-sm leading-tight mb-2 line-clamp-2">
                  {s.nama}
                </h3>

                <div className="space-y-1 text-[11px] text-slate-400">
                  {s.penerbit && <p>Penerbit: {s.penerbit}</p>}
                  {s.tanggal_terbit && (
                    <p className="flex items-center gap-1">
                      <Calendar size={10} /> {formatDateShort(s.tanggal_terbit)}
                    </p>
                  )}
                  {s.rak && <p>Rak: {s.rak.nama}</p>}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Jumlah</span>
                  <span className="text-base font-extrabold text-indigo-400">{s.jumlah}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSerial
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingItem(null); }}
        serial={editingItem}
        rakList={rakList}
        onSaved={fetchAll}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Serial"
        message={`Yakin hapus "${deleteTarget?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

type KpiColor = 'indigo' | 'pink' | 'purple' | 'sky' | 'emerald';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  sky: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Library; label: string; value: number; color: KpiColor;
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