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
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeSelect: './src/components/EmptyTheme.astro',
        Footer: './src/components/Footer.astro',
      },
      head: [
        {
          tag: 'script',
          content: `
            document.documentElement.setAttribute('data-theme', 'dark');
            document.addEventListener('DOMContentLoaded', tkInit);
            document.addEventListener('astro:page-load', tkInit);
            function tkInit(){
              if(!document.querySelector('.tk-grid-bg')){
                var gr = document.createElement('div');
                gr.className = 'tk-grid-bg';
                document.body.appendChild(gr);
              }
              var sb = document.querySelector('.sidebar');
              var act = sb && sb.querySelector('a[aria-current="page"]');
              if(!sb || !act) return;
              var g = sb.querySelector('.tk-glow');
              if(!g){ g = document.createElement('div'); g.className = 'tk-glow'; sb.appendChild(g); }
              var s = sb.getBoundingClientRect(), a = act.getBoundingClientRect();
              var top = a.top - s.top + sb.scrollTop, h = a.height;
              var prev = null;
              try { prev = JSON.parse(localStorage.getItem('tk-glow') || 'null'); } catch(e){}
              if(prev){
                g.style.transition = 'none';
                g.style.top = prev.top + 'px'; g.style.height = prev.h + 'px'; g.style.opacity = '1';
                void g.offsetHeight;
                g.style.transition = '';
                requestAnimationFrame(function(){ g.style.top = top + 'px'; g.style.height = h + 'px'; });
              } else {
                g.style.top = top + 'px'; g.style.height = h + 'px'; g.style.opacity = '1';
              }
              localStorage.setItem('tk-glow', JSON.stringify({top: top, h: h}));
            }
          `
        }
      ],
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
