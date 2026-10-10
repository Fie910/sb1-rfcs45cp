// src/components/bk/KotakCurhatTab.tsx
// Tab Kotak Curhat — siswa bercerita (anonim/terbuka), BK membalas.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  X,
  Heart,
  Send,
  Loader2,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  UserCircle,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Shield,
  Save,
  MessageCircle,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  getStatusCurhatBadge,
  getUrgensiBadge,
  getBidangBadge,
  formatDateTimeWib,
  isBkManager,
  INPUT_CLASS,
  LABEL_CLASS,
  URGENSI_OPTIONS,
} from './shared';
import type {
  BkCurhat,
  BkCurhatWithRelations,
  BkKategoriMasalah,
  Siswa,
  TingkatUrgensi,
  StatusCurhat,
} from '@/types/database';

// =============================================================================
// HELPER
// =============================================================================

function generateAlias(): string {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `Anonim #${code}`;
}

function excerpt(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + '…';
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================

export function KotakCurhatTab() {
  const { guru } = useAuth();
  const isManager = isBkManager(guru?.role);

  const [list, setList] = useState<BkCurhatWithRelations[]>([]);
  const [kategoriList, setKategoriList] = useState<BkKategoriMasalah[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUrgensi, setFilterUrgensi] = useState('');

  // Split-pane selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    siswa_id: '',
    is_anonim: false,
    alias: '',
    pesan: '',
    kategori_id: '',
    tingkat_urgensi: 'Sedang' as TingkatUrgensi,
  });
  const [saving, setSaving] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<StatusCurhat>('Dibalas');
  const [replying, setReplying] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<BkCurhatWithRelations | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [curhatRes, kategoriRes, siswaRes] = await Promise.all([
        supabase
          .from('bk_curhat')
          .select(`
            *,
            siswa:siswa_id (id, nama_lengkap, nisn),
            guru_bk:guru_bk_id (id, nama_lengkap),
            kategori:kategori_id (id, nama, bidang)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('bk_kategori_masalah').select('*').order('nama'),
        supabase
          .from('siswas')
          .select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at')
          .eq('status', 'AKTIF')
          .order('nama_lengkap'),
      ]);

      if (curhatRes.error) throw curhatRes.error;

      setList((curhatRes.data as unknown as BkCurhatWithRelations[]) || []);
      setKategoriList((kategoriRes.data as BkKategoriMasalah[]) || []);
      setSiswaList((siswaRes.data as Siswa[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat curhat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ==========================================================================
  // FILTER + STATS
  // ==========================================================================
  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterUrgensi && c.tingkat_urgensi !== filterUrgensi) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const displayName = c.is_anonim
          ? c.alias ?? 'Anonim'
          : c.siswa?.nama_lengkap ?? '';
        const hit =
          c.pesan.toLowerCase().includes(q) ||
          displayName.toLowerCase().includes(q) ||
          (c.kategori?.nama ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    });
  }, [list, filterStatus, filterUrgensi, search]);

  const stats = useMemo(() => {
    const total = list.length;
    const baru = list.filter((c) => c.status === 'Baru').length;
    const darurat = list.filter((c) => c.tingkat_urgensi === 'Darurat').length;
    const tinggi = list.filter((c) => c.tingkat_urgensi === 'Tinggi').length;
    const selesai = list.filter((c) => c.status === 'Selesai').length;
    return { total, baru, darurat, tinggi, selesai };
  }, [list]);

  // ==========================================================================
  // SELECTED ITEM
  // ==========================================================================
  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // Set default reply state saat pilih item
  useEffect(() => {
    if (selected) {
      setReplyText(selected.balasan ?? '');
      setReplyStatus(selected.balasan ? 'Selesai' : 'Dibalas');

      // Auto-tandai "Dibaca" saat dibuka & masih "Baru"
      if (selected.status === 'Baru' && isManager) {
        supabase
          .from('bk_curhat')
          .update({ status: 'Dibaca' })
          .eq('id', selected.id)
          .then(() => {
            setList((prev) =>
              prev.map((c) => (c.id === selected.id ? { ...c, status: 'Dibaca' } : c))
            );
          });
      }
    }
  }, [selected, isManager]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCompose = () => {
    setComposeForm({
      siswa_id: '',
      is_anonim: false,
      alias: '',
      pesan: '',
      kategori_id: '',
      tingkat_urgensi: 'Sedang',
    });
    setComposeOpen(true);
  };

  const handleToggleAnonim = (checked: boolean) => {
    setComposeForm((f) => ({
      ...f,
      is_anonim: checked,
      alias: checked ? f.alias || generateAlias() : '',
      siswa_id: checked ? '' : f.siswa_id,
    }));
  };

  const handleSubmitCompose = async () => {
    if (!composeForm.pesan.trim()) {
      showToast('error', 'Pesan curhat tidak boleh kosong');
      return;
    }
    if (!composeForm.is_anonim && !composeForm.siswa_id) {
      showToast('error', 'Pilih siswa atau tandai sebagai anonim');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siswa_id: composeForm.is_anonim ? null : Number(composeForm.siswa_id),
        is_anonim: composeForm.is_anonim,
        alias: composeForm.is_anonim ? composeForm.alias || generateAlias() : null,
        pesan: composeForm.pesan.trim(),
        kategori_id: composeForm.kategori_id || null,
        tingkat_urgensi: composeForm.tingkat_urgensi,
        status: 'Baru' as StatusCurhat,
      };

      const { data, error } = await supabase
        .from('bk_curhat')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.BK,
        targetId: data?.id,
        deskripsi: `Curhat baru (${payload.is_anonim ? 'anonim' : 'terbuka'}) — urgensi ${payload.tingkat_urgensi}`,
      });

      showToast('success', 'Curhat berhasil dicatat');
      setComposeOpen(false);
      fetchAll();
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!selected) return;
    if (!replyText.trim()) {
      showToast('error', 'Balasan tidak boleh kosong');
      return;
    }

    setReplying(true);
    try {
      const { error } = await supabase
        .from('bk_curhat')
        .update({
          balasan: replyText.trim(),
          guru_bk_id: guru?.id,
          tanggal_balas: new Date().toISOString(),
          status: replyStatus,
        })
        .eq('id', selected.id);
      if (error) throw error;

      await logActivity({
        aksi: 'UPDATE',
        modul: AUDIT_MODUL.BK,
        targetId: selected.id,
        deskripsi: `Balas curhat — status: ${replyStatus}`,
      });

      showToast('success', 'Balasan terkirim');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setReplying(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('bk_curhat')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.BK,
        targetId: deleteTarget.id,
        deskripsi: 'Hapus curhat',
      });

      showToast('success', 'Curhat dihapus');
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => {
    setSearch('');
    setFilterStatus('');
    setFilterUrgensi('');
  };

  const hasFilter = search || filterStatus || filterUrgensi;

  // ==========================================================================
  // EXPORT
  // ==========================================================================
  const exportHeaders = [
    'Tanggal',
    'Pengirim',
    'Anonim',
    'Kategori',
    'Urgensi',
    'Pesan',
    'Balasan',
    'Guru BK',
    'Status',
  ];
  const exportRows = filtered.map((c) => [
    formatDateTimeWib(c.created_at),
    c.is_anonim ? c.alias ?? 'Anonim' : c.siswa?.nama_lengkap ?? '-',
    c.is_anonim ? 'Ya' : 'Tidak',
    c.kategori?.nama ?? '-',
    c.tingkat_urgensi,
    c.pesan,
    c.balasan ?? '-',
    c.guru_bk?.nama_lengkap ?? '-',
    c.status,
  ]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (!isManager) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 text-center space-y-3">
        <Shield size={40} className="mx-auto text-amber-400" />
        <h2 className="text-lg font-bold text-amber-300">Akses Terbatas</h2>
        <p className="text-xs text-amber-400/80 max-w-md mx-auto">
          Kotak Curhat hanya dapat diakses oleh Guru BK, Kepala Sekolah, Wakil
          Kepala, dan Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <Heart className="text-purple-400" size={20} />
            Kotak Curhat
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} curhat ditampilkan
          </p>
        </div>
        <button
          onClick={handleOpenCompose}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Catat Curhat
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={MessageCircle}
          label="Total Curhat"
          value={stats.total}
          color="purple"
        />
        <KpiCard icon={AlertCircle} label="Baru" value={stats.baru} color="indigo" />
        <KpiCard
          icon={AlertCircle}
          label="Darurat"
          value={stats.darurat}
          color="rose"
          pulse={stats.darurat > 0}
        />
        <KpiCard
          icon={AlertCircle}
          label="Prioritas Tinggi"
          value={stats.tinggi}
          color="amber"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Selesai"
          value={stats.selesai}
          color="emerald"
        />
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
              placeholder="Cari pesan, pengirim, kategori..."
              className={`${INPUT_CLASS} pl-10`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Status</option>
              <option value="Baru">Baru</option>
              <option value="Dibaca">Dibaca</option>
              <option value="Dibalas">Dibalas</option>
              <option value="Selesai">Selesai</option>
            </select>

            <select
              value={filterUrgensi}
              onChange={(e) => setFilterUrgensi(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}
            >
              <option value="">Semua Urgensi</option>
              {URGENSI_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {hasFilter && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <X size={12} /> Reset
            </button>
          )}
        </div>

        <div className="flex justify-end">
          <ExportImportButtons
            filename={`kotak_curhat_${new Date().toISOString().slice(0, 10)}`}
            title="Laporan Kotak Curhat BK"
            headers={exportHeaders}
            rows={exportRows}
            showImport={false}
          />
        </div>
      </div>

      {/* SPLIT-PANE */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Memuat curhat...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
          {/* ==================== LEFT: LIST ==================== */}
          <div
            className={`lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col ${
              mobileDetailOpen ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-3 border-b border-slate-800 bg-slate-950/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Daftar Curhat
              </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Heart size={36} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-300">
                    {hasFilter ? 'Tidak ada curhat cocok' : 'Belum ada curhat'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {hasFilter
                      ? 'Coba reset filter.'
                      : 'Klik "Catat Curhat" untuk memulai.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filtered.map((c) => {
                    const isSelected = selectedId === c.id;
                    const displayName = c.is_anonim
                      ? c.alias ?? 'Anonim'
                      : c.siswa?.nama_lengkap ?? '-';

                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedId(c.id);
                          setMobileDetailOpen(true);
                        }}
                        className={`w-full text-left p-3 hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          isSelected ? 'bg-purple-500/[0.08] border-l-2 border-purple-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              c.is_anonim
                                ? 'bg-slate-800 border-slate-700 text-slate-400'
                                : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                            }`}
                          >
                            {c.is_anonim ? <Lock size={14} /> : <User size={14} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <p className="text-xs font-bold text-slate-200 truncate">
                                {displayName}
                              </p>
                              <span
                                className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getUrgensiBadge(
                                  c.tingkat_urgensi
                                )}`}
                              >
                                {c.tingkat_urgensi}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                              {excerpt(c.pesan, 100)}
                            </p>

                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${getStatusCurhatBadge(
                                    c.status
                                  )}`}
                                >
                                  {c.status}
                                </span>
                                {c.kategori && (
                                  <span
                                    className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${getBidangBadge(
                                      c.kategori.bidang
                                    )}`}
                                  >
                                    {c.kategori.bidang}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-500 shrink-0">
                                {formatDateTimeWib(c.created_at).split(',')[1]?.trim() ??
                                  ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ==================== RIGHT: DETAIL ==================== */}
          <div
            className={`lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-col ${
              mobileDetailOpen ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {!selected ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div>
                  <MessageCircle
                    size={44}
                    className="mx-auto text-slate-700 mb-3"
                  />
                  <p className="text-sm font-bold text-slate-300">
                    Pilih curhat untuk melihat detail
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Klik salah satu item di daftar sebelah kiri.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Detail Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        onClick={() => setMobileDetailOpen(false)}
                        className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          selected.is_anonim
                            ? 'bg-slate-800 border-slate-700 text-slate-400'
                            : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                        }`}
                      >
                        {selected.is_anonim ? <Lock size={16} /> : <User size={16} />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-100 truncate">
                          {selected.is_anonim
                            ? selected.alias ?? 'Anonim'
                            : selected.siswa?.nama_lengkap ?? '-'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {formatDateTimeWib(selected.created_at)}
                          </span>
                          {selected.is_anonim ? (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Lock size={9} /> Anonim
                            </span>
                          ) : selected.siswa?.nisn ? (
                            <span className="font-mono">
                              NISN: {selected.siswa.nisn}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getUrgensiBadge(
                          selected.tingkat_urgensi
                        )}`}
                      >
                        {selected.tingkat_urgensi}
                      </span>
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusCurhatBadge(
                          selected.status
                        )}`}
                      >
                        {selected.status}
                      </span>
                      <button
                        onClick={() => setDeleteTarget(selected)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Hapus curhat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {selected.kategori && (
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBidangBadge(
                        selected.kategori.bidang
                      )}`}
                    >
                      {selected.kategori.nama}
                    </span>
                  )}
                </div>

                {/* Detail Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {/* Pesan Siswa */}
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                      {selected.is_anonim ? <Lock size={13} /> : <User size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-sm p-3.5">
                        <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {selected.pesan}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {formatDateTimeWib(selected.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Balasan BK (kalau sudah ada) */}
                  {selected.balasan && (
                    <div className="flex gap-2.5 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <Shield size={13} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-end">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl rounded-tr-sm p-3.5 max-w-full">
                          <p className="text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed">
                            {selected.balasan}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {selected.guru_bk?.nama_lengkap ?? 'Guru BK'} ·{' '}
                          {selected.tanggal_balas
                            ? formatDateTimeWib(selected.tanggal_balas)
                            : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
                  {selected.balasan && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                      <CheckCircle2 size={12} />
                      Sudah pernah dibalas — Anda dapat memperbarui balasan di
                      bawah
                    </div>
                  )}

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield size={13} />
                    </div>
                    <div className="flex-1">
                      <textarea
                        rows={3}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Tulis balasan yang penuh empati dan solutif..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-slate-400">
                        Status:
                      </label>
                      <select
                        value={replyStatus}
                        onChange={(e) =>
                          setReplyStatus(e.target.value as StatusCurhat)
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Dibalas">Dibalas</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Dibaca">Dibaca</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSubmitReply}
                      disabled={replying || !replyText.trim()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {replying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {selected.balasan ? 'Perbarui Balasan' : 'Kirim Balasan'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: COMPOSE ==================== */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Catat Curhat Baru"
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Heart size={16} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-purple-300">
                Ruang Aman & Empatik
              </p>
              <p className="text-[11px] text-purple-400/80 mt-0.5 leading-relaxed">
                Curhat dapat dicatat secara terbuka (dengan nama siswa) atau
                anonim. Untuk curhat dari portal siswa, akan muncul otomatis di
                sini.
              </p>
            </div>
          </div>

          {/* Toggle Anonim */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleToggleAnonim(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                !composeForm.is_anonim
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <User size={14} /> Terbuka
            </button>
            <button
              type="button"
              onClick={() => handleToggleAnonim(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                composeForm.is_anonim
                  ? 'bg-slate-800 border-slate-600 text-slate-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <Lock size={14} /> Anonim
            </button>
          </div>

          {/* Siswa Picker (kalau terbuka) */}
          {!composeForm.is_anonim && (
            <div>
              <label className={LABEL_CLASS}>Siswa *</label>
              <SearchableSelect
                options={siswaList.map((s) => ({
                  value: String(s.id),
                  label: s.nama_lengkap,
                  hint: `NISN: ${s.nisn}`,
                }))}
                value={composeForm.siswa_id}
                onChange={(v) => setComposeForm({ ...composeForm, siswa_id: v })}
                placeholder="Pilih siswa..."
                searchPlaceholder="Cari nama / NISN..."
                emptyMessage="Siswa tidak ditemukan"
              />
            </div>
          )}

          {/* Alias (kalau anonim) */}
          {composeForm.is_anonim && (
            <div>
              <label className={LABEL_CLASS}>Alias Anonim</label>
              <input
                type="text"
                value={composeForm.alias}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, alias: e.target.value })
                }
                placeholder="Auto-generate: Anonim #XXXX"
                className={INPUT_CLASS}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Alias ini yang akan tampil di daftar. Identitas asli tidak
                tercatat.
              </p>
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>Pesan / Curhat *</label>
            <textarea
              rows={5}
              value={composeForm.pesan}
              onChange={(e) =>
                setComposeForm({ ...composeForm, pesan: e.target.value })
              }
              placeholder="Tuliskan apa yang ingin diceritakan..."
              className={INPUT_CLASS + ' resize-none'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Kategori</label>
              <SearchableSelect
                options={kategoriList.map((k) => ({
                  value: k.id,
                  label: k.nama,
                  hint: k.bidang,
                }))}
                value={composeForm.kategori_id}
                onChange={(v) =>
                  setComposeForm({ ...composeForm, kategori_id: v })
                }
                placeholder="Pilih kategori (opsional)"
                searchPlaceholder="Cari kategori..."
                emptyMessage="Kategori tidak ditemukan"
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Tingkat Urgensi</label>
              <select
                value={composeForm.tingkat_urgensi}
                onChange={(e) =>
                  setComposeForm({
                    ...composeForm,
                    tingkat_urgensi: e.target.value as TingkatUrgensi,
                  })
                }
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {URGENSI_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmitCompose}
              disabled={saving || !composeForm.pesan.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Simpan Curhat
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Curhat"
        message={`Yakin hapus curhat dari "${
          deleteTarget?.is_anonim
            ? deleteTarget?.alias ?? 'Anonim'
            : deleteTarget?.siswa?.nama_lengkap ?? '-'
        }"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================

type KpiColor = 'purple' | 'indigo' | 'rose' | 'amber' | 'emerald';

const COLOR_MAP: Record<KpiColor, { bg: string; text: string; border: string }> = {
  purple: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
  },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  pulse = false,
}: {
  icon: typeof Heart;
  label: string;
  value: number;
  color: KpiColor;
  pulse?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 ${
        pulse ? 'ring-1 ring-rose-500/40' : ''
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${
          pulse ? 'animate-pulse' : ''
        }`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}