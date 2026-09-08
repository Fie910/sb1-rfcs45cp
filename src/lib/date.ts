// Helper untuk mendapatkan nama hari saat ini berdasarkan zona waktu Asia/Jakarta (WIB)
export function getHariIniLokal(): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  };
  const hariStr = new Intl.DateTimeFormat('id-ID', options).format(new Date());

  // Pastikan huruf pertama kapital (contoh: "Senin", "Selasa", dll)
  return hariStr.charAt(0).toUpperCase() + hariStr.slice(1);
}

// Helper untuk mengecek apakah jam KBM saat ini sedang berlangsung
export function isJadwalAktif(waktuMulai: string, waktuSelesai: string): boolean {
  if (!waktuMulai || !waktuSelesai) return false;

  const now = new Date();
  const timeString = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(now).replace('.', ':');

  return timeString >= waktuMulai && timeString <= waktuSelesai;
}

// Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD berbasis WIB
// Menggunakan Intl.DateTimeFormat en-CA (YYYY-MM-DD) yang reliable di semua browser
export function getWibDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}