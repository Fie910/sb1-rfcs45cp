// src/lib/tahfidz/cumulativeAyah.ts
// Cumulative ayah count per surah (konversi surah:ayah → global index 1-6236).
// Array dari quran.com / Tanzil.net — sudah diverifikasi akurat.

/**
 * cumulative[surah - 1] = total ayah dari surah 1 s.d. surah-1
 * cumulative[114] = 6236 (total seluruh Al-Quran)
 *
 * Contoh:
 *   toGlobalAyah(2, 1) = cumulative[1] + 1 = 7 + 1 = 8
 *   toGlobalAyah(2, 5) = cumulative[1] + 5 = 7 + 5 = 12
 *   toGlobalAyah(114, 6) = cumulative[113] + 6 = 6230 + 6 = 6236
 */
export const CUMULATIVE_AYAH: number[] = [
  0,      // cumulative[0]
  7,      // [1] = Al-Fatihah
  293,    // [2] = Al-Baqarah
  493,    // [3] = Ali Imran
  669,    // [4] = An-Nisa
  789,    // [5] = Al-Maidah
  954,    // [6] = Al-An'am
  1160,   // [7] = Al-A'raf
  1235,   // [8] = Al-Anfal
  1364,   // [9] = At-Taubah
  1473,   // [10] = Yunus
  1596,   // [11] = Hud
  1707,   // [12] = Yusuf
  1750,   // [13] = Ar-Ra'd
  1802,   // [14] = Ibrahim
  1901,   // [15] = Al-Hijr
  2029,   // [16] = An-Nahl
  2140,   // [17] = Al-Isra
  2250,   // [18] = Al-Kahf
  2348,   // [19] = Maryam
  2483,   // [20] = Ta-Ha
  2595,   // [21] = Al-Anbiya
  2673,   // [22] = Al-Hajj
  2791,   // [23] = Al-Mu'minun
  2855,   // [24] = An-Nur
  2932,   // [25] = Al-Furqan
  3159,   // [26] = Ash-Shu'ara
  3252,   // [27] = An-Naml
  3340,   // [28] = Al-Qasas
  3409,   // [29] = Al-Ankabut
  3469,   // [30] = Ar-Rum
  3503,   // [31] = Luqman
  3533,   // [32] = As-Sajdah
  3606,   // [33] = Al-Ahzab
  3660,   // [34] = Saba
  3705,   // [35] = Fatir
  3788,   // [36] = Ya-Sin
  3970,   // [37] = As-Saffat
  4058,   // [38] = Sad
  4133,   // [39] = Az-Zumar
  4218,   // [40] = Ghafir
  4272,   // [41] = Fussilat
  4325,   // [42] = Ash-Shura
  4414,   // [43] = Az-Zukhruf
  4473,   // [44] = Ad-Dukhan
  4510,   // [45] = Al-Jathiyah
  4545,   // [46] = Al-Ahqaf
  4583,   // [47] = Muhammad
  4612,   // [48] = Al-Fath
  4630,   // [49] = Al-Hujurat
  4675,   // [50] = Qaf
  4735,   // [51] = Adh-Dhariyat
  4784,   // [52] = At-Tur
  4846,   // [53] = An-Najm
  4901,   // [54] = Al-Qamar
  4979,   // [55] = Ar-Rahman
  5075,   // [56] = Al-Waqi'ah
  5104,   // [57] = Al-Hadid
  5126,   // [58] = Al-Mujadilah
  5150,   // [59] = Al-Hashr
  5163,   // [60] = Al-Mumtahanah
  5177,   // [61] = As-Saff
  5188,   // [62] = Al-Jumu'ah
  5199,   // [63] = Al-Munafiqun
  5217,   // [64] = At-Taghabun
  5229,   // [65] = At-Talaq
  5241,   // [66] = At-Tahrim
  5271,   // [67] = Al-Mulk
  5323,   // [68] = Al-Qalam
  5375,   // [69] = Al-Haqqah
  5419,   // [70] = Al-Ma'arij
  5447,   // [71] = Nuh
  5475,   // [72] = Al-Jinn
  5495,   // [73] = Al-Muzzammil
  5551,   // [74] = Al-Muddaththir
  5591,   // [75] = Al-Qiyamah
  5622,   // [76] = Al-Insan
  5672,   // [77] = Al-Mursalat
  5712,   // [78] = An-Naba
  5758,   // [79] = An-Nazi'at
  5800,   // [80] = Abasa
  5829,   // [81] = At-Takwir
  5848,   // [82] = Al-Infitar
  5884,   // [83] = Al-Mutaffifin
  5909,   // [84] = Al-Inshiqaq
  5931,   // [85] = Al-Buruj
  5948,   // [86] = At-Tariq
  5967,   // [87] = Al-A'la
  5993,   // [88] = Al-Ghashiyah
  6023,   // [89] = Al-Fajr
  6043,   // [90] = Al-Balad
  6058,   // [91] = Ash-Shams
  6079,   // [92] = Al-Lail
  6090,   // [93] = Ad-Duha
  6098,   // [94] = Ash-Sharh
  6106,   // [95] = At-Tin
  6125,   // [96] = Al-Alaq
  6130,   // [97] = Al-Qadr
  6138,   // [98] = Al-Bayyinah
  6146,   // [99] = Az-Zalzalah
  6157,   // [100] = Al-Adiyat
  6168,   // [101] = Al-Qari'ah
  6176,   // [102] = At-Takathur
  6179,   // [103] = Al-Asr
  6188,   // [104] = Al-Humazah
  6193,   // [105] = Al-Fil
  6197,   // [106] = Quraysh
  6204,   // [107] = Al-Ma'un
  6207,   // [108] = Al-Kawthar
  6213,   // [109] = Al-Kafirun
  6216,   // [110] = An-Nasr
  6221,   // [111] = Al-Masad
  6225,   // [112] = Al-Ikhlas
  6230,   // [113] = Al-Falaq
  6236,   // [114] = An-Nas
];

/**
 * Convert surah:ayah → global index (1-6236).
 */
export function toGlobalAyah(surah: number, ayah: number): number {
  if (surah < 1 || surah > 114) return 0;
  if (ayah < 1) return 0;
  return CUMULATIVE_AYAH[surah - 1] + ayah;
}