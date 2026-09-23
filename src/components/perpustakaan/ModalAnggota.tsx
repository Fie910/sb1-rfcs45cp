// src/components/perpustakaan/ModalAnggota.tsx
// Form Tambah/Edit Anggota Perpustakaan.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, User, Users, GraduationCap, Briefcase,
  UserCircle, Calendar, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS, TIPE_ANGGOTA_OPTIONS, STATUS_ANGGOTA_OPTIONS,
  generateKodeAnggota, DURASI_KEANGGOTAAN_BULAN,
} from './shared';
import type {
  PerpusAnggota, TipeAnggota, StatusAnggota, Siswa, Kelas, Guru,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type SiswaWithKelas = Siswa & { kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null };

type Props = {
  open: boolean;
  onClose: () => void;
  anggota?: PerpusAnggota | null;
  siswaList: SiswaWithKelas[];
  guruList: Guru[];
  onSaved: () => void;
};

const emptyForm = {
  tipe: 'Siswa' as TipeAnggota,
  siswa_id: '',
  guru_id: '',
  nama_lengkap: '',
  tanggal_expired: '',
  status: 'Aktif' as StatusAnggota,
  catatan: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================

export function ModalAnggota({
  open, onClose, anggota, siswaList, guruList, onSaved,
}: Props) {
  const isEdit = Boolean(anggota?.id);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ==========================================================================
  // INIT
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (anggota) {
      setForm({
        tipe: anggota.tipe,
        siswa_id: anggota.siswa_id ? String(anggota.siswa_id) : '',
        guru_id: anggota.guru_id ?? '',
        nama_lengkap: anggota.nama_lengkap,
        tanggal_expired: anggota.tanggal_expired ?? '',
        status: anggota.status,
        catatan: anggota.catatan ?? '',
      });
    } else {
      const now = new Date();
      const exp = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      setForm({
        ...emptyForm,
        tanggal_expired: exp.toISOString().split('T')[0],
      });
    }
  }, [open, anggota]);

  // Auto-fill nama saat siswa/guru dipilih
  useEffect(() => {
    if (isEdit) return;
    if (form.tipe === 'Siswa' && form.siswa_id) {
      const s = siswaList.find((x) => String(x.id) === form.siswa_id);
      if (s) setForm((f) => ({ ...f, nama_lengkap: s.nama_lengkap }));
    } else if ((form.tipe === 'Guru' || form.tipe === 'Tendik') && form.guru_id) {
      const g = guruList.find((x) => x.id === form.guru_id);
      if (g) setForm((f) => ({ ...f, nama_lengkap: g.nama_lengkap }));
    }
  }, [form.tipe, form.siswa_id, form.guru_id, siswaList, guruList, isEdit]);

  // ==========================================================================
  // GENERATE KODE
  // ==========================================================================
  const generateKode = async (tipe: TipeAnggota): Promise<string> => {
    const prefix = `AGT-${tipe.toUpperCase().slice(0, 3)}-`;
    const { count } = await supabase
      .from('perpus_anggota')
      .select('*', { count: 'exact', head: true })
      .ilike('kode_anggota', `${prefix}%`);
    return generateKodeAnggota(tipe, (count ?? 0) + 1);
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.nama_lengkap.trim()) { showToast('error', 'Nama lengkap wajib diisi'); return; }
    if (form.tipe === 'Siswa' && !form.siswa_id) {
      showToast('error', 'Pilih siswa terlebih dahulu'); return;
    }
    if ((form.tipe === 'Guru' || form.tipe === 'Tendik') && !form.guru_id) {
      showToast('error', 'Pilih guru/staf terlebih dahulu'); return;
    }

    setSaving(true);
    try {
      const payload: any = {
        tipe: form.tipe,
        siswa_id: form.tipe === 'Siswa' && form.siswa_id ? Number(form.siswa_id) : null,
        guru_id: (form.tipe === 'Guru' || form.tipe === 'Tendik') && form.guru_id
          ? form.guru_id : null,
        nama_lengkap: form.nama_lengkap.trim(),
        tanggal_expired: form.tanggal_expired || null,
        status: form.status,
        catatan: form.catatan.trim() || null,
      };

      if (isEdit && anggota?.id) {
        const { error } = await supabase.from('perpus_anggota')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', anggota.id);
        if (error) throw error;

        await logActivity({
          aksi: 'UPDATE', modul: MODUL_PERPUS, targetId: anggota.id,
          deskripsi: `Update anggota perpus: ${payload.nama_lengkap}`,
        });
        showToast('success', 'Anggota diperbarui');
      } else {
        const kode = await generateKode(form.tipe);
        const { data, error } = await supabase.from('perpus_anggota')
          .insert({ ...payload, kode_anggota: kode })
          .select().single();
        if (error) throw error;

        await logActivity({
          aksi: 'CREATE', modul: MODUL_PERPUS, targetId: data?.id,
          deskripsi: `Daftar anggota [${kode}]: ${payload.nama_lengkap}`,
        });
        showToast('success', `Anggota ${kode} terdaftar`);
      }
      onSaved(); onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? 'Edit Anggota' : 'Daftar Anggota Baru'} size="lg">
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* TIPE */}
        <div>
          <label className={LABEL_CLASS}>Tipe Anggota *</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIPE_ANGGOTA_OPTIONS.map((t) => {
              const Icon = t === 'Siswa' ? GraduationCap
                : t === 'Guru' ? User
                : t === 'Tendik' ? Briefcase : UserCircle;
              const active = form.tipe === t;
              return (
                <button key={t} type="button" disabled={isEdit}
                  onClick={() => setForm({ ...form, tipe: t, siswa_id: '', guru_id: '', nama_lengkap: '' })}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                  }`}>
                  <Icon size={16} />
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* SISWA PICKER */}
        {form.tipe === 'Siswa' && (
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
              disabled={isEdit}
            />
          </div>
        )}

        {/* GURU PICKER */}
        {(form.tipe === 'Guru' || form.tipe === 'Tendik') && (
          <div>
            <label className={LABEL_CLASS}>Guru / Staf *</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: g.nama_lengkap,
                hint: g.nip ? `NIP: ${g.nip}` : undefined,
              }))}
              value={form.guru_id}
              onChange={(v) => setForm({ ...form, guru_id: v })}
              placeholder="Pilih guru / staf..."
              searchPlaceholder="Cari nama / NIP..."
              emptyMessage="Tidak ditemukan"
              disabled={isEdit}
            />
          </div>
        )}

        {/* NAMA LENGKAP */}
        <div>
          <label className={LABEL_CLASS}>Nama Lengkap *</label>
          <input type="text" value={form.nama_lengkap}
            onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
            placeholder="Auto-terisi dari pilihan di atas, atau ketik manual"
            className={INPUT_CLASS} />
        </div>

        {/* TANGGAL EXPIRED */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Berlaku Sampai</label>
            <input type="date" value={form.tanggal_expired}
              onChange={(e) => setForm({ ...form, tanggal_expired: e.target.value })}
              className={INPUT_CLASS} />
            <p className="text-[10px] text-slate-500 mt-1">
              Default 1 tahun dari sekarang
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>Status</label>
            <select value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StatusAnggota })}
              className={INPUT_CLASS + ' cursor-pointer'}>
              {STATUS_ANGGOTA_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* CATATAN */}
        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea rows={2} value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Opsional"
            className={INPUT_CLASS + ' resize-none'} />
        </div>

        {/* INFO */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 flex items-start gap-2.5">
          <Info size={15} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-indigo-300/90 leading-relaxed">
            <p className="font-bold mb-0.5">Tentang Kode Anggota</p>
            <p className="text-indigo-400/70">
              Kode anggota auto-generate dengan format{' '}
              <code className="text-indigo-300">AGT-XXX-NNNN</code>. Kode ini dipakai
              untuk scan QR saat peminjaman.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition-colors cursor-pointer">
            Batal
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Simpan Perubahan' : 'Daftar Anggota'}
          </button>
        </div>
      </div>
    </Modal>
  );
}