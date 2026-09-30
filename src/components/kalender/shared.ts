// src/components/kalender/shared.ts
// Helper & konstanta untuk Modul Kalender Akademik.

import type {
  KalenderKategori, KalenderWarna, KalenderEvent,
  RencanaKegiatan, RapatWithRelations, HariLibur,
} from '@/types/database';

// =============================================================================
// AUTO-KATEGORI BY KEYWORD
// =============================================================================
const KEYWORD_MAP: Array<{
  kategori: KalenderKategori;
  warna: KalenderWarna;
  label: string;
  keywords: string[];
}> = [
  {
    kategori: 'ujian',
    warna: 'rose',
    label: 'Ujian',
    keywords: ['ujian', 'uas', 'uts', 'penilaian', 'asesmen', 'tryout', 'try out', 'anbk', 'asesmen nasional'],
  },
  {
    kategori: 'libur',
    warna: 'slate',
    label: 'Libur',
    keywords: ['libur', 'cuti', 'hari besar', 'hari raya', 'idul', 'natal', 'nyepi', 'waisak'],
  },
  {
    kategori: 'rapat',
    warna: 'blue',
    label: 'Rapat',
    keywords: ['rapat', 'koordinasi', 'monev', 'monitoring', 'evaluasi'],
  },
  {
    kategori: 'pelatihan',
    warna: 'purple',
    label: 'Pelatihan',
    keywords: ['workshop', 'pelatihan', 'seminar', 'diklat', 'bimtek', 'iht', 'in house training'],
  },
  {
    kategori: 'lomba',
    warna: 'amber',
    label: 'Lomba',
    keywords: ['lomba', 'kompetisi', 'olimpiade', 'turnamen', 'kontes', 'festival'],
  },
  {
    kategori: 'siswa',
    warna: 'teal',
    label: 'Kegiatan Siswa',
    keywords: ['study tour', 'kunjungan', 'ekstrakurikuler', 'ekskul', 'pkl', 'prakerin', 'mpls', 'osis', 'pentas seni', 'classmeeting', 'class meeting'],
  },
];

export function detectKategori(judul: string): {
  kategori: KalenderKategori;
  warna: KalenderWarna;
  label: string;
} {
  const lower = judul.toLowerCase();
  for (const item of KEYWORD_MAP) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return {
        kategori: item.kategori,
        warna: item.warna,
        label: item.label,
      };
    }
  }
  return {
    kategori: 'default',
    warna: 'indigo',
    label: 'Agenda',
  };
}

// =============================================================================
// MAPPER: DB ROW → KalenderEvent
// =============================================================================
export function mapRencanaToEvent(k: RencanaKegiatan): KalenderEvent {
  const { kategori, warna, label } = detectKategori(k.nama_kegiatan);
  return {
    id: `rencana-${k.id ?? Math.random()}`,
    source: 'rencana',
    source_id: String(k.id ?? ''),
    judul: k.nama_kegiatan,
    deskripsi: k.deskripsi ?? null,
    tanggal_mulai: k.tanggal_mulai,
    tanggal_selesai: k.tanggal_selesai || k.tanggal_mulai,
    penanggung_jawab: k.penanggung_jawab ?? null,
    peserta: k.peserta ?? null,
    status: k.status ?? null,
    kategori,
    warna,
    kategori_label: label,
  };
}

export function mapRapatToEvent(r: RapatWithRelations): KalenderEvent {
  // ✅ Fixed: rapat selalu warna biru, tidak perlu comparison dengan 'default'
  return {
    id: `rapat-${r.id}`,
    source: 'rapat',
    source_id: r.id,
    judul: r.judul,
    deskripsi: r.deskripsi ?? null,
    tanggal_mulai: r.tanggal,
    tanggal_selesai: r.tanggal,
    waktu_mulai: r.waktu_mulai ?? null,
    waktu_selesai: r.waktu_selesai ?? null,
    lokasi: r.lokasi ?? null,
    penanggung_jawab: r.pemimpin_nama ?? null,
    peserta: r.total_peserta ? `${r.total_peserta} peserta` : null,
    status: r.status,
    kategori: 'rapat',
    warna: 'blue',
    kategori_label: 'Rapat',
  };
}

export function mapLiburToEvent(l: HariLibur): KalenderEvent {
  return {
    id: `libur-${l.id}`,
    source: 'libur',
    source_id: String(l.id),
    judul: l.keterangan,
    deskripsi: null,
    tanggal_mulai: l.tanggal,
    tanggal_selesai: l.tanggal,
    kategori: 'libur',
    warna: 'slate',
    kategori_label: 'Hari Libur',
  };
}

// =============================================================================
// COLOR STYLE — untuk cell & badge
// =============================================================================
export const WARNA_BG: Record<KalenderWarna, string> = {
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  slate: 'bg-slate-700/30 border-slate-600/40 text-slate-300',
  purple: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  teal: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
  cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  indigo: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
  emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
};

export const WARNA_DOT: Record<KalenderWarna, string> = {
  rose: 'bg-rose-400',
  blue: 'bg-blue-400',
  slate: 'bg-slate-500',
  purple: 'bg-purple-400',
  amber: 'bg-amber-400',
  teal: 'bg-teal-400',
  cyan: 'bg-cyan-400',
  indigo: 'bg-indigo-400',
  emerald: 'bg-emerald-400',
};

export const WARNA_BORDER_LEFT: Record<KalenderWarna, string> = {
  rose: 'border-l-rose-500',
  blue: 'border-l-blue-500',
  slate: 'border-l-slate-500',
  purple: 'border-l-purple-500',
  amber: 'border-l-amber-500',
  teal: 'border-l-teal-500',
  cyan: 'border-l-cyan-500',
  indigo: 'border-l-indigo-500',
  emerald: 'border-l-emerald-500',
};

// =============================================================================
// DATE HELPERS
// =============================================================================
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isDateInEvent(dateStr: string, event: KalenderEvent): boolean {
  return dateStr >= event.tanggal_mulai && dateStr <= event.tanggal_selesai;
}

export function getEventsForDate(dateStr: string, events: KalenderEvent[]): KalenderEvent[] {
  return events.filter((e) => isDateInEvent(dateStr, e));
}

export function formatTanggalPanjang(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTanggalPendek(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTanggalMini(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  });
}

export function relativeDay(dateStr: string, todayStr: string): string {
  const a = new Date(`${dateStr}T12:00:00+07:00`).getTime();
  const b = new Date(`${todayStr}T12:00:00+07:00`).getTime();
  const diff = Math.round((a - b) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === 2) return 'Lusa';
  if (diff > 0) return `${diff} hari lagi`;
  if (diff === -1) return 'Kemarin';
  return `${Math.abs(diff)} hari lalu`;
}

export function isMultiDay(e: KalenderEvent): boolean {
  return e.tanggal_mulai !== e.tanggal_selesai;
}

export function formatEventRange(e: KalenderEvent): string {
  if (!isMultiDay(e)) return formatTanggalMini(e.tanggal_mulai);
  return `${formatTanggalMini(e.tanggal_mulai)} — ${formatTanggalMini(e.tanggal_selesai)}`;
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================
export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

export const LABEL_CLASS =
  'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2';

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const NAMA_HARI_SINGKAT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];