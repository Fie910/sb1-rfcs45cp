import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Calendar, UserPlus, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCanAccess } from '@/hooks/useCanAccess';

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function JadwalPiketPenyambutanPage() {
  const canAccess = useCanAccess('piket');
  const [selectedHari, setSelectedHari] = useState<string>('Senin');
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [guruList, setGuruList] = useState<any[]>([]);
  const [selectedGuruId, setSelectedGuruId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchJadwal = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jadwal_piket_penyambutans')
      .select('id, hari, guru_id, gurus(id, nama_lengkap, nip)')
      .eq('hari', selectedHari)
      .order('created_at', { ascending: true });

    setJadwalList(data ?? []);
    setLoading(false);
  }, [selectedHari]);

  const fetchGuru = useCallback(async () => {
    const { data } = await supabase
      .from('gurus')
      .select('id, nama_lengkap, nip')
      .order('nama_lengkap', { ascending: true });
    setGuruList(data ?? []);
  }, []);

  useEffect(() => {
    if (canAccess) {
      fetchJadwal();
      fetchGuru();
    }
  }, [canAccess, fetchJadwal, fetchGuru]);

  const handleTambahJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGuruId) return;

    setSaving(true);
    const { error } = await supabase.from('jadwal_piket_penyambutans').insert([
      { guru_id: selectedGuruId, hari: selectedHari }
    ]);

    if (error) {
      alert(error.message.includes('unique') ? 'Guru sudah ada di jadwal hari ini!' : error.message);
    } else {
      setSelectedGuruId('');
      fetchJadwal();
    }
    setSaving(false);
  };

  const handleHapusJadwal = async (id: number) => {
    if (!confirm('Hapus guru dari jadwal piket penyambutan?')) return;
    await supabase.from('jadwal_piket_penyambutans').delete().eq('id', id);
    fetchJadwal();
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="text-rose-400 mb-3" size={40} />
        <h2 className="text-xl font-bold text-slate-100">Akses Ditolak</h2>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100">Jadwal Piket Penyambutan</h1>
        <p className="text-slate-400 text-sm">Kelola penugasan guru penyambut siswa tiap hari</p>
      </div>

      {/* Selector Hari */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {HARI_LIST.map((hari) => (
          <button
            key={hari}
            onClick={() => setSelectedHari(hari)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedHari === hari
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {hari}
          </button>
        ))}
      </div>

      {/* Form Tambah Guru */}
      <form onSubmit={handleTambahJadwal} className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <select
          value={selectedGuruId}
          onChange={(e) => setSelectedGuruId(e.target.value)}
          className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500"
          required
        >
          <option value="">-- Pilih Guru untuk Hari {selectedHari} --</option>
          {guruList.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nama_lengkap} {g.nip ? `(${g.nip})` : ''}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          <span>Tambah ke Jadwal</span>
        </button>
      </form>

      {/* Tabel Guru Piket */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-400" />
          <h2 className="font-bold text-slate-200 text-sm">Petugas Penyambutan Hari {selectedHari}</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="animate-spin mx-auto mb-2 text-indigo-400" size={24} />
            <p className="text-xs">Memuat daftar petugas...</p>
          </div>
        ) : jadwalList.length === 0 ? (
          <p className="py-8 text-center text-slate-500 text-xs">Belum ada guru yang dijadwalkan pada hari {selectedHari}.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {jadwalList.map((j, idx) => (
              <div key={j.id} className="p-4 flex items-center justify-between hover:bg-slate-950/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{j.gurus?.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-500">NIP: {j.gurus?.nip ?? '-'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleHapusJadwal(j.id)}
                  className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  title="Hapus Guru"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}