---
name: eqr-morning-note
description: EQR panelinin Piyasa Nabzı bültenini yazar — ana görüş, makro maddeleri, ayrı Avrupa/Almanya bölümü ve sektör odağı, sade Türkçe. "morning note", "piyasa nabzı", "bülten yaz", "günlük not", "panel içeriği üret" taleplerinde kullan.
---

# Piyasa Nabzı Bülteni (EQR)

> **`eqr-` ön eki neden var:** ortamda `equity-research` eklentisinin `idea-generation`
> ve `morning-note` skill'leri de kurulu ve ad çakışmasında **eklenti kazanıyor** —
> 2026-09-06'da ölçüldü, çıplak adla çağrı eklentinin jenerik İngilizce sürümünü
> yükledi ve bu dosya gölgede kaldı. Ön eki kaldırma.

Panel kişisel bir takip aracı, analist raporu değil. Sabah açıldığında bir dakikada
okunup "bugün ne var" sorusuna cevap vermeli.

## Bölümler

| Alan | Ne yazılır |
|---|---|
| `topCall` | **Tek cümle**, cesur, hedge'siz. Günün tek gerçek konusunu söyler. |
| `macroBullets` | Genel makro: Fed/enflasyon, jeopolitik, portföyü etkileyen şirket/sektör haberleri, TCMB/TL. |
| `europeBullets` | **Ayrı bölüm** — ECB, Alman sanayi verileri (IFO/ZEW/PMI/fabrika siparişleri), DAX, EUR kuru, Alman pozisyonlarını etkileyen şirket haberleri. |
| `sectorDeepDive` | `title` + 2-3 cümle `body`. Büyük resim; günün konusunu bir adım geriden anlatır. |

Her madde `{label, detail}`. `label` başlıktır — tarayarak okunur, cümle değil.
`detail` o başlığın altındaki gövde.

### Avrupa bölümü neden ayrı

Portföyde EUR bazlı pozisyonlar var ve değerleri iki şeye bağlı: hissenin kendi
hikâyesi ve EUR/TRY. İkisini genel makro maddelerinin arasına serpiştirmek,
Almanya tarafına bakmak isteyen okuyucuyu her sabah metin taramaya zorluyordu.

**Boşsa boş bırak.** O gün Avrupa'da kayda değer bir şey yoksa `europeBullets: []`
gönder — bölüm panelde hiç çizilmez. Yer doldurmak için haber uydurma.

### Piyasalar kapalıyken

Hafta sonu veya tatilde çalışıyorsan `topCall` sonuna ya da ilk maddeye kısa bir not
ekle: *"(Veriler 4 Eylül Cuma kapanışına aittir.)"*

## Yazım tonu — sade Türkçe zorunlu

Tam jargon tablosu talimatnamede (`panel-icerik-talimatnamesi.md` → ADIM 4 →
"Yazım tonu"). Tek kopya orada duruyor; buraya çoğaltılmadı. Özet kural:

- **İngilizce finans jargonu yasak.** "upside" değil yükseliş payı, "re-rating" değil
  yeniden değerlenme, "R:R" değil risk-getiri oranı. Teknik terim zorunluysa parantezle açıkla.
- **Veri değil yorum.** Rakamı ver, sonra "bunu şöyle okumak lazım" diye bağla.
  Düşünen bir insan gibi yaz, robot analist gibi değil.
- **Kısa cümle, somut konuş.** "Şu an 47,69 euroda, hedefim 52,40."
- Teknik analizde "destek/direnç" yeter; Fibonacci, RSI sapması gibi derinliğe girme.

## Veri disiplini

**Doğrulayamadığın rakamı yazma.** Kaynaklar bir veri üzerinde çelişiyorsa
(aynı istihdam verisi için 162 bin ve 22 bin gibi), sayıyı seçip yazma — bunun
yerine **piyasanın ölçülebilir tepkisini** anlat: tahvil faizi nereye gitti,
endeks nereden açıp nerede kapandı. Tepki ölçülebilir, haber yorumu değil.

Fiyat ve seviye rakamları her zaman gerçek kaynaktan gelir (`yfinance` birincil).
Bulamadığın veriyi atla ve logla.

## Çıktı

Panelin JSON biçimi — tam şema talimatnamede (ADIM 4):

```json
"morning_note": {
  "date": "YYYY-AA-GG",
  "topCall": "...",
  "macroBullets": [{"label": "...", "detail": "..."}],
  "europeBullets": [{"label": "...", "detail": "..."}],
  "sectorDeepDive": {"title": "...", "body": "..."}
}
```

Aynı yazım kuralları `ideas.thesis`, `ideas.invalidation` ve `portfolio_insight`
için de geçerlidir.
