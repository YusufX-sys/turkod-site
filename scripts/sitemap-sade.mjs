// Derlemeden sonra dist/sitemap.xml üretir: yalnızca <loc> içeren, sade bir site haritası.
// Google Search Console'un okuyamadığı sitemap-index.xml yerine kökte tek dosya sunar.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const adresler = new Set();
for (const ad of readdirSync(dist)) {
  if (!/^sitemap-\d+\.xml$/.test(ad)) continue;
  const xml = readFileSync(join(dist, ad), 'utf8');
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) adresler.add(m[1]);
}
if (adresler.size === 0) throw new Error('sitemap-*.xml içinde adres bulunamadı');

const satirlar = [...adresler].map((a) => `  <url><loc>${a}</loc></url>`).join('\n');
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${satirlar}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${adresler.size} adres`);
