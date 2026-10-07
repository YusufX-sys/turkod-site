---
title: Sözdizimi Davranışları
description: Sözlükte yer almayan, çeviricinin bağlama göre uyguladığı özel kurallar.
---

Bu kurallar `TurKod_Sozluk.txt`'te yer almaz; `converter.py` içindeki özel işleme mantığından kaynaklanır.

## döngü / için

`döngü` ve `için` kelimeleri devamındaki yapıya göre farklı Python koduna dönüşür.

**for gibi davranır:**

```
için i aralık(3):
    yazdır(i)
```

Çıktı:

```
0
1
2
```

**while gibi davranır:**

```
sayac = 0
döngü sayac < 3:
    yazdır(sayac)
    sayac = sayac + 1
```

Çıktı:

```
0
1
2
```

**liste üzerinde for:**

```
meyveler = ["elma", "armut"]
için m içinde meyveler:
    yazdır(m)
```

Çıktı:

```
elma
armut
```

## ise

`ise` bir karşılaştırma operatörü gibi davranır.

```
yas = 18
eğer yas 18 ise:
    yazdır("Reşit")
```

Çıktı:

```
Reşit
```

Bu, arka planda şuna dönüşür: `eğer yas == 18:`

Tek değişkenli kullanım:

```
hazir = Doğru
eğer hazir ise:
    yazdır("Başlıyoruz")
```

Çıktı:

```
Başlıyoruz
```

:::caution[Dikkat]
Tek değişkenli `ise`, `== Doğru` karşılaştırmasına dönüşür (`eğer hazir == Doğru:`). Bu yüzden yalnızca `Doğru`/`Yanlış` değerli değişkenlerle kullan: `sayi = 5` iken `eğer sayi ise:` koşulu **sağlanmaz**.
:::

Olumsuz kullanım da vardır: `eğer hazir değil ise:` satırı `if not hazir:` olur.

:::caution[Metinle ve ifadelerle ise]
`A B ise:` biçiminde **B yalnızca bir isim ya da pozitif bir sayı** olabilir. `eğer renk "mavi" ise:` veya `eğer yas >= 18 ise:` sözdizimi hatası verir. Metinle karşılaştırırken `ise`'yi araya yaz:

```
renk_secimi = "mavi"
eğer renk_secimi ise "mavi":
    yazdır("Mavi seçildi")
```

Emin değilsen `==` kullan; her durumda çalışır.
:::

## Rezerve kelimeler

Sözlükte karşılığı olan bir kelimeyi (`kalan`, `bul`, `durum`, `toplam` vb.) değişken adı olarak kullanabilirsin. Ancak bir kelimeye dosyanın herhangi bir yerinde değer atadığında, o dosyanın tamamında artık komut anlamı kalmaz. Örneğin `toplam = 0` yazdıktan sonra `toplam(liste)` artık `sum` olarak çevrilmez.

```
kalan = 7 % 3
yazdır(kalan)
```

Çıktı:

```
1
```

:::caution[Yerleşik fonksiyon adlarını değişken yapma]
`liste`, `metin`, `sözlük`, `küme`, `toplam`, `uzunluk` gibi kelimeleri değişken ya da parametre adı yaparsan o kelime dosyanın **her yerinde** komut olmaktan çıkar. Örneğin bir fonksiyonun parametresine `metin` dersen, başka bir yerdeki `metin(5)` çağrısı çalışmaz. `metin_degeri`, `sayilar` gibi adlar seç.
:::

## Adlı değerler ve özellikler

Fonksiyona `ad=değer` biçiminde verdiğin ya da `nesne.ad` biçiminde yazdığın kelimelerin **sözlükte karşılığı varsa** İngilizceye çevrilir:

```
bilgi = sözlük(renk="mavi")
yazdır(bilgi)
```

Çıktı:

```
{'color': 'mavi'}
```

Kendi fonksiyonunun parametre adları ve `kendisi.renk` gibi sınıf özellikleri korunur. Sözlük anahtarlarını her zaman tırnakla yaz: `{"renk": "mavi"}`.

## Eş anlamlı kelimeler

Bazı işlerin birden çok yazımı vardır; hepsi aynı Python koduna dönüşür:

| Önerilen | Diğer yazım | Python |
| -------- | ----------- | ------ |
| `için x içinde` | `döngü x içinde` | for x in |
| `en_büyük` / `en_küçük` | `maksimum` / `minimum` | max / min |
| `biçimle` | `biçimlendir` | format |
| `kendisi`, `başlat_özel` | `self`, `__init__` | self, `__init__` |
| `den matematik içe_aktar karekök` | `içe_aktar karekök den matematik` | from math import sqrt |

Ters sıralama için `sırala(tersine_çevir=Doğru)` yazılır (`reverse=True`). Sıralama ölçütü `key=` İngilizce kalır: `isimler.sırala(key=uzunluk)`.

## Türkçe karşılığı olmayanlar

`match`/`case`, `ord()` ve `AssertionError`, `PermissionError`, `RecursionError` gibi bazı hata adlarının Türkçe karşılığı yoktur; bunları Python'daki gibi İngilizce yaz.

## Bilinmeyen kelime

Sözlükte olmayan bir kelime hata vermeden aynen Python koduna geçer:

```
yazdır(bilinmeyen_kelime_xyz)
```

Çıktı:

```
[HATA]: Tanımsız İsim Hatası
Satır Numarası: 1
Açıklama: 'bilinmeyen_kelime_xyz' adında bir değişken/fonksiyon tanımlı değil!
```

Hata derleme anında değil, çalıştırma anında ortaya çıkar. IDE, Python hatalarını Türkçe olarak gösterir.

## Metinler, yorumlar ve Türkçe karaktersiz yazım

Tırnak içindeki metinler ve `#` ile başlayan yorumlar **asla çevrilmez**: `yazdır("eğer yazdır")` ekrana `eğer yazdır` yazar.

Türkçe karakterli kelimeler Türkçe karakter olmadan da yazılabilir: `eger`, `yazdir`, `degilse`, `gec` sırasıyla `eğer`, `yazdır`, `değilse`, `geç` ile aynıdır.

## Modül içe aktarma

```
içe_aktar matematik olarak m
içe_aktar karekök den matematik
yazdır(m.pi_sayısı, karekök(16))
```

Bu, arka planda şuna dönüşür: `import math as m` ve `from math import sqrt`. Dikkat: `den` kalıbında sıra Python'un tersidir (önce ne alınacağı, sonra modül). Modül adıyla yazılan fonksiyonlar da çevrilir: `matematik.karekök(9)` → `math.sqrt(9)`.

## f-string

f-string içindeki `{ifade}` blokları da TürKod kodu olarak çevrilir:

```
toplam_deger = 5
yazdır(f"Sonuç: {toplam_deger}")
```

Çıktı:

```
Sonuç: 5
```