// src/components/ModalTambahKegiatan.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Calendar,
  FileText,
  UserCheck,
  Users,
  PlusCircle,
  Save,
  Activity,
  CalendarRange,
  CalendarDays,
  Layers,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { showToast } from '@/components/Toast';
import { broadcastToAllGurus } from '@/lib/notifications/notification';
import { formatDateWibLong, getTodayDateWib } from '@/utils/date';

export interface RencanaKegiatan {
  id?: string;
  nama_kegiatan: string;
  tanggal_mulai: string;
  tanggal_selesai?: string | null;
  penanggung_jawab: string;
  peserta: string;
  deskripsi?: string | null;
  status?: string;
}

interface ModalKegiatanProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  kegiatanEdit?: RencanaKegiatan | null;
}

type CreateMode = 'single' | 'per_day';

const MAX_BATCH = 90; // batas aman untuk per_day mode

// =============================================================================
// HELPERS
// =============================================================================
function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/** 0=Minggu, 1=Senin, ..., 6=Sabtu (UTC, sama dgn getDay()) */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysBetween(startStr: string, endStr: string): number {
  const [ay, am, ad] = startStr.split('-').map(Number);
  const [by, bm, bd] = endStr.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

const initialFormData: RencanaKegiatan = {
  nama_kegiatan: '',
  tanggal_mulai: getTodayDateWib(),
  tanggal_selesai: '',
  penanggung_jawab: '',
  peserta: '',
  deskripsi: '',
  status: 'Akan Datang',
};

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalTambahKegiatan({
  open,
  onClose,
  onSuccess,
  kegiatanEdit,
}: ModalKegiatanProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RencanaKegiatan>(initialFormData);

  // Mode (hanya untuk create, bukan edit)
  const [mode, setMode] = useState<CreateMode>('single');
  // 0=Minggu, 6=Sabtu. Array memudahkan extend (mis. skip Jumat)
  const [skipDays, setSkipDays] = useState<number[]>([]);
  const [appendHariNumber, setAppendHariNumber] = useState(false);

  const isEdit = Boolean(kegiatanEdit?.id);
  const isPerDay = !isEdit && mode === 'per_day';

  // Reset form saat modal dibuka
  useEffect(() => {
    if (!open) return;

    if (kegiatanEdit) {
      setFormData({
        nama_kegiatan: kegiatanEdit.nama_kegiatan || '',
        tanggal_mulai: kegiatanEdit.tanggal_mulai || getTodayDateWib(),
        tanggal_selesai: kegiatanEdit.tanggal_selesai || '',
        penanggung_jawab: kegiatanEdit.penanggung_jawab || '',
        peserta: kegiatanEdit.peserta || '',
        deskripsi: kegiatanEdit.deskripsi || '',
        status: kegiatanEdit.status || 'Akan Datang',
      });
      setMode('single'); // edit selalu single
    } else {
      setFormData(initialFormData);
      setMode('single');
    }
    setSkipDays([]);
    setAppendHariNumber(false);
  }, [open, kegiatanEdit]);

  // ===========================================================================
  // PREVIEW PER_DAY
  // ===========================================================================
  const previewDates = useMemo(() => {
    if (!isPerDay) return [];
    if (!formData.tanggal_mulai || !formData.tanggal_selesai) return [];
    if (formData.tanggal_selesai < formData.tanggal_mulai) return [];

  const all = generateDateRange(formData.tanggal_mulai, formData.tanggal_selesai);
    if (skipDays.length === 0) return all;
    return all.filter((d) => !skipDays.includes(getDayOfWeek(d)));
  }, [isPerDay, formData.tanggal_mulai, formData.tanggal_selesai, skipDays]);

  /** Toggle 1 hari pada skipDays */
  const toggleSkipDay = (day: number) => {
    setSkipDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const totalRangeDays = useMemo(() => {
    if (!formData.tanggal_mulai || !formData.tanggal_selesai) return 0;
    if (formData.tanggal_selesai < formData.tanggal_mulai) return 0;
    return daysBetween(formData.tanggal_mulai, formData.tanggal_selesai);
  }, [formData.tanggal_mulai, formData.tanggal_selesai]);

  // ===========================================================================
  // SUBMIT
  // ===========================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ---------- Validasi dasar ----------
    if (!formData.nama_kegiatan.trim()) {
      showToast('error', 'Nama kegiatan wajib diisi');
      return;
    }
    if (!formData.penanggung_jawab.trim() || !formData.peserta.trim()) {
      showToast('error', 'Penanggung jawab & peserta wajib diisi');
      return;
    }
    if (!formData.tanggal_mulai) {
      showToast('error', 'Tanggal mulai wajib diisi');
      return;
    }

    // ---------- Validasi per_day ----------
    if (isPerDay) {
      if (!formData.tanggal_selesai) {
        showToast('error', 'Tanggal selesai wajib diisi untuk mode Per Hari');
        return;
      }
      if (formData.tanggal_selesai < formData.tanggal_mulai) {
        showToast('error', 'Tanggal selesai tidak boleh sebelum tanggal mulai');
        return;
      }
      if (previewDates.length === 0) {
        showToast('error', 'Tidak ada tanggal valid untuk dibuat');
        return;
      }
      if (previewDates.length > MAX_BATCH) {
        showToast('error', `Maksimal ${MAX_BATCH} event per input. Perpendek rentang atau kurangi skip weekend.`);
        return;
      }
    }

    // ---------- Validasi single range ----------
    if (!isPerDay && formData.tanggal_selesai && formData.tanggal_selesai < formData.tanggal_mulai) {
      showToast('error', 'Tanggal selesai tidak boleh sebelum tanggal mulai');
      return;
    }

    setLoading(true);

    try {
      // =======================================================================
      // EDIT — selalu single row
      // =======================================================================
      if (isEdit && kegiatanEdit?.id) {
        const payload = {
          nama_kegiatan: formData.nama_kegiatan.trim(),
          tanggal_mulai: formData.tanggal_mulai,
          tanggal_selesai: formData.tanggal_selesai || null,
          penanggung_jawab: formData.penanggung_jawab.trim(),
          peserta: formData.peserta.trim(),
          deskripsi: formData.deskripsi?.trim() || null,
          status: formData.status,
        };

        const { error } = await supabase
          .from('rencana_kegiatan')
          .update(payload)
          .eq('id', kegiatanEdit.id);

        if (error) throw error;
        showToast('success', 'Rencana kegiatan berhasil diperbarui');
      }
      // =======================================================================
      // CREATE — per_day mode (N rows)
      // =======================================================================
      else if (isPerDay) {
        const baseNama = formData.nama_kegiatan.trim();

        const payloads = previewDates.map((tgl, idx) => ({
          nama_kegiatan: appendHariNumber
            ? `${baseNama} - Hari ${idx + 1}`
            : baseNama,
          tanggal_mulai: tgl,
          tanggal_selesai: null,
          penanggung_jawab: formData.penanggung_jawab.trim(),
          peserta: formData.peserta.trim(),
          deskripsi: formData.deskripsi?.trim() || null,
          status: formData.status,
        }));

        const { error } = await supabase
          .from('rencana_kegiatan')
          .insert(payloads);

        if (error) throw error;

        // Broadcast (non-fatal)
        try {
          await broadcastToAllGurus({
            judul: '📌 Agenda Kegiatan Baru',
            pesan: `${previewDates.length} agenda "${baseNama}" ditambahkan (${formData.tanggal_mulai} s.d. ${formData.tanggal_selesai}).`,
            tipe: 'kegiatan',
            tautan: '/kegiatan',
          });
        } catch (notifErr) {
          console.error('Gagal broadcast notifikasi kegiatan:', notifErr);
        }

        showToast('success', `${previewDates.length} agenda berhasil ditambahkan`);
      }
      // =======================================================================
      // CREATE — single mode (1 row)
      // =======================================================================
      else {
        const payload = {
          nama_kegiatan: formData.nama_kegiatan.trim(),
          tanggal_mulai: formData.tanggal_mulai,
          tanggal_selesai: formData.tanggal_selesai || null,
          penanggung_jawab: formData.penanggung_jawab.trim(),
          peserta: formData.peserta.trim(),
          deskripsi: formData.deskripsi?.trim() || null,
          status: formData.status,
        };

        const { error } = await supabase
          .from('rencana_kegiatan')
          .insert([payload]);

        if (error) throw error;

        try {
          await broadcastToAllGurus({
            judul: '📌 Agenda Kegiatan Baru',
            pesan: `Agenda "${payload.nama_kegiatan}" telah ditambahkan untuk tanggal ${payload.tanggal_mulai}.`,
            tipe: 'kegiatan',
            tautan: '/kegiatan',
          });
        } catch (notifErr) {
          console.error('Gagal broadcast notifikasi kegiatan:', notifErr);
        }

        showToast('success', 'Rencana kegiatan berhasil ditambahkan');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Gagal menyimpan kegiatan:', err.message);
      showToast('error', 'Gagal menyimpan data kegiatan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================
  const modalTitle = isEdit
    ? 'Edit Rencana Kegiatan Sekolah'
    : isPerDay
    ? 'Tambah Kegiatan Per Hari'
    : 'Tambah Rencana Kegiatan Sekolah';

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* MODE TOGGLE — hanya untuk create */}
        {!isEdit && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'single'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange size={13} />
              Satu Event
            </button>
            <button
              type="button"
              onClick={() => setMode('per_day')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'per_day'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={13} />
              Per Hari
            </button>
          </div>
        )}

        {/* Info banner per_day */}
        {isPerDay && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>
              Setiap tanggal akan dibuat sebagai <b>event terpisah</b>, sehingga bisa
              di-edit atau dihapus <b>per tanggal</b> di Kalender Akademik.
            </span>
          </div>
        )}

        {/* Nama Kegiatan */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Nama Kegiatan <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={
              isPerDay
                ? 'Contoh: Ujian Harian Semester Ganjil'
                : 'Contoh: Penilaian Tengah Semester (PTS)'
            }
            value={formData.nama_kegiatan}
            onChange={(e) => setFormData({ ...formData, nama_kegiatan: e.target.value })}
            className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        {/* PJ + Peserta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <UserCheck size={13} className="text-indigo-400" /> Penanggung Jawab{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Tim Kurikulum / OSIS"
              value={formData.penanggung_jawab}
              onChange={(e) => setFormData({ ...formData, penanggung_jawab: e.target.value })}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Users size={13} className="text-indigo-400" /> Peserta / Sasaran{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Siswa Kelas X & XI"
              value={formData.peserta}
              onChange={(e) => setFormData({ ...formData, peserta: e.target.value })}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* TANGGAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-indigo-400" />
              {isPerDay ? 'Tanggal Mulai' : 'Tanggal Mulai'}{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.tanggal_mulai}
              onChange={(e) => setFormData({ ...formData, tanggal_mulai: e.target.value })}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-indigo-400" />
              Tanggal Selesai
              {isPerDay ? (
                <span className="text-rose-400">*</span>
              ) : (
                <span className="text-slate-500 text-[10px] font-normal">(opsional)</span>
              )}
            </label>
            <input
              type="date"
              required={isPerDay}
              min={formData.tanggal_mulai || undefined}
              value={formData.tanggal_selesai ?? ''}
              onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value })}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
            />
          </div>
        </div>

        {/* OPSI PER_HARI */}
        {isPerDay && (
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
              <Layers size={12} className="text-emerald-400" /> Opsi Batch
            </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Lewati hari:
            </span>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDays.includes(6)}
                onChange={() => toggleSkipDay(6)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-300">Sabtu</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDays.includes(0)}
                onChange={() => toggleSkipDay(0)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-300">Minggu</span>
            </label>
          </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={appendHariNumber}
                onChange={(e) => setAppendHariNumber(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-300">
                Tambahkan "Hari 1", "Hari 2"... ke judul
              </span>
            </label>
          </div>
        )}

        {/* PREVIEW PER_HARI */}
        {isPerDay && totalRangeDays > 0 && (
          <div
            className={`p-3 rounded-xl border ${
              previewDates.length === 0
                ? 'bg-rose-500/10 border-rose-500/30'
                : previewDates.length > MAX_BATCH
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-emerald-500/10 border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span
                className={`font-bold flex items-center gap-1 ${
                  previewDates.length === 0
                    ? 'text-rose-300'
                    : previewDates.length > MAX_BATCH
                    ? 'text-amber-300'
                    : 'text-emerald-300'
                }`}
              >
                {previewDates.length === 0 ? (
                  <>
                    <AlertTriangle size={12} /> Tidak ada tanggal valid
                  </>
                ) : (
                  <>
                    <CalendarDays size={12} /> Akan membuat {previewDates.length} event
                  </>
                )}
              </span>
              {skipDays.length > 0 && totalRangeDays > previewDates.length && (
                <span className="text-[10px] text-slate-400">
                  ({totalRangeDays - previewDates.length} hari dilewati)
                </span>
              )}

            {previewDates.length > 0 && (
              <p className="text-[10px] text-slate-400">
                {formatDateWibLong(previewDates[0])}
                {previewDates.length > 1 && (
                  <> s.d. {formatDateWibLong(previewDates[previewDates.length - 1])}</>
                )}
              </p>
            )}

            {previewDates.length > 5 && (
              <p className="text-[10px] text-slate-500 mt-1 italic">
                Tanggal: {previewDates.slice(0, 5).map((d) => d.slice(5)).join(', ')}
                {previewDates.length > 5 && ` … +${previewDates.length - 5} lagi`}
              </p>
            )}

            {previewDates.length > MAX_BATCH && (
              <p className="text-[10px] text-amber-400 mt-1 font-bold">
                ⚠ Maksimal {MAX_BATCH} event per input. Perpendek rentang.
              </p>
            )}
          </div>
        )}

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
            <Activity size={13} className="text-indigo-400" /> Status Kegiatan
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
          >
            <option value="Akan Datang">Akan Datang</option>
            <option value="Berlangsung">Berlangsung</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>

        {/* Deskripsi */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
            <FileText size={13} className="text-indigo-400" /> Detail / Catatan Ringkas
          </label>
          <textarea
            rows={3}
            placeholder="Tambahkan catatan atau rincian agenda kegiatan ini..."
            value={formData.deskripsi ?? ''}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            className="w-full text-xs font-medium p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isPerDay ? `Menyimpan ${previewDates.length} event...` : 'Menyimpan...'}
              </>
            ) : isEdit ? (
              <>
                <Save size={14} /> Simpan Perubahan
              </>
            ) : isPerDay ? (
              <>
                <Layers size={14} /> Buat {previewDates.length} Event
              </>
            ) : (
              <>
                <PlusCircle size={14} /> Simpan Kegiatan
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}