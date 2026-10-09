// src/components/tahfidz/ModalTarget.tsx
// Form set/edit target hafalan siswa.

import { useState, useEffect } from 'react';
import { Loader2, Save, Target, User } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import type { TahfidzTarget } from '@/types/database';

type SiswaOption = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_nama: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  siswa: SiswaOption | null;
  existingTarget: TahfidzTarget | null;
  tahunAjaranAktif: any;
};

export function ModalTarget({
  open,
  onClose,
  onSaved,
  siswa,
  existingTarget,
  tahunAjaranAktif,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    target_juz: '',
    target_halaman: '',
    target_surah: '',
    surah_mulai: '' as string,
    ayat_mulai: '' as string,
    surah_selesai: '' as string,
    ayat_selesai: '' as string,
    semester: 'Ganjil' as 'Ganjil' | 'Genap',
    catatan: '',
  });

  useEffect(() => {
    if (!open) return;
    if (existingTarget) {
      setForm({
        target_juz: existingTarget.target_juz?.toString() ?? '',
        target_halaman: existingTarget.target_halaman?.toString() ?? '',
        target_surah: existingTarget.target_surah?.toString() ?? '',
        surah_mulai: existingTarget.surah_mulai?.toString() ?? '',
        ayat_mulai: existingTarget.ayat_mulai?.toString() ?? '',
        surah_selesai: existingTarget.surah_selesai?.toString() ?? '',
        ayat_selesai: existingTarget.ayat_selesai?.toString() ?? '',
        semester: (existingTarget.semester as any) ?? 'Ganjil',
        catatan: existingTarget.catatan ?? '',
      });
    } else {
      setForm({
        target_juz: '',
        target_halaman: '',
        target_surah: '',
        semester: (tahunAjaranAktif?.semester as any) ?? 'Ganjil',
        catatan: '',
      });
    }
  }, [open, existingTarget, tahunAjaranAktif]);

  const hasRange =
  existingTarget.surah_mulai != null && existingTarget.ayat_mulai != null &&
  existingTarget.surah_selesai != null && existingTarget.ayat_selesai != null;

  const handleSave = async () => {
    if (!siswa) return;
    const tJuz = form.target_juz ? Number(form.target_juz) : null;
    const tHal = form.target_halaman ? Number(form.target_halaman) : null;
    const tSur = form.target_surah ? Number(form.target_surah) : null;

    if (!tJuz && !tHal && !tSur) {
      showToast('error', 'Isi minimal salah satu target');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siswa_id: siswa.id,
        tahun_ajaran_id: tahunAjaranAktif?.id ?? null,
        semester: form.semester,
        target_juz: tJuz,
        target_halaman: tHal,
        target_surah: tSur,
        catatan: form.catatan || null,
      };

      if (existingTarget) {
        const { error } = await supabase
          .from('tahfidz_target')
          .update(payload)
          .eq('id', existingTarget.id);
        if (error) throw error;
        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.TAHFIDZ,
          targetId: existingTarget.id,
          deskripsi: `Update target tahfidz: ${siswa.nama_lengkap}`,
        });
        showToast('success', 'Target diperbarui');
      } else {
        const { error } = await supabase.from('tahfidz_target').insert(payload);
        if (error) throw error;
        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.TAHFIDZ,
          deskripsi: `Set target tahfidz: ${siswa.nama_lengkap}`,
        });
        showToast('success', 'Target disimpan');
      }

      onSaved();
    } catch (err: any) {
      showToast('error', 'Gagal simpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existingTarget ? 'Edit Target' : 'Set Target Hafalan'}
      size="md"
    >
      <div className="space-y-4">
        {/* Siswa */}
        {siswa && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
              {siswa.nama_lengkap.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-300">{siswa.nama_lengkap}</p>
              <p className="text-[10px] text-emerald-400/70">
                {siswa.kelas_nama} · {siswa.nisn}
              </p>
            </div>
          </div>
        )}

        {tahunAjaranAktif && (
          <div className="text-xs text-slate-400 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40">
            <Target size={12} />
            T.A. {tahunAjaranAktif.tahun} · Semester {tahunAjaranAktif.semester}
          </div>
        )}

        {/* Semester */}
        <div>
          <label className={LABEL_CLASS}>Semester</label>
          <select
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value as any })}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </div>

        {/* Target Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>Target Juz</label>
            <input
              type="number"
              min={0}
              value={form.target_juz}
              onChange={(e) => setForm({ ...form, target_juz: e.target.value })}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Target Halaman</label>
            <input
              type="number"
              min={0}
              value={form.target_halaman}
              onChange={(e) => setForm({ ...form, target_halaman: e.target.value })}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Target Surah</label>
            <input
              type="number"
              min={0}
              value={form.target_surah}
              onChange={(e) => setForm({ ...form, target_surah: e.target.value })}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <p className="text-[10px] text-slate-500">
          💡 Isi minimal salah satu target. Target halaman dipakai untuk progress bar.
        </p>

        {/* Catatan */}
        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan target (opsional)..."
            rows={2}
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {existingTarget ? 'Simpan Perubahan' : 'Simpan Target'}
          </button>
        </div>
      </div>
    </Modal>
  );
}