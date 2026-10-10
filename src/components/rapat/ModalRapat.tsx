// src/components/rapat/ModalRapat.tsx
// Form create/edit rapat + pilih peserta + notifikasi otomatis.

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, Users, X, Search, Check, AlertTriangle,
  Calendar as CalendarIcon, Clock, MapPin, UserCog, Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { notifyRapatCreated, notifyRapatUpdated } from '@/lib/notifications/rapatNotifications';
import {
  INPUT_CLASS, LABEL_CLASS,
  JENIS_RAPAT_OPTIONS, STATUS_RAPAT_OPTIONS,
} from './shared';
import type {
  Rapat, RapatWithRelations, JenisRapat, StatusRapat, Guru,
} from '@/types/database';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: RapatWithRelations | null;
  guruList: Pick<Guru, 'id' | 'nama_lengkap' | 'nip' | 'jenis_ptk'>[];
  currentGuruId: string;
};

const emptyForm = {
  judul: '',
  jenis: 'Rapat Koordinasi' as JenisRapat,
  deskripsi: '',
  tanggal: new Date().toISOString().slice(0, 10),
  waktu_mulai: '08:00',
  waktu_selesai: '10:00',
  lokasi: '',
  penyelenggara: '',
  pemimpin_rapat_id: '',
  notulis_id: '',
  status: 'Akan Datang' as StatusRapat,
  is_public: true,
  catatan_umum: '',
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ModalRapat({
  open, onClose, onSaved, editing, guruList, currentGuruId,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [pesertaIds, setPesertaIds] = useState<string[]>([]);
  const [pesertaSearch, setPesertaSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPeserta, setLoadingPeserta] = useState(false);

  const isEdit = Boolean(editing?.id);

  // ==========================================================================
  // LOAD saat open
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        judul: editing.judul,
        jenis: editing.jenis,
        deskripsi: editing.deskripsi ?? '',
        tanggal: editing.tanggal,
        waktu_mulai: editing.waktu_mulai?.slice(0, 5) ?? '08:00',
        waktu_selesai: editing.waktu_selesai?.slice(0, 5) ?? '',
        lokasi: editing.lokasi ?? '',
        penyelenggara: editing.penyelenggara ?? '',
        pemimpin_rapat_id: editing.pemimpin_rapat_id ?? '',
        notulis_id: editing.notulis_id ?? '',
        status: editing.status,
        is_public: editing.is_public,
        catatan_umum: editing.catatan_umum ?? '',
      });

      (async () => {
        setLoadingPeserta(true);
        const { data } = await supabase
          .from('rapat_peserta')
          .select('guru_id')
          .eq('rapat_id', editing.id);
        setPesertaIds((data ?? []).map((p: any) => p.guru_id));
        setLoadingPeserta(false);
      })();
    } else {
      setForm({ ...emptyForm, pemimpin_rapat_id: currentGuruId });
      setPesertaIds([]);
    }
    setPesertaSearch('');
  }, [open, editing, currentGuruId]);

  // ==========================================================================
  // PESERTA FILTER
  // ==========================================================================
  const filteredGuru = useMemo(() => {
    if (!pesertaSearch.trim()) return guruList;
    const q = pesertaSearch.toLowerCase();
    return guruList.filter(
      (g) =>
        g.nama_lengkap.toLowerCase().includes(q) ||
        (g.nip ?? '').toLowerCase().includes(q)
    );
  }, [guruList, pesertaSearch]);

  const togglePeserta = (id: string) => {
    setPesertaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (pesertaIds.length === filteredGuru.length) setPesertaIds([]);
    else setPesertaIds(filteredGuru.map((g) => g.id));
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.judul.trim()) {
      showToast('error', 'Judul rapat wajib diisi');
      return;
    }
    if (!form.tanggal) {
      showToast('error', 'Tanggal wajib diisi');
      return;
    }
    if (!form.waktu_mulai) {
      showToast('error', 'Waktu mulai wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        judul: form.judul.trim(),
        jenis: form.jenis,
        deskripsi: form.deskripsi.trim() || null,
        tanggal: form.tanggal,
        waktu_mulai: form.waktu_mulai,
        waktu_selesai: form.waktu_selesai || null,
        lokasi: form.lokasi.trim() || null,
        penyelenggara: form.penyelenggara.trim() || null,
        pemimpin_rapat_id: form.pemimpin_rapat_id || null,
        notulis_id: form.notulis_id || null,
        status: form.status,
        is_public: form.is_public,
        catatan_umum: form.catatan_umum.trim() || null,
      };

      let rapatId: string;

      if (isEdit && editing?.id) {
        const { error } = await supabase
          .from('rapat')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        rapatId = editing.id;

        await logActivity({
          aksi: 'UPDATE',
          modul: AUDIT_MODUL.TODO,
          targetId: editing.id,
          deskripsi: `Update rapat: ${payload.judul}`,
        });
      } else {
        const { data, error } = await supabase
          .from('rapat')
          .insert({ ...payload, created_by: currentGuruId })
          .select()
          .single();
        if (error) throw error;
        rapatId = data.id;

        await logActivity({
          aksi: 'CREATE',
          modul: AUDIT_MODUL.TODO,
          targetId: data.id,
          deskripsi: `Buat rapat: ${payload.judul}`,
        });
      }

      // Sync peserta
      // 1. Hapus yang sudah tidak ada
      const { error: delErr } = await supabase
        .from('rapat_peserta')
        .delete()
        .eq('rapat_id', rapatId)
        .not(
          'guru_id',
          'in',
          `(${pesertaIds.length > 0 ? pesertaIds.join(',') : '00000000-0000-0000-0000-000000000000'})`
        );
      if (delErr) console.warn('Delete peserta:', delErr);

      // 2. Insert peserta baru
      const existing = await supabase
        .from('rapat_peserta')
        .select('guru_id')
        .eq('rapat_id', rapatId);
      const existingIds = new Set((existing.data ?? []).map((p: any) => p.guru_id));

      const toInsert = pesertaIds
        .filter((id) => !existingIds.has(id))
        .map((id) => {
          let jabatan = 'Peserta';
          if (id === form.pemimpin_rapat_id) jabatan = 'Pemimpin';
          else if (id === form.notulis_id) jabatan = 'Notulis';
          return {
            rapat_id: rapatId,
            guru_id: id,
            jabatan_dalam_rapat: jabatan,
          };
        });

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('rapat_peserta')
          .insert(toInsert);
        if (insErr) console.warn('Insert peserta:', insErr);
      }

      // 3. Update jabatan untuk peserta yang sudah ada
      if (form.pemimpin_rapat_id && existingIds.has(form.pemimpin_rapat_id)) {
        await supabase
          .from('rapat_peserta')
          .update({ jabatan_dalam_rapat: 'Pemimpin' })
          .eq('rapat_id', rapatId)
          .eq('guru_id', form.pemimpin_rapat_id);
      }
      if (form.notulis_id && existingIds.has(form.notulis_id)) {
        await supabase
          .from('rapat_peserta')
          .update({ jabatan_dalam_rapat: 'Notulis' })
          .eq('rapat_id', rapatId)
          .eq('guru_id', form.notulis_id);
      }

      // ✅ NOTIFIKASI KE PESERTA
      try {
        const { data: freshRapat } = await supabase
          .from('v_rapat_lengkap')
          .select('*')
          .eq('id', rapatId)
          .single();

        if (freshRapat) {
          if (isEdit) {
            await notifyRapatUpdated(freshRapat as any, currentGuruId);
          } else {
            await notifyRapatCreated(freshRapat as any, currentGuruId);
          }
        }
      } catch (notifErr) {
        console.warn('[notif] Gagal kirim notif:', notifErr);
      }

      showToast(
        'success',
        isEdit
          ? 'Rapat diperbarui & peserta dinotifikasi'
          : 'Rapat dibuat & peserta dinotifikasi'
      );
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
      title={isEdit ? 'Edit Rapat' : 'Buat Rapat Baru'}
      size="lg"
    >
      <div className="space-y-4 pt-1 max-h-[72vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* INFO NOTIF */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5">
          <Bell size={14} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-indigo-300">
              Notifikasi Otomatis
            </p>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              Setelah disimpan, semua peserta akan menerima notifikasi undangan rapat
              beserta detail jadwal & lokasi.
            </p>
          </div>
        </div>

        {/* JUDUL */}
        <div>
          <label className={LABEL_CLASS}>Judul Rapat *</label>
          <input
            type="text"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            placeholder="Contoh: Rapat Koordinasi Persiapan UAS Semester Ganjil"
            className={INPUT_CLASS}
          />
        </div>

        {/* JENIS + STATUS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Jenis Rapat *</label>
            <select
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value as JenisRapat })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {JENIS_RAPAT_OPTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StatusRapat })}
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {STATUS_RAPAT_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* DESKRIPSI */}
        <div>
          <label className={LABEL_CLASS}>Deskripsi / Agenda</label>
          <textarea
            rows={2}
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            placeholder="Agenda atau tujuan rapat..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* JADWAL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal *</label>
            <input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Waktu Mulai *</label>
            <input
              type="time"
              value={form.waktu_mulai}
              onChange={(e) => setForm({ ...form, waktu_mulai: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Waktu Selesai</label>
            <input
              type="time"
              value={form.waktu_selesai}
              onChange={(e) => setForm({ ...form, waktu_selesai: e.target.value })}
              className={INPUT_CLASS + ' font-mono'}
            />
          </div>
        </div>

        {/* LOKASI & PENYELENGGARA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Lokasi</label>
            <input
              type="text"
              value={form.lokasi}
              onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
              placeholder="Contoh: Ruang Rapat Utama"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Penyelenggara</label>
            <input
              type="text"
              value={form.penyelenggara}
              onChange={(e) => setForm({ ...form, penyelenggara: e.target.value })}
              placeholder="Contoh: Divisi Kurikulum"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* PEMIMPIN & NOTULIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Pemimpin Rapat</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: `${g.nama_lengkap}${g.nip ? ` · ${g.nip}` : ''}`,
              }))}
              value={form.pemimpin_rapat_id}
              onChange={(v) => setForm({ ...form, pemimpin_rapat_id: v })}
              placeholder="Pilih pemimpin..."
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Notulis</label>
            <SearchableSelect
              options={guruList.map((g) => ({
                value: g.id,
                label: `${g.nama_lengkap}${g.nip ? ` · ${g.nip}` : ''}`,
              }))}
              value={form.notulis_id}
              onChange={(v) => setForm({ ...form, notulis_id: v })}
              placeholder="Pilih notulis..."
              searchPlaceholder="Cari guru..."
              emptyMessage="Guru tidak ditemukan"
            />
          </div>
        </div>

        {/* PESERTA PICKER */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users size={12} /> Peserta ({pesertaIds.length})
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              {pesertaIds.length === filteredGuru.length ? 'Batal Semua' : 'Pilih Semua'}
            </button>
          </div>

          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={pesertaSearch}
              onChange={(e) => setPesertaSearch(e.target.value)}
              placeholder="Cari peserta..."
              className={INPUT_CLASS + ' pl-8 text-xs py-2'}
            />
          </div>

          {loadingPeserta ? (
            <div className="text-center py-4">
              <Loader2 size={16} className="animate-spin text-indigo-400 mx-auto" />
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
              {filteredGuru.map((g) => {
                const selected = pesertaIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => togglePeserta(g.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                      selected
                        ? 'bg-indigo-500/15 border border-indigo-500/30'
                        : 'bg-slate-900/60 border border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      selected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-700'
                    }`}>
                      {selected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-200 truncate">{g.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{g.nip ?? '-'}</p>
                    </div>
                    {g.jenis_ptk && (
                      <span className="text-[9px] font-bold text-slate-500 shrink-0">
                        {g.jenis_ptk}
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredGuru.length === 0 && (
                <p className="text-[11px] text-slate-500 text-center py-4">
                  Tidak ada guru cocok
                </p>
              )}
            </div>
          )}
        </div>

        {/* IS_PUBLIC */}
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-indigo-500 cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-300">
                Tampilkan ke Semua Guru
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                Kalau dicentang, rapat akan tampil di jadwal semua guru (read-only).
                Kalau tidak, hanya peserta yang bisa melihat.
              </p>
            </div>
          </label>
        </div>

        {/* CATATAN UMUM */}
        <div>
          <label className={LABEL_CLASS}>Catatan Umum</label>
          <textarea
            rows={2}
            value={form.catatan_umum}
            onChange={(e) => setForm({ ...form, catatan_umum: e.target.value })}
            placeholder="Catatan tambahan untuk peserta..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Simpan & Kirim Notif...</>
            ) : (
              <><Save size={14} /> {isEdit ? 'Simpan Perubahan' : 'Buat & Kirim Undangan'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}