// Gerçekçi kullanıcı mesajlarını sitedeki Kodi'nin cevaplama sırasıyla dener ve sonucu döker.
//   node scripts/kodi-kulliyat.ts girdi.json cikti.json
// girdi: [{ "soru", "onceki"?, "kategori"? }]  (onceki: aynı sohbette bir önceki mesaj)
// cikti: her mesaj için { soru, onceki, kategori, kaynak, id, puan, kapsam, cevap }
//   kaynak: hesap | bilgi | bolum | sozluk | hesap-yonlendirme | yok (sitede sayfa araması / "anlayamadım")
import { readFileSync, writeFileSync } from 'node:fs';
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { adaylariSirala, baglamliCevap, katla } from '../src/data/kodi-motor.ts';
import { hesapCevabi, hesapSorusuGibi } from '../src/data/kodi-hesap.ts';
import { bd, sozluk } from './kodi-ortak.ts';

type Girdi = { soru: string; onceki?: string; kategori?: string };
const varMi = (ad: string) => sozluk.tr.has(katla(ad));

/** KodiSite.astro'daki cevapla() ile aynı sıra (Vikipedi ve sayfa araması hariç). */
export function kodiyeSor(soru: string, onceki: { soru: string; id?: string; hesap?: ReturnType<typeof hesapCevabi> } | null) {
  const h = hesapCevabi(soru, onceki?.hesap?.baglam ?? null, varMi);
  if (h) return { kaynak: 'hesap', id: 'hesap', cevap: h.metin, kod: h.kod, hesap: h };
  if (hesapSorusuGibi(soru)) return { kaynak: 'hesap-yonlendirme', id: 'hesap-yonlendirme', cevap: '(hesap sorusu ama çözülemedi)' };
  const c = baglamliCevap(soru, onceki && !onceki.hesap ? { soru: onceki.soru, id: onceki.id } : null, BILGI, sozluk, bd());
  if (!c) return { kaynak: 'yok', id: '', cevap: '' };
  const kaynak = c.id?.startsWith('bolum:') ? 'bolum' : c.id ? 'bilgi' : 'sozluk';
  return { kaynak, id: c.id ?? 'sozluk', cevap: c.metin, kod: c.kod };
}

/** Etiketli mesajı değerlendirir: beklenen = madde id | "hesap" | "sozluk" | null (hazır cevap olmamalı). */
export function dogruMu(beklenen: string | null, r: { kaynak: string; id: string }): boolean {
  if (beklenen === null) return r.kaynak === 'yok';
  if (beklenen === 'hesap') return r.kaynak === 'hesap' || r.kaynak === 'hesap-yonlendirme';
  // "sozluk": sözlük cevabı ya da (aynı adlı) dict maddesi
  if (beklenen === 'sozluk') return r.kaynak === 'sozluk' || r.id === 'sozluk';
  if (r.id === beklenen) return true;
  // Hazır madde yerine aynı konunun belge bölümü verildiyse o da doğrudur
  if (r.kaynak === 'bolum') {
    const sayfa = (u: string) => u.split('#')[0];
    const b = BILGI.find((x) => x.id === beklenen);
    return !!b?.linkler?.some((l) => sayfa(l.u) === sayfa(r.id.slice(6)));
  }
  return false;
}

if (process.argv[1]?.endsWith('kodi-kulliyat.ts') && process.argv[2] === 'olc') {
  // node scripts/kodi-kulliyat.ts olc [liste-harfi] [-v]   -> scripts/kodi-deneme/kullanici.json doğruluğu
  const tum = JSON.parse(readFileSync(new URL('kodi-deneme/kullanici.json', import.meta.url), 'utf8')) as (Girdi & { beklenen: string | null; liste: string })[];
  const harf = process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : null;
  const ayrinti = process.argv.includes('-v');
  const gruplar = new Map<string, { dogru: number; toplam: number }>();
  for (const g of tum.filter((x) => !harf || x.liste === harf)) {
    let onceki = null;
    if (g.onceki) {
      const o = kodiyeSor(g.onceki, null);
      onceki = { soru: g.onceki, id: o.kaynak === 'bilgi' || o.kaynak === 'bolum' ? o.id : undefined, hesap: o.kaynak === 'hesap' ? (o as any).hesap : undefined };
    }
    const r = kodiyeSor(g.soru, onceki);
    const tamam = dogruMu(g.beklenen, r);
    const anahtar = `${g.liste} ${g.beklenen === null ? 'yok' : 'var'}`;
    const s = gruplar.get(anahtar) ?? { dogru: 0, toplam: 0 };
    s.toplam++; if (tamam) s.dogru++;
    gruplar.set(anahtar, s);
    if (ayrinti && !tamam) console.log(`✗ ${g.onceki ? `[${g.onceki.slice(0, 30)}] ` : ''}${g.soru.slice(0, 80)}\n    beklenen ${g.beklenen} | bulunan [${r.kaynak}] ${r.id}`);
  }
  let d = 0, t = 0;
  for (const [k, s] of [...gruplar].sort()) { console.log(`  ${k.padEnd(6)} ${s.dogru}/${s.toplam}  ${((100 * s.dogru) / s.toplam).toFixed(1)}%`); d += s.dogru; t += s.toplam; }
  console.log(`Kullanıcı mesajları: ${d}/${t} doğru (${((100 * d) / t).toFixed(1)}%)`);
} else if (process.argv[1]?.endsWith('kodi-kulliyat.ts')) {
  const [girdiYolu, ciktiYolu] = process.argv.slice(2);
  const liste = JSON.parse(readFileSync(girdiYolu, 'utf8')) as Girdi[];
  const sonuc = liste.map((g) => {
    let onceki = null;
    if (g.onceki) {
      const o = kodiyeSor(g.onceki, null);
      onceki = { soru: g.onceki, id: o.kaynak === 'bilgi' || o.kaynak === 'bolum' ? o.id : undefined, hesap: o.kaynak === 'hesap' ? (o as any).hesap : undefined };
    }
    const r = kodiyeSor(g.soru, onceki);
    const en = adaylariSirala(g.soru, BILGI, sozluk)[0];
    return { soru: g.soru, onceki: g.onceki, kategori: g.kategori, kaynak: r.kaynak, id: r.id,
      puan: en ? +en.puan.toFixed(1) : 0, kapsam: en ? +en.kapsam.toFixed(2) : 0, cevap: r.cevap.slice(0, 160) };
  });
  writeFileSync(ciktiYolu, JSON.stringify(sonuc, null, 1), 'utf8');
  const say = (k: string) => sonuc.filter((s) => s.kaynak === k).length;
  console.log(`${sonuc.length} mesaj | bilgi ${say('bilgi')} | bölüm ${say('bolum')} | sözlük ${say('sozluk')} | hesap ${say('hesap')} | hesap-yönlendirme ${say('hesap-yonlendirme')} | cevapsız ${say('yok')}`);
}
