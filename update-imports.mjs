// update-imports.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'src';

// Urutan penting: pattern yang lebih spesifik HARUS di atas
const REPLACEMENTS = [
  // notifications
  [/@\/lib\/mitraNotifications/g, '@/lib/notifications/mitraNotifications'],
  [/@\/lib\/rapatNotifications/g, '@/lib/notifications/rapatNotifications'],
  [/@\/lib\/pushNotification/g,   '@/lib/notifications/pushNotification'],
  [/@\/lib\/notification\b/g,     '@/lib/notifications/notification'],
  [/\.\.\/lib\/notification\b/g,  '../lib/notifications/notification'],

  // ai
  [/@\/lib\/analisaKehadiranAi/g, '@/lib/ai/analisaKehadiranAi'],
  [/@\/lib\/suratAi/g,            '@/lib/ai/suratAi'],
  [/@\/lib\/rapatActions/g,       '@/lib/ai/rapatActions'],
  [/@\/lib\/ai\b/g,               '@/lib/ai/ai'],

  // pdf
  [/@\/lib\/pdfShared/g,            '@/lib/pdf/pdfShared'],
  [/@\/lib\/compressPdf/g,          '@/lib/pdf/compressPdf'],
  [/@\/lib\/generateArsipQR/g,      '@/lib/pdf/generateArsipQR'],
  [/@\/lib\/generateNotulensiPDF/g, '@/lib/pdf/generateNotulensiPDF'],
  [/@\/lib\/generateSuratIzin/g,    '@/lib/pdf/generateSuratIzin'],
  [/@\/lib\/pdfColoredExport/g,     '@/lib/pdf/pdfColoredExport'],

  // export
  [/@\/lib\/exportImport/g,        '@/lib/export/exportImport'],
  [/@\/lib\/exportSarprasReport/g, '@/lib/export/exportSarprasReport'],

  // utils (dipindah dari lib ke utils)
  [/@\/lib\/audit\b/g,            '@/utils/audit'],
  [/@\/lib\/charts\b/g,           '@/utils/charts'],
  [/@\/lib\/date\b/g,             '@/utils/date'],
  [/@\/lib\/geo\b/g,              '@/utils/geo'],
  [/@\/lib\/uploadSuratFile\b/g,  '@/utils/uploadSuratFile'],
  [/\.\.\/lib\/audit\b/g,         '../utils/audit'],
];

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out = out.concat(walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let out = src;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  if (out !== src) {
    writeFileSync(file, out);
    changed++;
    console.log('✔ updated', file);
  }
}
console.log(`\nDone. ${changed} file diupdate.`);