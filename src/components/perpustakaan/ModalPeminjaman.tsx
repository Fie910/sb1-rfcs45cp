// src/components/perpustakaan/ModalPeminjaman.tsx
import { useState, useEffect } from 'react';
import {
  Loader2, Save, User, Book, Calendar, Info, AlertCircle,
  BookOpen, Camera, ListChecks, X, CheckCircle2,
  GraduationCap, Briefcase, UserCircle, QrCode,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import { QRScanner } from './QRScanner';
import {
  INPUT_CLASS, LABEL_CLASS,
  calculateDueDate, formatDateLong, DURASI_PINJAM_HARI,
} from './shared';
import type {
  PerpusAnggotaWithRelations, PerpusBukuWithRelations,
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

type ScanTarget = 'anggota' | 'buku';

export function ModalPeminjaman({ open, onClose, anggotaList, bukuList, onSaved }: Props) {
  const { guru } = useAuth();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeSlot, setActiveSlot] = useState<ScanTarget>('anggota');

  // Buku tersedia (stok > 0 dan aktif)
  const bukuTersedia = bukuList.filter((b) => b.jumlah_tersedia > 0 && b.is_aktif);
  // Anggota aktif
  const anggotaAktif = anggotaList.filter((a) => a.status === 'Aktif');

  const selectedAnggota = anggotaList.find((a) => a.id === form.anggota_id);
  const selectedBuku = bukuList.find((b) => b.id === form.buku_id);

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
    setMode('scan');
    setActiveSlot('anggota');
  }, [open]);

  // Auto-recalc jatuh tempo
  useEffect(() => {
    if (form.tanggal_pinjam) {
      setForm((f) => ({
        ...f,
        tanggal_jatuh_tempo: calculateDueDate(f.tanggal_pinjam, DURASI_PINJAM_HARI),
      }));
    }
  }, [form.tanggal_pinjam]);

  // ==========================================================================
  // SCAN HANDLER — auto-detect tipe QR
  // ==========================================================================
  const handleScan = async (text: string) => {
    // Prevent re-scan kalau sudah keisi (kecuali scan ulang jenis yang sama)
    // Prioritas: cek apakah target slot yang aktif
    const target = activeSlot;

    if (target === 'anggota') {
      const anggota = anggotaList.find((a) => a.kode_anggota === text);
      if (!anggota) {
        showToast('error', `Anggota dengan kode "${text}" tidak ditemukan`);
        return;
      }
      if (anggota.status !== 'Aktif') {
        showToast('error', `Anggota "${anggota.nama_lengkap}" tidak aktif`);
        return;
      }
      setForm((f) => ({ ...f, anggota_id: anggota.id }));
      showToast('success', `✓ Anggota: ${anggota.nama_lengkap}`);
      // Auto-pindah ke slot buku
      if (!form.buku_id) setActiveSlot('buku');
      return;
    }

    // target === 'buku'
    // Cari by qr_token atau kode_buku
    const buku =
      bukuList.find((b) => b.qr_token === text) ??
      bukuList.find((b) => b.kode_buku === text);

    if (!buku) {
      showToast('error', `Buku dengan QR "${text}" tidak ditemukan`);
      return;
    }
    if (buku.jumlah_tersedia <= 0) {
      showToast('error', `Stok buku "${buku.judul}" habis`);
      return;
    }
    setForm((f) => ({ ...f, buku_id: buku.id }));
    showToast('success', `✓ Buku: ${buku.judul}`);
    // Auto-pindah ke slot anggota kalau belum diisi
    if (!form.anggota_id) setActiveSlot('anggota');
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    if (!form.anggota_id) { showToast('error', 'Pilih anggota'); return; }
    if (!form.buku_id) { showToast('error', 'Pilih buku'); return; }
    if (selectedAnggota?.status !== 'Aktif') {
      showToast('error', 'Anggota tidak aktif');
      return;
    }
    if (selectedBuku && selectedBuku.jumlah_tersedia <= 0) {
      showToast('error', 'Stok buku habis');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.from('perpus_peminjaman')
        .insert({
          anggota_id: form.anggota_id,
          buku_id: form.buku_id,
          tanggal_pinjam: form.tanggal_pinjam,
          tanggal_jatuh_tempo: form.tanggal_jatuh_tempo,
          kondisi_saat_pinjam: form.kondisi_saat_pinjam,
          catatan: form.catatan.trim() || null,
          petugas_pinjam_id: guru?.id ?? null,
          status: 'Dipinjam',
        }).select().single();
      if (error) throw error;

      await supabase.from('perpus_buku').update({
        jumlah_tersedia: (selectedBuku?.jumlah_tersedia ?? 1) - 1,
        updated_at: new Date().toISOString(),
      }).eq('id', form.buku_id);

      await logActivity({
        aksi: 'CREATE', modul: MODUL_PERPUS, targetId: data?.id,
        deskripsi: `Peminjaman: ${selectedBuku?.judul} → ${selectedAnggota?.nama_lengkap}`,
      });

      showToast('success', 'Peminjaman berhasil dicatat');
      onSaved(); onClose();
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan: ' + (err.message || 'Error'));
    } finally { setSaving(false); }
  };

  const getTipeIcon = (tipe: string) => {
    switch (tipe) {
      case 'Siswa': return GraduationCap;
      case 'Guru': return User;
      case 'Tendik': return Briefcase;
      default: return UserCircle;
    }
  };

  const canSubmit = Boolean(form.anggota_id && form.buku_id);

  return (
    <Modal open={open} onClose={onClose} title="Peminjaman Buku Baru" size="lg">
      <div className="space-y-5 pt-1 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">

        {/* MODE TOGGLE */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-1 flex gap-1">
          <button type="button" onClick={() => setMode('scan')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              mode === 'scan'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            <Camera size={14} /> Scan QR
          </button>
          <button type="button" onClick={() => setMode('manual')}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              mode === 'manual'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            <ListChecks size={14} /> Input Manual
          </button>
        </div>

        {/* ==================== MODE SCAN ==================== */}
        {mode === 'scan' && (
          <div className="space-y-4">
            {/* Slot Selector */}
            <div className="grid grid-cols-2 gap-2">
              <SlotCard
                type="anggota"
                active={activeSlot === 'anggota'}
                filled={Boolean(form.anggota_id)}
                onClick={() => setActiveSlot('anggota')}
                data={
                  selectedAnggota
                    ? {
                        primary: selectedAnggota.nama_lengkap,
                        secondary: `${selectedAnggota.kode_anggota} · ${selectedAnggota.tipe}`,
                        icon: getTipeIcon(selectedAnggota.tipe),
                      }
                    : null
                }
                placeholder="Scan kartu anggota"
              />
              <SlotCard
                type="buku"
                active={activeSlot === 'buku'}
                filled={Boolean(form.buku_id)}
                onClick={() => setActiveSlot('buku')}
                data={
                  selectedBuku
                    ? {
                        primary: selectedBuku.judul,
                        secondary: `${selectedBuku.kode_buku ?? '-'} · Stok: ${selectedBuku.jumlah_tersedia}`,
                        icon: Book,
                      }
                    : null
                }
                placeholder="Scan QR buku"
              />
            </div>

            {/* QR Scanner */}
            <QRScanner
              onScan={handleScan}
              hint={
                activeSlot === 'anggota'
                  ? 'Scan kartu anggota perpustakaan...'
                  : 'Scan QR code pada buku...'
              }
            />

            {/* Clear buttons */}
            {selectedAnggota && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 size={12} /> Anggota terisi
                </span>
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, anggota_id: '' }))}
                  className="text-[10px] text-slate-400 hover:text-rose-400 transition cursor-pointer">
                  Hapus
                </button>
              </div>
            )}
            {selectedBuku && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 size={12} /> Buku terisi
                </span>
                <button type="button"
                  onClick={() => setForm((f) => ({ ...f, buku_id: '' }))}
                  className="text-[10px] text-slate-400 hover:text-rose-400 transition cursor-pointer">
                  Hapus
                </button>
              </div>
            )}

            {/* Info */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 flex items-start gap-2.5">
              <Info size={15} className="text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-indigo-300/90 leading-relaxed">
                <p className="font-bold mb-0.5">Cara Scan</p>
                <p className="text-indigo-400/70">
                  Klik slot yang ingin diisi (Anggota / Buku), lalu arahkan kamera ke QR code.
                  Sistem akan otomatis mengenali tipe QR.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODE MANUAL ==================== */}
        {mode === 'manual' && (
          <>
            <div>
              <label className={LABEL_CLASS}>Anggota *</label>
              <SearchableSelect
                options={anggotaAktif.map((a) => ({
                  value: a.id,
                  label: a.nama_lengkap,
                  hint: `${a.tipe}${a.siswa?.kelas?.nama_kelas ? ` · Kelas ${a.siswa.kelas.nama_kelas}` : ''} · ${a.kode_anggota}`,
                }))}
                value={form.anggota_id}
                onChange={(v) => setForm({ ...form, anggota_id: v })}
                placeholder="Pilih anggota..."
                searchPlaceholder="Cari nama / kode anggota..."
                emptyMessage="Anggota tidak ditemukan"
              />
            </div>

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
            </div>
          </>
        )}

        {/* ==================== SHARED FORM ==================== */}
        {(selectedAnggota || selectedBuku) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            {selectedAnggota && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[9px] font-bold uppercase text-indigo-400 mb-0.5">Anggota</p>
                <p className="text-slate-200 font-semibold truncate">{selectedAnggota.nama_lengkap}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-0.5">{selectedAnggota.kode_anggota}</p>
              </div>
            )}
            {selectedBuku && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[9px] font-bold uppercase text-indigo-400 mb-0.5">Buku</p>
                <p className="text-slate-200 font-semibold truncate">{selectedBuku.judul}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                  {selectedBuku.kode_buku ?? '-'} · Stok: {selectedBuku.jumlah_tersedia}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Tanggal Pinjam</label>
            <input type="date" value={form.tanggal_pinjam}
              onChange={(e) => setForm({ ...form, tanggal_pinjam: e.target.value })}
              className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Jatuh Tempo</label>
            <input type="date" value={form.tanggal_jatuh_tempo}
              onChange={(e) => setForm({ ...form, tanggal_jatuh_tempo: e.target.value })}
              className={INPUT_CLASS} />
          </div>
        </div>

        {form.tanggal_pinjam && form.tanggal_jatuh_tempo && (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-3 flex items-start gap-2.5">
            <Calendar size={14} className="text-indigo-400 shrink-0 mt-0.5" />
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

        <div>
          <label className={LABEL_CLASS}>Kondisi Buku Saat Dipinjam</label>
          <select value={form.kondisi_saat_pinjam}
            onChange={(e) => setForm({ ...form, kondisi_saat_pinjam: e.target.value })}
            className={INPUT_CLASS + ' cursor-pointer'}>
            <option value="Baik">Baik — buku dalam kondisi prima</option>
            <option value="Rusak Ringan">Rusak Ringan — ada lecet/lipatan</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>Catatan</label>
          <textarea rows={2} value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            placeholder="Opsional"
            className={INPUT_CLASS + ' resize-none'} />
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-2.5">
          <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-300/90 leading-relaxed">
            <p className="font-bold mb-0.5">Kebijakan Denda</p>
            <p className="text-amber-400/70">
              Denda keterlambatan Rp 500/hari. Buku hilang wajib diganti.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-bold text-xs transition cursor-pointer">
            Batal
          </button>
          <button type="button" onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Catat Peminjaman
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// SLOT CARD
// =============================================================================
function SlotCard({
  type, active, filled, onClick, data, placeholder,
}: {
  type: ScanTarget;
  active: boolean;
  filled: boolean;
  onClick: () => void;
  data: { primary: string; secondary: string; icon: any } | null;
  placeholder: string;
}) {
  const Icon = data?.icon ?? (type === 'anggota' ? User : Book);
  return (
    <button type="button" onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative ${
        active
          ? 'bg-indigo-500/10 border-indigo-500/50 ring-2 ring-indigo-500/30'
          : filled
          ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
      }`}>
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
          active
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            : filled
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            : 'bg-slate-900 border-slate-700 text-slate-500'
        }`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {type === 'anggota' ? 'Anggota' : 'Buku'}
          </p>
          {data ? (
            <>
              <p className="text-[11px] font-bold text-slate-100 truncate mt-0.5">{data.primary}</p>
              <p className="text-[9px] text-slate-500 truncate">{data.secondary}</p>
            </>
          ) : (
            <p className="text-[10px] text-slate-500 mt-0.5 italic">{placeholder}</p>
          )}
        </div>
        {filled && (
          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
        )}
      </div>
      {active && !filled && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[8px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded">
          <span className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse" />
          AKTIF
        </div>
      )}
    </button>
  );
}