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

## Rezerve kelimeler

Sözlükte karşılığı olan bir kelimeyi (`kalan`, `bul`, `durum`, `toplam` vb.) atama hedefi olarak kullanmak güvenlidir:

```
kalan = 7 % 3
yazdır(kalan)
```

Çıktı:

```
1
```

Güvenli olmayan kullanım: aynı kelimeyi korunmayan bir kalıpta (örn. liste/sözlük üreteci içinde) kullanmak beklenmedik çeviriye yol açabilir; bu tür kalıplardan kaçının.

## Bilinmeyen kelime

Sözlükte olmayan bir kelime hata vermeden aynen Python koduna geçer:

```
yazdır(bilinmeyen_kelime_xyz)
```

Çıktı:

```
NameError: name 'bilinmeyen_kelime_xyz' is not defined
```

Hata derleme anında değil, çalıştırma anında ortaya çıkar.

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