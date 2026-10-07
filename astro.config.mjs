import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  base: '/turkod-site/',
  site: 'https://yusufx-sys.github.io',
  integrations: [
    starlight({
      title: 'TürKod',
      favicon: '/favicon.ico',
      // head içindeki yollara base otomatik eklenmez; /turkod-site/ elle yazılır.
      // Not: Google arama sonucundaki logoyu yusufx-sys.github.io/ ANA SAYFASINDAN
      // alır (ayrı depo: YusufX-sys.github.io). Buradakiler tarayıcı sekmesi içindir.
      head: [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/turkod-site/icon-48.png' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/turkod-site/icon-96.png' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/turkod-site/icon-192.png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/turkod-site/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://yusufx-sys.github.io/turkod-site/icon-512.png' } },
      ],
      customCss: ['./src/styles/custom.css'],
      tableOfContents: false,
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Footer: './src/components/Footer.astro',
      },
      locales: { root: { label: 'Türkçe', lang: 'tr' } },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/YusufX-sys/turkod-ide' }
      ],
      sidebar: [
        {
          label: '🚀 Başlangıç',
          items: [
            { label: 'Giriş', link: '/getting-started/' },
            { label: 'Kurulum', link: '/install/' },
            { label: 'Canlı Demo', link: '/demo/' },
            { label: 'Sürüm Geçmişi', link: '/releases/' },
          ],
        },
        {
          label: '🧭 Nasıl Kullanılır',
          items: [
            { label: 'Arayüz Turu', link: '/use/tour/' },
            { label: 'İlk Programını Çalıştır', link: '/use/first-run/' },
          ],
        },
        {
	  label: '📚 Dili Öğrenin',
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
          label: '✨ Özellikler',
          items: [
            { label: 'Arayüz', link: '/features/ui/' },
            { label: 'Kod Editörü', link: '/features/editor/' },
            { label: 'Çalıştırma ve Hata Ayıklama', link: '/features/run-debug/' },
            { label: 'Akıllı Düzeltme', link: '/features/smart-fix/' },
            { label: 'AI Asistan', link: '/features/ai/' },
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
          label: '🛠️ Geliştirici',
          items: [
            { label: 'Hakkımda', link: '/about/' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
});

