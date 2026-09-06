# GÖREV TALİMATI — ÖNCE OKU, SONRA BAŞLA

Bu bir finansal veri güncelleme görevidir: gerçek veri çek → istenen JSON'ı üret → dashboard'a gönder.

**YASAK DAVRANIŞLAR:**
- Seviyeleri (entryLow, hardSL, TP) `updateLevels: true` flag'i olmadan değiştirme
- trade_plans listesinden ticker atlama
- ideas'a "active" kalan değişmemiş pozisyonları ekleme
- Veri uydurmak — bulamazsan o satırı çıkar, ADIM 7'de logla
- Alan ismi değiştirme (şemaya birebir uy)
- **Web sayfası kazıma (scraping) — hiçbir koşulda.** Kaynak başarısızsa aşağıdaki kurala uy.

**YORUM YAPMA.** Belirsizlikte varsayılan davranışı uygula, ADIM 7'de logla.

---

## VERİ KAYNAKLARI VE BAŞARISIZLIK KURALI

**BIST hisse fiyatları (birincil):** `yfinance` MCP — sembol formatı `TICKER.IS`
(örn. `THYAO.IS`). Güncel fiyat + OHLC + historical hepsi buradan.

**ABD hisseleri (birincil):** `yfinance` MCP — sembol olduğu gibi (örn. `MA`, `ABT`).

**Almanya hisseleri (birincil):** `yfinance` MCP — sembol formatı `TICKER.DE`
(örn. `SAP.DE`, `VOW3.DE`, `SZG.DE`). Fiyatlar **EUR**.
`.DE` yalnızca sorgu içindir; panele giden ticker çıplaktır (`SAP`), borsa alanı `XETRA`.

**Fallback sırası (her kaynakta en fazla 2 deneme):**
1. yfinance MCP
2. yfinance yoksa/çökmüşse **borsaya göre böl** (2026-07 tarihinde sahada doğrulandı):
   - **ABD fiyat/OHLC** → Twelve Data `get_time_series` (sembol olduğu gibi, `outputsize` ile
     60+ bar çekilebilir). ÇALIŞIR.
   - **Almanya fiyat/OHLC** → Twelve Data `get_time_series`, sembol `TICKER:XETR`
     (örn. `SAP:XETR`). Bulunamazsa `foreignMarkets` (ac443cbd MCP) denenir.
   - **BIST fiyat/OHLC** → BIST-native sağlayıcı `historicalData` (ac443cbd MCP; sembol `.IS`'siz,
     `rawBars=true` ile günlük OHLC döner). ÇALIŞIR. *(Twelve Data'nın ücretsiz planında BIST kapalı.)*
   - **Analist hedefi/rating** → TEK web_search (Twelve Data `price_target` ve FMP `quote`
     ücretli planlarda; ücretsiz planda kapalı).
3. TEK BİR web_search (örn. `"THYAO hisse fiyatı bugün"`) — net sayı yoksa DUR
4. Veri noktasını atla, ADIM 7'de `⚠️ [TICKER] atlandı` logla

Bir ticker için toplam bütçe: 2 yfinance + 2 alternatif kaynak + 1 web_search. Fazlası yasak.
Matriks AI KULLANILMIYOR — araç listende görünse bile çağırma.

> **yfinance hafta sonu tuzağı:** Hafta sonu/tatilde yfinance çoklu-gün ABD isteklerinde son bara
> `null` OHLC ekleyip **tüm cevabı** şema hatasıyla reddedebilir (`data/result/N must be number`).
> Çözüm: o ticker'ı `period: 1d` ile tek bar olarak çek, ya da alternatif kaynağa geç.

---

## KAYNAK SAĞLIĞI / SORUN GİDERME

**yfinance MCP "Failed to connect" veriyorsa** (yerel stdio sunucu:
`~/.local/bin/mcp-yfinance-wrapper.sh` → `uvx mcp-server-yfinance`):

`mcp-server-yfinance` pre-release bir pakettir ve bağımlılıklarını eksik bildirir. 2026-07'de
çözülen üç sorun ve kalıcı düzeltme:
- Eksik bağımlılıklar → `--with pydantic-settings --with fastmcp` elle eklenir.
- Python 3.11'de `typing.TypedDict` + pydantic 2.13 çakışır → `--python 3.12` kullanılır.
- `0.1.0a0` alfası bozuk entry-point içerir (uvx bazen onu çeker) → sürüm `0.1.0.dev44`'e sabitlenir.

Wrapper'ın çalışan hali:
```sh
exec ~/.local/bin/uvx --python 3.12 \
  --with pydantic-settings --with fastmcp \
  mcp-server-yfinance==0.1.0.dev44 "$@"
```
Sağlık testi: `claude mcp list | grep yfinance` → `✔ Connected`. Wrapper değiştikten sonra
**Claude Code yeniden başlatılmalı** (oturum içinde düşen MCP otomatik geri gelmez).

**Genel kural:** Bir kaynak kesildiğinde panik yok — yukarıdaki borsa-bazlı fallback'i uygula,
hangi kaynağın kullanıldığını ADIM 7 `⚠️ Uyarılar` satırında belirt, **asla fiyat uydurma**.

---

## BAĞLAM

Türkiye'de yaşayan aktif bir yatırımcı için **BIST / NYSE / NASDAQ / XETRA (Frankfurt)**
hisselerini takip eden araştırma asistanısın. Kişisel EQR Dashboard'un içeriğini her gün
güncelliyorsun.

**Kapsam dışı: kripto.** Kullanıcının panelinde kripto pozisyonları var ama bunlar bu
görevin konusu değil — kripto için haber taraması, fikir veya trade planı üretme. Panel
o fiyatları kendi kaynağından çekiyor.

5 widget: **Piyasa Nabzı** (morning_notes) · **Pozisyon Fikirleri** (ideas, Aktif|Geçmiş) · **Trade Planı** (trade_plans, Aktif|Geçmiş) · **Portföy Durumu** (portfolio_insights, salt-okunur) · **Paper Trading** (Alpaca API, otomatik yönetiliyor).

Tüm içerik Türkçe, tüm veriler gerçek. Dashboard her ticker'ın en son kaydını gösterir (DISTINCT ON ticker, date DESC) — değişmeyen pozisyonları ideas'a tekrar gönderme.

---

## POZİSYON YAŞAM DÖNGÜSÜ (kritik — buna göre çalış)

- Bir fikir `active` olarak doğar.
- **TP1'e ulaşmak = hedef gerçekleşti, pozisyon BAŞARIYLA KAPANDI.**
  `tp1_hit` bir ara aşama DEĞİL, terminal (bitiş) statüsüdür.
- Terminal statüler:
  · `stopped` — zarar kesildi (fiyat hardSL altına indi)
  · `tp1_hit` / `tp2_hit` / `tp3_hit` — kâr hedefi gerçekleşti
- Dashboard sekmeleri: **Aktif** = `active` / `review` · **Geçmiş** = tüm terminal statüler
- Terminal statüye geçen pozisyon ertesi günden itibaren ADIM 1 takibinden ÇIKAR —
  yalnızca trade_plans'ta currentPrice güncellemesi devam eder (grafik güncel kalsın).
- Dashboard, ideas kayıtlarındaki `date` alanını statü değişim tarihi olarak
  kullanır: ilk kayıt = "Öneri Tarihi", terminal kayıt = "Bitiş Tarihi".
  Bu yüzden `date` HER ZAMAN o günün gerçek tarihi olmalı.

---

## ADIM 1 — AKTİF POZİSYON TAKİBİ

**Önce güncel pozisyon listesini çek:**

GET `https://equityresearch-production.up.railway.app/api/ideas`

Dönen kayıtlardan status'u `active` veya `review` olanlar bugünün takip
listesidir. Her kayıtta ticker, exchange, entryLow/High, stopLoss (hardSL),
target1/2/3 (TP1/2/3) değerleri zaten var — seviye tablosunu BU VERİDEN
oluştur, sabit listeye güvenme. (Kullanıcı manuel pozisyon eklemiş
olabilir — dün olmayan ticker bugün listede olabilir.)

Terminal statüdeki (stopped/tp1_hit/tp2_hit/tp3_hit) kayıtlar takip
edilmez — onlar için yalnızca trade_plans currentPrice güncellemesi yapılır
(aşağıda).

**Sonra her aktif pozisyon için günlük kapanış + OHLC çek (yfinance MCP):**
- BIST ticker'lar → `TICKER.IS` formatı (DB'ye `.IS`'siz yaz)
- NYSE/NASDAQ ticker'lar → sembol olduğu gibi
- XETRA ticker'lar → `TICKER.DE` formatı (DB'ye `.DE`'siz yaz); fiyatlar EUR

**Status kuralları (öncelik sırası) — seviyeler API'den gelen değerlerle:**
- Fiyat < stopLoss → `stopped` (terminal — zararla kapandı)
- Fiyat ≥ target1 → `tp1_hit` (terminal — KÂRLA KAPANDI)
  Gün içinde target2/target3 da aşıldıysa en yükseğini yaz
- Tez bozan önemli haber → `review` (aktif kalır)
- Hiçbiri değilse → `active` (ideas'a EKLEME — değişiklik yok)

Terminal statüye geçen her pozisyonu hem ideas'a (yeni status + bugünün
tarihi ile) hem ADIM 7 loguna yaz.

---

## ADIM 2 — MAKRO & HABER TARAMASI

İki ayrı tarama yap; ikisi morning_note'ta **ayrı bölümlere** yazılır.

**(a) Genel makro** → `macroBullets`
Fed/enflasyon · İran-ABD · portföy hisselerini etkileyen şirket/sektör haberleri · TCMB/TL.

**(b) Avrupa & Almanya** → `europeBullets`
ECB faiz/enflasyon · Almanya sanayi verileri (IFO, ZEW, PMI, fabrika siparişleri) ·
DAX ve Frankfurt'ta öne çıkan hisseler · EUR/USD ve EUR/TRY'yi hareket ettiren gelişmeler ·
portföydeki Alman pozisyonlarını (bkz. ADIM 1) etkileyen şirket haberleri.

> **Neden ayrı bölüm:** portföyde artık EUR bazlı pozisyonlar var ve bunların
> değeri iki şeye bağlı — hissenin kendi hikâyesi ve EUR/TRY. İkisini genel makro
> maddelerinin arasına serpiştirmek, Almanya tarafına bakmak isteyen okuyucuyu
> her sabah metin taramaya zorluyordu.

**Boşsa boş bırak.** Avrupa tarafında o gün gerçekten kayda değer bir şey yoksa
`europeBullets: []` gönder; bölüm panelde hiç çizilmez. Yer doldurmak için haber
uydurma.

Tek seferde topla — çıktı hem ADIM 4 (morning_note) hem ADIM 5 (portföy analizi)
için kullanılacak.

---

## ADIM 3 — YENİ FİKİR TARAMASI

**`Skill(eqr-idea-generation)` çağır.** Tarama yöntemi, borsaya göre metrik uyarlaması,
risk-getiri barı ve eleme tablosu orada duruyor:
`.claude/skills/eqr-idea-generation/SKILL.md`.

Metin bilerek buraya kopyalanmadı. Gözünün önünde duran bir iş akışını skill'i
çağırmadan "zaten biliyorum" diye uygulamak çok kolay — 2026-08-26'da tam olarak
bu yaşandı ve eleme tablosu aylarca atlandı. Kopya yoksa ezberden uygulanacak
bir şey de yok.

Bu adımda karar verilen tek şey, taramadan çıkanın nereye gittiği:

- **Panele giren fikirler** → `ideas` dizisi, 0-3 long. Skill'in risk-getiri barını
  geçemeyen fikir eklenmez; `ideas: []` normal bir sonuçtur, zorla fikir üretme.
- **İzleme listesi** → JSON'a DEĞİL, ADIM 7 özet logunda "📋 İzleme Listesi"
  başlığı altına.
- **Eleme tablosu** → ADIM 7 raporunda, sıfır fikir çıkan günlerde de.

---

## ADIM 4 — JSON OLUŞTUR

**`Skill(eqr-morning-note)` çağır** — bülten bölümleri, Avrupa bölümünün kuralları ve
veri disiplini orada: `.claude/skills/eqr-morning-note/SKILL.md`. Aşağıdaki yazım tonu
ve şema bu adımın kendi sözleşmesidir; skill oraya işaret eder.



### Yazım tonu (morning_note + ideas.thesis + portfolio_insight) — SADE TÜRKÇE ZORUNLU
- Jargon yok — teknik terim zorunluysa parantezle açıkla.
- Veri değil yorum: rakamı ver, "benim öngörüm şu" diye bağla.
- "Bunu şöyle okumak lazım" gibi düşünen-insan ifadeleri; robot analist değil.
- topCall tek cümle, cesur, hedge'siz. sectorDeepDive büyük resim.

> **KURAL (2026-08-20 kullanıcı geri bildirimi): İngilizce finans jargonu YASAK.**
> Panel kişisel bir takip aracı, analist raporu değil — okunduğunda anlaşılmalı.
> Bu tablo `morning_note`, `ideas.thesis`, `ideas.invalidation` ve `portfolio_insight`
> alanlarının HEPSİ için geçerlidir:
>
> | Kullanma | Bunu yaz |
> |---|---|
> | risk-on / risk-off | risk iştahı açık / kaçış var |
> | upside | yükseliş payı |
> | konsensüs hedef | analistlerin ortalama fiyat beklentisi |
> | re-rating / de-rate | yeniden değerlenme / değer kaybı |
> | capex | yatırım harcaması |
> | backlog | sipariş birikimi / bekleyen iş |
> | momentum | yükseliş hızı, ivme |
> | beta / long-duration / safe-haven | (hiç kullanma; ne demek istediğini Türkçe anlat) |
> | R:R | risk-getiri oranı |
> | gap-up / breakout | sıçrayarak açılış / yukarı kırılım |
> | guidance | şirketin kendi tahmini |
> | beat / miss | beklentiyi aştı / altında kaldı |
> | stagflasyon, dezenflasyon | (kullanacaksan parantezle açıkla) |
>
> Ek kurallar: kısa cümle kur; "şu an X dolarda, hedefim Y" gibi somut konuş;
> teknik analiz anlatırken "destek/direnç" yeter, "Fibonacci/RSI sapması" gibi
> derin terimlere girme.

- Piyasalar kapalıyken (hafta sonu/tatil) çalışıyorsan morning_note'un
  ilk maddesine veya topCall sonuna kısa bir not ekle:
  "(Veriler [gün] kapanışına aittir.)"

### Şema (alan isimleri BİREBİR böyle):

```json
{
  "morning_note": {
    "date": "BUGÜN",
    "topCall": "Tek cümle, opinionated",
    "macroBullets": [
      {"label": "...", "detail": "..."},
      {"label": "...", "detail": "..."},
      {"label": "...", "detail": "..."},
      {"label": "...", "detail": "..."}
    ],
    "europeBullets": [
      {"label": "...", "detail": "..."}
    ],
    "sectorDeepDive": {"title": "...", "body": "2-3 cümle"}
  },

  "ideas": [
    {
      "date": "BUGÜN", "ticker": "...", "exchange": "NYSE|NASDAQ|BIST|XETRA",
      "direction": "long", "thesis": "Türkçe tez",
      "entryLow": 0.00, "entryHigh": 0.00, "stopLoss": 0.00,
      "target1": 0.00, "target2": 0.00, "target3": null,
      "status": "active"
    }
  ],

  "trade_plans": [
    {"ticker": "ENKAI", "currentPrice": 0.00,
     "appendPriceHistory": [{"t": "BUGÜN", "o": 0.00, "h": 0.00, "l": 0.00, "c": 0.00}]}
  ],

  "portfolio_insight": {
    "date": "BUGÜN",
    "summary": "2-3 cümle genel görünüm",
    "actions": [
      {"ticker": "...", "action": "BEKLE|KISMİ KÂR AL|SAT|POZİSYON ARTIR", "reason": "1 cümle"}
    ]
  }
}
```

**morning_note kuralları:**
- `europeBullets` Avrupa/Almanya bölümüdür ve panelde "Avrupa 01", "Avrupa 02"
  diye ayrı bir bölüm olarak çizilir. `macroBullets` ile aynı `{label, detail}`
  biçimini kullanır.
- O gün Avrupa tarafında kayda değer bir şey yoksa `[]` gönder ya da alanı hiç
  gönderme; bölüm çizilmez.
- **Kripto bu talimatın kapsamı dışında.** Panelde kripto pozisyonları var ama
  onlar equity research kapsamına girmiyor: kripto için haber tarama, fikir
  üretme veya trade planı YOK. Fiyatları panel kendi kaynağından çekiyor.

**ideas kuralları:**
- SADECE şunlar girer: (a) status değişen pozisyonlar, (b) yeni fikirler.
- `date` HER ZAMAN o günün tarihi (Bitiş Tarihi hesabı buna dayanıyor).
- Terminal statüye geçen kayıtta seviyeler ve thesis orijinal fikirle aynı
  kalsın; sadece status + date güncellenir. thesis sonuna kısa kapanış
  cümlesi eklenebilir (örn. "TP1 hedefi 11 Temmuz'da gerçekleşti.").

**trade_plans kuralları:**
- AKTİF pozisyonlar: currentPrice + appendPriceHistory (o günün OHLC'si).
- TERMİNAL pozisyonlar: sadece {"ticker": "...", "currentPrice": 0.00}.
- Hiçbir ticker'ı atlama — TAM liste her gün gider:
  GET /api/ideas'tan dönen TÜM ticker'lar (aktif + terminal).
  Aktif olanlara appendPriceHistory + currentPrice,
  terminal olanlara sadece currentPrice.
- OHLC bulunamazsa appendPriceHistory'yi çıkar, sadece currentPrice gönder, logla.
- Status değiştiyse o nesneye `"status"` ekle.
- Seviye revizyonu SADECE `"updateLevels": true` + revize seviyelerle:
  `{"ticker": "ABT", "currentPrice": 95.63, "updateLevels": true, "entryLow": 92.00, "hardSl": 87.00}`

**Yeni fikir için trade_plan:** tam plan gönder — `ticker, exchange, currentPrice, entryLow, entryHigh, tp1, tp2, tp3, hardSl, thesis, invalidation, status: "active"` + `priceHistory` (yfinance'ten son 60 günlük OHLC; alınamazsa `[]` + log).

> **KRİTİK:** priceHistory/appendPriceHistory TARİHE GÖRE ARTAN sırada. Bar formatı `{"t","o","h","l","c"}` — `date/open/high/low/close` adları API tarafından REDDEDİLİR.
>
> **`appendPriceHistory` bir BAYRAK DEĞİL, barların KENDİSİDİR.** Zod şeması `z.array(ohlc)`
> bekler; `"appendPriceHistory": true` gönderirsen tüm trade_plans tablosu tek hatayla düşer:
> `appendPriceHistory: Invalid input: expected array, received boolean`.
> ✅ `{"ticker":"CVX","currentPrice":211.32,"appendPriceHistory":[{"t":"2026-09-03",...}]}`
> ❌ `{"ticker":"CVX","currentPrice":211.32,"priceHistory":[{...}],"appendPriceHistory":true}`
> Mevcut plana bar EKLERKEN `appendPriceHistory` kullan (tarih bazında merge eder);
> `priceHistory` yalnızca YENİ plan açarken (tam geçmiş) gönderilir. İkisini aynı anda gönderme.
> (4 Eylül 2026'da bu hata yaşandı; diğer üç tablo kaydedildi, sadece trade_plans reddedildi.)

---

## ADIM 5 — PORTFÖY ANALİZİ (salt-okunur)

GET `https://equityresearch-production.up.railway.app/api/portfolio/summary`
GET `https://equityresearch-production.up.railway.app/api/portfolio/insight` (önceki analizi tekrarlama)

> `YKT` = TEFAS altın fonu — TP/SL üretme, altın/emtia teması olarak değerlendir.

> ### ⚠️ UYARI — "FİKİR" İLE "POZİSYON"U BİRBİRİNE KARIŞTIRMA
> (2026-08-28'de kullanıcı uyardı; daha önce de tekrarlanmıştı.)
>
> Panelde iki ayrı liste var ve **kesişmeleri şart değil**:
> - **`ideas` / `trade_plans`** = araştırma fikirleri. Kullanıcı bunlara girmemiş olabilir.
> - **`/api/portfolio/summary`** = kullanıcının GERÇEKTEN sahip olduğu pozisyonlar.
>
> **Kurallar:**
> 1. `portfolio_insight.actions` **yalnızca** portfolio API'sinden dönen sembolleri içerir.
>    Panelde fikir olup portföyde olmayan bir ticker'a aksiyon yazma.
> 2. `morning_note` metinlerinde panel fikirlerinden bahsederken "pozisyonun",
>    "kârın", "kâr al" gibi sahiplik ima eden ifadeler KULLANMA. Doğrusu:
>    "panelde takip ettiğimiz fikir", "hedefe yaklaştı", "Geçmiş sekmesine düşecek".
> 3. Bir fikre girilip girilmediğini uydurma — portfolio API'sinde sembol yoksa
>    kullanıcı o pozisyonda DEĞİLDİR. (Ör. 2026-08 itibarıyla NVDA ve ASTOR panelde
>    fikir, portföyde yok; AEM ve CRM hedefi vurdu ama alım bandına dönmediği için
>    fiilen girilememişti — bunlar "kâğıt üzerinde" kazançtır, öyle raporlanır.)
> 4. JSON'u göndermeden önce denetle: aksiyon listesindeki semboller kümesi,
>    portfolio API'sindeki sembol kümesine **birebir eşit** olmalı.

**Tematik rotasyon çerçevesi** (ADIM 2 haberlerini kullan):
Hangi temalar güçleniyor/zayıflıyor? Her pozisyon hangi temada? Konsantrasyon riski (tek pozisyon/tema >%25)? TL-USD ve büyüme-savunma dengesi?

**Her açık pozisyon için:** K/Z tez ile tutarlı mı? Tema gücüne göre net aksiyon: `BEKLE` / `KISMİ KÂR AL` / `SAT` / `POZİSYON ARTIR`. Ticker trade_plans/ideas'ta da varsa seviyelerle tutarlı öneri ver.

Çıktıyı ADIM 4 şemasındaki `portfolio_insight` alanına yaz: `summary` kısa genel görünüm, `actions` her açık pozisyon için bir kayıt.

---

## ADIM 6 — DASHBOARD'A GÖNDER

`portfolio_insight` dolu olmadan başlama.

**Yüklemeyi Claude yapar** (6 Eylül 2026'da kararlaştırıldı); kullanıcı artık `/admin`'e
elle yapıştırmıyor.

1. Tam JSON'ı scratchpad'e kaydet.
2. `POST /api/admin/bulk-import` — `x-admin-key` başlığı `.env`'deki `ADMIN_KEY`'den
   okunur. **Anahtarı ekrana basma, sohbete yazma.**
3. Yanıttaki `results` sayılarını ve `warnings` dizisini oku; tablo başına kaç kayıt
   yazıldığını ADIM 7 loguna geçir.
4. Yüklendikten sonra panelden **doğrula** — en az bir uç: `/api/morning-notes`
   bugünün tarihini mi dönüyor, yeni fikir `/api/ideas`'te görünüyor mu.

> **Bu adım deploy GEREKTİRMEZ.** İçerik doğrudan çalışan uygulamaya gider; deploy
> yalnızca panel KODU değiştiğinde gerekir. İkisi bir kez aynı turda yapıldı diye
> bağlı sanılmıştı, değiller.

---

## GENEL KURALLAR

- Uydurma fiyat kullanma. Fiyat alınamazsa o satırı gönderme, ADIM 7'de logla.
- ideas dizisi boşsa `[]` gönder, morning_note ve trade_plans her zaman dolu olsun.
- `stopLoss` / `target1` / `target2` / `target3` alan isimlerini yanlış yazma.
- **Paper Trading otomasyonu (bilgi — senin ek işlem yapman gerekmiyor):**
  Dashboard'ın bulk-import endpoint'i, ABD hisseleri (NYSE/NASDAQ) için
  otomatik Alpaca Paper Trading emirleri yönetiyor:
  · Yeni fikir (status: "active") → otomatik limit buy order
    (limit_price = entryLow, qty = 1, GTC)
  · Terminal status (stopped / tp1_hit / tp2_hit / tp3_hit) →
    açık pozisyon market sell ile kapatılır (zarar kesme veya kâr
    realizasyonu), bekleyen emir varsa iptal edilir
  · BIST/XETRA hisseleri için emir AÇILMAZ — sadece ABD
  Sen bu sürece müdahale etme, ayrıca emir açma/kapatma.

---

## ADIM 7 — ÖZET LOG

```
📅 [TARİH] EQR Dashboard güncellendi
✅/❌ morning_note / ideas / trade_plans / portfolio_insight
📊 Terminal'e geçenler: [TICKER: stopped/tp1_hit/... veya "yok"]
💡 Yeni fikirler (ideas'a giren, R:R≥2.0): [liste veya "yok"]
📋 İzleme Listesi (panele yazılmaz — en iyi 1-3 aday): [TICKER: tez · R:R · bara takılma nedeni | veya "yok"]
📈 Portföy aksiyonları: [SEMBOL: AKSİYON listesi]
🔄 Paper Trading: [yeni emir: TICKER listesi] / [kapatılan: TICKER listesi] / [değişiklik yok]
⚠️ Uyarılar: [başarısız kaynaklar, atlanan ticker'lar, eksik OHLC]
```