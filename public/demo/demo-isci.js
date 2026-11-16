// TürKod Canlı Demo işçisi (Web Worker): Python'u (Pyodide) sayfadan ayrı çalıştırır;
// böylece sonsuz döngü sayfayı dondurmaz, "Durdur" işçiyi kapatarak programı durdurur.
//
// Sayfa -> işçi: { tur: 'calistir', kod, girdiler, tohum }
// İşçi -> sayfa: { tur: 'durum', metin } | { tur: 'hazir' } | { tur: 'yaz', metin }
//               | { tur: 'bitti', kod } | { tur: 'girdi', istem } | { tur: 'hata', metin }
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
importScripts(PYODIDE + 'pyodide.js');

let hazir = null;

async function kur() {
  postMessage({ tur: 'durum', metin: 'Python yükleniyor (ilk seferde birkaç saniye sürer)…' });
  const py = await loadPyodide({ indexURL: PYODIDE });
  postMessage({ tur: 'durum', metin: 'TürKod çeviricisi yükleniyor…' });
  const [paket, cekirdek] = await Promise.all([
    fetch(new URL('turkod_ide.zip', self.location.href)).then((r) => {
      if (!r.ok) throw new Error('turkod_ide.zip indirilemedi (' + r.status + ')');
      return r.arrayBuffer();
    }),
    fetch(new URL('demo_cekirdek.py', self.location.href)).then((r) => r.text()),
  ]);
  py.unpackArchive(paket, 'zip', { extractDir: '/home/pyodide' });
  py.runPython('import sys\nif "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")');
  py.runPython(cekirdek);
  return py;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.tur === 'hazirla') {
    // Sayfa açılınca arka planda: ilk "Çalıştır" beklemesin.
    try { hazir ??= kur(); await hazir; } catch { hazir = null; }
    return;
  }
  if (m.tur !== 'calistir') return;
  try {
    hazir ??= kur();
    const py = await hazir;
    postMessage({ tur: 'hazir' });
    const calistir = py.globals.get('calistir');
    const sonuc = calistir(m.kod, (metin) => postMessage({ tur: 'yaz', metin }), py.toPy(m.girdiler), m.tohum);
    const js = sonuc.toJs({ dict_converter: Object.fromEntries });
    sonuc.destroy();
    calistir.destroy();
    if (js.durum === 'girdi') postMessage({ tur: 'girdi', istem: js.istem });
    else postMessage({ tur: 'bitti', kod: js.kod });
  } catch (err) {
    hazir = null;
    postMessage({ tur: 'hata', metin: String(err && err.message ? err.message : err) });
  }
};
