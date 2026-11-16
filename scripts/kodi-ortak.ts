// kodi-dene.ts ve kodi-ayarla.ts'in ortak parçaları: veriyi yükler ve bir cevabın doğru olup olmadığına karar verir.
import { existsSync, readFileSync } from 'node:fs';
import { BILGI } from '../src/data/kodi-bilgi.ts';
import { bolumDizini, sozlukDizini, yerelCevap, type BolumDizini, type BolumKaydi } from '../src/data/kodi-motor.ts';

export const kok = new URL('..', import.meta.url);
export const sozluk = sozlukDizini(JSON.parse(readFileSync(new URL('public/kodi-sozluk.json', kok), 'utf8')).k);

/** Belge bölümleri derlemede üretilir (dist/kodi-bolumler.json); yoksa yalnızca hazır bilgi denenir. */
export const bolumKayitlari: BolumKaydi[] = (() => {
  const yol = new URL('dist/kodi-bolumler.json', kok);
  if (!existsSync(yol)) {
    console.warn('Uyarı: dist/kodi-bolumler.json yok (önce "npm run build"); belge bölümleri denenmeyecek.');
    return [];
  }
  return JSON.parse(readFileSync(yol, 'utf8')).b;
})();
let _bd: BolumDizini | null = null;
export const bd = () => (process.env.KODI_BOLUMSUZ ? null : (_bd ??= bolumKayitlari.length ? bolumDizini(bolumKayitlari) : null));
export const bdSifirla = () => { _bd = null; };

export type Ornek = { soru: string; beklenen?: string | null; sayfa?: string; baslik?: string };
export const liste = (ad: string): Ornek[] =>
  JSON.parse(readFileSync(new URL(`scripts/kodi-deneme/${ad}.json`, kok), 'utf8'));

const madde = new Map(BILGI.map((b) => [b.id, b]));
const sayfaOf = (u: string) => u.split('#')[0];

/** Cevabın gösterdiği site sayfaları (bölüm cevabı ya da hazır cevabın bağlantıları). */
export function cevapSayfalari(c: { id?: string; linkler?: { u: string }[] } | null): string[] {
  if (!c) return [];
  if (c.id?.startsWith('bolum:')) return [sayfaOf(c.id.slice(6))];
  return (c.linkler ?? []).map((l) => sayfaOf(l.u)).filter((u) => u.startsWith('/'));
}

export type Sonuc = { tamam: boolean; tam?: boolean; bulunan: string | null };

/** Bir sorunun cevabını değerlendirir. */
export function degerlendir(o: Ornek): Sonuc {
  const c = yerelCevap(o.soru, BILGI, sozluk, bd());
  const bulunan = c ? (c.id ?? '(sözlük)') : null;
  if (o.sayfa) {
    // Belge sorusu: doğru sayfa (tam: doğru bölüm)
    const sayfalar = cevapSayfalari(c);
    const tamam = sayfalar.includes(o.sayfa);
    const tam = !!c?.id?.startsWith('bolum:') && c.linkler?.[0]?.t.endsWith(o.baslik ?? '\u0000');
    return { tamam, tam: tam || (tamam && !c?.id?.startsWith('bolum:')), bulunan };
  }
  if (o.beklenen === null) return { tamam: bulunan === null, bulunan };
  if (bulunan === o.beklenen) return { tamam: true, bulunan };
  // Hazır madde yerine aynı konunun belge bölümü verildiyse o da doğrudur.
  if (bulunan?.startsWith('bolum:')) {
    const beklenenSayfalar = (madde.get(o.beklenen ?? '')?.linkler ?? []).map((l) => sayfaOf(l.u));
    return { tamam: beklenenSayfalar.includes(sayfaOf(bulunan.slice(6))), bulunan };
  }
  return { tamam: false, bulunan };
}
