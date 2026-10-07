/**
 * Menghitung jarak antara 2 titik koordinat (latitude/longitude) dalam meter.
 * Menggunakan rumus Haversine.
 *
 * Dipakai untuk validasi geofencing (radius sekolah) pada presensi guru.
 *
 * Menggantikan duplikat:
 *   - `haversineDistance` di AgendaPage.tsx
 *   - `calculateDistance` di KehadiranPiketPenyambutanPage.tsx
 *
 * @param lat1 Latitude titik asal (guru)
 * @param lon1 Longitude titik asal (guru)
 * @param lat2 Latitude titik tujuan (sekolah)
 * @param lon2 Longitude titik tujuan (sekolah)
 * @returns Jarak dalam meter (dibulatkan ke bilangan bulat terdekat)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Radius bumi dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}