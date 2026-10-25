// src/lib/ai/analisaAgendaAi.ts
// AI analysis untuk pola kehadiran mengajar (agenda_gurus).

export interface AnalisaAgendaAi {
  ringkasan_pola: string;
  kekuatan: string;
  area_perbaikan: string;
  motivasi_personal: string;
}

export interface RecordAgendaForAi {
  tanggal: string;
  mapel: string;
  kelas: string;
  status: string;
  jp: number;
}

export interface StatsAgendaForAi {
  totalJP: number;
  hadirJP: number;
  asistenJP: number;
  sakitTugasJP: number;
  sakitTanpaTugasJP: number;
  izinTugasJP: number;
  izinTanpaTugasJP: number;
  dinasTugasJP: number;
  dinasTanpaTugasJP: number;
  alpaJP: number;
  terlambatJP: number;
  persentase: number;
}

export function isAiAgendaAvailable(): boolean {
  const env = (import.meta as any)?.env ?? {};
  return Boolean(env.VITE_GEMINI_API_KEY || env.VITE_GROQ_API_KEY);
}

function buildPrompt(
  guruNama: string, periodeLabel: string, records: RecordAgendaForAi[],
  stats: StatsAgendaForAi, avgSekolah: number
): string {
  const delta = stats.persentase - avgSekolah;
  const deltaTxt =
    delta > 3 ? `di atas rata-rata sekolah (${avgSekolah}%)` :
    delta < -3 ? `di bawah rata-rata sekolah (${avgSekolah}%)` :
    `setara dengan rata-rata sekolah (${avgSekolah}%)`;

  const recordsText = records.length > 0
    ? records.slice(0, 20).map((r, i) =>
        `${i + 1}. ${r.tanggal} — ${r.mapel} (${r.kelas}): ${r.status}, ${r.jp} JP`
      ).join('\n')
    : '(tidak ada detail riwayat)';

  return `Anda adalah konsultan pengembangan guru pendidikan Islam yang bijak. Analisa pola KEHADIRAN MENGAJAR berikut dan berikan feedback personal yang membangun.

GURU: ${guruNama}
PERIODE: ${periodeLabel}
TOTAL JP: ${stats.totalJP}
PERSENTASE KEHADIRAN BERBOBOT: ${stats.persentase}% (${deltaTxt})

DISTRIBUSI JP:
- Hadir Mengajar: ${stats.hadirJP}
- Asistensi (didampingi guru lain): ${stats.asistenJP}
- Sakit + Tugas: ${stats.sakitTugasJP}
- Sakit tanpa tugas: ${stats.sakitTanpaTugasJP}
- Izin + Tugas: ${stats.izinTugasJP}
- Izin tanpa tugas: ${stats.izinTanpaTugasJP}
- Dinas + Tugas: ${stats.dinasTugasJP}
- Dinas tanpa tugas: ${stats.dinasTanpaTugasJP}
- Alpa: ${stats.alpaJP}
- Terlambat: ${stats.terlambatJP} JP

RIWAYAT (maks 20):
${recordsText}

Balas dalam JSON dengan 4 field:
{
  "ringkasan_pola": "1-2 kalimat pola kehadiran mengajar yang terlihat",
  "kekuatan": "1-2 kalimat apresiasi spesifik yang patut diapresiasi",
  "area_perbaikan": "1-2 kalimat saran konkret dan actionable",
  "motivasi_personal": "1-2 kalimat motivasi islami hangat, relevan dengan konteks guru"
}

Tambahan konteks identitas sekolah: Kaitkan "motivasi_personal" dengan filosofi 
"Merawat Fitrah, Mengukir Karya" — sentuh aspek (a) menjaga amanah fitrah diri 
sebagai guru, dan (b) meninggalkan karya/jejak baik yang mengukir kehidupan siswa. 
Jangan menyebut tagline secara literal; internalisasikan maknanya ke kalimat yang 
natural dan menyentuh hati.

Gunakan Bahasa Indonesia yang hangat, islami, membangun, tidak menghakimi.`;
}

async function callGemini(apiKey: string, prompt: string): Promise<AnalisaAgendaAi> {
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
  return JSON.parse(text) as AnalisaAgendaAi;
}

async function callGroq(apiKey: string, prompt: string): Promise<AnalisaAgendaAi> {
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
  return JSON.parse(text) as AnalisaAgendaAi;
}

export async function generateAnalisaAgenda(
  guruNama: string, periodeLabel: string, records: RecordAgendaForAi[],
  stats: StatsAgendaForAi, avgSekolah: number
): Promise<AnalisaAgendaAi> {
  if (!isAiAgendaAvailable()) throw new Error('AI tidak tersedia');

  const env = (import.meta as any)?.env ?? {};
  const geminiKey = env.VITE_GEMINI_API_KEY as string | undefined;
  const groqKey = env.VITE_GROQ_API_KEY as string | undefined;

  const prompt = buildPrompt(guruNama, periodeLabel, records, stats, avgSekolah);

  if (geminiKey) {
    try { return await callGemini(geminiKey, prompt); }
    catch (err) { console.warn('[analisaAgendaAi] Gemini gagal:', err); }
  }
  if (groqKey) {
    try { return await callGroq(groqKey, prompt); }
    catch (err) { console.warn('[analisaAgendaAi] Groq gagal:', err); }
  }
  throw new Error('Semua provider AI gagal');
}