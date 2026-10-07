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

Güvenli olmayan kullanım: aynı kelimeyi korunmayan bir kalıpta (örn. liste/sözlük üreteci içinde) kullanmak beklenmedik çeviriye yol açabilir; bu tür kalıplardan kaçının.

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