// Konversi Angka Bulan (0-11) ke Bulan Romawi
export const getBulanRomawi = (monthIndex: number): string => {
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romanMonths[monthIndex] || 'I';
};

// Merakit Format Nomor Surat: [Urut]/[Kode]/[Sekolah]/[Romawi]/[Tahun]
export const formatNomorSurat = (
  urutan: number,
  kodePerihal: string,
  namaSekolah: string = 'SMK-KHAWM',
  dateString?: string
): string => {
  const date = dateString ? new Date(dateString) : new Date();
  const nomorUrutStr = String(urutan).padStart(3, '0');
  const bulanRomawi = getBulanRomawi(date.getMonth());
  const tahun = date.getFullYear();

  return `${nomorUrutStr}/${kodePerihal}/${namaSekolah}/${bulanRomawi}/${tahun}`;
};