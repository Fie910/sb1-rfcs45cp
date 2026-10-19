// src/lib/googleBooks.ts
// Helper untuk fetch data buku dari Google Books API berdasarkan ISBN

export type GoogleBookResult = {
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun_terbit: number | null;
  sinopsis: string;
  cover_url: string;
  jumlah_halaman: number | null;
};

export async function fetchBookByISBN(isbn: string): Promise<GoogleBookResult | null> {
  try {
    // Bersihkan ISBN dari karakter strip atau spasi
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    if (cleanIsbn.length < 10) return null;

    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

    const book = data.items[0].volumeInfo;

    return {
      judul: book.title || '',
      pengarang: book.authors ? book.authors.join(', ') : '',
      penerbit: book.publisher || '',
      tahun_terbit: book.publishedDate ? parseInt(book.publishedDate.substring(0, 4)) : null,
      sinopsis: book.description || '',
      cover_url: book.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
      jumlah_halaman: book.pageCount || null,
    };
  } catch (err) {
    console.error('[googleBooks] Gagal fetch:', err);
    return null;
  }
}