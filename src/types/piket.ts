export type StatusKehadiranGuru = 
  | 'hadir'
  | 'sakit_tugas'
  | 'sakit_tanpa_tugas'
  | 'dinas_tugas'
  | 'dinas_tanpa_tugas'
  | 'izin_tugas'
  | 'izin_tanpa_tugas'
  | 'alpa';

export interface JadwalKBMJP {
  id: string;
  hari: string;
  jam_ke: number;
  jam_mulai: string;
  jam_selesai: string;
  kelas: string;
  nama_guru: string;
  nip?: string;
  guru_id?: string;
  mapel: string;
}

export interface OptionStatus {
  value: StatusKehadiranGuru;
  label: string;
  badgeClass: string;
}

export const STATUS_OPTIONS: OptionStatus[] = [
  { value: 'hadir', label: 'Hadir', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { value: 'sakit_tugas', label: 'Sakit (Ada Tugas)', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'sakit_tanpa_tugas', label: 'Sakit (Tanpa Tugas)', badgeClass: 'bg-amber-600/10 text-amber-500 border-amber-600/30' },
  { value: 'dinas_tugas', label: 'Dinas (Ada Tugas)', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'dinas_tanpa_tugas', label: 'Dinas (Tanpa Tugas)', badgeClass: 'bg-blue-600/10 text-blue-500 border-blue-600/30' },
  { value: 'izin_tugas', label: 'Izin (Ada Tugas)', badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { value: 'izin_tanpa_tugas', label: 'Izin (Tanpa Tugas)', badgeClass: 'bg-sky-600/10 text-sky-500 border-sky-600/30' },
  { value: 'alpa', label: 'Absen / Alpa', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
];