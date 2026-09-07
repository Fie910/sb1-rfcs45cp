import { useEffect, useState, useMemo, ChangeEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarDays,
  Clock,
  Hash,
  Search,
  BookOpen,
  User,
  GraduationCap,
  Filter,
  X,
  FileSpreadsheet,
  Upload,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type { Guru, Kelas, HariMinggu, MataPelajaran } from '@/types/database';

export interface JadwalKbmJps {
  id: number;
  jam_ke: number;
  hari: HariMinggu;
  guru_id: string;
  kelas_id: number;
  mapel_id: number | null;
  waktu_mulai: string;
  waktu_selesai: string;
  created_at: string;
  gurus?: { id: string; nama_lengkap: string } | null;
  kelas?: { id: number; nama_kelas: string } | null;
  mata_pelajarans?: { id: number; nama_mapel: string } | null;
  mata_pelajaran?: string | null;
}

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
  jam_ke: 1,
  guru_id: '',
  hari: 'Senin' as HariMinggu,
  kelas_id: '',
  mapel_id: '',
  waktu_mulai: '07:00',
  waktu_selesai: '07:30',
};

export function JadwalKbmJpsPage() {
  const [list, setList] = useState<JadwalKbmJps[]>([]);
  const [gurus, setGurus] = useState<Guru[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHari, setSelectedHari] = useState<string>('semua');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JadwalKbmJps | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [jadwalRes, guruRes, kelasRes, mapelRes] = await Promise.all([
      supabase
        .from('jadwal_kbmjps')
        .select('*, kelas(id, nama_kelas), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)'),
      supabase.from('gurus').select('*').order('nama_lengkap', { ascending: true }),
      supabase.from('kelas').select('*').order('nama_kelas', { ascending: true }),
      supabase.from('mata_pelajarans').select('*').order('nama_mapel', { ascending: true }),
    ]);

    if (jadwalRes.error) {
      showToast('error', 'Gagal memuat jadwal KBM JPS: ' + jadwalRes.error.message);
    } else {
      const rawData = (jadwalRes.data as JadwalKbmJps[]) || [];

      const sortedData = [...rawData].sort((a, b) => {
        const orderA = HARI_ORDER[a.hari] || 99;
        const orderB = HARI_ORDER[b.hari] || 99;
        if (orderA !== orderB) return orderA - orderB;
        if (a.jam_ke !== b.jam_ke) return a.jam_ke - b.jam_ke;
        return (a.waktu_mulai || '00:00').localeCompare(b.waktu_mulai || '00:00');
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

  const getMapelName = (item: JadwalKbmJps): string =>
    item.mata_pelajarans?.nama_mapel ?? item.mata_pelajaran ?? '-';

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: JadwalKbmJps) => {
    setEditingId(item.id);
    setForm({
      jam_ke: item.jam_ke ?? 1,
      guru_id: item.guru_id,
      hari: item.hari,
      kelas_id: String(item.kelas_id),
      mapel_id: item.mapel_id ? String(item.mapel_id) : '',
      waktu_mulai: item.waktu_mulai ? item.waktu_mulai.slice(0, 5) : '07:00',
      waktu_selesai: item.waktu_selesai ? item.waktu_selesai.slice(0, 5) : '07:30',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.jam_ke || form.jam_ke < 1) {
      showToast('error', 'Jam ke- harus diisi minimal 1');
      return;
    }
    if (!form.guru_id || !form.kelas_id || !form.waktu_mulai || !form.waktu_selesai) {
      showToast('error', 'Semua field utama wajib diisi');
      return;
    }
    if (form.waktu_mulai >= form.waktu_selesai) {
      showToast('error', 'Waktu selesai harus lebih lambat dari waktu mulai');
      return;
    }

    setSaving(true);

    const payload = {
      jam_ke: Number(form.jam_ke),
      guru_id: form.guru_id,
      hari: form.hari,
      kelas_id: Number(form.kelas_id),
      mapel_id: form.mapel_id ? Number(form.mapel_id) : null,
      waktu_mulai: form.waktu_mulai,
      waktu_selesai: form.waktu_selesai,
    };

    let result;
    if (editingId) {
      result = await supabase.from('jadwal_kbmjps').update(payload).eq('id', editingId);
    } else {
      result = await supabase.from('jadwal_kbmjps').insert(payload);
    }

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast('success', editingId ? 'Jadwal JPS berhasil diperbarui' : 'Jadwal JPS berhasil ditambahkan');
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('jadwal_kbmjps').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Jadwal KBM JPS berhasil dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  // --- FITUR IMPORT DATASHEET ---
  const downloadTemplate = () => {
    const templateData = [
      {
        Hari: 'Senin',
        'Jam Ke': 1,
        'Waktu Mulai': '07:00',
        'Waktu Selesai': '07:40',
        'Nama Guru': gurus[0]?.nama_lengkap || 'Ahmad, S.Pd',
        'Nama Kelas': kelasList[0]?.nama_kelas || 'VII A',
        'Nama Mapel': mapelList[0]?.nama_mapel || 'Bimbingan Konseling',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Jadwal');
    XLSX.writeFile(wb, 'Template_Jadwal_KBM_JPS.xlsx');
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const parsedData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (parsedData.length === 0) {
          showToast('error', 'File spreadsheet kosong atau format tidak sesuai.');
          setImporting(false);
          return;
        }

        const payloadInsert: Array<{
          hari: HariMinggu;
          jam_ke: number;
          waktu_mulai: string;
          waktu_selesai: string;
          guru_id: string;
          kelas_id: number;
          mapel_id: number | null;
        }> = [];

        let skipped = 0;

        for (const row of parsedData) {
          const rawHari = String(row['Hari'] || row['hari'] || '').trim();
          const jamKe = Number(row['Jam Ke'] || row['jam_ke'] || 1);
          const waktuMulai = String(row['Waktu Mulai'] || row['waktu_mulai'] || '07:00').slice(0, 5);
          const waktuSelesai = String(row['Waktu Selesai'] || row['waktu_selesai'] || '07:30').slice(0, 5);

          const inputGuru = String(row['Nama Guru'] || row['Guru'] || row['guru'] || '').trim().toLowerCase();
          const inputKelas = String(row['Nama Kelas'] || row['Kelas'] || row['kelas'] || '').trim().toLowerCase();
          const inputMapel = String(row['Nama Mapel'] || row['Mapel'] || row['mapel'] || '').trim().toLowerCase();

          // Match Relasi Database
          const foundGuru = gurus.find((g) => g.nama_lengkap.trim().toLowerCase() === inputGuru);
          const foundKelas = kelasList.find((k) => k.nama_kelas.trim().toLowerCase() === inputKelas);
          const foundMapel = mapelList.find((m) => m.nama_mapel.trim().toLowerCase() === inputMapel);

          // Format Hari Validation
          const isValidHari = HARI_OPTIONS.includes(rawHari as HariMinggu);

          if (!foundGuru || !foundKelas || !isValidHari) {
            skipped++;
            continue;
          }

          payloadInsert.push({
            hari: rawHari as HariMinggu,
            jam_ke: jamKe,
            waktu_mulai: waktuMulai,
            waktu_selesai: waktuSelesai,
            guru_id: foundGuru.id,
            kelas_id: foundKelas.id,
            mapel_id: foundMapel ? foundMapel.id : null,
          });
        }

        if (payloadInsert.length === 0) {
          showToast(
            'error',
            'Tidak ada data yang valid. Pastikan nama Hari, Guru, dan Kelas sesuai dengan data di sistem.'
          );
          setImporting(false);
          return;
        }

        const { error } = await supabase.from('jadwal_kbmjps').insert(payloadInsert);

        if (error) {
          showToast('error', 'Gagal meng-import jadwal: ' + error.message);
        } else {
          showToast(
            'success',
            `Berhasil meng-import ${payloadInsert.length} data jadwal!` +
              (skipped > 0 ? ` (${skipped} baris diabaikan karena data tidak sesuai)` : '')
          );
          setImportModalOpen(false);
          fetchData();
        }
      } catch (err: any) {
        showToast('error', 'Gagal memproses file: ' + err.message);
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-400 mb-2" size={36} />
        <p className="text-sm text-slate-400 font-medium">Memuat jadwal KBM JPS...</p>
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
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Jadwal KBM JPS</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Kelola jadwal Jam Pelajaran Sekolah (JPS) secara terintegrasi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2.5 rounded-xl border border-slate-700 transition-all duration-200 cursor-pointer text-sm"
          >
            <FileSpreadsheet size={18} className="text-emerald-400" /> Import Datasheet
          </button>

          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all duration-200 cursor-pointer text-sm"
          >
            <Plus size={18} /> Tambah Jadwal JPS
          </button>
        </div>
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
                <th className="px-4 py-3.5 text-center">Jam Ke</th>
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
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <CalendarDays size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400">Tidak ada jadwal KBM JPS ditemukan</p>
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

                    {/* Jam Ke Badge */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700">
                        {item.jam_ke}
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
        title={editingId ? 'Edit Jadwal KBM JPS' : 'Tambah Jadwal KBM JPS'}
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                <Hash size={13} /> Jam Ke-
              </label>
              <input
                type="number"
                min={1}
                value={form.jam_ke}
                onChange={(e) => setForm({ ...form, jam_ke: parseInt(e.target.value) || 1 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                placeholder="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Guru
            </label>
            <select
              value={form.guru_id}
              onChange={(e) => setForm({ ...form, guru_id: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="" className="bg-slate-900 text-slate-400">Pilih Guru Pengajar</option>
              {gurus.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900 text-slate-200">
                  {g.nama_lengkap}
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
              Mata Pelajaran <span className="text-slate-500 font-normal lowercase">(opsional)</span>
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

      {/* Modal Import Datasheet */}
      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Import Jadwal KBM JPS dari Datasheet"
        size="md"
      >
        <div className="space-y-5 pt-1">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Petunjuk Format File Excel / CSV:</p>
            <p>1. Header kolom wajib berisi: <code className="text-indigo-400">Hari</code>, <code className="text-indigo-400">Jam Ke</code>, <code className="text-indigo-400">Waktu Mulai</code>, <code className="text-indigo-400">Waktu Selesai</code>, <code className="text-indigo-400">Nama Guru</code>, <code className="text-indigo-400">Nama Kelas</code>, dan <code className="text-indigo-400">Nama Mapel</code>.</p>
            <p>2. Kolom <strong>Nama Guru</strong> dan <strong>Nama Kelas</strong> harus persis dengan data di database agar terhubung otomatis.</p>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
            >
              <Download size={14} /> Unduh Format Template Excel
            </button>
          </div>

          <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-slate-950 transition-all rounded-xl p-8 text-center flex flex-col items-center justify-center">
            {importing ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 size={32} className="animate-spin text-indigo-400" />
                <p className="text-xs font-medium">Memproses data dari datasheet...</p>
              </div>
            ) : (
              <>
                <FileSpreadsheet size={40} className="text-emerald-400 mb-2 opacity-80" />
                <p className="text-sm font-medium text-slate-200 mb-1">
                  Pilih file .xlsx, .xls, atau .csv
                </p>
                <p className="text-xs text-slate-500 mb-4">Maksimal ukuran file 5MB</p>
                <label className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all cursor-pointer">
                  <Upload size={14} /> Unggah File
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setImportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Jadwal JPS"
        message="Apakah Anda yakin ingin menghapus jadwal KBM JPS ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}