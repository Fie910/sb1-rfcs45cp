// src/pages/KalenderAkademikPage.tsx
// Kalender Akademik — kalender bulanan + linimasa agenda (rapat + kegiatan + libur).

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, Calendar,
  User, Users, Clock, X, CalendarX, Info, Filter, MapPin,
  CalendarDays, ArrowRight, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';
import { getTodayDateWib } from '@/utils/date';
import { logActivity, AUDIT_MODUL } from '@/utils/audit';
import {
  detectKategori, mapRencanaToEvent, mapRapatToEvent, mapLiburToEvent,
  toDateStr, getEventsForDate,
  formatTanggalPanjang, formatTanggalMini, formatEventRange,
  relativeDay,
  WARNA_BG, WARNA_DOT, WARNA_BORDER_LEFT,
  NAMA_BULAN, NAMA_HARI_SINGKAT,
} from '@/components/kalender/shared';
import type {
  RencanaKegiatan, HariLibur, RapatWithRelations,
  KalenderEvent, KalenderWarna,
} from '@/types/database';

// =============================================================================
// KALENDER CELLS
// =============================================================================
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

  const firstDay = new Date(year, month, 1);
  let firstDayIdx = firstDay.getDay();
  firstDayIdx = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

  const startDate = new Date(year, month, 1 - firstDayIdx);

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(startDate.getDate() + i);

    const cellYear = cellDate.getFullYear();
    const cellMonth = cellDate.getMonth();
    const cellDay = cellDate.getDate();
    const dateStr = toDateStr(cellYear, cellMonth, cellDay);

    const dayOfWeek = cellDate.getDay();

    cells.push({
      date: cellDate,
      dateStr,
      day: cellDay,
      isCurrentMonth: cellMonth === month && cellYear === year,
      isToday: dateStr === today,
      isWeekend: dayOfWeek === 0,
    });
  }

  return cells;
}

// =============================================================================
// KOMPONEN UTAMA
// =============================================================================
export function KalenderAkademikPage() {
  const today = getTodayDateWib();
  const todayDate = new Date(`${today}T12:00:00+07:00`);

  const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth());

  const [events, setEvents] = useState<KalenderEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter by source
  const [showRencana, setShowRencana] = useState(true);
  const [showRapat, setShowRapat] = useState(true);
  const [showLibur, setShowLibur] = useState(true);

  // Selected date detail
  const [selectedDate, setSelectedDate] = useState<string | null>(today);

  // =========================================================================
  // FETCH
  // =========================================================================
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Range: 1 bulan sebelum + current + 1 bulan sesudah
      const startDate = toDateStr(
        currentMonth === 0 ? currentYear - 1 : currentYear,
        currentMonth === 0 ? 11 : currentMonth - 1,
        1
      );
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const lastDayNext = new Date(nextYear, nextMonth + 1, 0).getDate();
      const endDate = toDateStr(nextYear, nextMonth, lastDayNext);

      const [kegiatanRes, liburRes, rapatRes] = await Promise.all([
        supabase
          .from('rencana_kegiatan')
          .select('*')
          .or(`tanggal_mulai.gte.${startDate},tanggal_selesai.gte.${startDate}`)
          .lte('tanggal_mulai', endDate)
          .order('tanggal_mulai', { ascending: true }),
        supabase
          .from('hari_liburs')
          .select('*')
          .gte('tanggal', startDate)
          .lte('tanggal', endDate)
          .order('tanggal', { ascending: true }),
        // ✅ RAPAT: public saja, skip yang dibatalkan
        supabase
          .from('v_rapat_lengkap')
          .select('*')
          .eq('is_public', true)
          .neq('status', 'Dibatalkan')
          .gte('tanggal', startDate)
          .lte('tanggal', endDate)
          .order('tanggal', { ascending: true }),
      ]);

      if (kegiatanRes.error) console.error('[kalender] kegiatan:', kegiatanRes.error);
      if (liburRes.error) console.error('[kalender] libur:', liburRes.error);
      if (rapatRes.error) console.warn('[kalender] rapat:', rapatRes.error);

      const kegiatanList = (kegiatanRes.data as RencanaKegiatan[]) ?? [];
      const liburList = (liburRes.data as HariLibur[]) ?? [];
      const rapatList = (rapatRes.data as RapatWithRelations[]) ?? [];

      const merged: KalenderEvent[] = [
        ...kegiatanList.map(mapRencanaToEvent),
        ...rapatList.map(mapRapatToEvent),
        ...liburList.map(mapLiburToEvent),
      ];

      setEvents(merged);
    } catch (err) {
      console.error('[kalender] fetch:', err);
      showToast('error', 'Gagal memuat data kalender');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Log VIEW
  useEffect(() => {
    logActivity({
      aksi: 'VIEW',
      modul: AUDIT_MODUL.AUTH,
      deskripsi: 'Membuka Kalender Akademik',
    });
  }, []);

  // =========================================================================
  // DERIVED
  // =========================================================================
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.source === 'rencana' && !showRencana) return false;
      if (e.source === 'rapat' && !showRapat) return false;
      if (e.source === 'libur' && !showLibur) return false;
      return true;
    });
  }, [events, showRencana, showRapat, showLibur]);

  const cells = useMemo(
    () => generateCalendarCells(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Linimasa: event dari hari ini s.d. 60 hari ke depan (multi-hari di-flatten)
  const timeline = useMemo(() => {
    const todayStr = getTodayDateWib();
    const futureLimit = new Date(`${todayStr}T12:00:00+07:00`);
    futureLimit.setDate(futureLimit.getDate() + 60);
    const limitStr = futureLimit.toISOString().slice(0, 10);

    return filteredEvents
      .filter((e) => e.tanggal_selesai >= todayStr && e.tanggal_mulai <= limitStr)
      .sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai))
      .slice(0, 20);
  }, [filteredEvents]);

  // Event untuk tanggal terpilih
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDate(selectedDate, filteredEvents)
      .sort((a, b) => {
        // Urutkan: libur dulu, lalu berdasarkan waktu mulai
        if (a.source === 'libur' && b.source !== 'libur') return -1;
        if (b.source === 'libur' && a.source !== 'libur') return 1;
        return (a.waktu_mulai ?? '').localeCompare(b.waktu_mulai ?? '');
      });
  }, [selectedDate, filteredEvents]);

  // =========================================================================
  // NAVIGASI
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
    setSelectedDate(today);
  };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <CalendarRange size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-100 tracking-tight">
              Kalender Akademik
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Agenda sekolah, rapat, & hari libur terpadu
            </p>
          </div>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-slate-500" />
        <button
          onClick={() => setShowRencana((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
            showRencana
              ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showRencana ? 'bg-indigo-400' : 'bg-slate-600'}`} />
          Agenda Sekolah
        </button>
        <button
          onClick={() => setShowRapat((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
            showRapat
              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showRapat ? 'bg-blue-400' : 'bg-slate-600'}`} />
          Rapat
        </button>
        <button
          onClick={() => setShowLibur((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
            showLibur
              ? 'bg-slate-500/15 border-slate-500/30 text-slate-300'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${showLibur ? 'bg-slate-400' : 'bg-slate-600'}`} />
          Hari Libur
        </button>
      </div>

      {/* MAIN LAYOUT: KALENDER (2/3) + LINIMASA (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ============ KALENDER BULANAN ============ */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Nav bulan */}
          <div className="flex items-center justify-between p-3 border-b border-slate-800">
            <button
              onClick={goPrevMonth}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-3">
              <p className="text-sm font-extrabold text-slate-100">
                {NAMA_BULAN[currentMonth]} {currentYear}
              </p>
              <button
                onClick={goToday}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition cursor-pointer"
              >
                Hari Ini
              </button>
            </div>

            <button
              onClick={goNextMonth}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Kalender */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
            </div>
          ) : (
            <>
              {/* Header hari */}
              <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60">
                {NAMA_HARI_SINGKAT.map((hari, idx) => (
                  <div
                    key={hari}
                    className={`py-2 text-center text-[10px] font-extrabold uppercase tracking-wider ${
                      idx >= 6 ? 'text-rose-400' : 'text-slate-500'
                    }`}
                  >
                    {hari}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                  const dayEvents = getEventsForDate(cell.dateStr, filteredEvents);
                  const isSelected = selectedDate === cell.dateStr;
                  const isLibur = dayEvents.some((e) => e.source === 'libur');
                  const borderRight = (idx + 1) % 7 !== 0 ? 'border-r' : '';
                  const borderBottom = idx < 35 ? 'border-b' : '';

                  return (
                    <button
                      key={cell.dateStr}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`relative min-h-[72px] md:min-h-[88px] p-1.5 text-left transition cursor-pointer hover:bg-slate-800/50 ${borderRight} ${borderBottom} border-slate-800/60 ${
                        !cell.isCurrentMonth
                          ? 'bg-slate-950/40'
                          : isLibur
                          ? 'bg-slate-800/20'
                          : cell.isWeekend
                          ? 'bg-slate-900/60'
                          : 'bg-slate-900'
                      } ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 ring-inset'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                            cell.isToday
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : !cell.isCurrentMonth
                              ? 'text-slate-700'
                              : isLibur
                              ? 'text-slate-400'
                              : cell.isWeekend
                              ? 'text-rose-300'
                              : 'text-slate-300'
                          }`}
                        >
                          {cell.day}
                        </span>

                        {/* Dot indicators */}
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-0.5 mt-1">
                            {dayEvents.slice(0, 3).map((e, i) => (
                              <span
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${WARNA_DOT[e.warna]}`}
                              />
                            ))}
                            {dayEvents.length > 3 && (
                              <span className="text-[8px] text-slate-500 font-bold">
                                +{dayEvents.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Preview titles (desktop) */}
                      <div className="hidden md:block mt-1 space-y-0.5">
                        {dayEvents.slice(0, 2).map((e, i) => (
                          <div
                            key={i}
                            className="text-[9px] font-semibold truncate leading-tight text-slate-400"
                            title={e.judul}
                          >
                            • {e.judul}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-slate-600 italic">
                            +{dayEvents.length - 2} lagi
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 p-3 border-t border-slate-800 bg-slate-950/40 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Ujian
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Rapat
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Pelatihan
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Lomba
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-400" /> Siswa
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-500" /> Libur
                </span>
              </div>
            </>
          )}
        </div>

        {/* ============ LINIMASA ============ */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col max-h-[600px]">
          <div className="flex items-center justify-between p-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-indigo-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Linimasa Agenda
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-bold">
              {timeline.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {timeline.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-[11px] text-slate-500">
                  Belum ada agenda mendatang
                </p>
              </div>
            ) : (
              timeline.map((e) => {
                const relative = relativeDay(e.tanggal_mulai, today);
                const isToday = e.tanggal_mulai === today;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedDate(e.tanggal_mulai)}
                    className={`w-full text-left bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 rounded-xl p-2.5 transition cursor-pointer border-l-4 ${WARNA_BORDER_LEFT[e.warna]}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${WARNA_BG[e.warna]}`}>
                        {e.kategori_label}
                      </span>
                      <span
                        className={`text-[9px] font-bold ${
                          isToday ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {relative}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-200 line-clamp-2">
                      {e.judul}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={9} />
                        {formatEventRange(e)}
                      </span>
                      {e.waktu_mulai && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={9} />
                          {e.waktu_mulai.slice(0, 5)}
                        </span>
                      )}
                    </div>

                    {e.lokasi && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5 inline-flex items-center gap-1">
                        <MapPin size={9} /> {e.lokasi}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ============ DETAIL TANGGAL TERPILIH ============ */}
      {selectedDate && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-100">
                  {formatTanggalPanjang(selectedDate)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selectedEvents.length > 0
                    ? `${selectedEvents.length} agenda`
                    : 'Tidak ada agenda'}
                  {' · '}
                  {relativeDay(selectedDate, today)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="text-center py-10">
              <Info size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">
                Tidak ada agenda atau libur pada tanggal ini
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {selectedEvents.map((e) => (
                <EventDetailCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB: Event Detail Card
// =============================================================================
function EventDetailCard({ event }: { event: KalenderEvent }) {
  return (
    <div
      className={`bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 border-l-4 ${WARNA_BORDER_LEFT[event.warna]}`}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${WARNA_BG[event.warna]}`}>
              {event.kategori_label}
            </span>
            {event.status && event.source === 'rapat' && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  event.status === 'Selesai'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : event.status === 'Berlangsung'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                }`}
              >
                {event.status}
              </span>
            )}
            {event.source === 'rapat' && (
              <span className="text-[9px] font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                Rapat
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-100">{event.judul}</p>
        </div>
      </div>

      {event.deskripsi && (
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
          {event.deskripsi}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
        {event.waktu_mulai && (
          <span className="inline-flex items-center gap-1">
            <Clock size={10} className="text-slate-500" />
            {event.waktu_mulai.slice(0, 5)}
            {event.waktu_selesai ? ` - ${event.waktu_selesai.slice(0, 5)}` : ''} WIB
          </span>
        )}
        {event.lokasi && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={10} className="text-slate-500" />
            {event.lokasi}
          </span>
        )}
        {event.penanggung_jawab && (
          <span className="inline-flex items-center gap-1">
            <User size={10} className="text-slate-500" />
            {event.penanggung_jawab}
          </span>
        )}
        {event.peserta && (
          <span className="inline-flex items-center gap-1">
            <Users size={10} className="text-slate-500" />
            {event.peserta}
          </span>
        )}
      </div>
    </div>
  );
}