import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, UserCog, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type { Guru } from '@/types/database';

type RoleItem = {
  id?: string;
  kode_role: string;
  nama_role: string;
};

const emptyForm = {
  nip: '',
  nama_lengkap: '',
  email: '',
  role: 'guru',
};

export function GuruPage() {
  const [list, setList] = useState<Guru[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Guru | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Guru | null>(null);

  // Ambil Data Guru & Data Roles dari Database
  const fetchData = async () => {
    setLoading(true);

    const [guruRes, rolesRes] = await Promise.all([
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
      supabase.from('roles').select('*').order('nama_role', { ascending: true }),
    ]);

    if (guruRes.error) {
      showToast('error', 'Gagal memuat data guru: ' + guruRes.error.message);
    } else {
      setList(guruRes.data as Guru[]);
    }

    if (rolesRes.error) {
      console.error('Gagal memuat data roles:', rolesRes.error.message);
    } else if (rolesRes.data) {
      setRoles(rolesRes.data as RoleItem[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter pencarian
  const filtered = list.filter(
    (g) =>
      g.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
      (g.nip || '').toLowerCase().includes(search.toLowerCase()) ||
      g.email.toLowerCase().includes(search.toLowerCase())
  );

  // Helper untuk mendapatkan Label Role berdasarkan kode_role
  const getRoleLabel = (kodeRole: string) => {
    const found = roles.find((r) => r.kode_role === kodeRole);
    if (found) return found.nama_role;
    // Fallback tampilan sederhana
    return kodeRole.replace('_', ' ').toUpperCase();
  };

  // Helper untuk warna badge role
  const getRoleBadgeStyle = (kodeRole: string) => {
    switch (kodeRole) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/50';
      case 'guru_piket':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800/50';
      default:
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/50';
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      role: roles.length > 0 ? roles[0].kode_role : 'guru',
    });
    setModalOpen(true);
  };

  const openEdit = (item: Guru) => {
    setEditing(item);
    setForm({
      nip: item.nip || '',
      nama_lengkap: item.nama_lengkap,
      email: item.email,
      role: item.role,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nip || !form.nama_lengkap || !form.email) {
      showToast('error', 'NIP, nama, dan email wajib diisi');
      return;
    }
    setSaving(true);
    let result;
    if (editing) {
      result = await supabase.from('gurus').update(form).eq('id', editing.id);
    } else {
      result = await supabase.from('gurus').insert(form);
    }
    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast('success', editing ? 'Data guru diperbarui' : 'Data guru ditambahkan');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('gurus').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Data guru dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Data Guru</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Kelola data guru dan hak akses (role)</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={18} /> Tambah Guru
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4 mb-4 shadow-sm transition-colors">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, atau email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden shadow-sm transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/80">
              <tr>
                <th className="text-left px-4 py-3 font-medium">NIP</th>
                <th className="text-left px-4 py-3 font-medium">Nama Lengkap</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 dark:text-slate-500">
                    <UserCog size={36} className="mx-auto mb-2 opacity-50" />
                    <p>Tidak ada data guru.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((guru) => (
                  <tr key={guru.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{guru.nip}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{guru.nama_lengkap}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{guru.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getRoleBadgeStyle(guru.role)}`}>
                        {getRoleLabel(guru.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(guru)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(guru)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Data Guru' : 'Tambah Data Guru'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">NIP</label>
            <input
              type="text"
              value={form.nip}
              onChange={(e) => setForm({ ...form, nip: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Role (Hak Akses)</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {roles.length === 0 ? (
                <option value="guru">Guru</option>
              ) : (
                roles.map((r) => (
                  <option key={r.kode_role} value={r.kode_role}>
                    {r.nama_role} ({r.kode_role})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/80">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null} Simpan
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Data Guru"
        message={`Yakin ingin menghapus "${deleteTarget?.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}