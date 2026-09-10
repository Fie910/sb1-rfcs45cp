import {
  LayoutDashboard,
  User,
  Users,
  School,
  ClipboardList,
  CalendarCheck,
  BookHeart,
  FileText,
  ShieldCheck,
  Shield,
  Settings,
  Megaphone,
  UserCog,
  CalendarDays,
  FileBarChart,
  LucideIcon,
  UserCheck,
  Briefcase,
  TrendingUp,
  Award,
  History,
  UserMinus,
  Mails,
  NotebookPen,
  ClipboardCheck,
} from 'lucide-react';

export type PageKey =
  | 'dashboard'
  | 'profil'
  | 'siswa'
  | 'kelas'
  | 'nilai'
  | 'presensi'
  | 'presensi_kesiswaan'
  | 'agenda'
  | 'izin'
  | 'piket'
  | 'sekolah'
  | 'pengumuman'
  | 'guru'
  | 'jadwal_kbm'
  | 'jadwal_kbm_jps'
  | 'jadwal_piket'
  | 'jadwal_piket_penyambutan'
  | 'kehadiran_piket'
  | 'kehadiran_piket_penyambutan'
  | 'rekap_presensi_siswa'
  | 'rekap_presensi_kesiswaan'
  | 'rekap_nilai'
  | 'rekap_presensi_guru'
  | 'rekap_agenda'
  | 'rekap_izin'
  | 'hak_akses'
  | 'todo'
  | 'buku_tamu'
  | 'surat'
  | 'tugas_disposisi'
  // Page keys baru modul kesiswaan
  | 'kenaikan_kelas'
  | 'kelulusan'
  | 'riwayat_siswa'
  | 'mutasi_siswa';

export type NavItem = {
  key: PageKey;
  label: string;
  icon: LucideIcon;
  path: string;
};

export type NavGroup = {
  groupTitle: string;
  items: NavItem[];
};

export const NAVIGATION_CONFIG: NavGroup[] = [
  {
    groupTitle: 'Utama',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { key: 'profil', label: 'Profil Saya', icon: User, path: '/profil' },
      { key: 'buku_tamu', label: 'Buku Tamu', icon: NotebookPen, path: '/buku_tamu' },
      { key: 'todo', label: 'TodoList Divisi', icon: Briefcase, path: '/todo' },
      { key: 'tugas_disposisi', label: 'Tugas Disposisi', icon: ClipboardCheck, path: '/tugas_disposisi' },
      { key: 'pengumuman', label: 'Kelola Pengumuman', icon: Megaphone, path: '/pengumuman' },
    ],
  },
  {
    groupTitle: 'KBM & Presensi',
    items: [
      { key: 'agenda', label: 'Agenda & Presensi Guru', icon: BookHeart, path: '/agenda' },
      { key: 'izin', label: 'Izin & Delegasi Tugas', icon: FileText, path: '/izin' },
      { key: 'presensi', label: 'Input Presensi Siswa', icon: CalendarCheck, path: '/presensi' },
      { key: 'nilai', label: 'Input Nilai Siswa', icon: ClipboardList, path: '/nilai' },
    ],
  },
  {
    groupTitle: 'Piket & Pengawasan',
    items: [
      { key: 'piket', label: 'Dashboard Piket', icon: ShieldCheck, path: '/piket' },
      { key: 'kehadiran_piket', label: 'Presensi Piket KBM', icon: UserCheck, path: '/kehadiran_piket' },
      { key: 'kehadiran_piket_penyambutan', label: 'Presensi Piket Penyambutan', icon: UserCheck, path: '/kehadiran_piket_penyambutan' },
    ],
  },  
  {
    groupTitle: 'Akademik',
    items: [
      { key: 'jadwal_kbm', label: 'Jadwal KBM', icon: CalendarDays, path: '/jadwal_kbm' },
      { key: 'jadwal_kbm_jps', label: 'Jadwal KBM JPS', icon: CalendarDays, path: '/jadwal_kbm_jps' },
      { key: 'jadwal_piket', label: 'Jadwal Piket KBM', icon: CalendarCheck, path: '/jadwal_piket' },
    ],
  },
  {
    groupTitle: 'Kesiswaan',
    items: [
      { key: 'siswa', label: 'Data Siswa', icon: Users, path: '/siswa' },
      { key: 'presensi_kesiswaan', label: 'Input Presensi Siswa (Kesiswaan)', icon: UserCheck, path: '/presensi_kesiswaan' },
      { key: 'kenaikan_kelas', label: 'Kenaikan Kelas', icon: TrendingUp, path: '/kenaikan_kelas' },
      { key: 'kelulusan', label: 'Kelulusan & Alumni', icon: Award, path: '/kelulusan' },
      { key: 'riwayat_siswa', label: 'Riwayat & Rekam Jejak', icon: History, path: '/riwayat_siswa' },
      { key: 'mutasi_siswa', label: 'Mutasi & Siswa Keluar', icon: UserMinus, path: '/mutasi_siswa' },
      { key: 'jadwal_piket_penyambutan', label: 'Jadwal Piket Penyambutan', icon: CalendarCheck, path: '/jadwal_piket_penyambutan' },
    ],
  },
  {
    groupTitle: 'Humas-Kepegawaian-Tata Kelola',
    items: [
      { key: 'surat', label: 'Tata Kelola Surat', icon: Mails, path: '/surat' },
      
    ],
  },
  {
    groupTitle: 'Data Master & Sistem',
    items: [
      { key: 'sekolah', label: 'Data Sekolah', icon: Settings, path: '/sekolah' },
      { key: 'kelas', label: 'Data Kelas', icon: School, path: '/kelas' },
      { key: 'guru', label: 'Data Guru', icon: UserCog, path: '/guru' },
      { key: 'hak_akses', label: 'Kelola Hak Akses', icon: Shield, path: '/hak_akses' },
    ],
  },
  {
    groupTitle: 'Rekap & Laporan',
    items: [
      { key: 'rekap_presensi_siswa', label: 'Rekap Presensi Siswa', icon: FileBarChart, path: '/rekap_presensi_siswa' },
      { key: 'rekap_presensi_kesiswaan', label: 'Rekap Presensi Siswa (Kesiswaan)', icon: FileBarChart, path: '/rekap_presensi_kesiswaan' },
      { key: 'rekap_nilai', label: 'Rekap Nilai Siswa', icon: FileBarChart, path: '/rekap_nilai' },
      { key: 'rekap_presensi_guru', label: 'Rekap Presensi Guru', icon: FileBarChart, path: '/rekap_presensi_guru' },
      { key: 'rekap_agenda', label: 'Rekap Agenda Guru', icon: FileBarChart, path: '/rekap_agenda' },
      { key: 'rekap_izin', label: 'Rekap Izin Guru', icon: FileBarChart, path: '/rekap_izin' },
    ],
  },
];