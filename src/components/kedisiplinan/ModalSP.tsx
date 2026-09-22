// src/components/kedisiplinan/ModalSP.tsx
// Form Tambah/Edit Surat Peringatan.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, User, ShieldAlert, AlertCircle, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  getLevelSPBadge, getRekomendasiSP, LEVEL_SP_OPTIONS,
} from './shared';
import type {
  KesiswaanSuratPeringatan, LevelSP, Siswa, Kelas, Guru,
} from '@/types/database';

const MODUL_KEDISIPLINAN = (AUDIT_MODUL as any)?.KEDISIPLINAN ?? 'Kedisiplinan';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

type Props = {
  open: boolean;
  onClose: () => void;
  sp?: KesiswaanSuratPeringatan | null;
  siswaList: SiswaWithKelas[];
  guruList: Guru[];
  onSaved: () => void;
};

const emptyForm = {
  siswa_id: '',
  level: 'SP1' as LevelSP,
  alasan: '',
  tanggal_terbit: new Date().toISOString().split('T')[0],
  batas_waktu: '',
  ditandatangani_oleh: '',
  catatan: '',
};

export function ModalSP({ open, onClose, sp, siswaList, guruList, onSaved }: Props) {
  const { guru } = useAuth();
  const isEdit = Boolean(sp?.id);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [poinSiswa, setPoinSiswa] = useState<{
    pelanggaran: number;
    prestasi: number;
  }>({ pelanggaran: 0, prestasi: 0 });
  const [loadingPoin, setLoadingPoin] = useState(false);

  // ==========================================================================
  // INIT FORM
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (sp) {
      setForm({
        siswa_id: String(sp.siswa_id),
        level: sp.level,
        alasan: sp.alasan,
        tanggal_terbit: sp.tanggal_terbit,
        batas_waktu: sp.batas_waktu ?? '',
        ditandatangani_oleh: sp.ditandatangani_oleh ?? '',
        catatan: sp.catatan ?? '',
      });
      setPoinSiswa({
        pelanggaran: sp.total_poin_pelanggaran,
        prestasi: sp.total_poin_prestasi,
      });
    } else {
      setForm({
        ...emptyForm,
        ditandatangani_oleh: guru?.id ?? '',
      });
      setPoinSiswa({ pelanggaran: 0, prestasi: 0 });
    }
  }, [open, sp, guru?.id]);

  // ==========================================================================
  // FETCH POIN saat siswa dipilih
  // ==========================================================================
  useEffect(() => {
    if (!form.siswa_id || isEdit) return;

    const fetchPoin = async () => {
      setLoadingPoin(true);
      try {
        const sid = Number(form.siswa_id);
        const [pelanggaranRes, prestasiRes] = await Promise.all([
          supabase.from('kesiswaan_pelanggaran').select('poin').eq('siswa_id', sid),
          supabase.from('kesiswaan_prestasi').select('poin').eq('siswa_id', sid),
        ]);

        const totalPelanggaran = (pelanggaranRes.data ?? []).reduce(
          (sum: number, p: any) => sum + p.poin, 0
        );
        const totalPrestasi = (prestasiRes.data ?? []).reduce(
          (sum: number, p: any) => sum + p.poin, 0
        );
        setPoinSiswa({ pelanggaran: totalPelanggaran, prestasi: totalPrestasi });

        // Auto-suggest level SP berdasarkan rekomendasi
        const rekomendasi = getRekomendasiSP(totalPelanggaran - totalPrestasi);
        if (rekomendasi) {
          setForm((prev) => ({ ...prev, level: rekomendasi }));
        }
      } catch (err) {
        console.error('Fetch poin error:', err);
      } finally {
        setLoadingPoin(false);
      }
    };

    fetchPoin();
  }, [form.siswa_id, isEdit]);

  // ==========================================================================
  // AUTO-GENERATE NOMOR SP
  // ==========================================================================
  const generateNomorSP = async (level: LevelSP): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `SP-${level}-${year}-`;

    const { count } = await supabase
      .from('kesiswaan_surat_peringatan')
      .select('*', { count: 'exact', head: true })
      .ilike('nomor_sp', `${prefix}%`);

    const seq = (count ?? 0) + 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  };

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const selectedSiswa = siswaList.find((s) => String(s.id) === form.siswa_id);
  const poinBersih = poinSiswa.pelanggaran - poinSiswa.prestasi;
  const rekomendasi = getRekomendasiSP(poinBersih);

  const handleSubmit = async () => {
    if (!form.siswa_id) { showToast('error', 'Pilih siswa'); return; }
    if (!form.alasan.trim()) { showToast('error', 'Alasan SP wajib diisi'); return; }

    setSaving(true);
    try {
      const payload: any = {
        siswa_id: Number(form.siswa_id),
        level: form.level,
        alasan: form.alasan.trim(),
        tanggal_terbit: form.tanggal_terbit,
        batas_waktu: form.batas_waktu || null,
        ditandatangani_oleh: form.ditandatangani_oleh || null,
        catatan: form.catatan.trim() || null,
        total_poin_pelanggaran: poinSiswa.pelanggaran,
        total_poin_prestasi: poinSiswa.prestasi,
      };

      if (isEdit && sp?.id) {
        const { error } = await supabase.from('kesiswaan_surat_peringatan')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', sp.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: MODUL_KEDISIPLINAN, targetId: sp.id,
          deskripsi: `Update SP ${form.level}: ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', 'SP diperbarui');
      } else {
        const nomorSp = await generateNomorSP(form.level);
        const { data, error } = await supabase
          .from('kesiswaan_surat_peringatan')
          .insert({ ...payload, nomor_sp: nomorSp, status: 'Aktif' })
          .select().single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: MODUL_KEDISIPLINAN, targetId: data?.id,
          deskripsi: `Terbitkan ${form.level} [${nomorSp}] untuk ${selectedSiswa?.nama_lengkap}`,
        });
        showToast('success', `${form.level} berhasil diterbitkan`);
      }

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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Surat Peringatan' : 'Terbitkan Surat Peringatan'}
      size="lg"
    >
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* SISWA PICKER */}
        <div>
          <label className={LABEL_CLASS}>Siswa *</label>
          <SearchableSelect
            options={siswaList.map((s) => ({
              value: String(s.id),
              label: s.nama_lengkap,
              hint: `${s.kelas?.nama_kelas ?? '-'} · NISN: ${s.nisn}`,
            }))}
            value={form.siswa_id}
            onChange={(v) => setForm({ ...form, siswa_id: v })}
            placeholder="Pilih siswa..."
            searchPlaceholder="Cari nama / NISN..."
            emptyMessage="Siswa tidak ditemukan"
          />
        </div>

        {/* INFO POIN */}
        {form.siswa_id && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase tracking-wider">
              <Info size={13} className="text-indigo-400" />
              Rekap Poin Siswa
              {loadingPoin && <Loader2 size={12} className="animate-spin text-indigo-400" />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-2.5">
                <p className="text-[10px] font-bold uppercase text-rose-400 mb-0.5">Pelanggaran</p>
                <p className="text-lg font-extrabold text-rose-400">{poinSiswa.pelanggaran}</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5">
                <p className="text-[10px] font-bold uppercase text-emerald-400 mb-0.5">Prestasi</p>
                <p className="text-lg font-extrabold text-emerald-400">{poinSiswa.prestasi}</p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5">
                <p className="text-[10px] font-bold uppercase text-amber-400 mb-0.5">Poin Bersih</p>
                <p className="text-lg font-extrabold text-amber-400">{poinBersih}</p>
              </div>
            </div>

            {rekomendasi && (
              <div className={`flex items-start gap-2 px-3 py-2 rounded-xl border ${
                rekomendasi === 'SP3'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  : rekomendasi === 'SP2'
                  ? 'bg-orange-500/5 border-orange-500/20 text-orange-400'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}>
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Berdasarkan poin bersih ({poinBersih}), sistem merekomendasikan{' '}
                  <strong>{rekomendasi}</strong>. Anda dapat mengubahnya manual jika perlu.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LEVEL SP */}
        <div>
          <label className={LABEL_CLASS}>Level Surat Peringatan *</label>
          <div className="grid grid-cols-3 gap-2">
            {LEVEL_SP_OPTIONS.map((lvl) => {
              const active = form.level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setForm({ ...form, level: lvl })}
                  className={`py-3 px-3 rounded-xl border text-sm font-extrabold transition-all cursor-pointer ${
                    active
                      ? `${getLevelSPBadge(lvl)} border-2`
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldAlert size={16} className="mx-auto mb-1" />
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* ALASAN */}
        <div>
          <label className={LABEL_CLASS}>Alasan / Pelanggaran yang Dilakukan *</label>
          <textarea
            rows={3}
            value={form.alasan}
            onChange={(e) => setForm({ ...form, alasan: e.target.value })}
            placeholder="Contoh: Melakukan pelanggaran berat berupa perkelahian dengan siswa lain yang menyebabkan cedera fisik..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* TANGGAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Terbit</label>
            <input
              type="date"
              value={form.tanggal_terbit}
              onChange={(e) => setForm({ ...form, tanggal_terbit: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Batas Waktu (Deadline)</label>
            <input
              type="date"
              value={form.batas_waktu}
              onChange={(e) => setForm({ ...form, batas_waktu: e.target.value })}
              className={INPUT_CLASS}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Tanggal maksimal orang tua hadir / perbaikan perilaku
            </p>
          </div>
        </div>

        {/* PENANDATANGAN */}
        <div>
          <label className={LABEL_CLASS}>Ditandatangani Oleh</label>
          <SearchableSelect
            options={guruList.map((g) => ({
              value: g.id,
              label: g.nama_lengkap,
              hint: g.nip ? `NIP: ${g.nip}` : undefined,
            }))}
            value={form.ditandatangani_oleh}
            onChange={(v) => setForm({ ...form, ditandatangani_oleh: v })}
            placeholder="Pilih penandatangan..."
            searchPlaceholder="Cari nama / NIP..."
            emptyMessage="Guru tidak ditemukan"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            Nama & NIP akan muncul di kolom tanda tangan surat.
          </p>
        </div>

        {/* CATATAN */}
        <div>
          <label className={LABEL_CLASS}>Catatan Tambahan</label>
          <textarea
            rows={2}
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tambahan yang akan muncul di surat (opsional)"
            className={INPUT_CLASS + ' resize-none'}
          />
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
            disabled={saving || !form.siswa_id || !form.alasan.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Menyimpan...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : `Terbitkan ${form.level}`}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}