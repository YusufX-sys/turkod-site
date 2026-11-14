// Sitedeki Kodi'nin cevap bulma motoru (yapay zekâ yok, tarayıcıda çalışır).
// Sıra: 1) sözlük sorusu ("yazdır ne demek?")  2) bilgi tabanı  3) (sayfada) site araması.
import type { KodiBaglanti, KodiBilgi } from './kodi-bilgi';

export type KodiCevap = { metin: string; kod?: string; linkler?: KodiBaglanti[] };
/** [TürKod, Python, açıklama] — public/kodi-sozluk.json içindeki kayıt. */
export type SozlukKaydi = [string, string, string];

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Küçük harf + Türkçe harfleri sadeleştir (alt çizgi ve noktayı korur). */
export const katla = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (h) => HARF[h] || h).replace(/i̇/g, 'i');

/** Eşleştirme için: katla + noktalama/alt çizgi boşluk olur. */
export const sadelestir = (s: string) =>
  katla(s).replace(/[^a-z0-9+ ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Aramada ve sözlük ayıklamada anlam taşımayan sözcükler (sadeleştirilmiş). */
export const DOLGU = new Set([
  'nasil', 'ne', 'neden', 'nedir', 'niye', 'mi', 'mu', 'misin', 'midir', 'bir', 've', 'ile', 'icin', 'bu', 'su', 'o',
  'ben', 'sen', 'bana', 'beni', 'benim', 'yaparim', 'yapilir', 'yapabilirim', 'olur', 'oluyor', 'var', 'yok', 'nerede',
  'nereden', 'hangi', 'kac', 'acaba', 'lutfen', 'de', 'da', 'ki', 'gibi', 'en', 'cok', 'konur', 'eklenir', 'kullanilir',
  'kullanirim', 'istiyorum', 'anlat', 'goster', 'soyle', 'yardim', 'demek', 'demektir', 'ise', 'yarar', 'isi', 'karsiligi',
  'karsilik', 'turkcesi', 'turkce', 'python', 'pythonda', 'turkod', 'turkodda', 'komut', 'komutu', 'kelime', 'kelimesi',
  'fonksiyonu', 'anlami', 'anlamina', 'gelir', 'geliyor', 'kodu', 'yazilir', 'yazarim',
]);

// ---------------------------------------------------------------- bilgi tabanı

type Hazir = { b: KodiBilgi; tekler: string[]; ifadeler: string[] };
let hazirlik: Hazir[] | null = null;

const hazirla = (bilgi: KodiBilgi[]): Hazir[] =>
  (hazirlik ??= bilgi.map((b) => {
    const sade = [...new Set(b.anahtarlar.map(sadelestir).filter(Boolean))];
    return { b, tekler: sade.filter((a) => !a.includes(' ')), ifadeler: sade.filter((a) => a.includes(' ')) };
  }));

/** Ortak başlangıç uzunluğu. */
const onEk = (a: string, b: string) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

/**
 * Tek sözcüklü anahtar, sorudaki bir sözcüğün başına yeterince uyarsa eşleşir:
 * "dongu" -> "donguler"; "degisken" -> "degiskenler" ama "degistir" değil.
 */
const sozcukUyar = (anahtar: string, sozcuk: string) => {
  if (anahtar.length <= 2) return anahtar === sozcuk;
  const gereken = Math.min(anahtar.length, Math.max(5, anahtar.length - 2));
  return onEk(anahtar, sozcuk) >= gereken;
};

export type Eslesme = { bilgi: KodiBilgi; puan: number };

/** Soruya en uygun bilgi kaydını puanıyla döndürür (yoksa null). */
export function bilgiBul(soru: string, bilgi: KodiBilgi[], esik = 5): Eslesme | null {
  const s = sadelestir(soru);
  if (!s) return null;
  const sozcukler = s.split(' ');
  const cerceve = ` ${s} `;
  let en: Eslesme | null = null;
  for (const h of hazirla(bilgi)) {
    let puan = 0;
    for (const ifade of h.ifadeler) {
      // Çok sözcüklü kalıp: sözcük başlarıyla, sırayla geçmeli ("liste sirala" -> "listeyi siralamak").
      const parca = ifade.split(' ');
      let i = 0;
      for (const w of sozcukler) if (i < parca.length && sozcukUyar(parca[i], w)) i++;
      if (i === parca.length) puan += ifade.replace(/ /g, '').length * 1.5;
      else if (cerceve.includes(` ${ifade} `)) puan += ifade.length * 1.5;
    }
    for (const a of h.tekler) if (sozcukler.some((w) => sozcukUyar(a, w))) puan += a.length;
    if (puan > (en?.puan ?? 0)) en = { bilgi: h.b, puan };
  }
  return en && en.puan >= esik ? en : null;
}

// ---------------------------------------------------------------- sözlük

export type SozlukDizini = { tr: Map<string, SozlukKaydi>; py: Map<string, SozlukKaydi> };

export function sozlukDizini(kayitlar: SozlukKaydi[]): SozlukDizini {
  const tr = new Map<string, SozlukKaydi>();
  const py = new Map<string, SozlukKaydi>();
  for (const k of kayitlar) {
    if (!tr.has(katla(k[0]))) tr.set(katla(k[0]), k);
    // Python adının ilk TürKod karşılığı kalır (daha yaygın olan sözlükte önce gelir).
    if (!py.has(k[1].toLowerCase())) py.set(k[1].toLowerCase(), k);
  }
  return { tr, py };
}

// "X ne demek", "X nedir", "X'in Türkçesi", "Python'da X" gibi sözlük soruları
const SOZLUK_KALIBI = /(ne demek|nedir|ne ise yarar|ne işe yarar|ne yapar|turkcesi|türkçesi|karsilig|karşılığ|anlami|anlamı|pythonda|python'da|python’da|turkod'da|türkod'da)/i;

/** Sorudaki olası kelimeler: "print'in Türkçesi" -> ["print", "türkçesi"] */
const adaylar = (soru: string) =>
  (soru.match(/[\p{L}\p{N}_.]+(?:\(\))?/gu) || [])
    .map((w) => w.replace(/\(\)$/, '').replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 1);

/** Sözlükte geçen bir kelimeyi soruyorsa cevap verir. */
export function sozlukCevabi(soru: string, d: SozlukDizini): KodiCevap | null {
  const kaliptaMi = SOZLUK_KALIBI.test(soru);
  // Kesme işaretinden sonrası ek: "print'in" -> "print"
  const temiz = soru.replace(/['’][\p{L}]+/gu, '');
  const kelimeler = adaylar(temiz).filter((w) => !DOLGU.has(sadelestir(w)));
  // Kalıp yoksa yalnızca tek kelimelik sorularda ("yazdır", "print") sözlüğe bakılır.
  if (!kaliptaMi && kelimeler.length !== 1) return null;
  for (const w of kelimeler) {
    const trK = d.tr.get(katla(w));
    if (trK) {
      const [tr, py, ac] = trK;
      return {
        metin: ac
          ? `${tr}: ${ac} Python'da karşılığı ${py}.`
          : `${tr}, Python'daki ${py} için kullandığımız TürKod kelimesi. Programda üzerine gelince ya da terminalde "turkod --anlam ${tr}" yazınca da açıklamasını görebilirsin.`,
        linkler: [{ t: 'Sözlük', u: '/learn/sozluk/' }],
      };
    }
    const pyK = d.py.get(w.toLowerCase());
    if (pyK) {
      const [tr, py, ac] = pyK;
      return {
        metin: `Python'daki ${py}, TürKod'da ${tr} diye yazılır.${ac ? ' ' + ac : ''}`,
        linkler: [{ t: 'Sözlük', u: '/learn/sozluk/' }],
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------- birleştirme

/**
 * Sözlük + bilgi tabanından cevap üretir. Bir kavram kaydı ("döngü nedir") sözlük
 * cevabından daha zengin olduğu için güçlü eşleşmede önce o gelir.
 */
export function yerelCevap(soru: string, bilgi: KodiBilgi[], d: SozlukDizini | null): (KodiCevap & { id?: string }) | null {
  const es = bilgiBul(soru, bilgi);
  const kayit = (b: KodiBilgi) => ({ id: b.id, metin: b.cevap, kod: b.kod, linkler: b.linkler });
  const kavram = es && es.bilgi.tur === 'kavram';
  const sz = d ? sozlukCevabi(soru, d) : null;
  if (SOZLUK_KALIBI.test(soru)) {
    // "döngü nedir" -> örnekli kavram anlatımı; "print'in Türkçesi" -> sözlük.
    if (kavram && es.puan >= 8) return kayit(es.bilgi);
    if (sz) return sz;
    return es ? kayit(es.bilgi) : null;
  }
  if (es && (es.puan >= 8 || kavram)) return kayit(es.bilgi);
  if (sz) return sz;
  return es ? kayit(es.bilgi) : null;
}
