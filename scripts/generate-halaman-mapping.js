// scripts/generate-halaman-mapping.js
// Fetch mapping mushaf Madinah dari quran.com API → generate SQL file.
//
// Cara pakai:
//   1. Pastikan Node.js >= 18 (fetch native)
//   2. node scripts/generate-halaman-mapping.js
//   3. Akan menghasilkan scripts/halaman-mapping.sql
//   4. Copy-paste isi file tersebut ke Supabase SQL Editor

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const DELAY_MS = 80;  // ~80ms antar request → total ~50 detik

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(pageNumber, attempt = 1) {
  try {
    const res = await fetch(
      `${API_BASE}/verses/by_page/${pageNumber}?per_page=300`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 3) {
      console.warn(`  Retry page ${pageNumber} (attempt ${attempt + 1})...`);
      await sleep(500);
      return fetchPage(pageNumber, attempt + 1);
    }
    throw err;
  }
}

async function main() {
  console.log('🚀 Starting Quran page mapping generator\n');

  const rows = [];
  let processed = 0;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    try {
      const json = await fetchPage(page);
      const verses = json.verses || [];

      if (verses.length === 0) {
        console.warn(`⚠️  Page ${page} has no verses, skipping`);
        continue;
      }

      // Group verses by surah number
      const bySurah = new Map();
      for (const v of verses) {
        const [surahNum, ayahNum] = v.verse_key.split(':').map(Number);
        if (!bySurah.has(surahNum)) bySurah.set(surahNum, []);
        bySurah.get(surahNum).push(ayahNum);
      }

      // Emit one row per surah on this page
      for (const [surahNum, ayahs] of bySurah.entries()) {
        rows.push({
          halaman: page,
          surah_nomor: surahNum,
          ayat_mulai: Math.min(...ayahs),
          ayat_selesai: Math.max(...ayahs),
        });
      }

      processed++;
      if (page % 50 === 0 || page === TOTAL_PAGES) {
        console.log(`✅ Progress: ${page}/${TOTAL_PAGES} (${rows.length} rows)`);
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`❌ Failed page ${page}:`, err.message);
    }
  }

  console.log(`\n📊 Total rows: ${rows.length}`);

  // Generate SQL
  let sql = '-- ============================================================================\n';
  sql += '-- AUTO-GENERATED: Mushaf Madinah page mapping (604 pages)\n';
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Total rows: ${rows.length}\n`;
  sql += '-- Source: quran.com API v4\n';
  sql += '-- ============================================================================\n\n';
  sql += 'TRUNCATE TABLE public.tahfidz_halaman_detail RESTART IDENTITY CASCADE;\n\n';
  sql += 'INSERT INTO public.tahfidz_halaman_detail (halaman, surah_nomor, ayat_mulai, ayat_selesai) VALUES\n';

  const chunks = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows
      .slice(i, i + 50)
      .map((r) => `  (${r.halaman}, ${r.surah_nomor}, ${r.ayat_mulai}, ${r.ayat_selesai})`)
      .join(',\n');
    chunks.push(chunk);
  }
  sql += chunks.join(',\n') + '\n';
  sql += 'ON CONFLICT (halaman, surah_nomor, ayat_mulai) DO NOTHING;\n\n';

  sql += '-- Verifikasi\n';
  sql += '-- SELECT COUNT(*) FROM public.tahfidz_halaman_detail;\n';
  sql += '-- Expected: 800-900 (beberapa halaman berisi 2-3 surah)\n';

  const outPath = path.join(__dirname, 'halaman-mapping.sql');
  fs.writeFileSync(outPath, sql);
  console.log(`\n💾 SQL file written: ${outPath}`);
  console.log(`   Size: ${(sql.length / 1024).toFixed(1)} KB`);
  console.log('\n👉 Next: copy-paste isi file ke Supabase SQL Editor\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});