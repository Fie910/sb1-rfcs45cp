// src/lib/uploadSuratFile.ts
// Upload universal untuk surat — handle image & PDF dengan kompresi otomatis.

import { supabase } from './supabase';
import { compressImageToWebP } from '@/components/arsip/shared';
import { compressPdfIfNeeded } from './compressPdf';

const BUCKET = 'dokumen-surat'; // ← GANTI sesuai nama bucket Anda
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// =============================================================================
// TYPES
// =============================================================================
export type UploadSuratResult = {
  file_url: string;
  file_type: string;
  file_name: string;
  original_size: number;
  final_size: number;
  ratio: number;        // % hemat
  was_compressed: boolean;
  pages?: number;
};

export type UploadSuratOptions = {
  folderId: string;     // biasanya guru.id atau surat.id
};

// =============================================================================
// MAIN
// =============================================================================
export async function uploadSuratFile(
  file: File,
  options: UploadSuratOptions
): Promise<UploadSuratResult> {
  // 1. Validasi tipe
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `Tipe file tidak didukung (${file.type}). Gunakan JPG, PNG, WebP, atau PDF.`
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimal 25 MB.`
    );
  }

  let toUpload = file;
  let wasCompressed = false;
  let ratio = 0;
  let pages: number | undefined;
  const originalSize = file.size;

  // 2. Kompresi otomatis
  if (file.type.startsWith('image/')) {
    // Gambar → WebP 1600px
    try {
      const compressed = await compressImageToWebP(file, 0.8, 1600);
      if (compressed.size < file.size) {
        toUpload = compressed;
        wasCompressed = true;
        ratio = (1 - compressed.size / originalSize) * 100;
      }
    } catch (err) {
      console.warn('[uploadSurat] Kompres gambar gagal, pakai asli:', err);
    }
  } else if (file.type === 'application/pdf') {
    // PDF → hybrid compress
    try {
      const result = await compressPdfIfNeeded(file);
      toUpload = result.file;
      wasCompressed = result.was_compressed;
      ratio = result.ratio;
      pages = result.pages;
    } catch (err) {
      console.warn('[uploadSurat] Kompres PDF gagal, pakai asli:', err);
    }
  }

  // 3. Upload ke Supabase Storage
  const ext = toUpload.name.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const safeName = toUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${timestamp}-${random}-${safeName}`;
  const filePath = `${options.folderId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, toUpload, {
      cacheControl: '31536000',
      upsert: false,
      contentType: toUpload.type,
    });

  if (uploadError) {
    throw new Error('Upload gagal: ' + uploadError.message);
  }

  // 4. Ambil public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return {
    file_url: urlData.publicUrl,
    file_type: toUpload.type,
    file_name: toUpload.name,
    original_size: originalSize,
    final_size: toUpload.size,
    ratio,
    was_compressed: wasCompressed,
    pages,
  };
}

// =============================================================================
// HELPER — format info kompresi untuk toast/UI
// =============================================================================
export function formatCompressionInfo(result: UploadSuratResult): string {
  if (!result.was_compressed || result.ratio < 1) {
    return '';
  }
  const fromMB = (result.original_size / 1024 / 1024).toFixed(2);
  const toMB = (result.final_size / 1024 / 1024).toFixed(2);
  const pageInfo = result.pages ? ` (${result.pages} hal)` : '';
  return `Dikompres ${fromMB} MB → ${toMB} MB${pageInfo}, hemat ${result.ratio.toFixed(0)}%`;
}