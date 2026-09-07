import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, CalendarDays, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type {
  JadwalKbmWithRelations,
  Guru,
  Kelas,
  HariMinggu,
  MataPelajaran,
} from '@/types/database';

const HARI_OPTIONS: HariMinggu[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const HARI_ORDER: Record<HariMinggu, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
  Minggu: 7,
};

const emptyForm = {
  guru_id: '',
  hari: 'Senin' as HariMinggu,
  kelas_id: '',
  mapel_id: '',
  waktu_mulai: '07:00',
  waktu_selesai: '07:40',
};

export function JadwalKbmPage() {
  const [list, setList] = useState<JadwalKbmWithRelations[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JadwalKbmWithRelations | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [jadwalRes, guruRes, kelasRes, mapelRes] = await Promise.all([
      supabase
        .from('jadwal_kbms')
        .select('*, kelas(id, nama_kelas), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)'),
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
      supabase.from('kelas').select('*').order('nama_kelas', { ascending: true }),
      supabase.from('mata_pelajarans').select('*').order('nama_mapel', { ascending: true }),
    ]);

    if (jadwalRes.error) {
      showToast('error', 'Gagal memuat jadwal: ' + jadwalRes.error.message);
    } else {
      const rawData = (jadwalRes.data as JadwalKbmWithRelations[]) || [];
      
      const sortedData = [...rawData].sort((a, b) => {
        const orderA = HARI_ORDER[a.hari] || 99;
        const orderB = HARI_ORDER[b.hari] || 99;
        if (orderA !== orderB) return orderA - orderB;

        const timeA = a.waktu_mulai || '00:00';
        const timeB = b.waktu_mulai || '00:00';
        return timeA.localeCompare(timeB);
      });

      setList(sortedData);
    }

    setGurus((guruRes.data as Guru[]) || []);
    setKelasList((kelasRes.data as Kelas[]) || []);
    // DIPERBAIKI: Mengambil data langsung dari respon Supabase
    setMapelList((mapelRes.data as MataPelajaran[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getMapelName = (item: JadwalKbmWithRelations): string =>
    item.mata_pelajarans?.nama_mapel ?? item.mata_pelajaran ?? '-';

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: JadwalKbmWithRelations) => {
    setEditingId(item.id);
    setForm({
      guru_id: item.guru_id,
      hari: item.hari,
      kelas_id: item.kelas_id,
      mapel_id: item.mapel_id ?? '',
      waktu_mulai: item.waktu_mulai ?? '07:00',
      waktu_selesai: item.waktu_selesai ?? '07:40',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.guru_id || !form.kelas_id || !form.mapel_id || !form.waktu_mulai || !form.waktu_selesai) {
      showToast('error', 'Semua field wajib diisi');
      return;
    }

    if (form.waktu_mulai >= form.waktu_selesai) {
      showToast('error', 'Waktu selesai harus lebih lambat dari waktu mulai');
      return;
    }

    setSaving(true);

    const payload = {
      guru_id: form.guru_id,
      hari: form.hari,
      kelas_id: form.kelas_id,
      mapel_id: form.mapel_id,
      waktu_mulai: form.waktu_mulai,
      waktu_selesai: form.waktu_selesai,
    };

    let result;
    if (editingId) {
      result = await supabase.from('jadwal_kbms').update(payload).eq('id', editingId);
    } else {
      result = await supabase.from('jadwal_kbms').insert(payload);
    }

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast('success', editingId ? 'Jadwal diperbarui' : 'Jadwal ditambahkan');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('jadwal_kbms').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Jadwal dihapus');
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
          <h1 className="text-2xl font-bold text-slate-800">Jadwal KBM</h1>
          <p className="text-slate-500 mt-1">Kelola jadwal kegiatan belajar mengajar</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Hari</th>
                <th className="text-left px-4 py-3 font-medium">Waktu</th>
                <th className="text-left px-4 py-3 font-medium">Guru</th>
                <th className="text-left px-4 py-3 font-medium">Mata Pelajaran</th>
                <th className="text-left px-4 py-3 font-medium">Kelas</th>
                <th className="text-right px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <CalendarDays size={36} className="mx-auto mb-2 opacity-50" />
                    <p>Belum ada jadwal KBM.</p>
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{item.hari}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {item.waktu_mulai && item.waktu_selesai
                        ? `${item.waktu_mulai.slice(0, 5)} - ${item.waktu_selesai.slice(0, 5)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.gurus?.nama_lengkap ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{getMapelName(item)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.kelas?.nama_kelas ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Jadwal KBM' : 'Tambah Jadwal KBM'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Guru</label>
            <select
              value={form.guru_id}
              onChange={(e) => setForm({ ...form, guru_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Pilih Guru</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Hari</label>
            <select
              value={form.hari}
              onChange={(e) => setForm({ ...form, hari: e.target.value as HariMinggu })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {HARI_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                <Clock size={14} /> Waktu Mulai
              </label>
              <input
                type="time"
                value={form.waktu_mulai}
                onChange={(e) => setForm({ ...form, waktu_mulai: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1">
                <Clock size={14} /> Waktu Selesai
              </label>
              <input
                type="time"
                value={form.waktu_selesai}
                onChange={(e) => setForm({ ...form, waktu_selesai: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Kelas</label>
            <select
              value={form.kelas_id}
              onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Mata Pelajaran</label>
            <select
              value={form.mapel_id}
              onChange={(e) => setForm({ ...form, mapel_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Pilih Mata Pelajaran</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama_mapel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-60 cursor-pointer"
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
        title="Hapus Jadwal"
        message="Yakin ingin menghapus jadwal ini?"
      />
    </div>
  );
}