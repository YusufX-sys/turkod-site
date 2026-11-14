// Sitedeki Kodi'nin soru eşleştirme başarısını ölçer (Node 22.6+ / 24: .ts doğrudan çalışır).
//
//   node scripts/kodi-dene.ts                     -> geliştirme listesi, ayrıntılı
//   node scripts/kodi-dene.ts gizli               -> gizli liste, yalnızca oranlar
//   node scripts/kodi-dene.ts soru "döngü nasıl"  -> tek soruyu dener (ilk 3 aday ve puanları)
//   node scripts/kodi-dene.ts baglam              -> takip soruları (önceki soru + yeni soru)
//
// Deneme listeleri: scripts/kodi-deneme/*.json  [{ "soru": "...", "beklenen": "madde-id" | null }]
// beklenen null: Kodi hazır cevap vermemeli (site araması devreye girer).
// baglam.json: [{ "onceki": "...", "soru": "...", "beklenen": "madde-id" | "(sözlük)" | null }]
import { readFileSync } from 'node:fs';
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { adaylariSirala, baglamliCevap, sozlukDizini, yerelCevap } from '../src/data/kodi-motor.ts';

const kok = new URL('..', import.meta.url);
const sozluk = sozlukDizini(JSON.parse(readFileSync(new URL('public/kodi-sozluk.json', kok), 'utf8')).k);

const [kip = 'gelistirme', ...geri] = process.argv.slice(2);

if (kip === 'baglam') {
  const liste: { onceki: string; soru: string; beklenen: string | null }[] =
    JSON.parse(readFileSync(new URL('scripts/kodi-deneme/baglam.json', kok), 'utf8'));
  let dogru = 0, baglamsiz = 0;
  for (const o of liste) {
    const ilk = yerelCevap(o.onceki, BILGI, sozluk);
    const c = baglamliCevap(o.soru, { soru: o.onceki, id: ilk?.id }, BILGI, sozluk);
    const b = c ? (c.id ?? '(sözlük)') : null;
    const t = yerelCevap(o.soru, BILGI, sozluk);
    if ((t ? (t.id ?? '(sözlük)') : null) === o.beklenen) baglamsiz++;
    if (b === o.beklenen) dogru++;
    else console.log(`  ${o.onceki}  ->  ${o.soru}\n      beklenen: ${o.beklenen ?? '(yok)'}   bulunan: ${b ?? '(yok)'}`);
  }
  console.log(`Bağlam: ${dogru}/${liste.length} doğru (bağlamsız olsaydı ${baglamsiz}/${liste.length})`);
  process.exit(0);
}

if (kip === 'soru') {
  const soru = geri.join(' ');
  const c = yerelCevap(soru, BILGI, sozluk);
  console.log('Cevap:', c ? (c.id ?? '(sözlük)') : '(yok -> site araması)');
  for (const a of adaylariSirala(soru, BILGI, sozluk).slice(0, 3)) console.log(`  ${a.puan.toFixed(2).padStart(6)}  kapsam ${a.kapsam.toFixed(2)}  ${a.bilgi.id}`);
  process.exit(0);
}

type Ornek = { soru: string; beklenen: string | null };
const liste: Ornek[] = JSON.parse(readFileSync(new URL(`scripts/kodi-deneme/${kip}.json`, kok), 'utf8'));
let dogru = 0, kapsamIci = 0, kapsamIciDogru = 0, kapsamDisi = 0, kapsamDisiDogru = 0;
const yanlislar: string[] = [];
for (const o of liste) {
  const c = yerelCevap(o.soru, BILGI, sozluk);
  const bulunan = c ? (c.id ?? '(sözlük)') : null;
  const tamam = o.beklenen === null ? bulunan === null : bulunan === o.beklenen;
  if (o.beklenen === null) { kapsamDisi++; if (tamam) kapsamDisiDogru++; }
  else { kapsamIci++; if (tamam) kapsamIciDogru++; }
  if (tamam) dogru++;
  else yanlislar.push(`  ${o.soru}\n      beklenen: ${o.beklenen ?? '(yok)'}   bulunan: ${bulunan ?? '(yok)'}`);
}
const yuzde = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-') + '%';
console.log(`Liste: ${kip} (${liste.length} soru)`);
console.log(`  Toplam doğru     : ${dogru}/${liste.length}  ${yuzde(dogru, liste.length)}`);
console.log(`  Doğru madde      : ${kapsamIciDogru}/${kapsamIci}  ${yuzde(kapsamIciDogru, kapsamIci)}`);
console.log(`  Kapsam dışı (yok): ${kapsamDisiDogru}/${kapsamDisi}  ${yuzde(kapsamDisiDogru, kapsamDisi)}`);
if (kip !== 'gizli' && yanlislar.length) console.log('\nYanlışlar:\n' + yanlislar.join('\n'));
