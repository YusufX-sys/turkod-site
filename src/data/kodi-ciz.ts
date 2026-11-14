// Kodi robotunun çizimi: TürKod programındaki KodiRessami'nin (turkod_flutter/lib/kodi.dart)
// birebir karşılığı. Aynı 100 x 130'luk çizim alanı, aynı koordinatlar ve renkler.

export type KodiIfadesi = 'mutlu' | 'konusuyor' | 'dusunceli';
export type KodiKare = {
  ifade: KodiIfadesi;
  /** 0-1 arası dönen zaman (2,6 sn'de bir tur). */
  t: number;
  /** 1 açık, 0 kapalı (göz kırpma). */
  goz: number;
  /** Konuşurken 0-1 ağız açıklığı. */
  agiz: number;
  elSalla: boolean;
};

const MOR = '#7C5CF5';
const MOR_KOYU = '#5B3FD9';
const CAMGOBEGI = '#22D3EE';
const CAMGOBEGI_KOYU = '#0EA5C6';
const PEMBE = '#EC4899';
const EKRAN = '#0F172A';
const PI2 = Math.PI * 2;

const yuvarlakDortgen = (c: CanvasRenderingContext2D, l: number, t: number, r: number, b: number, rad: number) => {
  c.beginPath();
  c.roundRect(l, t, r - l, b - t, rad);
};

const cizgi = (c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
};

const daire = (c: CanvasRenderingContext2D, x: number, y: number, r: number, renk: string) => {
  c.beginPath(); c.arc(x, y, r, 0, PI2); c.fillStyle = renk; c.fill();
};

const elips = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, renk: string) => {
  c.beginPath(); c.ellipse(x, y, w / 2, h / 2, 0, 0, PI2); c.fillStyle = renk; c.fill();
};

const kolKalemi = (c: CanvasRenderingContext2D, renk = MOR, kalinlik = 7) => {
  c.strokeStyle = renk; c.lineWidth = kalinlik; c.lineCap = 'round';
};

function govde(c: CanvasRenderingContext2D, k: KodiKare) {
  // Bacaklar ve ayaklar.
  c.fillStyle = MOR_KOYU;
  yuvarlakDortgen(c, 35, 100, 43, 112, 3); c.fill();
  yuvarlakDortgen(c, 57, 100, 65, 112, 3); c.fill();
  c.fillStyle = MOR;
  yuvarlakDortgen(c, 29, 109, 47, 118, 5); c.fill();
  yuvarlakDortgen(c, 53, 109, 71, 118, 5); c.fill();
  // Boyun.
  c.fillStyle = MOR_KOYU;
  c.fillRect(44, 58, 12, 10);
  // Kollar (gövdenin arkasında başlar); düşünürken sonra, önde çizilir.
  if (k.ifade !== 'dusunceli') {
    kolKalemi(c);
    const sol = { x: 13, y: 93 + Math.sin(k.t * PI2) * 1.5 };
    cizgi(c, 26, 74, sol.x, sol.y);
    daire(c, sol.x, sol.y, 5.5, PEMBE);
    let el: { x: number; y: number };
    if (k.elSalla) {
      const aci = -1.25 + Math.sin(k.t * 2 * PI2) * 0.38;
      el = { x: 74 + Math.cos(aci) * 26, y: 74 + Math.sin(aci) * 26 };
    } else {
      el = { x: 87, y: 93 - Math.sin(k.t * PI2) * 1.5 };
    }
    kolKalemi(c);
    cizgi(c, 74, 74, el.x, el.y);
    daire(c, el.x, el.y, 5.5, PEMBE);
  }
  // Gövde.
  const g = c.createLinearGradient(0, 64, 0, 104);
  g.addColorStop(0, '#67E8F9'); g.addColorStop(1, CAMGOBEGI_KOYU);
  c.fillStyle = g;
  yuvarlakDortgen(c, 24, 64, 76, 104, 11); c.fill();
  // Göğüsteki ekran ve </> işareti.
  c.fillStyle = EKRAN;
  yuvarlakDortgen(c, 33, 72, 67, 94, 5); c.fill();
  c.fillStyle = CAMGOBEGI;
  c.font = '800 11px Consolas, "Cascadia Mono", monospace';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('</>', 50, 83.5);
}

function gozler(c: CanvasRenderingContext2D, k: KodiKare) {
  c.strokeStyle = CAMGOBEGI; c.lineWidth = 3; c.lineCap = 'round';
  for (const x of [40, 60]) {
    if (k.ifade === 'mutlu') {
      c.beginPath();
      if (k.goz < 0.5) { c.moveTo(x - 4, 37); c.lineTo(x + 4, 37); }
      else { c.moveTo(x - 5, 39); c.quadraticCurveTo(x, 31, x + 5, 39); }
      c.stroke();
    } else if (k.ifade === 'konusuyor') {
      elips(c, x, 37, 9, Math.max(1.5, 10 * k.goz), CAMGOBEGI);
      if (k.goz > 0.5) daire(c, x + 1.8, 35, 1.6, '#FFFFFF');
    } else {
      // Düşünceli: yukarı, sağa bakan gözler; sol göz hafif kısık, sağda kalkık kaş.
      elips(c, x + 1.5, 35.5, 9, Math.max(1.5, (x < 50 ? 6.5 : 9) * k.goz), CAMGOBEGI);
      if (x > 50) {
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - 5, 29.5); c.quadraticCurveTo(x, 26.5, x + 5, 29.5); c.stroke();
        c.lineWidth = 3;
      }
    }
  }
}

function agiz(c: CanvasRenderingContext2D, k: KodiKare) {
  c.strokeStyle = CAMGOBEGI; c.lineWidth = 2.6; c.lineCap = 'round';
  if (k.ifade === 'mutlu') {
    c.beginPath(); c.moveTo(42, 46); c.quadraticCurveTo(50, 53, 58, 46); c.stroke();
  } else if (k.ifade === 'konusuyor') {
    const h = 2.5 + 6 * k.agiz;
    c.fillStyle = CAMGOBEGI;
    c.beginPath(); c.roundRect(50 - 5.5, 48 - h / 2, 11, h, 4); c.fill();
  } else {
    c.beginPath(); c.moveTo(46, 49); c.quadraticCurveTo(51, 47, 56, 48.5); c.stroke();
  }
}

function bas(c: CanvasRenderingContext2D, k: KodiKare) {
  // Anten ve ışığı.
  c.strokeStyle = MOR_KOYU; c.lineWidth = 3; c.lineCap = 'round';
  cizgi(c, 50, 19, 50, 8);
  const isik = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(k.t * PI2 * 2));
  c.globalAlpha = isik * 0.45; daire(c, 50, 6, 8, PEMBE); c.globalAlpha = 1;
  daire(c, 50, 6, 4.8, PEMBE);
  // Kulaklar.
  daire(c, 17, 40, 6.5, MOR_KOYU);
  daire(c, 83, 40, 6.5, MOR_KOYU);
  // Kafa.
  const g = c.createLinearGradient(18, 17, 82, 62);
  g.addColorStop(0, '#9B7BFF'); g.addColorStop(1, MOR_KOYU);
  c.fillStyle = g;
  yuvarlakDortgen(c, 18, 17, 82, 62, 17); c.fill();
  // Yüz ekranı.
  c.fillStyle = EKRAN;
  yuvarlakDortgen(c, 25, 24, 75, 55, 12); c.fill();
  // Yanaklar.
  daire(c, 31, 47, 3.4, 'rgba(244,114,182,0.75)');
  daire(c, 69, 47, 3.4, 'rgba(244,114,182,0.75)');
  gozler(c, k);
  agiz(c, k);
}

/** Düşünme pozu: sağ elin dirseği sol elde, sağ el çenede. */
function dusunmeKollari(c: CanvasRenderingContext2D, k: KodiKare) {
  const vurus = Math.max(0, Math.sin(k.t * PI2 * 3)) * 1.6;
  const sagOmuz = [74, 75], dirsek = [63, 95], cene = [56.5, 63.5 - vurus];
  const solOmuz = [26, 75], solDirsek = [31, 96], tutan = [61, 99];
  kolKalemi(c, MOR_KOYU, 8.5);
  for (const [a, b] of [[sagOmuz, dirsek], [dirsek, cene], [solOmuz, solDirsek], [solDirsek, tutan]]) cizgi(c, a[0], a[1], b[0], b[1]);
  kolKalemi(c);
  cizgi(c, sagOmuz[0], sagOmuz[1], dirsek[0], dirsek[1]);
  cizgi(c, solOmuz[0], solOmuz[1], solDirsek[0], solDirsek[1]);
  cizgi(c, solDirsek[0], solDirsek[1], tutan[0], tutan[1]);
  daire(c, tutan[0], tutan[1], 5.5, PEMBE);
  kolKalemi(c);
  cizgi(c, dirsek[0], dirsek[1], cene[0], cene[1]);
  daire(c, cene[0], cene[1], 5.5, PEMBE);
}

function dusunceBaloncuklari(c: CanvasRenderingContext2D, k: KodiKare) {
  const merkezler = [[86, 20], [92, 11], [97, 2]];
  const yaricap = [2.4, 3.4, 4.4];
  for (let i = 0; i < 3; i++) {
    const faz = (((k.t * 2 - i * 0.22) % 1) + 1) % 1;
    const a = faz < 0.6 ? faz / 0.6 : 1 - (faz - 0.6) / 0.4;
    c.globalAlpha = 0.25 + 0.6 * a;
    daire(c, merkezler[i][0], merkezler[i][1], yaricap[i], CAMGOBEGI);
  }
  c.globalAlpha = 1;
}

/** Kodi'yi verilen boyuttaki tuvale çizer (en-boy oranı korunur). */
export function kodiCiz(c: CanvasRenderingContext2D, w: number, h: number, k: KodiKare) {
  c.clearRect(0, 0, w, h);
  c.save();
  const s = Math.min(w / 100, h / 130);
  c.translate((w - 100 * s) / 2, (h - 130 * s) / 2);
  c.scale(s, s);
  const sal = Math.sin(k.t * PI2) * 2.2;
  // Gölge (salınmayla küçülüp büyür).
  elips(c, 50, 125, 46 - sal, 7, 'rgba(0,0,0,0.22)');
  c.save();
  c.translate(0, sal);
  govde(c, k);
  bas(c, k);
  if (k.ifade === 'dusunceli') dusunmeKollari(c, k);
  c.restore();
  if (k.ifade === 'dusunceli') dusunceBaloncuklari(c, k);
  c.restore();
}
