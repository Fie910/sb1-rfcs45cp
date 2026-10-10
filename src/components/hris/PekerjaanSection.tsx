// src/components/hris/PekerjaanSection.tsx
// Section Riwayat Pekerjaan (Internal & Eksternal).

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, X, Briefcase, Pencil, Trash2,
  ExternalLink, UploadCloud, Paperclip, Building2, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  formatDateShort, formatFileSize,
  JENIS_PEKERJAAN_OPTIONS,
} from './shared';
import type { HrisPekerjaan, JenisPekerjaan } from '@/types/database';

const BUCKET = 'hris-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// HELPER BADGE (inline, biar tidak perlu ubah shared.tsx)
// =============================================================================
function getJenisPekerjaanBadge(jenis: JenisPekerjaan | string | null | undefined): string {
  switch (jenis) {
    case 'Internal':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'Eksternal':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  guruId: string;
  editable: boolean;
};

const emptyForm = {
  jenis: 'Eksternal' as JenisPekerjaan,
  nama_perusahaan: '',
  posisi: '',
  bidang: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  alasan_keluar: '',
  keterangan: '',
  file_url: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function PekerjaanSection({ guruId, editable }: Props) {
  const [list, setList] = useState<HrisPekerjaan[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HrisPekerjaan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HrisPekerjaan | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guruId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hris_pekerjaan')
        .select('*')
        .eq('guru_id', guruId)
        .order('tanggal_mulai', { ascending: false });
      if (error) throw error;
      setList((data as HrisPekerjaan[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  }, [guruId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ==========================================================================
  // UPLOAD
  // ==========================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setSelectedFile(null); return; }
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'Ukuran file maksimal 10 MB');
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const fileName = `pekerjaan-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `${guruId}/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '31536000', upsert: false });
      if (error) { showToast('error', 'Upload gagal: ' + error.message); return null; }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      showToast('error', 'Gagal proses file: ' + (err.message || 'Error'));
      return null;
    }
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: HrisPekerjaan) => {
    setEditing(item);
    setForm({
      jenis: item.jenis,
      nama_perusahaan: item.nama_perusahaan,
      posisi: item.posisi ?? '',
      bidang: item.bidang ?? '',
      tanggal_mulai: item.tanggal_mulai ?? '',
      tanggal_selesai: item.tanggal_selesai ?? '',
      alasan_keluar: item.alasan_keluar ?? '',
      keterangan: item.keterangan ?? '',
      file_url: item.file_url ?? '',
    });
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nama_perusahaan.trim()) {
      showToast('error', 'Nama perusahaan/instansi wajib diisi');
      return;
    }

    setSaving(true);
    try {
      let fileUrl: string | null = form.file_url || null;
      if (selectedFile) {
        setUploading(true);
        const uploaded = await uploadFile(selectedFile);
        setUploading(false);
        if (!uploaded) { setSaving(false); return; }
        fileUrl = uploaded;
      }

      const payload = {
        guru_id: guruId,
        jenis: form.jenis,
        nama_perusahaan: form.nama_perusahaan.trim(),
        posisi: form.posisi.trim() || null,
        bidang: form.bidang.trim() || null,
        tanggal_mulai: form.tanggal_mulai || null,
        tanggal_selesai: form.tanggal_selesai || null,
        alasan_keluar: form.alasan_keluar.trim() || null,
        keterangan: form.keterangan.trim() || null,
        file_url: fileUrl,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from('hris_pekerjaan')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: editing.id,
          deskripsi: `Update riwayat pekerjaan: ${payload.nama_perusahaan}`,
        });
        showToast('success', 'Riwayat pekerjaan diperbarui');
      } else {
        const { data, error } = await supabase
          .from('hris_pekerjaan')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: data?.id,
          deskripsi: `Tambah riwayat pekerjaan: [${payload.jenis}] ${payload.nama_perusahaan}`,
        });
        showToast('success', 'Riwayat pekerjaan ditambahkan');
      }

      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('hris_pekerjaan')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE',
        modul: AUDIT_MODUL.HRIS,
        targetId: deleteTarget.id,
        deskripsi: `Hapus riwayat pekerjaan: ${deleteTarget.nama_perusahaan}`,
      });
      showToast('success', 'Riwayat pekerjaan dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  // Ringkasan: total tahun pengalaman (kasar, dari semua pekerjaan)
  const stats = (() => {
    const total = list.length;
    const internal = list.filter((p) => p.jenis === 'Internal').length;
    const eksternal = list.filter((p) => p.jenis === 'Eksternal').length;
    return { total, internal, eksternal };
  })();

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Riwayat Pekerjaan ({list.length})
          </h3>
          {stats.internal > 0 && (
            <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              {stats.internal} internal
            </span>
          )}
          {stats.eksternal > 0 && (
            <span className="text-[9px] font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              {stats.eksternal} eksternal
            </span>
          )}
        </div>
        {editable && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold shadow-sm transition cursor-pointer"
          >
            <Plus size={11} /> Tambah
          </button>
        )}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="animate-spin text-amber-400 mx-auto" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
          <Briefcase size={24} className="mx-auto text-slate-600 mb-1.5" />
          <p className="text-[11px] text-slate-500">
            {editable ? 'Belum ada riwayat pekerjaan. Klik "Tambah".' : 'Belum ada riwayat pekerjaan.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((item) => {
            const masihBekerja = !item.tanggal_selesai;
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-slate-700 transition"
              >
                {/* ICON */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${getJenisPekerjaanBadge(item.jenis)}`}
                >
                  <Building2 size={14} />
                </div>

                {/* INFO */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getJenisPekerjaanBadge(item.jenis)}`}
                        >
                          {item.jenis}
                        </span>
                        {masihBekerja && (
                          <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            Masih Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-200 mt-1 truncate">
                        {item.nama_perusahaan}
                      </p>
                      {(item.posisi || item.bidang) && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.posisi}
                          {item.posisi && item.bidang ? ' · ' : ''}
                          {item.bidang}
                        </p>
                      )}
                    </div>

                    {/* ACTIONS */}
                    {editable && (
                      <div className="flex items-center gap-1 shrink-0">
                        {item.file_url && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                            title="Buka File"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* META */}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                    {(item.tanggal_mulai || item.tanggal_selesai) && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={9} />
                        {item.tanggal_mulai ? formatDateShort(item.tanggal_mulai) : '?'}
                        {' — '}
                        {item.tanggal_selesai ? formatDateShort(item.tanggal_selesai) : 'sekarang'}
                      </span>
                    )}
                    {item.alasan_keluar && (
                      <span className="italic truncate max-w-[200px]">
                        Keluar: {item.alasan_keluar}
                      </span>
                    )}
                  </div>

                  {item.keterangan && (
                    <p className="text-[10px] text-slate-500 mt-1 truncate italic">
                      {item.keterangan}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MODAL FORM ========== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Riwayat Pekerjaan' : 'Tambah Riwayat Pekerjaan'}
        size="md"
      >
        <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
          <div>
            <label className={LABEL_CLASS}>Jenis *</label>
            <select
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisPekerjaan })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {JENIS_PEKERJAAN_OPTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Pilih <span className="text-emerald-400 font-bold">Internal</span> jika pengalaman di SMK KH. A. Wahab Muhsin,{' '}
              <span className="text-indigo-400 font-bold">Eksternal</span> jika di institusi lain.
            </p>
          </div>

          <div>
            <label className={LABEL_CLASS}>Nama Perusahaan / Instansi *</label>
            <input
              type="text"
              value={form.nama_perusahaan}
              onChange={(e) => setForm({ ...form, nama_perusahaan: e.target.value })}
              placeholder="Contoh: PT Teknologi Nusantara"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Posisi / Jabatan</label>
              <input
                type="text"
                value={form.posisi}
                onChange={(e) => setForm({ ...form, posisi: e.target.value })}
                placeholder="Contoh: Guru Matematika"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Bidang</label>
              <input
                type="text"
                value={form.bidang}
                onChange={(e) => setForm({ ...form, bidang: e.target.value })}
                placeholder="Contoh: Pendidikan / IT"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Mulai</label>
              <input
                type="date"
                value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tanggal Selesai</label>
              <input
                type="date"
                value={form.tanggal_selesai}
                onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                className={INPUT_CLASS}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Kosongkan jika masih bekerja
              </p>
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Alasan Keluar</label>
            <input
              type="text"
              value={form.alasan_keluar}
              onChange={(e) => setForm({ ...form, alasan_keluar: e.target.value })}
              placeholder="Contoh: Kontrak habis, pindah domisili, dll"
              className={INPUT_CLASS}
            />
          </div>

          {/* UPLOAD FILE */}
          <div>
            <label className={LABEL_CLASS}>File Pendukung (SK / Kontrak / Paklaring)</label>

            {form.file_url && !selectedFile && (
              <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
                <Paperclip size={14} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-300 truncate flex-1">File lama tersimpan</span>
                <a
                  href={form.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  <ExternalLink size={11} />
                </a>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, file_url: '' })}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {selectedFile && (
              <div className="mb-2 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-xs">
                <Paperclip size={14} className="text-indigo-400 shrink-0" />
                <span className="text-indigo-300 truncate flex-1">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-500">{formatFileSize(selectedFile.size)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {!selectedFile && !form.file_url && (
              <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-slate-800 hover:border-amber-500/40 bg-slate-950/50 hover:bg-amber-500/5 transition-all cursor-pointer">
                <UploadCloud size={18} className="text-amber-400 mb-1" />
                <p className="text-[11px] text-slate-400">Klik untuk upload</p>
                <p className="text-[10px] text-slate-500 mt-0.5">PDF, JPG, PNG · Maks 10 MB</p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}

            {(form.file_url || selectedFile) && (
              <label className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer">
                <UploadCloud size={11} /> Ganti File
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div>
            <label className={LABEL_CLASS}>Keterangan</label>
            <textarea
              rows={2}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan..."
              className={INPUT_CLASS + ' resize-none'}
            />
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {uploading ? (
                <><Loader2 size={14} className="animate-spin" /> Upload...</>
              ) : saving ? (
                <><Loader2 size={14} className="animate-spin" /> Simpan...</>
              ) : editing ? (
                'Simpan Perubahan'
              ) : (
                'Tambah Pekerjaan'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Riwayat Pekerjaan"
        message={`Yakin hapus "${deleteTarget?.nama_perusahaan}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}