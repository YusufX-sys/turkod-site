// Kodi'nin belge bilgisi: derleme bitince sitedeki her belge sayfası ## / ### başlıklarına göre
// bölümlere ayrılır ve dist/kodi-bolumler.json'a yazılır. Kodi, hazır bilgisinde olmayan ayrıntılı
// soruları bu bölümlerden (özet + ilk kod örneği + bölüme bağlantı) cevaplar. Belgeler değiştikçe
// bilgi de kendiliğinden güncellenir. Ek paket gerekmez: Astro'nun ürettiği düzenli HTML basitçe ayrıştırılır.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ATLA_SAYFA = new Set(['/', '/learn/sozluk/', '/releases/', '/404/']);
const BOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const BLOK = new Set(['p', 'li', 'td', 'th', 'dd', 'dt', 'blockquote', 'figcaption', 'div', 'tr', 'h4', 'h5', 'h6']);

const varlik = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

const ozellik = (attrs, ad) => {
  const m = attrs.match(new RegExp(`\\s${ad}="([^"]*)"`));
  return m ? varlik(m[1]) : '';
};

/** İçeriği atlanacak öğe mi? (başlık bağlantısı, ekran okuyucu metni, kopyala düğmesi, kod başlığı ...) */
const atlanir = (etiket, attrs) => {
  if (['script', 'style', 'svg', 'button', 'template', 'noscript'].includes(etiket)) return true;
  const sinif = ozellik(attrs, 'class');
  return /\b(sl-anchor-link|sr-only|copy|header|tk-shot|sl-badge)\b/.test(sinif) && etiket !== 'pre';
};

/** Bir sayfanın içerik kısmını bölümlere ayırır. */
export function bolumlereAyir(html) {
  const bas = html.indexOf('class="sl-markdown-content"');
  if (bas < 0) return { baslik: '', bolumler: [] };
  const h1 = html.match(/<h1[^>]*id="_top"[^>]*>([\s\S]*?)<\/h1>/);
  const sayfaBaslik = h1 ? varlik(h1[1].replace(/<[^>]+>/g, '')).trim() : '';
  const govde = html.slice(html.lastIndexOf('<div', bas));

  const bolumler = [];
  let simdiki = { baslik: sayfaBaslik, capa: '', metin: [], kod: [] };
  const yigin = []; // { etiket, atla }
  let atlaDerinlik = 0, baslikMetni = null, baslikCapa = '', kodMetni = null, kodSatirIlk = true;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(govde))) {
    const [, kapanis, etiketHam, attrs, kendiKapanir, metin] = m;
    if (metin !== undefined) {
      if (atlaDerinlik) continue;
      const t = varlik(metin);
      if (baslikMetni !== null) baslikMetni += t;
      else if (kodMetni !== null) kodMetni += t;
      // Düz metinde HTML'deki satır sonları boşluktur; satırları yalnızca blok sonları ayırır.
      else simdiki.metin.push(t.replace(/\s+/g, ' '));
      continue;
    }
    const etiket = etiketHam.toLowerCase();
    if (!kapanis) {
      const atla = atlanir(etiket, attrs);
      if (!BOS.has(etiket) && !kendiKapanir) yigin.push({ etiket, atla });
      if (atla) { if (!BOS.has(etiket) && !kendiKapanir) atlaDerinlik++; continue; }
      if (atlaDerinlik) continue;
      if (etiket === 'h2' || etiket === 'h3') {
        if (simdiki.metin.join('').trim() || simdiki.kod.length) bolumler.push(simdiki);
        baslikMetni = ''; baslikCapa = ozellik(attrs, 'id');
      } else if (etiket === 'pre') {
        kodMetni = ''; kodSatirIlk = true;
      } else if (kodMetni !== null && /\bec-line\b/.test(ozellik(attrs, 'class'))) {
        if (!kodSatirIlk) kodMetni += '\n';
        kodSatirIlk = false;
      } else if (etiket === 'br') {
        if (kodMetni !== null) kodMetni += '\n'; else simdiki.metin.push(' ');
      }
      continue;
    }
    // kapanış etiketi
    let ust = yigin.pop();
    while (ust && ust.etiket !== etiket) ust = yigin.pop();
    if (!ust) break; // içerik kabının dışına çıkıldı
    if (ust.atla) { atlaDerinlik--; continue; }
    if (atlaDerinlik) continue;
    if (yigin.length === 0) break; // sl-markdown-content kapandı
    if ((etiket === 'h2' || etiket === 'h3') && baslikMetni !== null) {
      simdiki = { baslik: baslikMetni.replace(/\s+/g, ' ').trim(), capa: baslikCapa, metin: [], kod: [] };
      baslikMetni = null;
    } else if (etiket === 'pre' && kodMetni !== null) {
      if (kodMetni.trim()) simdiki.kod.push(kodMetni.replace(/\s+$/, ''));
      kodMetni = null;
    } else if (etiket === 'td' || etiket === 'th') {
      simdiki.metin.push(' — '); // tablo satırı tek satırda: "büyük_harf — upper — HEPSİNİ BÜYÜK yapar"
    } else if (BLOK.has(etiket)) {
      simdiki.metin.push('\n');
    }
  }
  if (simdiki.metin.join('').trim() || simdiki.kod.length) bolumler.push(simdiki);

  return {
    baslik: sayfaBaslik,
    bolumler: bolumler.map((b) => ({
      baslik: b.baslik,
      capa: b.capa,
      metin: b.metin.join('').split('\n')
        .map((s) => s.replace(/\s+/g, ' ').replace(/^(\s*—\s*)+|(\s*—\s*)+$/g, '').replace(/(\s—\s*){2,}/g, ' — ').trim())
        .filter(Boolean).join('\n'),
      kod: b.kod[0] ?? '',
      kodlar: b.kod,
    })),
  };
}

/** Uzun metni en fazla `sinir` harflik, cümle sonunda biten bir özete indirir. */
export function ozetle(metin, sinir = 460) {
  if (metin.length <= sinir) return metin;
  const parca = metin.slice(0, sinir);
  const son = Math.max(parca.lastIndexOf('. '), parca.lastIndexOf('! '), parca.lastIndexOf('? '), parca.lastIndexOf('\n'));
  return (son > sinir * 0.4 ? parca.slice(0, son + 1) : parca.replace(/\s+\S*$/, '') + '…').trim();
}

async function htmlDosyalari(kok) {
  const sonuc = [];
  for (const g of await readdir(kok, { withFileTypes: true, recursive: true })) {
    if (g.isFile() && g.name === 'index.html') sonuc.push(path.join(g.parentPath ?? g.path, g.name));
  }
  return sonuc;
}

/**
 * dist klasöründen bölüm listesini üretir:
 * [sayfa, sayfaBaşlık, başlık, çapa, özet, ilk kod, tam metin, bütün kodlar]
 * Tam metin ve bütün kodlar aranır; Kodi cevapta soruyla en çok örtüşen cümleleri gösterir.
 */
export async function bolumleriUret(distKlasoru) {
  const kayitlar = [];
  for (const dosya of (await htmlDosyalari(distKlasoru)).sort()) {
    const sayfa = '/' + path.relative(distKlasoru, path.dirname(dosya)).split(path.sep).filter(Boolean).join('/') + '/';
    const yol = sayfa === '//' ? '/' : sayfa;
    if (ATLA_SAYFA.has(yol)) continue;
    const { baslik, bolumler } = bolumlereAyir(await readFile(dosya, 'utf8'));
    for (const b of bolumler) {
      let ozet = ozetle(b.metin);
      if (/^Çıktı:?$/.test(ozet)) ozet = ''; // asıl bilgi kod örneğinde
      if (ozet.length < 25 && !b.kod) continue;
      const kisalt = (k) => k.split('\n').slice(0, 12).join('\n');
      const tam = b.metin.length > 6000 ? b.metin.slice(0, 6000) : b.metin;
      kayitlar.push([yol, baslik, b.baslik, b.capa, ozet, kisalt(b.kod), tam === ozet ? '' : tam, b.kodlar.slice(0, 6).map(kisalt)]);
    }
  }
  return kayitlar;
}

/**
 * Soru-cevap bankası (src/data/kodi-banka/*.json): her bölüm için önceden (geliştirici makinesinde,
 * bir dil modeliyle) üretilmiş olası kullanıcı soruları ve bölüme dayalı kısa cevap. Tarayıcıda model
 * çalışmaz; Kodi bu soruları da arar ve cevabı gösterir. Kayda iki alan eklenir: [8] sorular, [9] cevap.
 * Dönen değer: bankada olup sitede artık bulunmayan bölümler (belge değiştiyse banka güncellenmeli).
 */
export async function bankaEkle(kayitlar, bankaKlasoru) {
  let dosyalar = [];
  try { dosyalar = (await readdir(bankaKlasoru)).filter((d) => d.endsWith('.json')); } catch { return []; }
  const banka = new Map();
  for (const d of dosyalar) {
    const { sayfa, bolumler } = JSON.parse(await readFile(path.join(bankaKlasoru, d), 'utf8'));
    for (const [capa, v] of Object.entries(bolumler ?? {})) banka.set(`${sayfa}#${capa}`, v);
  }
  const kullanilan = new Set();
  for (const k of kayitlar) {
    const anahtar = `${k[0]}#${k[3]}`;
    const v = banka.get(anahtar);
    if (!v) continue;
    kullanilan.add(anahtar);
    while (k.length < 8) k.push(k.length === 7 ? [] : '');
    k[8] = (v.s ?? []).filter((s) => typeof s === 'string' && s.trim());
    k[9] = typeof v.c === 'string' ? v.c.trim() : '';
  }
  return [...banka.keys()].filter((a) => !kullanilan.has(a));
}

/** Hazır maddelerin soru bankası (src/data/kodi-banka-madde/*.json): { madde-id: [sorular] } birleştirilir. */
export async function maddeBankasiOku(klasor) {
  let dosyalar = [];
  try { dosyalar = (await readdir(klasor)).filter((d) => d.endsWith('.json')).sort(); } catch { return {}; }
  const banka = {};
  for (const d of dosyalar) {
    for (const [id, sorular] of Object.entries(JSON.parse(await readFile(path.join(klasor, d), 'utf8')))) {
      if (Array.isArray(sorular)) banka[id] = [...(banka[id] ?? []), ...sorular.filter((s) => typeof s === 'string' && s.trim())];
    }
  }
  return banka;
}

export default function kodiBolumleri() {
  return {
    name: 'kodi-bolumler',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const kok = fileURLToPath(dir);
        const b = await bolumleriUret(kok);
        const eski = await bankaEkle(b, fileURLToPath(new URL('../data/kodi-banka/', import.meta.url)));
        if (eski.length) logger.warn(`Kodi bankasında sitede bulunmayan ${eski.length} bölüm var: ${eski.slice(0, 5).join(', ')}${eski.length > 5 ? ' …' : ''}`);
        await writeFile(path.join(kok, 'kodi-bolumler.json'), JSON.stringify({ b }));
        logger.info(`Kodi için ${b.length} belge bölümü yazıldı (kodi-bolumler.json), ${b.filter((k) => k[8]?.length).length} tanesi soru bankalı.`);
        const s = await maddeBankasiOku(fileURLToPath(new URL('../data/kodi-banka-madde/', import.meta.url)));
        await writeFile(path.join(kok, 'kodi-madde-sorular.json'), JSON.stringify({ s }));
        logger.info(`Kodi için ${Object.keys(s).length} hazır maddenin soru bankası yazıldı (kodi-madde-sorular.json).`);
      },
    },
  };
}
