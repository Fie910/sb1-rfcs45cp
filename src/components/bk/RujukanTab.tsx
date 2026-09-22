// src/components/bk/RujukanTab.tsx
// Tab Rujukan Masalah — dari Wali Kelas/Kesiswaan/Guru Mapel/Orang Tua ke BK.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, X, Loader2, Save, Pencil, Trash2,
  UserCheck, User, Calendar, AlertCircle,
  ChevronRight, Shield, CheckCircle2, Clock, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  getStatusRujukanBadge, formatDateShort, isBkManager,
  INPUT_CLASS, LABEL_CLASS, SUMBER_RUJUKAN_OPTIONS,
} from './shared';
import type {
  BkRujukan, BkRujukanWithRelations, Guru, Siswa,
  SumberRujukan, StatusRujukan,
} from '@/types/database';

const PRIORITAS_OPTIONS = ['Rendah', 'Sedang', 'Tinggi'] as const;
const STATUS_OPTIONS: StatusRujukan[] = ['Baru', 'Ditangani', 'Selesai', 'Dirujuk Eksternal'];

const emptyForm = {
  siswa_id: '',
  sumber: 'Wali Kelas' as SumberRujukan,
  alasan: '',
  deskripsi: '',
  prioritas: 'Sedang' as 'Rendah' | 'Sedang' | 'Tinggi',
  guru_bk_id: '',
};

const getPrioritasBadge = (p: string | null): string => {
  switch (p) {
    case 'Tinggi': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'Sedang': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default: return 'bg-slate-800 text-slate-300 border-slate-700';
  }
};

export function RujukanTab() {
  const { guru } = useAuth();
  const isManager = isBkManager(guru?.role);

  const [list, setList] = useState<BkRujukanWithRelations[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrioritas, setFilterPrioritas] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BkRujukan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState<BkRujukanWithRelations | null>(null);
  const [penangananForm, setPenangananForm] = useState({ status: 'Ditangani' as StatusRujukan, catatan: '' });
  const [savingPenanganan, setSavingPenanganan] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BkRujukanWithRelations | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rujukanRes, siswaRes, guruRes] = await Promise.all([
        supabase.from('bk_rujukan').select(`
          *,
          siswa:siswa_id (id, nama_lengkap, nisn, kelas:kelas_id (id, nama_kelas)),
          pengrujuk:pengrujuk_id (id, nama_lengkap),
          guru_bk:guru_bk_id (id, nama_lengkap)
        `).order('tanggal_rujuk', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('siswas').select('id, nisn, nama_lengkap, jenis_kelamin, kelas_id, status, created_at')
          .eq('status', 'AKTIF').order('nama_lengkap'),
        supabase.from('gurus').select('id, nip, nama_lengkap, email, role').order('nama_lengkap'),
      ]);

      if (rujukanRes.error) throw rujukanRes.error;
      setList((rujukanRes.data as unknown as BkRujukanWithRelations[]) || []);
      setSiswaList((siswaRes.data as Siswa[]) || []);
      setGuruList((guruRes.data as Guru[]) || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      showToast('error', 'Gagal memuat rujukan: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterPrioritas && r.prioritas !== filterPrioritas) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          r.alasan.toLowerCase().includes(q) ||
          (r.siswa?.nama_lengkap ?? '').toLowerCase().includes(q) ||
          (r.siswa?.nisn ?? '').toLowerCase().includes(q) ||
          (r.pengrujuk?.nama_lengkap ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [list, filterStatus, filterPrioritas, search]);

  const stats = useMemo(() => ({
    total: list.length,
    baru: list.filter((r) => r.status === 'Baru').length,
    ditangani: list.filter((r) => r.status === 'Ditangani').length,
    selesai: list.filter((r) => r.status === 'Selesai').length,
  }), [list]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, guru_bk_id: guru?.id ?? '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (r: BkRujukanWithRelations) => {
    setEditing(r as BkRujukan);
    setForm({
      siswa_id: String(r.siswa_id),
      sumber: r.sumber,
      alasan: r.alasan,
      deskripsi: r.deskripsi ?? '',
      prioritas: r.prioritas,
      guru_bk_id: r.guru_bk_id ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.siswa_id) { showToast('error', 'Pilih siswa'); return; }
    if (!form.alasan.trim()) { showToast('error', 'Alasan wajib diisi'); return; }

    setSaving(true);
    try {
      const payload = {
        siswa_id: Number(form.siswa_id),
        sumber: form.sumber,
        alasan: form.alasan.trim(),
        deskripsi: form.deskripsi.trim() || null,
        prioritas: form.prioritas,
        guru_bk_id: form.guru_bk_id || null,
      };

      if (editing?.id) {
        const { error } = await supabase.from('bk_rujukan').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logActivity({ aksi: 'UPDATE', modul: AUDIT_MODUL.BK, targetId: editing.id, deskripsi: `Update rujukan: ${payload.alasan.slice(0, 60)}` });
        showToast('success', 'Rujukan diperbarui');
      } else {
        const { data, error } = await supabase.from('bk_rujukan')
          .insert({ ...payload, pengrujuk_id: guru?.id ?? null, tanggal_rujuk: new Date().toISOString().split('T')[0], status: 'Baru' })
          .select().single();
        if (error) throw error;
        await logActivity({ aksi: 'CREATE', modul: AUDIT_MODUL.BK, targetId: data?.id, deskripsi: `Rujukan baru: ${payload.alasan.slice(0, 60)}` });
        showToast('success', 'Rujukan berhasil dibuat');
      }
      setModalOpen(false); fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  const handleOpenDetail = (r: BkRujukanWithRelations) => {
    setDetailTarget(r);
    setPenangananForm({ status: r.status, catatan: r.catatan_penanganan ?? '' });
  };

  const handleSavePenanganan = async () => {
    if (!detailTarget) return;
    setSavingPenanganan(true);
    try {
      const isDone = penangananForm.status === 'Selesai';
      const { error } = await supabase.from('bk_rujukan').update({
        status: penangananForm.status,
        catatan_penanganan: penangananForm.catatan.trim() || null,
        guru_bk_id: detailTarget.guru_bk_id ?? guru?.id ?? null,
        tanggal_selesai: isDone ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', detailTarget.id);
      if (error) throw error;

      await logActivity({ aksi: 'UPDATE', modul: AUDIT_MODUL.BK, targetId: detailTarget.id, deskripsi: `Update penanganan rujukan → ${penangananForm.status}` });
      showToast('success', 'Penanganan diperbarui');
      setDetailTarget(null); fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally { setSavingPenanganan(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('bk_rujukan').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await logActivity({ aksi: 'DELETE', modul: AUDIT_MODUL.BK, targetId: deleteTarget.id, deskripsi: `Hapus rujukan` });
      showToast('success', 'Rujukan dihapus');
      setDeleteTarget(null); fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const resetFilter = () => { setSearch(''); setFilterStatus(''); setFilterPrioritas(''); };
  const hasFilter = search || filterStatus || filterPrioritas;

  const exportHeaders = ['Tanggal', 'Siswa', 'NISN', 'Kelas', 'Sumber', 'Pengrujuk', 'Alasan', 'Prioritas', 'Status', 'Guru BK'];
  const exportRows = filtered.map((r) => [
    r.tanggal_rujuk,
    r.siswa?.nama_lengkap ?? '-',
    r.siswa?.nisn ?? '-',
    r.siswa?.kelas?.nama_kelas ?? '-',
    r.sumber,
    r.pengrujuk?.nama_lengkap ?? '-',
    r.alasan,
    r.prioritas,
    r.status,
    r.guru_bk?.nama_lengkap ?? '-',
  ]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-100 flex items-center gap-2">
            <UserCheck className="text-purple-400" size={20} /> Rujukan Masalah
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {filtered.length} dari {list.length} rujukan ditampilkan
          </p>
        </div>
        <button onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors cursor-pointer">
          <Plus size={14} /> Rujukan Baru
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={UserCheck} label="Total" value={stats.total} color="purple" />
        <KpiCard icon={Clock} label="Baru" value={stats.baru} color="amber" pulse={stats.baru > 0} />
        <KpiCard icon={AlertCircle} label="Ditangani" value={stats.ditangani} color="indigo" />
        <KpiCard icon={CheckCircle2} label="Selesai" value={stats.selesai} color="emerald" />
      </div>

      {/* FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa, alasan, pengrujuk..." className={`${INPUT_CLASS} pl-10`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}>
              <option value="">Semua Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPrioritas} onChange={(e) => setFilterPrioritas(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer text-xs`}>
              <option value="">Semua Prioritas</option>
              {PRIORITAS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {hasFilter && (
            <button onClick={resetFilter}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
              <X size={12} /> Reset
            </button>
          )}
        </div>
        <div className="flex justify-end">
          <ExportImportButtons filename={`rujukan_bk_${new Date().toISOString().slice(0, 10)}`}
            title="Daftar Rujukan BK" headers={exportHeaders} rows={exportRows} showImport={false} />
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Memuat rujukan...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <UserCheck size={44} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-300">
            {hasFilter ? 'Tidak ada rujukan cocok' : 'Belum ada rujukan'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasFilter ? 'Coba reset filter.' : 'Klik "Rujukan Baru" untuk memulai.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id}
              className={`bg-slate-900 border rounded-2xl p-4 transition-all cursor-pointer hover:border-purple-500/40 ${
                r.status === 'Baru' ? 'border-amber-500/30' : 'border-slate-800'
              }`}
              onClick={() => handleOpenDetail(r)}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate">
                      {r.siswa?.nama_lengkap ?? '-'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {r.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {r.siswa?.nisn ?? '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPrioritasBadge(r.prioritas)}`}>
                    {r.prioritas}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusRujukanBadge(r.status)}`}>
                    {r.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-2">
                <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Alasan</p>
                <p className="text-xs text-slate-200 line-clamp-2">{r.alasan}</p>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Shield size={10} />
                    Dari: {r.sumber} — {r.pengrujuk?.nama_lengkap ?? '-'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDateShort(r.tanggal_rujuk)}
                  </span>
                </div>
                {r.status !== 'Selesai' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenDetail(r); }}
                    className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-bold cursor-pointer">
                    Tindak Lanjut <ArrowRight size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL FORM ==================== */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Rujukan' : 'Buat Rujukan Baru'} size="md">
        <div className="space-y-4 pt-1">
          <div>
            <label className={LABEL_CLASS}>Siswa *</label>
            <SearchableSelect
              options={siswaList.map((s) => ({ value: String(s.id), label: s.nama_lengkap, hint: `NISN: ${s.nisn}` }))}
              value={form.siswa_id}
              onChange={(v) => setForm({ ...form, siswa_id: v })}
              placeholder="Pilih siswa..." searchPlaceholder="Cari nama/NISN..."
              emptyMessage="Siswa tidak ditemukan" disabled={!!editing}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Sumber Rujukan *</label>
              <select value={form.sumber} onChange={(e) => setForm({ ...form, sumber: e.target.value as SumberRujukan })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                {SUMBER_RUJUKAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Prioritas</label>
              <select value={form.prioritas} onChange={(e) => setForm({ ...form, prioritas: e.target.value as any })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                {PRIORITAS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Alasan Rujukan *</label>
            <input type="text" value={form.alasan}
              onChange={(e) => setForm({ ...form, alasan: e.target.value })}
              placeholder="Contoh: Siswa sering tidur di kelas, motivasi belajar menurun"
              className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Deskripsi Detail</label>
            <textarea rows={3} value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Rincian situasi, kronologi, atau observasi..."
              className={INPUT_CLASS + ' resize-none'} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Guru BK Penanggung Jawab</label>
            <SearchableSelect
              options={guruList.map((g) => ({ value: g.id, label: g.nama_lengkap, hint: g.nip ? `NIP: ${g.nip}` : undefined }))}
              value={form.guru_bk_id}
              onChange={(v) => setForm({ ...form, guru_bk_id: v })}
              placeholder="Pilih guru BK..."
              searchPlaceholder="Cari guru..." emptyMessage="Guru tidak ditemukan"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editing ? 'Simpan Perubahan' : 'Buat Rujukan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== MODAL DETAIL + TINDAK LANJUT ==================== */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Rujukan & Tindak Lanjut" size="lg">
        {detailTarget && (
          <div className="space-y-4 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <User size={22} />
                </div>
                <div>
                  <p className="font-bold text-slate-100">{detailTarget.siswa?.nama_lengkap ?? '-'}</p>
                  <p className="text-[11px] text-slate-400">
                    {detailTarget.siswa?.kelas?.nama_kelas ?? '-'} · NISN: {detailTarget.siswa?.nisn ?? '-'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPrioritasBadge(detailTarget.prioritas)}`}>
                  Prioritas: {detailTarget.prioritas}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getStatusRujukanBadge(detailTarget.status)}`}>
                  {detailTarget.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Sumber</p>
                <p className="text-slate-200">{detailTarget.sumber}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Pengrujuk</p>
                <p className="text-slate-200">{detailTarget.pengrujuk?.nama_lengkap ?? '-'}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Tanggal Rujuk</p>
                <p className="text-slate-200">{formatDateShort(detailTarget.tanggal_rujuk)}</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Guru BK</p>
                <p className="text-slate-200">{detailTarget.guru_bk?.nama_lengkap ?? '-'}</p>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
              <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Alasan</p>
              <p className="text-xs text-slate-200 leading-relaxed">{detailTarget.alasan}</p>
            </div>

            {detailTarget.deskripsi && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Deskripsi</p>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{detailTarget.deskripsi}</p>
              </div>
            )}

            {/* Form Penanganan */}
            {isManager && detailTarget.status !== 'Selesai' && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <Shield size={13} /> Update Penanganan
                </h4>

                <div>
                  <label className={LABEL_CLASS}>Status Baru</label>
                  <select value={penangananForm.status}
                    onChange={(e) => setPenangananForm({ ...penangananForm, status: e.target.value as StatusRujukan })}
                    className={INPUT_CLASS + ' cursor-pointer'}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Catatan Penanganan</label>
                  <textarea rows={3} value={penangananForm.catatan}
                    onChange={(e) => setPenangananForm({ ...penangananForm, catatan: e.target.value })}
                    placeholder="Catatan tindak lanjut, hasil konseling, atau rekomendasi..."
                    className={INPUT_CLASS + ' resize-none'} />
                </div>

                <div className="flex justify-end">
                  <button onClick={handleSavePenanganan} disabled={savingPenanganan}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer">
                    {savingPenanganan ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Simpan Penanganan
                  </button>
                </div>
              </div>
            )}

            {detailTarget.catatan_penanganan && detailTarget.status === 'Selesai' && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 mb-2 flex items-center gap-2">
                  <CheckCircle2 size={13} /> Catatan Penanganan
                </h4>
                <p className="text-xs text-emerald-100 leading-relaxed whitespace-pre-wrap">
                  {detailTarget.catatan_penanganan}
                </p>
                {detailTarget.tanggal_selesai && (
                  <p className="text-[10px] text-emerald-400/70 mt-2">
                    Diselesaikan: {formatDateShort(detailTarget.tanggal_selesai)}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2.5 pt-4 border-t border-slate-800">
              <div className="flex gap-1.5">
                {isManager && (
                  <>
                    <button onClick={() => { setDetailTarget(null); handleOpenEdit(detailTarget); }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => { setDetailTarget(null); setDeleteTarget(detailTarget); }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-colors cursor-pointer">
                      <Trash2 size={12} /> Hapus
                    </button>
                  </>
                )}
              </div>
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Hapus Rujukan"
        message={`Yakin hapus rujukan untuk "${deleteTarget?.siswa?.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`} />
    </div>
  );
}

// =============================================================================
// KPI CARD
// =============================================================================
type KpiColor = 'purple' | 'amber' | 'indigo' | 'emerald';
const COLOR_MAP: Record<KpiColor, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

function KpiCard({ icon: Icon, label, value, color, pulse = false }: {
  icon: typeof UserCheck; label: string; value: number; color: KpiColor; pulse?: boolean;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3 ${pulse ? 'ring-1 ring-amber-500/40' : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.border} border ${c.text} flex items-center justify-center shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
        <p className={`text-base font-extrabold ${c.text}`}>{value}</p>
      </div>
    </div>
  );
}