// Kodi'nin bir soruya vereceği cevabın METNİNİ gösterir (belge bölümleri dahil).
//   node scripts/kodi-ornek.ts "Ctrl+G ile satıra atlayınca satır ortada mı kalıyor"
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { yerelCevap } from '../src/data/kodi-motor.ts';
import { bd, sozluk } from './kodi-ortak.ts';

for (const soru of process.argv.slice(2)) {
  const c = yerelCevap(soru, BILGI, sozluk, bd());
  console.log(`\n? ${soru}\n`);
  if (!c) { console.log('  (cevap yok -> site araması)'); continue; }
  console.log(c.metin.split('\n').map((s) => '  ' + s).join('\n'));
  if (c.kod) console.log('\n' + c.kod.split('\n').map((s) => '    | ' + s).join('\n'));
  if (c.linkler?.length) console.log('\n  -> ' + c.linkler.map((l) => `${l.t} (${l.u})`).join(', '));
}
