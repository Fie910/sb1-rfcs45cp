// src/components/kalender/ModalRecurringEvent.tsx
// Modal untuk membuat event recurring (berulang).

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2, Save, Calendar, Repeat, Info, CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  generateRecurrenceDates,
  type RecurrencePattern,
} from '@/lib/kalenderUtils';

// =============================================================================
// TYPES
// =============================================================================
type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const EMPTY_FORM = {
  nama_kegiatan: '',
  deskripsi: '',
  penanggung_jawab: '',
  peserta: '',
  tanggal_mulai: new Date().toISOString().slice(0, 10),
  recurrence_pattern: 'Pekanan' as RecurrencePattern,
  recurrence_until: (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  })(),
  recurrence_days: [1] as number[], // 1 = Senin
};

const HARI_LABELS = [
  { value: 0, label: 'Ahd' },
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
];

// =============================================================================
// COMPONENT
// =============================================================================
export function ModalRecurringEvent({ open, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Reset saat modal open
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM });
  }, [open]);

  // ===========================================================================
  // PREVIEW
  // ===========================================================================
  const preview = useMemo(() => {
    try {
      const dates = generateRecurrenceDates({
        nama_kegiatan: form.nama_kegiatan,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: null,
        recurrence_pattern: form.recurrence_pattern,
        recurrence_until: form.recurrence_until,
        recurrence_days: form.recurrence_days,
      });
      return {
        dates,
        count: dates.length,
        error: null,
      };
    } catch (err: any) {
      return { dates: [], count: 0, error: err.message };
    }
  }, [form]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================
  const toggleDay = (day: number) => {
    setForm((f) => {
      const days = f.recurrence_days.includes(day)
        ? f.recurrence_days.filter((d) => d !== day)
        : [...f.recurrence_days, day].sort();
      return { ...f, recurrence_days: days };
    });
  };

  const handleSave = async () => {
    if (!form.nama_kegiatan.trim()) {
      showToast('error', 'Nama kegiatan wajib diisi');
      return;
    }
    if (!form.penanggung_jawab.trim() || !form.peserta.trim()) {
      showToast('error', 'Penanggung jawab & peserta wajib diisi');
      return;
    }
    if (preview.count === 0) {
      showToast('error', 'Tidak ada tanggal yang di-generate. Cek tanggal mulai/selesai.');
      return;
    }
    if (form.recurrence_pattern === 'Mingguan' && form.recurrence_days.length === 0) {
      showToast('error', 'Pilih minimal 1 hari untuk recurring pekanan');
      return;
    }

    setSaving(true);
    try {
      // 1. Insert parent event (is_recurring = true)
      const { data: parentData, error: parentErr } = await supabase
        .from('rencana_kegiatan')
        .insert({
          nama_kegiatan: form.nama_kegiatan.trim(),
          tanggal_mulai: form.tanggal_mulai,
          tanggal_selesai: null,
          penanggung_jawab: form.penanggung_jawab.trim(),
          peserta: form.peserta.trim(),
          deskripsi: form.deskripsi.trim() || null,
          status: 'Akan Datang',
          is_recurring: true,
          recurrence_pattern: form.recurrence_pattern,
          recurrence_until: form.recurrence_until,
          recurrence_days: form.recurrence_pattern === 'Mingguan' ? form.recurrence_days : null,
        })
        .select('id')
        .single();

      if (parentErr) throw parentErr;
      const parentId = parentData.id;

      // 2. Skip tanggal_mulai (sudah jadi parent) → generate untuk sisanya
      const remainingDates = preview.dates.filter((d) => d !== form.tanggal_mulai);

      if (remainingDates.length > 0) {
        const occurrences = remainingDates.map((tgl) => ({
          nama_kegiatan: form.nama_kegiatan.trim(),
          tanggal_mulai: tgl,
          tanggal_selesai: null,
          penanggung_jawab: form.penanggung_jawab.trim(),
          peserta: form.peserta.trim(),
          deskripsi: form.deskripsi.trim() || null,
          status: 'Akan Datang',
          is_recurring: false,
          parent_id: parentId,
          source_event_id: parentId,
        }));

        const { error: occErr } = await supabase
          .from('rencana_kegiatan')
          .insert(occurrences);

        if (occErr) throw occErr;
      }

      // 3. Log
      await logActivity({
        aksi: 'CREATE',
        modul: AUDIT_MODUL.KEGIATAN ?? 'Kalender',
        targetId: parentId,
        deskripsi: `Buat recurring event "${form.nama_kegiatan}" (${preview.count} occurrences, ${form.recurrence_pattern})`,
      });

      showToast('success', `Berhasil membuat ${preview.count} event recurring`);
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
    <Modal open={open} onClose={onClose} title="Buat Event Recurring" size="lg">
      <div className="space-y-4">
        {/* Info */}
        <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            Event akan otomatis di-generate ke setiap tanggal sesuai pattern.
            Cocok untuk kegiatan rutin (rapat pekanan, upacara, dll).
          </span>
        </div>

        {/* Nama Kegiatan */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Nama Kegiatan *
          </label>
          <input
            value={form.nama_kegiatan}
            onChange={(e) => setForm({ ...form, nama_kegiatan: e.target.value })}
            placeholder="Contoh: Rapat Koordinasi Pekanan"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* PJ + Peserta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Penanggung Jawab *
            </label>
            <input
              value={form.penanggung_jawab}
              onChange={(e) => setForm({ ...form, penanggung_jawab: e.target.value })}
              placeholder="Nama PJ"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Peserta *
            </label>
            <input
              value={form.peserta}
              onChange={(e) => setForm({ ...form, peserta: e.target.value })}
              placeholder="Contoh: Semua Guru"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Deskripsi */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Deskripsi
          </label>
          <textarea
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            placeholder="Deskripsi opsional..."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
          />
        </div>

        {/* Recurring Config */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Repeat size={13} /> Pattern Recurring
          </div>

          {/* Pattern Selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['Harian', 'Pekanan', 'Bulanan'] as RecurrencePattern[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm({ ...form, recurrence_pattern: p })}
                className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  form.recurrence_pattern === p
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Hari Selector (khusus Pekanan) */}
          {form.recurrence_pattern === 'Mingguan' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Hari dalam sepekan
              </label>
              <div className="flex flex-wrap gap-1.5">
                {HARI_LABELS.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => toggleDay(h.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      form.recurrence_days.includes(h.value)
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Mulai Tanggal
              </label>
              <input
                type="date"
                value={form.tanggal_mulai}
                onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={form.recurrence_until}
                onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-bold">
              <CheckCircle2 size={12} className="inline mr-1" />
              {preview.count} event akan dibuat
            </span>
            {preview.count > 0 && (
              <span className="text-emerald-300 text-[10px]">
                {preview.dates[0]} → {preview.dates[preview.dates.length - 1]}
              </span>
            )}
          </div>
          {preview.count > 0 && preview.count <= 10 && (
            <div className="text-[10px] text-emerald-300/80">
              Tanggal: {preview.dates.join(', ')}
            </div>
          )}
          {preview.count > 10 && (
            <div className="text-[10px] text-emerald-300/80">
              Tanggal pertama: {preview.dates.slice(0, 5).join(', ')}... +{preview.count - 5} lagi
            </div>
          )}
          {preview.count > 365 && (
            <p className="text-[10px] text-rose-400">
              ⚠ Maksimum 365 event. Perpendek periode.
            </p>
          )}
        </div>

        {/* Actions */}
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
            disabled={saving || preview.count === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Buat {preview.count} Event
          </button>
        </div>
      </div>
    </Modal>
  );
}