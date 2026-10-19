// src/lib/kalenderUtils.ts
// Utility untuk recurring event + ICS export.

export type RecurrencePattern = 'Harian' | 'Mingguan' | 'Bulanan';

export type RecurringEventInput = {
  nama_kegiatan: string;
  tanggal_mulai: string;      // YYYY-MM-DD
  tanggal_selesai: string | null;
  recurrence_pattern: RecurrencePattern;
  recurrence_until: string;   // YYYY-MM-DD
  recurrence_days?: number[]; // 0=Minggu, 1=Senin, ..., 6=Sabtu (khusus Mingguan)
};

/**
 * Generate daftar tanggal (YYYY-MM-DD) untuk recurring event.
 * 
 * - Harian: setiap hari dari tanggal_mulai sampai recurrence_until
 * - Mingguan: hanya hari tertentu (misal Senin + Rabu) 
 * - Bulanan: tanggal sama tiap bulan
 */
export function generateRecurrenceDates(input: RecurringEventInput): string[] {
  const result: string[] = [];
  const start = new Date(`${input.tanggal_mulai}T12:00:00+07:00`);
  const until = new Date(`${input.recurrence_until}T12:00:00+07:00`);

  if (start > until) return [];

  // Safety: max 365 occurrences
  const MAX_OCCURRENCES = 365;

  if (input.recurrence_pattern === 'Harian') {
    const cursor = new Date(start);
    while (cursor <= until && result.length < MAX_OCCURRENCES) {
      result.push(toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  if (input.recurrence_pattern === 'Mingguan') {
    const days = input.recurrence_days ?? [];
    if (days.length === 0) return [];

    const cursor = new Date(start);
    while (cursor <= until && result.length < MAX_OCCURRENCES) {
      const dayOfWeek = cursor.getDay(); // 0=Minggu
      if (days.includes(dayOfWeek)) {
        result.push(toDateStr(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  if (input.recurrence_pattern === 'Bulanan') {
    const startDate = start.getDate();
    const cursor = new Date(start);
    
    while (cursor <= until && result.length < MAX_OCCURRENCES) {
      result.push(toDateStr(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
      // Handle bulan yang tidak punya tanggal 31 (misal Feb)
      const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      cursor.setDate(Math.min(startDate, lastDay));
    }
    return result;
  }

  return [];
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// =============================================================================
// ICS EXPORT
// =============================================================================

/**
 * Convert event ke format ICS (RFC 5545).
 */
export function generateIcsContent(event: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: string;   // YYYY-MM-DD atau YYYY-MM-DDTHH:mm
  dtend?: string;
  allday?: boolean;
}): string {
  const now = new Date();
  const dtstamp = formatIcsDate(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SMK KHAWM//SISFO Pemuliaan Murid//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (event.allday) {
    // All-day event
    const dtstart = event.dtstart.replace(/-/g, '');
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    if (event.dtend) {
      // DTEND untuk all-day = hari berikutnya (exclusive)
      const endDate = new Date(`${event.dtend}T12:00:00+07:00`);
      endDate.setDate(endDate.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${toDateStr(endDate).replace(/-/g, '')}`);
    }
  } else {
    lines.push(`DTSTART:${formatIcsDateTime(event.dtstart)}`);
    if (event.dtend) {
      lines.push(`DTEND:${formatIcsDateTime(event.dtend)}`);
    }
  }

  lines.push(`SUMMARY:${escapeIcs(event.summary)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);

  // Reminder 1 hari sebelum
  lines.push('BEGIN:VALARM');
  lines.push('TRIGGER:-P1D');
  lines.push('ACTION:DISPLAY');
  lines.push(`DESCRIPTION:${escapeIcs(event.summary)}`);
  lines.push('END:VALARM');

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Export multiple events → ICS file → download.
 */
export function downloadIcsFile(
  events: {
    uid: string;
    summary: string;
    description?: string;
    location?: string;
    dtstart: string;
    dtend?: string;
    allday?: boolean;
  }[],
  filename: string = 'kalender-sekolah.ics'
): void {
  const now = new Date();
  const dtstamp = formatIcsDate(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SMK KHAWM//SISFO Pemuliaan Murid//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);

    if (event.allday) {
      const dtstart = event.dtstart.replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      if (event.dtend) {
        const endDate = new Date(`${event.dtend}T12:00:00+07:00`);
        endDate.setDate(endDate.getDate() + 1);
        lines.push(`DTEND;VALUE=DATE:${toDateStr(endDate).replace(/-/g, '')}`);
      }
    } else {
      lines.push(`DTSTART:${formatIcsDateTime(event.dtstart)}`);
      if (event.dtend) lines.push(`DTEND:${formatIcsDateTime(event.dtend)}`);
    }

    lines.push(`SUMMARY:${escapeIcs(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);

    // Reminder 1 hari sebelum
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P1D');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeIcs(event.summary)}`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// ICS HELPERS
// =============================================================================
function formatIcsDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

function formatIcsDateTime(dateStr: string): string {
  // Input: "YYYY-MM-DD" atau "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-');
  const [h, min] = (timePart ?? '00:00').split(':');
  
  // Treat as WIB (UTC+7), konversi ke UTC
  const wibDate = new Date(`${y}-${m}-${d}T${h}:${min}:00+07:00`);
  return formatIcsDate(wibDate);
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}