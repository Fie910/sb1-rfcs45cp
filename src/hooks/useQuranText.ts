// src/hooks/useQuranText.ts
// Load teks Al-Quran dari JSON lokal + cache di memory.
// Loaded sekali → dipakai semua komponen.

import { useState, useEffect } from 'react';

type QuranVerse = {
  n: number;
  t: string;
};

type QuranSurah = {
  verses: QuranVerse[];
};

type QuranData = Record<string, QuranSurah>;

export type SurahMeta = {
  nomor: number;
  nama_latin: string;
  nama_arab: string;
  arti: string;
  jumlah_ayat: number;
  tempat_turun: string;
};

// =============================================================================
// MODULE-LEVEL CACHE (shared antar instance hook)
// =============================================================================
let cachedQuranData: QuranData | null = null;
let cachedMetaData: SurahMeta[] | null = null;
let loadingPromise: Promise<{ quran: QuranData; meta: SurahMeta[] }> | null = null;

async function loadQuranData(): Promise<{ quran: QuranData; meta: SurahMeta[] }> {
  // Sudah di-cache
  if (cachedQuranData && cachedMetaData) {
    return { quran: cachedQuranData, meta: cachedMetaData };
  }

  // Sedang loading — return promise yang sama (prevent duplicate fetch)
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [quranRes, metaRes] = await Promise.all([
      fetch('/data/quran-text.json'),
      fetch('/data/quran-surah-meta.json'),
    ]);

    if (!quranRes.ok || !metaRes.ok) {
      throw new Error('Gagal memuat data Al-Quran');
    }

    const quran = (await quranRes.json()) as QuranData;
    const meta = (await metaRes.json()) as SurahMeta[];

    cachedQuranData = quran;
    cachedMetaData = meta;

    return { quran, meta };
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    loadingPromise = null;  // Reset agar bisa retry
    throw err;
  }
}

// =============================================================================
// HOOK
// =============================================================================
export function useQuranText() {
  const [quranData, setQuranData] = useState<QuranData | null>(cachedQuranData);
  const [metaData, setMetaData] = useState<SurahMeta[] | null>(cachedMetaData);
  const [loading, setLoading] = useState(!cachedQuranData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedQuranData && cachedMetaData) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { quran, meta } = await loadQuranData();
        if (!cancelled) {
          setQuranData(quran);
          setMetaData(meta);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Gagal memuat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Ambil ayat-ayat dalam rentang surah+ayat tertentu.
   * Return array { surah, ayat, text }
   */
  const getAyatRange = (
    surahMulai: number,
    ayatMulai: number,
    surahSelesai: number,
    ayatSelesai: number
  ): { surah: number; ayat: number; text: string }[] => {
    if (!quranData) return [];

    const result: { surah: number; ayat: number; text: string }[] = [];

    for (let s = surahMulai; s <= surahSelesai; s++) {
      const surahData = quranData[String(s)];
      if (!surahData) continue;

      const isFirst = s === surahMulai;
      const isLast = s === surahSelesai;

      const startAyat = isFirst ? ayatMulai : 1;
      const endAyat = isLast
        ? ayatSelesai
        : surahData.verses.length;

      for (const v of surahData.verses) {
        if (v.n >= startAyat && v.n <= endAyat) {
          result.push({ surah: s, ayat: v.n, text: v.t });
        }
      }
    }

    return result;
  };

  const getSurahMeta = (nomor: number): SurahMeta | null => {
    return metaData?.find((m) => m.nomor === nomor) ?? null;
  };

  return {
    quranData,
    metaData,
    loading,
    error,
    getAyatRange,
    getSurahMeta,
  };
}