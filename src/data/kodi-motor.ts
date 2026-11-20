// Sitedeki Kodi'nin cevap bulma motoru (yapay zekâ yok, tarayıcıda çalışır).
// Sıra: 1) sözlük sorusu ("yazdır ne demek?")  2) bilgi tabanı  3) (sayfada) site araması.
import type { KodiBaglanti, KodiBilgi } from './kodi-bilgi';

export type KodiCevap = { metin: string; kod?: string; linkler?: KodiBaglanti[] };
/** [TürKod, Python, açıklama] — public/kodi-sozluk.json içindeki kayıt. */
export type SozlukKaydi = [string, string, string];

const HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Küçük harf + Türkçe harfleri sadeleştir (alt çizgi ve noktayı korur). */
// toLocaleLowerCase('tr-TR') yerine toLowerCase(): yalnızca I/İ'de farklılar, ikisi de aşağıda "i"ye katlanır (çok daha hızlı).
export const katla = (s: string) =>
  s.toLowerCase().replace(/[çğıöşüâîû]/g, (h) => HARF[h] || h).replace(/i̇/g, 'i');

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
  'peki', 'hani', 'ayrica', 'sonra', 'tamam', 'bende', 'benden', 'sende', 'senden', 'bizde', 'bizim',
  'falan', 'filan', 'beraber', 'mesela', 'yani', 'sey', 'seyi',
]);

// ---------------------------------------------------------------- bilgi tabanı

/**
 * tamlar: "=" ile başlayan anahtarlar ("=evet", "=kodi"). Yalnızca mesajın TAMAMI buysa eşleşir;
 * "tamam ama döngü nasıl yazılır" gibi uzun cümlelerde kısa sohbet sözcükleri karışmasın diye.
 */
type Hazir = { b: KodiBilgi; tekler: string[]; ifadeler: string[]; tamlar: string[] };
let hazirlik: Hazir[] | null = null;

const hazirla = (bilgi: KodiBilgi[]): Hazir[] =>
  (hazirlik ??= bilgi.map((b) => {
    const tamlar = b.anahtarlar.filter((a) => a.startsWith('=')).map((a) => sadelestir(a.slice(1))).filter(Boolean);
    const sade = [...new Set(b.anahtarlar.filter((a) => !a.startsWith('=')).map(sadelestir).filter(Boolean))];
    return { b, tekler: sade.filter((a) => !a.includes(' ')), ifadeler: sade.filter((a) => a.includes(' ')), tamlar };
  }));

/** Yalnızca işaret ya da emojiden oluşan mesajlar anlamlı sözcüklere çevrilir ("?" -> "soru isareti", "😂" -> "haha"). */
const ISARET: [RegExp, string][] = [
  [/^[?¿]+$/, 'soru isareti'], [/^[!.]+$/, 'hmm'],
  [/^[😂🤣😆😄😁😅😹]+$/u, 'haha'], [/^[😢😭😞😔☹️🙁😿]+$/u, 'uzgunum'], [/^[😡🤬😠]+$/u, 'sinirliyim'],
  [/^[👍👌✅]+$/u, 'tamam'], [/^[❤️💖💕😍🥰😘]+$/u, 'seni seviyorum'], [/^[👋]+$/u, 'merhaba'], [/^[🤔]+$/u, 'hmm'],
];
export function isaretleriCevir(soru: string): string {
  const t = soru.trim().replace(/\s+/g, '').replace(/️/g, '');
  if (!t || /[\p{L}\p{N}]/u.test(t)) return soru;
  for (const [re, s] of ISARET) if (re.test(t)) return s;
  return soru;
}

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
export const AGIRLIK = { anahtar: 2, id: 2, cevap: 1, ek: 0.7, kalip: 0.5, k1: 1.2, b: 0.4, tam: 8, soru: 1 };

type Belge = { b: KodiBilgi; tf: Map<string, number>; uzunluk: number; tekler: string[]; ifadeler: string[]; tamlar: string[] };
type Dizin = { belgeler: Belge[]; df: Map<string, number>; ortUzunluk: number; sozcukler: string[]; sorular: TfDizin<SoruBelge> };
let dizin: Dizin | null = null;
let dizinKaynak: KodiBilgi[] | null = null;
/** Ağırlıklar değişince dizini yeniden kurdurur (deneme aracı). */
export const dizinSifirla = () => { dizin = null; };

/**
 * Hazır maddelerin soru bankası (src/data/kodi-banka-madde/, derlemede /kodi-madde-sorular.json):
 * her madde için önceden üretilmiş olası kullanıcı soruları. Verilmezse Kodi yalnızca anahtarlarla çalışır.
 */
let maddeBankasi: Record<string, string[]> = {};
export function maddeSorulari(banka: Record<string, string[]> | null | undefined) {
  maddeBankasi = banka ?? {};
  dizin = null;
}

const terimler = (s: string) => sadelestir(s).split(' ').filter((w) => w.length > 1 && !DOLGU.has(w));
/** Dizin için: dolgu sözcükleri de tutulur (BM25 sık geçenlerin ağırlığını zaten düşürür). */
const dizinTerimleri = (s: string) => sadelestir(s).split(' ').filter((w) => w.length > 1);

export function dizinKur(bilgi: KodiBilgi[]): Dizin {
  if (dizin && dizinKaynak === bilgi) return dizin;
  const df = new Map<string, number>();
  const belgeler = hazirla(bilgi).map(({ b, tekler, ifadeler, tamlar }) => {
    const tf = new Map<string, number>();
    const ekle = (w: string, agirlik: number) => tf.set(w, (tf.get(w) ?? 0) + agirlik);
    for (const a of b.anahtarlar) if (!a.startsWith('=')) for (const w of dizinTerimleri(a)) ekle(w, AGIRLIK.anahtar);
    for (const w of dizinTerimleri(b.id.replace(/-/g, ' '))) ekle(w, AGIRLIK.id);
    for (const w of terimler(b.cevap)) ekle(w, AGIRLIK.cevap);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    let uzunluk = 0;
    for (const v of tf.values()) uzunluk += v;
    return { b, tf, uzunluk, tekler, ifadeler, tamlar };
  });
  const ortUzunluk = belgeler.reduce((s, x) => s + x.uzunluk, 0) / belgeler.length;
  const sorular = tfDizini(belgeler.flatMap((b, i) => (maddeBankasi[b.b.id] ?? []).map((s) => {
    const tf = new Map<string, number>();
    tfEkle(tf, s, 1);
    return { i, tf, uzunluk: 0 };
  })));
  dizinKaynak = bilgi;
  return (dizin = { belgeler, df, ortUzunluk, sorular, sozcukler: [...new Set([...df.keys(), ...sorular.df.keys()])] });
}

/** Sorudaki sözcüğü dizindeki terimlere bağlar; yoksa yazım hatası olarak en yakın terime. */
export function eslesenTerimler(w: string, d: { sozcukler: string[] }): string[] {
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

/** ekKaynak[i]: ek[i]'nin hangi soru sözcüğünden geldiği ("update" -> "guncelle" eşleşirse "update" karşılanmış sayılır). */
function soruTerimleri(soru: string, sozluk?: SozlukDizini | null): { asil: string[]; ek: string[]; ekKaynak: string[] } {
  // Kesmeden sonraki ek atılır ("print'in" -> "print"), ama tırnak içindeki ad kalır ("'NoneType'")
  const temiz = soru.replace(/(?<=[\p{L}\p{N}])['’][\p{L}]+/gu, '');
  let asil = terimler(temiz);
  // Soru yalnızca dolgu sözcüklerinden oluşuyorsa ("turkod nedir", "python ne") onlar kullanılır.
  if (!asil.length) asil = sadelestir(temiz).split(' ').filter((w) => w.length > 1 && !['ne', 'nedir', 'nasil', 'mi', 'mu'].includes(w));
  const ek: string[] = [], ekKaynak: string[] = [];
  const ekle = (l: string[], w: string) => { for (const e of l) if (!asil.includes(e)) { ek.push(e); ekKaynak.push(w); } };
  for (const w of asil) {
    // Eş anlamlı da ekli hâliyle bulunur: "yaziyi" -> yazi, "yuklerim" -> yukle
    for (const anahtar of ES_ANAHTARLAR) if (anahtar === w || (anahtar.length >= 5 && kokUyar(anahtar, w))) for (const e of ES_ANLAM[anahtar]) ekle(terimler(e), w);
    // Python adı ("set", "range", "append") -> TürKod karşılığı ("küme", "aralık", "sona_ekle")
    const py = sozluk?.py.get(w);
    if (py && w.length >= 3) ekle(terimler(py[0].replace(/_/g, ' ')), w);
  }
  return { asil, ek, ekKaynak };
}

/** Bütün kayıtları puana göre sıralar. */
export function adaylariSirala(soru: string, bilgi: KodiBilgi[], sozluk?: SozlukDizini | null): Eslesme[] {
  const s = sadelestir(soru);
  if (!s) return [];
  const d = dizinKur(bilgi);
  const { asil, ek, ekKaynak } = soruTerimleri(soru, sozluk);
  if (!asil.length && !ek.length) return [];
  const N = d.belgeler.length, k1 = AGIRLIK.k1, bb = AGIRLIK.b;
  // Her soru sözcüğünün bağlandığı dizin terimleri (bir kez hesaplanır). kaynak: kapsamda sayılacak soru sözcüğü.
  const baglar = [...asil.map((w) => ({ w, t: eslesenTerimler(w, d), agirlik: 1, asilMi: true, kaynak: w })),
                  ...ek.map((w, i) => ({ w, t: eslesenTerimler(w, d), agirlik: AGIRLIK.ek, asilMi: false, kaynak: ekKaynak[i] }))];
  const sozcukler = s.split(' ');
  const cerceve = ` ${s} `;
  // Bankadaki en benzer hazır soru (madde başına en iyisi): [puan, karşılanan asıl sözcük sayısı]
  const soruPuani = new Map<number, [number, number]>();
  if (AGIRLIK.soru > 0) for (const sb of d.sorular.belgeler) {
    const p = bm25(sb, d.sorular, baglar);
    const once = soruPuani.get(sb.i);
    if (p[0] > 0 && (!once || p[0] > once[0])) soruPuani.set(sb.i, p);
  }
  const sonuc: Eslesme[] = [];
  for (const [bi, belge] of d.belgeler.entries()) {
    // 1) BM25: her soru sözcüğü için belgede en iyi uyan terimin katkısı
    let bm = 0;
    const karsilananlar = new Set<string>();
    for (const { t, agirlik, kaynak } of baglar) {
      let en = 0;
      for (const terim of t) {
        const f = belge.tf.get(terim);
        if (!f) continue;
        const idf = Math.log(1 + (N - (d.df.get(terim) ?? 0) + 0.5) / ((d.df.get(terim) ?? 0) + 0.5));
        en = Math.max(en, idf * (f * (k1 + 1)) / (f + k1 * (1 - bb + (bb * belge.uzunluk) / d.ortUzunluk)));
      }
      if (en > 0) karsilananlar.add(kaynak);
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
    // Soru, bir anahtarın kendisiyse ("dongu nedir", "hahaha") en güçlü işarettir
    const tamEslesme = belge.ifadeler.includes(s) || belge.tekler.includes(s) || belge.tamlar.includes(s);
    if (tamEslesme) kalip += AGIRLIK.tam / AGIRLIK.kalip;
    const [sp, sk] = soruPuani.get(bi) ?? [0, 0];
    const puan = bm + kalip * AGIRLIK.kalip + sp * AGIRLIK.soru;
    const kapsam = tamEslesme ? 1 : asil.length ? Math.max(karsilananlar.size, sk) / asil.length : 0;
    if (puan > 0) sonuc.push({ bilgi: belge.b, puan, kapsam });
  }
  return sonuc.sort((a, b) => b.puan - a.puan);
}

// ---------------------------------------------------------------- belge bölümleri
// Sitedeki her belge sayfasının ## / ### bölümleri (derlemede üretilir: /kodi-bolumler.json).
// Hazır bilgide olmayan ayrıntılı sorular buradan, bölümün özeti ve bağlantısıyla cevaplanır.

/**
 * [sayfa, sayfa başlığı, bölüm başlığı, çapa, özet, ilk kod, tam metin ('' = özetle aynı), bütün kodlar,
 *  bankadaki olası sorular, bankadaki kısa cevap] — son ikisi src/data/kodi-banka/'dan (bkz. kodi-bolumler.mjs).
 */
export type BolumKaydi = [string, string, string, string, string, string, string?, string[]?, string[]?, string?];
type TfBelge = { tf: Map<string, number>; uzunluk: number };
type BolumBelge = TfBelge & { k: BolumKaydi };
/** Bankadaki her soru ayrı bir belge: kullanıcının sorusu en çok benzediği hazır soruya göre bölüme bağlanır. */
type SoruBelge = TfBelge & { i: number };
type TfDizin<T extends TfBelge> = { belgeler: T[]; df: Map<string, number>; ortUzunluk: number };
export type BolumDizini = TfDizin<BolumBelge> & { sorular: TfDizin<SoruBelge>; sozcukler: string[] };
export type BolumEslesme = { k: BolumKaydi; puan: number; kapsam: number };

/** Bölüm dizini ağırlıkları ve eşikleri (scripts/kodi-ayarla.ts ile ölçülerek seçildi). */
export const BOLUM = { baslik: 2, sayfa: 1.5, ozet: 1, kod: 0.5, esik: 23, kapsam: 0.4, oran: 0.8, soru: 1, oranTam: 2, tamKapsam: 0.75 };

function tfDizini<T extends TfBelge>(belgeler: T[]): TfDizin<T> {
  const df = new Map<string, number>();
  for (const b of belgeler) {
    for (const w of b.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    for (const v of b.tf.values()) b.uzunluk += v;
  }
  return { belgeler, df, ortUzunluk: belgeler.reduce((s, x) => s + x.uzunluk, 0) / Math.max(1, belgeler.length) };
}

const tfEkle = (tf: Map<string, number>, s: string, agirlik: number) => {
  for (const w of dizinTerimleri(s.replace(/_/g, ' '))) tf.set(w, (tf.get(w) ?? 0) + agirlik);
};

export function bolumDizini(kayitlar: BolumKaydi[]): BolumDizini {
  const ana = tfDizini(kayitlar.map((k) => {
    const tf = new Map<string, number>();
    tfEkle(tf, k[2], BOLUM.baslik);
    tfEkle(tf, k[1], BOLUM.sayfa);
    tfEkle(tf, k[6] || k[4], BOLUM.ozet);           // bölümün TAM metni aranır
    for (const kod of k[7]?.length ? k[7] : [k[5]]) tfEkle(tf, kod, BOLUM.kod);
    return { k, tf, uzunluk: 0 };
  }));
  const sorular = tfDizini(kayitlar.flatMap((k, i) => (k[8] ?? []).map((s) => {
    const tf = new Map<string, number>();
    tfEkle(tf, s, 1);
    return { i, tf, uzunluk: 0 };
  })));
  return { ...ana, sorular, sozcukler: [...new Set([...ana.df.keys(), ...sorular.df.keys()])] };
}

type Bag = { t: string[]; agirlik: number; asilMi: boolean };
/** Bir belgenin BM25 puanı ve karşılanan asıl soru sözcüğü sayısı. */
function bm25<T extends TfBelge>(belge: T, d: TfDizin<T>, baglar: Bag[]): [number, number] {
  const N = d.belgeler.length, k1 = AGIRLIK.k1, bb = AGIRLIK.b;
  let puan = 0, karsilanan = 0;
  for (const { t, agirlik, asilMi } of baglar) {
    let en = 0;
    for (const terim of t) {
      const f = belge.tf.get(terim);
      if (!f) continue;
      const n = d.df.get(terim) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      en = Math.max(en, idf * (f * (k1 + 1)) / (f + k1 * (1 - bb + (bb * belge.uzunluk) / d.ortUzunluk)));
    }
    if (en > 0 && asilMi) karsilanan++;
    puan += en * agirlik;
  }
  return [puan, karsilanan];
}

export function bolumAdaylari(soru: string, d: BolumDizini, sozluk?: SozlukDizini | null): BolumEslesme[] {
  const { asil, ek } = soruTerimleri(soru, sozluk);
  if (!asil.length) return [];
  const baglar: Bag[] = [...asil.map((w) => ({ t: eslesenTerimler(w, d), agirlik: 1, asilMi: true })),
                         ...ek.map((w) => ({ t: eslesenTerimler(w, d), agirlik: AGIRLIK.ek, asilMi: false }))];
  // Bankadaki en benzer hazır soru (bölüm başına en iyisi)
  const soruPuani = new Map<number, [number, number]>();
  if (BOLUM.soru > 0) for (const s of d.sorular.belgeler) {
    const p = bm25(s, d.sorular, baglar);
    const once = soruPuani.get(s.i);
    if (p[0] > 0 && (!once || p[0] > once[0])) soruPuani.set(s.i, p);
  }
  const sonuc: BolumEslesme[] = [];
  d.belgeler.forEach((belge, i) => {
    const [p, k] = bm25(belge, d, baglar);
    const [sp, sk] = soruPuani.get(i) ?? [0, 0];
    const puan = p + sp * BOLUM.soru;
    if (puan > 0) sonuc.push({ k: belge.k, puan, kapsam: Math.max(k, sk) / asil.length });
  });
  return sonuc.sort((a, b) => b.puan - a.puan);
}

export function bolumBul(soru: string, d: BolumDizini, sozluk?: SozlukDizini | null): BolumEslesme | null {
  const en = bolumAdaylari(soru, d, sozluk)[0];
  return en && en.puan >= BOLUM.esik && en.kapsam >= BOLUM.kapsam ? en : null;
}

/** Bir metin parçasında sorunun kaç farklı sözcüğü (ekli hâlleriyle) geçiyor. */
function ortusme(parca: string, soruKokleri: string[]): number {
  const s = sadelestir(parca.replace(/_/g, ' ')).split(' ');
  return soruKokleri.filter((k) => s.some((w) => kokUyar(k, w) || (k.length >= 5 && w.startsWith(k.slice(0, 5))))).length;
}

/**
 * Bölümün tam metninden soruya en uygun kısmı seçer: soruyla en çok örtüşen cümle ve
 * (anlam bütünlüğü için) yanındaki cümle. Örtüşme yoksa bölümün özeti gösterilir.
 */
function enUygunKisim(tam: string, ozet: string, soruKokleri: string[]): string {
  if (!tam || !soruKokleri.length) return ozet;
  const birimler = tam.split('\n').flatMap((satir) => satir.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [satir])
    .map((c) => c.trim()).filter((c) => c.length > 2);
  // Bölümün her cümlesinde geçen sözcükler ("yerel", "model") az, nadir olanlar çok sayılır.
  const gecen = birimler.map((c) => soruKokleri.map((k) => ortusme(c, [k]) > 0));
  const agirlik = soruKokleri.map((_, j) => {
    const n = gecen.filter((g) => g[j]).length;
    return n ? Math.log(1 + birimler.length / n) : 0;
  });
  let en = -1, enPuan = 0;
  gecen.forEach((g, i) => {
    const p = g.reduce((t, var_, j) => t + (var_ ? agirlik[j] : 0), 0);
    if (p > enPuan + 1e-9) { enPuan = p; en = i; }
  });
  if (en < 0) return ozet;
  // Özetin içindeyse özet yeterli (başı ve bağlamıyla birlikte).
  if (ozet.includes(birimler[en]) && ozet.length >= 120) return ozet;
  let secim = birimler[en];
  if (secim.length < 160 && birimler[en + 1]) secim += (secim.endsWith(':') ? '\n' : ' ') + birimler[en + 1];
  if (secim.length < 120 && en > 0) secim = birimler[en - 1] + ' ' + secim;
  return secim.length > 480 ? secim.slice(0, 478).replace(/\s+\S*$/, '') + '…' : secim;
}

/** Bölümden Kodi cevabı: soruya en uygun cümleler + en uygun kod örneği + bölüme bağlantı. */
export function bolumCevabi(e: BolumEslesme, soru = ''): KodiCevap & { id: string } {
  const [sayfa, sayfaBaslik, baslik, capa, ozet, ilkKod, tam, kodlar, , hazir] = e.k;
  const yer = baslik && baslik !== sayfaBaslik ? `"${sayfaBaslik}" sayfasının "${baslik}" bölümünde` : `"${sayfaBaslik}" sayfasında`;
  const kokler = soru ? soruTerimleri(soru).asil : [];
  const metin = enUygunKisim(tam || '', ozet, kokler);
  // Bankadaki hazır cevap, soru belgedeki bir cümleyle ondan belirgin biçimde daha çok örtüşmüyorsa gösterilir.
  const hazirMi = !!hazir && (!kokler.length || ortusme(hazir, kokler) + 1 >= ortusme(metin, kokler));
  // Birden çok kod varsa soruyla en çok örtüşeni
  let kod = ilkKod;
  if (kodlar && kodlar.length > 1 && kokler.length) {
    let enP = ortusme(ilkKod, kokler);
    for (const k of kodlar) { const p = ortusme(k, kokler); if (p > enP) { enP = p; kod = k; } }
  }
  return {
    id: `bolum:${sayfa}#${capa}`,
    metin: hazirMi ? hazir! : metin ? `Bu, ${yer} anlatılıyor:\n\n${metin}` : `Bu, ${yer} anlatılıyor. Örneğe bak:`,
    kod: kod || undefined,
    linkler: [{ t: baslik && baslik !== sayfaBaslik ? `${sayfaBaslik} › ${baslik}` : sayfaBaslik, u: capa ? `${sayfa}#${capa}` : sayfa }],
  };
}

/** Bir eşleşmenin cevap verecek kadar güçlü olup olmadığı. */
export const ESIK = { puan: 5, kapsam: 0.5 };
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
  const temiz = soru.replace(/(?<=[\p{L}\p{N}])['’][\p{L}]+/gu, '');
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
export function baglamliCevap(soru: string, onceki: OncekiKonu | null, bilgi: KodiBilgi[], d: SozlukDizini | null,
  bd?: BolumDizini | null)
  : (KodiCevap & { id?: string; baglamdan?: boolean }) | null {
  if (onceki?.id) {
    const b = bilgi.find((x) => x.id === onceki.id);
    const sade = sadelestir(soru);
    if (b?.cevaplar?.length && TEKRAR.test(sade) && sade.split(' ').length <= 6) return { ...maddeCevabi(b), baglamdan: true };
  }
  const tek = yerelCevap(soru, bilgi, d, bd);
  if (!onceki) return tek;
  const { takip, gonderme } = takipMi(soru);
  if (!takip) return tek;
  // Önceki sorudan yalnızca anlamlı sözcükler alınır ("nedir" gibi kalıplar birleşik soruyu sözlük sorusu sanmasın).
  const oncekiKonu = sadelestir(onceki.soru).split(' ').filter((w) => w.length > 1 && !DOLGU.has(w)).join(' ');
  const birlikte = yerelCevap(`${oncekiKonu} ${sadelestir(soru)}`, bilgi, d, bd);
  // Konuya sadık kal: birleşik sorunun maddesi konuyu ADINDA taşıyorsa ("liste" -> liste-cikar, "metin" -> metin-bol)
  // ve tek başına bulunan taşımıyorsa ("peki bölmek" -> aritmetik), takip sorusu o konunun devamıdır.
  const konuKokleri = oncekiKonu.split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 4));
  const konudan = (id?: string) => !!id && !id.startsWith('bolum:') && konuKokleri.some((k) => id.split('-').some((x) => x.startsWith(k)));
  if (birlikte?.id && birlikte.id !== onceki.id && konudan(birlikte.id) && !konudan(tek?.id)) return { ...birlikte, baglamdan: true };
  if (tek && !gonderme) {
    // Tek başına güçlü bir eşleşme varsa (ör. "peki döngü nedir") konu değişmiştir.
    const es = bilgiBul(soru, bilgi, d);
    if (es && es.kapsam >= 0.99) return tek;
  }
  // Birleşik soru aynı cevaba dönüyorsa ve tek başına bir cevap varsa, yeni bilgi verilir.
  if (birlikte && birlikte.id && birlikte.id === onceki.id && tek && tek.id !== onceki.id) return tek;
  if (birlikte) return { ...birlikte, baglamdan: true };
  return tek;
}

/** Alternatifli maddelerde (şaka, bilmece...) her soruluşta sıradaki cevap verilir. */
const siradaki = new Map<string, number>();
export function maddeCevabi(b: KodiBilgi): KodiCevap & { id: string } {
  let metin = b.cevap;
  if (b.cevaplar?.length) {
    const hepsi = [b.cevap, ...b.cevaplar];
    const i = siradaki.get(b.id) ?? 0;
    metin = hepsi[i % hepsi.length];
    siradaki.set(b.id, i + 1);
  }
  return { id: b.id, metin, kod: b.kod, linkler: b.linkler };
}
/** Sıra başa alınır (deneme araçları ve yeni sohbet için). */
export const siraSifirla = () => siradaki.clear();

/** "bir tane daha", "başka", "yine": önceki maddenin sıradaki cevabı istenir. */
const TEKRAR = /^(?:peki\s+|hadi\s+|ya\s+)?(?:bir\s+(?:tane\s+)?daha|bi\s+(?:tane\s+)?daha|baska(?:\s+bir)?(?:\s+tane)?|daha\s+(?:var\s+mi|anlat|soyle|yap)|yine|tekrar|bir\s+daha|devam|bir\s+tane\s+daha)\b/;

export const SOZLUK_ONCELIK = { kalip: 18, normal: 6 };

// ---------------------------------------------------------------- kapsam dışı bekçisi

/** Kapsam dışı eşiği: sorunun anlamlı sözcüklerinin bu oranı Kodi'nin hiçbir verisinde yoksa hazır cevap verilmez. */
export const KAPSAM = { oran: 0.15, enAz: 3 };

/**
 * Sorunun anlamlı sözcüklerinden (en az KAPSAM.enAz harfli, sayı değil) kaçı Kodi'nin hiçbir verisinde
 * (hazır maddeler + banka soruları, belge bölümleri, sözlük) geçmiyor; yazım hatası ve ekler hoş görülür.
 * "dünyanın en uzun nehri", "c++ pointer", "vim modu" gibi sorularda bilinmeyen sözcük çıkar.
 */
export function bilinmeyenOrani(soru: string, bilgi: KodiBilgi[], d: SozlukDizini | null, bd?: BolumDizini | null): number {
  const temiz = soru.replace(/(?<=[\p{L}\p{N}])['’][\p{L}]+/gu, '');
  const sozcukler = [...new Set(terimler(temiz))].filter((w) => w.length >= KAPSAM.enAz && !/^\d+$/.test(w));
  if (!sozcukler.length) return 0;
  const md = dizinKur(bilgi);
  const bilinir = (w: string) =>
    !!(d?.tr.has(w) || d?.py.has(w)) || eslesenTerimler(w, md).length > 0 || (!!bd && eslesenTerimler(w, bd).length > 0);
  return sozcukler.filter((w) => !bilinir(w)).length / sozcukler.length;
}

export function yerelCevap(soru: string, bilgi: KodiBilgi[], d: SozlukDizini | null, bd?: BolumDizini | null)
  : (KodiCevap & { id?: string }) | null {
  soru = isaretleriCevir(soru);
  // Bilinmeyen sözcükler çoksa uydurma bir cevap yerine site araması / Vikipedi devreye girsin.
  if (bilinmeyenOrani(soru, bilgi, d, bd) >= KAPSAM.oran) return null;
  const r = hazirCevap(soru, bilgi, d);
  if (!bd) return r;
  // Belge bölümleri: hazır cevap yoksa ya da bir bölüm belirgin biçimde daha iyi eşleşiyorsa.
  const bl = bolumBul(soru, bd, d);
  if (!bl) return r;
  if (!r) return bolumCevabi(bl, soru);
  // Sözlük cevabı yalnızca tek bir kelimeyi soran kısa sorularda öncelikli ("yazdır ne demek");
  // "exe yaparken kaynak kodu koymak ne işe yarar" gibi uzun sorularda belge bölümü kazanır.
  if (r.id === undefined) return soruTerimleri(soru).asil.length <= 2 ? r : bolumCevabi(bl, soru);
  const es = bilgiBul(soru, bilgi, d);
  // Hazır madde sorunun sözcüklerini (neredeyse) tamamen karşılıyorsa ("KeyError hatası", "len ne işe yarar")
  // o madde tam olarak bu soru için yazılmıştır: bölümün onu geçmesi için daha yüksek puan gerekir.
  // Madde uzun bir sorunun yalnızca bir parçasına değiyorsa, ayrıntıyı anlatan bölüm daha kolay kazanır.
  const oran = es && es.kapsam >= BOLUM.tamKapsam ? BOLUM.oranTam : BOLUM.oran;
  if (!es || bl.puan >= es.puan * oran) return bolumCevabi(bl, soru);
  return r;
}

/** Hazır bilgi + sözlükten cevap (belge bölümleri olmadan). */
function hazirCevap(soru: string, bilgi: KodiBilgi[], d: SozlukDizini | null): (KodiCevap & { id?: string }) | null {
  const es = bilgiBul(soru, bilgi, d);
  const kayit = maddeCevabi;
  const kavram = es && es.bilgi.tur === 'kavram';
  const sz = d ? sozlukCevabi(soru, d) : null;
  if (SOZLUK_KALIBI.test(soru)) {
    // "döngü nedir", "set nedir" -> örnekli kavram anlatımı; "print'in Türkçesi" -> sözlük.
    // "döngü nedir", "TabError ne demek": örnekli kavram ya da hata maddesi sözlük cevabından zengindir
    if ((kavram || es?.bilgi.tur === 'hata') && es && es.puan >= SOZLUK_ONCELIK.kalip) return kayit(es.bilgi);
    if (sz) return sz;
    return es ? kayit(es.bilgi) : null;
  }
  if (es && (es.puan >= SOZLUK_ONCELIK.normal || kavram)) return kayit(es.bilgi);
  if (sz) return sz;
  return es ? kayit(es.bilgi) : null;
}
