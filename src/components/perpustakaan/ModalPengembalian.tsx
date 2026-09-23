// src/components/perpustakaan/ModalPengembalian.tsx
// Modal pengembalian buku — input kondisi & auto-hitung denda.

import { useState, useEffect } from 'react';
import {
  Loader2, CheckCircle2, AlertTriangle, Book, User, Calendar,
  DollarSign, Info, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import {
  INPUT_CLASS, LABEL_CLASS,
  formatDateShort, formatRupiah,
  calculateHariTerlambat, calculateDenda,
  DENDA_PER_HARI,
} from './shared';
import type { PerpusPeminjamanWithRelations } from '@/types/database';

const MODUL_PERPUS = (AUDIT_MODUL as any)?.PERPUS ?? 'Perpustakaan';

type Props = {
  open: boolean;
  onClose: () => void;
  peminjaman: PerpusPeminjamanWithRelations | null;
  onSaved: () => void;
};

export function ModalPengembalian({ open, onClose, peminjaman, onSaved }: Props) {
  const { guru } = useAuth();
  const [form, setForm] = useState({
    kondisi_saat_kembali: 'Baik',
    catatan: '',
  });
  const [saving, setSaving] = useState(false);

  // ==========================================================================
  // HITUNG DENDA (real-time)
  // ==========================================================================
  const hariTerlambat = peminjaman
    ? calculateHariTerlambat(peminjaman.tanggal_jatuh_tempo)
    : 0;
  const denda = calculateDenda(hariTerlambat);

  // ==========================================================================
  // INIT
  // ==========================================================================
  useEffect(() => {
    if (!open) return;
    setForm({
      kondisi_saat_kembali: 'Baik',
      catatan: '',
    });
  }, [open]);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!peminjaman) return;

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const isRusak = form.kondisi_saat_kembali !== 'Baik';

      // 1. Update peminjaman
      const { error } = await supabase
        .from('perpus_peminjaman')
        .update({
          status: 'Dikembalikan',
          tanggal_kembali: today,
          kondisi_saat_kembali: form.kondisi_saat_kembali,
          denda: denda,
          petugas_kembali_id: guru?.id ?? null,
          catatan: form.catatan.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', peminjaman.id);
      if (error) throw error;

      // 2. Update stok buku (+1 jumlah_tersedia)
      // Kalau rusak berat, kurangi stok total
      const { data: bukuData } = await supabase
        .from('perpus_buku')
        .select('jumlah_tersedia, jumlah_total, kondisi')
        .eq('id', peminjaman.buku_id)
        .single();

      if (bukuData) {
        const updateBuku: any = {
          jumlah_tersedia: bukuData.jumlah_tersedia + 1,
          updated_at: new Date().toISOString(),
        };

        // Update kondisi buku kalau berubah
        if (form.kondisi_saat_kembali !== 'Baik' && bukuData.kondisi === 'Baik') {
          updateBuku.kondisi = form.kondisi_saat_kembali;
        }

        await supabase.from('perpus_buku').update(updateBuku).eq('id', peminjaman.buku_id);
      }

      // 3. Update denda anggota kalau ada
      if (denda > 0) {
        const { data: anggotaData } = await supabase
          .from('perpus_anggota')
          .select('total_denda')
          .eq('id', peminjaman.anggota_id)
          .single();

        if (anggotaData) {
          await supabase
            .from('perpus_anggota')
            .update({
              total_denda: Number(anggotaData.total_denda ?? 0) + denda,
              updated_at: new Date().toISOString(),
            })
            .eq('id', peminjaman.anggota_id);
        }
      }

      // 4. Audit
      await logActivity({
        aksi: 'UPDATE',
        modul: MODUL_PERPUS,
        targetId: peminjaman.id,
        deskripsi: `Pengembalian buku: ${peminjaman.buku?.judul} — ${peminjaman.anggota?.nama_lengkap}${denda > 0 ? ` (denda ${formatRupiah(denda)})` : ''}`,
      });

      showToast('success', denda > 0
        ? `Buku dikembalikan. Denda: ${formatRupiah(denda)}`
        : 'Buku berhasil dikembalikan');
      onSaved();
      onClose();
    } catch (err: any) {
      showToast('error', 'Gagal: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  if (!peminjaman) return null;

  return (
    <Modal open={open} onClose={onClose} title="Pengembalian Buku" size="md">
      <div className="space-y-5 pt-1">

        {/* INFO BUKU & ANGGOTA */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
              {peminjaman.buku?.cover_url ? (
                <img src={peminjaman.buku.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Book size={20} className="text-slate-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-100 text-sm truncate">
                {peminjaman.buku?.judul ?? '-'}
              </p>
              <p className="text-[10px] font-mono text-indigo-400 mt-0.5">
                {peminjaman.buku?.kode_buku ?? '-'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {peminjaman.buku?.pengarang ?? '-'}
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Peminjam</p>
              <p className="text-slate-200 font-semibold truncate">
                {peminjaman.anggota?.nama_lengkap ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Tgl Pinjam</p>
              <p className="text-slate-200 font-semibold">
                {formatDateShort(peminjaman.tanggal_pinjam)}
              </p>
            </div>
          </div>
        </div>

        {/* INFO JATUH TEMPO */}
        <div className={`border rounded-2xl p-3.5 flex items-start gap-2.5 ${
          hariTerlambat > 0
            ? 'bg-rose-500/5 border-rose-500/20'
            : 'bg-emerald-500/5 border-emerald-500/20'
        }`}>
          {hariTerlambat > 0
            ? <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            : <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
          <div className={`text-[11px] leading-relaxed ${
            hariTerlambat > 0 ? 'text-rose-300/90' : 'text-emerald-300/90'
          }`}>
            <p className="font-bold mb-0.5">
              {hariTerlambat > 0
                ? `Terlambat ${hariTerlambat} hari`
                : 'Tepat Waktu'}
            </p>
            <p className={hariTerlambat > 0 ? 'text-rose-400/70' : 'text-emerald-400/70'}>
              Jatuh tempo: {formatDateShort(peminjaman.tanggal_jatuh_tempo)}
              {hariTerlambat > 0 && ` · Denda: ${formatRupiah(denda)} (Rp ${DENDA_PER_HARI.toLocaleString('id-ID')}/hari)`}
            </p>
          </div>
        </div>

        {/* KONDISI KEMBALI */}
        <div>
          <label className={LABEL_CLASS}>Kondisi Buku Saat Dikembalikan *</label>
          <select
            value={form.kondisi_saat_kembali}
            onChange={(e) => setForm({ ...form, kondisi_saat_kembali: e.target.value })}
            className={INPUT_CLASS + ' cursor-pointer'}
          >
            <option value="Baik">Baik — buku kembali normal</option>
            <option value="Rusak Ringan">Rusak Ringan — perlu perhatian</option>
            <option value="Rusak Berat">Rusak Berat — perlu perbaikan</option>
          </select>
          {form.kondisi_saat_kembali !== 'Baik' && (
            <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
              <Info size={10} />
              Kondisi buku akan diupdate menjadi "{form.kondisi_saat_kembali}"
            </p>
          )}
        </div>

        {/* CATATAN */}
        <div>
          <label className={LABEL_CLASS}>Catatan Pengembalian</label>
          <textarea
            rows={2}
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Catatan tentang kondisi atau hal khusus..."
            className={INPUT_CLASS + ' resize-none'}
          />
        </div>

        {/* SUMMARY DENDA */}
        {denda > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-400">Total Denda</p>
                  <p className="text-lg font-extrabold text-amber-300">{formatRupiah(denda)}</p>
                </div>
              </div>
              <p className="text-[10px] text-amber-400/70 text-right max-w-[140px] leading-tight">
                Akan ditambahkan ke total denda anggota
              </p>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Konfirmasi Pengembalian
          </button>
        </div>
      </div>
    </Modal>
  );
}