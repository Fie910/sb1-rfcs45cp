// src/components/hris/cuti/ModalPengajuanCuti.tsx
// Form pengajuan cuti/izin — dengan logika auto-skip level approval.

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, UploadCloud, X, Paperclip, ExternalLink,
  AlertTriangle, Info, Calendar as CalendarIcon, Sparkles, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  formatFileSize, hitungHariKerja, hitungHariKalender,
  HR_APPROVER_ROLES, KEPSEK_ROLES, KEPALA_DIVISI_ROLES,
} from '../shared';
import type {
  HrisCuti, HrisJenisCuti, Guru, StatusCuti,
} from '@/types/database';

const BUCKET = 'hris-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// AUTO-SKIP LOGIC
// =============================================================================
/**
 * Tentukan level approval pertama berdasarkan role user + konfigurasi jenis cuti.
 *
 * Level mapping:
 *   1 = Atasan Langsung (Kepala Divisi)
 *   2 = HR Manager (takola / staf_takola)
 *   3 = Kepala Sekolah (kepala)
 *   4 = Disetujui (final)
 *
 * Auto-skip:
 *   - Kepala Sekolah       → langsung level 4 (auto-approve)
 *   - HR Manager           → mulai dari level 3 (skip atasan)
 *   - Kepala Divisi        → mulai dari level 2 (skip diri sendiri)
 *   - Guru biasa           → mulai dari level 1
 *
 * Jenis cuti modifier:
 *   - butuh_approval_3level = false → langsung level 4
 *   - skip_level_hr = true          → minimal level 3
 */
function determineStartLevel(
  userRole: string | null | undefined,
  jenis: HrisJenisCuti | null,
): number {
  // 1. Kalau jenis tidak butuh approval berjenjang → auto-approve
  if (jenis && !jenis.butuh_approval_3level) {
    return 4;
  }

  // 2. Base level dari role
  const r = (userRole ?? '').toLowerCase();
  let level = 1;

  if (KEPSEK_ROLES.includes(r)) {
    level = 4; // Kepala Sekolah: auto-approve
  } else if (HR_APPROVER_ROLES.includes(r)) {
    level = 3; // HR Manager: skip ke Kepsek
  } else if (KEPALA_DIVISI_ROLES.includes(r)) {
    level = 2; // Kepala Divisi: skip ke HR
  }

  // 3. Kalau jenis skip_level_hr, naikkan minimal ke 3
  if (jenis?.skip_level_hr && level < 3) {
    level = 3;
  }

  return level;
}

/**
 * Map level → status setelah submission
 *   level 1 → Diajukan (menunggu atasan)
 *   level 2 → Disetujui Atasan (menunggu HR)
 *   level 3 → Disetujui HR (menunggu Kepsek)
 *   level 4 → Disetujui (final)
 */
function statusForLevel(level: number): StatusCuti {
  if (level >= 4) return 'Disetujui';
  if (level === 3) return 'Disetujui HR';
  if (level === 2) return 'Disetujui Atasan';
  return 'Diajukan';
}

/**
 * Label ramah untuk suatu level (dipakai di UI).
 */
function labelForLevel(level: number): string {
  switch (level) {
    case 1: return 'Kepala Divisi (Atasan Langsung)';
    case 2: return 'HR Manager / Takola';
    case 3: return 'Kepala Sekolah';
    case 4: return 'Disetujui Otomatis';
    default: return '-';
  }
}

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: HrisCuti | null;
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip' | 'jenis_ptk'>[];
  jenisList: HrisJenisCuti[];
  guruId: string;
  /** Role user yang sedang login — untuk menentukan auto-skip */
  userRole?: string | null;
};

const emptyForm = {
  jenis_id: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  jumlah_hari: 1,
  jam_mulai: '',
  jam_selesai: '',
  jumlah_jam: 0,
  alasan: '',
  alamat_selama_cuti: '',
  no_hp_selama_cuti: '',
  guru_pengganti_id: '',
  catatan_pengganti: '',
  lampiran_url: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalPengajuanCuti({
  open,
  onClose,
  onSaved,
  editing,
  guruList,
  jenisList,
  guruId,
  userRole,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isEdit = Boolean(editing?.id);
  const isSetengahHari = useMemo(
    () => form.jenis_id === jenisList.find((j) => j.nama === 'Izin Setengah Hari')?.id,
    [form.jenis_id, jenisList]
  );

  const jenisTerpilih = useMemo(
    () => jenisList.find((j) => j.id === form.jenis_id) ?? null,
    [form.jenis_id, jenisList]
  );

  // ✅ HITUNG START LEVEL (reactive ke role + jenis)
  const startLevel = useMemo(
    () => determineStartLevel(userRole, jenisTerpilih),
    [userRole, jenisTerpilih]
  );
  const isAutoApprove = startLevel >= 4;
  const isAutoSkipped = startLevel > 1 && startLevel < 4;

  // Reset form saat modal dibuka
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        jenis_id: editing.jenis_id,
        tanggal_mulai: editing.tanggal_mulai,
        tanggal_selesai: editing.tanggal_selesai,
        jumlah_hari: editing.jumlah_hari,
        jam_mulai: editing.jam_mulai ?? '',
        jam_selesai: editing.jam_selesai ?? '',
        jumlah_jam: editing.jumlah_jam ?? 0,
        alasan: editing.alasan,
        alamat_selama_cuti: editing.alamat_selama_cuti ?? '',
        no_hp_selama_cuti: editing.no_hp_selama_cuti ?? '',
        guru_pengganti_id: editing.guru_pengganti_id ?? '',
        catatan_pengganti: editing.catatan_pengganti ?? '',
        lampiran_url: editing.lampiran_url ?? '',
      });
    } else {
      setForm({
        ...emptyForm,
        jenis_id: jenisList[0]?.id ?? '',
      });
    }
    setSelectedFile(null);
  }, [open, editing, jenisList]);

  // Auto-hitung jumlah hari (reactive)
  useEffect(() => {
    if (!form.tanggal_mulai || !form.tanggal_selesai) return;

    if (isSetengahHari) {
      const jm = parseFloat(form.jam_mulai?.split(':')[0] ?? '0') * 60 +
        parseFloat(form.jam_mulai?.split(':')[1] ?? '0');
      const js = parseFloat(form.jam_selesai?.split(':')[0] ?? '0') * 60 +
        parseFloat(form.jam_selesai?.split(':')[1] ?? '0');
      const jam = Math.max(0, (js - jm) / 60);
      setForm((f) => ({ ...f, jumlah_hari: 0, jumlah_jam: jam }));
      return;
    }

    const jenisNama = jenisTerpilih?.nama ?? '';
    const pakaiKalender = [
      'Cuti Sakit',
      'Cuti Melahirkan',
      'Cuti Keguguran',
      'Cuti Ibadah Haji',
    ].includes(jenisNama);

    const jumlah = pakaiKalender
      ? hitungHariKalender(form.tanggal_mulai, form.tanggal_selesai)
      : hitungHariKerja(form.tanggal_mulai, form.tanggal_selesai);

    setForm((f) => ({ ...f, jumlah_hari: jumlah, jumlah_jam: 0 }));
  }, [
    form.tanggal_mulai,
    form.tanggal_selesai,
    form.jam_mulai,
    form.jam_selesai,
    isSetengahHari,
    jenisTerpilih,
  ]);

  // Auto-fill alamat & HP dari profil pegawai
  useEffect(() => {
    if (!open || isEdit) return;
    (async () => {
      const { data } = await supabase
        .from('hris_profil_pegawai')
        .select('alamat_ktp, alamat_domisili, no_hp')
        .eq('id', guruId)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          alamat_selama_cuti: f.alamat_selama_cuti || data.alamat_ktp || data.alamat_domisili || '',
          no_hp_selama_cuti: f.no_hp_selama_cuti || data.no_hp || '',
        }));
      }
    })();
  }, [open, isEdit, guruId]);

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
      const fileName = `cuti-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
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
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async (submitAsDraft: boolean = false) => {
    if (!form.jenis_id) {
      showToast('error', 'Jenis cuti wajib dipilih');
      return;
    }
    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      showToast('error', 'Tanggal mulai & selesai wajib diisi');
      return;
    }
    if (!form.alasan.trim()) {
      showToast('error', 'Alasan wajib diisi');
      return;
    }
    if (jenisTerpilih?.wajib_lampiran && !form.lampiran_url && !selectedFile) {
      showToast('error', `Jenis ini wajib melampirkan: ${jenisTerpilih.syarat_lampiran ?? 'dokumen'}`);
      return;
    }
    if (jenisTerpilih?.durasi_maksimal_hari && form.jumlah_hari > jenisTerpilih.durasi_maksimal_hari) {
      showToast('error', `Durasi maksimal ${jenisTerpilih.durasi_maksimal_hari} hari`);
      return;
    }

    setSaving(true);
    try {
      // Upload lampiran kalau ada
      let lampiranUrl: string | null = form.lampiran_url || null;
      if (selectedFile) {
        setUploading(true);
        const uploaded = await uploadFile(selectedFile);
        setUploading(false);
        if (!uploaded) { setSaving(false); return; }
        lampiranUrl = uploaded;
      }

      // ✅ Tentukan status & level berdasarkan auto-skip
      const finalLevel = submitAsDraft ? 0 : startLevel;
      const finalStatus: StatusCuti = submitAsDraft ? 'Draft' : statusForLevel(startLevel);

      const payload: any = {
        guru_id: guruId,
        jenis_id: form.jenis_id,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai,
        jumlah_hari: form.jumlah_hari || 1,
        jam_mulai: isSetengahHari && form.jam_mulai ? form.jam_mulai : null,
        jam_selesai: isSetengahHari && form.jam_selesai ? form.jam_selesai : null,
        jumlah_jam: isSetengahHari ? form.jumlah_jam : null,
        alasan: form.alasan.trim(),
        alamat_selama_cuti: form.alamat_selama_cuti.trim() || null,
        no_hp_selama_cuti: form.no_hp_selama_cuti.trim() || null,
        lampiran_url: lampiranUrl,
        guru_pengganti_id: form.guru_pengganti_id || null,
        catatan_pengganti: form.catatan_pengganti.trim() || null,
        mengurangi_saldo_tahunan: jenisTerpilih?.mengurangi_saldo_tahunan ?? false,
        status: finalStatus,
        current_level: finalLevel,
      };

      // ✅ Kalau auto-approve (level 4), isi approved_by & approved_at
      if (!submitAsDraft && isAutoApprove) {
        payload.approved_by = guruId;
        payload.approved_at = new Date().toISOString();
      }

      if (isEdit && editing?.id) {
        const { error } = await supabase
          .from('hris_cuti')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: editing.id,
          deskripsi: `Update pengajuan cuti: ${jenisTerpilih?.nama}`,
        });
        showToast('success', 'Pengajuan diperbarui');
      } else {
        const { data, error } = await supabase
          .from('hris_cuti')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // ✅ Kalau auto-approve, catat di history approval
        if (!submitAsDraft && isAutoApprove && data?.id) {
          await supabase.from('hris_cuti_approval').insert({
            cuti_id: data.id,
            approver_id: guruId,
            approver_role: userRole ?? null,
            level: 4,
            aksi: 'Auto-Skip',
            catatan: `Auto-approve oleh sistem (role: ${userRole ?? 'unknown'})`,
          });
        }

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.HRIS,
          targetId: data?.id,
          deskripsi: `Ajukan cuti: ${jenisTerpilih?.nama} (${form.jumlah_hari} hari) — ${finalStatus}`,
        });

        // Toast message menyesuaikan kondisi
        if (submitAsDraft) {
          showToast('success', 'Disimpan sebagai draft');
        } else if (isAutoApprove) {
          showToast('success', 'Pengajuan langsung disetujui (auto-approve)');
        } else if (isAutoSkipped) {
          showToast(
            'success',
            `Pengajuan dikirim — mulai dari Level ${startLevel} (${labelForLevel(startLevel)})`
          );
        } else {
          showToast('success', 'Pengajuan cuti berhasil dikirim');
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Pengajuan Cuti' : 'Ajukan Cuti / Izin'}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* ✅ INFO BOX — ALUR APPROVAL */}
        {!isEdit && (
          <div
            className={`rounded-xl border p-3 ${
              isAutoApprove
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : isAutoSkipped
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-indigo-500/5 border-indigo-500/20'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {isAutoApprove ? (
                <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : isAutoSkipped ? (
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                {isAutoApprove ? (
                  <>
                    <p className="font-bold text-emerald-300">
                      Pengajuan Anda akan langsung disetujui
                    </p>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Berdasarkan role Anda (<span className="font-mono text-emerald-300">{userRole}</span>),
                      pengajuan tidak memerlukan approval berjenjang.
                    </p>
                  </>
                ) : isAutoSkipped ? (
                  <>
                    <p className="font-bold text-amber-300">
                      Auto-skip aktif — mulai dari Level {startLevel}
                    </p>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Berdasarkan role Anda (<span className="font-mono text-amber-300">{userRole}</span>),
                      pengajuan akan langsung dikirim ke{' '}
                      <span className="font-bold text-amber-200">{labelForLevel(startLevel)}</span>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-indigo-300">
                      Alur approval: 3 level
                    </p>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Level 1: Kepala Divisi → Level 2: HR Manager → Level 3: Kepala Sekolah
                    </p>
                  </>
                )}

                {/* Visualisasi flow (kalau bukan auto-approve) */}
                {!isAutoApprove && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[1, 2, 3].map((lvl) => {
                      const isPast = lvl < startLevel;
                      const isCurrent = lvl === startLevel;
                      const isFuture = lvl > startLevel;
                      return (
                        <div key={lvl} className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isPast
                                ? 'bg-slate-800 text-slate-500 border-slate-700 line-through'
                                : isCurrent
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            {isPast && <CheckCircle2 size={9} />}
                            L{lvl}
                          </span>
                          {lvl < 3 && (
                            <span className="text-slate-600 text-[10px]">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* JENIS CUTI */}
        <div>
          <label className={LABEL_CLASS}>Jenis Cuti / Izin *</label>
          <SearchableSelect
            options={jenisList.map((j) => ({
              value: j.id,
              label: j.nama,
            }))}
            value={form.jenis_id}
            onChange={(v) => setForm({ ...form, jenis_id: v })}
            placeholder="Pilih jenis..."
            searchPlaceholder="Cari jenis cuti..."
            emptyMessage="Jenis tidak ditemukan"
          />
          {jenisTerpilih?.deskripsi && (
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0" />
              {jenisTerpilih.deskripsi}
            </p>
          )}
        </div>

        {/* PERIODE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Mulai *</label>
            <input
              type="date"
              value={form.tanggal_mulai}
              onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
              required
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Tanggal Selesai *</label>
            <input
              type="date"
              value={form.tanggal_selesai}
              onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
              min={form.tanggal_mulai}
              required
            />
          </div>
        </div>

        {/* SETENGAH HARI — JAM */}
        {isSetengahHari && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
            <div>
              <label className={LABEL_CLASS}>Jam Mulai</label>
              <input
                type="time"
                value={form.jam_mulai}
                onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })}
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Jam Selesai</label>
              <input
                type="time"
                value={form.jam_selesai}
                onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })}
                className={INPUT_CLASS + ' font-mono'}
              />
            </div>
            <p className="sm:col-span-2 text-[11px] text-cyan-300 flex items-center gap-1.5">
              <Info size={11} />
              Total jam: <span className="font-bold">{form.jumlah_jam} jam</span> (tidak dipotong saldo)
            </p>
          </div>
        )}

        {/* INFO DURASI */}
        {!isSetengahHari && form.jumlah_hari > 0 && (
          <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-2.5">
            <CalendarIcon size={13} />
            <span>
              Durasi: <span className="font-bold">{form.jumlah_hari} hari</span>
              {jenisTerpilih?.mengurangi_saldo_tahunan && (
                <span className="text-amber-400 ml-2">
                  (memotong saldo cuti tahunan)
                </span>
              )}
            </span>
          </div>
        )}

        {/* PERINGATAN DURASI MAKSIMAL */}
        {jenisTerpilih?.durasi_maksimal_hari &&
          form.jumlah_hari > jenisTerpilih.durasi_maksimal_hari && (
            <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                Durasi melebihi batas maksimal {jenisTerpilih.durasi_maksimal_hari} hari
                untuk jenis ini.
              </span>
            </div>
          )}

        {/* ALASAN */}
        <div>
          <label className={LABEL_CLASS}>Alasan *</label>
          <textarea
            rows={2}
            value={form.alasan}
            onChange={(e) => setForm({ ...form, alasan: e.target.value })}
            placeholder="Contoh: Acara keluarga di luar kota"
            className={INPUT_CLASS + ' resize-none'}
            required
          />
        </div>

        {/* ALAMAT & HP SELAMA CUTI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Alamat Selama Cuti</label>
            <textarea
              rows={2}
              value={form.alamat_selama_cuti}
              onChange={(e) => setForm({ ...form, alamat_selama_cuti: e.target.value })}
              placeholder="Alamat yang bisa dihubungi"
              className={INPUT_CLASS + ' resize-none'}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>No. HP Selama Cuti</label>
            <input
              type="tel"
              value={form.no_hp_selama_cuti}
              onChange={(e) => setForm({ ...form, no_hp_selama_cuti: e.target.value })}
              placeholder="08123456789"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* LAMPIRAN */}
        <div>
          <label className={LABEL_CLASS}>
            Lampiran{' '}
            {jenisTerpilih?.wajib_lampiran && (
              <span className="text-rose-400">*</span>
            )}
          </label>
          {jenisTerpilih?.syarat_lampiran && (
            <p className="text-[11px] text-slate-500 mb-2">
              {jenisTerpilih.syarat_lampiran}
            </p>
          )}

          {form.lampiran_url && !selectedFile && (
            <div className="mb-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs">
              <Paperclip size={14} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-300 truncate flex-1">File lama tersimpan</span>
              <a href={form.lampiran_url} target="_blank" rel="noreferrer"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer">
                <ExternalLink size={11} />
              </a>
              <button type="button"
                onClick={() => setForm({ ...form, lampiran_url: '' })}
                className="p-1 rounded text-slate-400 hover:text-rose-400 transition cursor-pointer">
                <X size={11} />
              </button>
            </div>
          )}

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

          {!selectedFile && !form.lampiran_url && (
            <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/50 hover:bg-indigo-500/5 transition-all cursor-pointer">
              <UploadCloud size={18} className="text-indigo-400 mb-1" />
              <p className="text-[11px] text-slate-400">Klik untuk upload file</p>
              <p className="text-[10px] text-slate-500 mt-0.5">PDF, JPG, PNG · Maks 10 MB</p>
              <input type="file" accept="image/*,application/pdf"
                onChange={handleFileChange} className="hidden" />
            </label>
          )}

          {(form.lampiran_url || selectedFile) && (
            <label className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 transition cursor-pointer">
              <UploadCloud size={11} /> Ganti File
              <input type="file" accept="image/*,application/pdf"
                onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>

        {/* PENGGANTI (opsional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Guru Pengganti (Opsional)</label>
            <SearchableSelect
              options={guruList
                .filter((g) => g.id !== guruId)
                .map((g) => ({
                  value: g.id,
                  label: `${g.nama_lengkap}${g.nip ? ` · ${g.nip}` : ''}`,
                }))}
              value={form.guru_pengganti_id}
              onChange={(v) => setForm({ ...form, guru_pengganti_id: v })}
              placeholder="Pilih pengganti..."
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Catatan untuk Pengganti</label>
            <input
              type="text"
              value={form.catatan_pengganti}
              onChange={(e) => setForm({ ...form, catatan_pengganti: e.target.value })}
              placeholder="Catatan tugas..."
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={saving || uploading}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Simpan Draft
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving || uploading}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition disabled:opacity-50 cursor-pointer ${
              isAutoApprove
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Upload...</>
            ) : saving ? (
              <><Loader2 size={14} className="animate-spin" /> Simpan...</>
            ) : isAutoApprove ? (
              <><Sparkles size={14} /> {isEdit ? 'Simpan' : 'Ajukan & Setujui'}</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan' : 'Ajukan'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}