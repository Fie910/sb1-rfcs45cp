export * from './surat';

export type GuruRole = string;

export type MataPelajaran = {
  id: number;
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
  mapel_id?: number | null;
  jabatan?: string | null;
  // HRIS fields (dari SQL migration HRIS)
  tanggal_bergabung?: string | null;
  status_kepegawaian?: string | null;
  jenis_ptk?: string | null;
  created_at?: string;
};

export type GuruWithMapel = Guru & {
  mata_pelajarans: Pick<MataPelajaran, 'id' | 'nama_mapel'> | null;
};

export type Kelas = {
  id: number;
  nama_kelas: string;
  wali_kelas_id: string | null;
  created_at: string;
};

// --- Tipe Data Baru untuk Sistem Kenaikan Kelas & Alumni ---
export type StatusSiswa = 'AKTIF' | 'ALUMNI' | 'MUTASI_KELUAR' | 'DROP_OUT';
export type StatusAkhirRiwayat = 'AKTIF' | 'NAIK_KELAS' | 'TINGGAL_KELAS' | 'LULUS' | 'MUTASI' | 'DROP_OUT';

export type Siswa = {
  id: number;
  nisn: string;
  nama_lengkap: string;
  jenis_kelamin: 'L' | 'P';
  kelas_id: number | null;
  status: StatusSiswa;
  created_at: string;
};

export type TahunAjaran = {
  id: number;
  tahun: string; // Contoh: '2025/2026'
  semester: 'Ganjil' | 'Genap';
  is_aktif: boolean;
  created_at: string;
};

export type RiwayatKelasSiswa = {
  id: number;
  siswa_id: number;
  kelas_id: number;
  tahun_ajaran_id: number;
  status_akhir: StatusAkhirRiwayat;
  catatan: string | null;
  created_at: string;
};

export type Nilai = {
  id: number;
  siswa_id: number;
  guru_id: string;
  mata_pelajaran: string;
  mapel_id: number | null;
  jenis_penilaian: string;
  nilai: number;
  semester: string;
  tahun_ajaran: string;
  created_at: string;
};

export type Presensi = {
  id: number;
  siswa_id: number;
  guru_id: string | null;
  jadwal_kbm_id?: number | null;
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
  id: number;
  guru_id: string;
  hari: HariMinggu;
  jam_ke: number;
  kelas_id: number;
  mata_pelajaran: string;
  mapel_id: number | null;
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
  jadwal_kbm_id: number | null;
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
  id: number;
  guru_id: string;
  hari_piket: HariMinggu;
  created_at: string;
};

export type JadwalPiketWithRelations = JadwalPiket & {
  gurus: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type KategoriIzin = 'Sakit' | 'Izin';

export type IzinGuruPiket = {
  id: number;
  guru_izin_id: string;
  tanggal_izin: string;
  alasan_izin: string;
  kategori_izin: KategoriIzin | null;
  keterangan_izin: string | null;
  titipan_tugas: string;
  kelas_id: number;
  mata_pelajaran: string;
  mapel_id: number | null;
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

export type HariLibur = {
  id: number;
  tanggal: string;
  keterangan: string;
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
  id: number;
  guru_id: string;
  hari: string;
  created_at?: string;
  gurus?: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'> | null;
};

export type KehadiranPiketPenyambutan = {
  id: number;
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

export type KehadiranPiket = {
  id: number;
  jadwal_piket_id?: number | null;
  guru_id: string;
  tanggal: string;
  status: 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa' | null;
  catatan: string | null;
  created_at?: string;
};

export type PresensiGuruPiket = {
  id: number;
  guru_id: string;
  tanggal: string;
  status: string;
  catatan: string | null;
  jadwal_kbmjp_id?: number | null;
  created_at?: string;
};

export type PresensiSiswaKesiswaan = {
  id: number;
  siswa_id: number;
  kelas_id: number;
  tanggal: string;
  status_kehadiran: 'Hadir' | 'Sakit' | 'Izin' | 'Alpa';
  keterangan: string | null;
  created_at?: string;
  updated_at?: string;
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
  is_read: boolean;
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

// =============================================================================
// AUDIT LOG
// =============================================================================

export type AuditAksi =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'VIEW';

export type AuditLog = {
  id: string;
  user_id: string | null;
  user_nama: string | null;
  user_role: string | null;
  aksi: AuditAksi;
  modul: string;
  target_id: string | null;
  deskripsi: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// =============================================================================
// SARAN & PENGADUAN
// =============================================================================

export type SaranPengaduanStatus = 'Baru' | 'Diproses' | 'Selesai' | 'Ditolak';
export type SaranPengaduanPrioritas = 'Rendah' | 'Sedang' | 'Tinggi';
export type SaranPengaduanKategori =
  | 'Sarana Prasarana'
  | 'Akademik'
  | 'Kesiswaan'
  | 'Keuangan'
  | 'Kepegawaian'
  | 'Umum';

export type SaranPengaduan = {
  id: string;
  pelapor_id: string | null;
  is_anonim: boolean;
  kategori: string;
  subjek: string;
  isi: string;
  lampiran_url: string | null;
  status: SaranPengaduanStatus;
  prioritas: SaranPengaduanPrioritas;
  tanggapan: string | null;
  penanggap_id: string | null;
  ditanggapi_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SaranPengaduanWithRelations = SaranPengaduan & {
  pelapor: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  penanggap: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export const KATEGORI_SARAN_PENGADUAN: SaranPengaduanKategori[] = [
  'Sarana Prasarana',
  'Akademik',
  'Kesiswaan',
  'Keuangan',
  'Kepegawaian',
  'Umum',
];

export const STATUS_SARAN_PENGADUAN: SaranPengaduanStatus[] = [
  'Baru',
  'Diproses',
  'Selesai',
  'Ditolak',
];

export const PRIORITAS_SARAN_PENGADUAN: SaranPengaduanPrioritas[] = [
  'Rendah',
  'Sedang',
  'Tinggi',
];

// =============================================================================
// SARANA & PRASARANA
// =============================================================================

export type KategoriSarpras = {
  id: string;
  nama: string;
  icon: string | null;
  created_at: string;
};

export type KondisiAset = 'Baik' | 'Rusak Ringan' | 'Rusak Berat';
export type StatusAset = 'Aktif' | 'Dipinjam' | 'Perbaikan' | 'Hilang' | 'Dihapus';
export type TipeLokasi = 'Gedung' | 'Lantai' | 'Ruang' | 'Area Luar';

export type InventarisLokasi = {
  id: string;
  nama: string;
  tipe: TipeLokasi;
  parent_id: string | null;
  keterangan: string | null;
  created_at: string;
};

export type InventarisSarpras = {
  id: string;
  kode_aset: string;
  nama_aset: string;
  kategori_id: string | null;
  lokasi: string | null;
  lokasi_id: string | null;
  jumlah: number;
  satuan: string;
  kondisi: KondisiAset;
  status: StatusAset;
  nomor_seri: string | null;
  merek: string | null;
  model: string | null;
  vendor: string | null;
  umur_ekonomis_bulan: number | null;
  nilai_residu: number | null;
  pic_id: string | null;
  tanggal_perolehan: string | null;
  sumber_dana: string | null;
  harga_perolehan: number | null;
  keterangan: string | null;
  foto_url: string | null;
  qr_token: string;
  created_at: string;
  updated_at: string;
};

export type InventarisSarprasWithRelations = InventarisSarpras & {
  kategori: Pick<KategoriSarpras, 'id' | 'nama' | 'icon'> | null;
  lokasi_detail: Pick<InventarisLokasi, 'id' | 'nama' | 'tipe'> | null;
  pic: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// =============================================================================
// PEMINJAMAN ASET
// =============================================================================

export type StatusPeminjaman = 'Dipinjam' | 'Dikembalikan' | 'Terlambat' | 'Hilang';

export type InventarisPeminjaman = {
  id: string;
  aset_id: string;
  peminjam_id: string;
  jumlah_dipinjam: number;
  tanggal_pinjam: string;
  tanggal_rencana_kembali: string | null;
  tanggal_kembali: string | null;
  keperluan: string;
  kondisi_saat_pinjam: KondisiAset;
  kondisi_saat_kembali: KondisiAset | null;
  catatan: string | null;
  status: StatusPeminjaman;
  approver_id: string | null;
  approved_at: string | null;
  created_at: string;
};

export type InventarisPeminjamanWithRelations = InventarisPeminjaman & {
  aset: Pick<InventarisSarpras, 'id' | 'kode_aset' | 'nama_aset' | 'satuan' | 'foto_url'> | null;
  peminjam: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  approver: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// =============================================================================
// PEMELIHARAAN ASET
// =============================================================================

export type JenisPemeliharaan = 'Preventif' | 'Korektif' | 'Kalibrasi' | 'Inspeksi';
export type StatusPemeliharaan = 'Dijadwalkan' | 'Berlangsung' | 'Selesai' | 'Dibatalkan';

export type InventarisPemeliharaan = {
  id: string;
  aset_id: string;
  jenis: JenisPemeliharaan;
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  biaya: number | null;
  vendor_servis: string | null;
  teknisi: string | null;
  kondisi_sebelum: KondisiAset | null;
  kondisi_sesudah: KondisiAset | null;
  status: StatusPemeliharaan;
  pic_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InventarisPemeliharaanWithRelations = InventarisPemeliharaan & {
  aset: Pick<InventarisSarpras, 'id' | 'kode_aset' | 'nama_aset' | 'foto_url'> | null;
  pic: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// =============================================================================
// PENGHAPUSAN ASET
// =============================================================================

export type StatusPenghapusan = 'Menunggu' | 'Disetujui' | 'Ditolak' | 'Selesai';
export type MetodePenghapusan =
  | 'Dimusnahkan'
  | 'Dilelang'
  | 'Dihibahkan'
  | 'Dijual'
  | 'Lainnya';

export type InventarisPenghapusan = {
  id: string;
  aset_id: string;
  pengaju_id: string;
  alasan: string;
  rekomendasi: string | null;
  nilai_buku_saat_ajukan: number | null;
  status: StatusPenghapusan;
  approver_id: string | null;
  approved_at: string | null;
  catatan_approval: string | null;
  metode_penghapusan: MetodePenghapusan | null;
  created_at: string;
};

export type InventarisPenghapusanWithRelations = InventarisPenghapusan & {
  aset: Pick<InventarisSarpras, 'id' | 'kode_aset' | 'nama_aset'> | null;
  pengaju: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  approver: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// =============================================================================
// MODUL BK — Bimbingan & Konseling
// =============================================================================

export type BidangBK = 'Pribadi' | 'Sosial' | 'Belajar' | 'Karier';

export type BkKategoriMasalah = {
  id: string;
  nama: string;
  bidang: BidangBK;
  deskripsi: string | null;
  created_at: string;
};

export type TipeKonseling = 'Individual' | 'Kelompok' | 'Klasikal' | 'Online';
export type StatusKonseling =
  | 'Diajukan'
  | 'Dijadwalkan'
  | 'Berlangsung'
  | 'Selesai'
  | 'Batal';

export type BkKonseling = {
  id: string;
  kode_sesi: string | null;
  tipe: TipeKonseling;
  siswa_id: number | null;
  kelompok_nama: string | null;
  kelompok_anggota: any[] | null;
  kelas_id: number | null;
  guru_bk_id: string | null;
  kategori_id: string | null;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  topik: string;
  deskripsi: string | null;
  catatan_rahasia: string | null;
  hasil: string | null;
  tindak_lanjut: string | null;
  status: StatusKonseling;
  is_rahasia: boolean;
  created_at: string;
  updated_at: string;
};

export type BkKonselingWithRelations = BkKonseling & {
  siswa?: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  } | null;
  guru_bk?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  kategori?: Pick<BkKategoriMasalah, 'id' | 'nama' | 'bidang'> | null;
  kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
};

export type TingkatUrgensi = 'Rendah' | 'Sedang' | 'Tinggi' | 'Darurat';
export type StatusCurhat = 'Baru' | 'Dibaca' | 'Dibalas' | 'Selesai';

export type BkCurhat = {
  id: string;
  siswa_id: number | null;
  is_anonim: boolean;
  alias: string | null;
  pesan: string;
  kategori_id: string | null;
  tingkat_urgensi: TingkatUrgensi;
  balasan: string | null;
  guru_bk_id: string | null;
  tanggal_balas: string | null;
  status: StatusCurhat;
  created_at: string;
};

export type BkCurhatWithRelations = BkCurhat & {
  siswa?: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> | null;
  guru_bk?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  kategori?: Pick<BkKategoriMasalah, 'id' | 'nama' | 'bidang'> | null;
};

export type SumberRujukan =
  | 'Wali Kelas'
  | 'Kesiswaan'
  | 'Guru Mapel'
  | 'Orang Tua'
  | 'Inisiatif BK';

export type StatusRujukan =
  | 'Baru'
  | 'Ditangani'
  | 'Selesai'
  | 'Dirujuk Eksternal';

export type BkRujukan = {
  id: string;
  siswa_id: number;
  pengrujuk_id: string | null;
  sumber: SumberRujukan;
  alasan: string;
  deskripsi: string | null;
  prioritas: 'Rendah' | 'Sedang' | 'Tinggi';
  status: StatusRujukan;
  guru_bk_id: string | null;
  tanggal_rujuk: string;
  tanggal_selesai: string | null;
  catatan_penanganan: string | null;
  created_at: string;
};

export type BkRujukanWithRelations = BkRujukan & {
  siswa?: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  } | null;
  pengrujuk?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  guru_bk?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

export type JenisAsesmen =
  | 'DCM'
  | 'Minat Bakat'
  | 'Kesehatan Mental'
  | 'Gaya Belajar'
  | 'Kepribadian';

export type BkAsesmen = {
  id: string;
  siswa_id: number;
  jenis: JenisAsesmen;
  tanggal: string;
  jawaban: any | null;
  skor: any | null;
  rekomendasi: string | null;
  guru_bk_id: string | null;
  created_at: string;
};

export type BkAsesmenWithRelations = BkAsesmen & {
  siswa?: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> | null;
  guru_bk?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// =============================================================================
// MODUL KEDISIPLINAN SISWA (Kesiswaan)
// =============================================================================

// ---------- KATEGORI PELANGGARAN ----------
export type KategoriPelanggaranLevel = 'Ringan' | 'Sedang' | 'Berat';

export type KesiswaanKategoriPelanggaran = {
  id: string;
  nama: string;
  kategori: KategoriPelanggaranLevel;
  poin_default: number;
  deskripsi: string | null;
  is_aktif: boolean;
  created_at: string;
};

// ---------- PELANGGARAN ----------
export type KesiswaanPelanggaran = {
  id: string;
  siswa_id: number;
  kategori_id: string | null;
  jenis_pelanggaran: string;
  deskripsi: string | null;
  poin: number;
  tanggal: string;
  pelapor_id: string | null;
  tindakan: string | null;
  bukti_url: string | null;
  created_at: string;
  updated_at: string;
};

export type KesiswaanPelanggaranWithRelations = KesiswaanPelanggaran & {
  siswa?: (Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  }) | null;
  pelapor?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  kategori?: Pick<KesiswaanKategoriPelanggaran, 'id' | 'nama' | 'kategori'> | null;
};

// ---------- KATEGORI PRESTASI ----------
export type KategoriPrestasiJenis = 'Akademik' | 'Non-Akademik' | 'Keagamaan' | 'Lainnya';

export type KesiswaanKategoriPrestasi = {
  id: string;
  nama: string;
  kategori: KategoriPrestasiJenis;
  poin_default: number;
  deskripsi: string | null;
  is_aktif: boolean;
  created_at: string;
};

// ---------- PRESTASI ----------
export type TingkatPrestasi =
  | 'Sekolah'
  | 'Kecamatan'
  | 'Kabupaten'
  | 'Provinsi'
  | 'Nasional'
  | 'Internasional';

export type KesiswaanPrestasi = {
  id: string;
  siswa_id: number;
  kategori_id: string | null;
  nama_prestasi: string;
  tingkat: TingkatPrestasi;
  peringkat: string | null;
  poin: number;
  tanggal: string;
  penyelenggara: string | null;
  bukti_url: string | null;
  pencatat_id: string | null;
  created_at: string;
  updated_at: string;
};

export type KesiswaanPrestasiWithRelations = KesiswaanPrestasi & {
  siswa?: (Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  }) | null;
  pencatat?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  kategori?: Pick<KesiswaanKategoriPrestasi, 'id' | 'nama' | 'kategori'> | null;
};

// ---------- SURAT PERINGATAN ----------
export type LevelSP = 'SP1' | 'SP2' | 'SP3';
export type StatusSP = 'Aktif' | 'Dicabut' | 'Selesai';

export type KesiswaanSuratPeringatan = {
  id: string;
  siswa_id: number;
  nomor_sp: string | null;
  level: LevelSP;
  total_poin_pelanggaran: number;
  total_poin_prestasi: number;
  alasan: string;
  tanggal_terbit: string;
  batas_waktu: string | null;
  ditandatangani_oleh: string | null;
  status: StatusSP;
  bukti_ttd_ortu_url: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type KesiswaanSuratPeringatanWithRelations = KesiswaanSuratPeringatan & {
  siswa?: (Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn' | 'jenis_kelamin'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  }) | null;
  penandatangan?: Pick<Guru, 'id' | 'nama_lengkap'  | 'nip'> | null;
};

// ---------- REKAP POIN (untuk tab Rekap & Dashboard) ----------
export type RekapPoinSiswa = {
  siswa_id: number;
  nisn: string;
  nama_lengkap: string;
  kelas: string;
  total_poin_pelanggaran: number;
  total_poin_prestasi: number;
  poin_bersih: number;
  jumlah_pelanggaran: number;
  jumlah_prestasi: number;
  rekomendasi_sp: LevelSP | null;
};

// =============================================================================
// MODUL PERPUSTAKAAN
// =============================================================================

// ---------- KATEGORI / DEWEY ----------
export type PerpusKategori = {
  id: string;
  nama: string;
  kode_dewey: string | null;
  deskripsi: string | null;
  warna: string | null;
  created_at: string;
};

// ---------- RAK ----------
export type PerpusRak = {
  id: string;
  nama: string;
  lokasi: string | null;
  keterangan: string | null;
  is_aktif: boolean;
  created_at: string;
};

// ---------- BUKU ----------
export type KondisiBuku = 'Baik' | 'Rusak Ringan' | 'Rusak Berat';

export type PerpusBuku = {
  id: string;
  kode_buku: string | null;
  judul: string;
  pengarang: string | null;
  penerbit: string | null;
  tahun_terbit: number | null;
  isbn: string | null;
  kategori_id: string | null;
  rak_id: string | null;
  jumlah_total: number;
  jumlah_tersedia: number;
  kondisi: KondisiBuku;
  sinopsis: string | null;
  cover_url: string | null;
  bahasa: string | null;
  jumlah_halaman: number | null;
  catatan: string | null;
  is_aktif: boolean;
  qr_token: string; 
  created_at: string;
  updated_at: string;
};

export type PerpusBukuWithRelations = PerpusBuku & {
  kategori?: Pick<PerpusKategori, 'id' | 'nama' | 'kode_dewey' | 'warna'> | null;
  rak?: Pick<PerpusRak, 'id' | 'nama' | 'lokasi'> | null;
};

// ---------- ANGGOTA ----------
export type TipeAnggota = 'Siswa' | 'Guru' | 'Tendik' | 'Umum';
export type StatusAnggota = 'Aktif' | 'Nonaktif' | 'Diblock' | 'Expired';

export type PerpusAnggota = {
  id: string;
  kode_anggota: string;
  tipe: TipeAnggota;
  siswa_id: number | null;
  guru_id: string | null;
  nama_lengkap: string;
  tanggal_daftar: string;
  tanggal_expired: string | null;
  status: StatusAnggota;
  total_denda: number;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type PerpusAnggotaWithRelations = PerpusAnggota & {
  siswa?: Pick<Siswa, 'id' | 'nama_lengkap' | 'nisn'> & {
    kelas?: Pick<Kelas, 'id' | 'nama_kelas'> | null;
  } | null;
  guru?: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'> | null;
};

// ---------- PEMINJAMAN ----------
export type StatusPeminjamanPerpus = 'Dipinjam' | 'Dikembalikan' | 'Terlambat' | 'Hilang';

export type PerpusPeminjaman = {
  id: string;
  anggota_id: string;
  buku_id: string;
  tanggal_pinjam: string;
  tanggal_jatuh_tempo: string;
  tanggal_kembali: string | null;
  perpanjangan_ke: number;
  kondisi_saat_pinjam: string;
  kondisi_saat_kembali: string | null;
  status: StatusPeminjamanPerpus;
  denda: number;
  denda_dibayar: boolean;
  petugas_pinjam_id: string | null;
  petugas_kembali_id: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type PerpusPeminjamanWithRelations = PerpusPeminjaman & {
  anggota?: PerpusAnggotaWithRelations | null;
  buku?: Pick<PerpusBuku, 'id' | 'kode_buku' | 'judul' | 'pengarang' | 'cover_url'> | null;
  petugas_pinjam?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
  petugas_kembali?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// ---------- SERIAL ----------
export type JenisSerial = 'Majalah' | 'Jurnal' | 'Koran' | 'Buletin' | 'Lainnya';

export type PerpusSerial = {
  id: string;
  nama: string;
  jenis: JenisSerial;
  penerbit: string | null;
  edisi: string | null;
  tanggal_terbit: string | null;
  jumlah: number;
  rak_id: string | null;
  keterangan: string | null;
  is_aktif: boolean;
  created_at: string;
};

export type PerpusSerialWithRelations = PerpusSerial & {
  rak?: Pick<PerpusRak, 'id' | 'nama' | 'lokasi'> | null;
};

// ---------- INVENTARISASI ----------
export type StatusInventarisasi = 'Draft' | 'Final';

export type PerpusInventarisasi = {
  id: string;
  tanggal: string;
  petugas_id: string | null;
  total_buku_sistem: number;
  total_buku_fisik: number;
  selisih: number;
  buku_hilang_ids: any | null;
  catatan: string | null;
  status: StatusInventarisasi;
  created_at: string;
};

// ---------- STATISTIK / DASHBOARD ----------
export type PerpusTopBuku = {
  buku_id: string;
  judul: string;
  pengarang: string | null;
  cover_url: string | null;
  total_pinjam: number;
};

export type PerpusStatistikLiterasi = {
  siswa_id: number;
  nama_lengkap: string;
  nisn: string;
  kelas: string;
  total_pinjam: number;
  total_buku_dibaca: number;
};

// =============================================================================
// MODUL HRIS — Kepegawaian
// =============================================================================

// ---------- ENUM HELPER ----------
export type StatusKepegawaian = 'Tetap' | 'Kontrak' | 'Honorer' | 'Magang' | 'GTT/PTT';

export type JenisPTK =
  | 'Guru Mata Pelajaran'
  | 'Guru Bimbingan dan Konseling'
  | 'Guru'
  | 'Kepala Sekolah'
  | 'Wakil Kepala'
  | 'Kepala Divisi'
  | 'Kepala Program Keahlian'
  | 'Staf Administrasi'
  | 'Staf Divisi'
  | 'Pustakawan'
  | 'Laboran'
  | 'Satpam'
  | 'Kebersihan'
  | 'Lainnya';

// ---------- PROFIL PEGAWAI ----------
export type Agama = 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu' | 'Lainnya';
export type GolonganDarah = 'A' | 'B' | 'AB' | 'O';
export type StatusPernikahan = 'Belum Menikah' | 'Menikah' | 'Cerai Hidup' | 'Cerai Mati';

export type HrisProfilPegawai = {
  id: string;
  nik: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: 'L' | 'P' | null;
  agama: Agama | null;
  golongan_darah: GolonganDarah | null;
  status_pernikahan: StatusPernikahan | null;
  jumlah_anak: number;
  no_hp: string | null;
  email_pribadi: string | null;
  alamat_ktp: string | null;
  alamat_domisili: string | null;
  nama_kontak_darurat: string | null;
  hubungan_kontak_darurat: string | null;
  no_hp_darurat: string | null;
  bank_nama: string | null;
  bank_nomor_rekening: string | null;
  bank_atas_nama: string | null;
  bpjs_kesehatan_no: string | null;
  bpjs_ketenagakerjaan_no: string | null;
  npwp: string | null;
  tinggi_badan: number | null;
  berat_badan: number | null;
  hobi: string | null;
  motto_hidup: string | null;
  foto_profil_url: string | null;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type HrisProfilWithGuru = HrisProfilPegawai & {
  guru?: Pick<Guru, 'id' | 'nip' | 'nama_lengkap' | 'email' | 'role' | 'jenis_ptk' | 'status_kepegawaian' | 'tanggal_bergabung'> | null;
};

// ---------- DOKUMEN ----------
export type KategoriDokumen =
  | 'SK Pengangkatan'
  | 'SK Kenaikan Pangkat'
  | 'SK Berkala'
  | 'Sertifikat Pendidik'
  | 'Sertifikat Pelatihan'
  | 'Ijazah'
  | 'Transkrip Nilai'
  | 'KTP'
  | 'KK'
  | 'NPWP'
  | 'BPJS Kesehatan'
  | 'BPJS Ketenagakerjaan'
  | 'Buku Rekening'
  | 'Kontrak Kerja'
  | 'Surat Tugas'
  | 'Piagam Penghargaan'
  | 'Lainnya';

export type HrisDokumen = {
  id: string;
  guru_id: string;
  kategori: KategoriDokumen;
  nama_dokumen: string;
  nomor_dokumen: string | null;
  tanggal_terbit: string | null;
  tanggal_expired: string | null;
  file_url: string | null;
  ukuran_file: number | null;
  keterangan: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HrisDokumenWithRelations = HrisDokumen & {
  guru?: Pick<Guru, 'id' | 'nama_lengkap' | 'nip'> | null;
  verifier?: Pick<Guru, 'id' | 'nama_lengkap'> | null;
};

// ---------- PENDIDIKAN ----------
export type JenjangPendidikan = 'SD' | 'SMP' | 'SMA/SMK' | 'D3' | 'D4' | 'S1' | 'S2' | 'S3';

export type HrisPendidikan = {
  id: string;
  guru_id: string;
  jenjang: JenjangPendidikan;
  institusi: string;
  jurusan: string | null;
  tahun_masuk: number | null;
  tahun_lulus: number | null;
  ipk: number | null;
  nomor_ijazah: string | null;
  file_url: string | null;
  keterangan: string | null;
  created_at: string;
};

// ---------- PEKERJAAN ----------
export type JenisPekerjaan = 'Internal' | 'Eksternal';

export type HrisPekerjaan = {
  id: string;
  guru_id: string;
  jenis: JenisPekerjaan;
  nama_perusahaan: string;
  posisi: string | null;
  bidang: string | null;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  alasan_keluar: string | null;
  file_url: string | null;
  keterangan: string | null;
  created_at: string;
};

// ---------- KELUARGA ----------
export type HubunganKeluarga = 'Ayah' | 'Ibu' | 'Suami' | 'Istri' | 'Anak' | 'Saudara' | 'Lainnya';

export type HrisKeluarga = {
  id: string;
  guru_id: string;
  nama: string;
  hubungan: HubunganKeluarga;
  tanggal_lahir: string | null;
  jenis_kelamin: 'L' | 'P' | null;
  pekerjaan: string | null;
  no_hp: string | null;
  alamat: string | null;
  is_kontak_darurat: boolean;
  keterangan: string | null;
  created_at: string;
};

// ---------- STATISTIK / DASHBOARD ----------
export type HrisStatsOverview = {
  total_pegawai: number;
  pegawai_tetap: number;
  pegawai_kontrak: number;
  pegawai_honorer: number;
  pegawai_gtt_ptt: number;
  total_dokumen: number;
  dokumen_verified: number;
  dokumen_expired: number;
  dokumen_expiring_soon: number;
  profil_lengkap: number;
  profil_incomplete: number;
};

export type HrisKelengkapanPegawai = {
  guru_id: string;
  nip: string | null;
  nama_lengkap: string;
  jenis_ptk: string | null;
  status_kepegawaian: string | null;
  has_profil: boolean;
  has_nik: boolean;
  has_tanggal_lahir: boolean;
  has_no_hp: boolean;
  has_alamat: boolean;
  has_bank: boolean;
  has_bpjs_kesehatan: boolean;
  has_kontak_darurat: boolean;
  has_foto: boolean;
  total_dokumen: number;
  dokumen_kategori_missing: string[];
  completion_percent: number;
};

// =============================================================================
// MODUL HRIS — CUTI, IZIN & SALDO
// =============================================================================

export type StatusCuti =
  | 'Draft'
  | 'Diajukan'
  | 'Disetujui Atasan'
  | 'Disetujui HR'
  | 'Disetujui Kepsek'
  | 'Disetujui'
  | 'Ditolak'
  | 'Dibatalkan';

export type AksiApprovalCuti = 'Approve' | 'Reject' | 'Batal' | 'Auto-Skip';

export type HrisJenisCuti = {
  id: string;
  nama: string;
  deskripsi: string | null;
  warna: string;
  mengurangi_saldo_tahunan: boolean;
  durasi_maksimal_hari: number | null;
  durasi_minimal_hari: number;
  butuh_approval_3level: boolean;
  skip_level_hr: boolean;
  wajib_lampiran: boolean;
  syarat_lampiran: string | null;
  is_aktif: boolean;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
};

export type HrisSaldoCuti = {
  id: string;
  guru_id: string;
  tahun: number;
  saldo_awal: number;
  saldo_terpakai: number;
  saldo_sisa: number;
  carry_over_dari_tahun_lalu: number;
  catatan: string | null;
  created_at: string;
  updated_at: string;
};

export type HrisCuti = {
  id: string;
  nomor_pengajuan: string | null;
  guru_id: string;
  jenis_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  jam_mulai: string | null;
  jam_selesai: string | null;
  jumlah_jam: number | null;
  alasan: string;
  alamat_selama_cuti: string | null;
  no_hp_selama_cuti: string | null;
  lampiran_url: string | null;
  status: StatusCuti;
  current_level: number;
  approved_by: string | null;
  approved_at: string | null;
  alasan_penolakan: string | null;
  guru_pengganti_id: string | null;
  catatan_pengganti: string | null;
  mengurangi_saldo_tahunan: boolean | null;
  verification_token: string | null;
  surat_generated_at: string | null;
  surat_generated_by: string | null;
  content_hash: string | null;
  hash_algorithm: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HrisCutiApproval = {
  id: string;
  cuti_id: string;
  approver_id: string;
  approver_role: string | null;
  level: number;
  aksi: AksiApprovalCuti;
  catatan: string | null;
  created_at: string;
};

// Hasil dari view v_hris_cuti_lengkap
export type HrisCutiWithRelations = HrisCuti & {
  guru_nama?: string | null;
  guru_nip?: string | null;
  guru_role?: string | null;
  guru_divisi_id?: string | null;
  guru_divisi_nama?: string | null;
  guru_jenis_ptk?: string | null;
  guru_status_kepegawaian?: string | null;
  jenis_nama?: string | null;
  jenis_warna?: string | null;
  pengganti_nama?: string | null;
  approver_nama?: string | null;
};

// =============================================================================
// MODUL RAPAT & NOTULENSI
// =============================================================================

export type JenisRapat =
  | 'Rapat Dinas'
  | 'Rapat Divisi'
  | 'Rapat Koordinasi'
  | 'Rapat Pleno'
  | 'Rapat Khusus'
  | 'Rapat Evaluasi'
  | 'Lainnya';

export type StatusRapat =
  | 'Draft'
  | 'Akan Datang'
  | 'Berlangsung'
  | 'Selesai'
  | 'Dibatalkan';

export type JabatanDalamRapat =
  | 'Pemimpin'
  | 'Notulis'
  | 'Peserta'
  | 'Undangan'
  | 'Narasumber';

export type StatusKehadiranRapat =
  | 'Belum Dikonfirmasi'
  | 'Hadir'
  | 'Tidak Hadir'
  | 'Izin'
  | 'Terlambat';

export type StatusNotulensi = 'Draft' | 'Final';

export type Rapat = {
  id: string;
  nomor_rapat: string | null;
  judul: string;
  jenis: JenisRapat;
  deskripsi: string | null;
  tanggal: string;
  waktu_mulai: string;
  waktu_selesai: string | null;
  lokasi: string | null;
  penyelenggara: string | null;
  pemimpin_rapat_id: string | null;
  notulis_id: string | null;
  status: StatusRapat;
  is_public: boolean;
  catatan_umum: string | null;
  closed_at: string | null;
  closed_by: string | null;
  close_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RapatWithRelations = Rapat & {
  pemimpin_nama?: string | null;
  pemimpin_nip?: string | null;
  notulis_nama?: string | null;
  notulis_nip?: string | null;
  created_by_nama?: string | null;
  closed_by_nama?: string | null;
  total_peserta?: number;
  total_hadir?: number;
  total_tidak_hadir?: number;
  has_notulensi?: boolean;
  notulensi_status?: StatusNotulensi | null;
};

export type RapatPeserta = {
  id: string;
  rapat_id: string;
  guru_id: string;
  jabatan_dalam_rapat: JabatanDalamRapat;
  status_kehadiran: StatusKehadiranRapat;
  catatan: string | null;
  created_at: string;
};

export type RapatPesertaWithGuru = RapatPeserta & {
  guru?: {
    id: string;
    nama_lengkap: string;
    nip: string | null;
    jenis_ptk: string | null;
  } | null;
};

export type ActionItemRapat = {
  pic_id: string | null;
  pic_nama: string;
  deskripsi: string;
  deadline: string | null;
  prioritas: 'Tinggi' | 'Sedang' | 'Rendah';
  todo_id: string | null;
  status: 'Belum' | 'Proses' | 'Selesai';
};

export type RapatNotulensi = {
  id: string;
  rapat_id: string;
  ringkasan: string | null;
  pembahasan: string | null;
  keputusan: string | null;
  action_items: ActionItemRapat[];
  lampiran_url: string | null;
  status: StatusNotulensi;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  verification_token: string | null;
  pdf_generated_at: string | null;
  pdf_generated_by: string | null;
  content_hash: string | null;
  hash_algorithm: string | null;
  frozen_at: string | null;
  frozen_by: string | null;
};

export const JENIS_RAPAT_OPTIONS: JenisRapat[] = [
  'Rapat Dinas', 'Rapat Divisi', 'Rapat Koordinasi',
  'Rapat Pleno', 'Rapat Khusus', 'Rapat Evaluasi', 'Lainnya',
];

export const STATUS_RAPAT_OPTIONS: StatusRapat[] = [
  'Draft', 'Akan Datang', 'Berlangsung', 'Selesai', 'Dibatalkan',
];

export const KEHADIRAN_RAPAT_OPTIONS: StatusKehadiranRapat[] = [
  'Belum Dikonfirmasi', 'Hadir', 'Tidak Hadir', 'Izin', 'Terlambat',
];

// =============================================================================
// MODUL ARSIP DIGITAL
// =============================================================================

export type AksesLevel = 'Public' | 'Internal' | 'Confidential';
export type StatusDokumenArsip = 'Draft' | 'Aktif' | 'Obsolete' | 'Dicabut' | 'Selesai';
export type StorageProvider = 'supabase' | 'google_drive' | 'dropbox' | 'external' | 'telegram';
export type AksiArsip =
  | 'Create' | 'Update' | 'Upload_Versi' | 'Publish'
  | 'Obsolete' | 'Cabut' | 'View' | 'Download' | 'Acknowledge'
  | 'Revisi' | 'Hapus' | 'Restore' | 'Cleanup';

export type ArsipKategori = {
  id: string;
  nama: string;
  deskripsi: string | null;
  icon: string | null;
  warna: string;
  akses_level: AksesLevel;
  roles_allowed: string[] | null;
  retensi_default_bulan: number;
  is_aktif: boolean;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
};

export type ArsipDokumen = {
  id: string;
  nomor_dokumen: string | null;
  kategori_id: string;
  judul: string;
  deskripsi: string | null;
  tags: string[];
  status: StatusDokumenArsip;
  versi_aktif_id: string | null;
  total_versi: number;
  akses_level: AksesLevel | null;
  roles_allowed: string[] | null;
  tanggal_berlaku: string | null;
  tanggal_expired: string | null;
  tanggal_retensi: string | null;
  retensi_bulan: number | null;
  total_views: number;
  total_downloads: number;
  pemilik_id: string | null;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ArsipVersi = {
  id: string;
  dokumen_id: string;
  versi: number;
  nomor_revisi: string | null;
  storage_provider: StorageProvider;
  file_url: string;
  external_url: string | null;
  file_size: number | null;
  original_size: number | null;
  compression_ratio: number | null;
  file_type: string | null;
  file_name: string | null;
  ringkasan_perubahan: string | null;
  is_aktif: boolean;
  content_hash: string | null;
  hash_algorithm: string;
  frozen_at: string | null;
  frozen_by: string | null;
  verification_token: string;
  created_by: string | null;
  created_at: string;
};

export type ArsipPembaca = {
  id: string;
  dokumen_id: string;
  versi_id: string | null;
  guru_id: string;
  sudah_baca: boolean;
  sudah_download: boolean;
  sudah_acknowledge: boolean;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  acknowledged_at: string | null;
  jumlah_view: number;
  wajib_baca: boolean;
  deadline_baca: string | null;
  created_at: string;
};

export type ArsipAktivitas = {
  id: string;
  dokumen_id: string | null;
  versi_id: string | null;
  guru_id: string | null;
  aksi: AksiArsip;
  catatan: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ArsipWithRelations = ArsipDokumen & {
  kategori_nama?: string;
  kategori_icon?: string;
  kategori_warna?: string;
  kategori_akses_level?: AksesLevel;
  versi_aktif_nomor?: number;
  versi_aktif_revisi?: string | null;
  file_url?: string;
  external_url?: string | null;
  file_size?: number | null;
  original_size?: number | null;
  compression_ratio?: number | null;
  file_type?: string | null;
  file_name?: string | null;
  storage_provider?: StorageProvider;
  versi_changelog?: string | null;
  versi_token?: string;
  versi_hash?: string | null;
  versi_frozen_at?: string | null;
  pemilik_nama?: string | null;
  created_by_nama?: string | null;
  total_pembaca?: number;
  total_sudah_baca?: number;
  total_acknowledge?: number;
};

// =============================================================================
// MODUL MITRA DUDI & MoU
// =============================================================================

export type JenisMitra = 'PT' | 'CV' | 'Yayasan' | 'Sekolah' | 'Pemerintah' | 'UMKM' | 'Lainnya';
export type SkalaMitra = 'Kecil' | 'Menengah' | 'Besar' | 'Multinasional';
export type StatusMitra = 'Aktif' | 'Nonaktif' | 'Blacklist';
export type JenisMou = 'MoU' | 'PKS' | 'IoA' | 'Addendum' | 'Perjanjian';
export type StatusMou = 'Draft' | 'Review' | 'Ttd' | 'Aktif' | 'Expired' | 'Diperpanjang' | 'Dicabut';
export type JenisAktivitasMitra =
  | 'PKL' | 'UKK' | 'Rekrutmen' | 'Pelatihan Guru' | 'Pelatihan Siswa'
  | 'CSR' | 'Kunjungan Industri' | 'Guest Teacher' | 'Lainnya';

export type Mitra = {
  id: string;
  kode_mitra: string | null;
  nama: string;
  jenis_mitra: JenisMitra;
  bidang_industri: string | null;
  deskripsi: string | null;
  logo_url: string | null;
  kategori_kerjasama: string[];
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  kode_pos: string | null;
  website: string | null;
  telepon: string | null;
  email: string | null;
  pic_nama: string | null;
  pic_jabatan: string | null;
  pic_no_hp: string | null;
  pic_email: string | null;
  skala: SkalaMitra | null;
  rating: number;
  status: StatusMitra;
  catatan: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MitraWithRelations = Mitra & {
  total_mou?: number;
  total_mou_aktif?: number;
  mou_expiring_soon?: number;
  total_pkl?: number;
  total_siswa_pkl?: number;
  total_siswa_direkrut?: number;
  created_by_nama?: string | null;
};

export type Mou = {
  id: string;
  nomor_mou: string | null;
  mitra_id: string;
  jenis_mou: JenisMou;
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string;
  durasi_bulan: number | null;
  status: StatusMou;
  penandatangan_sekolah_id: string | null;
  penandatangan_mitra_nama: string | null;
  penandatangan_mitra_jabatan: string | null;
  lingkup_kerjasama: string | null;
  nilai_kerjasama: number | null;
  file_url: string | null;
  file_size: number | null;
  parent_mou_id: string | null;
  reminder_h30_sent_at: string | null;
  reminder_h7_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MouWithRelations = Mou & {
  mitra_nama?: string | null;
  kode_mitra?: string | null;
  jenis_mitra?: JenisMitra | null;
  bidang_industri?: string | null;
  mitra_logo?: string | null;
  pic_nama?: string | null;
  pic_no_hp?: string | null;
  penandatangan_sekolah_nama?: string | null;
  penandatangan_sekolah_nip?: string | null;
  created_by_nama?: string | null;
  parent_mou_nomor?: string | null;
  hari_ke_expired?: number | null;
  expiry_status?: 'Expired' | 'H7' | 'H30' | 'Aman' | null;
};

export type MitraAktivitas = {
  id: string;
  mitra_id: string;
  mou_id: string | null;
  jenis: JenisAktivitasMitra;
  judul: string;
  deskripsi: string | null;
  tanggal: string;
  jumlah_siswa: number | null;
  jumlah_guru: number | null;
  file_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type MitraAktivitasWithRelations = MitraAktivitas & {
  mitra_nama?: string | null;
  kode_mitra?: string | null;
  mou_nomor?: string | null;
  created_by_nama?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// OPSI KONSTANTA
// ─────────────────────────────────────────────────────────────────────────────
export const JENIS_MITRA_OPTIONS: JenisMitra[] = [
  'PT', 'CV', 'Yayasan', 'Sekolah', 'Pemerintah', 'UMKM', 'Lainnya',
];

export const SKALA_MITRA_OPTIONS: SkalaMitra[] = [
  'Kecil', 'Menengah', 'Besar', 'Multinasional',
];

export const STATUS_MITRA_OPTIONS: StatusMitra[] = [
  'Aktif', 'Nonaktif', 'Blacklist',
];

export const KATEGORI_KERJASAMA_OPTIONS = [
  'PKL', 'UKK', 'Rekrutmen', 'CSR', 'Pelatihan', 'Kunjungan', 'Lainnya',
];

export const JENIS_MOU_OPTIONS: JenisMou[] = [
  'MoU', 'PKS', 'IoA', 'Addendum', 'Perjanjian',
];

export const STATUS_MOU_OPTIONS: StatusMou[] = [
  'Draft', 'Review', 'Ttd', 'Aktif', 'Expired', 'Diperpanjang', 'Dicabut',
];

export const JENIS_AKTIVITAS_OPTIONS: JenisAktivitasMitra[] = [
  'PKL', 'UKK', 'Rekrutmen', 'Pelatihan Guru', 'Pelatihan Siswa',
  'CSR', 'Kunjungan Industri', 'Guest Teacher', 'Lainnya',
];

// =============================================================================
// KALENDER AKADEMIK — TIPE UNIFIED
// =============================================================================

export type KalenderEventSource = 'rencana' | 'rapat' | 'libur';

export type KalenderKategori =
  | 'ujian'
  | 'rapat'
  | 'libur'
  | 'pelatihan'
  | 'lomba'
  | 'siswa'
  | 'default';

export type KalenderWarna =
  | 'rose'
  | 'blue'
  | 'slate'
  | 'purple'
  | 'amber'
  | 'teal'
  | 'cyan'
  | 'indigo'
  | 'emerald';

export type KalenderEvent = {
  id: string;                    // prefix source + id asli (mis. 'rencana-123')
  source: KalenderEventSource;
  source_id: string;             // id asli dari tabel asal
  
  judul: string;
  deskripsi: string | null;
  tanggal_mulai: string;         // YYYY-MM-DD
  tanggal_selesai: string;       // YYYY-MM-DD (sama dengan mulai kalau 1 hari)
  
  // Info spesifik (kalau ada)
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  lokasi?: string | null;
  penanggung_jawab?: string | null;
  peserta?: string | null;
  status?: string | null;
  
  // Kategori & warna auto
  kategori: KalenderKategori;
  warna: KalenderWarna;
  kategori_label: string;
};

// =============================================================================
// KEHADIRAN GURU — SUMMARY (dari agenda_gurus)
// =============================================================================

export type KehadiranStats = {
  hadir_jp: number;
  alpa_jp: number;
  izin_jp: number;
  sakit_jp: number;
  total_jp: number;
  rate: number;                   // 0-100

  // Info tambahan (bukan untuk rate)
  total_menit_terlambat: number;
  total_terlambat_jp: number;     // menit/30 (info saja)
  total_sesi: number;
  total_sesi_terlambat: number;
};

// Row join minimal dari agenda_gurus + jadwal_kbms
export type AgendaGuruKehadiranRow = {
  id: number;
  tanggal: string;
  status_kehadiran: string;
  menit_terlambat: number | null;
  alpa_jam_pelajaran: number | null;
  jadwal_kbms: {
    id: number;
    waktu_mulai: string | null;
    waktu_selesai: string | null;
  } | null;
};