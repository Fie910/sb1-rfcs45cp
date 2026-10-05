// src/lib/generateArsipQR.ts
// Utility generate QR code untuk verifikasi keaslian dokumen arsip.
// Hybrid A+B: QR berisi token + hash short untuk deteksi perubahan.

import { buildVerifyUrl, generateQrDataUrl } from './pdfShared';

// =============================================================================
// TYPES
// =============================================================================
export type ArsipQRData = {
  verification_token: string;
  content_hash: string | null;
  nomor_dokumen: string | null;
  judul: string;
};

// =============================================================================
// HELPER — Build verification URL (re-export untuk backward compat)
// =============================================================================
export function buildArsipVerifyUrl(
  verificationToken: string,
  contentHash?: string | null
): string {
  return buildVerifyUrl('arsip', verificationToken, contentHash);
}

// =============================================================================
// MAIN — Generate QR as Data URL
// =============================================================================
export async function generateArsipQRDataUrl(
  verificationToken: string,
  contentHash?: string | null,
  size: number = 400
): Promise<string> {
  const url = buildArsipVerifyUrl(verificationToken, contentHash);
  return generateQrDataUrl(url, size);
}

// =============================================================================
// DOWNLOAD — PNG File
// =============================================================================
export async function downloadArsipQR(
  verificationToken: string,
  contentHash: string | null,
  nomorDokumen: string | null,
  judul: string
): Promise<void> {
  const dataUrl = await generateArsipQRDataUrl(verificationToken, contentHash, 800);

  const safeName = (nomorDokumen ?? judul).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `QR_${safeName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =============================================================================
// OPEN PREVIEW
// =============================================================================
export async function openArsipQRPreview(
  verificationToken: string,
  contentHash?: string | null
): Promise<string> {
  return generateArsipQRDataUrl(verificationToken, contentHash, 600);
}

// =============================================================================
// PRINT — Buka di tab baru siap print
// =============================================================================
export async function printArsipQR(
  verificationToken: string,
  contentHash: string | null,
  nomorDokumen: string | null,
  judul: string
): Promise<void> {
  const dataUrl = await generateArsipQRDataUrl(verificationToken, contentHash, 800);

  const printWindow = window.open('', '_blank', 'width=600,height=700');
  if (!printWindow) {
    throw new Error('Popup diblokir browser. Izinkan popup untuk cetak QR.');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR ${nomorDokumen ?? judul}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; margin: 0; }
        .qr-box { text-align: center; max-width: 400px; }
        h1 { font-size: 16px; margin: 0 0 8px 0; color: #0f172a; }
        .nomor { font-family: monospace; font-size: 12px; color: #6366f1; margin-bottom: 24px; }
        img { width: 300px; height: 300px; border: 2px solid #e2e8f0; border-radius: 12px; padding: 8px; }
        .caption { font-size: 11px; color: #64748b; margin-top: 16px; line-height: 1.5; }
        .judul { font-size: 13px; font-weight: 600; margin-top: 16px; color: #0f172a; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="qr-box">
        <h1>VERIFIKASI KEASLIAN DOKUMEN</h1>
        <p class="nomor">${nomorDokumen ?? '-'}</p>
        <img src="${dataUrl}" alt="QR" />
        <p class="judul">${judul}</p>
        <p class="caption">Scan QR code ini untuk memverifikasi keaslian dokumen.<br>Jika hash berubah, sistem akan menandai sebagai versi lama.</p>
      </div>
      <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}