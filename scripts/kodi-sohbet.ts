// Kodi ile uzun bir sohbeti, sitedeki gibi bağlam taşıyarak oynatır.
//   node scripts/kodi-sohbet.ts scripts/kodi-deneme/sohbet.json
// Her satır: { "soru", "beklenen"?: "madde-id" | "hesap" | "yok" | "<cevapta geçmesi gereken metin>" }
import { readFileSync } from 'node:fs';
import { kodiyeSor } from './kodi-kulliyat.ts';

type Satir = { soru: string; beklenen?: string };
const satirlar = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Satir[];
let konu: { soru: string; id?: string; hesap?: any } | null = null;
let dogru = 0, denetlenen = 0;
const ayrinti = process.argv.includes('-v');
for (const [i, s] of satirlar.entries()) {
  const r = kodiyeSor(s.soru, konu) as any;
  // KodiSite.astro'daki gibi: hesap cevabı hesap bağlamını, bilgi cevabı konu bağlamını tutar
  if (r.kaynak === 'hesap') konu = { soru: s.soru, hesap: r.hesap };
  else if (r.kaynak === 'bilgi' || r.kaynak === 'bolum' || r.kaynak === 'sozluk') {
    const baglamdan = konu && !konu.hesap && r.cevap && /^(peki|ya|bu|bunu|bunun|onu|onun)\b/i.test(s.soru.trim());
    konu = { soru: baglamdan ? konu!.soru : s.soru, id: r.id };
  } else konu = null;
  let tamam: boolean | null = null;
  if (s.beklenen) {
    denetlenen++;
    const b = s.beklenen;
    tamam = b === 'yok' ? r.kaynak === 'yok' : b === 'hesap' ? r.kaynak === 'hesap' : r.id === b || (r.cevap + '\n' + (r.kod ?? '')).includes(b);
    if (tamam) dogru++;
  }
  const isaret = tamam === null ? ' ' : tamam ? '✓' : '✗';
  if (ayrinti || tamam === false) {
    console.log(`${isaret} ${String(i + 1).padStart(2)} SEN : ${s.soru}`);
    console.log(`        KODİ: [${r.kaynak}${r.id && r.id !== r.kaynak ? ' ' + r.id : ''}] ${(r.cevap || '(site araması / anlayamadım)').replace(/\n+/g, ' ').slice(0, 150)}`);
    if (tamam === false) console.log(`        beklenen: ${s.beklenen}`);
  }
}
console.log(`Sohbet: ${dogru}/${denetlenen} beklenen cevap`);
