export type TipeRutin = 'Harian' | 'Mingguan' | 'Bulanan';

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
  created_at: string;
}