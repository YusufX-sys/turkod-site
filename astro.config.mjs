import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import kodiBolumleri from './src/integrations/kodi-bolumler.mjs';

export default defineConfig({
  site: 'https://turkod.pages.dev',
  integrations: [
    kodiBolumleri(), // Kodi'nin belge bilgisi: dist/kodi-bolumler.json
    starlight({
      title: 'TürKod',
      favicon: '/favicon.ico',
      // Site alan adının kökünde yayınlanır (Cloudflare Pages). Google arama
      // sonucundaki logo ve site adı bu kök ana sayfadan okunur.
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/icon-48.png' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icon-96.png' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://turkod.pages.dev/icon-512.png' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#070b16' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
        { tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'WebSite', '@id': 'https://turkod.pages.dev/#website', name: 'TürKod', alternateName: ['TurKod', 'TürKod IDE'], url: 'https://turkod.pages.dev/', inLanguage: 'tr' },
            { '@type': 'Organization', '@id': 'https://turkod.pages.dev/#organization', name: 'TürKod', url: 'https://turkod.pages.dev/', logo: 'https://turkod.pages.dev/icon-512.png', sameAs: ['https://github.com/YusufX-sys/turkod-ide'] },
          ],
        }) },
      ],
      customCss: ['./src/styles/custom.css', './src/styles/belgeler.css'],
      tableOfContents: false,
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Footer: './src/components/Footer.astro',
        Hero: './src/components/Hero.astro',
        Sidebar: './src/components/Sidebar.astro',
        PageTitle: './src/components/PageTitle.astro',
      },
      locales: { root: { label: 'Türkçe', lang: 'tr' } },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/YusufX-sys/turkod-ide' }
      ],
      sidebar: [
        {
          label: 'Başlangıç',
          items: [
            { label: 'Giriş', link: '/getting-started/' },
            { label: 'Kurulum', link: '/install/' },
            { label: 'Canlı Demo', link: '/demo/' },
            { label: '3.3 Yenilikleri', link: '/whats-new/', badge: { text: 'Yeni', variant: 'tip' } },
            { label: 'Sürüm Geçmişi', link: '/releases/' },
          ],
        },
        {
          label: 'Nasıl Kullanılır',
          items: [
            { label: 'Arayüz Turu', link: '/use/tour/' },
            { label: 'İlk Programını Çalıştır', link: '/use/first-run/' },
            { label: 'Menü Rehberi', link: '/use/menus/' },
            { label: 'Sorun Giderme ve SSS', link: '/use/troubleshooting/' },
          ],
        },
        {
	  label: 'Dili Öğrenin',
	  items: [
	    { label: 'Temel İfadeler', link: '/learn/basics/' },
	    { label: 'Koşullar', link: '/learn/conditions/' },
	    { label: 'Fonksiyonlar', link: '/learn/functions/' },
	    { label: 'Veri Yapıları', link: '/learn/data-structures/' },
	    { label: 'Metin İşlemleri', link: '/learn/strings/' },
	    { label: 'Hatalar ve Dosyalar', link: '/learn/errors-files/' },
	    { label: 'Sınıflar', link: '/learn/classes/' },
	    { label: 'Varsayılan Kütüphaneler', link: '/learn/stdlib/' },
	    { label: 'Diğer Kütüphaneler', link: '/learn/extra-libs/' },
	    { label: 'Kendini Test Et', link: '/learn/quiz/' },
	    { label: 'Sözlük', link: '/learn/sozluk/' },
	    { label: 'Sözdizimi Davranışları', link: '/learn/sozdizimi-davranislari/' },
	  ],
	},
        {
          label: 'Özellikler',
          items: [
            { label: 'Arayüz', link: '/features/ui/' },
            { label: 'Kod Editörü', link: '/features/editor/' },
            { label: 'Çalıştırma ve Hata Ayıklama', link: '/features/run-debug/' },
            { label: 'Akıllı Düzeltme', link: '/features/smart-fix/' },
            { label: 'Kodi', link: '/features/kodi/' },
            { label: 'AI Asistan', link: '/features/ai/' },
            { label: 'Yapay Zekâ Modelleri', link: '/features/local-models/' },
            { label: "EXE'ye Dönüştür", link: '/features/exe/' },
            { label: 'Araçlar', link: '/features/tools/' },
            { label: 'Terminal ve Paketler', link: '/features/terminal/' },
            { label: 'Ayarlar ve Temalar', link: '/features/settings/' },
            { label: 'Klavye Kısayolları', link: '/features/shortcuts/' },
            { label: 'Otomatik Güncelleme', link: '/features/updates/' },
            { label: 'Güvenlik', link: '/features/security/' },
            { label: 'Gereksinimler', link: '/features/requirements/' },
          ],
        },
        {
          label: 'Geliştirici',
          items: [
            { label: 'Katkıda Bulun', link: '/contribute/' },
            { label: 'Hakkımda', link: '/about/' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
});

