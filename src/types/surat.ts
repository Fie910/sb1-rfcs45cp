export type JenisSurat = 'MASUK' | 'KELUAR' | 'SK';
export type StatusDisposisi = 'PENDING' | 'PROSES' | 'SELESAI';

// 1. Kategori / Kode Perihal
export interface KategoriSurat {
  id: string;
  kode: string;
  nama_kategori: string;
  jenis_surat: JenisSurat;
  created_at?: string;
}

// 2. Data Surat
export interface Surat {
  id?: string;
  jenis_surat: JenisSurat;
  kategori_id?: string | null;
  nomor_surat: string;
  perihal: string;
  ringkasan?: string | null;
  pengirim_atau_tujuan: string;
  tanggal_surat: string;
  tanggal_diterima_atau_dikirim?: string;
  file_url?: string | null;
  siswa_id?: number | null;

  // Bukti Ekspedisi (Surat Keluar)
  nama_penerima_surat?: string | null;
  tanggal_terima_surat?: string | null;
  bukti_penerimaan_url?: string | null;

  created_at?: string;

  // Relation JOIN Data
  kategori_surat?: KategoriSurat;
  siswas?: {
    id: number;
    nama_lengkap: string;
    nisn: string;
  };
}

// 3. Disposisi Surat (Surat Masuk)
export interface DisposisiSurat {
  id?: string;
  surat_id: string;
  pemberi_disposisi: string;
  penerima_disposisi: string;
  instruksi: string;
  batas_waktu?: string | null;
  status: StatusDisposisi;
  catatan_tindak_lanjut?: string | null;
  pemberi_id?: string | null;
  penerima_id?: string | null;
  created_at?: string;
  updated_at?: string;
}