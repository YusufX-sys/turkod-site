// Kodi motorunun ağırlık ve eşiklerini YALNIZCA geliştirme listelerinde arar (gizli listelere bakmaz).
// Ölçüt: doğru +1, yanlış cevap -0.5 (cevapsız kalmak 0: Kodi yine site aramasına yönlendirir).
// Yanlış cevap, "bilmiyorum" demekten daha kötüdür; kapsam dışı sorular böylece korunur.
//   node scripts/kodi-ayarla.ts            (önce "npm run build": belge bölümleri için)
import { existsSync } from 'node:fs';
import { AGIRLIK, BOLUM, ESIK, SOZLUK_ONCELIK, dizinSifirla } from '../src/data/kodi-motor.ts';
import { bdSifirla, degerlendir, kok, liste, type Ornek } from './kodi-ortak.ts';

const listeler: Ornek[] = [...liste('gelistirme')];
if (existsSync(new URL('scripts/kodi-deneme/ozel-gelistirme.json', kok))) listeler.push(...liste('ozel-gelistirme'));

const olc = () => {
  let d = 0;
  for (const o of listeler) {
    const s = degerlendir(o);
    if (s.tamam) d += 1;
    else if (s.bulunan !== null) d -= 0.5;
  }
  return d;
};

const aralik: Record<string, [Record<string, number>, string, number[]]> = {
  anahtar: [AGIRLIK, 'anahtar', [2, 3]],
  cevap: [AGIRLIK, 'cevap', [0.5, 1, 1.5]],
  ek: [AGIRLIK, 'ek', [0.7, 1, 1.3]],
  kalip: [AGIRLIK, 'kalip', [0.2, 0.35, 0.5]],
  b: [AGIRLIK, 'b', [0.4, 0.6, 0.75]],
  esikPuan: [ESIK, 'puan', [4, 5, 6]],
  esikKapsam: [ESIK, 'kapsam', [0.25, 0.34, 0.4, 0.5]],
  kalipOnc: [SOZLUK_ONCELIK, 'kalip', [8, 9, 11]],
  normalOnc: [SOZLUK_ONCELIK, 'normal', [6, 8]],
  bBaslik: [BOLUM, 'baslik', [2, 3, 4]],
  bSayfa: [BOLUM, 'sayfa', [0.5, 1, 1.5, 2]],
  bOzet: [BOLUM, 'ozet', [0.7, 1, 1.5]],
  bKod: [BOLUM, 'kod', [0, 0.5, 1]],
  bEsik: [BOLUM, 'esik', [8, 10, 12, 14, 16, 19, 23]],
  bKapsam: [BOLUM, 'kapsam', [0.4, 0.5, 0.6, 0.67, 0.75]],
  bOran: [BOLUM, 'oran', [0.5, 0.65, 0.8, 1, 1.3]],
};

// Koordinat iniş: her değişkeni sırayla en iyi değerine getir, iyileşme kalmayınca dur.
let en = olc();
console.log('başlangıç', en, '/', listeler.length);
for (let tur = 0; tur < 3; tur++) {
  let degisti = false;
  for (const [ad, [nesne, alan, degerler]] of Object.entries(aralik)) {
    const eski = nesne[alan];
    let enDeger = eski;
    for (const v of degerler) {
      nesne[alan] = v;
      dizinSifirla(); bdSifirla();
      const p = olc();
      if (p > en) { en = p; enDeger = v; degisti = true; }
    }
    nesne[alan] = enDeger;
    dizinSifirla(); bdSifirla();
    if (enDeger !== eski) console.log(`  ${ad}: ${eski} -> ${enDeger}  (${en})`);
  }
  if (!degisti) break;
}
console.log('sonuç', en, '/', listeler.length, { AGIRLIK, ESIK, SOZLUK_ONCELIK, BOLUM });
