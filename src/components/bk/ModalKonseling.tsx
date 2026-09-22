// src/components/bk/ModalKonseling.tsx
// Form Tambah/Edit Sesi Konseling — dynamic berdasarkan tipe.

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Save,
  User,
  Users,
  GraduationCap,
  Plus,
  X,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS,
  LABEL_CLASS,
  TIPE_KONSELING_OPTIONS,
  STATUS_KONSELING_OPTIONS,
} from './shared';
import type {
  BkKonseling,
  BkKategoriMasalah,
  Guru,
  Kelas,
  Siswa,
  TipeKonseling,
  StatusKonseling,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================

// ✅ FIX #1: siswa_id = string (konsisten dengan type Siswa.id di database.ts)
type KelompokAnggota = {
  siswa_id: string;
  nama_lengkap: string;
  nisn: string;
};

type ModalKonselingProps = {
  open: boolean;
  onClose: () => void;
  konseling?: BkKonseling | null;
  kategoriList: BkKategoriMasalah[];
  kelasList: Kelas[];
  siswaList: Siswa[];
  guruList: Guru[];
  onSaved: () => void;
};

// =============================================================================
// FORM STATE
// =============================================================================

const emptyForm = {
  tipe: 'Individual' as TipeKonseling,
  siswa_id: '',
  kelompok_nama: '',
  kelas_id: '',
  guru_bk_id: '',
  kategori_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  waktu_mulai: '',
  waktu_selesai: '',
  topik: '',
  deskripsi: '',
  catatan_rahasia: '',
  hasil: '',
  tindak_lanjut: '',
  status: 'Diajukan' as StatusKonseling,
  is_rahasia: true,
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function ModalKonseling({
  open,
  onClose,
  konseling,
  kategoriList,
  kelasList,
  siswaList,
  guruList,
  onSaved,
}: ModalKonselingProps) {
  const { guru } = useAuth();
  const isEdit = Boolean(konseling?.id);

  const [form, setForm] = useState(emptyForm);
  const [kelompokAnggota, setKelompokAnggota] = useState<KelompokAnggota[]>([]);
  const [saving, setSaving] = useState(false);
  const [siswaPickerOpen, setSiswaPickerOpen] = useState(false);

  // ==========================================================================
  // AUTO-GENERATE KODE SESI
  // ==========================================================================
  const generateKodeSesi = async (): Promise<string> => {
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `BK-${ym}-`;

    const { count } = await supabase
      .from('bk_konseling')
      .select('*', { count: 'exact', head: true })
      .ilike('kode_sesi', `${prefix}%`);

    const seq = (count ?? 0) + 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  };

  // ==========================================================================
  // INIT / POPULATE FORM
  // ==========================================================================
  useEffect(() => {
    if (!open) return;

    if (konseling) {
      setForm({
        tipe: konseling.tipe,
        siswa_id: konseling.siswa_id ? String(konseling.siswa_id) : '',
        kelompok_nama: konseling.kelompok_nama ?? '',
        kelas_id: konseling.kelas_id ? String(konseling.kelas_id) : '',
        guru_bk_id: konseling.guru_bk_id ?? '',
        kategori_id: konseling.kategori_id ?? '',
        tanggal: konseling.tanggal,
        waktu_mulai: konseling.waktu_mulai?.slice(0, 5) ?? '',
        waktu_selesai: konseling.waktu_selesai?.slice(0, 5) ?? '',
        topik: konseling.topik,
        deskripsi: konseling.deskripsi ?? '',
        catatan_rahasia: konseling.catatan_rahasia ?? '',
        hasil: konseling.hasil ?? '',
        tindak_lanjut: konseling.tindak_lanjut ?? '',
        status: konseling.status,
        is_rahasia: konseling.is_rahasia,
      });

      // ✅ FIX #2: konversi siswa_id dari jsonb (number) → string untuk konsistensi
      setKelompokAnggota(
        Array.isArray(konseling.kelompok_anggota)
          ? (konseling.kelompok_anggota as any[]).map((a) => ({
              siswa_id: String(a.siswa_id),
              nama_lengkap: a.nama_lengkap ?? '',
              nisn: a.nisn ?? '',
            }))
          : []
      );
    } else {
      setForm({
        ...emptyForm,
        guru_bk_id: guru?.id ?? '',
      });
      setKelompokAnggota([]);
    }
  }, [open, konseling, guru?.id]);

  // ==========================================================================
  // KELOMPOK: MULTI-SISWA PICKER
  // ==========================================================================
  const availableSiswaForKelompok = useMemo(
    () =>
      siswaList.filter(
        (s) => !kelompokAnggota.some((a) => a.siswa_id === String(s.id))
      ),
    [siswaList, kelompokAnggota]
  );

  const handleAddAnggota = (siswaId: string) => {
    const siswa = siswaList.find((s) => String(s.id) === siswaId);
    if (!siswa) return;
    if (kelompokAnggota.some((a) => a.siswa_id === String(siswa.id))) {
      showToast('info', 'Siswa sudah ada dalam kelompok');
      return;
    }
    setKelompokAnggota((prev) => [
      ...prev,
      {
        siswa_id: String(siswa.id), // ✅ FIX: pastikan string
        nama_lengkap: siswa.nama_lengkap,
        nisn: siswa.nisn,
      },
    ]);
    setSiswaPickerOpen(false);
  };

  const handleRemoveAnggota = (siswaId: string) => {
    setKelompokAnggota((prev) => prev.filter((a) => a.siswa_id !== siswaId));
  };

  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  const validate = (): string | null => {
    if (!form.topik.trim()) return 'Topik konseling wajib diisi';
    if (!form.tanggal) return 'Tanggal wajib diisi';

    if (form.tipe === 'Individual' || form.tipe === 'Online') {
      if (!form.siswa_id) return 'Pilih siswa untuk konseling individual';
    }

    if (form.tipe === 'Kelompok') {
      if (!form.kelompok_nama.trim()) return 'Nama kelompok wajib diisi';
      if (kelompokAnggota.length < 2)
        return 'Konseling kelompok minimal 2 anggota';
    }

    if (form.tipe === 'Klasikal') {
      if (!form.kelas_id) return 'Pilih kelas untuk konseling klasikal';
    }

    if (!form.guru_bk_id) return 'Guru BK wajib dipilih';

    return null;
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showToast('error', err);
      return;
    }

    setSaving(true);
    try {
      // ✅ FIX #3: konversi siswa_id ke number saat simpan ke DB (jsonb)
      const kelompokPayload =
        form.tipe === 'Kelompok'
          ? kelompokAnggota.map((a) => ({
              siswa_id: Number(a.siswa_id),
              nama_lengkap: a.nama_lengkap,
              nisn: a.nisn,
            }))
          : null;

      const payload: any = {
        tipe: form.tipe,
        siswa_id:
          form.tipe === 'Individual' || form.tipe === 'Online'
            ? Number(form.siswa_id)
            : null,
        kelompok_nama: form.tipe === 'Kelompok' ? form.kelompok_nama.trim() : null,
        kelompok_anggota: kelompokPayload,
        kelas_id: form.tipe === 'Klasikal' ? Number(form.kelas_id) : null,
        guru_bk_id: form.guru_bk_id,
        kategori_id: form.kategori_id || null,
        tanggal: form.tanggal,
        waktu_mulai: form.waktu_mulai || null,
        waktu_selesai: form.waktu_selesai || null,
        topik: form.topik.trim(),
        deskripsi: form.deskripsi.trim() || null,
        catatan_rahasia: form.catatan_rahasia.trim() || null,
        hasil: form.hasil.trim() || null,
        tindak_lanjut: form.tindak_lanjut.trim() || null,
        status: form.status,
        is_rahasia: form.is_rahasia,
      };

      if (isEdit && konseling?.id) {
        const { error } = await supabase
          .from('bk_konseling')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', konseling.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.BK,
          targetId: konseling.id,
          deskripsi: `Update sesi konseling: ${payload.topik}`,
        });

        showToast('success', 'Sesi konseling diperbarui');
      } else {
        const kodeSesi = await generateKodeSesi();
        const { data, error } = await supabase
          .from('bk_konseling')
          .insert({ ...payload, kode_sesi: kodeSesi })
          .select()
          .single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.BK,
          targetId: data?.id,
          deskripsi: `Buat sesi konseling [${kodeSesi}]: ${payload.topik}`,
        });

        showToast('success', `Sesi konseling ${kodeSesi} dibuat`);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Sesi ${konseling?.kode_sesi ?? ''}` : 'Buat Sesi Konseling Baru'}
      size="lg"
    >
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* TIPE */}
        <div>
          <label className={LABEL_CLASS}>Tipe Konseling *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIPE_KONSELING_OPTIONS.map((t) => {
              const Icon =
                t === 'Individual' || t === 'Online'
                  ? User
                  : t === 'Kelompok'
                  ? Users
                  : GraduationCap;
              const active = form.tipe === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tipe: t })}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={16} />
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* DYNAMIC FIELDS — INDIVIDUAL/ONLINE */}
        {(form.tipe === 'Individual' || form.tipe === 'Online') && (
          <div>
            <label className={LABEL_CLASS}>Siswa *</label>
            <SearchableSelect
              options={siswaList.map((s) => ({
                value: String(s.id),
                label: s.nama_lengkap,
                hint: `NISN: ${s.nisn}`,
              }))}
              value={form.siswa_id}
              onChange={(v) => setForm({ ...form, siswa_id: v })}
              placeholder="Pilih siswa..."
              searchPlaceholder="Cari nama / NISN..."
              emptyMessage="Siswa tidak ditemukan"
            />
          </div>
        )}

        {/* DYNAMIC FIELDS — KELOMPOK */}
        {form.tipe === 'Kelompok' && (
          <>
            <div>
              <label className={LABEL_CLASS}>Nama Kelompok *</label>
              <input
                type="text"
                value={form.kelompok_nama}
                onChange={(e) => setForm({ ...form, kelompok_nama: e.target.value })}
                placeholder="Contoh: Kelompok Kepercayaan Diri"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL_CLASS + ' mb-0'}>
                  Anggota Kelompok * ({kelompokAnggota.length})
                </label>
                <button
                  type="button"
                  onClick={() => setSiswaPickerOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  <Plus size={12} /> Tambah Anggota
                </button>
              </div>

              {kelompokAnggota.length === 0 ? (
                <div className="text-center py-6 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  Belum ada anggota. Klik "Tambah Anggota" untuk menambahkan.
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                  {kelompokAnggota.map((a) => (
                    <div
                      key={a.siswa_id}
                      className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {a.nama_lengkap}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500">
                          NISN: {a.nisn}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAnggota(a.siswa_id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* DYNAMIC FIELDS — KLASIKAL */}
        {form.tipe === 'Klasikal' && (
          <div>
            <label className={LABEL_CLASS}>Kelas *</label>
            <SearchableSelect
              options={kelasList.map((k) => ({
                value: String(k.id),
                label: k.nama_kelas,
              }))}
              value={form.kelas_id}
              onChange={(v) => setForm({ ...form, kelas_id: v })}
              placeholder="Pilih kelas..."
              searchPlaceholder="Cari kelas..."
              emptyMessage="Kelas tidak ditemukan"
            />
          </div>
        )}

        {/* KATEGORI & GURU BK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Kategori Masalah</label>
            <SearchableSelect
              options={kategoriList.map((k) => ({
                value: k.id,
                label: k.nama,
                hint: k.bidang,
              }))}
              value={form.kategori_id}
              onChange={(v) => setForm({ ...form, kategori_id: v })}
              placeholder="Pilih kategori (opsional)"
              searchPlaceholder="Cari kategori..."
              emptyMessage="Kategori tidak ditemukan"
            />
          </div>

          <div>
            <label className={LABEL_CLASS}>Guru BK *</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: g.nama_lengkap,
                hint: g.nip ? `NIP: ${g.nip}` : undefined,
              }))}
              value={form.guru_bk_id}
              onChange={(v) => setForm({ ...form, guru_bk_id: v })}
              placeholder="Pilih guru BK..."
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
        </div>

        {/* JADWAL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <label className={LABEL_CLASS}>Waktu Mulai</label>
            <input
              type="time"
              value={form.waktu_mulai}
              onChange={(e) => setForm({ ...form, waktu_mulai: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Waktu Selesai</label>
            <input
              type="time"
              value={form.waktu_selesai}
              onChange={(e) => setForm({ ...form, waktu_selesai: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* TOPIK & DESKRIPSI */}
        <div>
          <label className={LABEL_CLASS}>Topik / Fokus Konseling *</label>
          <input
            type="text"
            value={form.topik}
            onChange={(e) => setForm({ ...form, topik: e.target.value })}
            placeholder="Contoh: Pendampingan masalah motivasi belajar"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Deskripsi Umum</label>
          <textarea
            rows={2}
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            placeholder="Ringkasan situasi / latar belakang..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* CATATAN RAHASIA */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-amber-400" />
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Catatan Rahasia
            </label>
          </div>
          <p className="text-[10px] text-amber-400/70 leading-relaxed">
            <AlertTriangle size={10} className="inline mr-1" />
            Catatan ini hanya dapat dilihat oleh Guru BK, Kepala Sekolah, dan Admin.
          </p>
          <textarea
            rows={3}
            value={form.catatan_rahasia}
            onChange={(e) => setForm({ ...form, catatan_rahasia: e.target.value })}
            placeholder="Catatan mendalam tentang kondisi siswa (rahasia)..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/30 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
          />
        </div>

        {/* HASIL & TINDAK LANJUT */}
        <div>
          <label className={LABEL_CLASS}>Hasil Konseling</label>
          <textarea
            rows={2}
            value={form.hasil}
            onChange={(e) => setForm({ ...form, hasil: e.target.value })}
            placeholder="Kesimpulan / hasil sesi..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>Tindak Lanjut</label>
          <textarea
            rows={2}
            value={form.tindak_lanjut}
            onChange={(e) => setForm({ ...form, tindak_lanjut: e.target.value })}
            placeholder="Langkah selanjutnya / rekomendasi..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* STATUS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Status Sesi</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as StatusKonseling })
              }
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {STATUS_KONSELING_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS}>Visibilitas</label>
            <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_rahasia}
                onChange={(e) => setForm({ ...form, is_rahasia: e.target.checked })}
                className="accent-purple-500 cursor-pointer"
              />
              <span className="text-xs text-slate-300">
                Tandai sebagai sesi rahasia
              </span>
            </label>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Simpan Perubahan' : 'Buat Sesi'}
          </button>
        </div>
      </div>

      {/* MODAL PICKER SISWA UNTUK KELOMPOK */}
      {siswaPickerOpen && (
        <Modal
          open={siswaPickerOpen}
          onClose={() => setSiswaPickerOpen(false)}
          title="Pilih Anggota Kelompok"
          size="md"
        >
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-400">
              Pilih siswa untuk ditambahkan ke kelompok. Siswa yang sudah
              terdaftar tidak akan muncul di sini.
            </p>

            <SearchableSelect
              options={availableSiswaForKelompok.map((s) => ({
                value: String(s.id),
                label: s.nama_lengkap,
                hint: `NISN: ${s.nisn}`,
              }))}
              value=""
              onChange={(v) => handleAddAnggota(v)}
              placeholder="Pilih siswa..."
              searchPlaceholder="Cari nama / NISN..."
              emptyMessage="Tidak ada siswa yang tersedia"
            />

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSiswaPickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}