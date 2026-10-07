// src/components/dashboard/ShortcutGrid.tsx
// Grid shortcut dashboard — customizable oleh user.
// Dual label: label (panjang, untuk picker) + shortLabel (pendek, untuk grid).

import {
  CalendarDays, BookOpenCheck, FileText, ClipboardCheck, UserCheck,
  ShieldCheck, ListChecks, Inbox, MessageSquare, UserCog, Users,
  Building2, FolderArchive, TrendingUp, GraduationCap, Wallet,
  FileSignature, History, BarChart3, Settings, Bell, HelpCircle,
  Loader2, Edit3, Plus,
  // Tambahan
  LayoutDashboard, LineChart, Mail, ArrowUpCircle, Award,
  ArrowRightLeft, AlertOctagon, School, CalendarClock, Clock,
  CalendarCheck, FileSpreadsheet, KeyRound, CalendarX, FileSearch,
  UserPlus, Heart, Library, UserMinus, Archive, BookMarked,
  ClipboardList, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { PageKey } from '@/config/navigation';

// =============================================================================
// PAGE MAPPING — label & shortLabel
// =============================================================================
type ShortcutConfig = {
  label: string;
  shortLabel: string;
  icon: any;
  path: string;
  color: string;
};

const PAGE_CONFIG: Record<string, ShortcutConfig> = {
  // ─────────────────────────────────────────────────────────────────
  // PRESENSI & AGENDA
  // ─────────────────────────────────────────────────────────────────
  kalender_akademik: {
    label: 'Kalender Akademik',
    shortLabel: 'Kalender',
    icon: CalendarDays,
    path: '/kalender_akademik',
    color: 'indigo',
  },
  agenda: {
    label: 'Agenda & Presensi Guru',
    shortLabel: 'Agenda Guru',
    icon: BookOpenCheck,
    path: '/agenda',
    color: 'blue',
  },
  izin: {
    label: 'Izin & Delegasi Tugas',
    shortLabel: 'Izin & Tugas',
    icon: FileText,
    path: '/izin',
    color: 'amber',
  },
  presensi: {
    label: 'Input Presensi Siswa',
    shortLabel: 'Presensi Siswa',
    icon: ClipboardCheck,
    path: '/presensi',
    color: 'emerald',
  },
  kehadiran_piket_penyambutan: {
    label: 'Presensi Piket Penyambutan',
    shortLabel: 'Penyambutan',
    icon: UserCheck,
    path: '/kehadiran_piket_penyambutan',
    color: 'teal',
  },
  piket: {
    label: 'Dashboard Piket',
    shortLabel: 'Piket',
    icon: ShieldCheck,
    path: '/piket',
    color: 'cyan',
  },

  // ─────────────────────────────────────────────────────────────────
  // KERJA / TUGAS
  // ─────────────────────────────────────────────────────────────────
  todo: {
    label: 'Todo List Divisi',
    shortLabel: 'Todo Divisi',
    icon: ListChecks,
    path: '/todo',
    color: 'purple',
  },
  tugas_disposisi: {
    label: 'Tugas Disposisi',
    shortLabel: 'Disposisi',
    icon: Inbox,
    path: '/tugas_disposisi',
    color: 'indigo',
  },
  saran_pengaduan: {
    label: 'Saran & Pengaduan',
    shortLabel: 'Saran',
    icon: MessageSquare,
    path: '/saran_pengaduan',
    color: 'rose',
  },

  // ─────────────────────────────────────────────────────────────────
  // KEPEGAWAIAN & MANAJEMEN
  // ─────────────────────────────────────────────────────────────────
  hris: {
    label: 'Data Kepegawaian',
    shortLabel: 'Data Pegawai',
    icon: UserCog,
    path: '/hris',
    color: 'pink',
  },
  rapat: {
    label: 'Rapat & Notulensi',
    shortLabel: 'Rapat',
    icon: Users,
    path: '/rapat',
    color: 'indigo',
  },
  mitra: {
    label: 'Mitra DUDI',
    shortLabel: 'Mitra',
    icon: Building2,
    path: '/mitra',
    color: 'teal',
  },
  arsip: {
    label: 'Arsip Digital',
    shortLabel: 'Arsip',
    icon: FolderArchive,
    path: '/arsip',
    color: 'purple',
  },

  // ─────────────────────────────────────────────────────────────────
  // SISWA & KELAS
  // ─────────────────────────────────────────────────────────────────
  siswa: {
    label: 'Data Siswa',
    shortLabel: 'Siswa',
    icon: GraduationCap,
    path: '/siswa',
    color: 'emerald',
  },
  kelas: {
    label: 'Data Kelas',
    shortLabel: 'Kelas',
    icon: BookOpenCheck,
    path: '/kelas',
    color: 'blue',
  },
  guru: {
    label: 'Data Guru',
    shortLabel: 'Data Guru',
    icon: UserCog,
    path: '/guru',
    color: 'pink',
  },

  // ─────────────────────────────────────────────────────────────────
  // NILAI
  // ─────────────────────────────────────────────────────────────────
  nilai: {
    label: 'Input Nilai',
    shortLabel: 'Nilai',
    icon: TrendingUp,
    path: '/nilai',
    color: 'amber',
  },
  rekap_nilai: {
    label: 'Rekap Nilai',
    shortLabel: 'Rekap Nilai',
    icon: BarChart3,
    path: '/rekap_nilai',
    color: 'indigo',
  },

  // ─────────────────────────────────────────────────────────────────
  // SARANA & PRASARANA
  // ─────────────────────────────────────────────────────────────────
  sarpras: {
    label: 'Sarana Prasarana',
    shortLabel: 'Inventaris',
    icon: Building2,
    path: '/sarpras',
    color: 'cyan',
  },

  // ─────────────────────────────────────────────────────────────────
  // KESISWAAN
  // ─────────────────────────────────────────────────────────────────
  kenaikan_kelas: {
    label: 'Kenaikan Kelas',
    shortLabel: 'Kenaikan',
    icon: ArrowUpCircle,
    path: '/kenaikan_kelas',
    color: 'emerald',
  },
  kelulusan: {
    label: 'Kelulusan Siswa',
    shortLabel: 'Kelulusan',
    icon: Award,
    path: '/kelulusan',
    color: 'amber',
  },
  riwayat_siswa: {
    label: 'Riwayat Siswa',
    shortLabel: 'Riwayat',
    icon: History,
    path: '/riwayat_siswa',
    color: 'slate',
  },
  mutasi_siswa: {
    label: 'Mutasi Siswa',
    shortLabel: 'Mutasi',
    icon: ArrowRightLeft,
    path: '/mutasi_siswa',
    color: 'indigo',
  },
  kedisiplinan: {
    label: 'Kedisiplinan Siswa',
    shortLabel: 'Disiplin',
    icon: AlertOctagon,
    path: '/kedisiplinan',
    color: 'rose',
  },
  presensi_kesiswaan: {
    label: 'Presensi Kesiswaan',
    shortLabel: 'Presensi Kesiswaan',
    icon: ClipboardCheck,
    path: '/presensi_kesiswaan',
    color: 'teal',
  },

  // ─────────────────────────────────────────────────────────────────
  // JADWAL
  // ─────────────────────────────────────────────────────────────────
  jadwal_kbm: {
    label: 'Jadwal KBM',
    shortLabel: 'Jadwal KBM',
    icon: CalendarClock,
    path: '/jadwal_kbm',
    color: 'indigo',
  },
  jadwal_kbm_jps: {
    label: 'Jadwal KBM JPS',
    shortLabel: 'KBM JPS',
    icon: Clock,
    path: '/jadwal_kbm_jps',
    color: 'blue',
  },
  jadwal_piket: {
    label: 'Jadwal Piket',
    shortLabel: 'Jadwal Piket',
    icon: CalendarCheck,
    path: '/jadwal_piket',
    color: 'cyan',
  },
  jadwal_piket_penyambutan: {
    label: 'Jadwal Piket Penyambutan',
    shortLabel: 'Jadwal Sambut',
    icon: CalendarDays,
    path: '/jadwal_piket_penyambutan',
    color: 'teal',
  },
  kehadiran_piket: {
    label: 'Kehadiran Piket',
    shortLabel: 'Kehadiran Piket',
    icon: UserCheck,
    path: '/kehadiran_piket',
    color: 'emerald',
  },

  // ─────────────────────────────────────────────────────────────────
  // REKAP
  // ─────────────────────────────────────────────────────────────────
  rekap_presensi_siswa: {
    label: 'Rekap Presensi Siswa',
    shortLabel: 'Rekap Presensi',
    icon: FileSpreadsheet,
    path: '/rekap_presensi_siswa',
    color: 'emerald',
  },
  rekap_presensi_kesiswaan: {
    label: 'Rekap Presensi Kesiswaan',
    shortLabel: 'Rekap Kesiswaan',
    icon: FileSpreadsheet,
    path: '/rekap_presensi_kesiswaan',
    color: 'teal',
  },
  rekap_presensi_guru: {
    label: 'Rekap Presensi Guru',
    shortLabel: 'Rekap Guru',
    icon: FileSpreadsheet,
    path: '/rekap_presensi_guru',
    color: 'blue',
  },
  rekap_agenda: {
    label: 'Rekap Agenda',
    shortLabel: 'Rekap Agenda',
    icon: FileSpreadsheet,
    path: '/rekap_agenda',
    color: 'indigo',
  },
  rekap_izin: {
    label: 'Rekap Izin',
    shortLabel: 'Rekap Izin',
    icon: FileSpreadsheet,
    path: '/rekap_izin',
    color: 'amber',
  },

  // ─────────────────────────────────────────────────────────────────
  // BK & PERPUSTAKAAN
  // ─────────────────────────────────────────────────────────────────
  bk: {
    label: 'Bimbingan Konseling',
    shortLabel: 'BK',
    icon: Heart,
    path: '/bk',
    color: 'pink',
  },
  perpustakaan: {
    label: 'Perpustakaan',
    shortLabel: 'Perpus',
    icon: Library,
    path: '/perpustakaan',
    color: 'purple',
  },

  // ─────────────────────────────────────────────────────────────────
  // KOMUNIKASI & DOKUMEN
  // ─────────────────────────────────────────────────────────────────
  pengumuman: {
    label: 'Pengumuman',
    shortLabel: 'Pengumuman',
    icon: Bell,
    path: '/pengumuman',
    color: 'amber',
  },
  surat: {
    label: 'Surat Menyurat',
    shortLabel: 'Surat',
    icon: Mail,
    path: '/surat',
    color: 'indigo',
  },
  buku_tamu: {
    label: 'Buku Tamu',
    shortLabel: 'Buku Tamu',
    icon: UserPlus,
    path: '/buku_tamu',
    color: 'teal',
  },

  // ─────────────────────────────────────────────────────────────────
  // MASTER DATA & SISTEM
  // ─────────────────────────────────────────────────────────────────
  sekolah: {
    label: 'Data Sekolah',
    shortLabel: 'Data Sekolah',
    icon: School,
    path: '/sekolah',
    color: 'indigo',
  },
  hak_akses: {
    label: 'Hak Akses',
    shortLabel: 'Hak Akses',
    icon: KeyRound,
    path: '/hak_akses',
    color: 'rose',
  },
  hari_libur: {
    label: 'Hari Libur',
    shortLabel: 'Hari Libur',
    icon: CalendarX,
    path: '/hari_libur',
    color: 'amber',
  },
  audit_log: {
    label: 'Audit Log',
    shortLabel: 'Audit Log',
    icon: FileSearch,
    path: '/audit_log',
    color: 'slate',
  },

  // ─────────────────────────────────────────────────────────────────
  // DASHBOARD KHUSUS
  // ─────────────────────────────────────────────────────────────────
  dashboard_kepsek: {
    label: 'Dashboard Kepala Sekolah',
    shortLabel: 'Dash Kepsek',
    icon: LayoutDashboard,
    path: '/dashboard_kepsek',
    color: 'rose',
  },
  monev_divisi: {
    label: 'Monev Divisi',
    shortLabel: 'Monev',
    icon: LineChart,
    path: '/monev_divisi',
    color: 'purple',
  },

  // ─────────────────────────────────────────────────────────────────
  // PROFIL
  // ─────────────────────────────────────────────────────────────────
  profile: {
    label: 'Profil Saya',
    shortLabel: 'Profil',
    icon: UserCog,
    path: '/profil',
    color: 'slate',
  },
};

// =============================================================================
// COLOR STYLE
// =============================================================================
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; hoverBorder: string }> = {
  indigo: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    hoverBorder: 'hover:border-indigo-500/60',
  },
  blue: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    hoverBorder: 'hover:border-blue-500/60',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/60',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    hoverBorder: 'hover:border-amber-500/60',
  },
  teal: {
    bg: 'bg-teal-500/15',
    text: 'text-teal-400',
    border: 'border-teal-500/30',
    hoverBorder: 'hover:border-teal-500/60',
  },
  cyan: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    hoverBorder: 'hover:border-cyan-500/60',
  },
  purple: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    hoverBorder: 'hover:border-purple-500/60',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    hoverBorder: 'hover:border-rose-500/60',
  },
  pink: {
    bg: 'bg-pink-500/15',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
    hoverBorder: 'hover:border-pink-500/60',
  },
  slate: {
    bg: 'bg-slate-800',
    text: 'text-slate-400',
    border: 'border-slate-700',
    hoverBorder: 'hover:border-slate-600',
  },
};

// =============================================================================
// TYPES
// =============================================================================
type ShortcutItem = {
  page_key: string;
  urutan: number;
};

type Props = {
  shortcuts: ShortcutItem[];
  loading?: boolean;
  onEdit: () => void;
  badgeCounts?: Partial<Record<PageKey, number>>;
};

// =============================================================================
// KOMPONEN
// =============================================================================
export function ShortcutGrid({ shortcuts, loading, onEdit }: Props) {
  const { hasAccess } = useAuth();

  const valid = shortcuts
    .filter((s) => {
      // Filter: ada di config + user punya akses
      if (!PAGE_CONFIG[s.page_key]) return false;
      if (!hasAccess(s.page_key as PageKey)) return false;
      return true;
    })
    .sort((a, b) => a.urutan - b.urutan);


  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Shortcut Saya</h2>
            <p className="text-[10px] text-slate-500">
              {valid.length} menu · bisa dikustomisasi
            </p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition cursor-pointer"
        >
          <Edit3 size={11} /> Atur
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" />
        </div>
      ) : valid.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
          <Plus size={24} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-500 mb-3">Belum ada shortcut</p>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition cursor-pointer"
          >
            <Plus size={11} /> Tambah Shortcut
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {valid.map((s) => {
            const cfg = PAGE_CONFIG[s.page_key];
            const Icon = cfg.icon;
            const colors = COLOR_MAP[cfg.color] ?? COLOR_MAP.indigo;

            return (
              <Link
                key={s.page_key}
                to={cfg.path}
                className={`group flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-slate-950/60 border ${colors.border} ${colors.hoverBorder} transition active:scale-95 cursor-pointer`}
                title={cfg.label}
              >
                <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border ${colors.text} flex items-center justify-center transition group-hover:scale-110`}>
                  <Icon size={18} />
                </div>
                <p className="text-[10px] font-bold text-slate-300 text-center leading-tight line-clamp-2">
                  {cfg.shortLabel}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPORT PAGE CONFIG (untuk Modal Kustom)
// =============================================================================
export { PAGE_CONFIG, COLOR_MAP };
export type { ShortcutConfig };