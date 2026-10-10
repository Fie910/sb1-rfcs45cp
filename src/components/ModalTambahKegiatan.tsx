import { useState, useEffect } from 'react';
import {
  Loader2,
  Calendar,
  FileText,
  UserCheck,
  Users,
  PlusCircle,
  Save,
  Activity,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { showToast } from '@/components/Toast';
import { broadcastToAllGurus } from '@/lib/notifications/notification';

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

const initialFormData: RencanaKegiatan = {
  nama_kegiatan: '',
  tanggal_mulai: new Date().toISOString().split('T')[0],
  tanggal_selesai: '',
  penanggung_jawab: '',
  peserta: '',
  deskripsi: '',
  status: 'Akan Datang',
};

export function ModalTambahKegiatan({
  open,
  onClose,
  onSuccess,
  kegiatanEdit,
}: ModalKegiatanProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<RencanaKegiatan>(initialFormData);

  useEffect(() => {
    if (kegiatanEdit) {
      setFormData({
        nama_kegiatan: kegiatanEdit.nama_kegiatan || '',
        tanggal_mulai: kegiatanEdit.tanggal_mulai || new Date().toISOString().split('T')[0],
        tanggal_selesai: kegiatanEdit.tanggal_selesai || '',
        penanggung_jawab: kegiatanEdit.penanggung_jawab || '',
        peserta: kegiatanEdit.peserta || '',
        deskripsi: kegiatanEdit.deskripsi || '',
        status: kegiatanEdit.status || 'Akan Datang',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [kegiatanEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      nama_kegiatan: formData.nama_kegiatan.trim(),
      tanggal_mulai: formData.tanggal_mulai,
      tanggal_selesai: formData.tanggal_selesai || null,
      penanggung_jawab: formData.penanggung_jawab.trim(),
      peserta: formData.peserta.trim(),
      deskripsi: formData.deskripsi?.trim() || null,
      status: formData.status,
    };

    const isEdit = Boolean(kegiatanEdit?.id);

    try {
      if (isEdit && kegiatanEdit?.id) {
        const { error } = await supabase
          .from('rencana_kegiatan')
          .update(payload)
          .eq('id', kegiatanEdit.id);

        if (error) throw error;

        showToast('success', 'Rencana kegiatan berhasil diperbarui');
      } else {
        const { error } = await supabase.from('rencana_kegiatan').insert([payload]);

        if (error) throw error;

        // Broadcast notifikasi ke seluruh guru via helper terpusat.
        // Tipe 'kegiatan' ada di NON_PUSH_TIPE → tidak kirim push,
        // hanya muncul di lonceng aplikasi.
        try {
          await broadcastToAllGurus({
            judul: '📌 Agenda Kegiatan Baru',
            pesan: `Agenda "${payload.nama_kegiatan}" telah ditambahkan untuk tanggal ${payload.tanggal_mulai}.`,
            tipe: 'kegiatan',
            tautan: '/kegiatan',
          });
        } catch (notifErr) {
          // Jangan gagalkan flow utama hanya karena notifikasi error
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

  const isEdit = Boolean(kegiatanEdit?.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Rencana Kegiatan Sekolah' : 'Tambah Rencana Kegiatan Sekolah'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Nama Kegiatan <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Contoh: Penilaian Tengah Semester (PTS)"
            value={formData.nama_kegiatan}
            onChange={(e) => setFormData({ ...formData, nama_kegiatan: e.target.value })}
            className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

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
              onChange={(e) =>
                setFormData({ ...formData, penanggung_jawab: e.target.value })
              }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1">
              <Calendar size={13} className="text-indigo-400" /> Tanggal Mulai{' '}
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
              <Calendar size={13} className="text-indigo-400" /> Tanggal Selesai
            </label>
            <input
              type="date"
              value={formData.tanggal_selesai ?? ''}
              onChange={(e) => setFormData({ ...formData, tanggal_selesai: e.target.value })}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
            />
          </div>
        </div>

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
                <Loader2 size={14} className="animate-spin" /> Menyimpan...
              </>
            ) : isEdit ? (
              <>
                <Save size={14} /> Simpan Perubahan
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