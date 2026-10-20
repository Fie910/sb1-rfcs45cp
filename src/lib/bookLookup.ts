// src/lib/bookLookup.ts
import { fetchBookByISBN as fetchFromGoogle } from './googleBooks';
import { fetchBookByISBNOpenLibrary as fetchFromOpenLibrary } from './openLibrary';

export type BookLookupResult = {
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun_terbit: number | null;
  sinopsis: string;
  cover_url: string;
  jumlah_halaman: number | null;
  source: 'google' | 'openlibrary';
};

/**
 * Strategi berlapis: Coba Google Books dulu, jika gagal pindah ke Open Library.
 */
export async function lookupBookByISBN(
  isbn: string
): Promise<BookLookupResult | null> {
  console.log(`[bookLookup] Mencari ISBN ${isbn} di Google Books...`);
  const googleResult = await fetchFromGoogle(isbn);
  if (googleResult) {
    return { ...googleResult, source: 'google' };
  }

  console.log(`[bookLookup] Tidak ditemukan. Mencoba Open Library...`);
  const openLibraryResult = await fetchFromOpenLibrary(isbn);
  if (openLibraryResult) {
    return { ...openLibraryResult, source: 'openlibrary' };
  }

  return null;
}