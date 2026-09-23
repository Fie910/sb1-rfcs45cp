// src/components/perpustakaan/ModalPeminjaman.tsx
// Form buat peminjaman buku baru.

import { useState, useEffect } from 'react';
import {
  Loader2, Save, User, Book, Calendar, Info, AlertCircle,
  BookOpen, GraduationCap, Briefcase, UserCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  calculateDueDate, formatDateLong, DURASI_PINJAM_HARI,
} from './shared';
import type {
  PerpusAnggotaWithRelations, PerpusBukuWithRelations, PerpusPeminjaman,
} from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type Props = {  
  open: boolean;
  onClose: () => void;
  anggotaList: PerpusAnggotaWithRelations[];
  bukuList: PerpusBukuWithRelations[];
  onSaved: () => void;
};

const emptyForm = {
  anggota_id: '',
  buku_id: '',
  tanggal_pinjam: new Date().toISOString().split('T')[0],
  tanggal_jatuh_tempo: calculateDueDate(new Date().toISOString().split('T')[0]),
  kondisi_saat_pinjam: 'Baik',
  catatan: '',
};

export function ModalPeminjaman({ open, onClose, anggotaList, bukuList, onSaved }: Props) {
  const { guru } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ==========================================================================
  // INIT
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      tanggal_pinjam: new Date().toISOString().split('T')[0],
      tanggal_jatuh_tempo: calculateDueDate(new Date().toISOString().split('T')[0]),
    });
  }, [open]);

  // Auto-recalc jatuh tempo saat tanggal pinjam berubah
  useEffect(() => {
    if (form.tanggal_pinjam) {
      setForm((f) => ({
        ...f,
        tanggal_jatuh_tempo: calculateDueDate(f.tanggal_pinjam, DURASI_PINJAM_HARI),
      }));
    }
  }, [form.tanggal_pinjam]);

  const selectedAnggota = anggotaList.find((a) => a.id === form.anggota_id);
  const selectedBuku = bukuList.find((b) => b.id === form.buku_id);

  // Buku tersedia (stok > 0 dan aktif)
  const bukuTersedia = bukuList.filter((b) => b.jumlah_tersedia > 0 && b.is_aktif);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.anggota_id) { showToast('error', 'Pilih anggota'); return; }
    if (!form.buku_id) { showToast('error', 'Pilih buku'); return; }

    if (selectedAnggota?.status !== 'Aktif') {
      showToast('error', 'Anggota tidak aktif — tidak dapat meminjam');
      return;
    }
    if (selectedBuku && selectedBuku.jumlah_tersedia <= 0) {
      showToast('error', 'Stok buku habis');
      return;
    }

    setSaving(true);
    try {
      // 1. Insert peminjaman
      const { data, error } = await supabase
        .from('perpus_peminjaman')
        .insert({
          anggota_id: form.anggota_id,
          buku_id: form.buku_id,
          tanggal_pinjam: form.tanggal_pinjam,
          tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
          kondisi_saat_pinjam: form.kondisi_saat_pinjam,
          catatan: form.catatan.trim() || null,
          petugas_pinjam_id: guru?.id ?? null,
          status: 'Dipinjam',
        })
        .select()
        .single();
      if (error) throw error;

      // 2. Update stok buku
      await supabase
        .from('perpus_buku')
        .update({
          jumlah_tersedia: selectedBuku!.jumlah_tersedia - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', form.buku_id);

      // 3. Audit log
      await logActivity({
        aksi: 'CREATE',
        modul: MODUL_PERPUS,
        targetId: data?.id,
        deskripsi: `Peminjaman buku: ${selectedBuku?.judul} → ${selectedAnggota?.nama_lengkap}`,
      });

      showToast('success', 'Peminjaman berhasil dicatat');
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
  const getTipeIcon = (tipe: string) => {
    switch (tipe) {
      case 'Siswa': return GraduationCap;
      case 'Guru': return User;
      case 'Tendik': return Briefcase;
      default: return UserCircle;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Peminjaman Buku Baru" size="lg">
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* ANGGOTA PICKER */}
        <div>
          <label className={LABEL_CLASS}>Anggota *</label>
          <SearchableSelect
            options={anggotaList
              .filter((a) => a.status === 'Aktif')
              .map((a) => ({
                value: a.id,
                label: a.nama_lengkap,
                hint: `${a.tipe}${a.siswa?.kelas?.nama_kelas ? ` · Kelas ${a.siswa.kelas.nama_kelas}` : ''} · ${a.kode_anggota}`,
              }))}
            value={form.anggota_id}
            onChange={(v) => setForm({ ...form, anggota_id: v })}
            placeholder="Pilih anggota..."
            searchPlaceholder="Cari nama / kode anggota / NISN..."
            emptyMessage="Anggota tidak ditemukan"
          />
          {selectedAnggota && (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
              {(() => {
                const I = getTipeIcon(selectedAnggota.tipe);
                return (
                  <span className="inline-flex items-center gap-1 text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    <I size={11} /> {selectedAnggota.tipe}
                  </span>
                );
              })()}
              <span className="text-slate-500 font-mono">{selectedAnggota.kode_anggota}</span>
              {selectedAnggota.total_denda > 0 && (
                <span className="text-amber-400 font-bold">
                  ⚠ Denda: Rp {selectedAnggota.total_denda.toLocaleString('id-ID')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* BUKU PICKER */}
        <div>
          <label className={LABEL_CLASS}>Buku *</label>
          <SearchableSelect
            options={bukuTersedia.map((b) => ({
              value: b.id,
              label: b.judul,
              hint: `${b.kode_buku ?? '-'} · Stok: ${b.jumlah_tersedia}/${b.jumlah_total} · ${b.pengarang ?? '-'}`,
            }))}
            value={form.buku_id}
            onChange={(v) => setForm({ ...form, buku_id: v })}
            placeholder={bukuTersedia.length === 0 ? 'Tidak ada buku tersedia' : 'Pilih buku...'}
            searchPlaceholder="Cari judul / pengarang / kode..."
            emptyMessage="Buku tidak ditemukan atau stok habis"
          />
          {selectedBuku && (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <BookOpen size={11} /> Stok: {selectedBuku.jumlah_tersedia}
              </span>
              {selectedBuku.rak && (
                <span>Rak: {selectedBuku.rak.nama}</span>
              )}
            </div>
          )}
        </div>

        {/* TANGGAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Pinjam</label>
            <input
              type="date"
              value={form.tanggal_pinjam}
              onChange={(e) => setForm({ ...form, tanggal_pinjam: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jatuh Tempo</label>
            <input
              type="date"
              value={form.tanggal_jatuh_tempo}
              onChange={(e) => setForm({ ...form, tanggal_jatuh_tempo: e.target.value })}
              className={INPUT_CLASS}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Default {DURASI_PINJAM_HARI} hari dari tanggal pinjam
            </p>
          </div>
        </div>

        {/* INFO DURASI */}
        {form.tanggal_pinjam && form.tanggal_jatuh_tempo && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Calendar size={15} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-indigo-300/90 leading-relaxed">
              <p className="font-bold mb-0.5">Periode Peminjaman</p>
              <p className="text-indigo-400/70">
                {formatDateLong(form.tanggal_pinjam)} → {formatDateLong(form.tanggal_jatuh_tempo)}
                {' · '}
                <span className="text-indigo-300 font-bold">
                  {Math.round((new Date(form.tanggal_jatuh_tempo).getTime() - new Date(form.tanggal_pinjam).getTime()) / (1000 * 60 * 60 * 24))} hari
                </span>
              </p>
            </div>
          </div>
        )}

        {/* KONDISI SAAT PINJAM */}
        <div>
          <label className={LABEL_CLASS}>Kondisi Buku Saat Dipinjam</label>
          <select
            value={form.kondisi_saat_pinjam}
            onChange={(e) => setForm({ ...form, kondisi_saat_pinjam: e.target.value })}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="Baik">Baik — buku dalam kondisi prima</option>
            <option value="Rusak Ringan">Rusak Ringan — ada lecet/lipatan</option>
          </select>
        </div>

        {/* CATATAN */}
        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea
            rows={2}
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tambahan (opsional)"
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* INFO DENDA */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
          <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-300/90 leading-relaxed">
            <p className="font-bold mb-0.5">Kebijakan Denda</p>
            <p className="text-amber-400/70">
              Denda keterlambatan Rp 500/hari. Buku hilang wajib diganti dengan
              judul yang sama atau setara.
            </p>
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
            disabled={saving || !form.anggota_id || !form.buku_id}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Catat Peminjaman
          </button>
        </div>
      </div>
    </Modal>
  );
}