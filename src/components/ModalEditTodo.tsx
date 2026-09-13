import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { PriorityType, TodoItem } from '@/types/TodoTemplate';

interface ModalEditTodoProps {
  isOpen: boolean;
  onClose: () => void;
  todo: TodoItem | null;
  guruList: { id: string; nama_lengkap: string }[];
  onSuccess: () => void;
}

export function ModalEditTodo({
  isOpen,
  onClose,
  todo,
  guruList,
  onSuccess,
}: ModalEditTodoProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    prioritas: 'Sedang' as PriorityType,
    tanggal_tenggat: '',
    ditugaskan_ke_id: '',
  });

  useEffect(() => {
    if (todo) {
      setFormData({
        judul: todo.judul,
        deskripsi: todo.deskripsi || '',
        prioritas: todo.prioritas,
        tanggal_tenggat: todo.tanggal_tenggat || '',
        ditugaskan_ke_id: todo.ditugaskan_ke_id || '',
      });
    }
  }, [todo, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!todo || !formData.judul.trim()) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('todos')
        .update({
          judul: formData.judul,
          deskripsi: formData.deskripsi || null,
          prioritas: formData.prioritas,
          tanggal_tenggat: formData.tanggal_tenggat || null,
          ditugaskan_ke_id: formData.ditugaskan_ke_id || null,
        })
        .eq('id', todo.id);

      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Gagal memperbarui tugas:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Edit Detail Tugas">
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Judul Tugas *</label>
          <input
            type="text"
            required
            value={formData.judul}
            onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Prioritas</label>
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
            <label className="block text-xs font-bold text-slate-400 mb-1">Penanggung Jawab</label>
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
          <label className="block text-xs font-bold text-slate-400 mb-1">Tanggal Tenggat</label>
          <input
            type="date"
            value={formData.tanggal_tenggat}
            onChange={(e) => setFormData({ ...formData, tanggal_tenggat: e.target.value })}
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">Deskripsi / Catatan Tugas</label>
          <textarea
            rows={3}
            value={formData.deskripsi}
            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />} Simpan Perubahan
          </button>
        </div>
      </form>
    </Modal>
  );
}