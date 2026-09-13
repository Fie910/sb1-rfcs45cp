import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { PriorityType, TipeRutin, TodoTemplate } from '@/types/TodoTemplate';

interface ModalTemplateRutinProps {
  isOpen: boolean;
  onClose: () => void;
  divisiId: string;
  namaDivisi: string;
  guruList: { id: string; nama_lengkap: string }[];
  templateToEdit?: TodoTemplate | null;
  onSuccess: () => void;
}

const HARI_LIST = [
  { id: 1, label: 'Senin' },
  { id: 2, label: 'Selasa' },
  { id: 3, label: 'Rabu' },
  { id: 4, label: 'Kamis' },
  { id: 5, label: 'Jumat' },
  { id: 6, label: 'Sabtu' },
  { id: 7, label: 'Minggu' },
];

export function ModalTemplateRutin({
  isOpen,
  onClose,
  divisiId,
  guruList,
  templateToEdit,
  onSuccess,
}: ModalTemplateRutinProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    prioritas: 'Sedang' as PriorityType,
    tipe_rutin: 'Harian' as TipeRutin,
    hari_mingguan: 1,
    tanggal_bulanan: 1,
    ditugaskan_ke_id: '',
  });

  useEffect(() => {
    if (templateToEdit) {
      setFormData({
        judul: templateToEdit.judul,
        deskripsi: templateToEdit.deskripsi || '',
        prioritas: templateToEdit.prioritas,
        tipe_rutin: templateToEdit.tipe_rutin,
        hari_mingguan: templateToEdit.hari_mingguan || 1,
        tanggal_bulanan: templateToEdit.tanggal_bulanan || 1,
        ditugaskan_ke_id: templateToEdit.ditugaskan_ke_id || '',
      });
    } else {
      setFormData({
        judul: '',
        deskripsi: '',
        prioritas: 'Sedang',
        tipe_rutin: 'Harian',
        hari_mingguan: 1,
        tanggal_bulanan: 1,
        ditugaskan_ke_id: '',
      });
    }
  }, [templateToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.judul.trim() || !divisiId) return;

    try {
      setIsSubmitting(true);
      const payload = {
        judul: formData.judul,
        deskripsi: formData.deskripsi || null,
        divisi_id: divisiId,
        prioritas: formData.prioritas,
        tipe_rutin: formData.tipe_rutin,
        hari_mingguan: formData.tipe_rutin === 'Mingguan' ? formData.hari_mingguan : null,
        tanggal_bulanan: formData.tipe_rutin === 'Bulanan' ? formData.tanggal_bulanan : null,
        ditugaskan_ke_id: formData.ditugaskan_ke_id || null,
      };

      if (templateToEdit) {
        const { error } = await supabase
          .from('todo_templates')
          .update(payload)
          .eq('id', templateToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('todo_templates').insert({
          ...payload,
          is_active: true,
        });
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Gagal menyimpan template SOP:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={templateToEdit ? 'Edit Jadwal SOP Rutin' : 'Buat Jadwal Tugas Rutin (SOP)'}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-200">
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
          <RefreshCw size={16} className="mt-0.5 shrink-0 text-indigo-400" />
          <span>
            Tugas ini akan terbuat otomatis secara berkala sesuai jadwal yang Anda tentukan.
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Judul Tugas Rutin *</label>
          <input
            type="text"
            required
            value={formData.judul}
            onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
            placeholder="Contoh: Rekapitulasi Presensi Mingguan"
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1.5">Frekuensi Pengulangan *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Harian', 'Mingguan', 'Bulanan'] as TipeRutin[]).map((tipe) => (
              <button
                key={tipe}
                type="button"
                onClick={() => setFormData({ ...formData, tipe_rutin: tipe })}
                className={`py-2.5 px-2 text-xs font-bold rounded-xl border transition-all text-center ${
                  formData.tipe_rutin === tipe
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {tipe}
              </button>
            ))}
          </div>
        </div>

        {formData.tipe_rutin === 'Mingguan' && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Pilih Hari *</label>
            <select
              value={formData.hari_mingguan}
              onChange={(e) => setFormData({ ...formData, hari_mingguan: Number(e.target.value) })}
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {HARI_LIST.map((h) => (
                <option key={h.id} value={h.id}>
                  Setiap Hari {h.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {formData.tipe_rutin === 'Bulanan' && (
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Tanggal Eksekusi Bulanan *</label>
            <select
              value={formData.tanggal_bulanan}
              onChange={(e) => setFormData({ ...formData, tanggal_bulanan: Number(e.target.value) })}
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((tgl) => (
                <option key={tgl} value={tgl}>
                  Setiap Tanggal {tgl}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Disarankan pilih tanggal 1–28.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Prioritas Default</label>
            <select
              value={formData.prioritas}
              onChange={(e) => setFormData({ ...formData, prioritas: e.target.value as PriorityType })}
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Rendah">Rendah</option>
              <option value="Sedang">Sedang</option>
              <option value="Tinggi">Tinggi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Penanggung Jawab Utul</label>
            <select
              value={formData.ditugaskan_ke_id}
              onChange={(e) => setFormData({ ...formData, ditugaskan_ke_id: e.target.value })}
              className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Pilih Anggota Staf --</option>
              {guruList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Deskripsi / Petunjuk SOP</label>
          <textarea
            rows={3}
            value={formData.deskripsi}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            placeholder="Instruksi pengerjaan rutin..."
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            {templateToEdit ? 'Simpan Perubahan' : 'Simpan Jadwal SOP'}
          </button>
        </div>
      </form>
    </Modal>
  );
}