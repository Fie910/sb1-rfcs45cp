// src/components/tahfidz/ModalSertifikat.tsx
// Form cetak sertifikat tahfidz per siswa.

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Printer, User, BookMarked } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { hitungHalamanSetoran, formatHalaman } from '@/lib/tahfidz/hitungHalaman';
import { generateSertifikatTahfidz } from '@/lib/pdf/generateSertifikatTahfidz';
import type { TahfidzSurah, TahfidzSetoranWithRelations } from '@/types/database';

// =============================================================================
// PRESET PENCAPAIAN
// =============================================================================
const PRESET_PENCAPAIAN = [
  { label: 'Juz 30 (Amma) Lengkap', value: 'Juz 30 (Amma) Lengkap' },
  { label: 'Juz 1 Lengkap', value: 'Juz 1 Lengkap' },
  { label: 'Juz 2 Lengkap', value: 'Juz 2 Lengkap' },
  { label: '5 Juz', value: '5 Juz' },
  { label: '10 Juz', value: '10 Juz' },
  { label: '15 Juz', value: '15 Juz' },
  { label: '20 Juz', value: '20 Juz' },
  { label: '30 Juz (Khatam)', value: '30 Juz (Khatam)' },
  { label: 'Peserta Terbaik', value: 'Peserta Terbaik' },
  { label: 'Lainnya (custom)', value: '__custom__' },
];

type SiswaOption = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas_nama: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  siswa: SiswaOption | null;
  surahMap: Map<number, TahfidzSurah>;
};

export function ModalSertifikat({ open, onClose, siswa, surahMap }: Props) {
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [setoranList, setSetoranList] = useState<TahfidzSetoranWithRelations[]>([]);

  const [preset, setPreset] = useState(PRESET_PENCAPAIAN[0].value);
  const [customPencapaian, setCustomPencapaian] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [nomorSertifikat, setNomorSertifikat] = useState('');
  const [tanggalTerbit, setTanggalTerbit] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Fetch setoran siswa saat modal dibuka
  useEffect(() => {
    if (!open || !siswa) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('tahfidz_setoran')
          .select('*')
          .eq('siswa_id', siswa.id);
        setSetoranList((data as any) ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, siswa]);

  // Reset saat modal buka/tutup
  useEffect(() => {
    if (!open) return;
    setPreset(PRESET_PENCAPAIAN[0].value);
    setCustomPencapaian('');
    setDeskripsi('');
    setNomorSertifikat('');
    setTanggalTerbit(new Date().toISOString().slice(0, 10));
  }, [open]);

  // Statistik
  const stats = useMemo(() => {
    const totalHalaman = setoranList.reduce(
      (sum, s) => sum + hitungHalamanSetoran(s, surahMap),
      0
    );
    const nilaiArr = setoranList
      .map((s) => s.nilai)
      .filter((n): n is number => n !== null && n !== undefined);
    const rataNilai =
      nilaiArr.length > 0
        ? nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length
        : null;
    return { totalHalaman, rataNilai };
  }, [setoranList, surahMap]);

  const pencapaianFinal =
    preset === '__custom__' ? customPencapaian.trim() : preset;

  // ===========================================================================
  // HANDLER
  // ===========================================================================
  const handlePrint = async () => {
    if (!siswa) return;
    if (!pencapaianFinal) {
      showToast('error', 'Isi pencapaian dulu');
      return;
    }

    setPrinting(true);
    try {
      await generateSertifikatTahfidz({
        siswa: {
          nama_lengkap: siswa.nama_lengkap,
          nisn: siswa.nisn,
          kelas: siswa.kelas_nama,
        },
        pencapaian: pencapaianFinal,
        deskripsi: deskripsi.trim() || undefined,
        nilai_rata: stats.rataNilai,
        total_halaman: stats.totalHalaman,
        nomor_sertifikat: nomorSertifikat.trim() || undefined,
        tanggal_terbit: tanggalTerbit,
      });

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: String(siswa.id),
        deskripsi: `Cetak sertifikat tahfidz: ${siswa.nama_lengkap} - ${pencapaianFinal}`,
      });

      showToast('success', 'Sertifikat berhasil dicetak');
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal cetak: ' + (err.message || 'Error'));
    } finally {
      setPrinting(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <Modal open={open} onClose={onClose} title="Cetak Sertifikat Tahfidz" size="lg">
      <div className="space-y-4">
        {/* Siswa */}
        {siswa && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
              {siswa.nama_lengkap.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-300 truncate">
                {siswa.nama_lengkap}
              </p>
              <p className="text-[10px] text-emerald-400/70">
                {siswa.kelas_nama} · {siswa.nisn}
              </p>
            </div>
            {!loading && (
              <div className="text-right">
                <p className="text-lg font-extrabold text-emerald-400">
                  {formatHalaman(stats.totalHalaman)}
                </p>
                <p className="text-[9px] text-emerald-400/70 uppercase">halaman</p>
              </div>
            )}
          </div>
        )}

        {/* Pencapaian */}
        <div>
          <label className={LABEL_CLASS}>Pencapaian *</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            {PRESET_PENCAPAIAN.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {preset === '__custom__' && (
            <input
              value={customPencapaian}
              onChange={(e) => setCustomPencapaian(e.target.value)}
              placeholder="Tulis pencapaian custom..."
              className={INPUT_CLASS + ' mt-2'}
            />
          )}
        </div>

        {/* Nomor Sertifikat */}
        <div>
          <label className={LABEL_CLASS}>Nomor Sertifikat (opsional)</label>
          <input
            value={nomorSertifikat}
            onChange={(e) => setNomorSertifikat(e.target.value)}
            placeholder="Contoh: 001/SRT-THF/X/2026"
            className={INPUT_CLASS}
          />
        </div>

        {/* Tanggal Terbit */}
        <div>
          <label className={LABEL_CLASS}>Tanggal Terbit</label>
          <input
            type="date"
            value={tanggalTerbit}
            onChange={(e) => setTanggalTerbit(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {/* Deskripsi */}
        <div>
          <label className={LABEL_CLASS}>Deskripsi Tambahan (opsional)</label>
          <textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Contoh: Semoga menjadi hafiz yang mengamalkan Al-Quran..."
            rows={2}
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* Info */}
        <div className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2">
          <BookMarked size={12} className="shrink-0 mt-0.5 text-emerald-400" />
          <span>
            Sertifikat akan dicetak dalam format <strong>A4 landscape</strong> dengan
            kop sekolah + nama siswa + pencapaian + tanda tangan kepala sekolah.
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={printing}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            disabled={printing || !siswa || !pencapaianFinal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {printing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Printer size={14} />
            )}
            Cetak Sertifikat
          </button>
        </div>
      </div>
    </Modal>
  );
}