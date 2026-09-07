import { supabase } from '../lib/supabase'; // Sesuaikan path client Supabase Anda
import { StatusAkhirRiwayat, StatusSiswa } from '../types/database';

export interface SiswaProsesKenaikan {
  siswa_id: string;
  kelas_tujuan_id: string; // ID kelas baru (atau kelas yang sama jika tinggal kelas)
  status_akhir: StatusAkhirRiwayat; // 'NAIK_KELAS' atau 'TINGGAL_KELAS'
  catatan?: string;
}

export const akademikService = {
  // 1. Ambil Tahun Ajaran Aktif
  async getTahunAjaranAktif() {
    const { data, error } = await supabase
      .from('tahun_ajarans')
      .select('*')
      .eq('is_aktif', true)
      .single();

    if (error) throw error;
    return data;
  },

  // 2. Proses Kolektif Kenaikan / Tinggal Kelas
  async prosesKenaikanKelas(
    tahunAjaranId: string,
    daftarSiswa: SiswaProsesKenaikan[]
  ) {
    // A. Update kelas_id di tabel siswas untuk tiap siswa
    for (const item of daftarSiswa) {
      const { error: updateError } = await supabase
        .from('siswas')
        .update({ kelas_id: item.kelas_tujuan_id })
        .eq('id', item.siswa_id);

      if (updateError) throw updateError;
    }

    // B. Catat ke tabel riwayat_kelas_siswas
    const payloadRiwayat = daftarSiswa.map((item) => ({
      siswa_id: item.siswa_id,
      kelas_id: item.kelas_tujuan_id,
      tahun_ajaran_id: tahunAjaranId,
      status_akhir: item.status_akhir,
      catatan: item.catatan || null,
    }));

    const { data, error: insertError } = await supabase
      .from('riwayat_kelas_siswas')
      .insert(payloadRiwayat);

    if (insertError) throw insertError;
    return data;
  },

  // 3. Proses Kelulusan Massal (Ubah Siswa Menjadi Alumni)
  async prosesKelulusan(
    tahunAjaranId: string,
    siswaIds: string[],
    kelasAsalId: string
  ) {
    // A. Update status siswa menjadi ALUMNI dan kosongkan kelas_id
    const { error: updateError } = await supabase
      .from('siswas')
      .update({
        status: 'ALUMNI' as StatusSiswa,
        kelas_id: null,
      })
      .in('id', siswaIds);

    if (updateError) throw updateError;

    // B. Catat riwayat akhir kelulusan
    const payloadRiwayat = siswaIds.map((id) => ({
      siswa_id: id,
      kelas_id: kelasAsalId,
      tahun_ajaran_id: tahunAjaranId,
      status_akhir: 'LULUS' as StatusAkhirRiwayat,
      catatan: 'Dinyatakan Lulus / Alumni',
    }));

    const { data, error: insertError } = await supabase
      .from('riwayat_kelas_siswas')
      .insert(payloadRiwayat);

    if (insertError) throw insertError;
    return data;
  },

  // 4. Proses Siswa Keluar / Mutasi / Drop Out
  async prosesSiswaKeluar(
    siswaId: string,
    kelasTerakhirId: string,
    tahunAjaranId: string,
    statusBaru: 'MUTASI_KELUAR' | 'DROP_OUT',
    alasan: string
  ) {
    // A. Ubah status siswa & lepas dari kelas
    const { error: updateError } = await supabase
      .from('siswas')
      .update({
        status: statusBaru as StatusSiswa,
        kelas_id: null,
      })
      .eq('id', siswaId);

    if (updateError) throw updateError;

    // B. Catat ke riwayat
    const { data, error: insertError } = await supabase
      .from('riwayat_kelas_siswas')
      .insert({
        siswa_id: siswaId,
        kelas_id: kelasTerakhirId,
        tahun_ajaran_id: tahunAjaranId,
        status_akhir: statusBaru === 'MUTASI_KELUAR' ? 'MUTASI' : 'DROP_OUT',
        catatan: alasan,
      });

    if (insertError) throw insertError;
    return data;
  },

  // 5. Ambil Timeline / Rekam Jejak Historis Siswa
  async getRiwayatSiswa(siswaId: string) {
    const { data, error } = await supabase
      .from('riwayat_kelas_siswas')
      .select(`
        id,
        status_akhir,
        catatan,
        created_at,
        kelas:kelas_id (id, nama_kelas),
        tahun_ajaran:tahun_ajaran_id (tahun, semester)
      `)
      .eq('siswa_id', siswaId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },
};