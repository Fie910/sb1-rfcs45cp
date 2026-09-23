// src/components/perpustakaan/InventarisasiTab.tsx
// Tab Inventarisasi — stock opname perpustakaan.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck, Plus, Trash2, Eye, Loader2, Save,
  AlertTriangle, CheckCircle2, XCircle, Book, Filter,
  X, Calendar, User, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  getStatusBadgeInventarisasi, isPustakawan,
  formatDateShort, formatDateLong, INPUT_CLASS, LABEL_CLASS,
} from './shared';
import type {
  PerpusInventarisasi, PerpusBukuWithRelations, Guru,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

export function InventarisasiTab() {
  const { guru } = useAuth();
  const isManager = isPustakawan(guru?.role);

  const [list, setList] = useState<PerpusInventarisasi[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal buat inventarisasi
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'manual' | 'scan'>('manual');
  const [form, setForm] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    petugas_id: '',
    total_buku_sistem: '0',
    total_buku_fisik: '0',
    catatan: '',
    buku_hilang_ids: [] as string[],
  });
  const [bukuList, setBukuList] = useState<PerpusBukuWithRelations[]>([]);
  const [selectedHilang, setSelectedHilang] = useState<Set<string>>(new Set());
  const [searchBuku, setSearchBuku] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail
  const [detailTarget, setDetailTarget] = useState<PerpusInventarisasi | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerpusInventarisasi | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, guruRes, bukuRes] = await Promise.all([
        supabase.from('perpus_inventarisasi').select(`
          *, petugas:petugas_id (id, nama_lengkap, nip)
        `).order('tanggal', { ascending: false }),
        supabase.from('gurus').select('id, nip, nama_lengkap, email, role').order('nama_lengkap'),
        supabase.from('perpus_buku').select('id, kode_buku, judul, pengarang, jumlah_total, jumlah_tersedia, cover_url').eq('is_aktif', true).order('judul'),
      ]);

      if (invRes.error) throw invRes.error;

      setList((invRes.data as unknown as PerpusInventarisasi[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
      setBukuList((bukuRes.data as unknown as PerpusBukuWithRelations[]) || []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat data: ' + (err.message || 'Error'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // STATS
  // ==========================================================================
  const stats = useMemo(() => {
    const total = list.length;
    const draft = list.filter((i) => i.status === 'Draft').length;
    const final = list.filter((i) => i.status === 'Final').length;
    const totalHilang = list.reduce((s, i) => s + Math.abs(i.selisih), 0);
    return { total, draft, final, totalHilang };
  }, [list]);

  // Total buku sistem (dari katalog)
  const totalSistemBuku = useMemo(
    () => bukuList.reduce((sum, b) => sum + (b.jumlah_total ?? 0), 0),
    [bukuList]
  );

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    const nextSeq = list.length + 1;
    setForm({
      tanggal: new Date().toISOString().split('T')[0],
      petugas_id: guru?.id ?? '',
      total_buku_sistem: String(totalSistemBuku),
      total_buku_fisik: String(totalSistemBuku),
      catatan: '',
      buku_hilang_ids: [],
    });
    setSelectedHilang(new Set());
    setSearchBuku('');
    setMode('manual');
    setModalOpen(true);
  };

  const handleToggleHilang = (bukuId: string) => {
    setSelectedHilang((prev) => {
      const next = new Set(prev);
      if (next.has(bukuId)) next.delete(bukuId); else next.add(bukuId);
      return next;
    });
  };

  const handleSubmit = async () => {
    const sistem = Number(form.total_buku_sistem);
    const fisik = Number(form.total_buku_fisik);
    if (sistem < 0 || fisik < 0) {
      showToast('error', 'Jumlah tidak boleh negatif');
      return;
    }

    const selisih = sistem - fisik;
    const hilangIds = Array.from(selectedHilang);

    setSaving(true);
    try {
      const payload = {
        tanggal: form.tanggal,
        petugas_id: form.petugas_id || null,
        total_buku_sistem: sistem,
        total_buku_fisik: fisik,
        selisih: selisih,
        buku_hilang_ids: hilangIds.length > 0 ? hilangIds : null,
        catatan: form.catatan.trim() || null,
        status: 'Draft' as const,
      };

      const { data, error } = await supabase.from('perpus_inventarisasi')
        .insert(payload).select().single();
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE', modul: MODUL_PERPUS, targetId: data?.id,
        deskripsi: `Inventarisasi: sistem ${sistem}, fisik ${fisik}, selisih ${selisih}`,
      });

      showToast('success', `Inventarisasi tercatat. Selisih: ${selisih}`);
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  const handleFinalize = async (inv: PerpusInventarisasi) => {
    if (!window.confirm(
      'Finalisasi akan mengunci data ini dan menandai buku hilang sebagai "Dihapus". Lanjutkan?'
    )) return;

    try {
      // Update status
      const { error } = await supabase.from('perpus_inventarisasi')
        .update({ status: 'Final' }).eq('id', inv.id);
      if (error) throw error;

      // Proses buku hilang
      const hilangIds = (inv.buku_hilang_ids as string[] | null) ?? [];
      if (hilangIds.length > 0) {
        await supabase.from('perpus_buku')
          .update({
            is_aktif: false,
            jumlah_total: 0,
            jumlah_tersedia: 0,
            updated_at: new Date().toISOString(),
          })
          .in('id', hilangIds);
      }

      await logActivity({
        aksi: 'UPDATE', modul: MODUL_PERPUS, targetId: inv.id,
        deskripsi: `Finalisasi inventarisasi: ${hilangIds.length} buku ditandai hilang`,
      });

      showToast('success', 'Inventarisasi difinalisasi');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('perpus_inventarisasi')
        .delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({
        aksi: 'DELETE', modul: MODUL_PERPUS, targetId: deleteTarget.id,
        deskripsi: `Hapus inventarisasi ${deleteTarget.tanggal}`,
      });
      showToast('success', 'Inventarisasi dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // FILTERED BUKU UNTUK MODAL
  // ==========================================================================
  const filteredBuku = useMemo(() => {
    if (!searchBuku.trim()) return bukuList;
    const q = searchBuku.toLowerCase();
    return bukuList.filter(
      (b) =>
        b.judul.toLowerCase().includes(q) ||
        (b.pengarang ?? '').toLowerCase().includes(q) ||
        (b.kode_buku ?? '').toLowerCase().includes(q)
    );
  }, [bukuList, searchBuku]);

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Tanggal', 'Petugas', 'Total Sistem', 'Total Fisik', 'Selisih',
    'Buku Hilang', 'Status', 'Catatan',
  ];
  const exportRows = list.map((i) => [
    i.tanggal,
    (i as any).petugas?.nama_lengkap ?? '-',
    i.total_buku_sistem,
    i.total_buku_fisik,
    i.selisih,
    Array.isArray(i.buku_hilang_ids) ? i.buku_hilang_ids.length : 0,
    i.status,
    i.catatan ?? '-',
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
            <ClipboardCheck className="text-indigo-400" size={20} /> Inventarisasi Buku
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Stock opname — cek fisik koleksi vs data sistem
          </p>
        </div>
        {isManager && (
          <button onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer">
            <Plus size={14} /> Mulai Inventarisasi
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Total Sesi" value={stats.total} color="indigo" />
        <KpiCard icon={AlertTriangle} label="Draft" value={stats.draft} color="amber" />
        <KpiCard icon={CheckCircle2} label="Final" value={stats.final} color="emerald" />
        <KpiCard icon={XCircle} label="Total Buku Hilang" value={stats.totalHilang} color="rose" />
      </div>

      {/* INFO */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-indigo-300/90 leading-relaxed">
          <p className="font-bold mb-0.5">Tentang Stock Opname</p>
          <p className="text-indigo-400/70">
            Total buku sistem saat ini: <strong className="text-indigo-300">{totalSistemBuku} eksemplar</strong>.
            Bandingkan dengan jumlah fisik di rak. Setelah finalisasi, buku yang ditandai hilang
            akan dinonaktifkan dari katalog.
          </p>
        </div>
      </div>

      {/* EXPORT */}
      {list.length > 0 && (
        <div className="flex justify-end">
          <ExportImportButtons
            filename={`inventarisasi_perpus_${new Date().toISOString().slice(0, 10)}`}
            title="Riwayat Inventarisasi Perpustakaan"
            headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      )}

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat riwayat...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <ClipboardCheck size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">Belum ada riwayat inventarisasi</p>
          <p className="text-xs text-slate-500 mt-1">
            Klik "Mulai Inventarisasi" untuk melakukan stock opname.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((inv) => {
            const hilangCount = Array.isArray(inv.buku_hilang_ids) ? inv.buku_hilang_ids.length : 0;
            return (
              <div key={inv.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition ${
                  inv.status === 'Final' ? 'border-emerald-500/30' : 'border-amber-500/30'
                }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      inv.status === 'Final'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    }`}>
                      {inv.status === 'Final' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadgeInventarisasi(inv.status)}`}>
                          {inv.status}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          <Calendar size={10} className="inline mr-1" />
                          {formatDateLong(inv.tanggal)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-1 flex items-center gap-1">
                        <User size={11} className="text-slate-500" />
                        {(inv as any).petugas?.nama_lengkap ?? 'Tanpa petugas'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setDetailTarget(inv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                      title="Detail">
                      <Eye size={14} />
                    </button>
                    {isManager && inv.status === 'Draft' && (
                      <button onClick={() => handleFinalize(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold transition cursor-pointer">
                        <CheckCircle2 size={10} /> Final
                      </button>
                    )}
                    {isManager && (
                      <button onClick={() => setDeleteTarget(inv)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <StatMini label="Sistem" value={inv.total_buku_sistem} color="text-slate-200" />
                  <StatMini label="Fisik" value={inv.total_buku_fisik} color="text-emerald-400" />
                  <StatMini
                    label="Selisih"
                    value={inv.selisih}
                    color={inv.selisih === 0 ? 'text-emerald-400' : inv.selisih > 0 ? 'text-rose-400' : 'text-blue-400'} />
                </div>

                {hilangCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-rose-400 font-bold">
                    <AlertTriangle size={11} />
                    {hilangCount} buku ditandai hilang
                  </div>
                )}

                {inv.catatan && (
                  <p className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 italic leading-relaxed">
                    {inv.catatan}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODAL BUAT INVENTARISASI ==================== */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title="Mulai Inventarisasi Baru" size="lg">
        <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

          {/* TANGGAL & PETUGAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Stock Opname *</label>
              <input type="date" value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Petugas</label>
              <select value={form.petugas_id}
                onChange={(e) => setForm({ ...form, petugas_id: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih Petugas --</option>
                {guruList.map((g) => (
                  <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
                ))}
              </select>
            </div>
          </div>

          {/* JUMLAH */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
              <ClipboardList size={13} /> Hasil Perhitungan
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Total Buku Sistem</label>
                <input type="number" min={0} value={form.total_buku_sistem}
                  onChange={(e) => setForm({ ...form, total_buku_sistem: e.target.value })}
                  className={INPUT_CLASS} />
                <p className="text-[10px] text-slate-500 mt-1">
                  Auto dari katalog ({totalSistemBuku})
                </p>
              </div>
              <div>
                <label className={LABEL_CLASS}>Total Buku Fisik (Hasil Cek)</label>
                <input type="number" min={0} value={form.total_buku_fisik}
                  onChange={(e) => setForm({ ...form, total_buku_fisik: e.target.value })}
                  className={INPUT_CLASS} />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jumlah yang Anda hitung di rak
                </p>
              </div>
            </div>

            {/* LIVE SELISIH */}
            {(() => {
              const sistem = Number(form.total_buku_sistem);
              const fisik = Number(form.total_buku_fisik);
              const selisih = sistem - fisik;
              if (selisih === 0) {
                return (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2 text-[11px] text-emerald-300">
                    <CheckCircle2 size={14} />
                    <span>Selisih 0 — koleksi lengkap ✅</span>
                  </div>
                );
              }
              return (
                <div className={`rounded-xl p-3 flex items-center gap-2 text-[11px] ${
                  selisih > 0
                    ? 'bg-rose-500/5 border border-rose-500/20 text-rose-300'
                    : 'bg-blue-500/5 border border-blue-500/20 text-blue-300'
                }`}>
                  <AlertTriangle size={14} />
                  <span>
                    {selisih > 0
                      ? `Selisih ${selisih} buku — kemungkinan hilang`
                      : `Selisih +${Math.abs(selisih)} buku — ada buku tidak tercatat di sistem`}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* DAFTAR BUKU HILANG */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <XCircle size={13} /> Tandai Buku Hilang ({selectedHilang.size})
              </h4>
            </div>

            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchBuku}
                onChange={(e) => setSearchBuku(e.target.value)}
                placeholder="Cari judul / kode buku..."
                className={INPUT_CLASS + ' pl-9 text-xs'} />
            </div>

            <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {filteredBuku.length === 0 ? (
                <p className="text-center py-4 text-[11px] text-slate-500">Tidak ada buku cocok</p>
              ) : (
                filteredBuku.map((b) => {
                  const isSelected = selectedHilang.has(b.id);
                  return (
                    <button key={b.id} type="button" onClick={() => handleToggleHilang(b.id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg border text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${
                        isSelected
                          ? 'bg-rose-500 border-rose-500 text-white'
                          : 'border-slate-600'
                      }`}>
                        {isSelected && <CheckCircle2 size={12} />}
                      </div>
                      <div className="w-8 h-10 rounded bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {b.cover_url ? (
                          <img src={b.cover_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Book size={12} className="text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-200 truncate">{b.judul}</p>
                        <p className="text-[9px] font-mono text-indigo-400">
                          {b.kode_buku ?? '-'} · Stok: {b.jumlah_total}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedHilang.size > 0 && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <p className="text-[10px] text-rose-400">
                  {selectedHilang.size} buku akan ditandai hilang saat finalisasi
                </p>
                <button type="button"
                  onClick={() => setSelectedHilang(new Set())}
                  className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer">
                  Bersihkan
                </button>
              </div>
            )}
          </div>

          {/* CATATAN */}
          <div>
            <label className={LABEL_CLASS}>Catatan</label>
            <textarea rows={2} value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              placeholder="Catatan hasil stock opname..."
              className={INPUT_CLASS + ' resize-none'} />
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan sebagai Draft
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL DETAIL ==================== */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Inventarisasi" size="md">
        {detailTarget && (
          <div className="space-y-4 pt-1">
            <div className={`border rounded-2xl p-4 ${
              detailTarget.status === 'Final'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  detailTarget.status === 'Final'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}>
                  {detailTarget.status === 'Final' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
                </div>
                <div className="min-w-0">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusBadgeInventarisasi(detailTarget.status)}`}>
                    {detailTarget.status}
                  </span>
                  <p className="font-bold text-slate-100 text-base mt-1">
                    {formatDateLong(detailTarget.tanggal)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Petugas: {(detailTarget as any).petugas?.nama_lengkap ?? '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <StatMini label="Total Sistem" value={detailTarget.total_buku_sistem} color="text-slate-200" />
              <StatMini label="Total Fisik" value={detailTarget.total_buku_fisik} color="text-emerald-400" />
              <StatMini
                label="Selisih"
                value={detailTarget.selisih}
                color={detailTarget.selisih === 0 ? 'text-emerald-400' : detailTarget.selisih > 0 ? 'text-rose-400' : 'text-blue-400'} />
            </div>

            {Array.isArray(detailTarget.buku_hilang_ids) && detailTarget.buku_hilang_ids.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-rose-500 mb-2">
                  Buku Ditandai Hilang ({detailTarget.buku_hilang_ids.length})
                </p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {detailTarget.buku_hilang_ids.map((id: string) => {
                    const b = bukuList.find((x) => x.id === id);
                    return (
                      <div key={id} className="text-[11px] text-slate-300 flex items-center gap-2">
                        <Book size={10} className="text-slate-500" />
                        <span className="truncate">{b?.judul ?? 'Buku terhapus'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {detailTarget.catatan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Catatan</p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {detailTarget.catatan}
                </p>
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
        onConfirm={handleDelete} title="Hapus Inventarisasi"
        message={`Yakin hapus data inventarisasi ${deleteTarget ? formatDateLong(deleteTarget.tanggal) : ''}?`} />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
type KpiColor = 'indigo' | 'amber' | 'emerald' | 'rose';
const CM: Record<KpiColor, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof ClipboardCheck; label: string; value: number; color: KpiColor;
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

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${color}`}>{value}</p>
    </div>
  );
}