// Kodi motorunun ağırlık ve eşiklerini YALNIZCA geliştirme listesinde arar (gizli listeye bakmaz).
// Ölçüt, yanlış cevabı cevapsızlıktan daha çok cezalandırır.
//   node scripts/kodi-ayarla.ts
import { readFileSync } from 'node:fs';
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { AGIRLIK, ESIK, SOZLUK_ONCELIK, dizinSifirla, sozlukDizini, yerelCevap } from '../src/data/kodi-motor.ts';

const kok = new URL('..', import.meta.url);
const sozluk = sozlukDizini(JSON.parse(readFileSync(new URL('public/kodi-sozluk.json', kok), 'utf8')).k);
const liste: { soru: string; beklenen: string | null }[] =
  JSON.parse(readFileSync(new URL('scripts/kodi-deneme/gelistirme.json', kok), 'utf8'));

const olc = () => {
  // Ölçüt: doğru +1, yanlış cevap -0.5 (cevapsız kalmak 0: Kodi yine site aramasına yönlendirir).
  // Yanlış cevap, "bilmiyorum" demekten daha kötüdür; kapsam dışı sorular böylece korunur.
  let d = 0;
  for (const o of liste) {
    const c = yerelCevap(o.soru, BILGI, sozluk);
    const b = c ? (c.id ?? '(sözlük)') : null;
    if (o.beklenen === null ? b === null : b === o.beklenen) d += 1;
    else if (b !== null) d -= 0.5;
  }
  return d;
};

const aralik: Record<string, [object, string, number[]]> = {
  anahtar: [AGIRLIK, 'anahtar', [2, 3, 4]],
  cevap: [AGIRLIK, 'cevap', [0.5, 1, 1.5]],
  ek: [AGIRLIK, 'ek', [0.5, 0.7, 1, 1.3]],
  kalip: [AGIRLIK, 'kalip', [0.2, 0.35, 0.5, 0.7]],
  b: [AGIRLIK, 'b', [0.4, 0.6, 0.75]],
  esikPuan: [ESIK, 'puan', [3, 4, 5, 6, 7, 8]],
  esikKapsam: [ESIK, 'kapsam', [0.2, 0.25, 0.3, 0.34, 0.4, 0.5]],
  kalipOnc: [SOZLUK_ONCELIK, 'kalip', [6, 8, 9, 11, 13]],
  normalOnc: [SOZLUK_ONCELIK, 'normal', [6, 8, 10]],
};

// Koordinat iniş: her değişkeni sırayla en iyi değerine getir, iyileşme kalmayınca dur.
let en = olc();
console.log('başlangıç', en, '/', liste.length);
for (let tur = 0; tur < 3; tur++) {
  let degisti = false;
  for (const [ad, [nesne, alan, degerler]] of Object.entries(aralik)) {
    const o = nesne as Record<string, number>;
    const eski = o[alan];
    let enDeger = eski;
    for (const v of degerler) {
      o[alan] = v;
      dizinSifirla();
      const p = olc();
      if (p > en) { en = p; enDeger = v; degisti = true; }
    }
    o[alan] = enDeger;
    dizinSifirla();
    if (enDeger !== eski) console.log(`  ${ad}: ${eski} -> ${enDeger}  (${en})`);
  }
  if (!degisti) break;
}
console.log('sonuç', en, '/', liste.length, { AGIRLIK, ESIK, SOZLUK_ONCELIK });
