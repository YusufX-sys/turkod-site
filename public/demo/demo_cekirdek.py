# TürKod Canlı Demo çekirdeği (tarayıcıdaki Python'da, Pyodide ile, bir Web Worker içinde çalışır).
# Programdaki çeviricinin ve çalıştırıcının AYNISI kullanılır: turkod_ide paketi
# (converter, dictionary, runner ...) demo/turkod_ide.zip içinden açılır. Çıktı ve hata
# mesajları programdaki terminalde görünenlerle birebir aynıdır.
#
# girdi_al: Python girdi beklerken tarayıcıyı durduramaz. Bunun yerine girdi gerekince
# program durur (_GirdiBekleniyor), sayfa kullanıcıdan girdiyi alır ve program o ana kadarki
# bütün girdilerle BAŞTAN çalıştırılır; daha önce gösterilen çıktı ikinci kez gösterilmez.
# Rastgele sayılar her çalıştırmada aynı tohumla başlar, böylece tekrar aynı sonucu verir.
import builtins
import io
import os
import re
import sys
import tempfile

from turkod_ide.converter import turkce_kodu_donustur
from turkod_ide.runner import runner_kodu_uret

_KLASOR = os.path.join(tempfile.gettempdir(), "turkod_demo")
os.makedirs(_KLASOR, exist_ok=True)

# Tarayıcıda çalışmayan kütüphaneler (pencere, oyun, ağ, alt süreç).
_DESTEKLENMEYEN = [
    (r"turtle|kaplumba[gğ]a", "kaplumbağa"),
    (r"tkinter|pencere", "pencere (tkinter)"),
    (r"pygame|py_oyun", "py_oyun (pygame)"),
    (r"ursina", "ursina"),
    (r"socket|soket", "soket"),
    (r"subprocess|alt_s[uü]re[cç]", "alt süreç"),
]
_ICE_AKTAR = re.compile(r"^\s*(?:içe_aktar|ice_aktar|import|kaynak|from)\s+([\w.]+)", re.M)


class _GirdiBekleniyor(BaseException):
    """Program yeni bir girdi istedi (çalıştırıcının 'except Exception'ına takılmaz)."""

    def __init__(self, istem):
        super().__init__(istem)
        self.istem = istem


class _Cikti(io.TextIOBase):
    """print() çıktısını parça parça sayfaya iletir."""

    def __init__(self, yaz):
        self._yaz = yaz

    def writable(self):
        return True

    def write(self, s):
        if s:
            self._yaz(str(s))
        return len(s)


def desteklenmeyen(kod):
    """Kod tarayıcıda çalışmayan bir kütüphane kullanıyorsa onun Türkçe adı."""
    for m in _ICE_AKTAR.finditer(kod):
        for desen, ad in _DESTEKLENMEYEN:
            if re.fullmatch(rf"(?:{desen})(?:\..*)?", m.group(1), re.I):
                return ad
    return None


def calistir(kod, yaz, girdiler, tohum):
    """TürKod kodunu çevirip çalıştırır.

    yaz(metin): çıktı; girdiler: şimdiye kadar verilen girdi_al cevapları; tohum: rastgele tohumu.
    Dönüş: {"durum": "bitti", "kod": çıkış kodu} ya da {"durum": "girdi", "istem": ...}.
    """
    ad = desteklenmeyen(kod)
    if ad:
        yaz(f"Bu demo tarayıcıda çalışır; '{ad}' kütüphanesi yalnızca TürKod programında çalışır.\n"
            "Programı indirip orada deneyebilirsin.\n")
        return {"durum": "bitti", "kod": 1}

    kod_yolu = os.path.join(_KLASOR, "turkce_kod_calisma.py")
    try:
        python_kodu = turkce_kodu_donustur(kod)
    except Exception as e:
        yaz(f"[HATA]: Kod çevrilemedi: {e}\n")
        return {"durum": "bitti", "kod": 1}
    with open(kod_yolu, "w", encoding="utf-8") as f:
        f.write(python_kodu)
    calistirici = runner_kodu_uret(kod_yolu, kaynak_kod=kod)

    kuyruk = list(girdiler or [])

    def _input(istem=""):
        istem = "" if istem is None else str(istem)
        if istem:
            yaz(istem)
        if not kuyruk:
            raise _GirdiBekleniyor(istem)
        cevap = str(kuyruk.pop(0))
        yaz(cevap + "\n")
        return cevap

    import random
    random.seed(tohum)
    eski = (sys.stdout, sys.stderr, builtins.input, os.getcwd(), sys.modules.get("__main__"))
    sys.stdout = sys.stderr = _Cikti(yaz)
    builtins.input = _input
    os.chdir(_KLASOR)
    try:
        exec(compile(calistirici, "runner.py", "exec"), {"__name__": "__main__", "__builtins__": builtins})
        return {"durum": "bitti", "kod": 0}
    except _GirdiBekleniyor as g:
        return {"durum": "girdi", "istem": g.istem}
    except SystemExit as e:
        return {"durum": "bitti", "kod": e.code if isinstance(e.code, int) else (0 if e.code is None else 1)}
    except BaseException as e:  # çalıştırıcının yakalamadığı (beklenmeyen) durum
        yaz(f"\n[HATA]: {type(e).__name__}: {e}\n")
        return {"durum": "bitti", "kod": 1}
    finally:
        sys.stdout, sys.stderr, builtins.input = eski[0], eski[1], eski[2]
        os.chdir(eski[3])
        if eski[4] is not None:
            sys.modules["__main__"] = eski[4]
