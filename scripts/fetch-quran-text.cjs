// scripts/fetch-quran-text.cjs
// Download teks Al-Quran dari quran.com API → generate JSON compact.
//
// Output:
//   public/data/quran-text.json       (~1.5 MB, semua 114 surah)
//   public/data/quran-surah-meta.json (~10 KB, metadata ringan)

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.quran.com/api/v4';
const DELAY_MS = 100;
const TOTAL_SURAH = 114;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSurah(surahNumber, attempt = 1) {
  try {
    const res = await fetch(
      `${API_BASE}/quran/verses/uthmani?chapter_number=${surahNumber}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 3) {
      console.warn(`  Retry surah ${surahNumber} (attempt ${attempt + 1})...`);
      await sleep(500);
      return fetchSurah(surahNumber, attempt + 1);
    }
    throw err;
  }
}

async function fetchSurahMeta(surahNumber) {
  try {
    const res = await fetch(`${API_BASE}/chapters/${surahNumber}?language=id`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.chapter;
  } catch {
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Quran text fetcher...\n');

  const quranData = {};   // { "1": { name, verses: [{n, text}] }, ... }
  const metaData = [];    // [ { nomor, nama_latin, nama_arab, jumlah_ayat, ... }, ... ]

  for (let surah = 1; surah <= TOTAL_SURAH; surah++) {
    try {
      const [versesJson, metaJson] = await Promise.all([
        fetchSurah(surah),
        fetchSurahMeta(surah),
      ]);

      const verses = versesJson.verses || [];

      quranData[String(surah)] = {
        verses: verses.map((v, index) => {
          // quran.com API v4 pakai verse_key ("1:1") bukan verse_number
          const ayahNum = v.verse_key
            ? Number(v.verse_key.split(':')[1])
            : index + 1;
          return {
            n: ayahNum,
            t: v.text_uthmani,
          };
        }),
      };

      metaData.push({
        nomor: surah,
        nama_latin: metaJson?.name_simple ?? `Surah ${surah}`,
        nama_arab: metaJson?.name_arabic ?? '',
        arti: metaJson?.translated_name?.name ?? '',
        jumlah_ayat: verses.length,
        tempat_turun: metaJson?.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah',
      });

      if (surah % 10 === 0 || surah === TOTAL_SURAH) {
        console.log(`✅ Progress: ${surah}/${TOTAL_SURAH} surah`);
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`❌ Failed surah ${surah}:`, err.message);
    }
  }

  // Pastikan folder ada
  const outDir = path.join(__dirname, '..', 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  // Write quran-text.json (compact, no pretty-print untuk hemat size)
  const textPath = path.join(outDir, 'quran-text.json');
  fs.writeFileSync(textPath, JSON.stringify(quranData));

  // Write meta
  const metaPath = path.join(outDir, 'quran-surah-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));

  const textSize = fs.statSync(textPath).size;
  const metaSize = fs.statSync(metaPath).size;

  console.log('\n📊 Output:');
  console.log(`   quran-text.json       : ${(textSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   quran-surah-meta.json : ${(metaSize / 1024).toFixed(1)} KB`);
  console.log('\n✅ Done!');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});