import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  base: '/turkod-site/',
  site: 'https://yusufx-sys.github.io',
  integrations: [
    starlight({
      title: 'TürKod',
      favicon: '/logo.png',
      customCss: ['./src/styles/custom.css'],
      tableOfContents: false,
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeSelect: './src/components/EmptyTheme.astro',
        Footer: './src/components/Footer.astro',
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
            { label: 'Sürüm Geçmişi', link: '/releases/' },
          ],
        },
        {
          label: 'Özellikler',
          items: [
            { label: 'Arayüz', link: '/features/ui/' },
            { label: 'Güvenlik', link: '/features/security/' },
            { label: 'Gereksinimler', link: '/features/requirements/' },
          ],
        },
        {
          label: 'Geliştirici',
          items: [
            { label: 'Hakkımda', link: '/about/' },
          ],
        },
      ],
    }),
  ],
});
