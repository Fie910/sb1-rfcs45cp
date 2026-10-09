// src/components/tahfidz/ModalTarget.tsx
// Form set/edit target hafalan siswa.
// ✅ Support range surah+ayat → auto-hitung total halaman.

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Target, BookOpen, Info } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { hitungTotalHalamanRange, formatHalaman } from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzTarget,
  TahfidzSurah,
  TahfidzHalamanDetail,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
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
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalTarget({
  open,
  onClose,
  onSaved,
  siswa,
  existingTarget,
  tahunAjaranAktif,
  surahMap,
  halamanMap,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [useRange, setUseRange] = useState(false);
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

  // ===========================================================================
  // INIT FORM
  // ===========================================================================
  useEffect(() => {
    if (!open) return;
    if (existingTarget) {
      const hasRange =
        existingTarget.surah_mulai != null &&
        existingTarget.ayat_mulai != null &&
        existingTarget.surah_selesai != null &&
        existingTarget.ayat_selesai != null;
      setUseRange(hasRange);
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
      setUseRange(false);
      setForm({
        target_juz: '',
        target_halaman: '',
        target_surah: '',
        surah_mulai: '',
        ayat_mulai: '',
        surah_selesai: '',
        ayat_selesai: '',
        semester: (tahunAjaranAktif?.semester as any) ?? 'Ganjil',
        catatan: '',
      });
    }
  }, [open, existingTarget, tahunAjaranAktif]);

  // ===========================================================================
  // HITUNG TOTAL HALAMAN dari range
  // ===========================================================================
  const hitungHalaman = useMemo(() => {
    if (!useRange) return 0;
    const sM = parseInt(form.surah_mulai, 10);
    const aM = parseInt(form.ayat_mulai, 10);
    const sS = parseInt(form.surah_selesai, 10);
    const aS = parseInt(form.ayat_selesai, 10);
    if (![sM, aM, sS, aS].every(Number.isFinite)) return 0;
    if (sM > sS) return 0;
    if (sM === sS && aM > aS) return 0;
    return hitungTotalHalamanRange(sM, aM, sS, aS, halamanMap);
  }, [useRange, form.surah_mulai, form.ayat_mulai, form.surah_selesai, form.ayat_selesai, halamanMap]);

  // Auto-fill target_halaman saat range berubah
  useEffect(() => {
    if (!useRange) return;
    if (hitungHalaman > 0) {
      setForm((f) => ({ ...f, target_halaman: hitungHalaman.toFixed(2) }));
    }
  }, [hitungHalaman, useRange]);

  // Auto-adjust surah_selesai >= surah_mulai
  useEffect(() => {
    if (!useRange) return;
    const sM = parseInt(form.surah_mulai, 10);
    const sS = parseInt(form.surah_selesai, 10);
    if (Number.isFinite(sM) && Number.isFinite(sS) && sM > sS) {
      setForm((f) => ({ ...f, surah_selesai: f.surah_mulai, ayat_selesai: '' }));
    }
  }, [form.surah_mulai, form.surah_selesai, useRange]);

  // ===========================================================================
  // INFO RANGE
  // ===========================================================================
  const rangeInfo = useMemo(() => {
    if (!useRange) return null;
    const sM = parseInt(form.surah_mulai, 10);
    const aM = parseInt(form.ayat_mulai, 10);
    const sS = parseInt(form.surah_selesai, 10);
    const aS = parseInt(form.ayat_selesai, 10);
    if (![sM, aM, sS, aS].every(Number.isFinite)) return null;
    if (sM > sS) return null;
    if (sM === sS && aM > aS) return null;

    const surahAwal = surahMap.get(sM);
    const surahAkhir = surahMap.get(sS);
    if (!surahAwal || !surahAkhir) return null;

    const jumlahSurah = sS - sM + 1;

    let totalAyat = 0;
    for (let n = sM; n <= sS; n++) {
      const s = surahMap.get(n);
      if (!s) continue;
      if (n === sM && n === sS) {
        totalAyat += aS - aM + 1;
      } else if (n === sM) {
        totalAyat += s.jumlah_ayat - aM + 1;
      } else if (n === sS) {
        totalAyat += aS;
      } else {
        totalAyat += s.jumlah_ayat;
      }
    }

    return {
      namaAwal: surahAwal.nama_latin,
      namaAkhir: surahAkhir.nama_latin,
      ayatAwal: aM,
      ayatAkhir: aS,
      jumlahSurah,
      totalAyat,
      totalHalaman: hitungHalaman,
    };
  }, [useRange, form.surah_mulai, form.ayat_mulai, form.surah_selesai, form.ayat_selesai, surahMap, hitungHalaman]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const handleToggleRange = (checked: boolean) => {
    setUseRange(checked);
    if (!checked) {
      setForm((f) => ({
        ...f,
        surah_mulai: '',
        ayat_mulai: '',
        surah_selesai: '',
        ayat_selesai: '',
      }));
    }
  };

  const handleSave = async () => {
    if (!siswa) return;

    const tJuz = form.target_juz ? Number(form.target_juz) : null;
    const tHal = form.target_halaman ? Number(form.target_halaman) : null;
    const tSur = form.target_surah ? Number(form.target_surah) : null;

    const tSurahMulai = useRange && form.surah_mulai ? Number(form.surah_mulai) : null;
    const tAyatMulai = useRange && form.ayat_mulai ? Number(form.ayat_mulai) : null;
    const tSurahSelesai = useRange && form.surah_selesai ? Number(form.surah_selesai) : null;
    const tAyatSelesai = useRange && form.ayat_selesai ? Number(form.ayat_selesai) : null;

    // Validasi minimal ada target
    if (!tJuz && !tHal && !tSur && !tSurahMulai) {
      showToast('error', 'Isi minimal salah satu target');
      return;
    }

    // Validasi range
    if (useRange) {
      if (!tSurahMulai || !tAyatMulai || !tSurahSelesai || !tAyatSelesai) {
        showToast('error', 'Lengkapi range surah + ayat (mulai & selesai)');
        return;
      }
      if (tSurahMulai > tSurahSelesai) {
        showToast('error', 'Surah mulai harus ≤ surah selesai');
        return;
      }
      if (tSurahMulai === tSurahSelesai && tAyatMulai > tAyatSelesai) {
        showToast('error', 'Ayat mulai harus ≤ ayat selesai (surah sama)');
        return;
      }
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
        surah_mulai: tSurahMulai,
        ayat_mulai: tAyatMulai,
        surah_selesai: tSurahSelesai,
        ayat_selesai: tAyatSelesai,
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

  // ===========================================================================
  // RENDER
  // ===========================================================================
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

        {/* Toggle Range Mode */}
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useRange}
              onChange={(e) => handleToggleRange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-indigo-500 cursor-pointer"
            />
            <div>
              <p className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                <BookOpen size={13} /> Gunakan Range Surah + Ayat
              </p>
              <p className="text-[10px] text-indigo-300/70 mt-0.5 leading-relaxed">
                Target jadi jelas: dari surah X ayat Y sampai surah Z ayat W.
                Total halaman dihitung otomatis.
              </p>
            </div>
          </label>
        </div>

        {/* Range Surah + Ayat */}
        {useRange && (
          <div className="space-y-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* START */}
              <div className="space-y-2">
                <label className={LABEL_CLASS}>Mulai Dari</label>
                <select
                  value={form.surah_mulai}
                  onChange={(e) =>
                    setForm({ ...form, surah_mulai: e.target.value, ayat_mulai: '' })
                  }
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  <option value="">Pilih surah...</option>
                  {Array.from(surahMap.values()).map((s) => (
                    <option key={s.nomor} value={s.nomor}>
                      {s.nomor}. {s.nama_latin} ({s.jumlah_ayat} ayat)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={
                    form.surah_mulai
                      ? surahMap.get(parseInt(form.surah_mulai, 10))?.jumlah_ayat ?? 999
                      : 999
                  }
                  value={form.ayat_mulai}
                  onChange={(e) => setForm({ ...form, ayat_mulai: e.target.value })}
                  placeholder="Ayat mulai (cth: 1)"
                  disabled={!form.surah_mulai}
                  className={INPUT_CLASS + (!form.surah_mulai ? ' opacity-60' : '')}
                />
              </div>

              {/* END */}
              <div className="space-y-2">
                <label className={LABEL_CLASS}>Sampai</label>
                <select
                  value={form.surah_selesai}
                  onChange={(e) =>
                    setForm({ ...form, surah_selesai: e.target.value, ayat_selesai: '' })
                  }
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  <option value="">Pilih surah...</option>
                  {Array.from(surahMap.values())
                    .filter((s) => {
                      const start = parseInt(form.surah_mulai, 10);
                      return !Number.isFinite(start) || s.nomor >= start;
                    })
                    .map((s) => (
                      <option key={s.nomor} value={s.nomor}>
                        {s.nomor}. {s.nama_latin} ({s.jumlah_ayat} ayat)
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={
                    form.surah_selesai
                      ? surahMap.get(parseInt(form.surah_selesai, 10))?.jumlah_ayat ?? 999
                      : 999
                  }
                  value={form.ayat_selesai}
                  onChange={(e) => setForm({ ...form, ayat_selesai: e.target.value })}
                  placeholder="Ayat selesai"
                  disabled={!form.surah_selesai}
                  className={INPUT_CLASS + (!form.surah_selesai ? ' opacity-60' : '')}
                />
              </div>
            </div>

            {/* Info Range */}
            {rangeInfo && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                <p className="text-xs font-bold text-emerald-300">
                  📖 {rangeInfo.namaAwal} {rangeInfo.ayatAwal} → {rangeInfo.namaAkhir}{' '}
                  {rangeInfo.ayatAkhir}
                </p>
                <div className="flex flex-wrap gap-3 text-[10px] text-emerald-300/80">
                  <span>📚 {rangeInfo.jumlahSurah} surah</span>
                  <span>📝 {rangeInfo.totalAyat} ayat</span>
                  <span className="font-bold text-emerald-400">
                    📄 {formatHalaman(rangeInfo.totalHalaman)} halaman
                  </span>
                </div>
              </div>
            )}

            {!rangeInfo && (form.surah_mulai || form.ayat_mulai) && (
              <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                <Info size={10} /> Lengkapi kedua ujung range (surah + ayat)
              </p>
            )}
          </div>
        )}

        {/* Target Manual */}
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
            <label className={LABEL_CLASS}>
              Target Halaman
              {useRange && (
                <span className="text-[9px] text-emerald-400 font-normal ml-1">
                  (auto)
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.target_halaman}
              onChange={(e) => setForm({ ...form, target_halaman: e.target.value })}
              placeholder="0"
              disabled={useRange && hitungHalaman > 0}
              className={
                INPUT_CLASS +
                (useRange && hitungHalaman > 0 ? ' opacity-60 cursor-not-allowed' : '')
              }
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