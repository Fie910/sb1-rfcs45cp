import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  User,
  Users,
  Clock,
  AlertCircle,
  X,
  Filter,
  CalendarX,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { getTodayDateWib } from '@/lib/date';
import { logActivity, AUDIT_MODUL } from '@/lib/audit';
import type { RencanaKegiatan, HariLibur } from '@/types/database';

// =============================================================================
// KONSTANTA
// =============================================================================

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const NAMA_HARI_SINGKAT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// =============================================================================
// HELPER
// =============================================================================

/** Format Date → YYYY-MM-DD (tanpa timezone shift). */
function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Cek apakah tanggal `dateStr` (YYYY-MM-DD) berada dalam range
 * [tanggal_mulai, tanggal_selesai] dari kegiatan. Kedua field di DB bisa
 * berbeda atau salah satunya kosong (untuk event 1 hari).
 */
function isDateInKegiatan(dateStr: string, kegiatan: RencanaKegiatan): boolean {
  const start = kegiatan.tanggal_mulai;
  const end = kegiatan.tanggal_selesai || kegiatan.tanggal_mulai;
  if (!start) return false;
  return dateStr >= start && dateStr <= end;
}

/**
 * Ambil semua kegiatan yang aktif pada tanggal tertentu.
 */
function getKegiatanForDate(
  dateStr: string,
  kegiatanList: RencanaKegiatan[]
): RencanaKegiatan[] {
  return kegiatanList.filter((k) => isDateInKegiatan(dateStr, k));
}

/**
 * Generate array 42 cell (6 minggu × 7 hari) untuk bulan tertentu.
 * Cell pertama adalah hari Senin dari minggu yang memuat tanggal 1.
 */
type CalendarCell = {
  date: Date;
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
};

function generateCalendarCells(year: number, month: number): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const today = getTodayDateWib();

  // Cari tanggal 1 bulan ini
  const firstDay = new Date(year, month, 1);
  // JS: 0=Minggu, 1=Senin, ... 6=Sabtu
  // Kita mulai dari Senin, jadi: Senin=0, Selasa=1, ..., Minggu=6
  let firstDayIdx = firstDay.getDay(); // 0=Minggu, 1=Senin
  firstDayIdx = firstDayIdx === 0 ? 6 : firstDayIdx - 1; // convert ke Senin=0

  // Mulai dari tanggal yang memundurkan ke Senin
  const startDate = new Date(year, month, 1 - firstDayIdx);

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);

    const cellYear = cellDate.getFullYear();
    const cellMonth = cellDate.getMonth();
    const cellDay = cellDate.getDate();
    const dateStr = toDateStr(cellYear, cellMonth, cellDay);

    const dayOfWeek = cellDate.getDay(); // 0=Minggu
    const isWeekend = dayOfWeek === 0;

    cells.push({
      date: cellDate,
      dateStr,
      day: cellDay,
      isCurrentMonth: cellMonth === month && cellYear === year,
      isToday: dateStr === today,
      isWeekend,
    });
  }

  return cells;
}

/** Format tanggal panjang Indonesia: "Senin, 12 September 2026". */
function formatDateLong(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format tanggal pendek untuk tampilan cell: "12 Sep". */
function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
  });
}

// =============================================================================
// KOMPONEN
// =============================================================================

export function KalenderAkademikPage() {
  const today = getTodayDateWib();
  const todayDate = new Date(`${today}T12:00:00+07:00`);

  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());

  const [kegiatanList, setKegiatanList] = useState<RencanaKegiatan[]>([]);
  const [hariLiburList, setHariLiburList] = useState<HariLibur[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [showKegiatan, setShowKegiatan] = useState(true);
  const [showLibur, setShowLibur] = useState(true);

  // Detail modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // =========================================================================
  // FETCH DATA
  // =========================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Ambil data 3 bulan (1 bulan sebelum + current + 1 bulan sesudah)
      const startDate = toDateStr(
        currentMonth === 0 ? currentYear - 1 : currentYear,
        currentMonth === 0 ? 11 : currentMonth - 1,
        1
      );
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const lastDayNext = new Date(nextYear, nextMonth + 1, 0).getDate();
      const endDate = toDateStr(nextYear, nextMonth, lastDayNext);

      const [kegiatanRes, liburRes] = await Promise.all([
        supabase
          .from('rencana_kegiatan')
          .select('*')
          .or(
            `tanggal_mulai.gte.${startDate},tanggal_selesai.gte.${startDate}`
          )
          .lte('tanggal_mulai', endDate)
          .order('tanggal_mulai', { ascending: true }),
        supabase
          .from('hari_liburs')
          .select('*')
          .gte('tanggal', startDate)
          .lte('tanggal', endDate)
          .order('tanggal', { ascending: true }),
      ]);

      if (kegiatanRes.error) {
        console.error('Error fetching kegiatan:', kegiatanRes.error);
      }
      if (liburRes.error) {
        console.error('Error fetching hari libur:', liburRes.error);
      }

      setKegiatanList((kegiatanRes.data as RencanaKegiatan[]) || []);
      setHariLiburList((liburRes.data as HariLibur[]) || []);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
      showToast('error', 'Gagal memuat data kalender');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Log VIEW sekali
  useEffect(() => {
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka Kalender Akademik',
    });
  }, []);

  // =========================================================================
  // DERIVED DATA
  // =========================================================================
  const cells = useMemo(
    () => generateCalendarCells(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Map libur by tanggal untuk lookup cepat
  const liburMap = useMemo(() => {
    const map = new Map<string, HariLibur>();
    hariLiburList.forEach((l) => map.set(l.tanggal, l));
    return map;
  }, [hariLiburList]);

  // =========================================================================
  // NAVIGASI BULAN
  // =========================================================================
  const goPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setCurrentYear(todayDate.getFullYear());
    setCurrentMonth(todayDate.getMonth());
  };

  // =========================================================================
  // DETAIL MODAL
  // =========================================================================
  const kegiatanHariIni = selectedDate
    ? getKegiatanForDate(selectedDate, kegiatanList)
    : [];
  const liburHariIni = selectedDate ? liburMap.get(selectedDate) : undefined;

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <CalendarRange size={26} />
            </div>
            Kalender Akademik Terpadu
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Gabungan agenda sekolah & hari libur dalam satu tampilan
          </p>
        </div>
      </div>

      {/* NAVIGASI BULAN + FILTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Nav Bulan */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrevMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-[180px] text-center">
            <p className="text-lg font-extrabold text-slate-100 tracking-tight">
              {NAMA_BULAN[currentMonth]} {currentYear}
            </p>
          </div>

          <button
            onClick={goNextMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Bulan Berikutnya"
          >
            <ChevronRight size={18} />
          </button>

          <button
            onClick={goToday}
            className="ml-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Hari Ini
          </button>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-500" />
          <button
            onClick={() => setShowKegiatan((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              showKegiatan
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            Agenda
          </button>
          <button
            onClick={() => setShowLibur((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              showLibur
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            Libur
          </button>
        </div>
      </div>

      {/* KALENDER GRID */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin text-indigo-400" size={28} />
          </div>
        ) : (
          <>
            {/* Header Hari */}
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60">
              {NAMA_HARI_SINGKAT.map((hari, idx) => (
                <div
                  key={hari}
                  className={`py-3 text-center text-[11px] font-extrabold uppercase tracking-wider ${
                    idx >= 5 ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {hari}
                </div>
              ))}
            </div>

            {/* Grid Cell */}
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
                const libur = showLibur ? liburMap.get(cell.dateStr) : undefined;
                const kegiatans = showKegiatan
                  ? getKegiatanForDate(cell.dateStr, kegiatanList)
                  : [];
                const hasKegiatan = kegiatans.length > 0;
                const isLibur = !!libur;

                // Border vertical & horizontal
                const borderRight = (idx + 1) % 7 !== 0 ? 'border-r' : '';
                const borderBottom = idx < 35 ? 'border-b' : '';

                return (
                  <button
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`relative min-h-[80px] md:min-h-[110px] p-2 text-left transition-colors cursor-pointer hover:bg-slate-800/50 ${borderRight} ${borderBottom} border-slate-800/60 ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-950/40'
                        : isLibur
                        ? 'bg-rose-950/20'
                        : cell.isWeekend
                        ? 'bg-slate-900/60'
                        : 'bg-slate-900'
                    }`}
                  >
                    {/* Nomor tanggal */}
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 rounded-full text-[11px] md:text-xs font-bold ${
                          cell.isToday
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : !cell.isCurrentMonth
                            ? 'text-slate-600'
                            : isLibur
                            ? 'text-rose-300'
                            : cell.isWeekend
                            ? 'text-rose-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {cell.day}
                      </span>

                      {/* Indicator dots */}
                      {(hasKegiatan || isLibur) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {hasKegiatan && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          )}
                          {isLibur && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                        </div>
                      )}
                    </div>

                    {/* Preview list (desktop only) */}
                    <div className="hidden md:block mt-1.5 space-y-1">
                      {isLibur && (
                        <div className="text-[10px] font-bold text-rose-300 truncate flex items-center gap-1">
                          <CalendarX size={10} />
                          <span className="truncate">{libur.keterangan}</span>
                        </div>
                      )}
                      {kegiatans.slice(0, 2).map((k, i) => (
                        <div
                          key={`${k.id}-${i}`}
                          className="text-[10px] font-semibold text-indigo-300 truncate leading-tight"
                          title={k.nama_kegiatan}
                        >
                          • {k.nama_kegiatan}
                        </div>
                      ))}
                      {kegiatans.length > 2 && (
                        <div className="text-[10px] text-slate-500 italic">
                          +{kegiatans.length - 2} lainnya
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* LEGEND */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-indigo-600 border border-indigo-400/30" />
          Hari ini
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />
          Ada agenda
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
          Hari libur
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-600" />
          Hari di luar bulan aktif
        </div>
      </div>

      {/* MODAL DETAIL TANGGAL */}
      <Modal
        open={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDateLong(selectedDate) : ''}
        size="md"
      >
        {selectedDate && (
          <div className="space-y-4 pt-1">
            {/* Hari Libur */}
            {liburHariIni && (
              <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <CalendarX size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-0.5">
                    Hari Libur
                  </p>
                  <p className="text-sm font-bold text-rose-200">
                    {liburHariIni.keterangan}
                  </p>
                  <p className="text-[11px] text-rose-400/70 mt-0.5">
                    Kegiatan KBM tidak berlangsung pada tanggal ini
                  </p>
                </div>
              </div>
            )}

            {/* Agenda Kegiatan */}
            {kegiatanHariIni.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Calendar size={14} className="text-indigo-400" />
                  Agenda Kegiatan ({kegiatanHariIni.length})
                </div>

                {kegiatanHariIni.map((k) => (
                  <div
                    key={k.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-slate-100 text-sm">
                        {k.nama_kegiatan}
                      </h3>
                      {k.status && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            k.status === 'Selesai'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : k.status === 'Berlangsung'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                          }`}
                        >
                          {k.status}
                        </span>
                      )}
                    </div>

                    {/* Periode (kalau multi-hari) */}
                    {k.tanggal_selesai && k.tanggal_selesai !== k.tanggal_mulai && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Clock size={11} className="text-indigo-400" />
                        <span>
                          {formatDateShort(k.tanggal_mulai)} —{' '}
                          {formatDateShort(k.tanggal_selesai)}
                        </span>
                      </div>
                    )}

                    {k.deskripsi && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {k.deskripsi}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-indigo-400" />
                        <span>
                          PJ: <strong className="text-slate-300">{k.penanggung_jawab}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={11} className="text-teal-400" />
                        <span>
                          Peserta: <strong className="text-slate-300">{k.peserta}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !liburHariIni && (
                <div className="text-center py-10 text-slate-500">
                  <Info size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Tidak ada agenda atau libur pada tanggal ini</p>
                </div>
              )
            )}

            {/* Info tambahan kalau ada libur tapi tidak ada agenda */}
            {liburHariIni && kegiatanHariIni.length === 0 && (
              <div className="text-center py-4 text-slate-500 text-[11px] italic">
                Tidak ada agenda terjadwal pada hari libur ini
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}