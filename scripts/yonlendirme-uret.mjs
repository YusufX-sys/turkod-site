// Eski GitHub Pages adresi (yusufx-sys.github.io/turkod-site/) için yönlendirme
// sayfaları üretir. Site artık Cloudflare Pages'te (turkod.pages.dev) kökte
// yayınlanıyor; eski adresteki her sayfa yeni adresteki karşılığına gider.
// Google bunu kalıcı yönlendirme sayar ve sıralamayı yeni adrese taşır.
// Eski adresler ayrıca sitemap.xml'e yazılır; Search Console'daki eski mülke
// gönderildiğinde Google eski sayfaları yeniden tarayıp yönlendirmeyi görür.
//
// Kullanım (önce `npm run build`):  node scripts/yonlendirme-uret.mjs dist yonlendirme
import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const YENI = 'https://turkod.pages.dev';
const ESKI = 'https://yusufx-sys.github.io/turkod-site';
const [kaynak = 'dist', hedef = 'yonlendirme'] = process.argv.slice(2);

function sayfa(url) {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>TürKod taşındı</title>
<link rel="canonical" href="${url}">
<meta http-equiv="refresh" content="0; url=${url}">
<script>location.replace(${JSON.stringify(url)} + location.hash);</script>
</head>
<body>
<p>TürKod sitesi yeni adresine taşındı: <a href="${url}">${url}</a></p>
</body>
</html>
`;
}

const eskiAdresler = [];
function gez(dizin) {
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) { gez(yol); continue; }
    if (ad !== 'index.html') continue;
    const goreli = relative(kaynak, dizin).split(sep).join('/');
    const url = `${YENI}/${goreli ? goreli + '/' : ''}`;
    const cikti = join(hedef, goreli);
    mkdirSync(cikti, { recursive: true });
    writeFileSync(join(cikti, 'index.html'), sayfa(url));
    eskiAdresler.push(`${ESKI}/${goreli ? goreli + '/' : ''}`);
  }
}

mkdirSync(hedef, { recursive: true });
gez(kaynak);
// Bilinmeyen eski adresler: yolu koruyarak yeni siteye gönder.
writeFileSync(join(hedef, '404.html'), `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>TürKod taşındı</title>
<script>
var yol = location.pathname.replace(/^\\/turkod-site\\//, '/');
location.replace(${JSON.stringify(YENI)} + yol + location.search + location.hash);
</script></head>
<body><p>TürKod sitesi taşındı: <a href="${YENI}/">${YENI}</a></p></body></html>
`);
// Eski adreslerin site haritası: eski mülke gönderilir, yeniden taramayı hızlandırır.
eskiAdresler.sort();
writeFileSync(join(hedef, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${eskiAdresler.map((adres) => `<url><loc>${adres}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(hedef, '.nojekyll'), '');
console.log(`${eskiAdresler.length} yönlendirme sayfası ve sitemap.xml üretildi -> ${hedef}`);
