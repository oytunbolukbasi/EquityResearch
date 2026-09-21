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

**Almanya hisseleri (birincil):** `node scripts/de-price.mjs MBG VOW3 SAP …` —
anahtarsız, XETRA fiyatı, tek çağrıda hepsi. Fiyatlar **EUR**. Panele giden ticker
çıplaktır (`SAP`), borsa alanı `XETRA`.

> **Neden yfinance MCP'si değil (2026-09-20'de ölçüldü):** Alman sembollerinde
> GÜNLÜK barların son iki günü `null` geliyor ve MCP tüm yanıtı şema hatasıyla
> reddediyor (`data/result/252/Open must be number`) — yani Frankfurt tarafı
> haftalardır "veri yok" görünüyordu, oysa veri oradaydı. Betik aynı uçtan
> **günlük bar istemiyor**, `meta.regularMarketPrice`'ı okuyor.
> Doğrulama: Volkswagen 18 Eylül kapanışı bu yolla 76,52 €, ücretli kaynağın
> (Twelve Data) verdiği rakamla birebir aynı.
>
> **Denenip elenenler:** Twelve Data ücretsiz planı XETRA'da yalnız VOW3'ü
> açıyor (MBG/MUV2/DBK/ALV "Grow plan" istiyor). Stooq'un CSV ucu tarayıcı
> doğrulaması (JavaScript proof-of-work) istiyor — bot korumasıdır, aşılmaz.
>
> **Bar gerekmiyor.** Trade planı grafiği Almanya için bar taşımıyor ve bu
> bilinçli: kullanıcı kararı (2026-09-20) — "TradingView tarafı için barlar çok
> önemli değil, güncel fiyat yeter". `appendPriceHistory` gönderme.

**Fallback sırası (her kaynakta en fazla 2 deneme):**
1. yfinance MCP
2. yfinance yoksa/çökmüşse **borsaya göre böl** (2026-07 tarihinde sahada doğrulandı):
   - **ABD fiyat/OHLC** → Twelve Data `get_time_series` (sembol olduğu gibi, `outputsize` ile
     60+ bar çekilebilir). ÇALIŞIR.
   - **Almanya fiyatı** → birincil kaynak zaten `scripts/de-price.mjs`. Düşerse
     Twelve Data `get_quote` (`symbol=VOW3, exchange=XETR`) yalnız VOW3 için
     çalışır; diğer semboller ücretli planda. Sonra web_search.
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

**Önce güncel pozisyon listesini çek.**

> ⚠️ **`/api` uçları artık oturum arkasında** (GÖREV 45) — `curl` ile çağrılan
> `/api/ideas` **401** döner. Veriyi doğrudan veritabanından oku; aynı veri:
>
> ```
> npx tsx -e 'import "dotenv/config"; import { neon } from "@neondatabase/serverless";
> void (async () => { const sql = neon(process.env.DATABASE_URL!);
>   const r = await sql`select distinct on (ticker) ticker, exchange, status, date,
>     entry_low, entry_high, stop_loss, target_1, target_2
>     from ideas order by ticker, date desc, id desc`;
>   console.log(JSON.stringify(r, null, 2)) })()'
> ```
>
> Kolon adları şemada **`target_1` / `target_2`** (ideas tablosunda `target_3` YOK;
> üçüncü hedef yalnız `trade_plans.tp3`'te). Kapının önünde kalan tek yazma yolu
> `POST /api/admin/bulk-import`'tur ve o `x-admin-key` ile çalışmaya devam ediyor.

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

> ### ⚠️ Kapalı günde yazıyorsan, KAPALI GÜNLERİ tara
> Hafta sonu ya da tatilde içerik üretiyorsan tarama "bugün ne oldu" değil,
> **son seanstan bu yana ne oldu** sorusunu cevaplamalı. Piyasa kapalıyken haber
> akmaya devam ediyor ve ilk seansta topluca fiyatlanıyor.
>
> *(13 Eylül 2026 pazar günü 14 Eylül notu yazıldı. **Cumartesi** Musk, Altman ve
> Amodei yapay zekâ geliştirmesinin yavaşlaması gerektiğinde anlaşmıştı; pazartesi
> veri merkezine ekipman ve elektrik satan her şey satıldı — CEG %6,9, Siemens
> Energy %8. Haber pazar günü kamuya açıktı ve tarama onu bulamadı. "Bilemezdim"
> değil, aranmadı.)*
>
> **Siyaset ve jeopolitik ayrı bir kalem, piyasa haberinin içinde aranmaz.**
> Hafta sonu en çok bunlar birikir ve piyasa haberi aramaları onları getirmez.
> Kapalı günlerde aşağıdaki başlıkların HER BİRİ için en az bir arama yapılır;
> "kayda değer bir şey yok" da bir sonuçtur ve özette yazılır:
> 1. **Türkiye iç siyaseti ve düzenleyiciler:** hükümet/Cumhurbaşkanlığı
>    kararları, SPK/BDDK/TCMB hafta sonu duyuruları, Resmî Gazete.
>    *(Eylül 2026'da açık olan: TEFAS'ta işleme kapatılan fonların tasfiyesi.)*
> 2. **Bölgesel jeopolitik:** Türkiye'nin komşu olduğu çatışma alanları, Orta
>    Doğu, Rusya-Ukrayna — petrol ve lira riskini doğrudan taşırlar.
> 3. **ABD siyaseti ve ticaret:** gümrük tarifeleri, yaptırımlar, Fed
>    yetkililerinin hafta sonu konuşmaları, ABD-Çin.
> 4. **Avrupa/Almanya:** hükümet, AB kararları, Alman sanayisini ilgilendiren
>    düzenlemeler (portföyde beş Alman hissesi var).
> 5. **Enerji arzı:** OPEC+ kararları, tedarik kesintileri.
>
> Bulunan bir gelişme portföyde bir pozisyonu etkiliyorsa ADIM 5'te o satırın
> gerekçesinde adıyla anılır — genel makro maddesinde kalıp kaybolmaz.

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
- **İzleme listesi** → JSON'a DEĞİL: ADIM 7 özet logunda "📋 İzleme Listesi"
  satırına, ayrıntısı da Notlar'daki "İzleme Listesi" sayfasına (ADIM 8b).
- **Eleme tablosu** → Notlar'daki "İzleme Listesi" sayfasına tablo olarak
  (ADIM 8b), sıfır fikir çıkan günlerde de.

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
    "summary": "Tek cümle giriş, iki nokta üst üste ile biter:",
    "bullets": ["...", "...", "..."],
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

**portfolio_insight kuralları:**
- `summary` + `bullets` ikilisi, bültenin `topCall` + `macroBullets` yapısının
  aynısıdır. Bilerek: okuyucu o biçime zaten alışkın, ikinci bir şekil
  öğrenmesine gerek yok.
- **Nasıl yazılacağı ADIM 5'te** ("Çıktı — analiz MADDE MADDE yazılır"). Analiz
  orada üretiliyor; kuralı iki yere kopyalamak ikisinin ayrışmasını beklemek olur.
- `bullets` boş gönderilirse ya da hiç gönderilmezse panel yalnızca `summary`'yi
  paragraf olarak basar — eski kayıtlar bu yüzden bozulmadı.

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
- **Borsa hâlâ AÇIKSA o borsanın ticker'larına `appendPriceHistory` YAZMA.** Yarım
  bar gerçek bir günü yanlış anlatır ve merge tarih bazlı olduğu için düzeltilene
  kadar öyle kalır. Yalnız `currentPrice` gönder (gün içi fiyat güncel bilgidir,
  sorun değil) ve ADIM 7'de logla. Aynı sebeple **gün içi bir seviye ihlali
  terminal statü ÜRETMEZ** — statü kapanışla belirlenir.
  Kontrol: `mcp__yfinance__get_market_status`. BİST ve XETRA ABD'den önce kapanır,
  yani karma bir gün normaldir: onlara bar yazılır, ABD'ye yazılmaz.
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

Bu ikisi de **veritabanından** okunur (yukarıdaki aynı sebeple; HTTP uçları 401):

```
positions            → PORTFOLIO_DATABASE_URL, `where user_id = 'demo-user'`
portfolio_insights   → DATABASE_URL, `order by date desc limit 1` (önceki analizi tekrarlama)
```

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
>
> **Bu kuralı elle kontrol etme, betiği çalıştır:**
> ```
> npx tsx scripts/verify-insight.ts <payload.json>
> ```
> *(Betik 13 Eylül 2026'ya kadar HTTP'den okuyordu ve GÖREV 45'ten beri sessizce
> 401 alıyordu — yani göndermeden önceki tek ölçüm çalışmıyordu. Artık doğrudan
> veritabanına bakıyor.)*
> Eksik/fazla sembolü, aynı sembolün iki kez yazılmasını, geçersiz aksiyon
> adını ve boş gerekçeyi yakalar; hata varsa 1 ile çıkar.
> *(6 Eylül 2026'da, 7 Eylül tarihli not yazılırken bu kural ihlal edildi —
> 23 pozisyonun 7'sine not yazıldı ve
> listeye portföyde olmayan NVDA girdi. Kaybolan şey görünmüyordu da: NASA ve TXT
> için üç gündür bekleyen SAT kararları listeden düştüğü an sessizce yok oldu.
> Kural zaten yazılıydı; hatırlatma yetmedi, ölçüm gerekti.)*

**Tematik rotasyon çerçevesi** (ADIM 2 haberlerini kullan):
Hangi temalar güçleniyor/zayıflıyor? Her pozisyon hangi temada? Konsantrasyon riski (tek pozisyon/tema >%25)? TL-USD ve büyüme-savunma dengesi?

**Her açık pozisyon için:** K/Z tez ile tutarlı mı? Tema gücüne göre net aksiyon: `BEKLE` / `KISMİ KÂR AL` / `SAT` / `POZİSYON ARTIR`. Ticker trade_plans/ideas'ta da varsa seviyelerle tutarlı öneri ver.

> ### ⚠️ Bir önceki notta verdiğin uyarıyı sessizce geri çekme
> Aksiyonları yazmadan önce **o sembol için yazdığın son 3-5 notu oku**
> (`portfolio_insights.actions` geçmişi). Bir pozisyon için daha önce risk
> işaretlediysen ve fiyat o yönde devam ettiyse, yeni not öncekinden **daha
> rahat olamaz** — ne değiştiği yazılmadan.
>
> *(CEG: 11 Eylül notu "yüksek faiz bu tür uzun vadeli büyüme hikâyelerini
> baskılıyor, rüzgâr ters" diyordu. 14 Eylül notu, dört ardışık düşük kapanıştan
> sonra, "en sağlam bacağı, dokunmaya gerek yok" dedi — uyarı gerekçesiz
> kayboldu. Ertesi gün hisse %6,9 düştü ve kullanıcı stop oldu; kâr %13,5'ten
> %0,4'e indi. Hata boşluklu açılışı öngörememek değil, kendi verdiği uyarıyı
> silmekti.)*
>
> **24 pozisyonun gerekçesini tek geçişte "hepsi BEKLE" diye yazmak bu hatanın
> üretim yolu.** Her pozisyonun kendi fiyat serisine bak; tematik bir cümle
> fiyatın söylediğinin yerine geçmez.

### Çıktı — analiz MADDE MADDE yazılır, paragraf olarak DEĞİL

Çıktı ADIM 4 şemasındaki `portfolio_insight` alanına yazılır ve üç parçası var:

| Alan | Ne yazılır |
|---|---|
| `summary` | **Tek cümle giriş**, iki nokta üst üste ile biter. Maddeleri özetlemez, onlara açılır. |
| `bullets` | **3-6 madde.** Günün portföye dair olgularını taşır. |
| `actions` | Her açık pozisyon için bir kayıt (yukarıdaki kurallar). |

**Madde başına tek fikir.** Panelde tam genişlikte tek satır hedefle; iki satırı
aşan madde ikiye bölünmelidir. Maddeleri bir paragrafı noktalarla kesmek için
değil, **okunabilir olsun diye** kuruyorsun — her madde kendi başına anlaşılmalı.

Örnek (11 Eylül 2026):

```json
"summary": "Hafta iki merkez bankası kararıyla kapandı ve ikisini de petrol belirledi:",
"bullets": [
  "Merkez Bankamız faizi %37'de sabit tuttu, Avrupa Merkez Bankası 25 baz puan artırdı.",
  "Brent iki günde 97'den 107 dolara çıktı — ağustos başından beri yükseliş %30'a yakın.",
  "Portföyün tek net kazananı ConocoPhillips: %16,7 kârda, ilk hedefine 2,40 dolar kaldı."
]
```

> **Neden bu kural var:** analiz 12 Eylül 2026'ya kadar tek blok paragraf olarak
> yazılıyordu ve kullanıcı okumuyordu — "wall of text gibi duruyor" dedi, haklıydı.
> Panelde de bir sekmenin arkasında saklıydı; ikisi birlikte düzeltildi (GÖREV 43).
> Paragrafa geri dönersen aynı sorun geri gelir, çünkü blok artık her gün açık.

---

## ADIM 6 — DASHBOARD'A GÖNDER

`portfolio_insight` dolu olmadan başlama.

**Yüklemeyi Claude yapar** (6 Eylül 2026'da kararlaştırıldı); kullanıcı artık `/admin`'e
elle yapıştırmıyor.

1. Tam JSON'ı scratchpad'e kaydet.
2. `POST /api/admin/bulk-import` — `x-admin-key` başlığı `.env`'deki `ADMIN_KEY`'den
   okunur. **Anahtarı ekrana basma, sohbete yazma.**
3. **Göndermeden önce** `npx tsx scripts/verify-insight.ts <payload.json>` — temiz
   çıkmadan gönderme.
4. Yanıttaki `results` sayılarını ve `warnings` dizisini oku; tablo başına kaç kayıt
   yazıldığını ADIM 7 loguna geçir.
5. Yüklendikten sonra panelden **doğrula** — en az bir uç: `/api/morning-notes`
   bugünün tarihini mi dönüyor, yeni fikir `/api/ideas`'te görünüyor mu.
6. **Yeni fikir açıldıysa:** `npx tsx scripts/register-idea-symbols.ts` — açık
   fikirlerin sembolleri fiyat e-tablosunda mı, değilse ekler ve fiyatın geldiğini
   doğrular. Fikirler ekranındaki "Son fiyat" sütunu ve plan fiyatı bu e-tablodan
   (~15 dk gecikmeli) okunur; e-tabloda olmayan sembol "—" görünür ve plan
   fiyatı içerik turunun yazdığı kapanışa düşer.
   > `bulk-import` yeni bir açık fikir aldığında bu kaydı **arka planda kendisi de
   > yapar** (GÖREV 60). Betik yine de çalıştırılır: arka plandaki kayıt sessizce
   > düşebilir (e-tablo aralıklı `HTTP 404` veriyor, GÖREV 42) ve betik sonucu
   > doğrulayan tek adım. Yalnız **açık** fikirler kaydedilir — e-tablodaki her
   > satır her okumada yeniden hesaplanıyor, kapanmış bir fikrin canlı fiyatı
   > bir soruyu cevaplamıyor.

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

Bu blok sohbete yazılır **ve** panelin Notlar bölümüne kaydedilir.

---

## ADIM 8 — NOTLAR BÖLÜMÜNE YAZ

Panelin Notlar sekmesi (GÖREV 50) turun kalıcı kaydıdır. İki sayfa güncellenir.

> **Nasıl yazılır:** `/api/notes` de oturum arkasında (ADIM 1'deki aynı sebep),
> dolayısıyla `note_sections` / `note_pages` tablolarına **doğrudan** yazılır.
> `note_pages.content` BlockNote'un blok dizisidir ve sunucu onu hiç
> ayrıştırmaz — şekil bozuksa hata vermez, sayfa boş görünür. Yazdıktan sonra
> panelde açıp gerçekten çizildiğini **gör**.

### 8a — Günün özeti → bölüm "İçerik Güncelleme Özetleri"

- Sayfa başlığı **günün tarihi**, tam olarak bu biçimde: `14 Eylül 2026`
  (gün sayısı başında sıfır yok · ay adı Türkçe ve büyük harfle · yıl dört hane).
- İçerik: ADIM 7 bloğunun **aynısı** — tek paragraf, sekiz satır, satır sonlarıyla
  ayrılmış, emoji ön ekleri korunmuş. Maddeleri ayrı paragraflara bölme, kod bloğu
  yapma; kullanıcı bu biçimi seçti.
- Aynı tarihli sayfa zaten varsa içeriğini **değiştirme** — kullanıcı elle
  düzenlemiş olabilir. Yalnızca sayfa yoksa oluştur.

### 8b — İzleme listesi → bölüm "Fikirler", sayfa "İzleme Listesi"

Tek bir sayfa; her tur **başa değil sona** yeni bir bölüm eklenir, eskisi arşiv
olarak kalır:

- `heading` (level 3): `[TARİH] taraması` — ör. `14 Eylül 2026 taraması`
- `paragraph`: o gün panele fikir girip girmediği ve sebebi
- `table`: `Aday · Fiyat · Tez · Risk-getiri · Neden takıldı`

Tablo blok biçimi (BlockNote):
```
{ type: "table", props: { textColor: "default" }, children: [],
  content: { type: "tableContent", headerRows: 1,
             columnWidths: [160, 110, 300, 130, 300],
             rows: [ { cells: [ { type: "tableCell",
                                  props: { backgroundColor: "default", textColor: "default",
                                           textAlignment: "left" },
                                  content: [{ type: "text", text: "...", styles: {} }] } ] } ] } }
```
`columnWidths` mutlak piksel değil: panel darsa tablo orantılı sıkışır, geniş
ekranda verilen değerler birebir uygulanır. Başlık hücrelerine `styles: { bold: true }`.

**Sıfır fikir çıkan günlerde de yazılır** — eleme tablosu taramanın yapıldığının
tek kanıtı (bkz. `Skill(eqr-idea-generation)`, Adım 5).

### 8c — İzleme listesinin yaşam döngüsü (giren / çıkan)

Sayfanın **en üstünde**, arşivden önce, korunan bir tablo durur:

`Şu an izlenenler` → `Sembol · Tez (tek cümle) · Eklendiği tarih · Bekleyen koşul`

Bu tablo arşiv değil, **canlı liste**. Her tur şu üç iş yapılır:

1. **Giren.** Taramadan çıkan ama barı geçemeyen yeni aday tabloya eklenir.
   "Bekleyen koşul" sütunu, fikir olması için NE olması gerektiğini yazar —
   "geri çekilme", "katalizör", "oran 2,0'a çıksın" gibi. Bu sütun boşsa aday
   izleme listesine değil çöpe gider; neyi beklediğini yazamıyorsan izlemiyorsun.
2. **Çıkan — panele girdi.** Bir isim `ideas`'a girdiği gün canlı tablodan
   **silinir** ve o günün tarama bölümüne tek satır düşülür:
   `MUV2 izleme listesinden çıktı → panele fikir olarak girdi.`
   Ayrıca ismin ilk göründüğü arşiv tablosundaki satırın "Neden takıldı"
   hücresinin sonuna ` → [TARİH]'te panele girdi` eklenir. Arşiv böylece
   sonucu olan bir kayda döner; aksi hâlde hangi adayın işe yaradığı hiç
   görünmez ve `Skill(eqr-idea-generation)`'ın "tarama isabet oranını takip et"
   uyarısı ölçülemez kalır.
3. **Çıkan — vazgeçildi.** Tez bozulduysa yine silinir, aynı biçimde gerekçesiyle
   düşülür: `ALV izleme listesinden çıktı → zirveye yaklaştı, oran daha da bozuldu.`

**Arşiv bölümleri asla silinmez**, yalnızca yukarıdaki tek hücre eklemesiyle
güncellenir. Canlı tablo ise tamamen yeniden yazılır — onun geçmişi arşivde zaten
duruyor.

> Kural neden var: 8b tek başına sayfayı biriktiriyordu ama hiçbir satırın sonunu
> yazmıyordu. Sayfayı açma sebebi "şu an neyi izliyorum" sorusu; o cevap tarihli
> bölümlerin arasına dağılırsa sayfa arşiv olur, araç olmaz.