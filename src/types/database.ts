export type GuruRole = string;

export type MataPelajaran = {
  id: string;
  nama_mapel: string;
  created_at: string;
};

export interface Divisi {
  id: string;
  nama_divisi: string;
}

export type Guru = {
  id: string;
  nip: string | null;
  nama_lengkap: string;
  email: string;
  role: GuruRole;
  divisi_id: string | null;
  divisis?: Divisi | null;
  mata_pelajaran?: string | null;
  mapel_id?: string | null;
  jabatan?: string | null;
  created_at?: string;
};

export type GuruWithMapel = Guru & {
  mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
};

export type Kelas = {
  id: string;
  nama_kelas: string;
  wali_kelas_id: string | null;
  created_at: string;
};

// --- Tipe Data Baru untuk Sistem Kenaikan Kelas & Alumni ---
export type StatusSiswa = 'AKTIF' | 'ALUMNI' | 'MUTASI_KELUAR' | 'DROP_OUT';
export type StatusAkhirRiwayat = 'AKTIF' | 'NAIK_KELAS' | 'TINGGAL_KELAS' | 'LULUS' | 'MUTASI' | 'DROP_OUT';

export type Siswa = {
  id: string;
  nisn: string;
  nama_lengkap: string;
  jenis_kelamin: 'L' | 'P';
  kelas_id: string | null;
  status: StatusSiswa;
  created_at: string;
};

export type TahunAjaran = {
  id: string;
  tahun: string; // Contoh: '2025/2026'
  semester: 'Ganjil' | 'Genap';
  is_aktif: boolean;
  created_at: string;
};

export type RiwayatKelasSiswa = {
  id: string;
  siswa_id: string;
  kelas_id: string;
  tahun_ajaran_id: string;
  status_akhir: StatusAkhirRiwayat;
  catatan: string | null;
  created_at: string;
};

export type Nilai = {
  id: string;
  siswa_id: string;
  guru_id: string;
  mata_pelajaran: string;
  mapel_id: string | null;
  jenis_penilaian: string;
  nilai: number;
  semester: string;
  tahun_ajaran: string;
  created_at: string;
};

export type Presensi = {
  id: string;
  siswa_id: string;
  guru_id: string | null;
  tanggal: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  keterangan: string | null;
  created_at: string;
};

export type SiswaWithKelas = Siswa & {
  kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
};

export type KelasWithWali = Kelas & {
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type NilaiWithRelations = Nilai & {
  siswas: (Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  }) | null;
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
};

export type PresensiWithSiswa = Presensi & {
  siswas: (Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  }) | null;
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type RiwayatKelasSiswaWithRelations = RiwayatKelasSiswa & {
  siswas: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn' | 'status'> | null;
  kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  tahun_ajarans: Pick<TahunAjaran, 'id' | 'tahun' | 'semester'> | null;
};

export type HariMinggu = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';

export type JadwalKbm = {
  id: string;
  guru_id: string;
  hari: HariMinggu;
  jam_ke: number;
  kelas_id: string;
  mata_pelajaran: string;
  mapel_id: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  created_at: string;
};

export type JadwalKbmWithRelations = JadwalKbm & {
  kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
};

export type AgendaGuru = {
  id: string;
  guru_id: string;
  jadwal_kbm_id: string | null;
  tanggal: string;
  status_kehadiran: 'Hadir' | 'Tidak Hadir' | 'Hadir Mengajar' | 'Terlambat';
  catatan_materi: string | null;
  latitude_guru: number | null;
  longitude_guru: number | null;
  jarak_dari_sekolah: number | null;
  menit_terlambat: number;
  alpa_jam_pelajaran: number;
  created_at: string;
};

export type AgendaGuruWithRelations = AgendaGuru & {
  jadwal_kbms: (Pick<JadwalKbm, 'id' | 'jam_ke' | 'mata_pelajaran' | 'waktu_mulai' | 'waktu_selesai'> & {
    kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
    mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
  }) | null;
  gurus?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type JadwalPiket = {
  id: string;
  guru_id: string;
  hari_piket: HariMinggu;
  created_at: string;
};

export type JadwalPiketWithRelations = JadwalPiket & {
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type KategoriIzin = 'Sakit' | 'Izin';

export type IzinGuruPiket = {
  id: string;
  guru_izin_id: string;
  tanggal_izin: string;
  alasan_izin: string;
  kategori_izin: KategoriIzin | null;
  keterangan_izin: string | null;
  titipan_tugas: string;
  kelas_id: string;
  mata_pelajaran: string;
  mapel_id: string | null;
  status_penanganan: 'Menunggu' | 'Ditangani';
  guru_piket_id: string | null;
  status_penyampaian: 'Belum Disampaikan' | 'Sudah Disampaikan';
  waktu_penyampaian: string | null;
  created_at: string;
};

export type IzinGuruPiketWithRelations = IzinGuruPiket & {
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  kelas: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  guru_piket: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
};

export type PengaturanSekolah = {
  id: string;
  nama_sekolah: string;
  latitude: number;
  longitude: number;
  radius_meter: number;
  created_at: string;
  updated_at: string;
};

export type Pengumuman = {
  id: string;
  judul: string;
  isi: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  is_aktif: boolean;
  gambar_url?: string | null;
  url?: string | null;
  created_at: string;
};

// Tabel Pendukung Pengaturan Hak Akses Role
export type Role = {
  id: number;
  kode_role: string;
  nama_role: string;
  keterangan: string | null;
  created_at?: string;
};

export type RolePermission = {
  id: number;
  role_code: string;
  menu_id: number;
  can_access: boolean;
  created_at?: string;
};

export interface RencanaKegiatan {
  id?: string;
  nama_kegiatan: string;
  tanggal_mulai: string;
  tanggal_selesai?: string | null;
  penanggung_jawab: string;
  peserta: string;
  deskripsi?: string | null;
  status?: string;
  created_at?: string;
}

export type JadwalPiketPenyambutan = {
  id: string;
  guru_id: string;
  hari: string;
  created_at?: string;
  gurus?: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'> | null;
};

export type KehadiranPiketPenyambutan = {
  id: string;
  guru_id: string;
  tanggal: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | string;
  status_kehadiran?: string;
  waktu_absen?: string | null;
  waktu_presensi?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  jarak_meter?: number | null;
  menit_keterlambatan?: number | null;
  catatan?: string | null;
  created_at: string;
  gurus?: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'> | null;
};

// --- BUKU TAMU & NOTIFIKASI ---
export type StatusBukuTamu = 'menunggu' | 'bertemu' | 'selesai' | 'dibatalkan';

export interface BukuTamu {
  id: string;
  nama_tamu: string;
  instansi: string | null;
  no_hp: string | null;
  guru_id: string | null;
  divisi_id: string | null;
  siswa_id: number | null;
  kategori: string;
  keperluan: string;
  foto_url: string | null;
  tanda_tangan_url: string | null;
  waktu_masuk: string;
  waktu_keluar: string | null;
  status: StatusBukuTamu;
  created_at: string;
}

export interface BukuTamuWithRelations extends BukuTamu {
  gurus?: { id: string; nama_lengkap: string } | null;
  divisis?: { id: string; nama_divisi: string } | null;
  siswas?: { id: number; nama_lengkap: string; nisn: string } | null;
}

export interface Notifikasi {
  id: string;
  guru_id: string;
  judul: string;
  pesan: string;
  tipe: string;
  tautan: string | null;
  dibaca: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  guru_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}