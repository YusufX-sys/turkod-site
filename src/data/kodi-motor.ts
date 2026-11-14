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
  'peki', 'hani', 'ayrica', 'sonra', 'tamam',
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

export type Eslesme = { bilgi: KodiBilgi; puan: number; kapsam: number };

// ---------------------------------------------------------------- eş anlamlılar
// Sorudaki sözcük, bilgi tabanındaki yaygın karşılığına da genişletilir.
const ES_ANLAM: Record<string, string[]> = {
  dizi: ['liste'], array: ['liste'], list: ['liste'],
  sorun: ['hata'], problem: ['hata'], error: ['hata'], hatasi: ['hata'], calismiyor: ['hata'], bozuk: ['hata'],
  function: ['fonksiyon'], fonksiyon: ['tanimla'], metot: ['fonksiyon'], method: ['fonksiyon'], def: ['tanimla', 'fonksiyon'],
  loop: ['dongu'], dongusu: ['dongu'], tekrar: ['dongu'], tekrarla: ['dongu'],
  if: ['eger', 'kosul'], else: ['degilse'], elif: ['degilse eger'], kosul: ['eger'], sart: ['eger', 'kosul'],
  variable: ['degisken'], string: ['metin'], str: ['metin'], yazi: ['metin'],
  input: ['girdi'], klavyeden: ['girdi'], kullanicidan: ['girdi'],
  print: ['yazdir'], ekrana: ['yazdir'], dict: ['sozluk'], dictionary: ['sozluk'],
  install: ['kurulum'], yukle: ['kurulum'], indir: ['kurulum'], kur: ['kurulum'],
  ucretsiz: ['ucret'], bedava: ['ucret', 'ucretsiz'], para: ['ucret'],
  oyun: ['oyun'], robot: ['kodi'], sen: ['kodi'],
  rastgele: ['rastgele'], random: ['rastgele'],
};

// ---------------------------------------------------------------- dizin (BM25)

/** Bir sözcük, dizindeki terime ekli hâliyle uyar mı ("dongu" ~ "donguler", "kume" ~ "kumeyi"). */
const kokUyar = (terim: string, w: string) =>
  terim === w || (terim.length >= 4 && w.startsWith(terim) && w.length - terim.length <= 5)
  || (w.length >= 4 && terim.startsWith(w) && terim.length - w.length <= 3);

/** Sınırlı Damerau-Levenshtein uzaklığı (yazım hatası). */
function uzaklik(a: string, b: string, sinir: number): number {
  if (Math.abs(a.length - b.length) > sinir) return sinir + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let enAz = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const m = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + m);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      enAz = Math.min(enAz, d[i][j]);
    }
    if (enAz > sinir) return sinir + 1;
  }
  return d[a.length][b.length];
}

/** Ayarlanabilir ağırlıklar (scripts/kodi-dene.ts ile ölçülerek seçildi). */
export const AGIRLIK = { anahtar: 2, id: 2, cevap: 1, ek: 1, kalip: 0.35, k1: 1.2, b: 0.6 };

type Belge = { b: KodiBilgi; tf: Map<string, number>; uzunluk: number; tekler: string[]; ifadeler: string[] };
type Dizin = { belgeler: Belge[]; df: Map<string, number>; ortUzunluk: number; sozcukler: string[] };
let dizin: Dizin | null = null;
let dizinKaynak: KodiBilgi[] | null = null;
/** Ağırlıklar değişince dizini yeniden kurdurur (deneme aracı). */
export const dizinSifirla = () => { dizin = null; };

const terimler = (s: string) => sadelestir(s).split(' ').filter((w) => w.length > 1 && !DOLGU.has(w));
/** Dizin için: dolgu sözcükleri de tutulur (BM25 sık geçenlerin ağırlığını zaten düşürür). */
const dizinTerimleri = (s: string) => sadelestir(s).split(' ').filter((w) => w.length > 1);

export function dizinKur(bilgi: KodiBilgi[]): Dizin {
  if (dizin && dizinKaynak === bilgi) return dizin;
  const df = new Map<string, number>();
  const belgeler = hazirla(bilgi).map(({ b, tekler, ifadeler }) => {
    const tf = new Map<string, number>();
    const ekle = (w: string, agirlik: number) => tf.set(w, (tf.get(w) ?? 0) + agirlik);
    for (const a of b.anahtarlar) for (const w of dizinTerimleri(a)) ekle(w, AGIRLIK.anahtar);
    for (const w of dizinTerimleri(b.id.replace(/-/g, ' '))) ekle(w, AGIRLIK.id);
    for (const w of terimler(b.cevap)) ekle(w, AGIRLIK.cevap);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    let uzunluk = 0;
    for (const v of tf.values()) uzunluk += v;
    return { b, tf, uzunluk, tekler, ifadeler };
  });
  const ortUzunluk = belgeler.reduce((s, x) => s + x.uzunluk, 0) / belgeler.length;
  dizinKaynak = bilgi;
  return (dizin = { belgeler, df, ortUzunluk, sozcukler: [...df.keys()] });
}

/** Sorudaki sözcüğü dizindeki terimlere bağlar; yoksa yazım hatası olarak en yakın terime. */
export function eslesenTerimler(w: string, d: Dizin): string[] {
  const dogrudan = d.sozcukler.filter((t) => kokUyar(t, w));
  if (dogrudan.length || w.length < 5) return dogrudan;
  const sinir = w.length >= 8 ? 2 : 1;
  let en: string[] = [];
  let enUzaklik = sinir + 1;
  for (const t of d.sozcukler) {
    // İlk iki harf tutmalı: yazım hatası çoğunlukla sözcüğün ortasında olur ("baskenti" ~ "basla" sayılmasın).
    if (t.length < 4 || t[0] !== w[0] || t[1] !== w[1]) continue;
    // Ekli hâle de bakılır ("fonksyonlar" -> "fonksiyon"), ama orada en fazla 1 harf fark.
    const ekli = w.length > t.length + 1 ? uzaklik(w.slice(0, t.length + 1), t, 1) : Infinity;
    const u = Math.min(uzaklik(w, t, sinir), ekli <= 1 ? ekli : Infinity);
    if (u < enUzaklik) { enUzaklik = u; en = [t]; }
    else if (u === enUzaklik && u <= sinir) en.push(t);
  }
  return enUzaklik <= sinir ? en : [];
}

/** Soru sözcükleri: dolgu atılır, eş anlamlı ve (varsa) sözlükteki TürKod karşılığıyla genişletilir. */
const ES_ANAHTARLAR = Object.keys(ES_ANLAM);

function soruTerimleri(soru: string, sozluk?: SozlukDizini | null): { asil: string[]; ek: string[] } {
  const temiz = soru.replace(/['’][\p{L}]+/gu, '');
  let asil = terimler(temiz);
  // Soru yalnızca dolgu sözcüklerinden oluşuyorsa ("turkod nedir", "python ne") onlar kullanılır.
  if (!asil.length) asil = sadelestir(temiz).split(' ').filter((w) => w.length > 1 && !['ne', 'nedir', 'nasil', 'mi', 'mu'].includes(w));
  const ek: string[] = [];
  for (const w of asil) {
    // Eş anlamlı da ekli hâliyle bulunur: "yaziyi" -> yazi, "yuklerim" -> yukle
    for (const anahtar of ES_ANAHTARLAR) if (anahtar === w || (anahtar.length >= 5 && kokUyar(anahtar, w))) for (const e of ES_ANLAM[anahtar]) ek.push(...terimler(e));
    // Python adı ("set", "range", "append") -> TürKod karşılığı ("küme", "aralık", "sona_ekle")
    const py = sozluk?.py.get(w);
    if (py && w.length >= 3) ek.push(...terimler(py[0].replace(/_/g, ' ')));
  }
  return { asil, ek: ek.filter((e) => !asil.includes(e)) };
}

/** Bütün kayıtları puana göre sıralar. */
export function adaylariSirala(soru: string, bilgi: KodiBilgi[], sozluk?: SozlukDizini | null): Eslesme[] {
  const s = sadelestir(soru);
  if (!s) return [];
  const d = dizinKur(bilgi);
  const { asil, ek } = soruTerimleri(soru, sozluk);
  if (!asil.length && !ek.length) return [];
  const N = d.belgeler.length, k1 = AGIRLIK.k1, bb = AGIRLIK.b;
  // Her soru sözcüğünün bağlandığı dizin terimleri (bir kez hesaplanır).
  const baglar = [...asil.map((w) => ({ w, t: eslesenTerimler(w, d), agirlik: 1, asilMi: true })),
                  ...ek.map((w) => ({ w, t: eslesenTerimler(w, d), agirlik: AGIRLIK.ek, asilMi: false }))];
  const sozcukler = s.split(' ');
  const cerceve = ` ${s} `;
  const sonuc: Eslesme[] = [];
  for (const belge of d.belgeler) {
    // 1) BM25: her soru sözcüğü için belgede en iyi uyan terimin katkısı
    let bm = 0, karsilanan = 0;
    for (const { t, agirlik, asilMi } of baglar) {
      let en = 0;
      for (const terim of t) {
        const f = belge.tf.get(terim);
        if (!f) continue;
        const idf = Math.log(1 + (N - (d.df.get(terim) ?? 0) + 0.5) / ((d.df.get(terim) ?? 0) + 0.5));
        en = Math.max(en, idf * (f * (k1 + 1)) / (f + k1 * (1 - bb + (bb * belge.uzunluk) / d.ortUzunluk)));
      }
      if (en > 0 && asilMi) karsilanan++;
      bm += en * agirlik;
    }
    // 2) Anahtar kalıpları (eski motor): çok sözcüklü kalıp sırayla geçerse güçlü işaret
    let kalip = 0;
    for (const ifade of belge.ifadeler) {
      const parca = ifade.split(' ');
      let i = 0;
      for (const w of sozcukler) if (i < parca.length && sozcukUyar(parca[i], w)) i++;
      if (i === parca.length) kalip += ifade.replace(/ /g, '').length * 1.5;
      else if (cerceve.includes(` ${ifade} `)) kalip += ifade.length * 1.5;
    }
    for (const a of belge.tekler) if (sozcukler.some((w) => sozcukUyar(a, w))) kalip += a.length;
    const puan = bm + kalip * AGIRLIK.kalip;
    if (puan > 0) sonuc.push({ bilgi: belge.b, puan, kapsam: asil.length ? karsilanan / asil.length : 0 });
  }
  return sonuc.sort((a, b) => b.puan - a.puan);
}

/** Bir eşleşmenin cevap verecek kadar güçlü olup olmadığı. */
export const ESIK = { puan: 5, kapsam: 0.34 };
const yeterli = (e: Eslesme | undefined) => !!e && e.puan >= ESIK.puan && e.kapsam >= ESIK.kapsam;

/** Soruya en uygun bilgi kaydını puanıyla döndürür (yoksa null). */
export function bilgiBul(soru: string, bilgi: KodiBilgi[], sozluk?: SozlukDizini | null): Eslesme | null {
  const en = adaylariSirala(soru, bilgi, sozluk)[0];
  return yeterli(en) ? en : null;
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
// ---------------------------------------------------------------- bağlam (takip soruları)

/** Önceki konuya gönderme yapan sözcükler: "bunu", "onun", "peki", "ya" ... (sadeleştirilmiş). */
const GONDERME = new Set(['bu', 'bunu', 'bunun', 'buna', 'bunda', 'bundan', 'bunlar', 'bunlari', 'bunlarin',
  'o', 'onu', 'onun', 'ona', 'onda', 'ondan', 'onlar', 'onlari', 'onlarin', 'su', 'sunu', 'sunun', 'orasi', 'orada',
  'oranin', 'ayni', 'yukaridaki', 'oncekini', 'onceki']);
const TAKIP_BASI = /^(peki|ya|o zaman|ayrica|bir de|hani|sonra|ozaman|ee+|e peki|tamam da)\b/;

/** Soru öncekinin devamı gibi mi? ("peki başkenti nedir", "bunu nasıl sıralarım", "ya for?") */
export function takipMi(soru: string): { takip: boolean; gonderme: boolean } {
  const s = sadelestir(soru);
  const sozcukler = s.split(' ').filter(Boolean);
  const gonderme = sozcukler.some((w) => GONDERME.has(w));
  const anlamli = sozcukler.filter((w) => !DOLGU.has(w) && !GONDERME.has(w) && w.length > 1);
  const takip = gonderme || TAKIP_BASI.test(s) || anlamli.length <= 1;
  return { takip, gonderme };
}

/** Önceki soru (bilgi tabanından cevaplanmış) */
export type OncekiKonu = { soru: string; id?: string };

/**
 * Bağlama göre cevap: takip sorusunda yeni soru, önceki soruyla birlikte de değerlendirilir.
 * "liste nedir" -> "peki nasıl sıralarım" = "liste sırala"; "döngü nedir" -> "ya for?" = for döngüsü.
 * Soru tek başına yeterince açıksa (gönderme sözcüğü yoksa) kendi cevabı önceliklidir.
 */
export function baglamliCevap(soru: string, onceki: OncekiKonu | null, bilgi: KodiBilgi[], d: SozlukDizini | null)
  : (KodiCevap & { id?: string; baglamdan?: boolean }) | null {
  const tek = yerelCevap(soru, bilgi, d);
  if (!onceki) return tek;
  const { takip, gonderme } = takipMi(soru);
  if (!takip) return tek;
  if (tek && !gonderme) {
    // Tek başına güçlü bir eşleşme varsa (ör. "peki döngü nedir") konu değişmiştir.
    const es = bilgiBul(soru, bilgi, d);
    if (es && es.kapsam >= 0.99) return tek;
  }
  // Önceki sorudan yalnızca anlamlı sözcükler alınır ("nedir" gibi kalıplar birleşik soruyu sözlük sorusu sanmasın).
  const oncekiKonu = sadelestir(onceki.soru).split(' ').filter((w) => w.length > 1 && !DOLGU.has(w)).join(' ');
  const birlikte = yerelCevap(`${oncekiKonu} ${sadelestir(soru)}`, bilgi, d);
  // Birleşik soru aynı cevaba dönüyorsa ve tek başına bir cevap varsa, yeni bilgi verilir.
  if (birlikte && birlikte.id && birlikte.id === onceki.id && tek && tek.id !== onceki.id) return tek;
  if (birlikte) return { ...birlikte, baglamdan: true };
  return tek;
}

export const SOZLUK_ONCELIK = { kalip: 9, normal: 6 };

export function yerelCevap(soru: string, bilgi: KodiBilgi[], d: SozlukDizini | null): (KodiCevap & { id?: string }) | null {
  const es = bilgiBul(soru, bilgi, d);
  const kayit = (b: KodiBilgi) => ({ id: b.id, metin: b.cevap, kod: b.kod, linkler: b.linkler });
  const kavram = es && es.bilgi.tur === 'kavram';
  const sz = d ? sozlukCevabi(soru, d) : null;
  if (SOZLUK_KALIBI.test(soru)) {
    // "döngü nedir", "set nedir" -> örnekli kavram anlatımı; "print'in Türkçesi" -> sözlük.
    if (kavram && es.puan >= SOZLUK_ONCELIK.kalip) return kayit(es.bilgi);
    if (sz) return sz;
    return es ? kayit(es.bilgi) : null;
  }
  if (es && (es.puan >= SOZLUK_ONCELIK.normal || kavram)) return kayit(es.bilgi);
  if (sz) return sz;
  return es ? kayit(es.bilgi) : null;
}
