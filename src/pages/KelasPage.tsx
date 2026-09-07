import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, School, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal, ConfirmModal } from '@/components/Modal';
import { showToast } from '@/components/Toast';
import type { KelasWithWali, Guru } from '@/types/database';

export function KelasPage() {
  const [kelasList, setKelasList] = useState<KelasWithWali[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KelasWithWali | null>(null);
  const [form, setForm] = useState({ nama_kelas: '', wali_kelas_id: '' });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<KelasWithWali | null>(null);
  const [siswaCounts, setSiswaCounts] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    const [kelasRes, guruRes] = await Promise.all([
      supabase
        .from('kelas')
        .select('*, gurus(id, nama_lengkap)')
        .order('nama_kelas', { ascending: true }),
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
    ]);

    if (kelasRes.data) {
      setKelasList(kelasRes.data as KelasWithWali[]);

      // Count students per class
      const counts: Record<string, number> = {};
      for (const k of kelasRes.data) {
        const { count } = await supabase
          .from('siswas')
          .select('id', { count: 'exact', head: true })
          .eq('kelas_id', k.id);
        counts[k.id] = count ?? 0;
      }
      setSiswaCounts(counts);
    }
    if (guruRes.data) setGuruList(guruRes.data as Guru[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ nama_kelas: '', wali_kelas_id: '' });
    setModalOpen(true);
  };

  const openEdit = (k: KelasWithWali) => {
    setEditing(k);
    setForm({ nama_kelas: k.nama_kelas, wali_kelas_id: k.wali_kelas_id ?? '' });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_kelas) {
      showToast('error', 'Nama kelas harus diisi');
      return;
    }
    setSaving(true);

    const payload = {
      nama_kelas: form.nama_kelas,
      wali_kelas_id: form.wali_kelas_id || null,
    };

    if (editing) {
      const { error } = await supabase.from('kelas').update(payload).eq('id', editing.id);
      if (error) {
        showToast('error', 'Gagal mengupdate: ' + error.message);
      } else {
        showToast('success', 'Data kelas berhasil diperbarui');
        setModalOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('kelas').insert(payload);
      if (error) {
        showToast('error', 'Gagal menambah: ' + error.message);
      } else {
        showToast('success', 'Kelas baru berhasil ditambahkan');
        setModalOpen(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('kelas').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Kelas berhasil dihapus');
      setDeleteTarget(null);
      fetchData();
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Kelas</h1>
          <p className="text-slate-500 mt-1">Kelola kelas dan wali kelas</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={18} />
          Tambah Kelas
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : kelasList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 text-center py-16 text-slate-400">
          <School size={40} className="mx-auto mb-3 opacity-50" />
          <p>Belum ada data kelas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kelasList.map((k) => (
            <div
              key={k.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <School className="text-blue-600" size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(k)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(k)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{k.nama_kelas}</h3>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users size={14} />
                  <span>{siswaCounts[k.id] ?? 0} siswa</span>
                </div>
                <p className="text-sm text-slate-500">
                  Wali kelas:{' '}
                  <span className="text-slate-700 font-medium">
                    {k.gurus?.nama_lengkap ?? 'Belum ditentukan'}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Kelas' : 'Tambah Kelas'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Nama Kelas
            </label>
            <input
              type="text"
              value={form.nama_kelas}
              onChange={(e) => setForm({ ...form, nama_kelas: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contoh: X IPA 1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Wali Kelas
            </label>
            <select
              value={form.wali_kelas_id}
              onChange={(e) => setForm({ ...form, wali_kelas_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Tidak ada wali kelas</option>
              {guruList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_lengkap} - {g.mata_pelajaran}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Kelas"
        message={`Yakin ingin menghapus kelas "${deleteTarget?.nama_kelas}"? Semua siswa di kelas ini beserta data nilainya juga akan dihapus.`}
      />
    </div>
  );
}
