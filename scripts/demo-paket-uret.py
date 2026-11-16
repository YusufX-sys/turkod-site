"""Canlı Demo için TürKod çeviricisini paketler: public/demo/turkod_ide.zip

Demo, tarayıcıda çalışan Python (Pyodide) ile programın GERÇEK çeviricisini ve
çalıştırıcısını kullanır; böylece dil eksiksiz desteklenir, hatalar programdaki
gibi Türkçe çıkar. TürKod'un çeviricisi/sözlüğü değişince bu betik yeniden çalıştırılır:

    python scripts/demo-paket-uret.py "C:\\...\\TurKod-v3.3.0"
"""
import io
import os
import sys
import zipfile

# Çevirici + sözlükler + çalıştırıcı: yalnızca Python'un standart kütüphanesini kullanır.
DOSYALAR = ["converter.py", "dictionary.py", "deger_sozlugu.py", "modul_sozlugu.py", "tokenizer.py",
            "runner.py", "paths.py", "TurKod_Sozluk.txt"]

if len(sys.argv) != 2:
    sys.exit(__doc__)
kaynak = os.path.join(os.path.abspath(sys.argv[1]), "turkod_ide")
hedef = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "demo", "turkod_ide.zip")
os.makedirs(os.path.dirname(hedef), exist_ok=True)

surum = "?"
try:
    surum = open(os.path.join(sys.argv[1], "surum.txt"), encoding="utf-8").read().strip()
except OSError:
    pass

with zipfile.ZipFile(hedef, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    # Paketin kendi __init__'i sunucu/arayüz modüllerini yüklemesin: boş tutulur.
    z.writestr("turkod_ide/__init__.py", f'"""TürKod {surum} çeviricisi (Canlı Demo paketi)."""\n')
    for ad in DOSYALAR:
        z.write(os.path.join(kaynak, ad), f"turkod_ide/{ad}")
print(f"{hedef}  ({os.path.getsize(hedef) // 1024} KB, TürKod {surum})")
