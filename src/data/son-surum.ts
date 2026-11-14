// En güncel TürKod kurulumunun (EXE) indirme adresi.
// Site derlenirken GitHub'dan bir kez alınır ve önbelleğe konur: her sayfa ayrı
// istek atmasın (GitHub kimliksiz istekleri saatte 60 ile sınırlıyor).
const REPO = 'YusufX-sys/turkod-ide';
export const SURUMLER_SAYFASI = `https://github.com/${REPO}/releases/latest`;

export interface SonSurum {
  url: string;      // doğrudan EXE (yoksa .zip, o da yoksa sürüm sayfası)
  surum: string;    // "3.3.0" (bilinmiyorsa boş)
  dogrudan: boolean;
}

let onbellek: Promise<SonSurum> | null = null;

export function sonSurum(): Promise<SonSurum> {
  onbellek ??= (async () => {
    try {
      const token = import.meta.env.GH_RELEASES_TOKEN;
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(`GitHub API ${r.status}`);
      const veri = await r.json();
      const dosyalar: { name: string; browser_download_url: string }[] = veri.assets ?? [];
      const dosya = dosyalar.find((a) => /\.exe$/i.test(a.name)) ?? dosyalar.find((a) => /\.zip$/i.test(a.name));
      return {
        url: dosya?.browser_download_url ?? SURUMLER_SAYFASI,
        surum: String(veri.tag_name ?? '').replace(/^v/i, ''),
        dogrudan: !!dosya,
      };
    } catch (e) {
      console.warn('[son-surum] en güncel sürüm alınamadı:', (e as Error).message);
      return { url: SURUMLER_SAYFASI, surum: '', dogrudan: false };
    }
  })();
  return onbellek;
}
