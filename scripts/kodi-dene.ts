// Sitedeki Kodi'nin soru eşleştirme başarısını ölçer (Node 22.6+ / 24: .ts doğrudan çalışır).
// Belge bölümleri için önce "npm run build" (dist/kodi-bolumler.json üretilir).
//
//   node scripts/kodi-dene.ts                     -> geliştirme listesi, ayrıntılı
//   node scripts/kodi-dene.ts gizli               -> gizli liste, yalnızca oranlar
//   node scripts/kodi-dene.ts ozel-gelistirme     -> belgelerden ayrıntılı sorular, ayrıntılı
//   node scripts/kodi-dene.ts ozel-gizli          -> belgelerden ayrıntılı sorular (gizli), yalnızca oranlar
//   node scripts/kodi-dene.ts hepsi               -> bütün listelerin oranları
//   node scripts/kodi-dene.ts soru "döngü nasıl"  -> tek soruyu dener (ilk 3 aday ve puanları)
//   node scripts/kodi-dene.ts baglam              -> takip soruları (önceki soru + yeni soru)
//
// Deneme listeleri (scripts/kodi-deneme/):
//   gelistirme / gizli:     [{ "soru", "beklenen": "madde-id" | null }]   null: Kodi hazır cevap vermemeli
//   ozel-gelistirme / -gizli: [{ "soru", "sayfa": "/learn/strings/", "baslik": "Bölme ve birleştirme" }]
//   baglam:                 [{ "onceki", "soru", "beklenen" }]
import { existsSync } from 'node:fs';
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { adaylariSirala, baglamliCevap, bolumAdaylari, yerelCevap } from '../src/data/kodi-motor.ts';
import { bd, degerlendir, kok, liste, sozluk } from './kodi-ortak.ts';

const [kip = 'gelistirme', ...geri] = process.argv.slice(2);
const yuzde = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-') + '%';

if (kip === 'soru') {
  const soru = geri.join(' ');
  const c = yerelCevap(soru, BILGI, sozluk, bd());
  console.log('Cevap:', c ? (c.id ?? '(sözlük)') : '(yok -> site araması)');
  console.log(' hazır bilgi:');
  for (const a of adaylariSirala(soru, BILGI, sozluk).slice(0, 3)) console.log(`  ${a.puan.toFixed(2).padStart(6)}  kapsam ${a.kapsam.toFixed(2)}  ${a.bilgi.id}`);
  const d = bd();
  if (d) {
    console.log(' belge bölümleri:');
    for (const a of bolumAdaylari(soru, d, sozluk).slice(0, 3)) console.log(`  ${a.puan.toFixed(2).padStart(6)}  kapsam ${a.kapsam.toFixed(2)}  ${a.k[0]}#${a.k[3]}`);
  }
  process.exit(0);
}

if (kip === 'baglam') {
  const l = liste('baglam') as unknown as { onceki: string; soru: string; beklenen: string | null }[];
  let dogru = 0;
  for (const o of l) {
    const ilk = yerelCevap(o.onceki, BILGI, sozluk, bd());
    const c = baglamliCevap(o.soru, { soru: o.onceki, id: ilk?.id }, BILGI, sozluk, bd());
    const b = c ? (c.id ?? '(sözlük)') : null;
    if (b === o.beklenen) dogru++;
    else console.log(`  ${o.onceki}  ->  ${o.soru}\n      beklenen: ${o.beklenen ?? '(yok)'}   bulunan: ${b ?? '(yok)'}`);
  }
  console.log(`Bağlam: ${dogru}/${l.length} doğru`);
  process.exit(0);
}

function olc(ad: string, ayrintili: boolean) {
  const l = liste(ad);
  let dogru = 0, tam = 0, ic = 0, icDogru = 0, dis = 0, disDogru = 0;
  const yanlislar: string[] = [];
  for (const o of l) {
    const s = degerlendir(o);
    if (s.tamam) dogru++;
    if (s.tam) tam++;
    if (o.beklenen === null) { dis++; if (s.tamam) disDogru++; } else { ic++; if (s.tamam) icDogru++; }
    if (!s.tamam) yanlislar.push(`  ${o.soru}\n      beklenen: ${o.sayfa ? `${o.sayfa} › ${o.baslik}` : (o.beklenen ?? '(yok)')}   bulunan: ${s.bulunan ?? '(yok)'}`);
  }
  console.log(`Liste: ${ad} (${l.length} soru)`);
  console.log(`  Toplam doğru     : ${dogru}/${l.length}  ${yuzde(dogru, l.length)}`);
  if (l[0]?.sayfa) console.log(`  Tam bölüm        : ${tam}/${l.length}  ${yuzde(tam, l.length)}`);
  else {
    console.log(`  Doğru madde      : ${icDogru}/${ic}  ${yuzde(icDogru, ic)}`);
    console.log(`  Kapsam dışı (yok): ${disDogru}/${dis}  ${yuzde(disDogru, dis)}`);
  }
  if (ayrintili && yanlislar.length) console.log('\nYanlışlar:\n' + yanlislar.join('\n'));
}

if (kip === 'hepsi') for (const ad of ['gelistirme', 'gizli', 'ozel-gelistirme', 'ozel-gizli', 'kapsam-gelistirme', 'kapsam-gizli']) if (existsSync(new URL(`scripts/kodi-deneme/${ad}.json`, kok))) olc(ad, false);
else olc(kip, !kip.includes('gizli'));
