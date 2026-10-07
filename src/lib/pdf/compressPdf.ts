// src/lib/compressPdf.ts
// Kompres PDF dengan render tiap halaman ke canvas → WebP → gabung jadi PDF baru.
// Cocok untuk scan surat (image-based). TIDAK untuk PDF text-based.

import type { PDFDocumentProxy } from 'pdfjs-dist';

// =============================================================================
// CONFIG
// =============================================================================
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.75;
const PDF_THRESHOLD_KB = 1024; // PDF > 1 MB → compress

// =============================================================================
// MAIN
// =============================================================================
export type CompressPdfResult = {
  file: File;
  original_size: number;
  compressed_size: number;
  ratio: number;        // % hemat
  pages: number;
  was_compressed: boolean;
};

/**
 * Kompres PDF jika ukuran > threshold.
 * Return file asli kalau < threshold atau gagal compress.
 */
export async function compressPdfIfNeeded(file: File): Promise<CompressPdfResult> {
  const originalSize = file.size;

  // Skip kalau kecil
  if (originalSize < PDF_THRESHOLD_KB * 1024) {
    return {
      file,
      original_size: originalSize,
      compressed_size: originalSize,
      ratio: 0,
      pages: 0,
      was_compressed: false,
    };
  }

  try {
    const result = await compressPdf(file);
    return result;
  } catch (err) {
    console.warn('[compressPdf] Gagal compress, pakai as-is:', err);
    return {
      file,
      original_size: originalSize,
      compressed_size: originalSize,
      ratio: 0,
      pages: 0,
      was_compressed: false,
    };
  }
}

// =============================================================================
// CORE — PDF → Canvas → WebP → New PDF
// =============================================================================
async function compressPdf(file: File): Promise<CompressPdfResult> {
  const originalSize = file.size;

  // 1. Load PDF via pdfjs (dynamic import biar tidak masuk bundle utama)
  const pdfjs = await import('pdfjs-dist');

  // Worker setup (Vite-friendly)
  // Kalau error worker, fallback ke main thread
  try {
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch { /* fallback */ }

  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const totalPages = pdf.numPages;

  // 2. Render setiap halaman ke canvas
  const pageImages: Blob[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    // Hitung scale agar max width sesuai
    let scale = 1;
    if (viewport.width > MAX_WIDTH) {
      scale = MAX_WIDTH / viewport.width;
    }
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');

    // Background putih (kalau PDF transparan)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: scaledViewport,
    }).promise;

    // 3. Convert canvas → Blob (JPEG kecil)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) throw new Error(`Gagal render halaman ${pageNum}`);

    pageImages.push(blob);
  }

  // 4. Gabung jadi PDF baru via pdf-lib
  const { PDFDocument } = await import('pdf-lib');
  const newPdf = await PDFDocument.create();

  for (const imageBlob of pageImages) {
    const imageBytes = await imageBlob.arrayBuffer();
    const image = await newPdf.embedJpg(imageBytes);

    // Ukuran A4: 595 x 842 pt
    const pageWidth = 595.28;
    const pageHeight = 842.0;

    const page = newPdf.addPage([pageWidth, pageHeight]);

    // Hitung scale fit
    const imgAspect = image.width / image.height;
    const pageAspect = pageWidth / pageHeight;

    let drawWidth: number, drawHeight: number;
    if (imgAspect > pageAspect) {
      drawWidth = pageWidth;
      drawHeight = pageWidth / imgAspect;
    } else {
      drawHeight = pageHeight;
      drawWidth = pageHeight * imgAspect;
    }

    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
  }

  const compressedBytes = await newPdf.save();
  const compressedBlob = new Blob([compressedBytes], { type: 'application/pdf' });

  const originalName = file.name.replace(/\.pdf$/i, '');
  const compressedFile = new File([compressedBlob], `${originalName}_compressed.pdf`, {
    type: 'application/pdf',
  });

  const ratio = (1 - compressedFile.size / originalSize) * 100;

  return {
    file: compressedFile,
    original_size: originalSize,
    compressed_size: compressedFile.size,
    ratio,
    pages: totalPages,
    was_compressed: true,
  };
}