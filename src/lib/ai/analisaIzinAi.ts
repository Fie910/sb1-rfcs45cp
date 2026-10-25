// src/lib/ai/analisaIzinAi.ts
// AI analysis untuk pola izin & kualitas delegasi tugas guru.

export interface AnalisaIzinAi {
  ringkasan_pola: string;
  kekuatan: string;
  area_perbaikan: string;
  motivasi_personal: string;
}

export interface RecordIzinForAi {
  tanggal: string;
  kategori: string;        // Sakit / Izin / Dinas
  delegasi: string;        // none / asistensi / tugas
  keterangan: string | null;
}

export interface StatsIzinForAi {
  total: number;
  asistensi: number;
  sakitTugas: number;
  sakitTanpaTugas: number;
  izinTugas: number;
  izinTanpaTugas: number;
  dinasTugas: number;
  dinasTanpaTugas: number;
  persentase: number;
}

/** Cek apakah API key AI tersedia */
export function isAiIzinAvailable(): boolean {
  const env = (import.meta as any)?.env ?? {};
  return Boolean(env.VITE_GEMINI_API_KEY || env.VITE_GROQ_API_KEY);
}

function buildPrompt(
  guruNama: string,
  periodeLabel: string,
  records: RecordIzinForAi[],
  stats: StatsIzinForAi,
  avgSekolah: number
): string {
  const delta = stats.persentase - avgSekolah;
  const deltaTxt =
    delta > 3 ? `di atas rata-rata sekolah (${avgSekolah}%)` :
    delta < -3 ? `di bawah rata-rata sekolah (${avgSekolah}%)` :
    `setara dengan rata-rata sekolah (${avgSekolah}%)`;

  const recordsText = records.length > 0
    ? records.slice(0, 20).map((r, i) =>
        `${i + 1}. ${r.tanggal} — ${r.kategori}, delegasi: ${r.delegasi}${r.keterangan ? ` (${r.keterangan})` : ''}`
      ).join('\n')
    : '(tidak ada detail riwayat)';

  return `Anda adalah konsultan SDM pendidikan Islam yang bijak. Analisa pola IZIN berikut dan berikan feedback personal yang membangun.

GURU: ${guruNama}
PERIODE: ${periodeLabel}
TOTAL IZIN: ${stats.total}
PERSENTASE KEPATUHAN DELEGASI: ${stats.persentase}% (${deltaTxt})

DISTRIBUSI:
- Asistensi (ada guru pengganti): ${stats.asistensi}
- Sakit + Tugas: ${stats.sakitTugas}
- Sakit tanpa tugas: ${stats.sakitTanpaTugas}
- Izin + Tugas: ${stats.izinTugas}
- Izin tanpa tugas: ${stats.izinTanpaTugas}
- Dinas + Tugas: ${stats.dinasTugas}
- Dinas tanpa tugas: ${stats.dinasTanpaTugas}

RIWAYAT (maks 20):
${recordsText}

Balas dalam JSON dengan 4 field:
{
  "ringkasan_pola": "1-2 kalimat pola izin yang terlihat (mis. 'sering sakit, tapi 80% mendelegasikan')",
  "kekuatan": "1-2 kalimat hal positif yang patut diapresiasi (mis. 'konsisten menyiapkan tugas meski sakit')",
  "area_perbaikan": "1-2 kalimat saran konkret (mis. 'kurangi izin tanpa tugas dengan persiapan lebih awal')",
  "motivasi_personal": "1-2 kalimat motivasi islami yang hangat dan menyentuh, relevan dengan konteks"
}

Tambahan konteks identitas sekolah: Kaitkan "motivasi_personal" dengan filosofi 
"Merawat Fitrah, Mengukir Karya" — sentuh aspek (a) menjaga amanah fitrah diri 
sebagai guru, dan (b) meninggalkan karya/jejak baik yang mengukir kehidupan siswa. 
Jangan menyebut tagline secara literal; internalisasikan maknanya ke kalimat yang 
natural dan menyentuh hati.

Gunakan Bahasa Indonesia yang hangat, islami, membangun, tidak menghakimi.`;
}

async function callGemini(apiKey: string, prompt: string): Promise<AnalisaIzinAi> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty');
  return JSON.parse(text) as AnalisaIzinAi;
}

async function callGroq(apiKey: string, prompt: string): Promise<AnalisaIzinAi> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty');
  return JSON.parse(text) as AnalisaIzinAi;
}

export async function generateAnalisaIzin(
  guruNama: string,
  periodeLabel: string,
  records: RecordIzinForAi[],
  stats: StatsIzinForAi,
  avgSekolah: number
): Promise<AnalisaIzinAi> {
  if (!isAiIzinAvailable()) throw new Error('AI tidak tersedia');

  const env = (import.meta as any)?.env ?? {};
  const geminiKey = env.VITE_GEMINI_API_KEY as string | undefined;
  const groqKey = env.VITE_GROQ_API_KEY as string | undefined;

  const prompt = buildPrompt(guruNama, periodeLabel, records, stats, avgSekolah);

  if (geminiKey) {
    try { return await callGemini(geminiKey, prompt); }
    catch (err) { console.warn('[analisaIzinAi] Gemini gagal:', err); }
  }
  if (groqKey) {
    try { return await callGroq(groqKey, prompt); }
    catch (err) { console.warn('[analisaIzinAi] Groq gagal:', err); }
  }
  throw new Error('Semua provider AI gagal');
}