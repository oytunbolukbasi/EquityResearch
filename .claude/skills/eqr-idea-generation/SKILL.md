---
name: eqr-idea-generation
description: EQR paneli için yeni pozisyon fikri taraması — BİST / NYSE / NASDAQ / XETRA'da aday üretir, temel ve teknik çalışmayla eler, panelin risk-getiri barını geçenleri JSON olarak verir. "fikir tara", "yeni fikir", "idea generation", "screen", "ne ilginç görünüyor", "bir şey öner" taleplerinde kullan.
---

# Fikir Taraması (EQR)

> **`eqr-` ön eki neden var:** ortamda `equity-research` eklentisinin `idea-generation`
> ve `morning-note` skill'leri de kurulu ve ad çakışmasında **eklenti kazanıyor** —
> 2026-09-06'da ölçüldü, çıplak adla çağrı eklentinin jenerik İngilizce sürümünü
> yükledi ve bu dosya gölgede kaldı. Ön eki kaldırma.

**Tarama aday üretir, sonuç üretmez.** Havuzdan çıkan her isim için temel çalışma
şart; ekrandan geçmiş olmak fikir olmaya yetmez.

## Kapsam

Yalnız dört borsa: **BİST · NYSE · NASDAQ · XETRA (Frankfurt)**. Başkasını önerme.

**Kripto kapsam dışı.** Panelde varlık sınıfı olarak var ama fikir veya trade planı
üretilmez; fiyatını panel kendi kaynağından çekiyor.

**ABD kapalıyken taramayı Frankfurt öncelikli yap** (tatil/hafta sonu). O günlerde
açık olan tek gelişmiş piyasa çoğu zaman orasıdır ve portföyde EUR pozisyonları var.

## Adım 1 — Aday havuzu

Günün makro tablosuna uyan stili seç, körlemesine hepsini tarama:

| Stil | Ne aranır |
|---|---|
| **Değer** | Sektör medyanının altında F/K · tarihsel ortalamanın altında EV/FAVÖK · %5+ serbest nakit akışı verimi · içeriden alım |
| **Büyüme** | Ciro >%15 YoY ve hızlanıyor · kâr >%20 YoY · marj genişliyor · yatırılan sermaye getirisi >%15 |
| **Kalite** | 5+ yıl istikrarlı ciro · sabit/genişleyen marj · özsermaye kârlılığı >%15 · düşük borç · yüksek nakde çevirme |
| **Özel durum** | Bölünme · yeniden yapılanma çıkışı · aktivist yatırımcı · zayıf performansta yönetim değişikliği |

**Tematik tarama** yapıyorsan: tezi tanımla → değer zincirini çıkar → doğrudan mı
dolaylı mı faydalanıyor ayır → fiyata çoktan girmiş olanı ele → piyasanın temayla
henüz bağlamadığı ikinci halka isimleri ara.

En iyi fikirler kesişimde çıkar: geçici bir rüzgâr yüzünden ucuzlamış kaliteli şirket.

## Adım 2 — Metrikleri borsaya göre uyarla

Yukarıdaki eşikler ABD şablonudur. Körü körüne uygulama:

- **BİST** — bankada **P/DD + özsermaye kârlılığı**, sanayide **F/K + FAVÖK marjı**.
  Analist hedefi ve tavsiyesi çoğu zaman boş döner; **sayı uydurma**, tezi teknik
  yapı ve makro tema üzerinden kur.
- **XETRA** — ABD şablonu genelde çalışır, ama analist kapsamı daha ince olabilir.
  Veri yoksa yine uydurma; temel + teknik yapıya dayan.
- **Fiyatlar kendi para biriminde** verilir: BİST ₺, ABD $, Frankfurt €. Çevirme.

## Adım 3 — Veri

`yfinance` birincil kaynak. Sembol biçimi: BİST `TICKER.IS` · ABD çıplak ·
Almanya `TICKER.DE`. Uzantı yalnız sorgu içindir, panele **çıplak ticker** gider.

Fallback sırası ve deneme bütçesi talimatnamede (`cowork-instructions-final.md`,
"VERİ KAYNAKLARI VE BAŞARISIZLIK KURALI"). Bulamadığın veriyi uydurma; atla ve logla.

## Adım 4 — Eleme

**Her gün gerçek tarama yap.** "Uygun aday yoktu" tam tarama yapmadan kullanılan
bir kaçış değildir.

Sonucu ikiye ayır:

**1. Panele giren fikirler.** Yalnız şu barı geçen long'lar:

```
(TP1 − giriş_ortası) / (giriş_ortası − stopLoss) >= 2.0
```

Geçemeyen panele **eklenmez**. Barı geçen fikir çıkmadığı günler olur ve bu
normaldir — özellikle risk iştahının kapalı olduğu günlerde. Zorla fikir üretme,
`ideas: []` gönder.

**2. İzleme listesi (panele YAZILMAZ).** Taramadan çıkan en iyi 1-3 adayı, barı
geçmeseler bile rapora yaz: ticker + tek cümle tez + hesaplanan risk-getiri oranı +
neden takıldığı ("oran 1,6 — stop geniş", "katalizör belirsiz"). Böylece sıfır fikir
çıksa bile sahadaki en iyi kurgular görünür.

## Adım 5 — Eleme tablosu (zorunlu)

Sadece seçilen fikri sunmak yetmez. Hangi isimlere bakıldığı ve neden elendiği
her taramada tablo olarak verilir:

| Aday | Fiyat | Analist ortalaması | Yükseliş payı | Sonuç / eleme gerekçesi |
|---|---|---|---|---|

Bu, taramanın gerçekten yapıldığının tek kanıtı. Sıfır fikir çıkan günlerde de sunulur.

## Adım 6 — Çıktı

Panelin JSON biçimi (tam şema talimatnamede, ADIM 4):

- `ideas[]` → `date · ticker · exchange · direction · thesis · entryLow · entryHigh ·
  stopLoss · target1 · target2 · target3 · status`
- Yeni fikir için ayrıca **tam trade_plan**: `ticker · exchange · currentPrice ·
  entryLow · entryHigh · tp1 · tp2 · tp3 · hardSl · thesis · invalidation · status`
  \+ `priceHistory` (son 60 günlük gerçek OHLC).

`thesis` ve `invalidation` sade Türkçe yazılır — kurallar talimatnamedeki
"Yazım tonu" bölümünde, oradaki jargon tablosu bu alanlar için de geçerli.

**`invalidation` gerçek olsun.** Tezin nerede biteceğini yazmıyorsan fikir yarım:
hangi seviyede yanılmış sayılırsın ve hangi temel kalem bozulursa tez zayıflar.

## Uyarılar

- **Kalabalık işlemden kaç** — sahiplik verisi, açığa satış oranı, kaç analistin
  takip ettiği.
- **Ters köşe fikir katalizör ister.** Katalizörsüz erken olmak, yanılmakla aynı şey.
- **Tarama isabet oranını takip et** — hangi yaklaşımın işe yaradığını zamanla izle.
- Panelin fikirleri kullanıcının portföyü DEĞİLDİR; ikisini karıştırma.
