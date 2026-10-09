// src/components/tahfidz/ModalSetoran.tsx
// Form tambah/edit setoran hafalan (mode rentang).
// Filter kelas default mengikuti jadwal guru dari tabel jadwal_kbmjps.
// ✅ Input nomor ayat bisa dikosongkan (fallback ke 1 saat blur).

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, X, User, BookMarked, School, Info,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import {
  getHalamanSetoran,
  hitungTotalAyatSetoran,
  formatHalaman,
} from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  TahfidzSetoran,
  JenisSetoran,
  KualitasHafalan,
} from '@/types/database';

// =============================================================================
// HELPERS
// =============================================================================
function toAyatNumber(v: number | string): number {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  editTarget: TahfidzSetoran | null;
  currentGuruId: string | null;
};

type SiswaOption = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas?: { nama_kelas: string } | null;
};

type KelasOption = { id: number; nama_kelas: string };

const EMPTY_FORM = {
  siswa_id: '',
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: 'Tahfidz' as JenisSetoran,
  surah_mulai: 1,
  ayat_mulai: 1 as number | string,
  surah_selesai: 1,
  ayat_selesai: 1 as number | string,
  kualitas: 'Lancar' as KualitasHafalan,
  nilai: 90,
  catatan: '',
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalSetoran({
  open,
  onClose,
  onSaved,
  surahMap,
  halamanMap,
  editTarget,
  currentGuruId,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  // Siswa list
  const [siswaList, setSiswaList] = useState<SiswaOption[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [searchSiswa, setSearchSiswa] = useState('');

  // Kelas list (dari jadwal guru, atau fallback semua)
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [loadingKelas, setLoadingKelas] = useState(false);
  const [filterKelas, setFilterKelas] = useState<number | ''>('');
  const [kelasFromJadwal, setKelasFromJadwal] = useState(false);

  // ===========================================================================
  // LOAD KELAS DARI JADWAL GURU
  // ===========================================================================
  useEffect(() => {
    if (!open) return;
    if (kelasList.length > 0) return;
    if (!currentGuruId) return;

    (async () => {
      setLoadingKelas(true);
      try {
        const { data: jadwalData } = await supabase
          .from('jadwal_kbmjps')
          .select(`
            kelas_id,
            kelas:kelas_id (id, nama_kelas)
          `)
          .eq('guru_id', currentGuruId);

        const uniqueKelas = new Map<number, KelasOption>();
        (jadwalData ?? []).forEach((j: any) => {
          if (j.kelas) uniqueKelas.set(j.kelas.id, j.kelas);
        });

        if (uniqueKelas.size > 0) {
          const list = Array.from(uniqueKelas.values()).sort((a, b) =>
            a.nama_kelas.localeCompare(b.nama_kelas)
          );
          setKelasList(list);
          setKelasFromJadwal(true);
          if (list.length === 1 && !editTarget) setFilterKelas(list[0].id);
        } else {
          const { data: allKelas } = await supabase
            .from('kelas')
            .select('id, nama_kelas')
            .order('nama_kelas', { ascending: true });
          setKelasList((allKelas as KelasOption[]) ?? []);
          setKelasFromJadwal(false);
        }
      } catch (err) {
        console.warn('[ModalSetoran] Gagal load kelas:', err);
      } finally {
        setLoadingKelas(false);
      }
    })();
  }, [open, currentGuruId, kelasList.length, editTarget]);

  // ===========================================================================
  // LOAD SISWA AKTIF
  // ===========================================================================
  useEffect(() => {
    if (!open) return;
    if (siswaList.length > 0) return;

    (async () => {
      setLoadingSiswa(true);
      const { data } = await supabase
        .from('siswas')
        .select('id, nisn, nama_lengkap, kelas_id, kelas:kelas_id (nama_kelas)')
        .eq('status', 'AKTIF')
        .order('nama_lengkap', { ascending: true });
      setSiswaList((data as any) ?? []);
      setLoadingSiswa(false);
    })();
  }, [open, siswaList.length]);

  // ===========================================================================
  // SET FORM DARI editTarget
  // ===========================================================================
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setForm({
        siswa_id: String(editTarget.siswa_id),
        tanggal: editTarget.tanggal,
        jenis: editTarget.jenis,
        surah_mulai: editTarget.surah_mulai,
        ayat_mulai: editTarget.ayat_mulai,
        surah_selesai: editTarget.surah_selesai,
        ayat_selesai: editTarget.ayat_selesai,
        kualitas: (editTarget.kualitas ?? 'Lancar') as KualitasHafalan,
        nilai: editTarget.nilai ?? 90,
        catatan: editTarget.catatan ?? '',
      });
      setSearchSiswa('');

      if (filterKelas !== '') {
        const targetSiswa = siswaList.find((s) => s.id === editTarget.siswa_id);
        if (targetSiswa && targetSiswa.kelas_id !== filterKelas) {
          setFilterKelas('');
        }
      }
    } else {
      setForm({ ...EMPTY_FORM, siswa_id: '' });
      setSearchSiswa('');
      if (kelasFromJadwal && kelasList.length === 1) {
        setFilterKelas(kelasList[0].id);
      } else {
        setFilterKelas('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editTarget]);

  // ===========================================================================
  // SURAH INFO
  // ===========================================================================
  const surahMulai = surahMap.get(form.surah_mulai);
  const surahSelesai = surahMap.get(form.surah_selesai);
  const maxAyatMulai = surahMulai?.jumlah_ayat ?? 1;
  const maxAyatSelesai = surahSelesai?.jumlah_ayat ?? 1;

  // Auto-adjust ayat ketika surah berubah
  useEffect(() => {
    const n = toAyatNumber(form.ayat_mulai);
    if (typeof form.ayat_mulai === 'number' && n > maxAyatMulai) {
      setForm((f) => ({ ...f, ayat_mulai: 1 }));
    }
  }, [maxAyatMulai, form.ayat_mulai]);

  useEffect(() => {
    const n = toAyatNumber(form.ayat_selesai);
    if (typeof form.ayat_selesai === 'number' && n > maxAyatSelesai) {
      setForm((f) => ({ ...f, ayat_selesai: 1 }));
    }
  }, [maxAyatSelesai, form.ayat_selesai]);

  // Auto-set surah_selesai = surah_mulai & ayat_selesai >= ayat_mulai
  useEffect(() => {
    setForm((f) => {
      const u: any = {};
      if (f.surah_selesai < f.surah_mulai) u.surah_selesai = f.surah_mulai;
      const aMulai = toAyatNumber(f.ayat_mulai);
      const aSelesai = toAyatNumber(f.ayat_selesai);
      if (f.surah_selesai === f.surah_mulai && aSelesai < aMulai) {
        u.ayat_selesai = aMulai;
      }
      return Object.keys(u).length > 0 ? { ...f, ...u } : f;
    });
  }, [form.surah_mulai, form.ayat_mulai, form.ayat_selesai]);

  // ===========================================================================
  // PREVIEW HALAMAN & AYAT
  // ===========================================================================
  const preview = useMemo(() => {
    const dummy: any = {
      surah_mulai: form.surah_mulai,
      ayat_mulai: toAyatNumber(form.ayat_mulai),
      surah_selesai: form.surah_selesai,
      ayat_selesai: toAyatNumber(form.ayat_selesai),
    };
    return {
      halaman: getHalamanSetoran(dummy, surahMap, halamanMap),
      ayat: hitungTotalAyatSetoran(dummy, surahMap),
    };
  }, [form, surahMap, halamanMap]);

  // ===========================================================================
  // SISWA FILTERED
  // ===========================================================================
  const filteredSiswa = useMemo(() => {
    let result = siswaList;
    if (filterKelas !== '') {
      result = result.filter((s) => s.kelas_id === filterKelas);
    }
    if (searchSiswa.trim()) {
      const q = searchSiswa.toLowerCase();
      result = result.filter(
        (s) =>
          s.nama_lengkap.toLowerCase().includes(q) ||
          s.nisn.toLowerCase().includes(q)
      );
    }
    return result.slice(0, 50);
  }, [siswaList, filterKelas, searchSiswa]);

  const selectedSiswa = siswaList.find((s) => String(s.id) === form.siswa_id);

  const totalSiswaDiKelas = useMemo(() => {
    if (filterKelas === '') return siswaList.length;
    return siswaList.filter((s) => s.kelas_id === filterKelas).length;
  }, [siswaList, filterKelas]);

  // ===========================================================================
  // SAVE
  // ===========================================================================
  const handleSave = async () => {
    if (!form.siswa_id) {
      showToast('error', 'Pilih siswa dulu');
      return;
    }

    const aMulai = toAyatNumber(form.ayat_mulai);
    const aSelesai = toAyatNumber(form.ayat_selesai);

    if (aMulai > maxAyatMulai) {
      showToast('error', `Ayat mulai maksimal ${maxAyatMulai}`);
      return;
    }
    if (aSelesai > maxAyatSelesai) {
      showToast('error', `Ayat selesai maksimal ${maxAyatSelesai}`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siswa_id: Number(form.siswa_id),
        guru_tahfidz_id: currentGuruId,
        tanggal: form.tanggal,
        jenis: form.jenis,
        surah_mulai: form.surah_mulai,
        ayat_mulai: aMulai,
        surah_selesai: form.surah_selesai,
        ayat_selesai: aSelesai,
        kualitas: form.kualitas,
        nilai: form.nilai,
        catatan: form.catatan || null,
        halaman_snapshot: null,
        created_by: currentGuruId,
      };

      if (editTarget) {
        const { error } = await supabase
          .from('tahfidz_setoran')
          .update(payload)
          .eq('id', editTarget.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.TAHFIDZ,
          targetId: editTarget.id,
          deskripsi: `Update setoran tahfidz: ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', 'Setoran diperbarui');
      } else {
        const { error } = await supabase.from('tahfidz_setoran').insert(payload);
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.TAHFIDZ,
          deskripsi: `Tambah setoran tahfidz: ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', 'Setoran ditambahkan');
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
      title={editTarget ? 'Edit Setoran' : 'Tambah Setoran'}
      size="lg"
    >
      <div className="space-y-4">
        {/* ======================== SISWA ======================== */}
        <div>
          <label className={LABEL_CLASS}>
            <User size={12} className="inline mr-1" /> Siswa *
          </label>

          {selectedSiswa ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-300 truncate">
                  {selectedSiswa.nama_lengkap}
                </p>
                <p className="text-[10px] text-emerald-400/70">
                  {selectedSiswa.kelas?.nama_kelas ?? '-'} · {selectedSiswa.nisn}
                </p>
              </div>
              <button
                onClick={() => {
                  setForm((f) => ({ ...f, siswa_id: '' }));
                  setSearchSiswa('');
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
                title="Ganti siswa"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {kelasFromJadwal && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Kelas disesuaikan dengan jadwal mengajar Anda
                    {kelasList.length === 1 && (
                      <span className="font-bold"> · {kelasList[0].nama_kelas}</span>
                    )}
                    {kelasList.length > 1 &&
                      ` (${kelasList.length} kelas)`}
                  </span>
                </div>
              )}

              {/* Filter kelas */}
              <div className="flex gap-2">
                <select
                  value={filterKelas}
                  onChange={(e) =>
                    setFilterKelas(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  disabled={loadingKelas}
                  className={INPUT_CLASS + ' cursor-pointer flex-1 disabled:opacity-50'}
                >
                  <option value="">
                    {kelasFromJadwal ? 'Semua Kelas Saya' : 'Semua Kelas'}
                  </option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
                {filterKelas !== '' && (
                  <button
                    onClick={() => setFilterKelas('')}
                    className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition cursor-pointer"
                    title="Reset filter kelas"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search siswa */}
              <input
                value={searchSiswa}
                onChange={(e) => setSearchSiswa(e.target.value)}
                placeholder="Cari nama atau NISN siswa..."
                className={INPUT_CLASS}
              />

              {/* Info hasil */}
              {!loadingSiswa && (
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <School size={10} />
                  {filterKelas !== ''
                    ? `${filteredSiswa.length} dari ${totalSiswaDiKelas} siswa di kelas ini`
                    : `Menampilkan ${filteredSiswa.length} dari ${siswaList.length} siswa`}
                  {searchSiswa.trim() && ' (terfilter search)'}
                </p>
              )}

              {/* List siswa */}
              {loadingSiswa ? (
                <div className="py-4 text-center">
                  <Loader2 size={16} className="animate-spin inline text-slate-500" />
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                  {filteredSiswa.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      {filterKelas !== ''
                        ? 'Tidak ada siswa di kelas ini'
                        : 'Tidak ada siswa cocok'}
                    </p>
                  ) : (
                    filteredSiswa.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, siswa_id: String(s.id) }));
                          setSearchSiswa('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800/60 transition cursor-pointer"
                      >
                        <p className="text-sm text-slate-200 font-medium">{s.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-500">
                          {s.kelas?.nama_kelas ?? '-'} · {s.nisn}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================== TANGGAL & JENIS ======================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal *</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jenis *</label>
            <select
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisSetoran })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              <option value="Tahfidz">Tahfidz (hafalan baru)</option>
              <option value="Murojaah">Murojaah (pengulangan)</option>
            </select>
          </div>
        </div>

        {/* ======================== RENTANG HAFALAN ======================== */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <BookMarked size={13} /> Rentang Hafalan
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mulai */}
            <div className="space-y-2">
              <label className={LABEL_CLASS}>Mulai</label>
              <select
                value={form.surah_mulai}
                onChange={(e) => setForm({ ...form, surah_mulai: Number(e.target.value) })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {Array.from(surahMap.values()).map((s) => (
                  <option key={s.nomor} value={s.nomor}>
                    {s.nomor}. {s.nama_latin} ({s.jumlah_ayat} ayat)
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={maxAyatMulai}
                value={form.ayat_mulai}
                onChange={(e) => setForm({ ...form, ayat_mulai: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v === '' || toAyatNumber(v) < 1) {
                    setForm((f) => ({ ...f, ayat_mulai: 1 }));
                  }
                }}
                placeholder="Ayat mulai"
                className={INPUT_CLASS}
              />
              <p className="text-[10px] text-slate-500">Maks: {maxAyatMulai} ayat</p>
            </div>

            {/* Selesai */}
            <div className="space-y-2">
              <label className={LABEL_CLASS}>Selesai</label>
              <select
                value={form.surah_selesai}
                onChange={(e) => setForm({ ...form, surah_selesai: Number(e.target.value) })}
                className={INPUT_CLASS + ' cursor-pointer'}
              >
                {Array.from(surahMap.values()).map((s) => (
                  <option key={s.nomor} value={s.nomor}>
                    {s.nomor}. {s.nama_latin} ({s.jumlah_ayat} ayat)
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={maxAyatSelesai}
                value={form.ayat_selesai}
                onChange={(e) => setForm({ ...form, ayat_selesai: e.target.value })}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v === '' || toAyatNumber(v) < 1) {
                    setForm((f) => ({ ...f, ayat_selesai: 1 }));
                  }
                }}
                placeholder="Ayat selesai"
                className={INPUT_CLASS}
              />
              <p className="text-[10px] text-slate-500">Maks: {maxAyatSelesai} ayat</p>
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
            <span className="text-emerald-400 font-bold">📖 {preview.ayat} ayat</span>
            <span className="text-emerald-300">≈ {formatHalaman(preview.halaman)} halaman</span>
          </div>
        </div>

        {/* ======================== KUALITAS & NILAI ======================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Kualitas</label>
            <select
              value={form.kualitas}
              onChange={(e) => setForm({ ...form, kualitas: e.target.value as KualitasHafalan })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              <option value="Lancar">Lancar</option>
              <option value="Cukup">Cukup</option>
              <option value="Perlu Ulang">Perlu Ulang</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Nilai (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={form.nilai}
              onChange={(e) => setForm({ ...form, nilai: Number(e.target.value) || 0 })}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* ======================== CATATAN ======================== */}
        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tambahan (opsional)..."
            rows={3}
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* ======================== ACTIONS ======================== */}
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
            disabled={saving || !form.siswa_id}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {editTarget ? 'Simpan Perubahan' : 'Tambah Setoran'}
          </button>
        </div>
      </div>
    </Modal>
  );
}