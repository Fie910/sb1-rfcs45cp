export type PriorityType = 'Tinggi' | 'Sedang' | 'Rendah';
export type StatusType = 'Belum Selesai' | 'Sedang Dikerjakan' | 'Selesai';
export type TipeRutin = 'Harian' | 'Mingguan' | 'Bulanan';

export interface TodoItem {
  id: string;
  judul: string;
  deskripsi: string | null;
  divisi_id: string;
  prioritas: PriorityType;
  status: StatusType;
  tanggal_tenggat: string | null;
  dibuat_oleh_id: string | null;
  ditugaskan_ke_id: string | null;
  template_id: string | null;
  created_at: string;
  dibuat_oleh?: { nama_lengkap: string };
  ditugaskan_ke?: { nama_lengkap: string };
}

export interface TodoTemplate {
  id: string;
  judul: string;
  deskripsi: string | null;
  divisi_id: string;
  ditugaskan_ke_id: string | null;
  prioritas: PriorityType;
  tipe_rutin: TipeRutin;
  hari_mingguan: number | null; // 1 (Senin) - 7 (Minggu)
  tanggal_bulanan: number | null; // 1 - 31
  is_active: boolean;
  is_completed?: boolean;
  created_at?: string;
  ditugaskan_ke?: { nama_lengkap: string };
}

export interface SopLog {
  id: string;
  template_id: string;
  divisi_id: string;
  dikerjakan_oleh_id: string | null;
  tanggal: string;
  status: 'Selesai' | 'Terlewat';
  catatan?: string | null;
  created_at: string;
  dikerjakan_oleh?: { nama_lengkap: string };
  template?: {
    judul: string;
    ditugaskan_ke_id?: string | null;
    ditugaskan_ke?: { nama_lengkap: string };
  };
}