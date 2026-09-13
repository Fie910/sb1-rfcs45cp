import { useEffect, useState, useMemo } from 'react';
import { Loader2, ClipboardList, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ExportImportButtons } from '@/components/ExportImportButtons';
import { SearchableSelect } from '@/components/SearchableSelect';
import { showToast } from '@/components/Toast';
import type { NilaiWithRelations, Kelas } from '@/types/database';

const HEADERS = [
  'NISN',
  'Nama Siswa',
  'Kelas',
  'Mata Pelajaran',
  'Jenis Penilaian',
  'Nilai',
  'Semester',
  'Tahun Ajaran',
];

export function RekapNilaiPage() {
  const [list, setList] = useState<NilaiWithRelations[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKelas, setFilterKelas] = useState('');
  const [filterMapel, setFilterMapel] = useState('');

  // Fetch daftar kelas hanya sekali di awal
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('kelas')
        .select('*')
        .order('nama_kelas');
      setKelasList((data as Kelas[]) ?? []);
    })();
  }, []);

  // Fetch data nilai setiap filter berubah
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      let query = supabase
        .from('nilais')
        .select(
          '*, siswas(id, nama_lengkap, nisn, kelas(id, nama_kelas)), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)'
        )
        .order('created_at', { ascending: false });

      if (filterMapel) {
        query = query.ilike('mata_pelajaran', `%${filterMapel}%`);
      }

      const { data, error } = await query;
      if (cancelled) return;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [filterKelas, filterMapel]);

  // Refresh manual setelah import
  const refreshData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nilais')
      .select(
        '*, siswas(id, nama_lengkap, nisn, kelas(id, nama_kelas)), gurus(id, nama_lengkap), mata_pelajarans(id, nama_mapel)'
      )
      .order('created_at', { ascending: false });

    let filtered = (data as NilaiWithRelations[]) ?? [];
    if (filterKelas) {
      filtered = filtered.filter((n) => n.siswas?.kelas?.id === filterKelas);
    }
    setList(filtered);
    setLoading(false);
  };

  const rows = useMemo(
    () =>
      list.map((n) => [
        n.siswas?.nisn ?? '-',
        n.siswas?.nama_lengkap ?? '-',
        n.siswas?.kelas?.nama_kelas ?? '-',
        n.mata_pelajarans?.nama_mapel ?? n.mata_pelajaran ?? '-',
        n.jenis_penilaian,
        n.nilai,
        n.semester,
        n.tahun_ajaran,
      ]),
    [list]
  );

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
    await refreshData();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Rekap Nilai Siswa</h1>
        <p className="text-slate-400 mt-1">
          Rekap nilai siswa berdasarkan kelas dan mata pelajaran
        </p>
      </div>

      {/* Filter Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Filter Kelas
            </label>
            <SearchableSelect
              options={kelasList.map((k) => ({
                value: k.id,
                label: k.nama_kelas,
              }))}
              value={filterKelas}
              onChange={setFilterKelas}
              placeholder="Semua Kelas"
              searchPlaceholder="Cari kelas..."
              emptyMessage="Kelas tidak ditemukan"
            />
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Cari Mata Pelajaran
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={filterMapel}
                onChange={(e) => setFilterMapel(e.target.value)}
                placeholder="Cari mata pelajaran..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {(filterKelas || filterMapel) && (
            <button
              onClick={() => {
                setFilterKelas('');
                setFilterMapel('');
              }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reset Filter
            </button>
          )}

          <div className="ml-auto text-xs text-slate-500 font-medium">
            Total: <span className="text-indigo-400 font-bold">{list.length}</span> record
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
        {/* Header + Export */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-wrap gap-3 bg-slate-950/40">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ClipboardList size={20} className="text-indigo-400" />
            Data Nilai
          </h2>
          <ExportImportButtons
            filename="rekap_nilai_siswa"
            title="Rekap Nilai Siswa"
            headers={HEADERS}
            rows={rows}
            onImport={handleImport}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={HEADERS.length} className="text-center py-12">
                    <Loader2 className="animate-spin text-indigo-400 mx-auto" size={24} />
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    className="text-center py-12 text-slate-500"
                  >
                    <ClipboardList size={36} className="mx-auto mb-2 opacity-40" />
                    <p>Tidak ada data nilai.</p>
                  </td>
                </tr>
              ) : (
                list.map((n) => {
                  const nilaiNum = Number(n.nilai);
                  const nilaiColor =
                    nilaiNum >= 75
                      ? 'text-emerald-400'
                      : nilaiNum >= 60
                      ? 'text-amber-400'
                      : 'text-rose-400';

                  return (
                    <tr
                      key={n.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {n.siswas?.nisn ?? '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {n.siswas?.nama_lengkap ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {n.siswas?.kelas?.nama_kelas ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {n.mata_pelajarans?.nama_mapel ?? n.mata_pelajaran ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {n.jenis_penilaian}
                      </td>
                      <td className={`px-4 py-3 font-bold ${nilaiColor}`}>
                        {n.nilai}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{n.semester}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {n.tahun_ajaran}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}