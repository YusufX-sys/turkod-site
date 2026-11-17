// Kodi'nin hesap motoru (yapay zekâ yok, tarayıcıda çalışır).
//
// Kodi matematik sorularını ezberden değil, HESAPLAYARAK cevaplar: soruyu küçük bir
// TürKod programına çevirir, programı arkada (kesin kesirli sayılarla) çalıştırır ve
// sonucu, adımları ve programın kendisini gösterir. Programın her satırı gerçekten
// çalıştırılan işlemin karşılığıdır; Kodi'nin balonundaki "Çalıştır" düğmesi aynı kodu
// gerçek TürKod çeviricisinde de çalıştırabilir.
//
// Anladığı soru türleri:
//   - işlemler: "5 + 3 kaç eder", "12 çarpı 7", "2 üzeri 10", "144'ün karekökü", "5 faktöriyel",
//     "100'ün yüzde 15'i", "300 liraya %20 indirim", "17'nin 5'e bölümünden kalan", "12 ile 18'in ebobu"
//   - denklemler: "3x + 5 = 20", "x^2 - 5x + 6 = 0", "bir sayının 3 katının 5 fazlası 20 ise sayı kaç"
//   - sözel problemler: "Ali'nin 5 elması var, 3 tane daha aldı. Kaç elması oldu?" (sahip, alma/verme,
//     karşılaştırma, her birinde/tanesi, eşit paylaştırma, hız/oran, başta kaç vardı ...)
//   - döngüyle çözülenler: "1'den 100'e kadar sayıların toplamı", "97 asal mı", "36'nın bölenleri",
//     "10. fibonacci sayısı"
//   - birim çevirme: "5 km kaç metre", "3 saat kaç dakika"
//   - takip soruları: "peki 2 ile çarparsam?", "bunun karekökü", "peki 2 tanesini yerse?", "kodunu göster"
// katla, kodi-motor'dakinin aynısı (Node'daki deneme araçları uzantısız içe aktarmayı çözemediği için burada).
const HARF: Record<string, string> = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
const katla = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/g, (h) => HARF[h] || h).replace(/i̇/g, 'i');

export type HesapCevabi = { metin: string; kod?: string };
/** Takip soruları için son hesabın özü (sohbet durumunda saklanır, JSON olabilmeli). */
export type HesapBaglami = {
  tur: 'ifade' | 'problem' | 'denklem' | 'dongu' | 'birim' | 'hiz' | 'sekil';
  /** Sorunun hazırlanmış (katlanmış) hâli: "peki 256 nın", "12 km" gibi takiplerde sayısı değiştirilip yeniden çözülür */
  kaynak?: string;
  /** Hız problemlerinde bulunan hız (km/saat) */
  hiz?: number;
  /** Sonucun kesin değeri, yeni ifadede kullanılabilecek biçimde ("8", "(7/2)") */
  sonuc?: string;
  /** Sözel problemin soru dışındaki cümleleri (takipte yeni cümle eklenir) ve sorusu */
  cumleler?: string[];
  soru?: string;
  kod?: string;
};
export type HesapSonucu = HesapCevabi & { baglam: HesapBaglami };
/** Sözlükte TürKod kelimesi olan adlar değişken adı yapılmaz (ör. "toplam" -> "toplam_"). */
export type KelimeVarMi = (ad: string) => boolean;

// =========================================================================== sayılar
// Kesin kesirli sayı (BigInt) ya da (karekök, sinüs gibi işlemlerden sonra) ondalıklı sayı.
type Kesir = { p: bigint; q: bigint };
type Sayi = Kesir | number;

class HesapHatasi extends Error {}

const ebobB = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const BASAMAK_SINIRI = 3000;
const kesir = (p: bigint, q: bigint = 1n): Kesir => {
  if (q === 0n) throw new HesapHatasi('sifir');
  if (q < 0n) { p = -p; q = -q; }
  const g = ebobB(p, q) || 1n;
  const r = { p: p / g, q: q / g };
  if (r.p.toString().length > BASAMAK_SINIRI || r.q.toString().length > BASAMAK_SINIRI) throw new HesapHatasi('buyuk');
  return r;
};
const kesirMi = (x: Sayi): x is Kesir => typeof x !== 'number';
const ondalik = (x: Sayi): number => (kesirMi(x) ? kesirSayi(x) : x);
function kesirSayi(k: Kesir): number {
  const v = Number(k.p) / Number(k.q);
  if (Number.isFinite(v)) return v;
  // Çok büyük pay/payda: basamakları kaydırarak
  const ps = k.p.toString(), qs = k.q.toString();
  return Number(ps.slice(0, 17)) / Number(qs.slice(0, 17)) * 10 ** ((ps.length - Math.min(17, ps.length)) - (qs.length - Math.min(17, qs.length)));
}
const tamMi = (x: Sayi) => (kesirMi(x) ? x.q === 1n : Number.isInteger(x));
const sifirMi = (x: Sayi) => (kesirMi(x) ? x.p === 0n : x === 0);
const S = (n: number | bigint): Sayi => (typeof n === 'bigint' ? kesir(n) : Number.isInteger(n) ? kesir(BigInt(n)) : n);
/** "3.75" -> 15/4 (kesin) */
const yaziSayi = (s: string): Sayi => {
  const [t, o = ''] = s.split('.');
  return kesir(BigInt(t + o), 10n ** BigInt(o.length));
};

const sonlu = (v: number) => { if (!Number.isFinite(v)) throw new HesapHatasi('tanimsiz'); return v; };
const topla = (a: Sayi, b: Sayi): Sayi => (kesirMi(a) && kesirMi(b) ? kesir(a.p * b.q + b.p * a.q, a.q * b.q) : sonlu(ondalik(a) + ondalik(b)));
const cikar = (a: Sayi, b: Sayi): Sayi => topla(a, eksi(b));
const eksi = (a: Sayi): Sayi => (kesirMi(a) ? { p: -a.p, q: a.q } : -a);
const carp = (a: Sayi, b: Sayi): Sayi => (kesirMi(a) && kesirMi(b) ? kesir(a.p * b.p, a.q * b.q) : sonlu(ondalik(a) * ondalik(b)));
const bol = (a: Sayi, b: Sayi): Sayi => {
  if (sifirMi(b)) throw new HesapHatasi('sifir');
  return kesirMi(a) && kesirMi(b) ? kesir(a.p * b.q, a.q * b.p) : sonlu(ondalik(a) / ondalik(b));
};
const tabanB = (k: Kesir) => (k.p >= 0n ? k.p / k.q : -((-k.p + k.q - 1n) / k.q));
const mod = (a: Sayi, b: Sayi): Sayi => {
  if (sifirMi(b)) throw new HesapHatasi('sifir');
  if (kesirMi(a) && kesirMi(b)) return cikar(a, carp(b, kesir(tabanB(bol(a, b) as Kesir))));
  const x = ondalik(a), y = ondalik(b);
  return x - y * Math.floor(x / y);
};
const tamBol = (a: Sayi, b: Sayi): Sayi => {
  const r = bol(a, b);
  return kesirMi(r) ? kesir(tabanB(r)) : Math.floor(r);
};
function us(a: Sayi, b: Sayi): Sayi {
  if (kesirMi(a) && kesirMi(b) && b.q === 1n) {
    const n = b.p < 0n ? -b.p : b.p;
    // Sonucun basamak sayısı önceden tahmin edilir (9 ** 9 ** 9 tarayıcıyı dondurmasın).
    const tahmin = Number(n) * Math.max(Math.log10(Math.abs(kesirSayi(a)) || 1), Math.log10(Number(a.q)));
    if (tahmin > BASAMAK_SINIRI) throw new HesapHatasi('buyuk');
    const r = kesir(a.p ** n, a.q ** n);
    return b.p < 0n ? bol(S(1), r) : r;
  }
  const v = Math.pow(ondalik(a), ondalik(b));
  if (Number.isNaN(v)) throw new HesapHatasi('tanimsiz');
  return sonlu(v);
}
function faktoriyel(a: Sayi): Sayi {
  if (!tamMi(a) || ondalik(a) < 0) throw new HesapHatasi('faktoriyel');
  const n = Number(ondalik(a));
  if (n > 1000) throw new HesapHatasi('buyuk');
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return kesir(r);
}
/** Kesin karekök (tam kare ise kesin, değilse ondalıklı). */
function karekok(a: Sayi): Sayi {
  const v = ondalik(a);
  if (v < 0) throw new HesapHatasi('negatifkok');
  if (kesirMi(a)) {
    const kp = tamKok(a.p), kq = tamKok(a.q);
    if (kp !== null && kq !== null) return kesir(kp, kq);
  }
  return Math.sqrt(v);
}
function tamKok(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x * x === n ? x : null;
}
function tamDegil(ad: string, ...xs: Sayi[]): bigint[] {
  return xs.map((x) => {
    if (!kesirMi(x) || x.q !== 1n) throw new HesapHatasi(ad);
    return x.p < 0n ? -x.p : x.p;
  });
}
const derece = (x: Sayi) => (ondalik(x) * Math.PI) / 180;
/** Ondalık hesaplarda 0.49999999999999994 gibi kalıntılar temizlenir. */
const temiz = (v: number) => {
  const y = Number(v.toPrecision(13));
  return Math.abs(y - Math.round(y)) < 1e-12 ? Math.round(y) : y;
};

/** Sayıyı Türkçe yazar: 3,5 · 7/2 · 1,41421356237 */
function sayiYaz(x: Sayi): string {
  if (!kesirMi(x)) {
    const t = temiz(x);
    if (Number.isInteger(t) && Math.abs(t) < 1e15) return String(t);
    if (Math.abs(t) >= 1e15 || (Math.abs(t) < 1e-6 && t !== 0)) return t.toExponential(6).replace('.', ',');
    return String(Number(t.toPrecision(12))).replace('.', ',');
  }
  if (x.q === 1n) return x.p.toString();
  const v = kesirSayi(x);
  const kisa = Number(v.toPrecision(12));
  return String(kisa).replace('.', ',');
}
/** Sonlu ondalık açılımı olmayan kesirde ("1/3") yaklaşık olduğu söylenir. */
const tamAcilir = (k: Kesir) => {
  let q = k.q;
  while (q % 2n === 0n) q /= 2n;
  while (q % 5n === 0n) q /= 5n;
  return q === 1n && k.q < 10n ** 12n;
};
function sonucYaz(x: Sayi): string {
  if (kesirMi(x)) {
    if (x.q === 1n) return x.p.toString();
    const k = `${x.p}/${x.q}`;
    if (tamAcilir(x)) return `${sayiYaz(x)} (yani ${k})`;
    return x.q < 10000n ? `${k} (yaklaşık ${sayiYaz(x)})` : `yaklaşık ${sayiYaz(x)}`;
  }
  const t = temiz(x);
  return Number.isInteger(t) || String(t).split('.')[1]?.length < 8 ? sayiYaz(x) : `yaklaşık ${sayiYaz(x)}`;
}
/** Sonucu yeni bir ifadede kullanılacak biçimde ("(7/2)") yazar (takip soruları için). */
function sonucIfadesi(x: Sayi): string {
  if (kesirMi(x)) return x.q === 1n ? (x.p < 0n ? `(${x.p})` : x.p.toString()) : `(${x.p}/${x.q})`;
  const t = temiz(x);
  return t < 0 ? `(${t})` : String(t);
}
/** Koddaki sayı (nokta ile) */
const kodSayi = (x: Sayi): string => {
  if (kesirMi(x)) return x.q === 1n ? x.p.toString() : `${x.p} / ${x.q}`;
  return String(temiz(x));
};


// Türkçe sayı ekleri: 30'a, 5'ten, 17'nin, 6'yı ... (sayının okunuşundaki son sese göre)
const SON_OKUNUS: Record<string, string> = { '0': 'sıfır', '1': 'bir', '2': 'iki', '3': 'üç', '4': 'dört', '5': 'beş', '6': 'altı', '7': 'yedi', '8': 'sekiz', '9': 'dokuz' };
const ONLAR_OK: Record<string, string> = { '1': 'on', '2': 'yirmi', '3': 'otuz', '4': 'kırk', '5': 'elli', '6': 'altmış', '7': 'yetmiş', '8': 'seksen', '9': 'doksan' };
function okunusSonu(n: string): string {
  const t = n.replace(/^-/, '').split(/[.,]/)[0];
  if (/[1-9]$/.test(t)) return SON_OKUNUS[t.slice(-1)];
  if (/[1-9]0$/.test(t)) return ONLAR_OK[t.slice(-2, -1)];
  if (/^0$/.test(t)) return 'sıfır';
  if (/000000000$/.test(t)) return 'milyar';
  if (/000000$/.test(t)) return 'milyon';
  if (/000$/.test(t)) return 'bin';
  return 'yüz';
}
/** sayiEki(30, 'e') -> "30'a"; tür: 'e' (yönelme), 'den' (ayrılma), 'in' (tamlayan), 'i' (belirtme) */
export function sayiEki(n: string | number | bigint, tur: 'e' | 'den' | 'in' | 'i'): string {
  const yazi = String(n);
  const ok = okunusSonu(yazi);
  const unlu = [...ok].reverse().find((h) => 'aeıioöuü'.includes(h))!;
  const ince = 'eiöü'.includes(unlu);
  const yuvarlak = 'oöuü'.includes(unlu);
  const unluyleBiter = 'aeıioöuü'.includes(ok.slice(-1));
  const sert = 'çfhkpsşt'.includes(ok.slice(-1));
  const dar = yuvarlak ? (ince ? 'ü' : 'u') : (ince ? 'i' : 'ı');
  const genis = ince ? 'e' : 'a';
  const ek = tur === 'e' ? (unluyleBiter ? 'y' : '') + genis
    : tur === 'den' ? (sert ? 't' : 'd') + genis + 'n'
    : tur === 'in' ? (unluyleBiter ? 'n' : '') + dar + 'n'
    : (unluyleBiter ? 'y' : '') + dar;
  return `${yazi}'${ek}`;
}

// =========================================================================== ifade ağacı
type Dugum =
  | { t: 'sayi'; v: Sayi; yazi: string }
  | { t: 'deg'; ad: string }
  | { t: 'iki'; op: '+' | '-' | '*' | '/' | '%' | '//' | '^'; a: Dugum; b: Dugum }
  | { t: 'eksi'; a: Dugum }
  | { t: 'fn'; ad: string; args: Dugum[] };

const FONKSIYONLAR = new Set(['karekok', 'kupkok', 'sin', 'cos', 'tan', 'cot', 'log', 'ln', 'mutlak', 'yuvarla', 'taban', 'tavan',
  'ebob', 'ekok', 'ort', 'fakt']);

type Jeton = { t: 'sayi' | 'ad' | 'op'; v: string };
function jetonla(s: string): Jeton[] | null {
  const j: Jeton[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([a-z_]+)|(\*\*|\/\/|[-+*/^%!(),=]))/y;
  let i = 0;
  while (i < s.length) {
    if (/^\s*$/.test(s.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) return null;
    i = re.lastIndex;
    if (m[1]) j.push({ t: 'sayi', v: m[1] });
    else if (m[2]) j.push({ t: 'ad', v: m[2] });
    else j.push({ t: 'op', v: m[3] === '**' ? '^' : m[3] });
  }
  return j;
}

/** Özyinelemeli iniş ayrıştırıcı. x yalnızca denklemlerde değişkendir. */
function ayristir(s: string, degiskenler: string[] = []): Dugum | null {
  const j = jetonla(s);
  if (!j || !j.length) return null;
  let i = 0;
  const bak = () => j[i];
  const al = () => j[i++];
  const opMu = (v: string) => bak()?.t === 'op' && bak().v === v;
  const ifade = (): Dugum => {
    let a = terim();
    while (opMu('+') || opMu('-')) { const op = al().v as '+' | '-'; a = { t: 'iki', op, a, b: terim() }; }
    return a;
  };
  const terim = (): Dugum => {
    let a = tekli();
    for (;;) {
      if (opMu('*') || opMu('/') || opMu('%') || opMu('//')) {
        const op = al().v as '*' | '/' | '%' | '//';
        a = { t: 'iki', op, a, b: tekli() };
      } else if (bak() && (opMu('(') || bak().t === 'ad')) {
        // Örtük çarpma: 3x, 2(3+4), 2pi
        a = { t: 'iki', op: '*', a, b: tekli() };
      } else break;
    }
    return a;
  };
  const tekli = (): Dugum => {
    if (opMu('-')) { al(); return { t: 'eksi', a: tekli() }; }
    if (opMu('+')) { al(); return tekli(); }
    const a = sonek();
    if (opMu('^')) { al(); return { t: 'iki', op: '^', a, b: tekli() }; }
    return a;
  };
  const sonek = (): Dugum => {
    let a = birincil();
    while (opMu('!')) { al(); a = { t: 'fn', ad: 'fakt', args: [a] }; }
    return a;
  };
  const birincil = (): Dugum => {
    const x = al();
    if (!x) throw new Error('bitti');
    if (x.t === 'sayi') return { t: 'sayi', v: yaziSayi(x.v), yazi: x.v };
    if (x.t === 'op' && x.v === '(') {
      const a = ifade();
      if (!opMu(')')) throw new Error(')');
      al();
      return a;
    }
    if (x.t === 'ad') {
      if (x.v === 'pi') return { t: 'deg', ad: 'pi' };
      if (degiskenler.includes(x.v)) return { t: 'deg', ad: x.v };
      if (FONKSIYONLAR.has(x.v)) {
        if (opMu('(')) {
          al();
          const args = [ifade()];
          while (opMu(',')) { al(); args.push(ifade()); }
          if (!opMu(')')) throw new Error(')');
          al();
          return { t: 'fn', ad: x.v, args };
        }
        return { t: 'fn', ad: x.v, args: [tekli()] };    // "karekök 16", "karekök -4"
      }
    }
    throw new Error('beklenmeyen ' + x.v);
  };
  try {
    const a = ifade();
    return i === j.length ? a : null;
  } catch {
    return null;
  }
}

type Ortam = Record<string, Sayi>;
/** pyGibi: bütün sayılar Python'daki gibi ondalıklı (float) hesaplanır (yalnızca karşılaştırma için). */
function hesapla(d: Dugum, o: Ortam = {}, pyGibi = false): Sayi {
  if (pyGibi && d.t === 'sayi') return /\./.test(d.yazi) ? ondalik(d.v) : d.v;
  if (pyGibi && d.t === 'iki' && d.op === '/') return ondalik(hesapla(d.a, o, true)) / ondalik(hesapla(d.b, o, true));
  if (pyGibi && d.t === 'iki') {
    const a = hesapla(d.a, o, true), b = hesapla(d.b, o, true);
    if (!kesirMi(a) || !kesirMi(b)) {
      const x = ondalik(a), y = ondalik(b);
      switch (d.op) {
        case '+': return x + y; case '-': return x - y; case '*': return x * y;
        case '^': return x ** y; case '%': return x - y * Math.floor(x / y); case '//': return Math.floor(x / y);
      }
    }
    return hesapla({ ...d, a: { t: 'sayi', v: a, yazi: '' }, b: { t: 'sayi', v: b, yazi: '' } }, o);
  }
  switch (d.t) {
    case 'sayi': return d.v;
    case 'deg':
      if (d.ad === 'pi') return Math.PI;
      if (d.ad in o) return o[d.ad];
      throw new HesapHatasi('degisken');
    case 'eksi': return eksi(hesapla(d.a, o));
    case 'iki': {
      const a = hesapla(d.a, o), b = hesapla(d.b, o);
      switch (d.op) {
        case '+': return topla(a, b);
        case '-': return cikar(a, b);
        case '*': return carp(a, b);
        case '/': return bol(a, b);
        case '%': return mod(a, b);
        case '//': return tamBol(a, b);
        case '^': return us(a, b);
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'fn': {
      const a = d.args.map((x) => hesapla(x, o));
      const tek = () => { if (a.length !== 1) throw new HesapHatasi('arguman'); return a[0]; };
      switch (d.ad) {
        case 'karekok': return karekok(tek());
        case 'kupkok': { const v = ondalik(tek()); const r = Math.cbrt(v); return Number.isInteger(temiz(r)) ? S(temiz(r)) : r; }
        case 'sin': return temiz(Math.sin(derece(tek())));
        case 'cos': return temiz(Math.cos(derece(tek())));
        case 'tan': {
          const v = ondalik(tek());
          if (((v % 180) + 180) % 180 === 90) throw new HesapHatasi('tanimsiz');
          return temiz(Math.tan(derece(v)));
        }
        case 'cot': {
          const v = ondalik(tek());
          if (((v % 180) + 180) % 180 === 0) throw new HesapHatasi('tanimsiz');
          return temiz(1 / Math.tan(derece(v)));
        }
        case 'log': { const v = ondalik(tek()); if (v <= 0) throw new HesapHatasi('log'); return temiz(Math.log10(v)); }
        case 'ln': { const v = ondalik(tek()); if (v <= 0) throw new HesapHatasi('log'); return Math.log(v); }
        case 'mutlak': { const v = tek(); return ondalik(v) < 0 ? eksi(v) : v; }
        case 'yuvarla': {
          const v = tek();
          // Python'daki yuvarla (round) gibi: yarımlar çift sayıya
          if (kesirMi(v)) { const f = tabanB(v), k = cikar(v, S(f)) as Kesir; const c = k.p * 2n - k.q; return S(c < 0n ? f : c > 0n ? f + 1n : f % 2n === 0n ? f : f + 1n); }
          return Math.round(v);
        }
        case 'taban': { const v = tek(); return kesirMi(v) ? S(tabanB(v)) : Math.floor(v); }
        case 'tavan': { const v = tek(); return kesirMi(v) ? eksi(S(tabanB(eksi(v) as Kesir))) : Math.ceil(v); }
        case 'fakt': return faktoriyel(tek());
        case 'ebob': case 'ekok': {
          if (a.length < 2) throw new HesapHatasi('arguman');
          const n = tamDegil(d.ad, ...a);
          let r = n[0];
          for (const y of n.slice(1)) r = d.ad === 'ebob' ? ebobB(r, y) : (r && y ? (r * y) / ebobB(r, y) : 0n);
          return S(r);
        }
        case 'ort': return bol(a.reduce(topla, S(0)), S(a.length));
      }
    }
  }
  throw new HesapHatasi('bilinmeyen');
}

const ONCELIK: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '//': 2, '^': 4 };
const onc = (d: Dugum) => (d.t === 'iki' ? ONCELIK[d.op] : d.t === 'eksi' ? 3 : 9);

/** İnsan için: 5 × 3, 2^10, √144, 5! (ondalık virgülle) */
function insanYaz(d: Dugum): string {
  const p = (x: Dugum, en: number, sag = false) => {
    const s = insanYaz(x);
    return onc(x) < en || (sag && onc(x) === en && onc(x) < 4) ? `(${s})` : s;
  };
  switch (d.t) {
    case 'sayi': return d.yazi.replace('.', ',');
    case 'deg': return d.ad === 'pi' ? 'π' : d.ad;
    case 'eksi': return `(-${p(d.a, 3)})`;
    case 'iki': {
      const sim = { '+': '+', '-': '-', '*': '×', '/': '÷', '%': 'mod', '//': 'tam bölü', '^': '^' }[d.op];
      if (d.op === '*' && d.b.t === 'deg' && d.b.ad !== 'pi' && d.a.t === 'sayi') return `${insanYaz(d.a)}${d.b.ad}`;
      const ic = d.op === '^' ? `${p(d.a, 5)}^${p(d.b, 4)}` : `${p(d.a, ONCELIK[d.op])} ${sim} ${p(d.b, ONCELIK[d.op], true)}`;
      return ic;
    }
    case 'fn': {
      const a = d.args.map(insanYaz);
      switch (d.ad) {
        case 'karekok': return `√${d.args[0].t === 'sayi' ? a[0] : `(${a[0]})`}`;
        case 'fakt': return `${onc(d.args[0]) < 9 ? `(${a[0]})` : a[0]}!`;
        case 'sin': case 'cos': case 'tan': case 'cot': return `${d.ad} ${a[0]}°`;
        case 'ebob': return `EBOB(${a.join(', ')})`;
        case 'ekok': return `EKOK(${a.join(', ')})`;
        case 'ort': return `(${a.join(' + ')}) ÷ ${a.length}`;
        case 'kupkok': return `∛${a[0]}`;
        case 'mutlak': return `|${a[0]}|`;
        default: return `${d.ad}(${a.join(', ')})`;
      }
    }
  }
}

/** TürKod koduna çevirir. matematik modülü gerekirse kullanan.matematik = true olur. */
function kodYaz(d: Dugum, kullanan: { matematik?: boolean }): string {
  const p = (x: Dugum, en: number, sag = false) => {
    const s = kodYaz(x, kullanan);
    return onc(x) < en || (sag && onc(x) === en) ? `(${s})` : s;
  };
  const m = (ad: string) => { kullanan.matematik = true; return `matematik.${ad}`; };
  switch (d.t) {
    case 'sayi': return d.yazi;
    case 'deg': return d.ad === 'pi' ? m('pi_sayısı') : d.ad;
    case 'eksi': return `-${p(d.a, 3)}`;
    case 'iki': {
      if (d.op === '^') return `${p(d.a, 5)} ** ${p(d.b, 4)}`;
      return `${p(d.a, ONCELIK[d.op])} ${d.op} ${p(d.b, ONCELIK[d.op], true)}`;
    }
    case 'fn': {
      const a = d.args.map((x) => kodYaz(x, kullanan));
      switch (d.ad) {
        case 'karekok': return `${m('karekök')}(${a[0]})`;
        case 'kupkok': return `${p(d.args[0], 5)} ** (1 / 3)`;
        case 'sin': return `${m('sinüs')}(${m('açı_radyan')}(${a[0]}))`;
        case 'cos': return `${m('kosinüs')}(${m('açı_radyan')}(${a[0]}))`;
        case 'tan': return `${m('tanjant')}(${m('açı_radyan')}(${a[0]}))`;
        case 'cot': return `1 / ${m('tanjant')}(${m('açı_radyan')}(${a[0]}))`;
        case 'log': return `${m('logaritma10')}(${a[0]})`;
        case 'ln': return `${m('logaritma')}(${a[0]})`;
        case 'mutlak': return `mutlak(${a[0]})`;
        case 'yuvarla': return `yuvarla(${a[0]})`;
        case 'taban': return `${m('tabana_yuvarla')}(${a[0]})`;
        case 'tavan': return `${m('tavana_yuvarla')}(${a[0]})`;
        case 'fakt': return `${m('faktöriyel')}(${a[0]})`;
        case 'ebob': return `${m('ebob')}(${a.join(', ')})`;
        case 'ekok': return `${m('ekok')}(${a.join(', ')})`;
        case 'ort': return `(${a.join(' + ')}) / ${a.length}`;
      }
    }
  }
  return '?';
}
const islemVar = (d: Dugum): boolean => d.t !== 'sayi';
const fnVar = (d: Dugum, ad: string): boolean =>
  d.t === 'fn' ? d.ad === ad || d.args.some((x) => fnVar(x, ad)) : d.t === 'iki' ? fnVar(d.a, ad) || fnVar(d.b, ad) : d.t === 'eksi' ? fnVar(d.a, ad) : false;

const HATA_METNI: Record<string, string> = {
  sifir: 'Bir sayı sıfıra bölünemez; bu işlemin sonucu tanımsız. TürKod da bu kodu çalıştırınca SıfıraBölmeHatası verir.',
  buyuk: 'Bu sayı çok büyük çıkıyor; burada hesaplamam tarayıcıyı yorar. TürKod programında bu kodu çalıştırabilirsin, Python büyük sayılarla rahat çalışır.',
  faktoriyel: 'Faktöriyel yalnızca 0 ve pozitif tam sayılar için tanımlı (ör. 5! = 120).',
  negatifkok: 'Negatif bir sayının (gerçek sayılarda) karekökü yoktur. TürKod da matematik.karekök(-4) için DeğerHatası verir.',
  tanimsiz: 'Bu işlemin sonucu tanımsız (ör. tan 90°).',
  log: 'Logaritma yalnızca pozitif sayılar için tanımlı.',
  ebob: 'EBOB ve EKOK tam sayılar için hesaplanır.',
  ekok: 'EBOB ve EKOK tam sayılar için hesaplanır.',
};

// =========================================================================== Türkçe -> ifade
const NUM = String.raw`(\d+\/\d+|\d+(?:\.\d+)?|\([^()]*(?:\([^()]*\)[^()]*)*\))`;
const EK = String.raw`(?:'[a-z]+)?`;           // 100'un, 5'e ...
const IN = String.raw`(?:'?n?[iu]n)`;           // tamlayan eki: 100'un, 12'nin
const sg = (s: string, f = 'g') => new RegExp(s, f);

const BIRLER: Record<string, number> = { sifir: 0, bir: 1, iki: 2, uc: 3, dort: 4, bes: 5, alti: 6, yedi: 7, sekiz: 8, dokuz: 9 };
const ONLAR: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kirk: 40, elli: 50, altmis: 60, yetmis: 70, seksen: 80, doksan: 90 };
const BUYUKLER: Record<string, number> = { yuz: 100, bin: 1000, milyon: 1e6, milyar: 1e9 };
const SAYI_SOZ = { ...BIRLER, ...ONLAR, ...BUYUKLER };
/** Fiil ya da başka anlamı da olan sayı sözcükleri: yalnızca ardından bir ad gelirse sayıdır ("yedi elma" ama "elma yedi."). */
const IKI_ANLAMLI = new Set(['yedi', 'alti', 'on', 'uc']);
/** Bunlardan sonra gelen sayı sözcüğü kesin sayıdır ("5 artı yedi"). */
const ISLEM_SOZU = new Set(['arti', 'eksi', 'carpi', 'bolu', 'kere', 'ile', 'uzeri', '+', '-', '*', '/', 'x', '=']);
const BAGLAC = new Set(['ve', 'sonra', 'ama', 'fakat', 'de', 'da', 'ki', 'ise', 'mi', 'mu', 'mı', 'mü', 'veya', 'yada']);
const SAYI_EKLERI = ['', 'i', 'u', 'si', 'su', 'ni', 'nu', 'ini', 'unu', 'sini', 'sunu', 'e', 'a', 'ye', 'ya', 'ine', 'una', 'sine', 'suna',
  'de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan', 'in', 'un', 'nin', 'nun', 'inin', 'unun', 'er', 'ser', 'ar', 'sar', 'ser', 'lik', 'luk',
  'li', 'lu', 'inci', 'nci', 'uncu', 'ncu', 'isi', 'usu', 'ini'];

/**
 * Yazıyla sayıları rakama çevirir: "iki yüz elli" -> 250, "beşini" -> "5'ini", "üçte biri" -> "3'te 1'i",
 * "iki buçuk" -> 2.5. Asıl yazıdaki büyük/küçük harf korunur.
 */
export function sayiSozcukleriniCevir(metin: string): string {
  const p = metin.split(/(\s+)/);
  const cikti: string[] = [];
  let i = 0;
  let oncekiBulunma = false;
  while (i < p.length) {
    const tok = p[i];
    if (!tok || /^\s+$/.test(tok)) { cikti.push(tok); i++; continue; }
    let j = i, toplam = 0, simdiki = 0, adet = 0, ekYazi = '', nok = '', bucuk = false;
    while (j < p.length) {
      const w = p[j];
      if (!w || /^\s+$/.test(w)) break;
      const m = w.match(/^([\p{L}]+)(['’][\p{L}]+)?([.,!?;:]*)$/u);
      if (!m) break;
      const k = katla(m[1]);
      if (adet && k === 'bucuk') { bucuk = true; ekYazi = m[2] ?? ''; nok = m[3]; j += 2; break; }
      // Sözcük ve ek: "besini" = bes + ini
      let kok = '', ek = '';
      if (k in SAYI_SOZ) kok = k;
      else for (const s of Object.keys(SAYI_SOZ)) {
        if (s.length > kok.length && k.startsWith(s) && SAYI_EKLERI.includes(k.slice(s.length))) { kok = s; ek = k.slice(s.length); }
      }
      if (!kok || k === 'yuzde' || (kok === 'yuz' && ek)) break;
      // "on/bir" + ek çoğunlukla zamirdir (onu, ona, ondan, biri); "ikisi", "üçü" de "her ikisi" anlamında kalır
      if (ek && kok === 'on') break;
      if (ek && kok === 'bir' && !oncekiBulunma) break;
      if (ek && /^s/.test(ek) && ['iki', 'uc', 'dort'].includes(kok)) break;
      const sonraki = katla((p[j + 2] ?? '').replace(/[.,!?;:]+$/, ''));
      if (!ek && !m[2] && kok === 'bir' && !adet && !oncekiBulunma) {
        // tek başına "bir" çoğunlukla belirsizlik sıfatıdır ("bir sayı"); "bir tane", "bir buçuk", "bir milyon" sayıdır
        if (m[3] || !(sonraki in BUYUKLER || ['tane', 'adet', 'bucuk'].includes(sonraki))) break;
      }
      if (!ek && !m[2] && IKI_ANLAMLI.has(kok) && !adet) {
        // "yedi elma" sayı, "elma yedi." fiil
        if (!ISLEM_SOZU.has(katla(p[i - 2] ?? '')) && (m[3] || !p[j + 2] || BAGLAC.has(sonraki))) break;
      }
      const v = SAYI_SOZ[kok];
      if (kok in BUYUKLER) {
        if (v === 100) simdiki = (simdiki || 1) * 100;
        else { toplam += (simdiki || 1) * v; simdiki = 0; }
      } else simdiki += v;
      adet++;
      ekYazi = (ek ? "'" + ek : '') + (m[2] ?? ''); nok = m[3];
      j += 2;
      if (ek || m[2] || m[3]) break;   // ekli ya da noktalamalı sözcük diziyi bitirir
    }
    if (!adet) { cikti.push(tok); oncekiBulunma = false; i++; continue; }
    cikti.push(String(toplam + simdiki + (bucuk ? 0.5 : 0)) + ekYazi + nok);
    oncekiBulunma = /^'(de|da|te|ta)$/.test(ekYazi);
    i = j - 1;   // son sözcükten sonraki boşluk bir sonraki turda eklenir
  }
  return cikti.join('');
}

/** Ortak ön hazırlık: kesme işaretleri, sembolik karakterler, ondalık virgül, binlik nokta. */
function onHazirla(s: string): string {
  return sayiSozcukleriniCevir(s.replace(/[’`´‘]/g, "'"))
    .replace(/(\d)\s*[xX×·]\s*(?=\d)/g, '$1*')
    .replace(/[×·∙]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3')
    .replace(/√\s*/g, ' karekök ').replace(/∛\s*/g, ' küpkök ').replace(/π/g, ' pi ')
    // Binlik ayırıcı: 1.000.000 ve "1.500 lira" -> 1500 (ama 2.5 ondalıktır)
    .replace(/(?<![\d.])\d{1,3}(?:\.\d{3}){2,}(?![\d.])/g, (m) => m.replace(/\./g, ''))
    .replace(/(?<![\d.])([1-9]\d{0,2})\.(\d{3})(?![\d.,])(?=\s*(?:tl|lira|₺|kişi|adet|tane|km|metre|kg|gram|litre|dolar|euro|öğrenci|kitap|sayfa|$))/giu, '$1$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    // (-3) x (-4), 2 x (3+4): parantezli çarpma
    .replace(/(\d|\))\s*[xX]\s*(?=\()/g, '$1*').replace(/\)\s*[xX]\s*(?=-?\d)/g, ')*')
    // Kesme işaretsiz ekler: "144 ün", "12 ile 18 in", "200 ün yüzde 15 i", "3e böl", "1 den 30 a" -> 144'ün ...
    .replace(/(\d|%)\s?(?<![a-zçğıöşü])(ün|un|ın|in|nin|nın|nun|nün|ye|ya|e|a|de|da|te|ta|den|dan|ten|tan|nden|ndan|i|ı|u|ü|si|sı|su|sü|yi|yı|yu|yü|ni|nı|nu|nü|ini|ını|unu|ünü|ine|ına|une|üne|lik|lık|luk|lük|er|ar|şer|şar)(?![\p{L}\d])/gu, "$1'$2");
}

/** Sözcüklerle yazılmış işlemi sembollere çevirir (katlanmış metinde). */
function sozcukleriSembolle(s: string): string {
  const N = NUM;
  // Yerine konan parça boşluklarla çevrilir: "sin 30 kac" -> " sin(30)  kac"
  const R = (desen: string, yeni: string | ((...m: string[]) => string)) => {
    s = s.replace(sg(desen), typeof yeni === 'string' ? ` ${yeni} ` : (...m: string[]) => ` ${yeni(...m)} `);
  };
  // yüzde: "100'un yuzde 15'i", "200'un %15'i"
  R(`${N}${IN}\\s+(?:yuzde\\s*|%\\s*)${N}${EK}`, '($1*$2/100)');
  // "%15'i 200" pek kullanılmaz; "yuzde 15" tek başına: 15/100
  // zam / indirim: "300 liraya %20 indirim", "300 tl'lik urune yuzde 20 zam"
  R(`${N}\\s*(?:tl|lira|dolar|euro|\\$|₺)?(?:'?[a-z]*)(?:\\s*lik)?\\s+(?:[a-z]+\\s+){0,2}?(?:yuzde\\s*|%\\s*)${N}${EK}\\s+(zam|indirim)[a-z]*(?:\\s+(?:yapilirsa|yapilinca|uygulanirsa|gelirse|olursa|yapilir))?`,
    (_m, a, p, t) => (t === 'zam' ? `(${a}*(1+${p}/100))` : `(${a}*(1-${p}/100))`));
  R(`(?:yuzde\\s*|%\\s*)${N}${EK}\\s+(zam|indirim)[a-z]*\\s+(?:[a-z]+\\s+){0,2}?${N}\\s*(?:tl|lira|dolar|euro)?(?:'?[a-z]*)(?:\\s*'?l[iu]k)?(?:\\s+[a-z]+(?=\\s+(?:kac|ne\\s+kadar|olur|eder)))?`,
    (_m, p, t, a) => (t === 'zam' ? `(${a}*(1+${p}/100))` : `(${a}*(1-${p}/100))`));
  // "30, 120'nin yuzde kaci"
  R(`${N}${EK}\\s*,?\\s*${N}${IN}\\s+yuzde\\s+kac[a-z]*`, '($1/$2*100)');
  // "100 tl'nin %18'i"
  R(`${N}\\s*(?:tl|lira|dolar|euro|kg|km|metre|litre|gram)${IN}\\s+(?:yuzde\\s*|%\\s*)${N}${EK}`, '($1*$2/100)');
  // tek başına "yüzde 50", "%25"
  R(`(?:yuzde\\s*|%\\s*)${N}${EK}`, '($1/100)');
  // kuvvet, kare, küp
  R(`${N}${IN}\\s+${N}\\.?\\s*(?:kuvveti|ussu)`, '($1^$2)');
  R(`${N}${IN}\\s+karesi`, '($1^2)');
  R(`${N}${IN}\\s+kupu`, '($1^3)');
  R(`${N}${EK}\\s+(?:sayisinin\\s+)?karekoku`, 'karekok($1)');
  R(`${N}${EK}\\s+kupkoku`, 'kupkok($1)');
  R(`(karekok|kupkok)u?\\s*(?:'?[a-z]+)?\\s+${N}${EK}`, '$1($2)');
  // faktöriyel
  R(`${N}${EK}\\s+faktoriyel[a-z]*`, '($1!)');
  R(`faktoriyel[a-z]*\\s*${N}${EK}`, '($1!)');
  // kalan, tam bölüm
  R(`${N}${EK}\\s+${N}${EK}\\s+(?:ile\\s+)?bolumunden\\s+kalan[a-z]*`, '($1%$2)');
  R(`${N}\\s*(?:bolu|/)\\s*${N}${EK}\\s+(?:islemin(?:in|den)\\s+)?kalan[a-z]*`, '($1%$2)');
  R(`${N}${EK}\\s+${N}${EK}\\s+tam\\s+bolumu`, '($1//$2)');
  R(`\\bmod(?:u|ulo|unu)?\\b`, '%');
  // liste işlemleri: "3, 5 ve 7'nin toplami", "12 ile 18'in ebobu"
  R(`((?:${N}\\s*,\\s*)*${N})\\s*(?:,|ile|ve)\\s+${N}${EK}\\s+(?:sayilarinin\\s+)?(toplami|farki|carpimi|bolumu|ortalamasi|ebob[a-z]*|ekok[a-z]*|obeb[a-z]*|okek[a-z]*)`,
    (_m, bas, _a, _b, son, ne) => {
      const l = [...bas.split(/\s*,\s*/), son];
      if (ne.startsWith('ebob') || ne.startsWith('obeb')) return `ebob(${l.join(',')})`;
      if (ne.startsWith('ekok') || ne.startsWith('okek')) return `ekok(${l.join(',')})`;
      if (ne === 'ortalamasi') return `ort(${l.join(',')})`;
      const op = { toplami: '+', farki: '-', carpimi: '*', bolumu: '/' }[ne as 'toplami'];
      return `(${l.join(op)})`;
    });
  R(`\\b(ebob|ekok|obeb|okek)[a-z]*\\s*\\(?\\s*((?:\\d+\\s*(?:,|ve|ile|\\s)\\s*)+\\d+)\\s*\\)?`, (_m, f, l) =>
    `${f === 'obeb' ? 'ebob' : f === 'okek' ? 'ekok' : f}(${l.split(/\s*(?:,|ve|ile|\s)\s*/).filter(Boolean).join(',')})`);
  R(`\\b(?:ortalama[a-z]*)\\s*\\(?\\s*((?:\\d+(?:\\.\\d+)?\\s*(?:,|ve|ile|\\s)\\s*)+\\d+(?:\\.\\d+)?)\\s*\\)?`, (_m, l) =>
    `ort(${l.split(/\s*(?:,|ve|ile|\s)\s*/).filter(Boolean).join(',')})`);
  // yarısı, çeyreği, "N'in M katı", "N'in 3'te 1'i"
  R(`${N}${IN}\\s+yarisi`, '($1/2)');
  R(`${N}${IN}\\s+ceyregi`, '($1/4)');
  R(`${N}${IN}\\s+${N}\\s*kati`, '($1*$2)');
  R(`${N}${IN}\\s+${N}'?(?:de|da|te|ta)\\s+${N}'?[a-z]*`, '($1*$3/$2)');
  R(`${N}'?(?:de|da|te|ta)\\s+${N}'?(?:i|u|si|su|ini|unu)\\b`, '($2/$1)');
  // trigonometri, logaritma
  const TRIG: Record<string, string> = { sin: 'sin', sinus: 'sin', cos: 'cos', kosinus: 'cos', tan: 'tan', tanjant: 'tan', cot: 'cot', kotanjant: 'cot', log: 'log', logaritma: 'log', ln: 'ln', mutlak: 'mutlak' };
  R(`\\b(sin|sinus|cos|kosinus|tan|tanjant|cot|kotanjant|log|logaritma|ln)\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)?\\s*(?:°|derece[a-z]*)?`, (_m, f, x) => `${TRIG[f]}(${x})`);
  R(`${N}${EK}\\s*(?:°|derece[a-z]*)?\\s+(sinusu|kosinusu|tanjanti|kotanjanti|logaritmasi)`, (_m, x, f) => `${TRIG[f.replace(/(u|i|si|ti)$/, '').replace(/s$/, 's')] ?? TRIG[f.slice(0, -1)] ?? TRIG[f.slice(0, -2)]}(${x})`);
  R(`${N}${EK}\\s+(?:sayisinin\\s+)?mutlak\\s+deger[a-z]*`, 'mutlak($1)');
  R(`\\bmutlak\\s*(?:deger[a-z]*)?\\s*\\(?\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)?`, 'mutlak($1)');
  R(`\\|\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\|`, 'mutlak($1)');
  // sözlü işlemler: "5 ile 3'u topla", "10'dan 3 cikar", "12'yi 4'e bol", "6 ile 7'yi carp"
  R(`${N}${EK}\\s+(?:ile|ve)\\s+${N}${EK}\\s+(?:topla|toplar|toplan)[a-z]*`, '($1+$2)');
  R(`${N}${EK}\\s+(?:ile|ve)\\s+${N}${EK}\\s+(?:carp)[a-z]*`, '($1*$2)');
  R(`${N}'?(?:d|t)[ae]n\\s+${N}${EK}\\s+(?:cikar|eksilt)[a-z]*`, '($1-$2)');
  R(`${N}${EK}\\s+${N}'?y?[ae]\\s+(?:bol)[a-z]*`, '($1/$2)');
  R(`${N}'?y?[ae]\\s+${N}${EK}\\s+(?:ekle|eklen)[a-z]*`, '($1+$2)');
  // işlem sözcükleri
  R(`\\barti\\b`, '+'); R(`\\beksi\\b`, '-');
  R(`\\b(?:carpi|kere|carp)\\b`, '*'); R(`\\bbolu\\b`, '/');
  R(`\\b(?:uzeri|ussu|kuvvet)\\b`, '^');
  R(`(\\d)\\s*:\\s*(\\d)`, '$1/$2');
  R(`\\bpi\\s*sayisi\\b`, 'pi');
  // "5'in 2 kati" kaldı mı? "2 kati 5" (çarpma)
  return s;
}

/** Hesap sorularında anlam taşımayan sözcükler. */
const HESAP_DOLGU = new Set(['kac', 'kactir', 'eder', 'ediyor', 'yapar', 'yapiyor', 'nedir', 'neye', 'esittir', 'esit', 'hesapla', 'hesaplar',
  'hesaplarmisin', 'hesaplayin', 'hesaplayabilir', 'hesaplayabilirmisin', 'hesaplasana', 'misin', 'musun', 'mi', 'mu', 'sonucu', 'sonuc', 'sonuclari',
  'islemi', 'isleminin', 'isleminin', 'islem', 'bul', 'bulur', 'bulurmusun', 'ne', 'olur', 'lutfen', 'peki', 'acaba', 'bana', 'soyle',
  'soyler', 'cevap', 'cevabi', 'kodi', 'sence', 'hemen', 'simdi', 'yap', 'degeri', 'degerini', 'kacti', 'tane', 'sayisi',
  'sayisinin', 'ya', 'ee', 'hadi', 'bakalim', 've', 'sayilarin', 'nin', 'ise', 'yaklasik', 'kac?',
  'lira', 'tl', 'liradir', 'ondalik', 'olarak', 'seklinde', 'cinsinden', 'u', 'i', 'in', 'un', 'yi', 'yu', 'si', 'su', 'dolar', 'euro', 'olursa', 'yapilirsa', 'kalir', 'tutar', 'tutari', 'fiyati', 'yeni', 'sayinin', 'derece']);

/** Katlanmış metinden ifade dizgesi: dolgu atılır; geriye yalnızca işlem kalmalı. */
function ifadeDizgesi(sade: string): string | null {
  let s = sozcukleriSembolle(sade);
  s = s.replace(/(\d|\)|!)'[a-z]+/g, '$1');                    // 5'e -> 5
  s = s.replace(/[?¿]+/g, ' ').replace(/=\s*\??\s*$/, ' ').replace(/\s=\s*$/, ' ');
  const sozler = s.split(/\s+/).filter(Boolean);
  const kalan: string[] = [];
  for (const w of sozler) {
    const ciplak = w.replace(/^[.,!;:]+|(?<![\d)!])[.,!;:]+$|(?<=[\d)!])[.,;:]+$/g, '');
    if (!ciplak) continue;
    if (HESAP_DOLGU.has(ciplak)) continue;
    kalan.push(ciplak);
  }
  let ifade = kalan.join(' ');
  if (!ifade || !/\d/.test(ifade)) return null;
  // Geriye yalnızca rakam, işlem ve bilinen fonksiyon adları kalmalı
  const yabanci = (l: string[]) => l.join(' ').match(/[a-z_]+/g)?.some((a) => !FONKSIYONLAR.has(a) && a !== 'pi');
  if (yabanci(kalan)) {
    // "5 elma + 3 elma": sayının hemen ardındaki birim sözcükleri atılır (yalnızca açık bir işlem işareti varsa)
    if (!/\d\s*[+*/^-]|[+*/^-]\s*\d/.test(s)) return null;
    // Birim: sayıdan sonra ve bir işlemden önce gelir ("5 elma +"); sondaki aynı sözcük de atılır ("+ 3 elma")
    const birimMi = (w: string, i: number) => /^[a-z]+$/.test(w) && !FONKSIYONLAR.has(w) && w !== 'pi' && i > 0 && /[\d)]$/.test(kalan[i - 1]);
    const islemOncesi = new Set(kalan.filter((w, i) => birimMi(w, i) && /^[+*/^%-]/.test(kalan[i + 1] ?? '')));
    const birimsiz = kalan.filter((w, i) => !(birimMi(w, i) && islemOncesi.has(w)));
    if (yabanci(birimsiz)) return null;
    ifade = birimsiz.join(' ');
  }
  return ifade;
}

// =========================================================================== çıktı yardımcıları
function kodMetni(satirlar: string[], kullanan: { matematik?: boolean }): string {
  return (kullanan.matematik ? 'içe_aktar matematik\n\n' : '') + satirlar.join('\n');
}
const ARKADA = 'Bunu arkada şu TürKod koduyla çalıştırıp hesapladım:';

// =========================================================================== 1) işlem
function islemCevabi(ifade: string): HesapSonucu | null {
  const d = ayristir(ifade);
  if (!d || !islemVar(d)) return null;
  const kullanan: { matematik?: boolean } = {};
  const kod = kodMetni([`yazdır(${kodYaz(d, kullanan)})`], kullanan);
  let v: Sayi;
  try { v = hesapla(d); } catch (e) {
    if (e instanceof HesapHatasi) return { metin: `${insanYaz(d)} → ${HATA_METNI[e.message] ?? 'Bunu hesaplayamadım.'}`, kod, baglam: { tur: 'ifade', kod } };
    return null;
  }
  const notlar: string[] = [];
  if (['sin', 'cos', 'tan', 'cot'].some((f) => fnVar(d, f))) notlar.push('Açıları derece olarak aldım; kodda açı_radyan() ile radyana çeviriyorum.');
  if (fnVar(d, 'yuvarla')) notlar.push('Not: yuvarla() tam ortadaki sayıları çift sayıya yuvarlar (2,5 -> 2).');
  const ozel = /\/|÷/.test(insanYaz(d)) && kesirMi(v) && v.q !== 1n ? ' Python\'da / işlemi ondalıklı sonuç verir; tam bölme için // kullanılır.' : '';
  const ondalikla = /\//.test(kodYaz(d, {})) && kesirMi(v) && v.q === 1n && !/\/\//.test(kodYaz(d, {}));
  // Python ondalıklı sayılarla (ikilik sistem) hesaplar: 0.1 + 0.2 -> 0.30000000000000004. Fark varsa söylenir.
  try {
    const py = hesapla(d, {}, true);
    if (typeof py === 'number' && kesirMi(v) && v.q !== 1n && tamAcilir(v)) {
      const pyYazi = String(py);
      if (!/e/.test(pyYazi) && pyYazi.replace(/^-?\d+\./, '').length >= 12 && pyYazi !== String(kesirSayi(v))) {
        notlar.push(`Not: TürKod bunu ${pyYazi} yazar. Bilgisayar ondalık sayıları ikilik sistemde tuttuğu için küçük bir yuvarlama farkı oluşur; düzgün görmek için yuvarla(sonuç, 2) kullanabilirsin.`);
      }
    }
  } catch { /* yok say */ }
  const metin = `${insanYaz(d)} = ${sonucYaz(v)}` + (ondalikla ? ` (TürKod / ile böldüğü için ${v.p}.0 yazar)` : '')
    + (notlar.length ? `\n\n${notlar.join(' ')}` : '') + (ozel ? `\n\n${ozel.trim()}` : '') + `\n\n${ARKADA}`;
  return { metin, kod, baglam: { tur: 'ifade', sonuc: sonucIfadesi(v), kod } };
}

// =========================================================================== 2) denklem
type Dogrusal = { a: Sayi; b: Sayi };
function denklemCoz(sol: string, sag: string, kaynak: string): HesapSonucu | null {
  const L = ayristir(sol, ['x']), R = ayristir(sag, ['x']);
  if (!L || !R) return null;
  const f = (x: Sayi) => cikar(hesapla(L, { x }), hesapla(R, { x }));
  const yanlar = (x: Sayi) => [hesapla(L, { x }), hesapla(R, { x })];
  let d0: Sayi[], d1: Sayi[], d2: Sayi[], d3: Sayi[];
  try { d0 = [1, 2, 3, 4].map((n) => f(S(n))); } catch { return null; }
  if (!d0.every(kesirMi)) return null;
  // Farklar: doğrusal mı, ikinci derece mi?
  const fark = (l: Sayi[]) => l.slice(1).map((v, i) => cikar(v, l[i]));
  d1 = fark(d0); d2 = fark(d1); d3 = fark(d2);
  const kullanan: { matematik?: boolean } = {};
  const solK = kodYaz(L, kullanan), sagK = kodYaz(R, kullanan);
  const insan = `${insanYaz(L)} = ${insanYaz(R)}`;
  if (d2.every(sifirMi)) {
    const a = d1[0];
    const b = cikar(d0[0], a);                 // f(x) = a*x + b
    if (sifirMi(a)) {
      const metin = sifirMi(b)
        ? `${insan} her x için doğru; denklemin sonsuz çözümü var.`
        : `${insan} hiçbir x için doğru olmuyor; denklemin çözümü yok.`;
      return { metin, baglam: { tur: 'denklem' } };
    }
    const x = bol(eksi(b), a);
    // İnsan için: x'li terimler bir yana, sayılar öbür yana
    const [l0] = yanlar(S(0));
    const la = cikar(yanlar(S(1))[0], l0);
    const ra = cikar(yanlar(S(1))[1], yanlar(S(0))[1]);
    const katsayi = cikar(la, ra);
    const sabit = cikar(yanlar(S(0))[1], l0);
    const adimlar = [
      insan,
      `x'li terimler bir yana, sayılar öbür yana: ${sayiYaz(katsayi)}x = ${sayiYaz(sabit)}`,
      `x = ${sayiYaz(sabit)} ÷ ${sayiYaz(katsayi)} = ${sonucYaz(x)}`,
    ];
    const kod = kodMetni([
      `# ${kaynak.trim()}`,
      `# ${sayiYaz(katsayi).replace(',', '.')}x = ${sayiYaz(sabit).replace(',', '.')}  olduğu için:`,
      `x = ${kodSayi(sabit)} / ${kodSayi(katsayi).includes('/') ? `(${kodSayi(katsayi)})` : kodSayi(katsayi)}`,
      `yazdır("x =", x)`,
      `# Kontrol: iki taraf eşit çıkmalı`,
      `yazdır(${solK}, "=", ${sagK})`,
    ], kullanan);
    return {
      metin: `Adım adım:\n${adimlar.map((s, i) => `${i + 1}) ${s}`).join('\n')}\n\nCevap: x = ${sonucYaz(x)}\n\n${ARKADA}`,
      kod,
      baglam: { tur: 'denklem', sonuc: sonucIfadesi(x), kod },
    };
  }
  if (d3.every(sifirMi)) {
    // f(x) = a x² + b x + c ; f(1), f(2), f(3)
    const a = bol(d2[0], S(2));
    const b = cikar(d1[0], carp(a, S(3)));     // f(2)-f(1) = 3a + b
    const c = cikar(cikar(d0[0], a), b);
    const D = cikar(carp(b, b), carp(S(4), carp(a, c)));
    const k = (x: Sayi) => kodSayi(x).includes('/') ? `(${kodSayi(x)})` : kodSayi(x);
    kullanan.matematik = true;
    const kod = kodMetni([
      `# ${kaynak.trim()}  ->  ax² + bx + c = 0`,
      `a = ${k(a)}`, `b = ${k(b)}`, `c = ${k(c)}`,
      `delta = b ** 2 - 4 * a * c`,
      `yazdır("Delta =", delta)`,
      `eğer delta > 0:`,
      `    x1 = (-b + matematik.karekök(delta)) / (2 * a)`,
      `    x2 = (-b - matematik.karekök(delta)) / (2 * a)`,
      `    yazdır("x1 =", x1, " x2 =", x2)`,
      `değilse_eğer delta == 0:`,
      `    yazdır("Tek kök: x =", -b / (2 * a))`,
      `değilse:`,
      `    yazdır("Gerçek kök yok")`,
    ], kullanan);
    const bas = `${insan}\nBu ikinci dereceden bir denklem: a = ${sayiYaz(a)}, b = ${sayiYaz(b)}, c = ${sayiYaz(c)}\nDelta = b² - 4ac = ${sayiYaz(D)}`;
    let cevap: string, sonuc: string | undefined;
    if (ondalik(D) < 0) cevap = 'Delta negatif, yani gerçek sayılarda çözüm yok.';
    else {
      const kd = karekok(D);
      const x1 = bol(topla(eksi(b), kd), carp(S(2), a));
      const x2 = bol(cikar(eksi(b), kd), carp(S(2), a));
      if (sifirMi(D)) { cevap = `Delta sıfır, tek kök var: x = ${sonucYaz(x1)}`; sonuc = sonucIfadesi(x1); }
      else cevap = `İki kök var: x₁ = ${sonucYaz(x1)}, x₂ = ${sonucYaz(x2)}`;
    }
    return { metin: `${bas}\n\n${cevap}\n\n${ARKADA}`, kod, baglam: { tur: 'denklem', sonuc, kod } };
  }
  return null;
}

/** "bir sayının 3 katının 5 fazlası 20 ise" -> "x*3+5 = 20" */
function sozelDenklem(sade: string): { sol: string; sag: string } | null {
  const m = sade.match(/\b(?:bir|hangi|hangi\s+bir)?\s*sayi(?:nin|yi|ya)?\b(.*?)\s(-?\d+(?:\.\d+)?)'?[a-z]*\s+(?:ise|eder|olur|olursa|ediyor|oluyor|=|dir|dur|tir|tur)\b/);
  if (!m) return null;
  let e = 'x';
  const zincir = m[1].trim();
  if (!zincir) return null;
  const re = /\s*(?:(\d+(?:\.\d+)?)\s*kat[a-z]*|(\d+(?:\.\d+)?)\s*fazla[a-z]*|(\d+(?:\.\d+)?)\s*(?:eksig|eksi|noksan|az)[a-z]*|(yarisi[a-z]*)|(karesi[a-z]*)|(kupu[a-z]*)|(\d+)'?(?:de|da|te|ta)\s+(\d+)'?[a-z]*|(\d+(?:\.\d+)?)\s+ile\s+(toplam|carpim|fark)[a-z]*|(\d+)\/(\d+)'?[a-z]*)/y;
  let i = 0, adet = 0;
  while (i < zincir.length) {
    re.lastIndex = i;
    const t = re.exec(zincir);
    if (!t) return null;
    i = re.lastIndex; adet++;
    if (t[1]) e = `(${e})*${t[1]}`;
    else if (t[2]) e = `(${e})+${t[2]}`;
    else if (t[3]) e = `(${e})-${t[3]}`;
    else if (t[4]) e = `(${e})/2`;
    else if (t[5]) e = `(${e})^2`;
    else if (t[6]) e = `(${e})^3`;
    else if (t[7]) e = `(${e})*${t[8]}/${t[7]}`;
    else if (t[9]) e = t[10] === 'toplam' ? `(${e})+${t[9]}` : t[10] === 'carpim' ? `(${e})*${t[9]}` : `(${e})-${t[9]}`;
    else if (t[11]) e = `(${e})*${t[11]}/${t[12]}`;     // "3/4'ü"
  }
  return adet ? { sol: e.replace(/^\(x\)/, 'x'), sag: m[2] } : null;
}

// =========================================================================== 3) döngüyle çözülenler
function donguCevabi(sade: string): HesapSonucu | null {
  // "1'den 100'e kadar (olan) (cift|tek) sayilarin toplami / carpimi"
  let m = sade.match(/(\d+)'?(?:den|dan|ten|tan)\s+(\d+)'?[a-z]*\s+kadar(?:ki)?\s+(?:olan\s+)?(?:(?:tum|butun)\s+)?(?:(cift|tek)\s+)?(?:tam\s+)?(?:sayi|sayilar)[a-z]*\s+(toplam|carpim)/);
  const ilk = sade.match(/\bilk\s+(\d+)\s+(?:(cift|tek)\s+)?(?:dogal\s+|pozitif\s+|tam\s+)?sayi[a-z]*\s+(toplam|carpim)/);
  if (m || ilk) {
    let bas: number, son: number, tur: string | undefined, islem: string;
    if (m) { bas = +m[1]; son = +m[2]; tur = m[3]; islem = m[4]; }
    else {
      const n = +ilk![1]; tur = ilk![2]; islem = ilk![3];
      bas = tur === 'cift' ? 2 : 1; son = tur === 'cift' ? 2 * n : tur === 'tek' ? 2 * n - 1 : n;
    }
    if (son < bas) [bas, son] = [son, bas];
    if (son - bas > 1e7 || (islem === 'carpim' && son - bas > 2000)) return null;
    const uygun = (i: number) => (tur === 'cift' ? i % 2 === 0 : tur === 'tek' ? i % 2 !== 0 : true);
    let t = islem === 'toplam' ? 0n : 1n;
    for (let i = bas; i <= son; i++) if (uygun(i)) t = islem === 'toplam' ? t + BigInt(i) : t * BigInt(i);
    const deg = islem === 'toplam' ? 'toplam' : 'çarpım';
    const adim = tur ? 2 : 1;
    const ilkSayi = tur && !uygun(bas) ? bas + 1 : bas;
    const kod = [
      `${deg} = ${islem === 'toplam' ? 0 : 1}`,
      `için i içinde aralık(${ilkSayi}, ${son + 1}${adim === 2 ? ', 2' : ''}):`,
      `    ${deg} = ${deg} ${islem === 'toplam' ? '+' : '*'} i`,
      `yazdır(${deg})`,
    ].join('\n');
    const turYazi = tur === 'cift' ? 'çift ' : tur === 'tek' ? 'tek ' : '';
    const formul = islem === 'toplam' && !tur && bas === 1 ? `\n\nKısa yol (Gauss): n·(n+1)/2 = ${son}·${son + 1}/2 = ${t}` : '';
    return {
      metin: `${sayiEki(bas, 'den')} ${sayiEki(son, 'e')} kadar ${turYazi}sayıların ${islem === 'toplam' ? 'toplamı' : 'çarpımı'} = ${t}${formul}\n\nBir döngüyle sayıları tek tek ${islem === 'toplam' ? 'toplayan' : 'çarpan'} şu kodu arkada çalıştırdım:`,
      kod, baglam: { tur: 'dongu', sonuc: t.toString(), kod },
    };
  }
  // "1'den 30'a kadar asal sayılar", "50'ye kadar asal sayılar"
  const al = sade.match(/(?:(\d+)'?(?:den|dan|ten|tan)\s+)?(\d+)'?[a-z]*\s+kadar(?:ki)?\s+(?:olan\s+)?asal/);
  if (al && !/\btoplam/.test(sade)) {
    const bas = Number(al[1] ?? 1), son = Number(al[2]);
    if (son <= 100000 && son >= bas) {
      const l: number[] = [];
      for (let n = Math.max(2, bas); n <= son; n++) { let a = true; for (let i = 2; i * i <= n; i++) if (n % i === 0) { a = false; break; } if (a) l.push(n); }
      const kod = [`asallar = []`, `için sayı içinde aralık(${Math.max(2, bas)}, ${son + 1}):`, `    asal = Doğru`, `    için i içinde aralık(2, tamsayı(sayı ** 0.5) + 1):`,
        `        eğer sayı % i == 0:`, `            asal = Yanlış`, `            kır`, `    eğer asal:`, `        asallar.sona_ekle(sayı)`, `yazdır(asallar)`, `yazdır(uzunluk(asallar), "tane")`].join('\n');
      const goster = l.length > 60 ? `${l.slice(0, 60).join(', ')}, ...` : l.join(', ');
      return { metin: `${sayiEki(bas, 'den')} ${sayiEki(son, 'e')} kadar asal sayılar (${l.length} tane):\n${goster}\n\nHer sayıyı kendinden küçük sayılara bölerek deneyen şu kodu arkada çalıştırdım:`, kod, baglam: { tur: 'dongu', kod } };
    }
  }
  // "97 asal mi"
  m = sade.match(/(\d+)'?[a-z]*\s+(?:sayisi\s+)?asal\s*(?:sayi\s*)?(?:mi|midir|mıdır|mu)\b/) ?? sade.match(/\basal\s+mi\w*\s+(\d+)/);
  if (m) {
    const n = BigInt(m[1]);
    if (n > 10n ** 13n) return null;
    let bolen: bigint | null = null;
    if (n >= 2n) for (let i = 2n; i * i <= n; i++) if (n % i === 0n) { bolen = i; break; }
    const asal = n >= 2n && bolen === null;
    const kod = [
      `sayı = ${n}`,
      `asal = sayı >= 2`,
      `için i içinde aralık(2, tamsayı(sayı ** 0.5) + 1):`,
      `    eğer sayı % i == 0:`,
      `        asal = Yanlış`,
      `        yazdır(sayı, "sayısı", i, "ile tam bölünüyor.")`,
      `        kır`,
      `yazdır("Asal mı?", asal)`,
    ].join('\n');
    const metin = asal
      ? `Evet, ${n} asal bir sayı: 1'den ve kendisinden başka böleni yok. (√${sayiEki(n, 'e')} kadar bütün sayıları denemek yeter.)`
      : n < 2n ? `Hayır, ${n} asal değil: asal sayılar 2'den başlar.` : `Hayır, ${n} asal değil: ${bolen} ile tam bölünüyor (${n} = ${bolen} × ${n / bolen!}).`;
    return { metin: `${metin}\n\nŞu kodu arkada çalıştırdım:`, kod, baglam: { tur: 'dongu', sonuc: asal ? '1' : '0', kod } };
  }
  // "36'nin bolenleri", "60'i asal carpanlarina ayir"
  m = sade.match(/(\d+)'?[a-z]*\s+(?:sayisinin\s+)?(?:pozitif\s+)?(bolen|asal\s+carpan|carpan)[a-z]*/);
  if (m && BigInt(m[1]) <= 10n ** 12n && BigInt(m[1]) > 0n) {
    const n = BigInt(m[1]);
    if (m[2] === 'bolen') {
      const l: bigint[] = [];
      for (let i = 1n; i * i <= n; i++) if (n % i === 0n) { l.push(i); if (i * i !== n) l.push(n / i); }
      l.sort((a, b) => (a < b ? -1 : 1));
      const kod = [`sayı = ${n}`, `bölenler = []`, `için i içinde aralık(1, sayı + 1):`, `    eğer sayı % i == 0:`, `        bölenler.sona_ekle(i)`, `yazdır(bölenler)`, `yazdır(uzunluk(bölenler), "tane böleni var")`].join('\n');
      return { metin: `${sayiEki(n, 'in')} bölenleri: ${l.join(', ')} (${l.length} tane)\n\nŞu kodu arkada çalıştırdım:`, kod, baglam: { tur: 'dongu', kod } };
    }
    const carpanlar: bigint[] = [];
    let k = n;
    for (let i = 2n; i * i <= k; i++) while (k % i === 0n) { carpanlar.push(i); k /= i; }
    if (k > 1n) carpanlar.push(k);
    const gruplu = [...new Set(carpanlar)].map((p) => { const u = carpanlar.filter((x) => x === p).length; return u > 1 ? `${p}^${u}` : `${p}`; });
    const kod = [`sayı = ${n}`, `çarpanlar = []`, `bölen = 2`, `döngü sayı > 1:`, `    eğer sayı % bölen == 0:`, `        çarpanlar.sona_ekle(bölen)`, `        sayı = sayı // bölen`, `    değilse:`, `        bölen = bölen + 1`, `yazdır(çarpanlar)`].join('\n');
    return { metin: `${n} = ${carpanlar.join(' × ') || n}${gruplu.length && carpanlar.length > 1 ? ` = ${gruplu.join(' × ')}` : ''}\nAsal çarpanları: ${[...new Set(carpanlar)].join(', ')}\n\nŞu kodu arkada çalıştırdım:`, kod, baglam: { tur: 'dongu', kod } };
  }
  // "10. fibonacci sayisi", "fibonacci 10"
  m = sade.match(/(\d+)\s*\.?\s*(?:inci|nci|uncu|ncu|ıncı)?\s*fibonacci/) ?? sade.match(/fibonacci[a-z]*\s+(?:dizisinin\s+)?(\d+)/);
  if (m) {
    const n = +m[1];
    if (n < 1 || n > 5000) return null;
    let a = 0n, b = 1n;
    for (let i = 1; i < n; i++) [a, b] = [b, a + b];
    const kod = [`n = ${n}`, `a, b = 0, 1`, `için i içinde aralık(1, n):`, `    a, b = b, a + b`, `yazdır(n, ". Fibonacci sayısı:", b)`].join('\n');
    return { metin: `${n}. Fibonacci sayısı = ${b}\n(Dizi 1, 1, 2, 3, 5, 8, ... diye gider: her sayı önceki iki sayının toplamı.)\n\nŞu kodu arkada çalıştırdım:`, kod, baglam: { tur: 'dongu', sonuc: b.toString(), kod } };
  }
  return null;
}

// =========================================================================== 4) birim çevirme
const BIRIMLER: Record<string, [string, number, string]> = {
  // ad: [tür, temel birime katsayı, gösterim]
  mm: ['uzunluk', 0.001, 'mm'], milimetre: ['uzunluk', 0.001, 'milimetre'], cm: ['uzunluk', 0.01, 'cm'], santimetre: ['uzunluk', 0.01, 'santimetre'], santim: ['uzunluk', 0.01, 'santim'],
  dm: ['uzunluk', 0.1, 'dm'], desimetre: ['uzunluk', 0.1, 'desimetre'], m: ['uzunluk', 1, 'm'], metre: ['uzunluk', 1, 'metre'], km: ['uzunluk', 1000, 'km'], kilometre: ['uzunluk', 1000, 'kilometre'],
  mg: ['kutle', 0.001, 'mg'], miligram: ['kutle', 0.001, 'miligram'], g: ['kutle', 1, 'g'], gr: ['kutle', 1, 'gram'], gram: ['kutle', 1, 'gram'], kg: ['kutle', 1000, 'kg'], kilogram: ['kutle', 1000, 'kilogram'], kilo: ['kutle', 1000, 'kilo'], ton: ['kutle', 1e6, 'ton'],
  saniye: ['zaman', 1, 'saniye'], sn: ['zaman', 1, 'saniye'], dakika: ['zaman', 60, 'dakika'], dk: ['zaman', 60, 'dakika'], saat: ['zaman', 3600, 'saat'], sa: ['zaman', 3600, 'saat'], gun: ['zaman', 86400, 'gün'], hafta: ['zaman', 604800, 'hafta'],
  ml: ['hacim', 0.001, 'ml'], mililitre: ['hacim', 0.001, 'mililitre'], cl: ['hacim', 0.01, 'cl'], l: ['hacim', 1, 'litre'], lt: ['hacim', 1, 'litre'], litre: ['hacim', 1, 'litre'],
};
function birimCevabi(sade: string): HesapSonucu | null {
  const ad = Object.keys(BIRIMLER).sort((a, b) => b.length - a.length).join('|');
  const m = sade.match(sg(String.raw`(\d+(?:\.\d+)?)\s*(${ad})(?:'?[a-z]*)?\s+(?:kac|ne\s+kadar|kac\s+tane)\s+(${ad})(?:[a-z]*)?\b`, ''))
    ?? sade.match(sg(String.raw`(\d+(?:\.\d+)?)\s*(${ad})(?:'?[a-z]*)?\s+(${ad})(?:[a-z]*)?\s*(?:'?(?:y?[ae]|ye|ya)\s+)?(?:cevir|donustur)`, ''));
  if (!m) return null;
  const [, sayi, b1, b2] = m;
  const x = BIRIMLER[b1], y = BIRIMLER[b2];
  if (!x || !y || x[0] !== y[0] || b1 === b2) return null;
  const katsayi = yaziSayi(String(x[1])), bolen = yaziSayi(String(y[1]));
  const v = bol(carp(yaziSayi(sayi), katsayi), bolen);
  const oran = bol(katsayi, bolen);
  const carpanMi = ondalik(oran) >= 1;
  const k = carpanMi ? oran : bol(S(1), oran);
  const kod = `${katla(x[2]).replace(/[^a-z]/g, '') || 'deger'} = ${sayi}\nyazdır(${katla(x[2]).replace(/[^a-z]/g, '') || 'deger'} ${carpanMi ? '*' : '/'} ${kodSayi(k)}, "${y[2]}")`;
  const yaz = sayi.replace('.', ',');
  return {
    metin: `${carpanMi ? `1 ${x[2]} = ${sayiYaz(oran)} ${y[2]}` : `1 ${y[2]} = ${sayiYaz(k)} ${x[2]}`} olduğu için ${yaz} ${x[2]} ${carpanMi ? '×' : '÷'} ${sayiYaz(k)} = ${sonucYaz(v)} ${y[2]}\n\n${ARKADA}`,
    kod, baglam: { tur: 'birim', sonuc: sonucIfadesi(v), kod },
  };
}

// =========================================================================== 5) sözel problemler
// Her cümle küçük bir işleme çevrilir (değişken = değişken + 3 ...). Değerler a·x + b biçiminde tutulur:
// başlangıcı bilinmeyen problemlerde ("başta kaç elması vardı?") x çözülür.
type Lin = { a: Kesir; b: Kesir };
const lin = (b: Sayi): Lin => ({ a: kesir(0n), b: b as Kesir });
const linX = (): Lin => ({ a: kesir(1n), b: kesir(0n) });
const linTopla = (u: Lin, v: Lin): Lin => ({ a: topla(u.a, v.a) as Kesir, b: topla(u.b, v.b) as Kesir });
const linCarp = (u: Lin, k: Sayi): Lin => ({ a: carp(u.a, k) as Kesir, b: carp(u.b, k) as Kesir });
const linEksi = (u: Lin): Lin => linCarp(u, S(-1));
const bilinen = (u: Lin) => sifirMi(u.a);

/** ortuk: değeri bilinmeden 0'dan başlatıldı (sonra "başta N vardı" denirse eklenir). */
type Kisi = { ad: string; degisken: string; deger?: Lin; birim?: string; isimli: boolean; ortuk?: boolean };
type Islem = { op: '+' | '-' | '*' | '/'; n: Kesir; aciklama: string };

const SAHIP_DEGIL = new Set(['bir', 'her', 'bu', 'su', 'o', 'ben', 'sen', 'biz', 'siz', 'onlar', 'toplam', 'toplamda', 'kac', 'peki', 'sonra',
  've', 'ama', 'eger', 'hepsi', 'geriye', 'icinde', 'bunlardan', 'bunun', 'ondan', 'ne', 'hangi', 'kim', 'bugun', 'dun', 'yarin', 'once',
  'sonunda', 'baslangicta', 'basta', 'ilk', 'son', 'bunu', 'onun', 'tanesi', 'birlikte', 'ikisi', 'ikisinin', 'aksam', 'sabah', 'ayrica',
  'daha', 'tane', 'buna', 'gore', 'ya', 'iki', 'uc', 'kalan', 'sinif', 'okul', 'evde', 'markette', 'manav', 'ardindan', 'en', 'cevap', 'soru',
  'kodi', 'lutfen', 'merhaba', 'turkod', 'python', 'saatte', 'gunde', 'dakikada', 'haftada', 'ayda', 'yilda', 'her', 'esit', 'yarisi', 'bir']);
const AKRABA = /^(baba|anne|kardes|abla|abi|agabey|dede|nine|babaanne|anneanne|amca|dayi|teyze|hala|arkadas|ogretmen|ogul|kiz|es|komsu)(si|i|u|su|leri|lari)?(nin|nun|na|ne|ndan|nden|ni|nu|nda|nde)?$/;
const BEN = /^(ben|benim|bende|bana|benden|elimde|cebimde|kumbaramda|cantamda|bizim|biz)$/;
const ONA = /^(o|onun|ona|ondan|onda|onu|kendisi|kendisinin)$/;

const KAZAN = /\b(aldi|alir|alirsa|alsa|alsaydi|alacak|almis|aliyor|satin|buldu|bulur|bulursa|bulsa|kazandi|kazanir|kazanirsa|kazansa|topladi|toplar|toplarsa|toplasa|ekledi|ekler|eklerse|eklenir|eklendi|eklenirse|koydu|koyar|koyarsa|koyulursa|konuldu|kondu|geldi|gelir|gelirse|gelse|katildi|katilirsa|bindi|biner|binerse|getirdi|getirir|getirirse|getirildi|geri\s+geldi|iade|biriktirdi|biriktirir|uretti|dikti|diker|yapti|yapar|yaparsa|hediye|verildi|verilirse|verilir|dogdu|dogurdu|artti|artar|artarsa|arttirdi|cizdi|yazdi|okudu|kosdu|yuruttu|cikti\s+geldi|daha\s+geldi|yumurtladi|tasidi|kazandirdi)\b/;
const KAYBET = /\b(verdi|verir|verirse|verse|verseydi|yedi|yerse|yese|yiyor|yemis|kaybetti|kaybeder|kaybederse|kaybetse|satti|satar|satarsa|satsa|harcadi|harcar|harcarsa|harcasa|kullandi|kullanir|kullanirsa|kirildi|kirdi|kirilirsa|curudu|gitti|gider|giderse|gitse|ayrildi|ayrilirsa|ayrilir|indi|iner|inerse|ucup|uctu|ucarsa|dustu|duserse|icti|icer|icerse|odedi|oder|oderse|bagisladi|bagislarsa|atti|atarsa|eksildi|azaldi|azalir|patladi|soldu|kacti|kacarsa|cikardi|cikarirsa|cikarir|dagitti|bozuldu|tuketti|tuketirse|cikti|ciktilar|kirildi|cekti|ceker|cekerse|harcandi|satildi|satilirsa|yenildi|yenirse|kaybolursa|kayboldu|gonderdi|gonderirse|odunc)\b/;
const SAHIPLIK = /\b(var|vardi|vardir|varmis|bulunuyor|bulunur|bulunmaktadir|sahip|yasinda|yasindadir|oldu|olur|olsun|kaldi|kalir|kalmis|kalmistir|kadar)\b/;

/**
 * Ekli addan kök: "elmasi" -> "elma", "kitabı" -> "kitap". Yalnızca gösterim için.
 * Ünsüzden sonraki tek ünlü ("kalemi") yalnızca iyelik bağlamında atılır; yoksa "kırmızı" -> "kırmız" olurdu.
 */
function adKoku(w: string, iyelik = false): string {
  const sert: Record<string, string> = { b: 'p', c: 'ç', d: 't', g: 'k', ğ: 'k' };
  let k = w.toLocaleLowerCase('tr-TR').replace(/['’].*$/, '');
  const m = k.match(/^(.*[aeıioöuü])(sı|si|su|sü|sını|sini|sunu|sünü|ları|leri|lar|ler|sına|sine)$/u);
  if (m && m[1].length >= 2 && (iyelik || /(ları|leri|lar|ler)$/.test(k))) return m[1];
  const n = k.match(iyelik ? /^(.*[^aeıioöuü])(ı|i|u|ü|ını|ini|unu|ünü|ları|leri|lar|ler|ına|ine)$/u : /^(.*[^aeıioöuü])(ları|leri|lar|ler)$/u);
  if (n && n[1].length >= 3) {
    k = n[1];
    const son = k.slice(-1);
    if (sert[son] && k.length >= 4) k = k.slice(0, -1) + sert[son];
    return k;
  }
  return k;
}
const BIRIM_DEGIL = new Set(['tane', 'adet', 'daha', 'tanesi', 'tanesini', 'kez', 'kere', 'defa', 've', 'ile', 'kisi', 'sonra', 'once', 'yas', 'yasinda',
  'fazla', 'eksik', 'az', 'kat', 'kati', 'de', 'da', 'ise', 'olan', 'olarak', 'esit']);
const PARA = /^(lira|tl|kurus|dolar|euro|avro|₺|\$)/;

type Cumle = { asil: string; sade: string; sayilar: { v: Kesir; yazi: string; birim?: string; ek: string; konum: number }[] };

function cumleAyir(metin: string): { cumleler: Cumle[]; sorular: Cumle[] } {
  const parcalar = metin
    .split(/(?<=[.!?])\s+|\n+/)
    .flatMap((c) => c.split(/,\s+|;\s*|\s+(?=(?:daha\s+sonra|sonra|ardından|ardindan)\s)/i))
    .flatMap((c) => {
      // "ve" ile bağlanan iki ayrı olay: "5 elma aldı ve 2 tanesini yedi"
      const p = c.split(/\s+ve\s+/i);
      if (p.length < 2) return [c];
      const sonuc: string[] = [p[0]];
      for (const x of p.slice(1)) {
        const onceki = katla(sonuc[sonuc.length - 1]);
        if (KAZAN.test(onceki) || KAYBET.test(onceki) || /\b(var|vardi|yasinda)\b/.test(onceki)) sonuc.push(x);
        else sonuc[sonuc.length - 1] += ' ve ' + x;
      }
      return sonuc;
    })
    .map((s) => s.trim()).filter(Boolean);
  const hepsi: Cumle[] = parcalar.map((asil) => {
    const sade = katla(asil);
    const sayilar: Cumle['sayilar'] = [];
    // Kesirdeki sayılar ("3/8'ini") ayrı sayı sayılmaz; kesirBul onları okur
    for (const m of asil.matchAll(/(?<![\d/.])(\d+(?:\.\d+)?)(?![\d/])(?:['’]([\p{L}]+))?(?:\s+([\p{L}]+))?(?:\s+([\p{L}]+))?/gu)) {
      let birim: string | undefined;
      for (const w of [m[3], m[4]]) {
        if (!w) break;
        const k = katla(w);
        if (BIRIM_DEGIL.has(k)) continue;
        if (KAZAN.test(k) || KAYBET.test(k) || SAHIPLIK.test(k)) break;
        birim = w; break;
      }
      // "Ali'nin 5 elması", "benim 3 kalemim": iyelikli ad, kökü alınır
      const iyelikli = /['’]n?[iıuü]n\b/u.test(asil) || /\b(benim|bizim|onun|elimde|elinde)\b/iu.test(asil);
      if (birim) birim = adKoku(birim, iyelikli);
      sayilar.push({ v: yaziSayi(m[1]) as Kesir, yazi: m[1], birim, ek: katla(m[2] ?? ''), konum: m.index ?? 0 });
    }
    return { asil, sade, sayilar };
  });
  const soruMu = (c: Cumle) => /\?|\bkac\b|\bkac[a-z]+\b|\bne\s+kadar\b|\bhesapla|\bbul\b|\bbulunuz\b|\bbulun\b/.test(c.sade + (c.asil.includes('?') ? '?' : ''));
  const sorular = hepsi.filter(soruMu);
  const cumleler = hepsi.filter((c) => !soruMu(c));
  return { cumleler, sorular };
}

/** Cümledeki sahip(ler): isim (Ali, Ali'nin), akraba (babası), ben. */
function sahipler(c: Cumle): { ad: string; rol: 'yalin' | 'tamlayan' | 'yonelme' | 'ayrilma' | 'bulunma' | 'belirtme'; anahtar: string }[] {
  const l: ReturnType<typeof sahipler> = [];
  const sozler = c.asil.split(/\s+/);
  sozler.forEach((w, i) => {
    const t = w.replace(/^[("']+|[.,!?;:)"]+$/g, '');
    if (!t || /^\d/.test(t)) return;
    const [kok, ek = ''] = t.split(/['’]/);
    const kk = katla(kok);
    const ekk = katla(ek);
    let rol: (typeof l)[number]['rol'] = 'yalin';
    if (/^n?[iu]n$/.test(ekk)) rol = 'tamlayan';
    else if (/^(y?[ae]|n[ae])$/.test(ekk)) rol = 'yonelme';
    else if (/^n?[dt][ae]n$/.test(ekk)) rol = 'ayrilma';
    else if (/^n?[dt][ae]$/.test(ekk)) rol = 'bulunma';
    else if (/^(y?[iu]|n[iu])$/.test(ekk)) rol = 'belirtme';
    if (BEN.test(kk)) { l.push({ ad: 'Ben', rol: kk === 'benim' || kk === 'bizim' ? 'tamlayan' : kk === 'bana' ? 'yonelme' : kk === 'benden' ? 'ayrilma' : kk.endsWith('de') ? 'tamlayan' : 'yalin', anahtar: 'ben' }); return; }
    const ak = kk.match(AKRABA);
    if (ak && !ek) {
      const ekler = ak[3] ?? '';
      const r = /^n?[iu]n$/.test(ekler) ? 'tamlayan' : /^n[ae]$/.test(ekler) ? 'yonelme' : /^nd[ae]n$/.test(ekler) ? 'ayrilma' : /^nd[ae]$/.test(ekler) ? 'bulunma' : 'yalin';
      const ad = kok.replace(/(nin|nın|nun|nün|na|ne|ndan|nden|nı|ni|nu|nü|nda|nde)$/u, '');
      l.push({ ad: ad.charAt(0).toLocaleUpperCase('tr-TR') + ad.slice(1), rol: r, anahtar: katla(ad) });
      return;
    }
    const buyuk = /^\p{Lu}/u.test(kok);
    if (!buyuk || SAHIP_DEGIL.has(kk) || kk.length < 2) return;
    if (i === 0 && !ek) {
      // Cümle başındaki büyük harfli sözcük: yer bildiren ("Sepette") ya da fiil değilse isimdir
      if (/(de|da|te|ta)$/.test(kk) || KAZAN.test(kk) || KAYBET.test(kk) || SAHIPLIK.test(kk)) return;
      // "Yarısını yedi", "Kalanları sattı": ekli ad ya da zamir, isim değil
      if (kk.length > 4 && /(ini|unu|sini|sunu|lari|leri|nda|nde|dan|den)$/.test(kk)) return;
      const sonraki = katla(sozler[1] ?? '');
      if (/^(sinif|okul|kutu|sepet|bahce|ev|market|depo|otobus|sira|raf|cuzdan|kumbara)/.test(kk) || sonraki === 'icinde') return;
      // Zaman bildirenler: "Öğlene kadar", "Akşam", "Ertesi gün"
      if (sonraki === 'kadar' || /^(ogle|aksam|sabah|gece|ertesi|hafta|pazar|cumartesi|yaz|kis|bahar|sonbahar)/.test(kk)) return;
    }
    l.push({ ad: kok, rol, anahtar: kk });
  });
  return l;
}

/** Cümledeki kesir: "yarısını", "üçte birini" (3'te 1'ini), "%20'sini", "çeyreğini", "hepsini" */
function kesirBul(sade: string): Kesir | null {
  if (/\byarisi[a-z]*\b|\byari\s*yariya\b/.test(sade)) return kesir(1n, 2n);
  if (/\bceyreg[a-z]*\b/.test(sade)) return kesir(1n, 4n);
  if (/\b(hepsi|tamami|tumu)[a-z]*\b/.test(sade)) return kesir(1n);
  let m = sade.match(/(\d+)'?(?:de|da|te|ta)\s+(\d+)'?[a-z]*/);
  if (m) return kesir(BigInt(m[2]), BigInt(m[1]));
  m = sade.match(/(\d+)\s*\/\s*(\d+)'?[a-z]*/);
  if (m) return kesir(BigInt(m[1]), BigInt(m[2]));
  m = sade.match(/(?:%|yuzde\s*)(\d+(?:\.\d+)?)'?[a-z]*/);
  if (m) return bol(yaziSayi(m[1]), S(100)) as Kesir;
  return null;
}

const ORAN = /\b(saatte|dakikada|saniyede|gunde|haftada|ayda|yilda|her\s+saat|her\s+gun|her\s+dakika|her\s+hafta|her\s+ay|gunluk|saatlik|aylik|haftalik|dakikalik)\b/;
const SURE_BIRIM: Record<string, string> = { saatte: 'saat', 'her saat': 'saat', saatlik: 'saat', dakikada: 'dakika', 'her dakika': 'dakika', dakikalik: 'dakika', saniyede: 'saniye', gunde: 'gun', 'her gun': 'gun', gunluk: 'gun', haftada: 'hafta', 'her hafta': 'hafta', haftalik: 'hafta', ayda: 'ay', 'her ay': 'ay', aylik: 'ay', yilda: 'yil' };
const SURE_SN: Record<string, number> = { saniye: 1, dakika: 60, saat: 3600, gun: 86400, hafta: 604800, ay: 2592000, yil: 31536000 };

/** Hız / oran problemleri: "saatte 80 km giden araba 3 saatte kaç km gider", "günde 5 sayfa ... 120 sayfa kaç günde" */
function oranProblemi(tumu: string, sade: string): HesapSonucu | null {
  const o = sade.match(new RegExp(ORAN.source + String.raw`\s+(?:ortalama\s+)?(\d+(?:\.\d+)?)\s*([a-z]+)?`));
  if (!o) return null;
  const oranBirim = SURE_BIRIM[o[1].replace(/\s+/g, ' ')];
  const oranDeger = yaziSayi(o[2]);
  const nesne = o[3] ?? '';
  const soruKismi = sade.slice(sade.lastIndexOf('kac') >= 0 ? sade.lastIndexOf('kac') : sade.length);
  const zamanSoruluyor = /\bkac\s+(saat|dakika|saniye|gun|hafta|ay|yil)[a-z]*\b|ne\s+kadar\s+(?:surede|zamanda)|kac\s+(?:surede|zamanda)/.exec(sade);
  // Süre: oran sözcüğü dışındaki "3 saat(te)", "2 gün"
  const sureler = [...sade.matchAll(/(\d+(?:\.\d+)?)\s*(saat|dakika|saniye|gun|hafta|ay|yil)[a-z]*/g)].filter((m) => m.index !== o.index! + o[0].indexOf(o[2]));
  const sure = sureler.find((m) => !(o.index! <= m.index! && m.index! < o.index! + o[0].length));
  const toplamlar = [...sade.matchAll(/(\d+(?:\.\d+)?)\s*'?([a-z]+)/g)].filter((m) => !(o.index! <= m.index! && m.index! < o.index! + o[0].length) && !/^(saat|dakika|saniye|gun|hafta|ay|yil)/.test(m[2]));
  const kod: string[] = [];
  const yaz = (x: Sayi) => sayiYaz(x);
  const kokNesne = nesne ? (nesne.match(/^(km|metre|m|sayfa|litre|lt|tl|lira|kilometre|soru|adim|parca|kg|ton)/)?.[1] ?? nesne) : '';
  if (zamanSoruluyor && toplamlar.length) {
    const t = toplamlar[toplamlar.length - 1];
    const toplam = yaziSayi(t[1]);
    const v = bol(toplam, oranDeger);
    let istenen = zamanSoruluyor[1] ?? oranBirim;
    let sonuc = v;
    if (istenen !== oranBirim && SURE_SN[istenen] && SURE_SN[oranBirim]) sonuc = bol(carp(v, S(SURE_SN[oranBirim])), S(SURE_SN[istenen]));
    else istenen = oranBirim;
    kod.push(`oran = ${o[2]}  # ${o[1]} ${o[2]} ${kokNesne}`.trimEnd(), `toplam = ${t[1]}`, `süre = toplam / oran`);
    if (sonuc !== v) kod.push(`süre = süre * ${SURE_SN[oranBirim]} / ${SURE_SN[istenen]}  # ${oranBirim} -> ${istenen}`);
    kod.push(`yazdır(süre, "${istenen}")`);
    return {
      metin: `Adım adım:\n1) ${o[1].replace(/^./, (h) => h.toLocaleUpperCase('tr-TR'))} ${yaz(oranDeger)} ${kokNesne}.\n2) Toplam ${yaz(toplam)} ${t[2]}.\n3) Süre = toplam ÷ oran = ${yaz(toplam)} ÷ ${yaz(oranDeger)} = ${sonucYaz(v)} ${oranBirim}${sonuc !== v ? ` = ${sonucYaz(sonuc)} ${istenen}` : ''}\n\nCevap: ${sonucYaz(sonuc)} ${istenen}\n\n${ARKADA}`,
      kod: kod.join('\n'),
      baglam: { tur: 'problem', sonuc: sonucIfadesi(sonuc), kod: kod.join('\n'), cumleler: [tumu], soru: '' },
    };
  }
  if (sure) {
    let s = yaziSayi(sure[1]);
    const sb = sure[2];
    let donusum = '';
    if (sb !== oranBirim && SURE_SN[sb] && SURE_SN[oranBirim]) {
      const yeni = bol(carp(s, S(SURE_SN[sb])), S(SURE_SN[oranBirim]));
      donusum = ` (${yaz(s)} ${sb} = ${yaz(yeni)} ${oranBirim})`;
      s = yeni;
    }
    const v = carp(oranDeger, s);
    kod.push(`oran = ${o[2]}  # ${o[1]} ${o[2]} ${kokNesne}`.trimEnd(), `süre = ${kodSayi(s)}  # ${oranBirim}`, `toplam = oran * süre`, `yazdır(toplam${kokNesne ? `, "${kokNesne}"` : ''})`);
    void soruKismi;
    return {
      metin: `Adım adım:\n1) ${o[1].replace(/^./, (h) => h.toLocaleUpperCase('tr-TR'))} ${yaz(oranDeger)} ${kokNesne}.\n2) Süre ${yaz(yaziSayi(sure[1]))} ${sb}${donusum}.\n3) Toplam = oran × süre = ${yaz(oranDeger)} × ${yaz(s)} = ${sonucYaz(v)}\n\nCevap: ${sonucYaz(v)} ${kokNesne}\n\n${ARKADA}`.replace(/ \n/g, '\n'),
      kod: kod.join('\n'),
      baglam: { tur: 'problem', sonuc: sonucIfadesi(v), kod: kod.join('\n'), cumleler: [tumu], soru: '' },
    };
  }
  return null;
}

const PY_AYRILMIS = new Set(['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
  'false', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'none', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'true', 'try', 'while', 'with', 'yield', 'print', 'input', 'list', 'dict', 'set', 'str', 'int', 'float', 'len', 'sum', 'max',
  'min', 'type', 'id', 'range', 'round', 'abs', 'open', 'map', 'zip', 'all', 'any', 'math', 'match', 'case']);
/** Doğru orantı: "3 kalem 15 lira ise 1 kalem kaç lira", "5 kg elma 60 lira ise 2 kg kaç lira" */
function orantiProblemi(sade: string): HesapSonucu | null {
  const m = sade.match(/(\d+(?:\.\d+)?)\s+([a-z]+)(?:'?[a-z]*)(?:\s+[a-z]+)?\s+(\d+(?:\.\d+)?)\s*([a-z]+)(?:'?[a-z]*)\s*,?\s*(?:ise|ediyorsa|ediyor|tutuyorsa|tutuyor|tutarsa|olursa|ederse|eder|tutar)?\s*,?\s*(?:[a-z]+\s+){0,2}?(\d+(?:\.\d+)?)\s+([a-z]+)(?:'?[a-z]*)(?:\s+[a-z]+)?\s+(?:kac|ne\s+kadar)\s*([a-z]+)?/);
  if (!m) return null;
  const [, a, b1, b, b2, c, b3, b4] = m;
  if (b1.slice(0, 3) !== b3.slice(0, 3) || b1 === b2) return null;
  if (b4 && b4.slice(0, 3) !== b2.slice(0, 3)) return null;
  const A = yaziSayi(a), B = yaziSayi(b), C = yaziSayi(c);
  const bir = bol(B, A);
  const v = carp(bir, C);
  const kod = [`birine_düşen = ${b} / ${a}  # 1 ${b1} = ? ${b2}`, `sonuç_ = birine_düşen * ${c}`, `yazdır(sonuç_, "${b2}")`].join('\n');
  return {
    metin: `Doğru orantı: ${b1} sayısı artarsa ${b2} de aynı oranda artar.\n1) 1 ${b1} = ${b.replace('.', ',')} ÷ ${a.replace('.', ',')} = ${sonucYaz(bir)} ${b2}\n2) ${c.replace('.', ',')} ${b1} = ${sayiYaz(bir)} × ${c.replace('.', ',')} = ${sonucYaz(v)} ${b2}\n\nCevap: ${sonucYaz(v)} ${b2}\n\n${ARKADA}`,
    kod, baglam: { tur: 'problem', sonuc: sonucIfadesi(v), kod },
  };
}

const degiskenAdi = (ad: string, var_: KelimeVarMi | undefined, kullanilan: Set<string>) => {
  let d = ad.toLocaleLowerCase('tr-TR').replace(/['’]/g, '').replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^(\d)/, '_$1') || 'deger';
  // Python'un ayrılmış sözcükleri ("Elif" -> elif), hazır adları ve TürKod sözlüğündeki kelimeler değişken adı olamaz
  if (var_?.(d) || PY_AYRILMIS.has(d) || ['x', 'i', 'toplam', 'sonuç', 'kalan', 'sayı', 'fark', 'hız'].includes(d)) d += '_';
  while (kullanilan.has(d)) d += '_';
  return d;
};

function sozelProblem(metin: string, var_?: KelimeVarMi): HesapSonucu | null {
  const { cumleler, sorular } = cumleAyir(metin);
  const soru = sorular[sorular.length - 1];
  if (!soru) return null;
  const ss = soru.sade;
  const sayiAdedi = [...cumleler, soru].reduce((t, c) => t + c.sayilar.length, 0);
  if (sayiAdedi < 1) return null;

  const kisiler = new Map<string, Kisi>();
  const kullanilan = new Set<string>();
  const kod: string[] = [];
  const adimlar: string[] = [];
  let son: Kisi | null = null;
  let sonIsimli: Kisi | null = null;
  let bolum: { kalan: Kesir; her: Kesir; kim: Kisi; bolen: Kesir } | null = null;
  let bilinmeyen: { kisi: Kisi; islemler: Islem[]; birim?: string } | null = null;
  let anlasilan = 0;
  let bekleyenAlis: { kisi: Kisi; adet: Kesir; nesne?: string } | null = null;
  const basSoruluyor = /\b(basta|baslangicta|ilk\s*basta|ilkin|once(?:den)?|en\s+basta|aslinda)\b.*\bkac\b|\bkac\b.*\b(vardi|idi|ydi)\b/.test(ss);

  const kisiAl = (anahtar: string, ad: string, isimli: boolean): Kisi => {
    let k = kisiler.get(anahtar);
    if (!k) {
      k = { ad, degisken: degiskenAdi(ad, var_, kullanilan), isimli };
      kullanilan.add(k.degisken);
      kisiler.set(anahtar, k);
    }
    return k;
  };
  const deger = (k: Kisi) => k.deger ? linYaz(k.deger) : '?';
  const linYaz = (u: Lin) => (bilinen(u) ? sayiYaz(u.b) : sifirMi(u.b) ? (sayiYaz(u.a) === '1' ? 'x' : `${sayiYaz(u.a)}x`) : `${sayiYaz(u.a) === '1' ? '' : sayiYaz(u.a)}x ${ondalik(u.b) < 0 ? '-' : '+'} ${sayiYaz(ondalik(u.b) < 0 ? eksi(u.b) : u.b)}`);
  const ata = (k: Kisi, v: Lin, kodSatiri: string, aciklama: string) => {
    k.deger = v; son = k; if (k.isimli) sonIsimli = k;
    kod.push(kodSatiri);
    adimlar.push(aciklama);
    anlasilan++;
  };
  /** Başlangıcı bilinmeyen kişiye işlem: kişi x olur. */
  const hazirla = (k: Kisi, bilinmeyenOlabilir: boolean): boolean => {
    if (k.deger) return true;
    if (bilinmeyenOlabilir && basSoruluyor && !bilinmeyen) {
      k.deger = linX();
      bilinmeyen = { kisi: k, islemler: [] };
      return true;
    }
    if (bilinmeyenOlabilir) { k.deger = lin(S(0)); k.ortuk = true; kod.push(`${k.degisken} = 0`); return true; }
    return false;
  };
  const uygula = (k: Kisi, op: Islem['op'], n: Kesir, aciklama: string, kaynak: string) => {
    const once = k.deger!;
    const yeni = op === '+' ? linTopla(once, lin(n)) : op === '-' ? linTopla(once, lin(eksi(n))) : op === '*' ? linCarp(once, n) : linCarp(once, bol(S(1), n));
    if (bilinmeyen?.kisi === k) bilinmeyen.islemler.push({ op, n, aciklama });
    const sim = { '+': '+', '-': '-', '*': '×', '/': '÷' }[op];
    ata(k, yeni, `${k.degisken} = ${k.degisken} ${op} ${kodSayi(n)}  # ${aciklama}`,
      `${kaynak} → ${linYaz(once)} ${sim} ${sayiYaz(n)} = ${linYaz(yeni)}`);
  };
  const birimAyarla = (k: Kisi, b?: string) => { if (b && !k.birim) k.birim = b; };

  /** Bir cümleyi işler; soru cümlesindeki varsayımlar ("3 tane daha alırsa") de buradan geçer. */
  const isle = (c: Cumle, soruCumlesi: boolean) => {
    const sh = sahipler(c);
    const sade = c.sade;
    const sayilar = c.sayilar.filter((s) => !/^(de|da|te|ta)$/.test(s.ek) || !/\d+'?(?:de|da|te|ta)\s+\d/.test(sade));
    const tamlayan = sh.find((s) => s.rol === 'tamlayan' || s.rol === 'bulunma');
    const yalin = sh.find((s) => s.rol === 'yalin');
    const yonelme = sh.find((s) => s.rol === 'yonelme');
    const ayrilma = sh.find((s) => s.rol === 'ayrilma');
    const sozler = sade.split(/\s+/);
    const onaGonderme = sozler.some((w) => ONA.test(w));
    const asil = (s?: { anahtar: string; ad: string }) => (s ? kisiAl(s.anahtar, s.ad, true) : null);
    const oncekiIsimli = sonIsimli;
    let kim: Kisi | null = asil(tamlayan ?? yalin) ?? (sozler.some((w) => /^el(i|in)de$/.test(w)) ? sonIsimli : null);
    // Adımda ve kod yorumunda soru kısmı gösterilmez: "2 tanesini yerse kaç kalır" -> "2 tanesini yerse"
    const kaynak = c.asil.replace(/[.?!]+$/, '').replace(/,?\s+(?:[Kk]aç|ne kadar)\b.*$/u, '') || c.asil.replace(/[.?!]+$/, '');

    // --- karşılaştırma: "Babası ondan 25 yaş büyük", "Ayşe, Ali'den 3 elma fazla", "Ali'nin 2 katı"
    const kars = sade.match(/(\d+(?:\.\d+)?)\s*(?:[a-z]+\s+)?(?:daha\s+)?(buyuk|fazla|cok|uzun|agir|pahali|yasli|kucuk|az|eksik|kisa|hafif|ucuz|genc|kat|kati)\b/);
    const yarisiKadar = /\byarisi\s+kadar\b/.test(sade);
    if ((kars || yarisiKadar) && (ayrilma || onaGonderme || tamlayan) && sayilar.length >= (yarisiKadar ? 0 : 1)) {
      const ref = ayrilma ? asil(ayrilma) : onaGonderme ? (sonIsimli ?? son) : tamlayan && yalin ? asil(tamlayan) : null;
      const hedef = ayrilma || onaGonderme ? kim ?? asil(yalin) : yalin ? asil(yalin) : null;
      if (ref && hedef && ref !== hedef && ref.deger) {
        const n = kars ? yaziSayi(kars[1]) as Kesir : kesir(1n, 2n);
        const tur = yarisiKadar ? 'kat' : kars![2];
        const arti = /^(buyuk|fazla|cok|uzun|agir|pahali|yasli)$/.test(tur);
        const katMi = tur.startsWith('kat') || yarisiKadar;
        const v = katMi ? linCarp(ref.deger, n) : linTopla(ref.deger, lin(arti ? n : eksi(n)));
        hedef.birim ??= ref.birim;
        ata(hedef, v, `${hedef.degisken} = ${ref.degisken} ${katMi ? '*' : arti ? '+' : '-'} ${kodSayi(n)}  # ${kaynak}`,
          `${kaynak} → ${deger(ref)} ${katMi ? '×' : arti ? '+' : '-'} ${sayiYaz(n)} = ${linYaz(v)}`);
        return;
      }
    }

    // --- "N yıl sonra / önce": yaş problemleri (soruda, ilgili herkese eklenir)
    const zaman = sade.match(/(\d+)\s*(?:yil|sene)\s+(sonra|once)/);
    if (zaman && !kars) {
      const n = yaziSayi(zaman[1]) as Kesir;
      const hedefler = kim ? [kim] : [...kisiler.values()].filter((k) => k.deger);
      for (const k of hedefler) if (k.deger) uygula(k, zaman[2] === 'sonra' ? '+' : '-', n, `${zaman[1]} yıl ${zaman[2]}`, `${k.ad}: ${zaman[1]} yıl ${zaman[2] === 'sonra' ? 'sonra' : 'önce'}`);
      if (hedefler.length) return;
    }

    // --- çarpan: "her kutuda 6 kalem var", "tanesi 15 lira", "her birinde 4", "kutu başına 3"
    const her = sade.match(/\b(?:her\s+(?:bir(?:i|in)?(?:nde|nin|ne|i)?|([a-z]+?)(?:da|de|ta|te|ya|ye|a|e|nda|nde|nin|in|un))|tanesi|tanesinin\s+fiyati|birinin\s+fiyati|biri|kilosu|kilogrami|litresi|metresi|paketi|kutusu|bileti|porsiyonu|([a-z]+)\s+basina|adedi)\s+(?:icinde\s+)?(?:[a-z]+\s+)?(\d+(?:\.\d+)?)/);
    if (her && !/\b(paylas|bol|dagit)/.test(sade.replace(/\bbolum/, ''))) {
      const n = yaziSayi(her[3]) as Kesir;
      const birimS = c.sayilar.find((s) => s.yazi === her[3])?.birim;
      const kap = her[1] || her[2];
      // "her kutuya 6 kalem konursa kaç kutu gerekir" -> bölme (soru kutuyu soruyor)
      if (kap && new RegExp(`\\bkac\\s+${kap.slice(0, 4)}`).test(ss)) {
        // Toplam: bu cümlede başka bir sayı varsa o ("48 kalemi her kutuya 6 ..."), yoksa son değer
        const diger = c.sayilar.find((s) => s.yazi !== her[3]);
        let k = son ?? sonIsimli;
        if (diger) {
          k = kisiAl('#' + katla(diger.birim ? adKoku(diger.birim) : 'toplam'), diger.birim ? adKoku(diger.birim) : 'toplam', false);
          ata(k, lin(diger.v), `${k.degisken} = ${diger.yazi}`, `Toplam ${sayiYaz(diger.v)}${diger.birim ? ' ' + adKoku(diger.birim) : ''}`);
        }
        if (k?.deger && bilinen(k.deger)) {
          const tam = bol(k.deger.b, n) as Kesir;
          const gerek = /gerek|lazim|ihtiyac/.test(ss) ? S(tavanB(tam)) as Kesir : tam;
          const kalanVar = tam.q !== 1n;
          const kd = degiskenAdi(kap, var_, kullanilan); kullanilan.add(kd);
          kod.push(`${kd} = ${k.degisken} / ${kodSayi(n)}`);
          if (gerek !== tam) { kod.push('içe_aktar matematik'); kod.push(`${kd} = matematik.tavana_yuvarla(${kd})  # artanlar için bir ${kap} daha`); }
          adimlar.push(`${kaynak} → ${sayiYaz(k.deger.b)} ÷ ${sayiYaz(n)} = ${sonucYaz(tam)}${gerek !== tam ? `; artanlar için bir ${kap} daha gerekir: ${sayiYaz(gerek)}` : ''}`);
          anlasilan++;
          ozelCevap = { deger: gerek, birim: kap, degisken: kd, ek: kalanVar && gerek === tam ? '' : '' };
          return;
        }
      }
      const k = kim ?? son ?? sonIsimli;
      // Fiyat ve adet aynı cümlede: "Tanesi 6 lira olan defterden 5 tane aldı"
      const fiyatMi = /^(tane|birinin|adedi|kilo|litre|metre|paket|kutu|bilet|porsiyon)/.test(her[0]) || PARA.test(katla(birimS ?? ''));
      const adetS = c.sayilar.find((s) => s.yazi !== her[3] && !PARA.test(katla(s.birim ?? '')));
      if (fiyatMi && adetS && KAZAN.test(sade) && !bekleyenAlis) {
        const alan = kim ?? sonIsimli ?? son;
        const tutar = carp(adetS.v, n) as Kesir;
        if (alan?.deger && alan.birim && PARA.test(katla(alan.birim))) {
          uygula(alan, '-', tutar, `${adetS.yazi} tane × ${her[3]} lira`, `${kaynak} → ${adetS.yazi} × ${her[3]} = ${sayiYaz(tutar)} lira ödedi`);
          return;
        }
        const hedef = alan ?? kisiAl('#tutar', 'tutar', false);
        ata(hedef, lin(tutar), `${hedef.degisken} = ${adetS.yazi} * ${her[3]}  # ${kaynak}`, `${kaynak} → ${adetS.yazi} × ${her[3]} = ${sayiYaz(tutar)}`);
        hedef.birim = birimS ?? 'lira';
        return;
      }
      if (bekleyenAlis && (her[0].startsWith('tane') || PARA.test(katla(birimS ?? '')))) {
        const b = bekleyenAlis; bekleyenAlis = null;
        const tutar = carp(b.adet, n) as Kesir;
        if (b.kisi.deger && b.kisi.birim && PARA.test(katla(b.kisi.birim))) {
          uygula(b.kisi, '-', tutar, `${sayiYaz(b.adet)} tane × ${sayiYaz(n)}`, `${kaynak} → ${sayiYaz(b.adet)} × ${sayiYaz(n)} = ${sayiYaz(tutar)} ödedi`);
        } else {
          b.kisi.deger = lin(b.adet);
          uygula(b.kisi, '*', n, kaynak, kaynak);
          b.kisi.birim = birimS ?? 'lira';
        }
        return;
      }
      if (k && k.deger) {
        uygula(k, '*', n, kaynak, kaynak);
        if (birimS) k.birim = birimS;
        return;
      }
    }

    // --- eşit paylaştırma: "24 şekeri 4 arkadaşına eşit paylaştırdı", "6'şar 6'şar gruplara ayırdı"
    if (/\b(paylas|bol|dagit|ayir)[a-z]*/.test(sade) && !/bolum/.test(sade)) {
      const kisiSayisi = c.sayilar.find((s) => /^(y?[ae]|n[ae]|ine|una|sine|suna)$/.test(s.ek) || /^(kisi|arkadas|cocu|ogrenci|grup|kutu|torba|parca|tabak|sinif|kardes|poset|sepet|esit)/.test(katla(s.birim ?? '')));
      const toplamS = c.sayilar.find((s) => s !== kisiSayisi);
      const gruplu = sade.match(/(\d+)'?(?:er|ar|ser|sar|sar|şer)\b/);
      const k = kim ?? son ?? sonIsimli;
      let toplam: Kesir | null = null, bolen: Kesir | null = null;
      if (toplamS && kisiSayisi) { toplam = toplamS.v; bolen = kisiSayisi.v; }
      else if (kisiSayisi && k?.deger && bilinen(k.deger)) { toplam = k.deger.b; bolen = kisiSayisi.v; }
      else if (gruplu && k?.deger && bilinen(k.deger)) { toplam = k.deger.b; bolen = yaziSayi(gruplu[1]) as Kesir; }
      if (toplam && bolen && !sifirMi(bolen)) {
        const hedef = k ?? kisiAl('_toplam', toplamS?.birim ?? 'toplam', false);
        if (!hedef.deger || !bilinen(hedef.deger) || ondalik(hedef.deger.b) !== ondalik(toplam)) {
          ata(hedef, lin(toplam), `${hedef.degisken} = ${kodSayi(toplam)}`, `${kaynak.split(/\s+/).slice(0, 4).join(' ')}… → toplam ${sayiYaz(toplam)}`);
          if (toplamS?.birim) hedef.birim ??= toplamS.birim;
        }
        const tamBolum = S(tabanB(bol(toplam, bolen) as Kesir)) as Kesir;
        const kalan = cikar(toplam, carp(tamBolum, bolen)) as Kesir;
        bolum = { kalan, her: tamBolum, kim: hedef, bolen };
        kod.push(`her_birine = ${hedef.degisken} // ${kodSayi(bolen)}`, `artan = ${hedef.degisken} % ${kodSayi(bolen)}`);
        adimlar.push(`${kaynak} → ${sayiYaz(toplam)} ÷ ${sayiYaz(bolen)} = ${sayiYaz(tamBolum)}${sifirMi(kalan) ? '' : `, artan ${sayiYaz(kalan)}`}`);
        anlasilan++;
        return;
      }
    }

    // --- kazanma / kaybetme
    const kazan = KAZAN.test(sade), kaybet = KAYBET.test(sade);
    if (kazan || kaybet) {
      const kesirli = kesirBul(sade);
      const sayi = sayilar.find((s) => !(kesirli && /'(de|da|te|ta)$/.test(s.yazi)) && !/^(de|da|te|ta)$/.test(s.ek));
      // Alıcı: "Ayşe'ye", "bana", ya da önceki kişiye gönderme ("Annesi ona 20 lira verdi")
      const alici = yonelme ? asil(yonelme) : sozler.includes('ona') ? oncekiIsimli : null;
      const aktifVerme = /\b(verdi|verir|verirse|verse|verseydi|gonderdi|gonderirse|bagisladi|bagislarsa|odunc\s+verdi)\b/.test(sade);
      const edilgenVerme = /\b(verildi|verilirse|verilir|verilmis)\b/.test(sade);
      // "Ali'ye 5 lira verildi" -> Ali kazanır; "45 kitap ödünç verildi" -> sahibi kaybeder
      const kayip = edilgenVerme ? !alici : kaybet;
      if (edilgenVerme && alici) kim = alici;
      // Veren takip edilmiyorsa (değeri bilinmiyor) yalnızca alan kazanır: "Annesi ona 20 lira verdi"
      if (aktifVerme && alici && alici !== kim && sayi && (!kim || !kim.deger) && alici.deger) {
        alici.birim ??= sayi.birim;
        uygula(alici, '+', sayi.v, `${kim?.ad ?? 'biri'} verdi`, kaynak);
        return;
      }
      kim ??= sonIsimli ?? son;
      if (!kim) {
        // Sahipsiz: "Sepette 10 elma var. 3 elma daha koyuldu" -> nesne grubuna
        const b = sayi?.birim ? adKoku(sayi.birim) : null;
        kim = b ? kisiAl('#' + katla(b), b, false) : son;
      }
      if (!kim) return;
      // Para ile alışveriş: "Ali'nin 50 lirası var. 3 defter aldı" -> fiyat bekle
      if (!kayip && kim.birim && PARA.test(katla(kim.birim)) && sayi && !PARA.test(katla(sayi.birim ?? '')) && /\b(aldi|alir|alirsa|satin)\b/.test(sade)) {
        const fiyat = sade.match(/(?:tanesi|tane\s+basi|her\s+biri|adedi|tanesini)\s+(\d+(?:\.\d+)?)/) ?? sade.match(/(\d+(?:\.\d+)?)\s*(?:lira|tl)[a-z]*\s*(?:lik|lik)?\s/);
        if (fiyat && fiyat[1] !== sayi.yazi) {
          const tutar = carp(sayi.v, yaziSayi(fiyat[1])) as Kesir;
          uygula(kim, '-', tutar, `${sayi.yazi} × ${fiyat[1]}`, `${kaynak} → ${sayi.yazi} × ${fiyat[1]} = ${sayiYaz(tutar)} lira`);
        } else bekleyenAlis = { kisi: kim, adet: sayi.v, nesne: sayi.birim };
        return;
      }
      // Fiyat cümle içindeyse (sahibin parası belirtilmemiş): "tanesi 5 lira olan kalemden 4 tane aldı"
      let miktar: Kesir | null = null;
      if (kesirli && kim.deger && (!sayi || /yari|ceyrek|hepsi|tamami|%|yuzde|\d+'?(de|da|te|ta)\s|\d+\s*\/\s*\d+/.test(sade))) {
        miktar = carp(kesirli, kim.deger.b) as Kesir;
        if (!bilinen(kim.deger)) {
          // bilinmeyenin kesri: x'in yarısı -> çarpma ile
          uygula(kim, '*', cikar(S(1), kesirli) as Kesir, `${kaynak}`, kaynak);
          return;
        }
        const yeni = kayip ? '-' : '+';
        uygula(kim, yeni, miktar, kaynak, `${kaynak} (${sayiYaz(kim.deger.b)} × ${sayiYaz(kesirli)} = ${sayiYaz(miktar)})`);
      } else if (sayi) {
        birimAyarla(kim, sayi.birim);
        miktar = sayi.v;
        if (!kim.deger && !kayip && !(basSoruluyor && !bilinmeyen)) {
          // İlk kez değer alıyor: "Ali 3 defter aldı" -> ali = 3
          ata(kim, lin(miktar), `${kim.degisken} = ${sayi.yazi}  # ${kaynak}`, `${kaynak} → ${kim.ad}: ${sayiYaz(miktar)}`);
        } else {
          if (!hazirla(kim, true)) return;
          uygula(kim, kayip ? '-' : '+', miktar, kaynak, kaynak);
        }
      } else if (/\b(bir\s+miktar|biraz|birkac|bir\s+kac|bazi)\b/.test(sade)) {
        // "Ayşe bir miktar ceviz topladı": başlangıç bilinmiyor (x)
        if (hazirla(kim, true)) { son = kim; if (kim.isimli) sonIsimli = kim; anlasilan++; }
        return;
      } else return;
      // Verme: "Ali, Ayşe'ye 3 elma verdi" -> Ayşe kazanır
      if (kayip && alici && aktifVerme) {
        const alan = alici;
        if (alan !== kim) {
          if (!alan.deger) { if (!hazirla(alan, true)) return; }
          alan.birim ??= kim.birim;
          uygula(alan, '+', miktar!, `${kim.ad} verdi`, `${alan.ad} ${sayiYaz(miktar!)} aldı`);
          // Hikâyenin öznesi veren kalır: "Ali kardeşine 5 verdi. Peki 3 tane daha alırsa?" -> Ali
          son = kim;
          if (kim.isimli) sonIsimli = kim;
        }
      }
      return;
    }

    // --- sahiplik: "Ali'nin 5 elması var", "Ali 10 yaşında", "Sınıfta 12 kız, 15 erkek öğrenci var", "Ali 5,"
    const sahiplikVar = SAHIPLIK.test(sade) || (!soruCumlesi && sayilar.length >= 1);
    if (sahiplikVar && sayilar.length) {
      // "kaldı/oldu N": bilinmeyen başlangıç için denklem
      if (/\b(kaldi|kalir|kalmis|oldu)\b/.test(sade) && (kim ?? son)?.deger && !bilinen((kim ?? son)!.deger!)) {
        const k = (kim ?? son)!;
        const sonDeger = sayilar[0].v;
        // a·x + b = N  ->  x = (N - b) / a
        const x = bol(cikar(sonDeger, k.deger!.b), k.deger!.a) as Kesir;
        ozelCevap = { deger: x, birim: k.birim ?? sayilar[0].birim, ters: { kisi: k, son: sonDeger } };
        adimlar.push(`${kaynak} → ${linYaz(k.deger!)} = ${sayiYaz(sonDeger)}`);
        anlasilan++;
        return;
      }
      if (soruCumlesi) return;
      if (!kim && !tamlayan && !yalin) {
        // Sahipsiz: her sayı kendi nesnesinin grubu ("12 kız, 15 erkek öğrenci")
        for (const s of sayilar) {
          const b = s.birim ? adKoku(s.birim) : 'toplam';
          const k = kisiAl('#' + katla(b), b, false);
          ata(k, lin(s.v), `${k.degisken} = ${s.yazi}`, `${kaynak} → ${b}: ${sayiYaz(s.v)}`);
          k.birim ??= s.birim;
        }
        return;
      }
      kim ??= son;
      if (!kim) return;
      const toplam = sayilar.reduce<Kesir>((t, s) => topla(t, s.v) as Kesir, kesir(0n));
      if (kim.ortuk && kim.deger && /\b(vardi|varmis|idi)\b/.test(sade)) {
        // Sonradan söylenen başlangıç: "Ayşe'ye 2 bilye verdi. Ayşe'nin 3 bilyesi vardı" -> 3 + 2
        kim.ortuk = false;
        uygula(kim, '+', toplam, `başta ${sayilar.map((s) => s.yazi).join(' + ')} vardı`, `${kaynak} (başta)`);
        return;
      }
      kim.ortuk = false;
      ata(kim, lin(toplam),`${kim.degisken} = ${sayilar.map((s) => s.yazi).join(' + ')}`, `${kaynak} → ${kim.ad}: ${sayiYaz(toplam)}`);
      kim.birim = sayilar[0].birim ?? kim.birim;
      if (/yasinda/.test(sade)) kim.birim = 'yaş';
    }
  };

  let ozelCevap: { deger: Kesir; birim?: string; degisken?: string; ek?: string; ters?: { kisi: Kisi; son: Kesir } } | null = null;
  // Güven kapısı: sayı geçen her cümle bir işleme dönüşmeli. Anlaşılmayan bir cümle varsa
  // (iş-havuz, iki bilinmeyen, para üstü ...) yanlış cevap vermektense hiç cevap verilmez.
  let anlasilmayan = 0;
  const denetle = (c: Cumle, soruCumlesi: boolean) => {
    const once = anlasilan, oz = ozelCevap, bek = bekleyenAlis, bol_ = bolum;
    isle(c, soruCumlesi);
    const sayili = c.sayilar.filter((x) => !(soruCumlesi && /^(kac|ne)/.test(x.birim ?? ''))).length > 0;
    if (sayili && anlasilan === once && ozelCevap === oz && bekleyenAlis === bek && bolum === bol_) anlasilmayan++;
  };
  for (const c of cumleler) denetle(c, false);
  // Soru cümlesinin içindeki olay ("3 tane daha alırsa kaç olur", "geriye 5 kaldıysa")
  for (const q of sorular.slice(0, -1)) denetle(q, false);
  denetle(soru, true);
  if (anlasilmayan || bekleyenAlis) return null;
  if (!anlasilan || !kisiler.size && !ozelCevap) return null;

  // ---------------------------------------------------------------- soruyu cevapla
  const soruSahip = sahipler(soru).map((s) => kisiler.get(s.anahtar)).filter((k): k is Kisi => !!k);
  const degerli = [...kisiler.values()].filter((k) => k.deger && bilinen(k.deger));
  let cevap: Kesir | null = null, cevapKod = '', birim: string | undefined, aciklama = '';
  const soruBirim = (() => {
    const m = soru.asil.match(/\b[Kk]aç\s+(?:tane\s+)?([\p{L}]+)(?:\s+([\p{L}]+))?/u) ?? soru.asil.match(/\bne\s+kadar\s+([\p{L}]+)(?:\s+([\p{L}]+))?/u);
    if (!m) return undefined;
    const k = katla(m[1]);
    if (/^(tane|kisi|yas|yasinda|lira|tl|kurus|km|metre|kg|gram|litre|saat|dakika|gun)$/.test(k)) return m[1];
    if (/^(oldu|olur|kaldi|kalir|eder|vardi|var|yapar)/.test(k)) return undefined;
    // "Kaç cevizi kaldı" (iyelik) -> ceviz; "Kaç kırmızı top" -> kırmızı
    return adKoku(m[1], /^(kaldi|kalir|oldu|olur|var|vardi|vardir|kalmistir|toplamis|oldugu)/.test(katla(m[2] ?? '')));
  })();

  if (ozelCevap?.ters) {
    // Bilinmeyen başlangıç: sondan başa ters işlemlerle
    const { kisi, son: sonD } = ozelCevap.ters;
    const islemler = bilinmeyen?.islemler ?? [];
    const kd = kisi.degisken;
    const kodT: string[] = [`# Sondan başa doğru, ters işlemlerle çözüyoruz:`, `${kd} = ${kodSayi(sonD)}  # sonunda`];
    let v: Sayi = sonD;
    const adimT: string[] = [`Sonunda ${sayiYaz(sonD)}.`];
    for (const is of [...islemler].reverse()) {
      const ters = { '+': '-', '-': '+', '*': '/', '/': '*' }[is.op] as Islem['op'];
      const once = v;
      v = ters === '+' ? topla(v, is.n) : ters === '-' ? cikar(v, is.n) : ters === '*' ? carp(v, is.n) : bol(v, is.n);
      kodT.push(`${kd} = ${kd} ${ters} ${kodSayi(is.n)}  # "${is.aciklama}" geri alınır`);
      adimT.push(`"${is.aciklama}" geri alınır: ${sayiYaz(once)} ${{ '+': '+', '-': '-', '*': '×', '/': '÷' }[ters]} ${sayiYaz(is.n)} = ${sayiYaz(v)}`);
    }
    kodT.push(`yazdır("Başta:", ${kd})`);
    const b = soruBirim ?? (kisi.birim ? adKoku(kisi.birim) : '');
    const kodS = kodT.join('\n');
    return {
      metin: `Başlangıcı bilmiyoruz; sondan başa doğru, her işlemi tersine çevirerek gideriz:\n${adimT.map((s, i) => `${i + 1}) ${s}`).join('\n')}\n\nCevap: Başta ${sonucYaz(v)}${b ? ' ' + b : ''}\n\n${ARKADA}`,
      kod: kodS,
      baglam: { tur: 'problem', sonuc: sonucIfadesi(v), kod: kodS, cumleler: cumleler.map((c) => c.asil), soru: soru.asil },
    };
  }

  if (ozelCevap) {
    cevap = ozelCevap.deger; birim = ozelCevap.birim; cevapKod = ozelCevap.degisken ?? '';
  } else if (bolum && /\b(art|kalan|kalir|kaldi|artar|artan)\w*/.test(ss) && !/\bher\s+bir|basina|her\s+biri|kisi\s+basi/.test(ss)) {
    cevap = bolum.kalan; cevapKod = 'artan'; aciklama = 'artan';
  } else if (bolum) {
    cevap = bolum.her; cevapKod = 'her_birine'; aciklama = 'her birine';
    birim = soruBirim;
  } else if (/\b(toplam|hepsi|ikisi|ucu|birlikte|beraber|toplamda|tumu|hep\s+beraber|toplami|toplamlari|topladiklari|toplamlarinin|kac\s+(?:kisi|ogrenci|cocuk|hayvan))\w*/.test(ss) && degerli.length > 1) {
    // "toplam kaç": soruda adı geçen kişiler ya da hepsi
    const hedef = soruSahip.length > 1 ? soruSahip.filter((k) => k.deger && bilinen(k.deger)) : degerli;
    cevap = hedef.reduce<Kesir>((t, k) => topla(t, k.deger!.b) as Kesir, kesir(0n));
    kod.push(`toplam_ = ${hedef.map((k) => k.degisken).join(' + ')}`);
    cevapKod = 'toplam_';
    adimlar.push(`Toplam → ${hedef.map((k) => sayiYaz(k.deger!.b)).join(' + ')} = ${sayiYaz(cevap)}`);
  } else if (/\b(fark|ne\s+kadar\s+(?:fazla|az|eksik|daha)|kac\s+(?:\w+\s+)?(?:fazla|eksik|az)|daha\s+(?:fazla|az|cok))\w*/.test(ss) && degerli.length >= 2) {
    const [a, b] = soruSahip.length >= 2 ? soruSahip : degerli.slice(0, 2);
    if (a?.deger && b?.deger) {
      const f = cikar(a.deger.b, b.deger.b) as Kesir;
      const buyukA = ondalik(f) >= 0;
      cevap = buyukA ? f : eksi(f) as Kesir;
      kod.push(`fark_ = ${buyukA ? a.degisken : b.degisken} - ${buyukA ? b.degisken : a.degisken}`);
      cevapKod = 'fark_';
      adimlar.push(`Fark → ${sayiYaz(buyukA ? a.deger.b : b.deger.b)} - ${sayiYaz(buyukA ? b.deger.b : a.deger.b)} = ${sayiYaz(cevap)}`);
    }
  }
  if (!cevap) {
    const hedef = soruSahip.find((k) => k.deger) ?? (soruSahip.length ? null : son ?? sonIsimli);
    const t = hedef as Kisi | null;
    if (t?.deger && bilinen(t.deger)) { cevap = t.deger.b; cevapKod = t.degisken; birim ??= t.birim ? adKoku(t.birim) : undefined; }
    else if (t?.deger && !bilinen(t.deger)) return null;
  }
  if (!cevap) return null;
  if (!soruBirim && !birim && cevapKod) {
    const k = [...kisiler.values()].find((x) => x.degisken === cevapKod);
    birim = k?.birim ? adKoku(k.birim) : undefined;
  }
  birim = soruBirim ?? birim;
  if (birim && /^(yas|yasinda)$/.test(katla(birim))) birim = 'yaşında';
  if (birim && /^tane$/i.test(birim)) birim = undefined;
  kod.push(`yazdır(${cevapKod || kodSayi(cevap)})`);
  // Gereksiz "x = 0" satırları ve yinelenen içe aktarma temizlenir
  const kodS = [...new Set(kod.filter((s) => s.startsWith('içe_aktar')))].concat(kod.filter((s) => !s.startsWith('içe_aktar'))).join('\n')
    .replace(/^içe_aktar matematik\n(?!\n)/, 'içe_aktar matematik\n\n');
  const cevapMetni = `Adım adım:\n${adimlar.map((s, i) => `${i + 1}) ${s}`).join('\n')}\n\nCevap: ${sonucYaz(cevap)}${birim ? ' ' + birim : ''}${aciklama === 'artan' ? ' artar' : ''}\n\n${ARKADA}`;
  return { metin: cevapMetni, kod: kodS, baglam: { tur: 'problem', sonuc: sonucIfadesi(cevap), kod: kodS, cumleler: cumleler.map((c) => c.asil), soru: soru.asil } };
}
const tavanB = (k: Kesir) => -tabanB({ p: -k.p, q: k.q });

// =========================================================================== 6) kalıp problemler
// Okulda sık çıkan problem türleri: her biri kendi formülüyle, adım adım ve koduyla çözülür.
// Kalıba tam uymayan problem bu çözücülere girmez (yanlış cevap vermektense sözel motora / yönlendirmeye kalır).
const SY = String.raw`(\d+(?:\.\d+)?)`;
const sy = (s: string) => yaziSayi(s);
const cozum = (adimlar: string[], cevap: string, kod: string[], baglam: Partial<HesapBaglami> = {}): HesapSonucu => {
  const k = kod.join('\n');
  return {
    metin: `Adım adım:\n${adimlar.map((s, i) => `${i + 1}) ${s}`).join('\n')}\n\nCevap: ${cevap}\n\n${ARKADA}`,
    kod: k, baglam: { tur: 'problem', kod: k, ...baglam },
  };
};
const y = (x: Sayi) => sayiYaz(x);
const k_ = (x: Sayi) => kodSayi(x).includes('/') ? `(${kodSayi(x)})` : kodSayi(x);

function kalipProblem(sade: string): HesapSonucu | null {
  return isProblemi(sade) ?? toplamFark(sade) ?? katToplam(sade) ?? ayakKafa(sade) ?? ikiBilinmeyen(sade) ?? yasKati(sade)
    ?? kesirButun(sade) ?? hizProblemi(sade) ?? paraUstu(sade) ?? karZarar(sade) ?? geometri(sade) ?? olasilik(sade)
    ?? saatHesabi(sade) ?? tekrarliIslem(sade);
}

/** İş / havuz: "Ali 6 günde, Veli 3 günde yapıyor; birlikte kaç günde" -> 1 / (1/6 + 1/3) */
function isProblemi(s: string): HesapSonucu | null {
  if (!/\b(birlikte|beraber|ikisi|ucu|ayni\s+anda|hep\s+beraber)\b/.test(s) || /\bbosalt/.test(s)) return null;
  const l = [...s.matchAll(new RegExp(String.raw`${SY}\s*(gun|saat|dakika|hafta)(?:'?(?:de|da|te|ta))\b`, 'g'))];
  if (l.length < 2 || l.length > 3 || new Set(l.map((m) => m[2])).size !== 1) return null;
  if (!/\bkac\s+(gun|saat|dakika|hafta)|ne\s+kadar\s+surede/.test(s)) return null;
  const b = l[0][2] === 'gun' ? 'gün' : l[0][2];
  const sureler = l.map((m) => sy(m[1]));
  const hiz = sureler.reduce<Sayi>((t, x) => topla(t, bol(S(1), x)), S(0));
  const sonuc = bol(S(1), hiz);
  return cozum([
    ...sureler.map((x, i) => `${i + 1}. işçi (ya da musluk) işi tek başına ${y(x)} ${b}de bitirir; 1 ${b}de işin 1/${y(x)} kadarını yapar.`),
    `Birlikte 1 ${b}de: ${sureler.map((x) => `1/${y(x)}`).join(' + ')} = ${kesirMi(hiz) ? `${hiz.p}/${hiz.q}` : y(hiz)}`,
    `İş 1 ÷ ${kesirMi(hiz) ? `${hiz.p}/${hiz.q}` : y(hiz)} = ${sonucYaz(sonuc)} ${b}de biter.`,
  ], `${sonucYaz(sonuc)} ${b}`, [
    `sureler = [${sureler.map(kodSayi).join(', ')}]  # her birinin tek başına bitirme süresi`,
    `bir_${katla(b)}de = 0`, `için s içinde sureler:`, `    bir_${katla(b)}de = bir_${katla(b)}de + 1 / s`,
    `yazdır("Birlikte:", 1 / bir_${katla(b)}de, "${b}")`,
  ]);
}

/** Toplam-fark: "iki sayının toplamı 30, farkı 6" ; "arkadaşımla 24 bilye var, bana 4 fazla düşüyor" */
function toplamFark(s: string): HesapSonucu | null {
  let T = s.match(new RegExp(String.raw`toplam[a-z]*\s+${SY}`))?.[1];
  let F = s.match(new RegExp(String.raw`fark[a-z]*\s+${SY}`))?.[1];
  if (!F) F = s.match(new RegExp(String.raw`${SY}\s*(?:[a-z]+\s+)?(?:fazla|eksik|az)\b`))?.[1];
  if (!T && F && /\b(arkadasimla|kardesimle|birlikte|ikimizin|ikisinin|toplamda)\b/.test(s)) {
    const say = [...s.replace(/\b2\s+sayi/, ' ').matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
    if (say.length === 2) T = say.find((x) => x !== F);
  }
  if (!T || !F || /\bkat/.test(s) || [...s.replace(/\b2\s+sayi/, ' ').matchAll(/\d+(?:\.\d+)?/g)].length !== 2) return null;
  const buyuk = bol(topla(sy(T), sy(F)), S(2)), kucuk = bol(cikar(sy(T), sy(F)), S(2));
  const benim = /\b(bana|benim|bende)\b/.test(s) && /fazla/.test(s) ? 'buyuk' : /\b(bana|benim|bende)\b/.test(s) ? 'kucuk' : '';
  const cevap = benim === 'buyuk' ? `${sonucYaz(buyuk)} (diğeri ${y(kucuk)})` : benim === 'kucuk' ? `${sonucYaz(kucuk)} (diğeri ${y(buyuk)})`
    : `büyük sayı ${sonucYaz(buyuk)}, küçük sayı ${sonucYaz(kucuk)}`;
  return cozum([
    `Toplam ${T}, fark ${F}.`,
    `Büyük = (toplam + fark) ÷ 2 = (${T} + ${F}) ÷ 2 = ${y(buyuk)}`,
    `Küçük = (toplam - fark) ÷ 2 = (${T} - ${F}) ÷ 2 = ${y(kucuk)}`,
  ], cevap, [`toplam_ = ${T}`, `fark_ = ${F}`, `buyuk = (toplam_ + fark_) / 2`, `kucuk = (toplam_ - fark_) / 2`, `yazdır("Büyük:", buyuk, "Küçük:", kucuk)`]);
}

/** Kat-toplam / kat-fark: "Ali'nin yaşı Veli'nin yaşının 2 katı, toplamları 36" */
function katToplam(s: string): HesapSonucu | null {
  const k = s.match(new RegExp(String.raw`${SY}\s*kat[a-z]*`));
  const t = s.match(new RegExp(String.raw`toplam[a-z]*\s+${SY}`)), f = s.match(new RegExp(String.raw`fark[a-z]*\s+${SY}`));
  if (!k || !(t || f) || [...s.matchAll(/\d+(?:\.\d+)?/g)].length !== 2) return null;
  const K = sy(k[1]);
  const adlar = [...s.matchAll(/\b([a-z]+)'?(?:nin|nin|in|un|nun)\b/g)].map((m) => m[1]).filter((a) => !/^(sayi|yas|toplam|kat|ikisi|bunlar)/.test(a));
  let kucuk: Sayi, buyuk: Sayi, adim: string;
  if (t) { kucuk = bol(sy(t[1]), topla(K, S(1))); adim = `Küçük olan 1 pay, büyük olan ${y(K)} pay: toplam ${y(topla(K, S(1)))} pay = ${t[1]} → 1 pay = ${y(kucuk)}`; }
  else { if (ondalik(K) <= 1) return null; kucuk = bol(sy(f![1]), cikar(K, S(1))); adim = `Fark ${y(cikar(K, S(1)))} pay = ${f![1]} → 1 pay = ${y(kucuk)}`; }
  buyuk = carp(kucuk, K);
  const sorulan = adlar.length >= 2 ? (s.match(new RegExp(`\\b${adlar[0]}\\b[^.]*\\bkac\\b`)) && s.lastIndexOf(adlar[0]) > s.lastIndexOf(adlar[1]) ? 'buyuk' : s.lastIndexOf(adlar[1]) > s.lastIndexOf(adlar[0]) && /kac/.test(s.slice(s.lastIndexOf(adlar[1]))) ? 'kucuk' : '') : '';
  const ad = (x: string) => x.charAt(0).toLocaleUpperCase('tr-TR') + x.slice(1);
  const cevap = sorulan === 'buyuk' ? `${ad(adlar[0])}: ${sonucYaz(buyuk)} (${ad(adlar[1])}: ${y(kucuk)})`
    : sorulan === 'kucuk' ? `${ad(adlar[1])}: ${sonucYaz(kucuk)} (${ad(adlar[0])}: ${y(buyuk)})`
    : adlar.length >= 2 ? `${ad(adlar[0])}: ${y(buyuk)}, ${ad(adlar[1])}: ${y(kucuk)}` : `büyük ${y(buyuk)}, küçük ${y(kucuk)}`;
  return cozum([adim, `Büyük olan = ${y(kucuk)} × ${y(K)} = ${y(buyuk)}`], cevap,
    [`kat = ${k[1]}`, t ? `toplam_ = ${t[1]}` : `fark_ = ${f![1]}`, t ? `kucuk = toplam_ / (kat + 1)` : `kucuk = fark_ / (kat - 1)`, `buyuk = kucuk * kat`, `yazdır("Küçük:", kucuk, "Büyük:", buyuk)`]);
}

/** Tavuk-koyun: "toplam ayak sayısı 50, kafa sayısı 17" */
function ayakKafa(s: string): HesapSonucu | null {
  const a = s.match(new RegExp(String.raw`ayak[a-z]*(?:\s+sayisi)?\s+${SY}|${SY}\s+ayak`)), h = s.match(new RegExp(String.raw`(?:kafa|bas)[a-z]*(?:\s+sayisi)?\s+${SY}|${SY}\s+(?:kafa|bas)`));
  if (!a || !h) return null;
  const A = sy(a[1] ?? a[2]), H = sy(h[1] ?? h[2]);
  const dort = bol(cikar(A, carp(S(2), H)), S(2)), iki = cikar(H, dort);
  if (ondalik(dort) < 0 || ondalik(iki) < 0 || !tamMi(dort)) return null;
  const dortAd = s.match(/\b(koyun|inek|kedi|kopek|at|keci|tavsan)[a-z]*/)?.[1] ?? 'dört ayaklı', ikiAd = s.match(/\b(tavuk|ordek|kaz|kus|horoz|hindi)[a-z]*/)?.[1] ?? 'iki ayaklı';
  const sorulanDort = new RegExp(`kac\\s+${dortAd.slice(0, 3)}`).test(s);
  return cozum([
    `Hepsi ${ikiAd} olsaydı ${y(H)} × 2 = ${y(carp(S(2), H))} ayak olurdu.`,
    `Fazla ayak: ${y(A)} - ${y(carp(S(2), H))} = ${y(cikar(A, carp(S(2), H)))}; her ${dortAd} 2 ayak fazladır.`,
    `${dortAd}: ${y(cikar(A, carp(S(2), H)))} ÷ 2 = ${y(dort)}, ${ikiAd}: ${y(H)} - ${y(dort)} = ${y(iki)}`,
  ], sorulanDort ? `${y(dort)} ${dortAd} (${y(iki)} ${ikiAd})` : `${y(iki)} ${ikiAd}, ${y(dort)} ${dortAd}`,
  [`kafa = ${kodSayi(H)}`, `ayak = ${kodSayi(A)}`, `dort_ayakli = (ayak - 2 * kafa) // 2`, `iki_ayakli = kafa - dort_ayakli`, `yazdır("${dortAd}:", dort_ayakli, "${ikiAd}:", iki_ayakli)`]);
}

/** İki bilinmeyen: "bir kalem ile bir silgi 8 TL, 2 kalem ile 1 silgi 13 TL" */
function ikiBilinmeyen(s: string): HesapSonucu | null {
  const t = s.replace(/\bbir\b/g, '1');
  const re = new RegExp(String.raw`(\d+)?\s*([a-z]{3,})\s+(?:ile|ve|\+)\s+(\d+)?\s*([a-z]{3,})\s+(?:toplam\s+)?(?:[a-z]+\s+)?${SY}`, 'g');
  const l = [...t.matchAll(re)];
  if (l.length !== 2) return null;
  const kok = (w: string) => w.slice(0, 4);
  const [x1, y1] = [kok(l[0][2]), kok(l[0][4])];
  if (kok(l[1][2]) !== x1 || kok(l[1][4]) !== y1) return null;
  const a = sy(l[0][1] ?? '1'), b = sy(l[0][3] ?? '1'), c = sy(l[0][5]);
  const d = sy(l[1][1] ?? '1'), e = sy(l[1][3] ?? '1'), f = sy(l[1][5]);
  const D = cikar(carp(a, e), carp(b, d));
  if (sifirMi(D)) return null;
  const X = bol(cikar(carp(c, e), carp(b, f)), D), Y = bol(cikar(carp(a, f), carp(c, d)), D);
  const xa = l[0][2], ya = l[0][4];
  const sorulanY = new RegExp(`\\b${kok(ya)}[a-z]*\\s+kac|kac\\s+[a-z]*\\s*${kok(ya)}`).test(t.slice(t.lastIndexOf('.') > 0 ? t.lastIndexOf('.') : 0)) && !new RegExp(`\\b${kok(xa)}[a-z]*\\s+kac`).test(t);
  return cozum([
    `${y(a)} ${xa} + ${y(b)} ${ya} = ${y(c)}`, `${y(d)} ${xa} + ${y(e)} ${ya} = ${y(f)}`,
    `Yok etme yöntemi: ${xa} = (${y(c)}×${y(e)} - ${y(b)}×${y(f)}) ÷ (${y(a)}×${y(e)} - ${y(b)}×${y(d)}) = ${y(X)}`,
    `${ya} = (${y(a)}×${y(f)} - ${y(c)}×${y(d)}) ÷ (${y(a)}×${y(e)} - ${y(b)}×${y(d)}) = ${y(Y)}`,
  ], sorulanY ? `${ya}: ${sonucYaz(Y)} (${xa}: ${y(X)})` : `${xa}: ${sonucYaz(X)} (${ya}: ${y(Y)})`,
  [`# a*${katla(xa)} + b*${katla(ya)} = c  ve  d*${katla(xa)} + e*${katla(ya)} = f`, `a, b, c = ${k_(a)}, ${k_(b)}, ${k_(c)}`, `d, e, f = ${k_(d)}, ${k_(e)}, ${k_(f)}`,
    `payda = a * e - b * d`, `birinci = (c * e - b * f) / payda`, `ikinci = (a * f - c * d) / payda`, `yazdır("${xa}:", birinci, "${ya}:", ikinci)`]);
}

/** Yaş katı: "Annem 35 yaşında ben 9. Kaç yıl sonra annem benim yaşımın 3 katı olur?" */
function yasKati(s: string): HesapSonucu | null {
  const m = s.match(/\bkac\s+yil\s+(sonra|once)\b/);
  const k = s.match(new RegExp(String.raw`${SY}\s*kat[a-z]*`));
  if (!m || !k) return null;
  const yaslar = [...s.matchAll(/(\d+)(?:'?[a-z]*)?(?:\s+(?:yas[a-z]*|,|\.|ve))?/g)].map((x) => x[1]).filter((x) => x !== k[1]);
  if (yaslar.length !== 2) return null;
  const [b, kc] = yaslar.map(sy).sort((p, q) => ondalik(q) - ondalik(p));
  const K = sy(k[1]);
  if (ondalik(K) <= 1) return null;
  // b + t = K (kc + t)  ->  t = (b - K*kc) / (K - 1)
  const t = bol(cikar(b, carp(K, kc)), cikar(K, S(1)));
  const yon = ondalik(t) >= 0 ? 'sonra' : 'önce';
  const ta = ondalik(t) >= 0 ? t : eksi(t);
  return cozum([
    `t yıl sonra: büyük ${y(b)} + t, küçük ${y(kc)} + t olur.`,
    `${y(b)} + t = ${y(K)} × (${y(kc)} + t) → ${y(b)} - ${y(carp(K, kc))} = ${y(cikar(K, S(1)))}t → t = ${y(t)}`,
    `Kontrol: ${y(topla(b, t))} = ${y(K)} × ${y(topla(kc, t))}`,
  ], `${sonucYaz(ta)} yıl ${yon}`, [`buyuk = ${kodSayi(b)}`, `kucuk = ${kodSayi(kc)}`, `kat = ${k[1]}`, `t = 0`, `döngü buyuk + t != kat * (kucuk + t) ve t < 200:`, `    t = t + 1`, `yazdır(t, "yıl sonra")`]);
}

/** Kesir-bütün: "elmaların 1/3'ü çürük, 45 elma, kaç sağlam" ; "öğrencilerin 2/5'i kız, 10 kız, mevcut kaç" */
function kesirButun(s: string): HesapSonucu | null {
  const fm = s.match(/(\d+)\/(\d+)'?[a-z]*\s+([a-z]+)/) ?? s.match(/(?:%|yuzde\s*)(\d+)'?[a-z]*\s+([a-z]+)/);
  if (!fm || /\bsayi(nin|yi)?\b|\bx\b/.test(s) || /\b(yarisi|ceyreg|kalan|geri\s+kalan)/.test(s)) return null;
  const fr = fm.length === 4 ? bol(sy(fm[1]), sy(fm[2])) : bol(sy(fm[1]), S(100));
  const parca = fm.length === 4 ? fm[3] : fm[2];
  const sayilar = [...s.matchAll(/(?<![\d/])(\d+(?:\.\d+)?)(?![\d/])(?:'?[a-z]*)?\s+([a-z]+)/g)].filter((m) => m.index! !== fm.index);
  if (sayilar.length !== 1 || /\byuzde\s+kac|kacta\s+kaci/.test(s)) return null;
  const [, n, ad] = sayilar[0];
  const N = sy(n);
  const kok = (w: string) => w.slice(0, 3);
  // Soru cümlesi: "kaç"tan önceki son noktadan itibaren ("Sınıf mevcudu kaçtır")
  const kacYeri = Math.max(0, s.search(/\bkac/));
  const soru = s.slice(s.lastIndexOf('.', kacYeri) + 1);
  const tumuSoruluyor = /\b(mevcud|tamam|tum|butun|hepsi|toplam|kac\s+(?:kisi|ogrenci)|sinif)/.test(soru);
  const fy = kesirMi(fr) ? `${fr.p}/${fr.q}` : y(fr);
  if (kok(ad) === kok(parca)) {
    // Sayı parçayı veriyor: bütün = parça / kesir
    const butun = bol(N, fr);
    if (!tumuSoruluyor) {
      const diger = cikar(butun, N);
      return cozum([`${fy} kısım = ${n} → bütün = ${n} ÷ ${fy} = ${y(butun)}`, `Geri kalan = ${y(butun)} - ${n} = ${y(diger)}`], sonucYaz(diger), [`parca = ${n}`, `kesir = ${k_(fr)}`, `butun = parca / kesir`, `yazdır(butun - parca)`]);
    }
    return cozum([`${fy} kısım = ${n}`, `Bütün = ${n} ÷ ${fy} = ${y(butun)}`], sonucYaz(butun), [`parca = ${n}`, `kesir = ${k_(fr)}`, `yazdır(parca / kesir)`]);
  }
  // Sayı bütünü veriyor
  const p = carp(N, fr);
  const parcaSoruluyor = new RegExp(`kac\\s+(?:tane(?:si)?\\s+)?${kok(parca)}|${kok(parca)}[a-z]*\\s+kac`).test(s.slice(Math.max(0, s.search(/\bkac/) - 15)));
  if (parcaSoruluyor) return cozum([`Bütün ${n}`, `${fy} kısım = ${n} × ${fy} = ${y(p)}`], sonucYaz(p), [`butun = ${n}`, `yazdır(butun * ${k_(fr)})`]);
  const kalan = cikar(N, p);
  return cozum([`Bütün ${n}`, `${parca}: ${n} × ${fy} = ${y(p)}`, `Geri kalan: ${n} - ${y(p)} = ${y(kalan)}`], sonucYaz(kalan), [`butun = ${n}`, `parca = butun * ${k_(fr)}`, `yazdır(butun - parca)`]);
}

/** Hız = yol ÷ süre: "240 km yolu 4 saatte giden aracın hızı", "15 km yolu 45 dakikada, saatteki hızı" */
function hizProblemi(s: string): HesapSonucu | null {
  // Hız SORULMALI ("hızı kaç", "saatteki hızı"); "saatte 80 km hızla giden" hız VERİR (oran problemi)
  if (!/\bhiz[a-z]*\s+(?:kac|nedir|ne\b|bul|hesapla)|saatteki\s+hiz|kac\s+km\s*\/\s*sa/.test(s) || new RegExp(ORAN.source + String.raw`\s+\d`).test(s)) return null;
  const yol = s.match(new RegExp(String.raw`${SY}\s*(km|metre|m)\b`)), sure = s.match(new RegExp(String.raw`${SY}\s*(saat|dakika|saniye)`));
  if (!yol || !sure) return null;
  let t = sy(sure[1]);
  let tb = sure[2];
  const saatlik = /saat(te|lik|teki)?\s+hiz|km\s*\/\s*sa|saatteki|saatte\s+kac/.test(s) || (yol[2] === 'km' && tb !== 'saniye');
  const adim: string[] = [`Yol ${yol[1]} ${yol[2]}, süre ${sure[1]} ${tb}.`];
  if (saatlik && tb === 'dakika') { t = bol(t, S(60)); adim.push(`${sure[1]} dakika = ${y(t)} saat`); tb = 'saat'; }
  const v = bol(sy(yol[1]), t);
  adim.push(`Hız = yol ÷ süre = ${yol[1]} ÷ ${y(t)} = ${y(v)} ${yol[2]}/${tb === 'saat' ? 'saat' : tb}`);
  return cozum(adim, `${sonucYaz(v)} ${yol[2]}/${tb}`, [`yol = ${yol[1]}`, `sure = ${k_(t)}  # ${tb}`, `hiz = yol / sure`, `yazdır(hiz, "${yol[2]}/${tb}")`],
    { tur: 'hiz', hiz: ondalik(v), sonuc: sonucIfadesi(v) });
}

/** Para üstü: "bir kitap 45 TL. 4 kitap alıp 200 TL verirsem para üstü" */
function paraUstu(s: string): HesapSonucu | null {
  if (!/para\s*ust/.test(s)) return null;
  const ver = s.match(new RegExp(String.raw`${SY}\s*(?:tl|lira)?(?:'?[a-z]*)?\s+(?:ver|odedi|odersem|odeyip|uzat)`));
  const fiyat = s.match(new RegExp(String.raw`(?:\b(?:bir|1|tanesi|tane\s+basi|kilosu|adedi)\s+(?:[a-z]+\s+)?)${SY}\s*(?:tl|lira)`)) ?? s.match(new RegExp(String.raw`${SY}\s*(?:tl|lira)(?:'?lik|lik)`));
  if (!ver || !fiyat) return null;
  const adet = [...s.matchAll(/(?<![\d.])(\d+)(?![\d.])\s+(?:tane\s+)?([a-z]+)/g)].find((m) => m[1] !== ver[1] && m[1] !== fiyat[1] && !/^(tl|lira)/.test(m[2]));
  const n = sy(adet?.[1] ?? '1');
  const tutar = carp(n, sy(fiyat[1]));
  const ust = cikar(sy(ver[1]), tutar);
  if (ondalik(ust) < 0) return { metin: `Toplam ${y(tutar)} lira tutuyor ama ${ver[1]} lira verilmiş; ${y(eksi(ust))} lira eksik kalıyor, para üstü yok.`, baglam: { tur: 'problem' } };
  return cozum([`Tutar = ${y(n)} × ${fiyat[1]} = ${y(tutar)} lira`, `Para üstü = ${ver[1]} - ${y(tutar)} = ${y(ust)} lira`], `${sonucYaz(ust)} lira`,
    [`adet = ${kodSayi(n)}`, `fiyat = ${fiyat[1]}`, `verilen = ${ver[1]}`, `tutar = adet * fiyat`, `yazdır("Para üstü:", verilen - tutar)`]);
}

/** Kâr/zarar: "5 kg şekeri 90 TL'ye alıp kilosunu 24 TL'den satıyor" */
function karZarar(s: string): HesapSonucu | null {
  if (!/\b(kar|kari|kazanc|zarar|kazanir|kazanmis|kar\s+eder)\b/.test(s)) return null;
  const al = s.match(new RegExp(String.raw`${SY}\s*(?:tl|lira)?\s*'?(?:ye|ya|e|a)\s+al`));
  const sat = s.match(new RegExp(String.raw`(?:kilosunu|tanesini|adedini|birini|hepsini|tamamini)\s+${SY}\s*(?:tl|lira)?\s*'?(?:den|dan|ten|tan)?\s+sat`)) ?? s.match(new RegExp(String.raw`${SY}\s*(?:tl|lira)?\s*'?(?:ye|ya|e|a|den|dan)\s+sat`));
  if (!al || !sat) return null;
  const miktar = s.match(new RegExp(String.raw`${SY}\s*(kg|kilo|tane|adet|paket|litre)`));
  const tekTek = /kilosunu|tanesini|adedini|birini/.test(sat[0]);
  const n = tekTek ? sy(miktar?.[1] ?? '1') : S(1);
  const gelir = carp(n, sy(sat[1]));
  const fark = cikar(gelir, sy(al[1]));
  const kar = ondalik(fark) >= 0;
  return cozum([tekTek ? `Satış = ${y(n)} × ${sat[1]} = ${y(gelir)} lira` : `Satış ${y(gelir)} lira`, `Alış ${al[1]} lira`, `${kar ? 'Kâr' : 'Zarar'} = ${y(gelir)} - ${al[1]} = ${y(kar ? fark : eksi(fark))} lira`],
    `${sonucYaz(kar ? fark : eksi(fark))} lira ${kar ? 'kâr' : 'zarar'}`, [`alis = ${al[1]}`, `satis = ${kodSayi(n)} * ${sat[1]}`, `fark = satis - alis`, `eğer fark >= 0:`, `    yazdır("Kâr:", fark)`, `değilse:`, `    yazdır("Zarar:", -fark)`]);
}

/** Alan / çevre: kare, dikdörtgen, üçgen, daire */
function geometri(s: string): HesapSonucu | null {
  const alan = /\balan/.test(s), cevre = /\bcevre/.test(s);
  if (!alan && !cevre) return null;
  const sayilar = [...s.matchAll(/(?<![\d.=])(\d+(?:\.\d+)?)(?![\d.])/g)].map((m) => m[1]);
  const piM = s.match(/pi\s*(?:=|'?yi|sayisini|yerine)?\s*(\d+(?:\.\d+)?)/);
  const birim = s.match(/\b(cm|mm|km|metre|m)\b/)?.[1] ?? '';
  const b2 = birim ? ` ${birim}²` : '', b1 = birim ? ` ${birim}` : '';
  const sonuclar: string[] = [], adim: string[] = [], kod: string[] = [];
  if (/\bkare/.test(s) && sayilar.length >= 1) {
    const a = sy(sayilar[0]);
    kod.push(`kenar = ${sayilar[0]}`);
    if (alan) { adim.push(`Karenin alanı = kenar × kenar = ${y(a)} × ${y(a)} = ${y(carp(a, a))}${b2}`); sonuclar.push(`alan ${y(carp(a, a))}${b2}`); kod.push(`yazdır("Alan:", kenar * kenar)`); }
    if (cevre) { adim.push(`Karenin çevresi = 4 × kenar = 4 × ${y(a)} = ${y(carp(S(4), a))}${b1}`); sonuclar.push(`çevre ${y(carp(S(4), a))}${b1}`); kod.push(`yazdır("Çevre:", 4 * kenar)`); }
  } else if (/\bdikdortgen/.test(s) && sayilar.length >= 2) {
    const [a, b] = [sy(sayilar[0]), sy(sayilar[1])];
    kod.push(`uzun = ${sayilar[0]}`, `kisa = ${sayilar[1]}`);
    if (alan) { adim.push(`Dikdörtgenin alanı = uzun × kısa = ${y(a)} × ${y(b)} = ${y(carp(a, b))}${b2}`); sonuclar.push(`alan ${y(carp(a, b))}${b2}`); kod.push(`yazdır("Alan:", uzun * kisa)`); }
    if (cevre) { const c = carp(S(2), topla(a, b)); adim.push(`Dikdörtgenin çevresi = 2 × (uzun + kısa) = 2 × (${y(a)} + ${y(b)}) = ${y(c)}${b1}`); sonuclar.push(`çevre ${y(c)}${b1}`); kod.push(`yazdır("Çevre:", 2 * (uzun + kisa))`); }
  } else if (/\bucgen/.test(s)) {
    const tb = s.match(new RegExp(String.raw`taban[a-z]*\s+(?:uzunlugu\s+)?${SY}`))?.[1], yk = s.match(new RegExp(String.raw`yukseklig?[a-z]*\s+${SY}`))?.[1];
    if (alan && tb && yk) { const A = bol(carp(sy(tb), sy(yk)), S(2)); adim.push(`Üçgenin alanı = taban × yükseklik ÷ 2 = ${tb} × ${yk} ÷ 2 = ${y(A)}${b2}`); sonuclar.push(`alan ${y(A)}${b2}`); kod.push(`taban = ${tb}`, `yukseklik = ${yk}`, `yazdır("Alan:", taban * yukseklik / 2)`); }
    if (cevre && sayilar.length === 3 && !tb) { const C = sayilar.map(sy).reduce(topla); adim.push(`Üçgenin çevresi = ${sayilar.join(' + ')} = ${y(C)}${b1}`); sonuclar.push(`çevre ${y(C)}${b1}`); kod.push(`kenarlar = [${sayilar.join(', ')}]`, `yazdır("Çevre:", toplam(kenarlar))`); }
  } else if (/\b(daire|cember)/.test(s)) {
    const r0 = s.match(new RegExp(String.raw`yaricap[a-z]*\s+${SY}|${SY}\s*(?:cm|mm|m|metre)?\s*(?:olan\s+)?yaricap`)), cap = s.match(new RegExp(String.raw`\bcap[a-z]*\s+${SY}`));
    const r = r0 ? sy(r0[1] ?? r0[2]) : cap ? bol(sy(cap[1]), S(2)) : null;
    if (!r) return null;
    const pi: Sayi = piM ? sy(piM[1]) : Math.PI;
    const piYazi = piM ? piM[1] : 'π';
    kod.push(`r = ${k_(r)}`, piM ? `pi = ${piM[1]}` : `pi = matematik.pi_sayısı`);
    if (!piM) kod.unshift('içe_aktar matematik', '');
    if (alan) { const A = carp(pi, carp(r, r)); adim.push(`Dairenin alanı = π × r² = ${piYazi} × ${y(r)}² = ${sonucYaz(A)}${b2}`); sonuclar.push(`alan ${sonucYaz(A)}${b2}`); kod.push(`yazdır("Alan:", pi * r ** 2)`); }
    if (cevre) { const C = carp(S(2), carp(pi, r)); adim.push(`Dairenin çevresi = 2 × π × r = 2 × ${piYazi} × ${y(r)} = ${sonucYaz(C)}${b1}`); sonuclar.push(`çevre ${sonucYaz(C)}${b1}`); kod.push(`yazdır("Çevre:", 2 * pi * r)`); }
  }
  if (!sonuclar.length) return null;
  return cozum(adim, sonuclar.join(', '), kod, { tur: 'sekil' });
}

/** Olasılık: zar, yazı-tura, torbadan top */
function olasilik(s: string): HesapSonucu | null {
  if (!/\b(olasilig|olasilik|ihtimal|sans)/.test(s)) return null;
  const sonuc = (p: Sayi, adim: string[], kod: string[]) => cozum(adim, `${kesirMi(p) && p.q !== 1n ? `${p.p}/${p.q} (yüzde ${y(carp(p, S(100)))})` : y(p)}`, kod);
  if (/\bzar/.test(s)) {
    const n = s.match(/\b([1-6])'?[a-z]*\s+gel/);
    const tur = /\bcift/.test(s) ? 'çift' : /\btek\b/.test(s) ? 'tek' : /\basal/.test(s) ? 'asal' : null;
    const uygun = n ? [Number(n[1])] : tur === 'çift' ? [2, 4, 6] : tur === 'tek' ? [1, 3, 5] : tur === 'asal' ? [2, 3, 5] : null;
    if (!uygun) return null;
    const p = kesir(BigInt(uygun.length), 6n);
    return sonuc(p, [`Zarın 6 yüzü var: 1, 2, 3, 4, 5, 6.`, `İstenen: ${uygun.join(', ')} (${uygun.length} durum)`, `Olasılık = istenen ÷ tüm durumlar = ${uygun.length}/6`],
      [`içe_aktar rastgele`, ``, `# 60000 kez zar atıp deniyoruz`, `tutan = 0`, `için i içinde aralık(60000):`, `    eğer rastgele.rastgele_tamsayı(1, 6) içinde [${uygun.join(', ')}]:`, `        tutan = tutan + 1`, `yazdır("Denemede:", tutan / 60000, " Hesapta:", ${uygun.length} / 6)`]);
  }
  if (/\b(para|yazi|tura)\b/.test(s) && !/\btop\b/.test(s)) {
    return sonuc(kesir(1n, 2n), [`Paranın iki yüzü var: yazı ve tura.`, `Olasılık = 1/2`], [`içe_aktar rastgele`, ``, `yazdır(rastgele.rastgele_seç(["yazı", "tura"]))`]);
  }
  const renkler = [...s.matchAll(/(\d+)\s+(kirmizi|mavi|yesil|sari|beyaz|siyah|mor|turuncu|pembe|kahverengi|gri|lacivert)/g)];
  if (renkler.length >= 2) {
    const toplamN = renkler.reduce((t, m) => t + Number(m[1]), 0);
    const istenen = renkler.find((m) => new RegExp(`${m[2]}[a-z]*\\s+(?:olma|gelme|cikma|cekme)`).test(s)) ?? renkler.find((m) => s.lastIndexOf(m[2]) > s.search(/olasilik|ihtimal/) - 40 && s.lastIndexOf(m[2]) !== s.indexOf(m[2]));
    if (!istenen) return null;
    const p = kesir(BigInt(istenen[1]), BigInt(toplamN));
    return sonuc(p, [`Toplam ${toplamN} top var.`, `${istenen[2]}: ${istenen[1]} top`, `Olasılık = ${istenen[1]}/${toplamN}${p.q !== BigInt(toplamN) ? ` = ${p.p}/${p.q}` : ''}`],
      [`toplar = {${renkler.map((m) => `"${m[2]}": ${m[1]}`).join(', ')}}`, `toplam_ = toplam(toplar.değerler())`, `yazdır(toplar["${istenen[2]}"] / toplam_)`]);
  }
  return null;
}

/** Saat: "14:20 ile 17:05 arası kaç dakika", "3:45'ten 2 saat 30 dakika sonra saat kaç" */
function saatHesabi(s: string): HesapSonucu | null {
  const saatler = [...s.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)];
  if (!saatler.length) return null;
  const dk = (m: RegExpMatchArray) => Number(m[1]) * 60 + Number(m[2]);
  const yaz = (x: number) => { const t = ((x % 1440) + 1440) % 1440; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  if (saatler.length === 2 && /\b(arasi|arasinda|gecen|kadar|sur)/.test(s)) {
    let fark = dk(saatler[1]) - dk(saatler[0]);
    if (fark < 0) fark += 1440;
    const sa = Math.floor(fark / 60), d = fark % 60;
    return cozum([`${yaz(dk(saatler[0]))} = ${dk(saatler[0])} dakika, ${yaz(dk(saatler[1]))} = ${dk(saatler[1])} dakika (gece yarısından beri)`, `Fark = ${fark} dakika = ${sa} saat ${d} dakika`],
      `${fark} dakika (${sa} saat ${d} dakika)`, [`bas = ${saatler[0][1].replace(/^0/, '')} * 60 + ${saatler[0][2].replace(/^0(?=\d)/, '')}`, `son = ${saatler[1][1].replace(/^0/, '')} * 60 + ${saatler[1][2].replace(/^0(?=\d)/, '')}`, `fark = son - bas`, `yazdır(fark, "dakika =", fark // 60, "saat", fark % 60, "dakika")`]);
  }
  const ek = s.match(/(?:(\d+)\s*saat)?\s*(?:(\d+)\s*dakika)?\s*(sonra|once)/);
  if (saatler.length === 1 && ek && (ek[1] || ek[2])) {
    const ekle = (Number(ek[1] ?? 0) * 60 + Number(ek[2] ?? 0)) * (ek[3] === 'sonra' ? 1 : -1);
    const sonuc = dk(saatler[0]) + ekle;
    return cozum([`${yaz(dk(saatler[0]))} = ${dk(saatler[0])} dakika`, `${ek[3] === 'sonra' ? '+' : '-'} ${Math.abs(ekle)} dakika = ${sonuc} dakika`, `${sonuc} dakika = ${yaz(sonuc)}`],
      yaz(sonuc), [`saat = ${saatler[0][1].replace(/^0/, '')} * 60 + ${saatler[0][2].replace(/^0(?=\d)/, '')}`, `saat = saat ${ek[3] === 'sonra' ? '+' : '-'} ${Math.abs(ekle)}`, `yazdır(saat // 60 % 24, ":", saat % 60, ayırıcı="")`]);
  }
  return null;
}

/** "100'den 7'yi 13 kez çıkarırsam" -> 100 - 7 × 13 */
function tekrarliIslem(s: string): HesapSonucu | null {
  const m = s.match(new RegExp(String.raw`${SY}'?(?:den|dan|ten|tan|e|a|ye|ya)\s+${SY}'?[a-z]*\s+${SY}\s*(?:kez|kere|defa)\s+(cikar|ekle|topla)`));
  if (!m) return null;
  const [a, b, n] = [sy(m[1]), sy(m[2]), sy(m[3])];
  const arti = m[4] !== 'cikar';
  const v = arti ? topla(a, carp(b, n)) : cikar(a, carp(b, n));
  return cozum([`${m[2]}'yi ${m[3]} kez ${arti ? 'eklemek' : 'çıkarmak'} = ${m[2]} × ${m[3]} = ${y(carp(b, n))} ${arti ? 'eklemek' : 'çıkarmak'}`, `${m[1]} ${arti ? '+' : '-'} ${y(carp(b, n))} = ${y(v)}`],
    sonucYaz(v), [`sayi_ = ${m[1]}`, `için i içinde aralık(${m[3]}):`, `    sayi_ = sayi_ ${arti ? '+' : '-'} ${m[2]}`, `yazdır(sayi_)`]);
}

// =========================================================================== giriş noktası
/** Programlama sorusu olduğunu gösteren sözcükler (bunlar varsa sözel problem sanılmaz). */
const KOD_SOZU = /\b(dongu|liste|fonksiyon|degisken|yazdir|program|kod|kodu|kodla|turkod|python|hata|modul|metot|sozluk|indeks|aralik|for|while|print|range|girdi|exe|surum|kurulum|dosya|import|def|ekran|klavye|terminal|demo|tema|ayar)\b/;

/** Sorudan sonucu gösteren takip: "bunun kodu", "kodunu göster" */
const KOD_ISTEGI = /\b(kod(?:u|unu|la|lari|larini|unu\s+goster|u\s+ne|la\s+nasil)|program(?:i|ini|la))\b/;

/**
 * Soru bir hesap sorusuysa çözer (değilse null). onceki: sohbetteki son hesap (takip soruları için).
 */
export function hesapCevabi(soru: string, onceki?: HesapBaglami | null, var_?: KelimeVarMi): HesapSonucu | null {
  if (!/\d|\b(bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yirmi|otuz|kirk|elli|altmis|yetmis|seksen|doksan|yuz|bin)\b|karekok|faktoriyel|karesi|yarisi|kati/.test(katla(soru)) && !onceki) return null;
  const hazir = onHazirla(soru);
  const sade = katla(hazir).replace(/\s+/g, ' ').trim();

  // ---- takip soruları
  if (onceki) {
    const t = takipHesabi(soru, sade, onceki, var_);
    if (t) return t;
  }
  if (!/\d/.test(sade)) return null;
  const kodSorusu = KOD_SOZU.test(sade);

  // 1) birim çevirme
  const b = birimCevabi(sade);
  if (b) return { ...b, baglam: { ...b.baglam, kaynak: sade } };
  // 1b) kalıp problemler (iş, toplam-fark, alan, olasılık, saat...)
  if (!kodSorusu) {
    const k = kalipProblem(sade);
    if (k) return { ...k, baglam: { ...k.baglam, kaynak: sade } };
  }
  // 2) döngüyle çözülenler (asal, bölenler, toplamlar, fibonacci)
  if (!kodSorusu || /\b(asal|fibonacci|bolen|toplami)\b/.test(sade)) {
    const d = donguCevabi(sade);
    if (d && !/\b(nasil|yazilir|yazarim|ornek)\b/.test(sade)) return { ...d, baglam: { ...d.baglam, kaynak: sade } };
  }
  // 3) denklem
  const den = denklemBul(hazir, sade);
  if (den) return den;
  // 4) işlem
  const ifade = ifadeDizgesi(sade);
  if (ifade) {
    const r = islemCevabi(ifade);
    if (r) return { ...r, baglam: { ...r.baglam, kaynak: sade } };
  }
  // 5) sözel problem
  if (!kodSorusu) {
    const o = oranProblemi(hazir, sade);
    if (o) return o;
    const or = orantiProblemi(sade);
    if (or) return or;
    const p = sozelProblem(hazir, var_);
    if (p) return p;
  }
  return null;
}

function denklemBul(hazir: string, sade: string): HesapSonucu | null {
  const s = sade.replace(/(\d|\)|x)'[a-z]+/g, '$1').replace(/\s+x'?[a-z]*\s+(?:kac|nedir|degeri|bul|hesapla|olur)[a-z]*\b.*$/, '');
  // "3x + 5 = 20", "x^2 - 5x + 6 = 0", "2(x-1) = x + 4"; "ise x kaç" kısmı atılır
  const m = s.match(/([0-9x+\-*/^().,\s]*x[0-9x+\-*/^().,\s]*|[0-9+\-*/^().,\s]+)=\s*([0-9x+\-*/^().,\s]+)/);
  // Denklem dışında kalan sözcükler yalnızca "ise x kaç", "denklemini çöz" gibi olmalı ("eğer x = 5 yazınca hata" denklem değil)
  const disari = m ? s.replace(m[0], ' ').split(/[\s?.!,]+/).filter(Boolean) : [];
  const DENKLEM_SOZU = /^(ise|olsaydi|olsa|olursa|x|x'?[a-z]*|kac|kactir|nedir|coz|cozer|cozun|cozermisin|misin|denklem[a-z]*|bul|bulun|bulur|degeri|degerini|peki|hesapla|olur|olmali|esitliginde|esitlik[a-z]*|icin|lutfen|kodi|bana|bu|su|asagidaki|sence|hangi|sayi|sayidir|ne)$/;
  if (m && /x/.test(m[1] + m[2]) && disari.every((w) => DENKLEM_SOZU.test(w))) {
    const sol = sozcukleriSembolle(m[1].trim()), sag = sozcukleriSembolle(m[2].trim().replace(/[.,]+$/, ''));
    const r = denklemCoz(sol, sag, `${m[1].trim()} = ${m[2].trim()}`);
    if (r) return r;
  }
  const sz = sozelDenklem(sade);
  if (sz) {
    const r = denklemCoz(sz.sol, sz.sag, hazir.replace(/\?.*$/, '').trim());
    if (r) return r;
  }
  return null;
}

/**
 * Önceki sorunun kalıbıyla takip: "peki 256 nın" (karekök 225'ten sonra), "12 km" (5 km kaç metre'den sonra),
 * "ya 50 si" (%25'ten sonra), "EKOK'u da bul", "alanı kaç", "sonucu ondalık yaz", hızdan sonra "6 saatte kaç km".
 */
function sablonTakibi(sade: string, sozler: string[], onceki: HesapBaglami, var_?: KelimeVarMi): HesapSonucu | null {
  const ek = (r: HesapSonucu | null, giris: string) => (r ? { ...r, metin: `${giris}\n${r.metin}` } : null);
  // Ondalık gösterim
  if (/\bondalik|virgullu/.test(sade) && onceki.sonuc && !/\d/.test(sade)) {
    const d = ayristir(onceki.sonuc);
    if (d) {
      const v = hesapla(d);
      const k = `yazdır(${kodYaz(d, {})})`;
      return { metin: `Az önceki sonuç ondalık olarak: ${sayiYaz(v)}${kesirMi(v) && !tamAcilir(v) ? ' (yaklaşık; virgülden sonrası sonsuza kadar sürer)' : ''}\n\n${ARKADA}`, kod: k, baglam: { ...onceki, kod: k } };
    }
  }
  // Hız bulunduktan sonra yol: "peki 6 saatte giderse kaç km"
  if (onceki.tur === 'hiz' && onceki.hiz) {
    const t = sade.match(/(\d+(?:\.\d+)?)\s*(saat|dakika)/);
    if (t && /\bkac\s+(km|metre)|ne\s+kadar\s+yol|yol\s+al/.test(sade)) {
      const saat = t[2] === 'dakika' ? bol(yaziSayi(t[1]), S(60)) : yaziSayi(t[1]);
      const hiz = yaziSayi(String(temiz(onceki.hiz)));
      const yol = carp(hiz, saat);
      const k = [`hiz = ${kodSayi(hiz)}  # km/saat`, `sure = ${k_(saat)}  # saat`, `yazdır(hiz * sure, "km")`].join('\n');
      return { metin: `Aynı hızla (${sayiYaz(hiz)} km/saat) devam ediyorum:\nYol = hız × süre = ${sayiYaz(hiz)} × ${sayiYaz(saat)} = ${sonucYaz(yol)} km\n\nCevap: ${sonucYaz(yol)} km\n\n${ARKADA}`, kod: k, baglam: { tur: 'problem', sonuc: sonucIfadesi(yol), kod: k } };
    }
  }
  const kaynak = onceki.kaynak;
  if (!kaynak) return null;
  // Şekil: "alanı kaç", "peki çevresi"
  if (/^(?:peki\s+|ya\s+|bir\s+de\s+)?(alan|cevre)[a-z]*/.test(sade) && /\b(alan|cevre)/.test(kaynak)) {
    const istenen = /^(?:peki\s+|ya\s+|bir\s+de\s+)?alan/.test(sade) ? 'alani' : 'cevresi';
    return ek(kalipProblem(kaynak.replace(/\b(alan|cevre)[a-z]*(\s+ve\s+(alan|cevre)[a-z]*)?/, istenen)), 'Aynı şekil için:');
  }
  // EBOB <-> EKOK
  const fn = sade.match(/\b(ebob|ekok|obeb|okek)/);
  if (fn && !/\d/.test(sade) && /\b(ebob|ekok|obeb|okek)/.test(kaynak)) {
    const yeni = fn[1] === 'obeb' ? 'ebob' : fn[1] === 'okek' ? 'ekok' : fn[1];
    return ek(hesapCevabi(kaynak.replace(/\b(ebob|ekok|obeb|okek)/, yeni), null, var_), 'Aynı sayılar için:');
  }
  // Tek bir yeni sayı: önceki sorunun aynısını bu sayıyla çöz
  const yeniler = [...sade.matchAll(/(\d+(?:\.\d+)?)('?[a-z]+)?/g)];
  if (yeniler.length !== 1 || sozler.length > 6) return null;
  // "peki 2 ile çarparsam" bir işlem takibidir (sonuca uygulanır), sayı değiştirme değil
  if (/\b(carp|bol|ekle|cikar|topla|kat|fazla|eksig|kare|kup|karekok|yari|kuvvet|faktoriyel|mutlak|yuvarla|art|azalt)/.test(sade) || /[+*/^=-]/.test(sade)) return null;
  const [, sayi, ekYazi = ''] = yeniler[0];
  const eskiler = [...kaynak.matchAll(/(?<![\d.\/])\d+(?:\.\d+)?(?![\d\/])/g)];
  if (!eskiler.length) return null;
  let hedef = eskiler[0];
  const yuzdeli = [...kaynak.matchAll(/(?:%|yuzde\s*)(\d+(?:\.\d+)?)/g)];
  const birim = sade.match(/\b(km|metre|m|cm|kg|gram|g|litre|ml|saat|dakika|saniye|gun|hafta)\b/)?.[1];
  if (yuzdeli.length && (/(%|yuzde)/.test(sade) || /^'?(i|si|u|su)$/.test(ekYazi))) {
    const sira = (yuzdeli[0].index ?? 0) + yuzdeli[0][0].length - yuzdeli[0][1].length;
    hedef = eskiler.find((m) => m.index === sira) ?? hedef;
  } else if (birim) {
    hedef = eskiler.find((m) => new RegExp(`^\\s*${birim}\\b`).test(kaynak.slice((m.index ?? 0) + m[0].length))) ?? hedef;
  }
  const yeniKaynak = kaynak.slice(0, hedef.index) + sayi + kaynak.slice((hedef.index ?? 0) + hedef[0].length);
  if (yeniKaynak === kaynak) return null;
  return ek(hesapCevabi(yeniKaynak, null, var_), `Aynı hesabı ${sayi.replace('.', ',')} için yapıyorum:`);
}

/** "peki 2 ile çarparsam", "bunun karekökü", "+5", "peki 2 tanesini yerse?", "kodunu göster" */
function takipHesabi(soru: string, sade: string, onceki: HesapBaglami, var_?: KelimeVarMi): HesapSonucu | null {
  const sozler = sade.split(' ').filter(Boolean);
  const gonderme = /\b(bunu|bunun|buna|bundan|onu|onun|ona|ondan|sonucu|sonucun|sonuca|sonuctan|cevabi|cevabin|bu\s+sayi[a-z]*|o\s+sayi[a-z]*|cikan\s+sayi[a-z]*)\b/.test(sade);
  const takipBasi = /^(peki|ya|o\s+zaman|simdi|bir\s+de|ayrica|ee+|tamam)\b/.test(sade);
  // "kodunu göster", "bunun kodu", "peki programla nasıl yazarım" (ama "kodu nasıl çalıştırırım" değil)
  const kodIste = /\b(goster|yaz|ver|gorebilir|gormek|nedir|ne)\w*|^\s*(kodu|kodunu|kodu\s+ne)\s*\??$/.test(sade);
  if (KOD_ISTEGI.test(sade) && (gonderme || takipBasi || kodIste) && sozler.length <= 6 && onceki.kod) {
    return { metin: 'Az önceki hesabı arkada şu TürKod koduyla çalıştırdım. Kopyalayıp TürKod\'da ya da Canlı Demo\'da çalıştırabilirsin; ▶ Çalıştır düğmesiyle burada da deneyebilirsin:', kod: onceki.kod, baglam: onceki };
  }
  // Sözel problemin devamı: "peki 2 tanesini daha yerse?", "Ayşe de 4 elma alsaydı?"
  if (onceki.tur === 'problem' && onceki.cumleler?.length && onceki.soru !== undefined && (takipBasi || gonderme || /(sa|se|saydi|seydi|sak|sek)\b/.test(sade))
    && (KAZAN.test(sade) || KAYBET.test(sade) || /\b(olsaydi|olsa|olursa)\b/.test(sade))) {
    let cumleler = [...onceki.cumleler];
    let yeni = soru.replace(/^\s*(peki|ya|o zaman|şimdi|bir de)\s*,?\s*/i, '').replace(/\?+\s*$/, '');
    // "ya 10 elması olsaydı" -> ilk sahiplik cümlesindeki sayı değişir
    const olsa = katla(yeni).match(/^(\d+(?:\.\d+)?)\b.*\b(olsaydi|olsa|olursa)\b/);
    if (olsa) {
      const i = cumleler.findIndex((c) => /\d/.test(c));
      if (i >= 0) cumleler[i] = cumleler[i].replace(/\d+(?:\.\d+)?/, olsa[1]);
      yeni = '';
    }
    const soruKismi = /\b(kac|ne kadar)\b/.test(katla(yeni)) ? '' : onceki.soru || 'Kaç olur?';
    const metin = [...cumleler, yeni, soruKismi].filter(Boolean).map((c) => c.replace(/[.?!]*$/, '')).join('. ') + (soruKismi ? '' : '?');
    const r = sozelProblem(onHazirla(metin), var_);
    if (r) return { ...r, metin: `Az önceki probleme bunu da ekleyince:\n${r.metin}` };
  }
  const sablon = sablonTakibi(sade, sozler, onceki, var_);
  if (sablon) return sablon;
  if (!onceki.sonuc) return null;
  const v = onceki.sonuc;
  // Önceki sonuca uygulanan işlem
  const kalip: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^\s*([-+*/^%])\s*(\d+(?:\.\d+)?)\s*$/, (m) => `${v}${m[1]}${m[2]}`],
    [/(\d+(?:\.\d+)?)'?[a-z]*\s+(?:ile\s+)?(?:carp)[a-z]*/, (m) => `${v}*${m[1]}`],
    [/(\d+(?:\.\d+)?)'?[a-z]*\s+(?:bol)[a-z]*/, (m) => `${v}/${m[1]}`],
    [/(\d+(?:\.\d+)?)'?[a-z]*\s+(?:ekle|eklers|eklen|arttir|topla)[a-z]*/, (m) => `${v}+${m[1]}`],
    [/(\d+(?:\.\d+)?)'?[a-z]*\s+(?:cikar|eksilt|azalt)[a-z]*/, (m) => `${v}-${m[1]}`],
    [/(\d+(?:\.\d+)?)\s*(?:fazlasi|fazla)/, (m) => `${v}+${m[1]}`],
    [/(\d+(?:\.\d+)?)\s*(?:eksigi|eksik|azi)/, (m) => `${v}-${m[1]}`],
    [/(\d+(?:\.\d+)?)\s*kati/, (m) => `${v}*${m[1]}`],
    [/(\d+(?:\.\d+)?)\.?\s*(?:kuvveti|ussu)/, (m) => `${v}^${m[1]}`],
    [/\bkaresi|karesini/, () => `${v}^2`],
    [/\bkupu|kupunu/, () => `${v}^3`],
    [/\bkarekok/, () => `karekok(${v})`],
    [/\byarisi/, () => `${v}/2`],
    [/\bfaktoriyel/, () => `(${v})!`],
    [/\bmutlak/, () => `mutlak(${v})`],
    [/\byuvarla/, () => `yuvarla(${v})`],
  ];
  const ciplakIslem = /^\s*[-+*/^%]\s*\d/.test(sade);
  if (!(gonderme || takipBasi || ciplakIslem || sozler.length <= 4)) return null;
  // Kendi başına tam bir işlem varsa ("peki 3 + 4") takip değildir
  const kendi = ifadeDizgesi(sade);
  if (kendi && !ciplakIslem && !gonderme && ayristir(kendi) && islemVar(ayristir(kendi)!)) return null;
  for (const [re, f] of kalip) {
    const m = sade.match(re);
    if (!m) continue;
    // Gönderme sözcüğü ya da "peki" yoksa yalnızca çok kısa sorularda ("2 ile çarp")
    const ifade = f(m);
    const r = islemCevabi(ifade);
    if (r) return { ...r, metin: `Az önceki sonuçla (${sayiYaz(hesapla(ayristir(v)!))}) devam ediyorum:\n${r.metin}` };
  }
  return null;
}

/**
 * Soru hesap sorusuna benziyor ama çözülemedi mi? ("12 elmanın 3'te 2'si ile 5 armut ... kaç")
 * Öyleyse Kodi alakasız bir belge cevabı vermek yerine soruyu nasıl yazacağını söyler.
 */
export function hesapSorusuGibi(soru: string): boolean {
  const sade = katla(onHazirla(soru));
  if (KOD_SOZU.test(sade)) return false;
  // Kod parçası ya da "neden böyle çıkıyor" sorusu: hesap değil, kavram/hata sorusu
  // ("a = 10 \n yazdır(a / b)", "0.1 + 0.2 neden 0.3 etmiyor", "3 / 2 yapınca 1.5 çıkıyor")
  if (/\n|['"\[\]]|\b[a-z_]\w*\s*=\s*\S|\b(neden|niye|cikiyor|ciktı|cikti|yapinca|yazinca|yazdim|istiyorum|hata|error|degil|etmiyor|olmuyor)\b/.test(sade)) return false;
  const sayiAdedi = (sade.match(/\d+(?:\.\d+)?/g) ?? []).length;
  const islemSozu = /[+*/^=]|\d\s*-\s*\d|\b(arti|eksi|carpi|bolu|karekok|faktoriyel|yuzde|kati|fazlasi|eksigi|toplami|farki|carpimi)\b/.test(sade);
  const soruSozu = /\b(kac|kactir|ne\s+kadar|hesapla|sonucu|esittir)\b/.test(sade);
  return (sayiAdedi >= 2 && (soruSozu || islemSozu)) || (sayiAdedi >= 1 && islemSozu && soruSozu);
}

