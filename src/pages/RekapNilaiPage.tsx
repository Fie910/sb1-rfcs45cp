import { useEffect, useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { showToast } from '@/components/Toast';
import type { NilaiWithRelations, Kelas } from '@/types/database';

const HEADERS = ['NISN', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Jenis Penilaian', 'Nilai', 'Semester', 'Tahun Ajaran'];

export function RekapNilaiPage() {
  const [list, setList] = useState<NilaiWithRelations[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('kelas').select('*').order('nama_kelas');
      setKelasList(data as Kelas[]);
      fetchData();
    })();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase
      .from('nilais')
      .select('*, siswas(id, nama_lengkap, nisn, kelas(id, nama_kelas)), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)')
      .order('created_at', { ascending: false });

    if (filterMapel) {
      query = query.ilike('mata_pelajaran', `%${filterMapel}%`);
    }

    const { data, error } = await query;
    if (error) {
      setList([]);
    } else {
      let filtered = data as NilaiWithRelations[];
      if (filterKelas) {
        filtered = filtered.filter((n) => n.siswas?.kelas?.id === filterKelas);
      }
      setList(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [filterKelas, filterMapel]);

  const rows = list.map((n) => [
    n.siswas?.nisn ?? '-',
    n.siswas?.nama_lengkap ?? '-',
    n.siswas?.kelas?.nama_kelas ?? '-',
    n.mata_pelajarans?.nama_mapel ?? n.mata_pelajaran ?? '-',
    n.jenis_penilaian,
    n.nilai,
    n.semester,
    n.tahun_ajaran,
  ]);

  const handleImport = async (data: Record<string, string>[]) => {
    for (const row of data) {
      const { error } = await supabase.from('nilais').insert({
        siswa_id: row['siswa_id'] || row['Siswa ID'] || '',
        guru_id: row['guru_id'] || row['Guru ID'] || '',
        mata_pelajaran: row['mata_pelajaran'] || row['Mata Pelajaran'] || '',
        jenis_penilaian: row['jenis_penilaian'] || row['Jenis Penilaian'] || '',
        nilai: parseFloat(row['nilai'] || row['Nilai'] || '0'),
        semester: row['semester'] || row['Semester'] || '',
        tahun_ajaran: row['tahun_ajaran'] || row['Tahun Ajaran'] || '',
      });
      if (error) {
        showToast('error', `Gagal impor baris: ${error.message}`);
      }
    }
    fetchData();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Rekap Nilai Siswa</h1>
        <p className="text-slate-500 mt-1">Rekap nilai siswa berdasarkan kelas dan mata pelajaran</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Kelas</label>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama_kelas}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mata Pelajaran</label>
            <input
              type="text"
              value={filterMapel}
              onChange={(e) => setFilterMapel(e.target.value)}
              placeholder="Cari mata pelajaran..."
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-600" />
            Data Nilai ({list.length} record)
          </h2>
          <ExportImportButtons
            filename="rekap_nilai_siswa"
            title="Rekap Nilai Siswa"
            headers={HEADERS}
            rows={rows}
            onImport={handleImport}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={HEADERS.length} className="text-center py-12">
                    <Loader2 className="animate-spin text-blue-600 mx-auto" size={24} />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length} className="text-center py-12 text-slate-400">
                    <ClipboardList size={36} className="mx-auto mb-2 opacity-50" />
                    <p>Tidak ada data nilai.</p>
                  </td>
                </tr>
              ) : (
                list.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{n.siswas?.nisn ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{n.siswas?.nama_lengkap ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{n.siswas?.kelas?.nama_kelas ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{n.mata_pelajarans?.nama_mapel ?? n.mata_pelajaran ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{n.jenis_penilaian}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{n.nilai}</td>
                    <td className="px-4 py-3 text-slate-700">{n.semester}</td>
                    <td className="px-4 py-3 text-slate-700">{n.tahun_ajaran}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
