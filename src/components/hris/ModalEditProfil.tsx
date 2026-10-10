// src/components/hris/ModalEditProfil.tsx
// Form edit profil pegawai (biodata + kontak + bank + BPJS + darurat + personal).

import { useState, useEffect } from 'react';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  AGAMA_OPTIONS, GOLONGAN_DARAH_OPTIONS, STATUS_PERNIKAHAN_OPTIONS,
  JENIS_PTK_OPTIONS, STATUS_KEPEGAWAIAN_OPTIONS,
} from './shared';

const MODUL_HRIS = (AUDIT_MODUL as any)?.HRIS ?? 'HRIS';

// =============================================================================
// TYPES
// =============================================================================
type ModalEditProfilProps = {
  open: boolean;
  onClose: () => void;
  guru: any;
  profil: any;
  onSaved: () => void;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalEditProfil({ open, onClose, guru, profil, onSaved }: ModalEditProfilProps) {
  const isAdmin = true; // TODO: cek role di parent

  const [guruForm, setGuruForm] = useState({
    nip: '',
    nama_lengkap: '',
    email: '',
    jenis_ptk: '',
    status_kepegawaian: '',
    tanggal_bergabung: '',    
  });

  const [profilForm, setProfilForm] = useState({
    nik: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: '',
    agama: '',
    golongan_darah: '',
    status_pernikahan: '',
    jumlah_anak: '0',
    no_hp: '',
    email_pribadi: '',
    alamat_ktp: '',
    alamat_domisili: '',
    nama_kontak_darurat: '',
    hubungan_kontak_darurat: '',
    no_hp_darurat: '',
    bank_nama: '',
    bank_nomor_rekening: '',
    bank_atas_nama: '',
    bpjs_kesehatan_no: '',
    bpjs_ketenagakerjaan_no: '',
    npwp: '',
    tinggi_badan: '',
    berat_badan: '',
    hobi: '',
    motto_hidup: '',
    catatan: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGuruForm({
      nip: guru?.nip ?? '',
      nama_lengkap: guru?.nama_lengkap ?? '',
      email: guru?.email ?? '',
      jenis_ptk: guru?.jenis_ptk ?? '',
      status_kepegawaian: guru?.status_kepegawaian ?? '',
      tanggal_bergabung: guru?.tanggal_bergabung ?? '',      
    });
    setProfilForm({
      nik: profil?.nik ?? '',
      tempat_lahir: profil?.tempat_lahir ?? '',
      tanggal_lahir: profil?.tanggal_lahir ?? '',
      jenis_kelamin: profil?.jenis_kelamin ?? '',
      agama: profil?.agama ?? '',
      golongan_darah: profil?.golongan_darah ?? '',
      status_pernikahan: profil?.status_pernikahan ?? '',
      jumlah_anak: String(profil?.jumlah_anak ?? 0),
      no_hp: profil?.no_hp ?? '',
      email_pribadi: profil?.email_pribadi ?? '',
      alamat_ktp: profil?.alamat_ktp ?? '',
      alamat_domisili: profil?.alamat_domisili ?? '',
      nama_kontak_darurat: profil?.nama_kontak_darurat ?? '',
      hubungan_kontak_darurat: profil?.hubungan_kontak_darurat ?? '',
      no_hp_darurat: profil?.no_hp_darurat ?? '',
      bank_nama: profil?.bank_nama ?? '',
      bank_nomor_rekening: profil?.bank_nomor_rekening ?? '',
      bank_atas_nama: profil?.bank_atas_nama ?? '',
      bpjs_kesehatan_no: profil?.bpjs_kesehatan_no ?? '',
      bpjs_ketenagakerjaan_no: profil?.bpjs_ketenagakerjaan_no ?? '',
      npwp: profil?.npwp ?? '',
      tinggi_badan: profil?.tinggi_badan ? String(profil.tinggi_badan) : '',
      berat_badan: profil?.berat_badan ? String(profil.berat_badan) : '',
      hobi: profil?.hobi ?? '',
      motto_hidup: profil?.motto_hidup ?? '',
      catatan: profil?.catatan ?? '',
    });
  }, [open, guru, profil]);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!guru?.id) return;
    if (!guruForm.nama_lengkap.trim()) {
      showToast('error', 'Nama lengkap wajib diisi');
      return;
    }

    setSaving(true);
    try {
      // 1. Update gurus
      const guruPayload = {
        nip: guruForm.nip.trim() || null,
        nama_lengkap: guruForm.nama_lengkap.trim(),
        email: guruForm.email.trim() || guru.email,
        jenis_ptk: guruForm.jenis_ptk || null,
        status_kepegawaian: guruForm.status_kepegawaian || null,
        tanggal_bergabung: guruForm.tanggal_bergabung || null,        
      };

      const { error: guruErr } = await supabase
        .from('gurus')
        .update(guruPayload)
        .eq('id', guru.id);
      if (guruErr) throw guruErr;

      // 2. Upsert hris_profil_pegawai
      const profilPayload: any = {
        id: guru.id,
        nik: profilForm.nik.trim() || null,
        tempat_lahir: profilForm.tempat_lahir.trim() || null,
        tanggal_lahir: profilForm.tanggal_lahir || null,
        jenis_kelamin: profilForm.jenis_kelamin || null,
        agama: profilForm.agama || null,
        golongan_darah: profilForm.golongan_darah || null,
        status_pernikahan: profilForm.status_pernikahan || null,
        jumlah_anak: Number(profilForm.jumlah_anak) || 0,
        no_hp: profilForm.no_hp.trim() || null,
        email_pribadi: profilForm.email_pribadi.trim() || null,
        alamat_ktp: profilForm.alamat_ktp.trim() || null,
        alamat_domisili: profilForm.alamat_domisili.trim() || null,
        nama_kontak_darurat: profilForm.nama_kontak_darurat.trim() || null,
        hubungan_kontak_darurat: profilForm.hubungan_kontak_darurat.trim() || null,
        no_hp_darurat: profilForm.no_hp_darurat.trim() || null,
        bank_nama: profilForm.bank_nama.trim() || null,
        bank_nomor_rekening: profilForm.bank_nomor_rekening.trim() || null,
        bank_atas_nama: profilForm.bank_atas_nama.trim() || null,
        bpjs_kesehatan_no: profilForm.bpjs_kesehatan_no.trim() || null,
        bpjs_ketenagakerjaan_no: profilForm.bpjs_ketenagakerjaan_no.trim() || null,
        npwp: profilForm.npwp.trim() || null,
        tinggi_badan: profilForm.tinggi_badan ? Number(profilForm.tinggi_badan) : null,
        berat_badan: profilForm.berat_badan ? Number(profilForm.berat_badan) : null,
        hobi: profilForm.hobi.trim() || null,
        motto_hidup: profilForm.motto_hidup.trim() || null,
        catatan: profilForm.catatan.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: profilErr } = await supabase
        .from('hris_profil_pegawai')
        .upsert(profilPayload, { onConflict: 'id' });
      if (profilErr) throw profilErr;

      await logActivity({
        aksi: profil ? 'UPDATE' : 'CREATE',
        modul: MODUL_HRIS,
        targetId: guru.id,
        deskripsi: `Update profil pegawai: ${guruForm.nama_lengkap}`,
      });

      showToast('success', 'Profil berhasil disimpan');
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal open={open} onClose={onClose}
      title={profil ? 'Edit Profil Pegawai' : 'Lengkapi Profil Pegawai'} size="lg">
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* SECTION: KEPEGAWAIAN */}
        <Section title="Data Kepegawaian">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nama Lengkap *">
              <input type="text" value={guruForm.nama_lengkap}
                onChange={(e) => setGuruForm({ ...guruForm, nama_lengkap: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
            <Field label="NIP">
              <input type="text" value={guruForm.nip}
                onChange={(e) => setGuruForm({ ...guruForm, nip: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Jenis PTK">
              <select value={guruForm.jenis_ptk}
                onChange={(e) => setGuruForm({ ...guruForm, jenis_ptk: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                {JENIS_PTK_OPTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </Field>
            <Field label="Status Kepegawaian">
              <select value={guruForm.status_kepegawaian}
                onChange={(e) => setGuruForm({ ...guruForm, status_kepegawaian: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                {STATUS_KEPEGAWAIAN_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal Bergabung">
              <input type="date" value={guruForm.tanggal_bergabung}
                onChange={(e) => setGuruForm({ ...guruForm, tanggal_bergabung: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={guruForm.email}
                onChange={(e) => setGuruForm({ ...guruForm, email: e.target.value })}
                className={INPUT_CLASS} />
            </Field>            
          </div>
        </Section>

        {/* SECTION: BIODATA */}
        <Section title="Biodata">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="NIK">
              <input type="text" value={profilForm.nik}
                onChange={(e) => setProfilForm({ ...profilForm, nik: e.target.value })}
                placeholder="16 digit NIK"
                className={INPUT_CLASS + ' font-mono'} />
            </Field>
            <Field label="Jenis Kelamin">
              <select value={profilForm.jenis_kelamin}
                onChange={(e) => setProfilForm({ ...profilForm, jenis_kelamin: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tempat Lahir">
              <input type="text" value={profilForm.tempat_lahir}
                onChange={(e) => setProfilForm({ ...profilForm, tempat_lahir: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
            <Field label="Tanggal Lahir">
              <input type="date" value={profilForm.tanggal_lahir}
                onChange={(e) => setProfilForm({ ...profilForm, tanggal_lahir: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Agama">
              <select value={profilForm.agama}
                onChange={(e) => setProfilForm({ ...profilForm, agama: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                {AGAMA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Golongan Darah">
              <select value={profilForm.golongan_darah}
                onChange={(e) => setProfilForm({ ...profilForm, golongan_darah: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                {GOLONGAN_DARAH_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status Pernikahan">
              <select value={profilForm.status_pernikahan}
                onChange={(e) => setProfilForm({ ...profilForm, status_pernikahan: e.target.value })}
                className={INPUT_CLASS + ' cursor-pointer'}>
                <option value="">-- Pilih --</option>
                {STATUS_PERNIKAHAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Jumlah Anak">
              <input type="number" min={0} value={profilForm.jumlah_anak}
                onChange={(e) => setProfilForm({ ...profilForm, jumlah_anak: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>
        </Section>

        {/* SECTION: KONTAK */}
        <Section title="Kontak">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="No. HP">
              <input type="tel" value={profilForm.no_hp}
                onChange={(e) => setProfilForm({ ...profilForm, no_hp: e.target.value })}
                placeholder="08123456789"
                className={INPUT_CLASS} />
            </Field>
            <Field label="Email Pribadi">
              <input type="email" value={profilForm.email_pribadi}
                onChange={(e) => setProfilForm({ ...profilForm, email_pribadi: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>

          <Field label="Alamat KTP">
            <textarea rows={2} value={profilForm.alamat_ktp}
              onChange={(e) => setProfilForm({ ...profilForm, alamat_ktp: e.target.value })}
              className={INPUT_CLASS + ' resize-none'} />
          </Field>

          <Field label="Alamat Domisili">
            <textarea rows={2} value={profilForm.alamat_domisili}
              onChange={(e) => setProfilForm({ ...profilForm, alamat_domisili: e.target.value })}
              placeholder="Kosongkan jika sama dengan alamat KTP"
              className={INPUT_CLASS + ' resize-none'} />
          </Field>
        </Section>

        {/* SECTION: KONTAK DARURAT */}
        <Section title="Kontak Darurat">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Nama">
              <input type="text" value={profilForm.nama_kontak_darurat}
                onChange={(e) => setProfilForm({ ...profilForm, nama_kontak_darurat: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
            <Field label="Hubungan">
              <input type="text" value={profilForm.hubungan_kontak_darurat}
                onChange={(e) => setProfilForm({ ...profilForm, hubungan_kontak_darurat: e.target.value })}
                placeholder="Suami, Istri, Ayah, dll"
                className={INPUT_CLASS} />
            </Field>
            <Field label="No. HP">
              <input type="tel" value={profilForm.no_hp_darurat}
                onChange={(e) => setProfilForm({ ...profilForm, no_hp_darurat: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>
        </Section>

        {/* SECTION: BANK & BPJS */}
        <Section title="Bank, BPJS & NPWP">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Bank">
              <input type="text" value={profilForm.bank_nama}
                onChange={(e) => setProfilForm({ ...profilForm, bank_nama: e.target.value })}
                placeholder="BCA, BRI, Mandiri..."
                className={INPUT_CLASS} />
            </Field>
            <Field label="No. Rekening">
              <input type="text" value={profilForm.bank_nomor_rekening}
                onChange={(e) => setProfilForm({ ...profilForm, bank_nomor_rekening: e.target.value })}
                className={INPUT_CLASS + ' font-mono'} />
            </Field>
            <Field label="Atas Nama">
              <input type="text" value={profilForm.bank_atas_nama}
                onChange={(e) => setProfilForm({ ...profilForm, bank_atas_nama: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="BPJS Kesehatan">
              <input type="text" value={profilForm.bpjs_kesehatan_no}
                onChange={(e) => setProfilForm({ ...profilForm, bpjs_kesehatan_no: e.target.value })}
                className={INPUT_CLASS + ' font-mono'} />
            </Field>
            <Field label="BPJS Ketenagakerjaan">
              <input type="text" value={profilForm.bpjs_ketenagakerjaan_no}
                onChange={(e) => setProfilForm({ ...profilForm, bpjs_ketenagakerjaan_no: e.target.value })}
                className={INPUT_CLASS + ' font-mono'} />
            </Field>
            <Field label="NPWP">
              <input type="text" value={profilForm.npwp}
                onChange={(e) => setProfilForm({ ...profilForm, npwp: e.target.value })}
                className={INPUT_CLASS + ' font-mono'} />
            </Field>
          </div>
        </Section>

        {/* SECTION: PERSONAL */}
        <Section title="Info Personal (Opsional)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tinggi Badan (cm)">
              <input type="number" min={0} value={profilForm.tinggi_badan}
                onChange={(e) => setProfilForm({ ...profilForm, tinggi_badan: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
            <Field label="Berat Badan (kg)">
              <input type="number" min={0} value={profilForm.berat_badan}
                onChange={(e) => setProfilForm({ ...profilForm, berat_badan: e.target.value })}
                className={INPUT_CLASS} />
            </Field>
          </div>
          <Field label="Hobi">
            <input type="text" value={profilForm.hobi}
              onChange={(e) => setProfilForm({ ...profilForm, hobi: e.target.value })}
              className={INPUT_CLASS} />
          </Field>
          <Field label="Motto Hidup">
            <input type="text" value={profilForm.motto_hidup}
              onChange={(e) => setProfilForm({ ...profilForm, motto_hidup: e.target.value })}
              className={INPUT_CLASS} />
          </Field>
          <Field label="Catatan">
            <textarea rows={2} value={profilForm.catatan}
              onChange={(e) => setProfilForm({ ...profilForm, catatan: e.target.value })}
              className={INPUT_CLASS + ' resize-none'} />
          </Field>
        </Section>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Simpan Profil
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// SUB-KOMPONEN
// =============================================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      {children}
    </div>
  );
}