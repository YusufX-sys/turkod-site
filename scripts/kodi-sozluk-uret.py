"""Sitedeki Kodi için sözlük verisini üretir: public/kodi-sozluk.json

TürKod kaynak kodundaki sözlükten her kelimenin Python karşılığını ve (varsa)
programın editörde gösterdiği çocuk dostu Türkçe açıklamasını alır.

Kullanım (sitenin kök klasöründen):
    python scripts/kodi-sozluk-uret.py "C:\\...\\TurKod-v3.3.0"

TürKod sözlüğü değiştiğinde yeniden çalıştır.
"""
import contextlib
import io
import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit(__doc__)

kaynak = Path(sys.argv[1]).resolve()
if not (kaynak / "turkod_ide" / "dictionary.py").is_file():
    sys.exit(f"TürKod kaynak klasörü bulunamadı: {kaynak}")
sys.path.insert(0, str(kaynak))

with contextlib.redirect_stdout(io.StringIO()):
    from turkod_ide.dictionary import TERS_SOZLUK
    from turkod_ide.ide_core import IDECore
    cekirdek = IDECore()

kayitlar = {}
for py, tr in TERS_SOZLUK.items():
    if not isinstance(py, str) or not isinstance(tr, str) or not py or not tr:
        continue
    if tr in kayitlar:
        continue
    aciklama = cekirdek.kelime_aciklamasi(tr, "").get("aciklama") or ""
    # Bazı kelimelerde açıklama İngilizce Python belgesinden gelir; Kodi bunu söylemez.
    if aciklama.startswith("Python belgesi"):
        aciklama = ""
    kayitlar[tr] = [tr, py, aciklama]

veri = {"surum": 1, "k": sorted(kayitlar.values(), key=lambda k: k[0].casefold())}
hedef = Path(__file__).resolve().parents[1] / "public" / "kodi-sozluk.json"
hedef.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
acikli = sum(1 for k in veri["k"] if k[2])
print(f"{len(veri['k'])} kelime ({acikli} açıklamalı) -> {hedef}")
