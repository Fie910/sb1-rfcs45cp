// src/lib/imageCompress.ts
// Utility untuk kompres + resize + konversi gambar ke WebP (fallback JPEG).
// Zero dependency — pakai native Canvas API.

type CompressOptions = {
  /** Sisi terpanjang maksimum (px). Default 512 */
  maxSize?: number;
  /** Kualitas 0–1. Default 0.85 */
  quality?: number;
  /** Paksa format. Default: auto-detect (webp kalau support, jpeg kalau tidak) */
  format?: 'webp' | 'jpeg' | 'auto';
};

export type CompressResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
  /** Persentase pengurangan, misal 94 = 94% lebih kecil */
  reductionPercent: number;
};

// =============================================================================
// HELPER: cek dukungan WebP encode
// =============================================================================
function supportsWebP(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

// =============================================================================
// MAIN: compressImage
// =============================================================================
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const { maxSize = 512, quality = 0.85, format = 'auto' } = options;

  // 1. Load gambar via createImageBitmap (cepat, handle HEIC iPhone, EXIF rotation)
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
  } catch {
    // Fallback untuk browser lama: pakai <img>
    bitmap = await loadViaImg(file);
  }

  // 2. Hitung dimensi baru (jaga aspect ratio, tidak upscale kalau sudah kecil)
  const { width: newW, height: newH } = fitDimensions(
    bitmap.width,
    bitmap.height,
    maxSize
  );

  // 3. Gambar ke canvas
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Canvas 2D context tidak tersedia');
  }

  // Kualitas downscale — pakai smoothing high untuk hasil tajam
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close?.();

  // 4. Tentukan format output
  const useWebP = format === 'webp' || (format === 'auto' && supportsWebP());
  const mimeType = useWebP ? 'image/webp' : 'image/jpeg';
  const ext = useWebP ? 'webp' : 'jpg';

  // 5. Export ke Blob
  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) throw new Error('Gagal kompres gambar');

  // 6. Buat File baru
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
  const outFile = new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: Date.now(),
  });

  const reductionPercent = Math.max(
    0,
    Math.round((1 - blob.size / file.size) * 100)
  );

  return {
    file: outFile,
    originalSize: file.size,
    compressedSize: blob.size,
    width: newW,
    height: newH,
    format: useWebP ? 'webp' : 'jpeg',
    reductionPercent,
  };
}

// =============================================================================
// HELPER: canvas.toBlob as Promise
// =============================================================================
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

// =============================================================================
// HELPER: fit dimension dalam kotak maxSize (preserve aspect ratio)
// =============================================================================
function fitDimensions(
  w: number,
  h: number,
  maxSize: number
): { width: number; height: number } {
  if (w <= maxSize && h <= maxSize) {
    return { width: w, height: h };
  }
  const ratio = w / h;
  if (w >= h) {
    return { width: maxSize, height: Math.round(maxSize / ratio) };
  }
  return { width: Math.round(maxSize * ratio), height: maxSize };
}

// =============================================================================
// HELPER: fallback load via <img> untuk browser lama
// =============================================================================
function loadViaImg(file: File): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const bmp = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        resolve(bmp);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar'));
    };
    img.src = url;
  });
}

// =============================================================================
// HELPER: format ukuran byte → string manusiawi
// =============================================================================
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}