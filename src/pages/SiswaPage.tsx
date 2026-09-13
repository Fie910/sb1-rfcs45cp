import { useEffect, useState, useMemo, ChangeEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Search,
  User,
  GraduationCap,
  Filter,
  X,
  FileSpreadsheet,
  Upload,
  Download,
  Hash,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal, ConfirmModal } from '@/components/Modal';
import type { SiswaWithKelas, Kelas } from '@/types/database';

const emptyForm = {
  nisn: '',
  nama_lengkap: '',
  jenis_kelamin: 'L' as 'L' | 'P',
  kelas_id: '',
};

export function SiswaPage() {
  const [siswaList, setSiswaList] = useState<SiswaWithKelas[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKelas, setSelectedKelas] = useState<string>('semua');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SiswaWithKelas | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [siswaRes, kelasRes] = await Promise.all([
      supabase
        .from('siswas')
        .select('*, kelas(id, nama_kelas)')
        .order('nama_lengkap', { ascending: true }),
      supabase.from('kelas').select('*').order('nama_kelas', { ascending: true }),
    ]);

    if (siswaRes.error) {
      showToast('error', 'Gagal memuat data siswa: ' + siswaRes.error.message);
    } else {
      setSiswaList((siswaRes.data as SiswaWithKelas[]) || []);
    }

    if (kelasRes.error) {
      showToast('error', 'Gagal memuat data kelas: ' + kelasRes.error.message);
    } else {
      setKelasList((kelasRes.data as Kelas[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredList = useMemo(() => {
    return siswaList.filter((item) => {
      const matchesKelas =
        selectedKelas === 'semua' || String(item.kelas_id) === selectedKelas;
      const query = searchQuery.toLowerCase();
      const nama = item.nama_lengkap.toLowerCase();
      const nisn = item.nisn.toLowerCase();
      const kelasName = item.kelas?.nama_kelas?.toLowerCase() || '';

      const matchesSearch =
        nama.includes(query) || nisn.includes(query) || kelasName.includes(query);

      return matchesKelas && matchesSearch;
    });
  }, [siswaList, selectedKelas, searchQuery]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: SiswaWithKelas) => {
    setEditingId(item.id);
    setForm({
      nisn: item.nisn || '',
      nama_lengkap: item.nama_lengkap || '',
      jenis_kelamin: item.jenis_kelamin || 'L',
      kelas_id: item.kelas_id ? String(item.kelas_id) : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nisn.trim()) {
      showToast('error', 'NISN wajib diisi');
      return;
    }
    if (!form.nama_lengkap.trim()) {
      showToast('error', 'Nama lengkap wajib diisi');
      return;
    }
    if (!form.kelas_id) {
      showToast('error', 'Kelas wajib dipilih');
      return;
    }

    setSaving(true);

    const payload = {
      nisn: form.nisn.trim(),
      nama_lengkap: form.nama_lengkap.trim(),
      jenis_kelamin: form.jenis_kelamin,
      kelas_id: form.kelas_id,
    };

    let result;
    if (editingId) {
      result = await supabase.from('siswas').update(payload).eq('id', editingId);
    } else {
      result = await supabase.from('siswas').insert(payload);
    }

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      showToast(
        'success',
        editingId ? 'Data siswa berhasil diperbarui' : 'Siswa baru berhasil ditambahkan'
      );
      setModalOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('siswas').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Data siswa berhasil dihapus');
      fetchData();
    }
    setDeleteTarget(null);
  };

  // --- FITUR IMPORT DATASHEET ---
  const downloadTemplate = () => {
    const templateData = [
      {
        NISN: '0012345678',
        'Nama Lengkap': 'Ahmad Fauzi',
        'Jenis Kelamin': 'L',
        'Nama Kelas': kelasList[0]?.nama_kelas || 'X IPA 1',
      },
      {
        NISN: '0087654321',
        'Nama Lengkap': 'Siti Nurhaliza',
        'Jenis Kelamin': 'P',
        'Nama Kelas': kelasList[0]?.nama_kelas || 'X IPA 1',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
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
          nisn: string;
          nama_lengkap: string;
          jenis_kelamin: 'L' | 'P';
          kelas_id: any;
        }> = [];

        let skipped = 0;

        for (const row of parsedData) {
          const rawNisn = String(row['NISN'] || row['nisn'] || '').trim();
          const rawNama = String(
            row['Nama Lengkap'] || row['Nama'] || row['nama_lengkap'] || row['nama'] || ''
          ).trim();
          const rawJk = String(
            row['Jenis Kelamin'] || row['JK'] || row['jk'] || row['jenis_kelamin'] || 'L'
          )
            .trim()
            .toUpperCase();
          const rawKelas = String(
            row['Nama Kelas'] || row['Kelas'] || row['nama_kelas'] || row['kelas'] || ''
          )
            .trim()
            .toLowerCase();

          const jk: 'L' | 'P' = rawJk.startsWith('P') ? 'P' : 'L';

          // Match Relasi Kelas
          const foundKelas = kelasList.find(
            (k) => k.nama_kelas.trim().toLowerCase() === rawKelas
          );

          if (!rawNisn || !rawNama || !foundKelas) {
            skipped++;
            continue;
          }

          payloadInsert.push({
            nisn: rawNisn,
            nama_lengkap: rawNama,
            jenis_kelamin: jk,
            kelas_id: foundKelas.id,
          });
        }

        if (payloadInsert.length === 0) {
          showToast(
            'error',
            'Tidak ada data yang valid. Pastikan NISN, Nama Lengkap, dan Nama Kelas sesuai dengan data di sistem.'
          );
          setImporting(false);
          return;
        }

        const { error } = await supabase.from('siswas').insert(payloadInsert);

        if (error) {
          showToast('error', 'Gagal meng-import siswa: ' + error.message);
        } else {
          showToast(
            'success',
            `Berhasil meng-import ${payloadInsert.length} data siswa!` +
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
        <p className="text-sm text-slate-400 font-medium">Memuat data siswa...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/15 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Users size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Data Siswa</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Kelola data seluruh siswa dan pembagian kelas secara terintegrasi
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
            <Plus size={18} /> Tambah Siswa
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
            placeholder="Cari nama, NISN, atau kelas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-slate-500 text-slate-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Kelas */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          <Filter size={16} className="text-slate-500 shrink-0 ml-1" />
          <button
            onClick={() => setSelectedKelas('semua')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedKelas === 'semua'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            Semua Kelas
          </button>
          {kelasList.map((k) => (
            <button
              key={k.id}
              onClick={() => setSelectedKelas(String(k.id))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedKelas === String(k.id)
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {k.nama_kelas}
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
                <th className="px-5 py-3.5">NISN</th>
                <th className="px-5 py-3.5">Nama Lengkap</th>
                <th className="px-5 py-3.5">Jenis Kelamin</th>
                <th className="px-5 py-3.5">Kelas</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    <Users size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-400">Tidak ada data siswa ditemukan</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Coba sesuaikan kata kunci atau filter kelas
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* NISN */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {item.nisn}
                      </span>
                    </td>

                    {/* Nama Lengkap */}
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <User size={15} className="text-slate-500 shrink-0" />
                        <span>{item.nama_lengkap}</span>
                      </div>
                    </td>

                    {/* Jenis Kelamin Badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                          item.jenis_kelamin === 'L'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            : 'bg-pink-500/15 text-pink-400 border border-pink-500/20'
                        }`}
                      >
                        {item.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </td>

                    {/* Kelas */}
                    <td className="px-5 py-3.5 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap size={15} className="text-slate-500 shrink-0" />
                        <span className="inline-block bg-indigo-500/15 text-indigo-400 px-2.5 py-0.5 rounded text-xs font-medium border border-indigo-500/20">
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
                          title="Edit Siswa"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Hapus Siswa"
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
        title={editingId ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
              <Hash size={13} /> NISN
            </label>
            <input
              type="text"
              value={form.nisn}
              onChange={(e) => setForm({ ...form, nisn: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              placeholder="Masukkan NISN siswa"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Nama Lengkap
            </label>
            <input
              type="text"
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              placeholder="Nama lengkap siswa"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Jenis Kelamin
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                  form.jenis_kelamin === 'L'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <input
                  type="radio"
                  name="jenis_kelamin"
                  value="L"
                  checked={form.jenis_kelamin === 'L'}
                  onChange={() => setForm({ ...form, jenis_kelamin: 'L' })}
                  className="sr-only"
                />
                Laki-laki
              </label>
              <label
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                  form.jenis_kelamin === 'P'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <input
                  type="radio"
                  name="jenis_kelamin"
                  value="P"
                  checked={form.jenis_kelamin === 'P'}
                  onChange={() => setForm({ ...form, jenis_kelamin: 'P' })}
                  className="sr-only"
                />
                Perempuan
              </label>
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
              <option value="" className="bg-slate-900 text-slate-400">
                Pilih Kelas
              </option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id} className="bg-slate-900 text-slate-200">
                  {k.nama_kelas}
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
        title="Import Data Siswa dari Datasheet"
        size="md"
      >
        <div className="space-y-5 pt-1">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-400">
            <p className="font-semibold text-slate-200">Petunjuk Format File Excel / CSV:</p>
            <p>
              1. Header kolom wajib berisi: <code className="text-indigo-400">NISN</code>,{' '}
              <code className="text-indigo-400">Nama Lengkap</code>,{' '}
              <code className="text-indigo-400">Jenis Kelamin</code> (L/P), dan{' '}
              <code className="text-indigo-400">Nama Kelas</code>.
            </p>
            <p>
              2. Kolom <strong>Nama Kelas</strong> harus persis dengan data kelas yang terdaftar di
              sistem.
            </p>
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
        title="Hapus Data Siswa"
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.nama_lengkap}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}