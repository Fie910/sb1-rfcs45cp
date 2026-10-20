// src/lib/openLibrary.ts
// Helper untuk mencari data buku di Open Library API (gratis, tanpa API key)

export type OpenLibraryBookResult = {
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun_terbit: number | null;
  sinopsis: string;
  cover_url: string;
  jumlah_halaman: number | null;
};

/**
 * Mencari buku berdasarkan ISBN menggunakan Open Library API.
 * API ini sangat berguna sebagai fallback jika Google Books tidak menemukan apa pun.
 */
export async function fetchBookByISBNOpenLibrary(
  isbn: string
): Promise<OpenLibraryBookResult | null> {
  try {
    // 1. Bersihkan ISBN dari karakter non-angka (kecuali 'X' untuk ISBN-10)
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '').toUpperCase();
    if (cleanIsbn.length < 10) return null;

    // 2. Panggil Search API Open Library
    const res = await fetch(
      `https://openlibrary.org/search.json?isbn=${cleanIsbn}&limit=1`
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) {
      return null; // Buku tidak ditemukan
    }

    const book = data.docs[0];

    // 3. Ambil cover jika tersedia (gunakan ID cover dari Open Library)
    const coverUrl = book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : '';

    // 4. Ambil sinopsis (Open Library tidak selalu menyediakan di endpoint search,
    // jadi kita bisa mencoba endpoint 'works' jika perlu. Untuk kesederhanaan,
    // kita kosongkan dulu atau ambil dari field 'first_sentence' jika ada).
    const sinopsis =
      book.first_sentence && book.first_sentence.length > 0
        ? book.first_sentence[0]
        : '';

    return {
      judul: book.title || '',
      pengarang: book.author_name ? book.author_name.join(', ') : '',
      penerbit: book.publisher ? book.publisher[0] : '',
      tahun_terbit: book.first_publish_year || null,
      sinopsis: sinopsis,
      cover_url: coverUrl,
      jumlah_halaman: book.number_of_pages_median || null,
    };
  } catch (err) {
    console.error('[openLibrary] Gagal fetch:', err);
    return null;
  }
}