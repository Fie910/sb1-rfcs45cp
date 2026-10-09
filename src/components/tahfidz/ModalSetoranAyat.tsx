// src/components/tahfidz/ModalSetoranAyat.tsx
// Modal penilaian per ayat — alternatif dari ModalSetoran.
// Fitur: pilih surah+rentang ayat, nilai per ayat (Lancar/Cukup/Perlu Ulang), auto-aggregate.

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, X, User, BookMarked, School, Info, CheckCircle2,
  AlertCircle, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { INPUT_CLASS, LABEL_CLASS } from './shared';
import { useQuranText } from '@/hooks/useQuranText';
import {
  getHalamanSetoran,
  hitungTotalAyatSetoran,
  formatHalaman,
} from '@/lib/tahfidz/hitungHalaman';
import type {
  TahfidzSurah,
  TahfidzHalamanDetail,
  JenisSetoran,
  KualitasHafalan,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  surahMap: Map<number, TahfidzSurah>;
  halamanMap: TahfidzHalamanDetail[];
  currentGuruId: string | null;
};

type SiswaOption = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  kelas_id: number | null;
  kelas?: { nama_kelas: string } | null;
};

type AyatPenilaian = {
  surah: number;
  ayat: number;
  text: string;
  kualitas: KualitasHafalan | null;
};

const EMPTY_FORM = {
  siswa_id: '',
  tanggal: new Date().toISOString().slice(0, 10),
  jenis: 'Tahfidz' as JenisSetoran,
  surah_mulai: 1,
  ayat_mulai: 1 as number | string,      // ← bisa empty
  surah_selesai: 1,
  ayat_selesai: 7 as number | string,    // ← bisa empty
  catatan: '',
};

const KUALITAS_OPTIONS: { value: KualitasHafalan; label: string; color: string; icon: any }[] = [
  { value: 'Lancar', label: 'Lancar', color: 'emerald', icon: CheckCircle2 },
  { value: 'Cukup', label: 'Cukup', color: 'amber', icon: AlertCircle },
  { value: 'Perlu Ulang', label: 'Perlu Ulang', color: 'rose', icon: XCircle },
];

const KUALITAS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  emerald: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-300',
  },
  amber: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
  },
  rose: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    text: 'text-rose-300',
  },
};

// Helper: konversi ayat ke number dengan fallback
function toAyatNumber(v: number | string): number {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalSetoranAyat({
  open,
  onClose,
  onSaved,
  surahMap,
  halamanMap,
  currentGuruId,
}: Props) {
  const { getAyatRange, getSurahMeta, loading: loadingQuran } = useQuranText();

  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'form' | 'penilaian'>('form');
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [penilaian, setPenilaian] = useState<AyatPenilaian[]>([]);

  // Siswa list
  const [siswaList, setSiswaList] = useState<SiswaOption[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [searchSiswa, setSearchSiswa] = useState('');
  const [filterKelas, setFilterKelas] = useState<number | ''>('');
  const [kelasList, setKelasList] = useState<{ id: number; nama_kelas: string }[]>([]);

  // ===========================================================================
  // LOAD KELAS + SISWA
  // ===========================================================================
  useEffect(() => {
    if (!open) return;
    if (siswaList.length > 0) return;
    if (!currentGuruId) return;

    (async () => {
      setLoadingSiswa(true);

      // Fetch siswa
      const { data: siswaData } = await supabase
        .from('siswas')
        .select('id, nisn, nama_lengkap, kelas_id, kelas:kelas_id (nama_kelas)')
        .eq('status', 'AKTIF')
        .order('nama_lengkap');

      setSiswaList((siswaData as any) ?? []);

      // Fetch jadwal guru → unique kelas
      const { data: jadwalData } = await supabase
        .from('jadwal_kbmjps')
        .select(`kelas_id, kelas:kelas_id (id, nama_kelas)`)
        .eq('guru_id', currentGuruId);

      const uniqueKelas = new Map<number, { id: number; nama_kelas: string }>();
      (jadwalData ?? []).forEach((j: any) => {
        if (j.kelas) uniqueKelas.set(j.kelas.id, j.kelas);
      });

      if (uniqueKelas.size > 0) {
        const list = Array.from(uniqueKelas.values()).sort((a, b) =>
          a.nama_kelas.localeCompare(b.nama_kelas)
        );
        setKelasList(list);
        if (list.length === 1) setFilterKelas(list[0].id);
      } else {
        // Fallback: semua kelas
        const { data: allKelas } = await supabase
          .from('kelas')
          .select('id, nama_kelas')
          .order('nama_kelas');
        setKelasList((allKelas as any) ?? []);
      }

      setLoadingSiswa(false);
    })();
  }, [open, currentGuruId, siswaList.length]);

  // Reset saat modal open
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM });
    setStep('form');
    setPenilaian([]);
    setSearchSiswa('');
  }, [open]);

  // ===========================================================================
  // SURAH INFO
  // ===========================================================================
  const surahMulai = surahMap.get(form.surah_mulai);
  const surahSelesai = surahMap.get(form.surah_selesai);
  const maxAyatMulai = surahMulai?.jumlah_ayat ?? 1;
  const maxAyatSelesai = surahSelesai?.jumlah_ayat ?? 1;

  // Auto-adjust
  useEffect(() => {
    if (form.ayat_mulai > maxAyatMulai) setForm((f) => ({ ...f, ayat_mulai: 1 }));
  }, [maxAyatMulai, form.ayat_mulai]);

  useEffect(() => {
    if (form.ayat_selesai > maxAyatSelesai) setForm((f) => ({ ...f, ayat_selesai: 1 }));
  }, [maxAyatSelesai, form.ayat_selesai]);

  useEffect(() => {
    setForm((f) => {
      const u: any = {};
      if (f.surah_selesai < f.surah_mulai) u.surah_selesai = f.surah_mulai;
      if (f.surah_selesai === f.surah_mulai && f.ayat_selesai < f.ayat_mulai) {
        u.ayat_selesai = f.ayat_mulai;
      }
      return Object.keys(u).length > 0 ? { ...f, ...u } : f;
    });
  }, [form.surah_mulai, form.ayat_mulai]);

  // ===========================================================================
  // PREVIEW (halaman & ayat)
  // ===========================================================================
  const preview = useMemo(() => {
    const dummy: any = {
      surah_mulai: form.surah_mulai,
      ayat_mulai: form.ayat_mulai,
      surah_selesai: form.surah_selesai,
      ayat_selesai: form.ayat_selesai,
    };
    return {
      halaman: getHalamanSetoran(dummy, surahMap, halamanMap),
      ayat: hitungTotalAyatSetoran(dummy, surahMap),
    };
  }, [form, surahMap, halamanMap]);

  // Siswa filtered
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

  // ===========================================================================
  // MOVE TO PENILAIAN STEP
  // ===========================================================================
  const handleGoToPenilaian = () => {
    if (!form.siswa_id) {
      showToast('error', 'Pilih siswa dulu');
      return;
    }

    const ayatRange = getAyatRange(
      form.surah_mulai,
      form.ayat_mulai,
      form.surah_selesai,
      form.ayat_selesai
    );

    if (ayatRange.length === 0) {
      showToast('error', 'Rentang ayat tidak valid');
      return;
    }

    // Cek limit — prevent terlalu banyak ayat (mis: Al-Baqarah full = 286 ayat)
    if (ayatRange.length > 100) {
      showToast(
        'error',
        `Terlalu banyak ayat (${ayatRange.length}). Maks 100 ayat per sesi penilaian.`
      );
      return;
    }

    setPenilaian(
      ayatRange.map((a) => ({
        surah: a.surah,
        ayat: a.ayat,
        text: a.text,
        kualitas: null,
      }))
    );
    setStep('penilaian');
  };

  // ===========================================================================
  // AYAT CLICK
  // ===========================================================================
  const setAyatKualitas = (index: number, kualitas: KualitasHafalan) => {
    setPenilaian((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], kualitas };
      return next;
    });
  };

  const setAllKualitas = (kualitas: KualitasHafalan) => {
    setPenilaian((prev) => prev.map((a) => ({ ...a, kualitas })));
  };

  const resetAll = () => {
    setPenilaian((prev) => prev.map((a) => ({ ...a, kualitas: null })));
  };

  // ===========================================================================
  // STATS
  // ===========================================================================
  const penilaianStats = useMemo(() => {
    const total = penilaian.length;
    const lancar = penilaian.filter((a) => a.kualitas === 'Lancar').length;
    const cukup = penilaian.filter((a) => a.kualitas === 'Cukup').length;
    const perluUlang = penilaian.filter((a) => a.kualitas === 'Perlu Ulang').length;
    const belum = penilaian.filter((a) => a.kualitas === null).length;
    return { total, lancar, cukup, perluUlang, belum };
  }, [penilaian]);

  // Auto-aggregate kualitas untuk setoran
  const aggregatedKualitas = useMemo<KualitasHafalan>(() => {
    const { total, lancar, cukup } = penilaianStats;
    if (total === 0) return 'Lancar';
    const persenLancar = (lancar / total) * 100;
    const persenLancarCukup = ((lancar + cukup) / total) * 100;

    if (persenLancar >= 80) return 'Lancar';
    if (persenLancarCukup >= 50) return 'Cukup';
    return 'Perlu Ulang';
  }, [penilaianStats]);

  // ===========================================================================
  // SAVE
  // ===========================================================================
  const handleSave = async () => {
    if (penilaianStats.belum > 0) {
      showToast(
        'error',
        `${penilaianStats.belum} ayat belum dinilai. Klik semua ayat dulu.`
      );
      return;
    }

    setSaving(true);

    try {
      // 1. Insert setoran utama (dapat ID)
      const setoranPayload = {
        siswa_id: Number(form.siswa_id),
        guru_tahfidz_id: currentGuruId,
        tanggal: form.tanggal,
        jenis: form.jenis,
        surah_mulai: form.surah_mulai,
        ayat_mulai: form.ayat_mulai,
        surah_selesai: form.surah_selesai,
        ayat_selesai: form.ayat_selesai,
        kualitas: aggregatedKualitas,
        nilai: null,
        catatan: form.catatan || null,
        halaman_snapshot: null,
        created_by: currentGuruId,
      };

      const { data: setoranData, error: setoranErr } = await supabase
        .from('tahfidz_setoran')
        .insert(setoranPayload)
        .select('id')
        .single();

      if (setoranErr) throw setoranErr;
      if (!setoranData) throw new Error('Gagal dapat ID setoran');

      // 2. Bulk insert ayat
      const ayatRows = penilaian.map((a) => ({
        setoran_id: setoranData.id,
        surah_nomor: a.surah,
        ayat_nomor: a.ayat,
        kualitas: a.kualitas!,
      }));

      const { error: ayatErr } = await supabase
        .from('tahfidz_setoran_ayat')
        .insert(ayatRows);

      if (ayatErr) throw ayatErr;

      // 3. Log
      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.TAHFIDZ,
        targetId: setoranData.id,
        deskripsi: `Setoran per ayat: ${selectedSiswa?.nama_lengkap} (${penilaian.length} ayat)`,
      });

      // 4. Success
      showToast(
        'success',
        `Setoran tersimpan (${penilaian.length} ayat, ${aggregatedKualitas})`
      );
      onSaved();
    } catch (err: any) {
      showToast('error', 'Gagal simpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ===========================================================================
  // RENDER — STEP 2: PENILAIAN
  // ===========================================================================
  if (step === 'penilaian') {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Penilaian Per Ayat"
        size="lg"
      >
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 font-bold">
                {selectedSiswa?.nama_lengkap.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">
                  {selectedSiswa?.nama_lengkap}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selectedSiswa?.kelas?.nama_kelas} · {getSurahMeta(form.surah_mulai)?.nama_latin} {form.ayat_mulai}-{form.ayat_selesai}
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep('form')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <ChevronLeft size={12} /> Kembali
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">
              Set Semua:
            </span>
            {KUALITAS_OPTIONS.map((opt) => {
              const c = KUALITAS_STYLE[opt.color];
              return (
                <button
                  key={opt.value}
                  onClick={() => setAllKualitas(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${c.bg} ${c.border} border ${c.text} text-xs font-bold transition cursor-pointer hover:opacity-80`}
                >
                  <opt.icon size={12} /> {opt.label}
                </button>
              );
            })}
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold transition cursor-pointer ml-auto"
            >
              <X size={12} /> Reset
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <StatChip label="Lancar" value={penilaianStats.lancar} color="emerald" />
            <StatChip label="Cukup" value={penilaianStats.cukup} color="amber" />
            <StatChip label="Perlu Ulang" value={penilaianStats.perluUlang} color="rose" />
            <StatChip label="Belum" value={penilaianStats.belum} color="slate" />
          </div>

          {/* List Ayat */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
            {penilaian.map((a, idx) => (
              <AyatRow
                key={`${a.surah}-${a.ayat}`}
                index={idx}
                ayat={a}
                surahMeta={getSurahMeta(a.surah)}
                isFirstOfSurah={idx === 0 || penilaian[idx - 1]?.surah !== a.surah}
                onSetKualitas={(k) => setAyatKualitas(idx, k)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                Auto-kualitas: <strong className="text-emerald-400">{aggregatedKualitas}</strong>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-500">
                {preview.ayat} ayat · {formatHalaman(preview.halaman)} hal
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || penilaianStats.belum > 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan ({penilaian.length} ayat)
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ===========================================================================
  // RENDER — STEP 1: FORM
  // ===========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Setoran Per Ayat (Mode Detail)"
      size="lg"
    >
      <div className="space-y-4">
        {/* Info banner */}
        <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Mode ini menampilkan setiap ayat untuk dinilai satu per satu.
            Kualitas setoran akan di-aggregate otomatis dari penilaian ayat.
          </span>
        </div>

        {/* SISWA */}
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
                onClick={() => { setForm((f) => ({ ...f, siswa_id: '' })); setSearchSiswa(''); }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={loadingSiswa}
                  className={INPUT_CLASS + ' cursor-pointer flex-1'}
                >
                  <option value="">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>
              <input
                value={searchSiswa}
                onChange={(e) => setSearchSiswa(e.target.value)}
                placeholder="Cari nama atau NISN siswa..."
                className={INPUT_CLASS}
              />
              {loadingSiswa ? (
                <div className="py-4 text-center">
                  <Loader2 size={16} className="animate-spin inline text-slate-500" />
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                  {filteredSiswa.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">Tidak ada siswa cocok</p>
                  ) : (
                    filteredSiswa.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setForm((f) => ({ ...f, siswa_id: String(s.id) })); setSearchSiswa(''); }}
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

        {/* TANGGAL & JENIS */}
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

        {/* RENTANG HAFALAN */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <BookMarked size={13} /> Rentang Hafalan (Yang Dinilai)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            {preview.ayat > 100 && (
              <span className="text-rose-400 font-bold ml-auto">⚠ Maks 100 ayat</span>
            )}
          </div>
        </div>

        {/* CATATAN */}
        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tambahan (opsional)..."
            rows={2}
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleGoToPenilaian}
            disabled={!form.siswa_id || loadingQuran || preview.ayat > 100}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingQuran ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Memuat teks...
              </>
            ) : (
              <>
                Lanjut Penilaian Per Ayat <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// SUB — AYAT ROW
// =============================================================================
function AyatRow({
  index,
  ayat,
  surahMeta,
  isFirstOfSurah,
  onSetKualitas,
}: {
  index: number;
  ayat: AyatPenilaian;
  surahMeta: any;
  isFirstOfSurah: boolean;
  onSetKualitas: (k: KualitasHafalan) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        ayat.kualitas === 'Lancar'
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : ayat.kualitas === 'Cukup'
          ? 'bg-amber-500/5 border-amber-500/30'
          : ayat.kualitas === 'Perlu Ulang'
          ? 'bg-rose-500/5 border-rose-500/30'
          : 'bg-slate-950/60 border-slate-800'
      }`}
    >
      {isFirstOfSurah && surahMeta && (
        <div className="mb-2 pb-2 border-b border-slate-800/60">
          <p className="text-[11px] font-bold text-emerald-400">
            {surahMeta.nomor}. {surahMeta.nama_latin}
            <span className="text-slate-500 font-normal"> · {surahMeta.arti}</span>
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <span className="inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-xs shrink-0">
          {ayat.ayat}
        </span>
        <p
          className="text-right text-lg leading-loose text-slate-100 flex-1 font-arabic"
          dir="rtl"
          style={{ fontFamily: 'Amiri, "Traditional Arabic", serif' }}
        >
          {ayat.text}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KUALITAS_OPTIONS.map((opt) => {
          const c = KUALITAS_STYLE[opt.color];
          const isSelected = ayat.kualitas === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSetKualitas(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                isSelected
                  ? `${c.bg} ${c.border} ${c.text} ring-2 ring-offset-2 ring-offset-slate-950 ring-${opt.color}-500/30`
                  : `bg-slate-900 border-slate-800 text-slate-400 hover:${c.border} hover:${c.text}`
              }`}
            >
              <opt.icon size={12} /> {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// SUB — STAT CHIP
// =============================================================================
function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const c = {
    emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    rose: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    slate: 'bg-slate-800 border-slate-700 text-slate-400',
  }[color];

  return (
    <div className={`px-3 py-2 rounded-xl border ${c} text-center`}>
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[9px] uppercase font-bold opacity-80">{label}</p>
    </div>
  );
}