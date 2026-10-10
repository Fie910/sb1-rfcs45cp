// src/components/hris/DokumenSection.tsx
// Section Dokumen Pegawai — list + CRUD + upload ke Supabase Storage.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, X, FileText, Eye, Pencil, Trash2,
  UploadCloud, Paperclip, AlertTriangle, ShieldCheck,
  CheckCircle2, ExternalLink, Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal, Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  getKategoriDokumenBadge, getKategoriDokumenIcon, getDokumenExpiryBadge,
  formatDateShort, formatFileSize,
  KATEGORI_DOKUMEN_OPTIONS,
  isHrManager,
} from './shared';
import type { HrisDokumen, KategoriDokumen } from '@/types/database';

const MODUL_HRIS = (AUDIT_MODUL as any)?.HRIS ?? 'HRIS';
const BUCKET = 'hris-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// =============================================================================
// HELPER — Kompres gambar (PDF dilewatkan langsung)
// =============================================================================
const compressImage = (file: File, quality = 0.8, maxWidth = 1600): Promise<File> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      const canvas = document.createElement('canvas');
      let { width, height } = image;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas error')); return; }
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Blob error')); return; }
          const name = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], name, { type: 'image/webp' }));
        },
        'image/webp',
        quality
      );
    };
    image.onerror = reject;
  });
};

// =============================================================================
// TYPES
// =============================================================================
type DokumenSectionProps = {
  guruId: string;
  /** True kalau user adalah pemilik profil atau HR manager */
  editable: boolean;
};

const emptyForm = {
  kategori: 'KTP' as KategoriDokumen,
  nama_dokumen: '',
  nomor_dokumen: '',
  tanggal_terbit: '',
  tanggal_expired: '',
  keterangan: '',
  file_url: '',
};

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export function DokumenSection({ guruId, editable }: DokumenSectionProps) {
  const { guru: currentGuru } = useAuth();
  const isManager = isHrManager(currentGuru?.role);

  const [list, setList] = useState<HrisDokumen[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HrisDokumen | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HrisDokumen | null>(null);
  const [detailTarget, setDetailTarget] = useState<HrisDokumen | null>(null);

  // ==========================================================================
  // FETCH
  // ==========================================================================
  const fetchAll = useCallback(async () => {
    if (!guruId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hris_dokumen')
        .select('*')
        .eq('guru_id', guruId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setList((data as HrisDokumen[]) ?? []);
    } catch (err: any) {
      showToast('error', 'Gagal memuat dokumen: ' + (err.message || 'Error'));
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
      let toUpload = file;
      if (file.type.startsWith('image/')) {
        try { toUpload = await compressImage(file); } catch { /* fallback: upload as-is */ }
      }

      const ext = toUpload.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `${guruId}/${fileName}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, toUpload, { cacheControl: '31536000', upsert: false });
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

  const handleOpenEdit = (doc: HrisDokumen) => {
    setEditing(doc);
    setForm({
      kategori: doc.kategori,
      nama_dokumen: doc.nama_dokumen,
      nomor_dokumen: doc.nomor_dokumen ?? '',
      tanggal_terbit: doc.tanggal_terbit ?? '',
      tanggal_expired: doc.tanggal_expired ?? '',
      keterangan: doc.keterangan ?? '',
      file_url: doc.file_url ?? '',
    });
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nama_dokumen.trim()) {
      showToast('error', 'Nama dokumen wajib diisi');
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
        kategori: form.kategori,
        nama_dokumen: form.nama_dokumen.trim(),
        nomor_dokumen: form.nomor_dokumen.trim() || null,
        tanggal_terbit: form.tanggal_terbit || null,
        tanggal_expired: form.tanggal_expired || null,
        keterangan: form.keterangan.trim() || null,
        file_url: fileUrl,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from('hris_dokumen')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: MODUL_HRIS, targetId: editing.id,
          deskripsi: `Update dokumen: ${payload.nama_dokumen}`,
        });
        showToast('success', 'Dokumen diperbarui');
      } else {
        const { data, error } = await supabase
          .from('hris_dokumen')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: MODUL_HRIS, targetId: data?.id,
          deskripsi: `Upload dokumen: [${payload.kategori}] ${payload.nama_dokumen}`,
        });
        showToast('success', 'Dokumen ditambahkan');
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
      const { error } = await supabase.from('hris_dokumen').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await logActivity({
        aksi: 'DELETE', modul: MODUL_HRIS, targetId: deleteTarget.id,
        deskripsi: `Hapus dokumen: ${deleteTarget.nama_dokumen}`,
      });

      showToast('success', 'Dokumen dihapus');
      setDeleteTarget(null);
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal hapus: ' + (err.message || 'Error'));
    }
  };

  const handleVerify = async (doc: HrisDokumen) => {
    try {
      const newVal = !doc.is_verified;
      const { error } = await supabase
        .from('hris_dokumen')
        .update({
          is_verified: newVal,
          verified_by: newVal ? currentGuru?.id : null,
          verified_at: newVal ? new Date().toISOString() : null,
        })
        .eq('id', doc.id);
      if (error) throw error;
      showToast('success', newVal ? 'Dokumen diverifikasi' : 'Verifikasi dibatalkan');
      fetchAll();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    }
  };

  // ==========================================================================
  // EXPIRY SUMMARY
  // ==========================================================================
  const expirySummary = (() => {
    let expired = 0;
    let soon = 0;
    list.forEach((d) => {
      const badge = getDokumenExpiryBadge(d.tanggal_expired);
      if (!badge) return;
      if (badge.label === 'Expired') expired += 1;
      else soon += 1;
    });
    return { expired, soon };
  })();

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-indigo-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            Dokumen Pegawai ({list.length})
          </h3>
          {expirySummary.expired > 0 && (
            <span className="text-[9px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
              {expirySummary.expired} expired
            </span>
          )}
          {expirySummary.soon > 0 && (
            <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              {expirySummary.soon} akan expired
            </span>
          )}
        </div>
        {editable && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold shadow-sm transition cursor-pointer"
          >
            <Plus size={11} /> Tambah
          </button>
        )}
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="animate-spin text-indigo-400 mx-auto" size={20} />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl">
          <FileText size={24} className="mx-auto text-slate-600 mb-1.5" />
          <p className="text-[11px] text-slate-500">
            {editable ? 'Belum ada dokumen. Klik "Tambah" untuk mulai upload.' : 'Belum ada dokumen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((doc) => {
            const KategoriIcon = getKategoriDokumenIcon(doc.kategori);
            const expiryBadge = getDokumenExpiryBadge(doc.tanggal_expired);

            return (
              <div key={doc.id}
                className="flex items-start gap-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 hover:border-slate-700 transition group">
                {/* ICON */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${getKategoriDokumenBadge(doc.kategori)}`}>
                  <KategoriIcon size={14} />
                </div>

                {/* INFO */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{doc.nama_dokumen}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getKategoriDokumenBadge(doc.kategori)}`}>
                          {doc.kategori}
                        </span>
                        {doc.is_verified ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 size={9} /> Terverifikasi
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                            Belum Diverifikasi
                          </span>
                        )}
                        {expiryBadge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${expiryBadge.style}`}>
                            {expiryBadge.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex items-center gap-1 shrink-0">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer"
                          title="Buka File">
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => setDetailTarget(doc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition cursor-pointer"
                        title="Detail">
                        <Eye size={12} />
                      </button>
                      {editable && (
                        <>
                          {isManager && (
                            <button onClick={() => handleVerify(doc)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                doc.is_verified
                                  ? 'text-emerald-400 hover:bg-emerald-500/10'
                                  : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={doc.is_verified ? 'Batalkan verifikasi' : 'Verifikasi dokumen'}>
                              <ShieldCheck size={12} />
                            </button>
                          )}
                          <button onClick={() => handleOpenEdit(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer"
                            title="Edit">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus">
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* META */}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                    {doc.nomor_dokumen && (
                      <span className="font-mono">No: {doc.nomor_dokumen}</span>
                    )}
                    {doc.tanggal_terbit && (
                      <span>Terbit: {formatDateShort(doc.tanggal_terbit)}</span>
                    )}
                    {doc.tanggal_expired && (
                      <span>Expired: {formatDateShort(doc.tanggal_expired)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MODAL FORM ========== */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Dokumen' : 'Upload Dokumen Baru'} size="md">
        <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
          <div>
            <label className={LABEL_CLASS}>Kategori *</label>
            <select value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value as KategoriDokumen })}
              className={INPUT_CLASS + ' cursor-pointer'}>
              {KATEGORI_DOKUMEN_OPTIONS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Nama Dokumen *</label>
            <input type="text" value={form.nama_dokumen}
              onChange={(e) => setForm({ ...form, nama_dokumen: e.target.value })}
              placeholder="Contoh: SK Pengangkatan Guru Tetap"
              className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS}>Nomor Dokumen</label>
            <input type="text" value={form.nomor_dokumen}
              onChange={(e) => setForm({ ...form, nomor_dokumen: e.target.value })}
              placeholder="Contoh: 800/123/SK/2024"
              className={INPUT_CLASS + ' font-mono'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Tanggal Terbit</label>
              <input type="date" value={form.tanggal_terbit}
                onChange={(e) => setForm({ ...form, tanggal_terbit: e.target.value })}
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tanggal Expired</label>
              <input type="date" value={form.tanggal_expired}
                onChange={(e) => setForm({ ...form, tanggal_expired: e.target.value })}
                className={INPUT_CLASS} />
              <p className="text-[10px] text-slate-500 mt-1">
                Kosongkan jika tidak ada masa berlaku
              </p>
            </div>
          </div>

          {/* UPLOAD FILE */}
          <div>
            <label className={LABEL_CLASS}>File Dokumen</label>

            {/* Preview existing */}
            {form.file_url && !selectedFile && (
              <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
                <Paperclip size={14} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-300 truncate flex-1">File lama tersimpan</span>
                <a href={form.file_url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer">
                  <ExternalLink size={11} />
                </a>
                <button type="button"
                  onClick={() => setForm({ ...form, file_url: '' })}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer">
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Preview new file */}
            {selectedFile && (
              <div className="mb-2 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-xs">
                <Paperclip size={14} className="text-indigo-400 shrink-0" />
                <span className="text-indigo-300 truncate flex-1">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-500">{formatFileSize(selectedFile.size)}</span>
                <button type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer">
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Upload dropzone */}
            {!selectedFile && !form.file_url && (
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
                <UploadCloud size={20} className="text-indigo-400 mb-1" />
                <p className="text-[11px] text-slate-400">Klik untuk upload file</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  PDF, JPG, PNG · Maks 10 MB
                </p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}

            {/* Ganti file */}
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
            <textarea rows={2} value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Catatan tambahan..."
              className={INPUT_CLASS + ' resize-none'} />
          </div>

          {/* FOOTER */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer">
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Upload...</> :
               saving ? <><Loader2 size={14} className="animate-spin" /> Simpan...</> :
               editing ? 'Simpan Perubahan' : 'Upload Dokumen'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========== MODAL DETAIL ========== */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)}
        title="Detail Dokumen" size="md">
        {detailTarget && (
          <div className="space-y-3 pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${getKategoriDokumenBadge(detailTarget.kategori)}`}>
                  {(() => { const I = getKategoriDokumenIcon(detailTarget.kategori); return <I size={20} />; })()}
                </div>
                <div className="min-w-0">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${getKategoriDokumenBadge(detailTarget.kategori)}`}>
                    {detailTarget.kategori}
                  </span>
                  <p className="font-bold text-slate-100 text-sm mt-1">{detailTarget.nama_dokumen}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <DetailBox label="Nomor" value={detailTarget.nomor_dokumen ?? '-'} mono />
              <DetailBox label="Status"
                value={detailTarget.is_verified ? 'Terverifikasi' : 'Belum Verifikasi'}
                valueClass={detailTarget.is_verified ? 'text-emerald-400' : 'text-amber-400'} />
              <DetailBox label="Tanggal Terbit"
                value={detailTarget.tanggal_terbit ? formatDateShort(detailTarget.tanggal_terbit) : '-'} />
              <DetailBox label="Tanggal Expired"
                value={detailTarget.tanggal_expired ? formatDateShort(detailTarget.tanggal_expired) : 'Tidak ada'} />
            </div>

            {detailTarget.keterangan && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Keterangan</p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {detailTarget.keterangan}
                </p>
              </div>
            )}

            {detailTarget.file_url && (
              <a href={detailTarget.file_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer">
                <Download size={14} /> Buka / Download File
              </a>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button onClick={() => setDetailTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Dokumen"
        message={`Yakin hapus "${deleteTarget?.nama_dokumen}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}

function DetailBox({ label, value, valueClass = 'text-slate-200', mono = false }: {
  label: string; value: string; valueClass?: string; mono?: boolean;
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">{label}</p>
      <p className={`text-xs font-semibold truncate ${valueClass} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}