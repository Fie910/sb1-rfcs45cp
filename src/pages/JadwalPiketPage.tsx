import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type { JadwalPiketWithRelations, Guru, HariMinggu } from '@/types/database';

const HARI_OPTIONS: HariMinggu[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const emptyForm = {
  guru_id: '',
  hari_piket: 'Senin' as HariMinggu,
};

export function JadwalPiketPage() {
  const [list, setList] = useState<JadwalPiketWithRelations[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JadwalPiketWithRelations | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [piketRes, guruRes] = await Promise.all([
      supabase
        .from('jadwal_pikets')
        .select('*, gurus(id, nama_lengkap)')
        .order('hari_piket', { ascending: true }),
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
    ]);

    if (piketRes.error) {
      showToast('error', 'Gagal memuat jadwal: ' + piketRes.error.message);
    } else {
      setList(piketRes.data as JadwalPiketWithRelations[]);
    }
    setGurus(guruRes.data as Guru[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: JadwalPiketWithRelations) => {
    setEditingId(item.id);
    setForm({
      guru_id: item.guru_id,
      hari_piket: item.hari_piket,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.guru_id) {
      showToast('error', 'Guru wajib dipilih');
      return;
    }
    setSaving(true);
    let result;
    if (editingId) {
      result = await supabase.from('jadwal_pikets').update(form).eq('id', editingId);
    } else {
      result = await supabase.from('jadwal_pikets').insert(form);
    }
    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast('success', editingId ? 'Jadwal piket diperbarui' : 'Jadwal piket ditambahkan');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('jadwal_pikets').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Jadwal piket dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Jadwal Piket</h1>
          <p className="text-slate-500 mt-1">Kelola jadwal tugas piket guru</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Tambah Jadwal Piket
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Hari Piket</th>
                <th className="text-left px-4 py-3 font-medium">Guru Piket</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400">
                    <ShieldCheck size={36} className="mx-auto mb-2 opacity-50" />
                    <p>Belum ada jadwal piket.</p>
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{item.hari_piket}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.gurus?.nama_lengkap ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Jadwal Piket' : 'Tambah Jadwal Piket'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Guru Piket</label>
            <select
              value={form.guru_id}
              onChange={(e) => setForm({ ...form, guru_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Pilih Guru</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id}>{g.nama_lengkap}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Hari Piket</label>
            <select
              value={form.hari_piket}
              onChange={(e) => setForm({ ...form, hari_piket: e.target.value as HariMinggu })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {HARI_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">Batal</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Jadwal Piket"
        message="Yakin ingin menghapus jadwal piket ini?"
      />
    </div>
  );
}
