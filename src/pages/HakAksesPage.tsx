import { useEffect, useState } from 'react';
import {
  Shield,
  Save,
  Loader2,
  RefreshCw,
  Plus,
  Lock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

interface Role {
  id: number;
  kode_role: string;
  nama_role: string;
  keterangan?: string;
}

interface Menu {
  id: number;
  kode_menu: string;
  nama_menu: string;
  path: string;
  kategori: string;
}

interface RolePermission {
  role_code: string;
  menu_id: number;
  can_access: boolean;
}

export function HakAksesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // State Modal Tambah Role
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newKodeRole, setNewKodeRole] = useState('');
  const [newNamaRole, setNewNamaRole] = useState('');
  const [newKeterangan, setNewKeterangan] = useState('');
  const [addingRole, setAddingRole] = useState(false);

  // Helper Key: "role_code:menu_id" -> Contoh: "guru_piket:3"
  const getPermKey = (roleCode: string, menuId: number) => `${roleCode}:${menuId}`;

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Ambil Data Roles
      const { data: rolesData, error: rolesErr } = await supabase
        .from('roles')
        .select('*')
        .order('id', { ascending: true });
      if (rolesErr) throw rolesErr;

      // 2. Ambil Data Menus
      const { data: menusData, error: menusErr } = await supabase
        .from('menus')
        .select('*')
        .order('kategori', { ascending: true });
      if (menusErr) throw menusErr;

      // 3. Ambil Data Permissions
      const { data: permData, error: permErr } = await supabase
        .from('role_permissions')
        .select('*');
      if (permErr) throw permErr;

      // Map Permissions ke Objek State
      const permMap: Record<string, boolean> = {};
      permData?.forEach((p: RolePermission) => {
        permMap[getPermKey(p.role_code, p.menu_id)] = p.can_access;
      });

      setRoles(rolesData || []);
      setMenus(menusData || []);
      setPermissions(permMap);
    } catch (err: any) {
      showToast('error', 'Gagal memuat data hak akses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = (roleCode: string, menuId: number) => {
    const key = getPermKey(roleCode, menuId);
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      const payload: { role_code: string; menu_id: number; can_access: boolean }[] = [];

      roles.forEach((role) => {
        menus.forEach((menu) => {
          const key = getPermKey(role.kode_role, menu.id);
          payload.push({
            role_code: role.kode_role,
            menu_id: menu.id,
            can_access: !!permissions[key],
          });
        });
      });

      const { error } = await supabase
        .from('role_permissions')
        .upsert(payload, { onConflict: 'role_code,menu_id' });

      if (error) throw error;
      showToast('success', 'Matriks hak akses berhasil disimpan!');
    } catch (err: any) {
      showToast('error', 'Gagal menyimpan hak akses: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKodeRole || !newNamaRole) {
      showToast('error', 'Kode role dan nama role wajib diisi!');
      return;
    }

    setAddingRole(true);
    try {
      const formattedKode = newKodeRole.toLowerCase().trim().replace(/\s+/g, '_');

      const { error } = await supabase.from('roles').insert([
        {
          kode_role: formattedKode,
          nama_role: newNamaRole.trim(),
          keterangan: newKeterangan.trim() || null,
        },
      ]);

      if (error) throw error;

      showToast('success', `Role "${newNamaRole}" berhasil ditambahkan!`);
      setShowAddRoleModal(false);
      setNewKodeRole('');
      setNewNamaRole('');
      setNewKeterangan('');
      fetchData(); // Reload matriks
    } catch (err: any) {
      showToast('error', 'Gagal menambah role: ' + err.message);
    } finally {
      setAddingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
        <span>Memuat Matriks Hak Akses...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <Shield className="text-indigo-400 shrink-0" size={28} />
            Pengelolaan Hak Akses Modul
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1">
            Kelola daftar role/jabatan dan atur hak akses halaman secara dinamis.
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-2.5">
          <button
            onClick={() => setShowAddRoleModal(true)}
            className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 md:px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs md:text-sm"
          >
            <Plus size={16} />
            <span>Role Baru</span>
          </button>
          <button
            onClick={fetchData}
            disabled={saving}
            className="p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer shrink-0"
            title="Reload Data"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleSavePermissions}
            disabled={saving}
            className="flex-1 md:flex-none justify-center flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 md:px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 text-xs md:text-sm shrink-0"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* 1. TAMPILAN MOBILE: Card Stack Layout (Tanpa Scroll Horizontal) */}
      <div className="block md:hidden space-y-4">
        {menus.map((menu) => (
          <div
            key={menu.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3"
          >
            {/* Header Modul */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 text-base">{menu.nama_menu}</h3>
                <p className="text-xs font-mono text-indigo-400 mt-0.5">{menu.path}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50 shrink-0">
                {menu.kategori}
              </span>
            </div>

            {/* List Role & Switch Access */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Hak Akses Jabatan:
              </span>
              {roles.map((role) => {
                const isAdmin = role.kode_role === 'admin';
                const isAllowed = isAdmin || !!permissions[getPermKey(role.kode_role, menu.id)];

                return (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{role.nama_role}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{role.kode_role}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isAdmin}
                      onClick={() => handleToggle(role.kode_role, menu.id)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors relative inline-flex items-center cursor-pointer ${
                        isAllowed ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                      } ${isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {isAdmin ? (
                        <Lock size={12} className="text-white/80 mx-auto" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-white shadow-md transition-all" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 2. TAMPILAN DESKTOP: Tabel Matrix dengan Freeze Header & First Column */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="overflow-auto max-h-[calc(100vh-220px)] relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-bold">
                {/* Kolom 1: Freezed saat scroll vertikal (top-0) DAN horizontal (left-0), z-30 agar berada paling atas */}
                <th className="p-4 min-w-[220px] sticky top-0 left-0 z-30 bg-slate-950 border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  Modul / Halaman
                </th>
                {/* Kolom-kolom lainnya: Freezed saat scroll vertikal saja (top-0), z-20 */}
                <th className="p-4 sticky top-0 z-20 bg-slate-950">Path URL</th>
                {roles.map((role) => (
                  <th key={role.id} className="p-4 text-center min-w-[130px] sticky top-0 z-20 bg-slate-950">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-200">{role.nama_role}</span>
                      <span className="text-[10px] text-slate-500 font-mono normal-case mt-0.5">
                        {role.kode_role}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm font-medium">
              {menus.map((menu) => (
                <tr key={menu.id} className="hover:bg-slate-800/30 transition-colors group">
                  {/* Kolom 1: Freezed saat scroll horizontal (left-0), z-10, background solid agar konten lain tidak membayang */}
                  <td className="p-4 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors border-r border-slate-800/80 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                    <div className="font-bold text-slate-100">{menu.nama_menu}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                      {menu.kategori}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{menu.path}</td>
                  {roles.map((role) => {
                    const isAdmin = role.kode_role === 'admin';
                    const isAllowed = isAdmin || !!permissions[getPermKey(role.kode_role, menu.id)];

                    return (
                      <td key={role.id} className="p-4 text-center">
                        <button
                          type="button"
                          disabled={isAdmin}
                          onClick={() => handleToggle(role.kode_role, menu.id)}
                          className={`w-12 h-6 rounded-full p-1 transition-colors relative inline-flex items-center cursor-pointer ${
                            isAllowed ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                          } ${isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isAdmin ? (
                            <Lock size={12} className="text-white/80 mx-auto" />
                          ) : (
                            <span className="w-4 h-4 rounded-full bg-white shadow-md transition-all" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TAMBAH ROLE BARU */}
      <Modal
        open={showAddRoleModal}
        onClose={() => setShowAddRoleModal(false)}
        title="Tambah Role Baru"
        size="md"
      >
        <form onSubmit={handleAddRole} className="space-y-4 text-slate-100">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Kode Role (Identifier)
            </label>
            <input
              type="text"
              placeholder="contoh: guru_bk, kepala_sekolah"
              value={newKodeRole}
              onChange={(e) => setNewKodeRole(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Gunakan huruf kecil tanpa spasi (gunakan underscore `_`).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nama Role (Tampilan)
            </label>
            <input
              type="text"
              placeholder="contoh: Guru BK, Kepala Sekolah"
              value={newNamaRole}
              onChange={(e) => setNewNamaRole(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Keterangan (Opsional)
            </label>
            <textarea
              placeholder="Deskripsi tugas atau peranan..."
              value={newKeterangan}
              onChange={(e) => setNewKeterangan(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddRoleModal(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={addingRole}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 text-xs"
            >
              {addingRole ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Simpan Role
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}