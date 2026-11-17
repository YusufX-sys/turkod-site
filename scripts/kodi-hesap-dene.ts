// Kodi'nin hesap motorunu dener: node scripts/kodi-hesap-dene.ts  [ "tek soru" ]
//   scripts/kodi-deneme/hesap.json: [{ "soru", "onceki"?: "önceki soru", "beklenen": "8" | null }]
//   beklenen: cevap metninde geçmeli ("Cevap: 8", "= 8" ...); null: hesap sorusu sayılmamalı.
import { readFileSync } from 'node:fs';
import { hesapCevabi } from '../src/data/kodi-hesap.ts';
import { sozluk } from './kodi-ortak.ts';

const varMi = (ad: string) => sozluk.tr.has(ad);
const [tek, ...geri] = process.argv.slice(2);
if (tek) {
  const onceki = geri.length ? hesapCevabi(tek, null, varMi)?.baglam ?? null : null;
  const r = hesapCevabi(geri.length ? geri.join(' ') : tek, onceki, varMi);
  console.log(r ? `${r.metin}\n---\n${r.kod ?? ''}` : '(hesap değil)');
  process.exit(0);
}
const ad = process.env.KODI_HESAP_LISTE ?? 'hesap';
const liste = JSON.parse(readFileSync(new URL(`kodi-deneme/${ad}.json`, import.meta.url), 'utf8')) as { soru: string; onceki?: string; beklenen: string | null }[];
const kacir = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, (h) => '\\' + h);
let dogru = 0;
const yanlis: string[] = [];
for (const o of liste) {
  const onceki = o.onceki ? hesapCevabi(o.onceki, null, varMi)?.baglam ?? null : null;
  let r: { metin: string; kod?: string } | null = null;
  try { r = hesapCevabi(o.soru, onceki, varMi); } catch (e) { r = { metin: 'ÇÖKTÜ: ' + (e as Error).stack }; }
  let tamam: boolean;
  if (o.beklenen === null) tamam = !r;
  else {
    // Cevap satırı varsa sonuç orada olmalı (adımlardaki ara sayılar sayılmaz)
    const cevapSatiri = r?.metin.split('\n').find((s) => s.startsWith('Cevap:'));
    const m = cevapSatiri ?? (r?.metin ?? '') + '\n' + (r?.kod ?? '');
    tamam = new RegExp(`(?<![\\d,/])${kacir(o.beklenen)}(?!\\d|,\\d)`).test(m);
  }
  if (tamam) dogru++;
  else {
    const m = r?.metin ?? '(yok)';
    const ozet = m.split('\n').filter((s) => /Cevap|=|ÇÖKTÜ|Evet|Hayır|at /.test(s)).slice(-3).join(' | ') || m.slice(0, 160);
    yanlis.push(`  ${o.onceki ? `[${o.onceki}] ` : ''}${o.soru}\n      beklenen: ${o.beklenen}\n      bulunan : ${ozet}`);
  }
}
console.log(yanlis.join('\n'));
console.log(`Hesap: ${dogru}/${liste.length} doğru`);
