// src/components/tahfidz/ModalRaportTahfidz.tsx
// Modal cetak raport tahfidz per siswa per semester.

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Printer, FileText, BookOpen } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { generateRaportTahfidz } from '@/lib/pdf/generateRaportTahfidz';
import type {
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
  siswa: SiswaOption | null;
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalRaportTahfidz({
  open,
  onClose,
  siswa,
  surahMap,
  halamanMap,
}: Props) {
  const [printing, setPrinting] = useState(false);
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [tahunAjaranAktif, setTahunAjaranAktif] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [selectedTahunAjaranId, setSelectedTahunAjaranId] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');

  // ===========================================================================
  // FETCH TAHUN AJARAN
  // ===========================================================================
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('tahun_ajarans')
          .select('*')
          .order('tahun', { ascending: false });

        const list = data ?? [];
        setTahunAjaranList(list);

        const aktif = list.find((t: any) => t.is_aktif);
        setTahunAjaranAktif(aktif);

        if (aktif) {
          setSelectedTahunAjaranId(aktif.id);
          setSelectedSemester(aktif.semester as 'Ganjil' | 'Genap');
        } else if (list.length > 0) {
          setSelectedTahunAjaranId(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // ===========================================================================
  // HELPER
  // ===========================================================================
  const selectedTA = useMemo(() => {
    return tahunAjaranList.find((t) => t.id === selectedTahunAjaranId);
  }, [tahunAjaranList, selectedTahunAjaranId]);

  // ===========================================================================
  // HANDLE PRINT
  // ===========================================================================
  const handlePrint = async () => {
    if (!siswa || !selectedTA) {
      showToast('error', 'Data tidak lengkap');
      return;
    }

    setPrinting(true);
    try {
      await generateRaportTahfidz(
        {
          siswa: {
            id: siswa.id,
            nama_lengkap: siswa.nama_lengkap,
            nisn: siswa.nisn,
            kelas_nama: siswa.kelas_nama,
          },
          tahunAjaranId: selectedTA.id,
          tahunAjaran: selectedTA.tahun,
          semester: selectedSemester,
        },
        surahMap,
        halamanMap
      );

      await logActivity({
        aksi: 'EXPORT',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: String(siswa.id),
        deskripsi: `Cetak raport tahfidz: ${siswa.nama_lengkap} (${selectedSemester} ${selectedTA.tahun})`,
      });

      showToast('success', 'Raport berhasil dicetak');
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
    <Modal open={open} onClose={onClose} title="Cetak Raport Tahfidz" size="md">
      <div className="space-y-4">
        {/* Info Siswa */}
        {siswa && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold">
              {siswa.nama_lengkap.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-indigo-300 truncate">
                {siswa.nama_lengkap}
              </p>
              <p className="text-[10px] text-indigo-400/70">
                {siswa.kelas_nama} · {siswa.nisn}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" />
          </div>
        ) : tahunAjaranList.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
            <FileText size={28} className="mx-auto text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">
              Tidak ada data tahun ajaran. Hubungi admin.
            </p>
          </div>
        ) : (
          <>
            {/* Periode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Tahun Ajaran</label>
                <select
                  value={selectedTahunAjaranId ?? ''}
                  onChange={(e) => setSelectedTahunAjaranId(Number(e.target.value))}
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  {tahunAjaranList.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.tahun} {ta.is_aktif ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) =>
                    setSelectedSemester(e.target.value as 'Ganjil' | 'Genap')
                  }
                  className={INPUT_CLASS + ' cursor-pointer'}
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>

            {/* Info Raport */}
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <BookOpen size={13} /> Isi Raport
              </div>
              <ul className="text-[10px] text-slate-400 space-y-0.5 pl-5 list-disc">
                <li>Identitas siswa + periode</li>
                <li>Statistik capaian (setoran, halaman, nilai, poin)</li>
                <li>Target & progress bar</li>
                <li>Daftar setoran lengkap</li>
                <li>Milestone tercapai</li>
                <li>Rekomendasi latihan ayat bermasalah</li>
                <li>Tanda tangan guru tahfidz + kepala sekolah</li>
              </ul>
            </div>

            {/* Preview Periode */}
            {selectedTA && (
              <div className="text-[10px] text-slate-500 text-center">
                📄 Akan mencetak: <strong className="text-slate-300">{selectedTA.tahun}</strong> ·{' '}
                <strong className="text-slate-300">Semester {selectedSemester}</strong>
              </div>
            )}

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
                disabled={printing || !siswa || !selectedTA}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {printing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Printer size={14} />
                )}
                Cetak Raport
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}