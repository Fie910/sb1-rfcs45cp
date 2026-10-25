// src/lib/ai/analisaKehadiranAi.ts
// AI analisa kehadiran guru — pakai multi-provider failover.

import { generateJSON, hasAnyProvider } from './aiProvider';
import { buildAnalisaKehadiranPrompt } from './prompts/analisaKehadiran';

// =============================================================================
// TYPES
// =============================================================================
export type RecordForAi = {
  tanggal: string;
  mapel: string;
  kelas: string;
  status: string;
  catatan?: string | null;
};

export type AnalisaKehadiranAi = {
  ringkasan_karakter: string;
  kekuatan: string;
  area_perbaikan: string;
  motivasi_personal: string;
};

export type StatsForAi = {
  total: number;
  hadir: number;
  asisten: number;
  sakitTugas: number;
  izinTugas: number;
  dinasTugas: number;
  persentase: number;
};

// =============================================================================
// MAIN
// =============================================================================
export async function generateAnalisaKehadiran(
  guruNama: string,
  periodeLabel: string,
  records: RecordForAi[],
  stats: StatsForAi,
  avgSekolah: number
): Promise<AnalisaKehadiranAi> {
  if (!hasAnyProvider()) {
    throw new Error('Tidak ada API key AI yang diset. Hubungi administrator.');
  }

  if (records.length === 0) {
    throw new Error('Tidak ada record untuk dianalisa.');
  }

  const recordLines = records
    .slice(0, 40)
    .map((r) => {
      const cat = r.catatan ? ` | Catatan: ${r.catatan.slice(0, 80)}` : '';
      return `- ${r.tanggal} | ${r.mapel} | ${r.kelas} | ${r.status}${cat}`;
    })
    .join('\n');

  const totalRecordInfo =
    records.length > 40 ? `\n\n_(Menampilkan 40 dari ${records.length} record)_` : '';

  const { systemPrompt, examples, userPrompt } = buildAnalisaKehadiranPrompt(
    guruNama,
    periodeLabel,
    recordLines,
    totalRecordInfo,
    {
      total: stats.total,
      hadir: stats.hadir,
      asisten: stats.asisten,
      sakitTugas: stats.sakitTugas,
      izinTugas: stats.izinTugas,
      dinasTugas: stats.dinasTugas,
      persentase: stats.persentase,
    },
    avgSekolah,
    records.length
  );

  try {
    const { data, provider, model } = await generateJSON<AnalisaKehadiranAi>({
      prompt: userPrompt,
      systemPrompt,
      examples,
      temperature: 0.65,
      maxTokens: 2048,
      jsonMode: true,
    });

    console.info(`[analisa-kehadiran] dihasilkan oleh ${provider}:${model}`);

    return {
      ringkasan_karakter: String(data.ringkasan_karakter ?? '').trim(),
      kekuatan: String(data.kekuatan ?? '').trim(),
      area_perbaikan: String(data.area_perbaikan ?? '').trim(),
      motivasi_personal: String(data.motivasi_personal ?? '').trim(),
    };
  } catch (err: any) {
    console.error('[ai] generateAnalisaKehadiran error:', err);
    throw new Error(err.message || 'Gagal generate analisa kehadiran.');
  }
}

export function isAiAvailable(): boolean {
  return hasAnyProvider();
}