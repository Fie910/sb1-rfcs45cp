import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
  Clock,
  Search,
  BookOpen,
  User,
  GraduationCap,
  Filter,
  X,
} from 'lucide-react';
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

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHari, setSelectedHari] = useState<string>('semua');

  // Modal States
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
      showToast('error', 'Gagal memuat jadwal KBM: ' + jadwalRes.error.message);
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
    setMapelList((mapelRes.data as MataPelajaran[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesHari = selectedHari === 'semua' || item.hari === selectedHari;
      const query = searchQuery.toLowerCase();
      const guruName = item.gurus?.nama_lengkap?.toLowerCase() || '';
      const kelasName = item.kelas?.nama_kelas?.toLowerCase() || '';
      const mapelName = (item.mata_pelajarans?.nama_mapel || item.mata_pelajaran || '').toLowerCase();

      const matchesSearch =
        guruName.includes(query) || kelasName.includes(query) || mapelName.includes(query);

      return matchesHari && matchesSearch;
    });
  }, [list, selectedHari, searchQuery]);

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
      waktu_mulai: item.waktu_mulai ? item.waktu_mulai.slice(0, 5) : '07:00',
      waktu_selesai: item.waktu_selesai ? item.waktu_selesai.slice(0, 5) : '07:40',
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
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-400 mb-2" size={36} />
        <p className="text-sm text-slate-400 font-medium">Memuat jadwal KBM...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-xl border border-indigo-500/20">
            <CalendarDays size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Jadwal KBM</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Kelola jadwal kegiatan belajar mengajar sekolah
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 cursor-pointer text-sm"
        >
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      {/* Control / Filter Bar */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Cari guru, kelas, atau mapel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-slate-500 text-slate-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Hari Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          <Filter size={16} className="text-slate-500 shrink-0 ml-1" />
          <button
            onClick={() => setSelectedHari('semua')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedHari === 'semua'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            Semua Hari
          </button>
          {HARI_OPTIONS.map((hari) => (
            <button
              key={hari}
              onClick={() => setSelectedHari(hari)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedHari === hari
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {hari}
            </button>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase text-[11px] tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Hari</th>
                <th className="px-5 py-3.5">Waktu</th>
                <th className="px-5 py-3.5">Guru</th>
                <th className="px-5 py-3.5">Mata Pelajaran</th>
                <th className="px-5 py-3.5">Kelas</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <CalendarDays size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400">Tidak ada jadwal KBM ditemukan</p>
                    <p className="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci atau filter hari</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Hari Badge */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                        {item.hari}
                      </span>
                    </td>

                    {/* Waktu */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-500" />
                        <span>
                          {item.waktu_mulai && item.waktu_selesai
                            ? `${item.waktu_mulai.slice(0, 5)} - ${item.waktu_selesai.slice(0, 5)}`
                            : '-'}
                        </span>
                      </div>
                    </td>

                    {/* Guru */}
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-slate-500 shrink-0" />
                        <span>{item.gurus?.nama_lengkap ?? '-'}</span>
                      </div>
                    </td>

                    {/* Mapel */}
                    <td className="px-5 py-3.5 text-slate-300">
                      <div className="flex items-center gap-2">
                        <BookOpen size={15} className="text-slate-500 shrink-0" />
                        <span>{getMapelName(item)}</span>
                      </div>
                    </td>

                    {/* Kelas */}
                    <td className="px-5 py-3.5 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap size={15} className="text-slate-500 shrink-0" />
                        <span className="inline-block bg-slate-800 px-2.5 py-0.5 rounded text-xs font-medium text-slate-300 border border-slate-700">
                          {item.kelas?.nama_kelas ?? '-'}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                          title="Edit Jadwal"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Hapus Jadwal"
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

      {/* Modal Form Manual */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Jadwal KBM' : 'Tambah Jadwal KBM'}
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Guru
            </label>
            <select
              value={form.guru_id}
              onChange={(e) => setForm({ ...form, guru_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="" className="bg-slate-900 text-slate-400">Pilih Guru</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-slate-200">
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Hari
            </label>
            <select
              value={form.hari}
              onChange={(e) => setForm({ ...form, hari: e.target.value as HariMinggu })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              {HARI_OPTIONS.map((h) => (
                <option key={h} value={h} className="bg-slate-900 text-slate-200">
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Clock size={13} /> Waktu Mulai
              </label>
              <input
                type="time"
                value={form.waktu_mulai}
                onChange={(e) => setForm({ ...form, waktu_mulai: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Clock size={13} /> Waktu Selesai
              </label>
              <input
                type="time"
                value={form.waktu_selesai}
                onChange={(e) => setForm({ ...form, waktu_selesai: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Kelas
            </label>
            <select
              value={form.kelas_id}
              onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="" className="bg-slate-900 text-slate-400">Pilih Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-200">
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Mata Pelajaran
            </label>
            <select
              value={form.mapel_id}
              onChange={(e) => setForm({ ...form, mapel_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="" className="bg-slate-900 text-slate-400">Pilih Mata Pelajaran</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                  {m.nama_mapel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800 mt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-medium text-sm transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {saving && <Loader2 size={16} className="animate-spin" />} Simpan
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Jadwal"
        message="Apakah Anda yakin ingin menghapus jadwal KBM ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}