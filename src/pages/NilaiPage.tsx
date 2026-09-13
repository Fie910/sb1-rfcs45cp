import { useEffect, useState } from 'react';
import { ClipboardList, Loader2, Save, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/Modal';
import { SearchableSelect } from '@/components/SearchableSelect';
import type { Kelas, Siswa, NilaiWithRelations, MataPelajaran } from '@/types/database';

const JENIS_PENILAIAN = ['Tugas', 'UH', 'UTS', 'UAS'];
const SEMESTER = ['Ganjil', 'Genap'];
const TAHUN_AJARAN = ['2025/2026', '2024/2025', '2026/2027'];

export function NilaiPage() {
  const { guru } = useAuth();
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [selectedSiswa, setSelectedSiswa] = useState('');
  const [nilaiList, setNilaiList] = useState<NilaiWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    mapel_id: '',
    jenis_penilaian: 'Tugas',
    nilai: '',
    semester: 'Ganjil',
    tahun_ajaran: '2025/2026',
  });

  const [deleteTarget, setDeleteTarget] = useState<NilaiWithRelations | null>(null);

  useEffect(() => {
    (async () => {
      const [kelasRes, mapelRes] = await Promise.all([
        supabase.from('kelas').select('*').order('nama_kelas'),
        supabase.from('mata_pelajarans').select('*').order('nama_mapel'),
      ]);
      setKelasList(kelasRes.data as Kelas[]);
      setMapelList(mapelRes.data as MataPelajaran[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (guru && guru.mapel_id && !form.mapel_id) {
      setForm((f) => ({ ...f, mapel_id: guru.mapel_id! }));
    }
  }, [guru]);

  useEffect(() => {
    if (!selectedKelas) {
      setSiswaList([]);
      setSelectedSiswa('');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('siswas')
        .select('*')
        .eq('kelas_id', selectedKelas)
        .order('nama_lengkap');
      setSiswaList(data as Siswa[]);
      setSelectedSiswa('');
    })();
  }, [selectedKelas]);

  useEffect(() => {
    if (!selectedSiswa) {
      setNilaiList([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('nilais')
        .select('*, siswas(id, nama_lengkap, nisn), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)')
        .eq('siswa_id', selectedSiswa)
        .order('created_at', { ascending: false });
      setNilaiList(data as NilaiWithRelations[]);
    })();
  }, [selectedSiswa]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiswa || !guru) {
      showToast('error', 'Pilih kelas dan siswa terlebih dahulu');
      return;
    }
    const nilaiNum = parseFloat(form.nilai);
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      showToast('error', 'Nilai harus antara 0-100');
      return;
    }
    if (!form.mapel_id) {
      showToast('error', 'Mata pelajaran harus dipilih');
      return;
    }

    const mapel = mapelList.find((m) => m.id === form.mapel_id);
    setSaving(true);
    const { error } = await supabase.from('nilais').insert({
      siswa_id: selectedSiswa,
      guru_id: guru.id,
      mapel_id: form.mapel_id,
      mata_pelajaran: mapel?.nama_mapel ?? '',
      jenis_penilaian: form.jenis_penilaian,
      nilai: nilaiNum,
      semester: form.semester,
      tahun_ajaran: form.tahun_ajaran,
    });

    if (error) {
      showToast('error', 'Gagal menyimpan nilai: ' + error.message);
    } else {
      showToast('success', 'Nilai berhasil disimpan');
      setForm({ ...form, nilai: '' });
      const { data } = await supabase
        .from('nilais')
        .select('*, siswas(id, nama_lengkap, nisn), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)')
        .eq('siswa_id', selectedSiswa)
        .order('created_at', { ascending: false });
      setNilaiList(data as NilaiWithRelations[]);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('nilais').delete().eq('id', deleteTarget.id);
    if (error) {
      showToast('error', 'Gagal menghapus: ' + error.message);
    } else {
      showToast('success', 'Nilai berhasil dihapus');
      setNilaiList(nilaiList.filter((n) => n.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const getMapelName = (n: NilaiWithRelations): string =>
    n.mata_pelajarans?.nama_mapel ?? n.mata_pelajaran ?? '-';

  const filteredNilai = nilaiList.filter(
    (n) =>
      getMapelName(n).toLowerCase().includes(search.toLowerCase()) ||
      n.jenis_penilaian.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Input Nilai Siswa</h1>
        <p className="text-slate-400 mt-1">Pilih kelas, pilih siswa, lalu input nilai</p>
      </div>

      {/* STEP 1: Pilih Kelas */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
            1
          </span>
          <h2 className="font-semibold text-slate-200">Pilih Kelas</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {kelasList.length === 0 ? (
            <p className="text-slate-500 text-sm col-span-full">
              Belum ada kelas. Tambahkan kelas di halaman Data Kelas.
            </p>
          ) : (
            kelasList.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelectedKelas(k.id)}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                  selectedKelas === k.id
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {k.nama_kelas}
              </button>
            ))
          )}
        </div>
      </div>

      {/* STEP 2: Pilih Siswa */}
      {selectedKelas && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            <h2 className="font-semibold text-slate-200">Pilih Siswa</h2>
          </div>
          {siswaList.length === 0 ? (
            <p className="text-slate-500 text-sm">Belum ada siswa di kelas ini.</p>
          ) : (
            <div className="max-w-md">
              <SearchableSelect
                options={siswaList.map((s) => ({
                  value: s.id,
                  label: s.nama_lengkap,
                  hint: s.nisn ? `NISN: ${s.nisn}` : undefined,
                }))}
                value={selectedSiswa}
                onChange={setSelectedSiswa}
                placeholder="Pilih siswa..."
                searchPlaceholder="Cari nama atau NISN..."
                emptyMessage="Siswa tidak ditemukan"
              />
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Form Input + Riwayat */}
      {selectedSiswa && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form Input */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </span>
              <h2 className="font-semibold text-slate-200">Input Nilai</h2>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Mata Pelajaran
                </label>
                <SearchableSelect
                  options={mapelList.map((m) => ({
                    value: m.id,
                    label: m.nama_mapel,
                  }))}
                  value={form.mapel_id}
                  onChange={(v) => setForm({ ...form, mapel_id: v })}
                  placeholder="Pilih mata pelajaran..."
                  searchPlaceholder="Cari mata pelajaran..."
                  emptyMessage="Mapel tidak ditemukan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Jenis Penilaian
                  </label>
                  <select
                    value={form.jenis_penilaian}
                    onChange={(e) =>
                      setForm({ ...form, jenis_penilaian: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {JENIS_PENILAIAN.map((j) => (
                      <option key={j} value={j} className="bg-slate-900">
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nilai (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.nilai}
                    onChange={(e) => setForm({ ...form, nilai: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                    placeholder="85"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Semester
                  </label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm({ ...form, semester: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {SEMESTER.map((s) => (
                      <option key={s} value={s} className="bg-slate-900">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Tahun Ajaran
                  </label>
                  <select
                    value={form.tahun_ajaran}
                    onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    {TAHUN_AJARAN.map((t) => (
                      <option key={t} value={t} className="bg-slate-900">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Simpan Nilai
              </button>
            </form>
          </div>

          {/* Riwayat Nilai */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-200">Riwayat Nilai</h2>
              <div className="relative w-40">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>
            {filteredNilai.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada nilai tersimpan.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {filteredNilai.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">
                        {getMapelName(n)} - {n.jenis_penilaian}
                      </p>
                      <p className="text-xs text-slate-400">
                        {n.semester} {n.tahun_ajaran} - {n.gurus?.nama_lengkap ?? ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-lg font-bold ${
                          n.nilai >= 75
                            ? 'text-emerald-400'
                            : n.nilai >= 60
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {n.nilai}
                      </span>
                      <button
                        onClick={() => setDeleteTarget(n)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Hapus Nilai"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Nilai"
        message="Yakin ingin menghapus nilai ini?"
      />
    </div>
  );
}