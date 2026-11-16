# TürKod Sitesi

[TürKod](https://github.com/YusufX-sys/turkod-ide) projesinin resmî belgeler sitesi.
[Astro](https://astro.build) ve [Starlight](https://starlight.astro.build) ile yapılmıştır.

🔗 **Canlı site:** https://turkod.pages.dev/

## İçerik

- **Başlangıç:** kurulum, canlı demo, 3.3 yenilikleri ve sürüm geçmişi
- **Nasıl Kullanılır:** arayüz turu, ilk program, menüler, sorun giderme
- **Dili Öğrenin:** dersler, testler ve 2970 kelimelik TürKod ⇄ Python sözlüğü
- **Özellikler:** Kodi, yapay zekâ, Akıllı Düzelt, EXE'ye Dönüştür, terminal ve daha fazlası
- **Canlı Demo:** TürKod kodunu tarayıcıda, programın **gerçek çeviricisiyle** çalıştırır
  (Pyodide ile tarayıcıda Python; hata mesajları programdakiyle aynı).
- **Site içi Kodi:** sorularını hazır bilgi tabanından, sözlükten ve sitedeki bütün belge
  bölümlerinden cevaplayan yardımcı robot (yapay zekâ kullanmaz). Takip sorularını anlar.
  İsteğe bağlı Vikipedi araması varsayılan olarak kapalıdır; açılınca da her aramadan önce izin ister.

## Geliştirme

Gereksinim: Node.js 22 veya üstü.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # dist/ klasörüne derler (arama dizini dahil)
npm run preview    # derlenmiş siteyi önizler
```

Sürüm geçmişi sayfası ve "İndir" düğmeleri en güncel sürümü GitHub'dan alır. Derlemede
GitHub'ın istek sınırına takılmamak için isteğe bağlı olarak `GH_RELEASES_TOKEN` ortam
değişkeni tanımlanabilir.

## Yapı

```
.
├── public/                 Simgeler, ekran görüntüleri, kodi-sozluk.json
├── scripts/
│   ├── kodi-sozluk-uret.py      Kodi'nin sözlük verisini TürKod kaynağından üretir
│   └── yonlendirme-uret.mjs     Eski GitHub Pages adresi için yönlendirme sayfaları
├── src/
│   ├── assets/             Sayfalarda kullanılan görseller
│   ├── components/         Ana sayfa, sol panel, Kodi, alt bilgi ve öteki bileşenler
│   ├── content/docs/       Sayfa içerikleri (.md / .mdx)
│   ├── data/               Kodi'nin bilgi tabanı ve eşleştirme motoru, en güncel sürüm bilgisi
│   ├── pages/              Sürüm geçmişi sayfası
│   └── styles/             custom.css (genel tema), belgeler.css (belgeler sayfaları)
├── astro.config.mjs
└── package.json
```

## Canlı Demo'yu güncelleme

Demo, `public/demo/turkod_ide.zip` içindeki çeviriciyi kullanır. TürKod'un çeviricisi ya da
sözlüğü değişince paketi yeniden üret:

```bash
python scripts/demo-paket-uret.py "<TurKod-v3.3.0 klasörünün yolu>"
```

## Kodi'yi geliştirme

- Hazır cevaplar: `src/data/kodi-bilgi.ts`; eşleştirme motoru: `src/data/kodi-motor.ts`.
- Belge bölümleri her derlemede kendiliğinden üretilir (`src/integrations/kodi-bolumler.mjs` ->
  `dist/kodi-bolumler.json`); belgeye yazılan her ayrıntıyı Kodi de bilir.
- Başarıyı ölç (önce `npm run build`):

```bash
node scripts/kodi-dene.ts hepsi                 # bütün deneme listelerinin oranları
node scripts/kodi-dene.ts soru "döngü nasıl"    # tek soru: en iyi adaylar
node scripts/kodi-ornek.ts "döngü nasıl"        # Kodi'nin vereceği cevabın metni
node scripts/kodi-ayarla.ts                     # ağırlıkları geliştirme listelerinde yeniden ayarla
```

Deneme listeleri `scripts/kodi-deneme/` içindedir; `*gizli*` listelere bakarak ayar yapma.

## Sözlüğü güncelleme

Sözlük sayfası (`src/content/docs/learn/sozluk.md`) elle düzenlenmez; TürKod deposundaki
`sozluk_uret.py` ile üretilir. TürKod sözlüğü değişince:

```bash
# TürKod deposunda (TurKod-v3.3.0 klasörü):
python sozluk_uret.py
# Üretilen sozluk.md dosyasını src/content/docs/learn/ altına kopyala, sonra bu depoda:
python scripts/kodi-sozluk-uret.py "<TurKod-v3.3.0 klasörünün yolu>"
```

## Yayın

Site Cloudflare Pages'te yayınlanır: `main` dalına her gönderimde kendiliğinden derlenir.
`.github/workflows/deploy.yml`, eski GitHub Pages adresindeki her sayfayı yeni adrese
yönlendiren sayfaları üretir.

## Katkıda bulunma

Hata bildirimi veya öneri için [Issues](https://github.com/YusufX-sys/turkod-site/issues)
sekmesini kullanabilirsin. TürKod programıyla ilgili konular için
[turkod-ide](https://github.com/YusufX-sys/turkod-ide/issues) deposunu kullan.

## Lisans

Bu proje [MIT Lisansı](./LICENSE) ile lisanslanmıştır.
