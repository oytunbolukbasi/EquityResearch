# Yatırım Dashboard — Proje Brief (Claude Code için)

# Rol
Sen modern web uygulamaları geliştiren kıdemli bir Frontend Geliştirici ve UI/UX Uzmanısın. Amacın, modern tasarım standartlarına uygun, kullanıcı dostu ve yüksek performanslı arayüzler kodlamaktır.


## Amaç
Günlük kontrol edilen, kişiselleştirilebilir bir yatırım takip dashboard'u. claude.ai (equity-research projesi) içinde MCP connector'ları ve web search ile üretilen içerikler (morning note, trade idea, trade plan, paper trading) bu panelde görselleştiriliyor. Tek kullanıcılı, düşük maliyetli, Railway'de deploy ediliyor.

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix tabanlı)
- **Canvas / widget sistemi:** react-grid-layout — sürükle, yeniden boyutlandır, grid'e snap, layout JSON olarak saklanır
- **Animasyon:** Framer Motion (widget ekleme/taşıma geçişleri için, abartısız)
- **Backend:** Node.js + Express — tek servis, build edilmiş React static dosyalarını da serve eder
- **ORM:** Drizzle ORM (Neon serverless driver ile birlikte)
- **Veritabanı:** Neon Postgres (mevcut hesap) — pooled connection string kullan
- **Deployment:** Railway (sadece uygulama; DB Neon'da kalıyor), GitHub'a push ile otomatik deploy

## Tasarım Dili
Renk paleti mevcut PDF bültenlerden ve trade plan HTML'inden taşındı; üzerine tam bir
**light/dark tema token sistemi** kuruldu (sıcak-antrasit dark). Minimal, yuvarlatılmış
köşeli kartlar (radius ~14px), bol boşluk — her iki temada da.

**Token mimarisi (Tailwind v4, CSS-first — `tailwind.config` yok):**
- `@custom-variant dark (&:is(.dark *))` + `@theme inline` sayesinde ham brand
  değişkenlerini tek bir `.dark {}` bloğunda ezmek, semantic class kullanan (`bg-card`,
  `text-mid`, `bg-background`…) tüm arayüzü otomatik yeniden renklendirir.
- **Ham brand katmanı** — light `:root`, dark `.dark`:

```css
:root {
  --bg:    #f7f6f3;  --white: #ffffff;  --ink:   #1a1a18;
  --mid:   #6b6b67;  --faint: #d8d7d2;  --faint2:#eeede9;
  --green: #1a7a5e;  --red:   #c0392b;  --blue:  #2563a8;  --amber: #9a6200;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
.dark {
  --bg:  #16130f;  --card: #201c17;  --ink: #f0ede8;
  --mid: #a19b91;  --faint: #3a352e; --faint2: #2a251f;
  /* accent'ler dark'ta kontrast için parlatılıyor */
  --green: #3fae86; --red: #e06b5d; --blue: #6ba3e0; --amber: #d9a441;
}
```

- **Semantic accent katmanı** — inline-style'ların tek renk kaynağı. Widget badge/status
  chip, chart serisi ve seviye çizgileri bunları `var()` ile kullanır; `.dark` bunları
  yeniden eşler (parlatılmış accent + translucent tint dolgular):
  - Accent alias'ları: `--up` / `--down` / `--info` / `--warn`
  - Badge tint arka planları: `--up-tint` / `--down-tint` / `--info-tint` / `--warn-tint` /
    `--neutral-tint` (light'ta pale hex, dark'ta translucent rgba)
  - TP merdiveni: `--tp1..3` + `--tp1..3-tint`
  - Cam modal + scrim: `--glass-bg` / `--glass-border` / `--scrim`
  - Grafik: `--chart-grid` / `--chart-axis`

**Tema state + toggle (`client/src/lib/theme.tsx`):**
- İlk açılışta OS tercihini (`prefers-color-scheme`) izler; header'daki Sun/Moon toggle ile
  override edilir ve seçim `localStorage['eqr:theme']`'de saklanır.
- `.dark` class'ı `document.documentElement`'e **senkron** uygulanır — böylece portal'lı
  Radix dropdown'ları/modal'lar temayı izler ve child effect'ler (grafik) toggle sonrası
  doğru paleti okur. `index.html`'e FOUC önleyici inline script eklendi (render öncesi
  class'ı basar → açık→koyu flash yok).

**Grafik dark mode (lightweight-charts):** Kütüphane canvas tabanlı olup CSS değişkeni
okuyamaz; renkler effect içinde `getComputedStyle` ile aktif temanın *concrete* token'larından
(`--green`/`--red`/`--faint2`/`--chart-axis`/`--tp1..3`/`--blue`) somut string'e çözülür.
`theme`, effect deps'inde (`[plan, theme]`) — grafik her değişimde tamamen yeniden
kurulduğundan toggle'da doğru renklerle rebuild olur.

**Tipografi:**
- Tek font: **Inter** (400/500/600/700, latin + latin-ext — Türkçe karakter tam desteği).
- Sayısal değerlerde (fiyat, yüzde, miktar) mono font YOK; bunun yerine `font-variant-numeric: tabular-nums` ile sütun hizalaması korunuyor. CSS utility class: `.num` ve `.tnum`.
- Widget eyebrow başlıkları: 14px / weight 600 / uppercase / tracking 0.01em.
- Tablo başlıkları `<th>`: 11px / weight 500 / uppercase / tracking 0.04em.
- Tablo hücreleri `<td>`: minimum 13px (CSS override, unlayered).
- Piyasa Nabzı bölüm başlıkları (Ana Görüş / Makro / Sektör Odağı): 14px / weight 600.
- Makro bullet satırları: 14px / line-height 1.65.

## Veri Modeli (Postgres / Drizzle, jsonb ağırlıklı — şema esnek kalsın)

- Ana DB tabloları: `morning_notes`, `ideas`, `trade_plans`, `portfolio_insights`,
  `layouts` (+ arayüzde kullanılmayan ama korunan `heatmaps`).
- Portföy pozisyonları AYRI, salt-okunur bir DB'de (`PORTFOLIO_DATABASE_URL`):
  `positions`, `closed_positions` (o app'in sahibi; buradan sadece SELECT edilir).
- İçerik JSON şeması ve alan isimleri: bu klasördeki cowork-instructions-final.md.

## Widget'lar (5 aktif)
1. **Piyasa Nabzı** (route/tablo adı `morning_notes`, `/api/morning-notes`) — Top Call + Makro madde listesi + Sektör Odağı. Widget içi ◀ ▶ navigasyonuyla geçmiş notlara erişim.
2. **Pozisyon Fikirleri** — `ideas` tablosu, Aktif/Geçmiş sekmeli. Aktif: her ticker'ın kendi en son kaydı (`selectDistinctOn`, status `active`/`review`). Geçmiş: terminal statüler (`stopped`, `tp1_hit`, `tp2_hit`, `tp3_hit`) doğru TP/SL rozetiyle. Öneri/Bitiş tarihi kolonları + Risk/Getiri mini-bar ve formül tooltip'i. Satıra tıklayınca Trade Planı o ticker'a geçer.
3. **Trade Planı** — `trade_plans` tablosu. TradingView Lightweight Charts (CandlestickSeries) gerçek OHLC grafiği; Y-ekseni sadece fiyat geçmişine kilitli, dışarıda kalan seviyeler off-chart rozet. Seviyeler grafiğin altında tek pill satırında (etiket + fiyat + %). **Varsayılan açılış = en güncel tarihli aktif idea** (statü `/api/ideas`'ten türetilir; senkron olmayan `trade_plans.status`'a güvenilmez). Aktif/Geçmiş sekmeli.
4. **Portföy Durumu** — Ayrı salt-okunur Neon DB'den (`PORTFOLIO_DATABASE_URL`) açık/kapalı pozisyonlar. TL ve USD blokları ayrı özet kutularında; K/Z değer↔yüzde toggle; canlı USD/TRY kuru (Frankfurter API, hata durumunda fallback + `isFallback` flag); Günlük Analiz (`portfolio_insights`); Geçmiş sekmesinde kapatılan pozisyonlar. **Varsayılan kompakt mod** (yalnız K/Z + tek satır analiz), "Daha Fazla Göster" ile Maliyet/Güncel Değer ve tam analiz genişler.
5. **Paper Trading** — Alpaca Paper Trading API. Agent'ın ideas/trade planlarını kullanarak otomatik pozisyon açıyor/kapatıyor (**sadece NYSE/NASDAQ; BIST hariç**). 3 sekme: Açık Pozisyonlar / Kapatılan (FIFO realized P&L) / Emirler.

> **Kaldırılan widget'lar:** BIST Heatmap + ABD Heatmap (GÖREV 17). DB'deki `heatmaps` tablosu veri kaybı önlemek için korundu ama arayüzde yok.

Tüm widget'lar react-grid-layout canvas'ında bağımsız öğeler; kullanıcı ekleyebilir, taşıyabilir, boyutlandırabilir, kaldırabilir. Layout `localStorage`'da + `layouts` tablosunda saklanır (cihaz/tarayıcı bazında; header'daki Kaydet butonuyla yazılır, o cihazda açılışta otomatik geri yüklenir).


## İçerik Besleme Akışı
Bir **cowork agent** (Claude; yfinance MCP birincil, fallback Twelve Data + tek web_search) günlük içeriği (morning_note / ideas / trade_plans / portfolio_insight) üretip şemaya uygun JSON döner. JSON, `/admin` sayfasındaki **"Toplu İçerik Girişi"** textarea'sına yapıştırılıp `POST /api/admin/bulk-import` ile kaydedilir (`x-admin-key` korumalı; her tablo bağımsız hata izolasyonlu upsert). ABD (NYSE/NASDAQ) fikirleri için bulk-import ayrıca otomatik Alpaca Paper Trading emri yönetir.

- Tam görev akışı, statü yaşam döngüsü ve JSON şeması: bu klasördeki cowork-instructions-final.md.

## Deployment Notları
- Neon: proje oluştur, **pooled** connection string'i al, `DATABASE_URL` olarak Railway env'ine ekle.
- Railway: GitHub repo'ya bağla, push'ta otomatik deploy. Tek servis (API + static frontend).
- Drizzle migration'ları local'den veya Claude Code'dan `drizzle-kit push` ile Neon'a uygulanır.




---

# Geliştirme Günlüğü (tarihsel — kronolojik kayıt)

> Aşağıdaki **"Proje İlk Session'ı"** ve **GÖREV 1-25** bölümleri tarihsel geliştirme
> kaydıdır; projenin GÜNCEL durumu için yukarıdaki bölümler geçerlidir. Erken kararların
> bir kısmı sonraki görevlerle değiştirilmiştir — ör. **Open Sans/JetBrains Mono → Inter**
> (GÖREV 14), **BIST/ABD Heatmap widget'ları kaldırıldı** (GÖREV 17), **seviye tablosu tek
> pill satırına birleşti** (GÖREV 24), **portfolio_snapshots bağımlılığı kaldırıldı** (kaynak
> tablo silindi). Çelişki görürsen **en yüksek numaralı GÖREV** geçerlidir.

**Proje İlk Session'ı** 
Bu klasördeki dashboard-proje-brief.md dosyasını oku ve projeyi bu brief'e göre scaffold et.

Adım adım ilerle, her adımın sonunda kısa özet ver ve onay almadan sonraki adıma geçme:

1. Proje iskeleti: React 19 + Vite + TypeScript, Tailwind v4 + shadcn/ui. Tasarım token'larını
   brief'teki CSS değişkenlerine göre kur (Open Sans + JetBrains Mono, renk paleti).
2. Canvas: react-grid-layout ile sürükle/bırak + yeniden boyutlandırılabilir widget sistemi.
   Layout v1 için localStorage'da saklansın.
3. Backend: Node + Express (veya Hono), Drizzle ORM, Neon Postgres (DATABASE_URL env
   değişkeninden, pooled connection string). Brief'teki 4 tablo şemasını migration olarak oluştur.
4. 5 widget'ı brief'teki spesifikasyona göre inşa et: Morning Note, Teknik Alım-Satım Tablosu,
   Trade Plan Viewer (trade plan view.html'deki SVG yaklaşımını React component'e taşı),
   BIST Heatmap, ABD Heatmap.
5. Basit "İçerik Ekle" admin sayfası: tek textarea, JSON paste, hedef tabloyu seçip POST eden.
   x-admin-key header ile korunsun (ADMIN_KEY env değişkeni).
6. Railway deploy için gerekli config (start script / nixpacks) hazırla; GitHub'a bağlama ve
   env değişkenlerini Railway'e girme adımlarını ayrı bir DEPLOY.md olarak yaz — bunu senin
   adına otomatik yapamayacağını biliyorum, sadece net adımlar istiyorum.
7. Brief'in sonundaki "Açık Noktalar" bölümündeki varsayılanlarla ilerle (tek textarea,
   localStorage layout, statik trade plan verisi). Farklı bir öneri varsa önce söyle, onaylarsam
   devam et.

GitHub reposu hazır, değişiklikleri orada commit'lerle ilerlet, push etmeden önce bana sor.

**New Development Tasks**

Model: Sonnet 4.6, effort: medium. Bu iki görev mekanik ve iyi tanımlı, yüksek effort
veya Opus gerektirmiyor.

GÖREV 1 — Widget başlık fontu
Her widget'ın üst çubuğundaki başlık metni (örn. "MORNİK NOTE · 19 Haz 2026 kapanışı",
"ALIM-SATIM ÖNERİLERİ · ...", "TRADE PLANI · ...", "BIST HEATMAP · ...") şu an
JetBrains Mono ile render ediliyor. Bunu değiştir:
- font-family: Open Sans
- font-weight: 600 veya 700 (bold, göze çarpsın)
- Renk şu an --mid (soluk gri); --ink'e çek ki daha belirgin olsun
- Harf aralığı (letter-spacing) ve büyük harf stilini istersen koru, istersen kaldır —
  Open Sans bold zaten yeterince belirgin olacaktır, ikisini de dene ve hangisi daha iyi
  duruyorsa onu kullan
ÖNEMLİ: Bu değişiklik SADECE widget başlık çubuklarına uygulansın. Fiyat/seviye
tablolarındaki sayısal değerler (Giriş Bandı, TP1, fiyatlar, DURUM rozetleri vb.) hâlâ
JetBrains Mono kullanmaya devam etsin — onlara dokunma.

GÖREV 2 — Header'a tarihsel görüntüleme için datepicker
Sağ üstteki "21 Haziran 2026" tarih metninin yanına/üzerine bir datepicker komponenti ekle:
- Bir tarih seçildiğinde: tüm widget'lar o tarihe ait veriyi göstersin (mevcut /history
  endpoint'lerini date parametresiyle çağırarak). O tarihte veri yoksa, daha önce eklenen
  null-guard / empty-state ("Bu tarihte veri yok") devreye girsin, sayfa çökmesin.
- "Tümünü Gör" seçeneği: tarih filtresini temizleyip her widget'ı eski varsayılan
  davranışına döndürsün (her tablo için en son kaydı gösteren mevcut mantık).
- Datepicker seçilebilir herhangi bir tarihi kabul etsin, hangi tarihlerde veri olduğunu
  ayrıca işaretlemene gerek yok — bu fazlası, basit tutalım.
- Tasarım dilimize uy: Open Sans, mevcut renk paleti (--ink, --mid, --blue), shadcn/ui'da
  zaten bir date picker komponenti varsa onu kullan, yoksa basit bir native <input
  type="date"> + "Tümünü Gör" butonu de yeterli, aşırı mühendislik yapma.

İki görevi tamamladıktan sonra ekran görüntüsü göster, onay almadan commit/push etme.

GÖREV 3 — Morning Note label değişikliği
"MORNING NOTE" başlığını "PİYASA NABZI" olarak değiştir. Sadece görünür etiket — komponent/
dosya/route/DB tablo adı (morning_notes, /api/morning-notes) aynı kalsın. "Widget Ekle"
menüsü ve /admin içerik tipi seçici de tutarlı olsun.

GÖREV 4 — trade_plans toplu import + bugfix
FIG/DRAM/ENKAI/THYAO/MA/ISRG için currentPrice + priceHistory upsert edildi (entry/tp/sl/
thesis'e dokunulmadı). Bu sırada THYAO ve ENKAI'de (tp3: null olan ticker'lar) TradePlanChart
çöküyordu — addLine çağrısından önce template literal içinde N2(null) çalışıp patlıyordu.
Fix: title formatlaması addLine'ın null-guard'ından SONRAYA taşındı.

GÖREV 5 — Trade Planı grafik ölçeklendirme + off-chart rozetler
Y ekseni artık SADECE priceHistory min/max'ına göre ölçekleniyor (TP/SL dahil değil).
Görünür aralık içindeki seviyeler düz çizgi + etiket, dışındaki seviyeler grafiğin köşesine
sabitlenmiş kompakt rozet (↑/↓ + isim + fiyat + % fark) olarak gösteriliyor. Alttaki seviye
tablosu değişmedi.

GÖREV 6 — Grafik tipi + gerçek OHLC backfill
CandlestickSeries → BarSeries (düz OHLC bar). Python yfinance ile her ticker için ~120
işlem günü (6 ay) gerçek günlük OHLC çekildi (BIST için ".IS" uzantısı sorguda kullanıldı,
DB'de ticker uzantısız kaydedildi). %3 eşik aşımı veya seviye geçişi kontrolü yapılıp rapor
onaylandıktan sonra DB'ye yazıldı (scripts/fetch_ohlc.py + scripts/backfill-trade-plan-
history.ts).

GÖREV 7 — Seviye çizgi kalınlığı
createPriceLine() çağrılarına lineWidth: 2 eklendi (Giriş Bandı, TP1-3, Hard SL) — ince
varsayılan çizgi yerine net görünür hale getirildi.

GÖREV 8 — Header sadeleştirme, admin bulk-import, Aktif/Geçmiş sekmeleri
- Dashboard header'ı sadeleştirildi: açıklama satırı kaldırıldı, "Düzeni Sıfırla" küçük
  ikona indirildi, tarih kontrolü dropdown butona çevrildi (📅 + tarih + ⌄, panel içinde
  native date input + "Tümünü Gör"). Header'a eklenen "Yenile" butonu sonradan kaldırıldı
  (işlevsel bir karşılığı olmadığı için).
- POST /api/admin/bulk-import endpoint'i eklendi: morning_note/ideas/heatmaps/trade_plans'ın
  herhangi bir alt kümesini tek istekte upsert ediyor, mevcut requireAdmin (x-admin-key)
  middleware'ini kullanıyor, tablo bazlı hata izolasyonu var. trade_plans için: ticker DB'de
  yoksa tüm alanlar (entryLow/tp1-3/hardSl/thesis/invalidation dahil) insert edilir; ticker
  VARSA sadece currentPrice + (varsa) priceHistory + (varsa) status güncellenir, diğer
  alanlara dokunulmaz. Admin sayfasına "Toplu İçerik Girişi" bölümü (JetBrains Mono textarea,
  Gönder/Temizle, sonuç kutusu) eklendi.
- trade_plans tablosuna status kolonu eklendi (text, default 'active'; migration:
  drizzle/0001_add_trade_plans_status.sql). ISRG hardSL kırılınca 'stopped' olarak
  güncellendi.
- Alım-Satım Önerileri ve Trade Planı widget'larına "Aktif | Geçmiş" sekme filtresi eklendi
  (paylaşılan StatusTabs component'i). Aktif: en son tarihteki/durumdaki aktif kayıtlar,
  tarih filtresinden bağımsız. Geçmiş: tüm stopped kayıtlar, tarihe göre tersten sıralı.
  Geçmiş sekmesinde durdurulan pozisyonların yanında kırmızı "SL" rozeti gösteriliyor.
- Widget header'larındaki dinamik "· 22 Haz 2026 kapanışı" alt-başlığı kaldırıldı (artık
  tarih bağlamı sadece header'daki datepicker'dan okunuyor); WidgetSubtitleCtx/
  useWidgetSubtitle/fmtDataDate mekanizması tamamen kaldırıldı (widget-subtitle.ts silindi).

GÖREV 9 — Aktif/Geçmiş sekme bugfix: ticker bazında en son kayıt
GÖREV 8'deki Aktif sekmesi "en son tarihteki kayıtlar" mantığıyla çalışıyordu — bu yanlıştı,
çünkü durumu değişmeyen pozisyonlar hep orijinal tarihinde kalıyor ve başka bir ticker'a
daha yeni bir tarihte kayıt girilince (örn. MU/ISRG 22 Haziran'a düşünce) eski ticker'lar
(FIG/DRAM/ENKAI/THYAO, 19 Haziran) "güncel" görünümden tamamen kayboluyordu. Fix:
GET /api/ideas (date parametresi yokken) artık selectDistinctOn(ticker) ile her ticker'ın
KENDİ en son kaydını (ticker, date DESC, id DESC sıralamasıyla) tek satır olarak dönüyor,
sonra date DESC'e göre tekrar sıralanıyor. IdeasTableWidget'ın Aktif ve Geçmiş sekmeleri
artık bu aynı "ticker bazında en son" veri setini status'e göre filtreliyor (ayrı bir
/api/ideas/history çağrısı yapmıyor). Sonuç doğrulandı: Aktif → FIG, DRAM, ENKAI, THYAO,
MA, MU (6); Geçmiş → ISRG (1, "SL" rozetiyle).

NOT: Bu fix git'e push edildi (commit 3359e5f) ama henüz bilinçli olarak prod'a alınmadı —
"sonraki versiyonda deploy ederiz" kararı verildi. Railway GitHub push'unda otomatik deploy
tetiklediği için, bu commit aslında zaten production'a gitmiş olabilir; istenirse bir
sonraki sürüme kadar geri alınması (revert) gerekebilir.

GÖREV 10 — Portföy Durumu backend altyapısı
Ayrı salt-okunur Neon DB (PORTFOLIO_DATABASE_URL) bağlantısı eklendi. server/db/portfolio-
client.ts: sadece SELECT metotları (getOpenPositions, getClosedPositions, getRecentSnapshots)
export ediyor — raw client hiç export edilmiyor, yazma yolu yapısal olarak kapalı.
server/routes/portfolio.ts: GET /api/portfolio/summary (açık pozisyonlar + anlık snapshot),
GET /api/portfolio/closed. portfolio_insights tablosu eklendi (Drizzle migration
0002_add_portfolio_insights.sql); bulk-import endpoint'ine portfolio_insight tipi eklendi
(date+body upsert). Frankfurter API'den canlı USD/TRY kuru çekiliyor
(server/services/exchange-rate.ts), hata durumunda 41.50 TL fallback + isFallback flag.
currentValueTRY = currentValue × usdTryRate olarak hesaplanıp response'a ekleniyor.

GÖREV 11 — Portföy Durumu widget
TL Pozisyonlar / USD Pozisyonlar CurrencyBlock'ları: Maliyet, Güncel Değer, K/Z (tutar +
yüzde). K/Z sütununda değer↔yüzde toggle (IoSwapHorizontal, widget-seviyeli plMode state,
us_stock için $ prefix). USD bloğu başlık satırına USD/TRY=46,81 kur notu eklendi
(Frankfurter API; fallback durumunda "≈" sembolü + "(tahmini)" notu). Günlük Analiz bölümü
portfolio_insights'ın son kaydını gösteriyor. Pozisyon tablosu: Aktif sekmesinde açık
pozisyonlar + eylem aksiyonu (BEKLE/KISMİ KÂR AL/SAT/POZİSYON ARTIR), Geçmiş sekmesinde
kapatılan pozisyonlar. Aksiyona tıklanınca "liquid glass" modal açılıyor (Framer Motion
scale+opacity, backdrop-filter blur). Widget registry'e eklendi (Wallet ikonu, defaultSize
w:7 h:12).

GÖREV 12 — Trade Planı ek iyileştirmeler
- Grafik tipi: BarSeries → CandlestickSeries (kullanıcı talebiyle geri alındı).
- TradingView SuperCharts linki: ticker başlığının yanında IoOpenOutline ikonu, tıklanınca
  TradingView chart URL'ine yönlendiriyor (BIST için :BIST suffix).
- ASTOR / BIMAS / TUPRS priceHistory backfill: Python yfinance ile (.IS suffix) çekildi,
  bulk-import appendPriceHistory ile yazıldı.
- bulk-import appendPriceHistory: mevcut priceHistory ile gelen barlari tarih bazında merge
  ediyor (üst üste yazma yok). Bar sayısı < 20 ise warnings[] array'ine uyarı düşüyor.
- bulk-import updateLevels: true flag'i ile entryLow/entryHigh/tp1-3/hardSl/thesis/
  invalidation güncellenebiliyor; sadece gönderilen alanlar değişiyor (hasOwnProperty
  kontrolü — eksik alan null'a dönüştürülmüyor).
- Piyasa Nabzı widget: global datepicker kaldırıldı, widget içi ◀ ▶ navigasyon eklendi
  (/api/morning-notes/history tüm notları çekiyor, index state ile geziniyor).

GÖREV 13 — Dashboard sürükle/bırak UX modernizasyonu (CSS-only)
react-grid-layout kütüphanesine dokunulmadan saf CSS/stil katmanı değişiklikleri:
- Drag: sürüklenen widget'ın iç div'i scale(1.02) + box-shadow 0 8px 32px rgba(0,0,0,0.12).
  Kütüphanenin inline transform: translate() ile çakışmaması için scale iç div'e uygulandı.
  z-index: 10, cursor: grabbing.
- Widget header: cursor: grab (Tailwind cursor-move'un üzerine unlayered CSS ile yazıldı).
- Placeholder: kırmızı dolgu → rgba(37,99,168,0.08) mavi tonu, border 25% opacity, opacity:1,
  backdrop-filter: blur(1.2px), transition 200ms ease.
- Yerleşme animasyonu: cubic-bezier(0.2, 0, 0, 1) 220ms (cssTransforms class'ı üzerine).
- Resize handle: varsayılan sprite kaldırıldı, CSS ile 10×10 L-köşe çizgi (--mid → --ink
  hover). touch-action: none, user-select: none.
- Metin seçim kilidi: onDragStart/onResizeStart → body.rgl-interacting class ekleniyor,
  onDragStop/onResizeStop → kaldırılıyor. CSS: body.rgl-interacting * { user-select: none
  !important }. Widget header ve resize handle'a kalıcı user-select: none.
- @media (prefers-reduced-motion: reduce): tüm bu transition'lar kapatılıyor.

GÖREV 14 — Inter font migrasyonu + tipografi iyileştirmeleri
Open Sans + JetBrains Mono tamamen kaldırıldı. Tek font: Inter (400/500/600/700,
latin+latin-ext subset — Türkçe karakter desteği). Sayısal hizalama için font-variant-
numeric: tabular-nums + font-feature-settings: 'tnum' 1 (CSS utility: .num ve .tnum).
TradingView chart fontFamily Inter'a güncellendi. AdminPage textarea ui-monospace fallback'e
döndürüldü. Tüm font-mono Tailwind class'ları kaldırıldı (ticker semboller, modal, tablo).
Tipografi: widget eyebrow 14px/600, tablo th 11px unlayered CSS override, tablo td 13px
unlayered CSS override, Piyasa Nabzı bölüm başlıkları 14px/600, makro bullet satırları
leading-[1.65]. CurrencyBlock: değer satırları 15px/medium, K/Z 15px/semibold, etiketler
12px, aralıklar genişletildi (space-y-2.5, pt-2.5). USD kur notu blok altından başlık
satırına (USD POZİSYONLAR yanına) taşındı: "USD/TRY=46,81" formatı.

GÖREV 15 — Favicon ve header ikonu
Tarayıcı sekmesi favicon'u ve header'daki sol üst logo BotMessageSquare (lucide-react)
ikonuyla değiştirildi. SVG favicon inline olarak inject ediliyor (CSS currentColor ile tema
uyumlu); header'da ikon + "Equity Research" metni yan yana.

GÖREV 16 — Pozisyon Fikirleri Risk/Getiri mini-barı
IdeasTableWidget her satırın altına Risk:Reward mini-bar eklendi. Kırmızı segment risk
(giriş–stop) ve yeşil segment getiri (giriş–hedef1) oranını görsel olarak gösteriyor. Sağda
kompakt "R:R 1:2.4" rozeti. Hesaplama: entryHigh, stopLoss, target1 değerleri üzerinden
yapılıyor; eksik değerde bar render edilmiyor.

GÖREV 17 — BIST ve US Heatmap widget kaldırma
BIST Heatmap ve ABD Heatmap widget'ları tamamen kaldırıldı (kullanıcı talebi). Kaldırılan
dosyalar: client/src/features/widgets/BistHeatmapWidget.tsx ve UsHeatmapWidget.tsx.
Widget-registry, WIDGET_TYPES, DEFAULT_ITEMS/DEFAULT_LAYOUT ve admin sayfasından referanslar
temizlendi. Backend'de /api/heatmaps route'u ve bulk-import'taki heatmaps parse bloğu
kaldırıldı. DB'deki heatmaps tablosu korundu (veri kaybı önlemek için).
localStorage migration guard eklendi: kayıtlı layout'ta kalan bist-heatmap/us-heatmap
öğeleri loadItems() filtresiyle temizlenip sayfa çökmesi önlendi.

GÖREV 18 — Alpaca Paper Trading entegrasyonu
Sadece ABD hisseleri (NYSE/NASDAQ) kapsıyor; BIST pozisyonları bu fazda yok.

A — Backend proxy (server/lib/alpaca.ts + server/routes/paper-trading.ts):
AlpacaError sınıfı ve alpacaFetch() yardımcısı (APCA header'ları, 204 null, hata mesajı
parse). 6 proxy endpoint: GET /account, /positions, /orders, /activities/fills,
/orders/:id (DELETE ile iptal), POST /orders. FIFO kapatılan-pozisyon hesabı:
fill aktiviteleri transaction_time'a göre sıralanıp buy kuyruğuna ekleniyor, sell
gelince kuyruğun başındaki buy ile eşleştirilip P&L hesaplanıyor. Railway env değişkenleri:
ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_BASE_URL.

B — PaperTradingWidget (client/src/features/widgets/PaperTradingWidget.tsx):
4 özet kart: Toplam K/Z (realized + unrealized), Kazanan pozisyon sayısı, Kaybeden pozisyon
sayısı, Açık Pozisyon sayısı. 3 sekme: Açık Pozisyonlar (mevcut pozisyonlar + unrealized
P&L), Kapatılan (FIFO eşleşmeli realized P&L), Emirler (açık/kısmi emirler + iptal butonu).
İptal butonu liquid-glass CancelModal açıyor (createPortal + backdrop-filter blur).
Admin key localStorage'dan okunuyor (eqr:admin-key). Widget registry: eyebrow 'PAPER
TRADING' (büyük harf — Türkçe locale'de CSS uppercase i→İ dönüşümünü önlemek için),
defaultSize w:12 h:14. Default layout'ta en alta eklendi (y:21).

C — Otomatik Alpaca emri (server/routes/bulk-import.ts):
Bulk-import'a NYSE/NASDAQ exchange kontrolü eklendi. Yeni aktif fikir → entryHigh fiyatından
limit alış emri (qty:1, gtc); aynı ticker'da zaten açık emir varsa atlanıyor. Status 'stopped'
→ önce açık limit emirleri iptal ediliyor, sonra pozisyon market satışıyla kapatılıyor
(sıralama kritik: ters sırada market satış emri kendi iptaliyle karşılaşıyordu — düzeltildi).
BIST ticker'ları için Alpaca işlemi tetiklenmiyor.

GÖREV 19 — TradingView SuperCharts URL düzeltmesi
Trade Planı widget'ındaki IoOpenOutline linki hardcoded bir chart ID (95XZ7reL) içeriyordu
ve bu ID o hesaba ait özel bir grafik olduğundan başkalarında açılmıyordu. tvChartUrl()
fonksiyonu ID'yi kaldırıp sadece sembol bazlı URL kullanacak şekilde güncellendi:
https://tr.tradingview.com/chart/?symbol=EXCHANGE:TICKER. TV_EXCHANGE_MAP ile borsa
kodu eşlemesi (XETRA→XETR vb.) korundu.

GÖREV 20 — 8 yönlü resize handle (Midas Atlas stili)
react-grid-layout'un varsayılan sadece-köşe resize'ı 8 yöne (N/S/E/W/NE/NW/SE/SW) çıkarıldı.
CSS katmanı (index.css):
- Köşe handle'lar: 1rem × 1rem, görünmez hit-area
- Kenar N/S: left/right: 1rem, width: auto, height: 0.5rem, cursor: ns-resize
- Kenar E/W: top/bottom: 1rem, height: auto, width: 0.5rem, cursor: ew-resize
- ::after { display: none } — orijinal görsel ok/sprite kaldırıldı; cursor değişimi tek
  affordance olarak yeterli. DashboardCanvas.tsx'te resizeConfig.handles dizisi eklendi.
Serbest konumlandırma (compactType: null) denenip kullanıcı tarafından geri alındı.

GÖREV 21 — Canvas edge-to-edge + default layout yükseklik güncellemesi
- main'deki px-4 kaldırıldı; dotted background pencere kenarına kadar uzanıyor.
  Widget'lar arasındaki kenar boşluğu containerPadding: [4, 0] ile sağlanıyor.
- DEFAULT_LAYOUT yükseklikleri ekran görüntüsü piksel analizi ile güncellendi:
  Satır 1 h:14 (560px), Satır 2 h:16 (640px). Morning Note (w:5) / Portföy (w:7)
  genişlik düzeni korundu. Paper Trading minH: 10→3, minW: 8→4.
- resetLayout() butonu artık yeni DEFAULT_LAYOUT'u doğru yüklüyor.

GÖREV 22 — Pozisyon Fikirleri: status semantiği + tarih kolonları + R/R tooltip

A — Status semantiği:
  HISTORY_STATUSES kümesi ['stopped', 'tp3_hit'] → ['stopped', 'tp1_hit', 'tp2_hit', 'tp3_hit']
  olarak genişletildi. tp1/tp2 hedeflerine ulaşan pozisyonlar artık Geçmiş sekmesine
  düşüyor (daha önce Aktif'te kalıyordu). TradePlanWidget aynı kümeyi kullandığından
  seçili ticker'ın sekmesi otomatik doğru yere yönleniyor. Alpaca otomatik kapatma
  (bulk-import.ts) artık tp1_hit/tp2_hit/tp3_hit statuslerinde de market satış + açık
  emir iptali yapıyor.

B — Tarih kolonları:
  Backend (GET /api/ideas): ikinci bir agregasyon sorgusu ile her ticker için firstDate
  (MIN(date) — ilk öneri tarihi) ve endDate (MAX(date) WHERE status IN terminal statuses
  — bitiş tarihi) hesaplanıp response'a ekleniyor.
  Frontend: Aktif sekmesinde "Öneri Tarihi" kolonu; Geçmiş sekmesinde "Öneri Tarihi" +
  "Bitiş Tarihi" kolonları. Format: Türkçe kısa ay ("9 Tem 2026"), var(--mid) rengi.

C — Risk/Getiri tooltip:
  Kolon başlığının yanına IoInformationCircleOutline ikonu (13px) eklendi. Tıklanınca
  formülü açıklayan tooltip açılıyor: "(TP1 − Giriş) ÷ (Giriş − Stop), giriş için bant
  ortalaması kullanılır." Tooltip, overflow-auto scroll container'ın dışına kaçmaması için
  createPortal + position: fixed ile document.body'ye render ediliyor. Dışarıya tıklayınca
  kapanıyor (mousedown event listener).

GÖREV 23 — Light/Dark tema token sistemi + panel dark mode (grafik dahil)
Sıcak-antrasit bir dark tema, Tailwind v4'ün mevcut .dark variant'ı (@custom-variant dark
+ @theme inline) üzerine kuruldu. Tek bir .dark {} bloğu ham brand değişkenlerini (--bg/
--card/--ink/--mid/--faint/--faint2 + parlatılmış --green/--red/--blue/--amber) eziyor,
bunlar tüm shadcn semantic token'larına otomatik yayılıyor.

A — Token mimarisi (client/src/index.css):
:root'a yeni semantic accent katmanı eklendi — accent alias'ları (--up/--down/--info/--warn),
eşleşmiş badge tint arka planları (--*-tint), TP merdiveni (--tp1..3 + tint'leri), cam modal/
scrim (--glass-bg/--glass-border/--scrim) ve grafik token'ları (--chart-grid/--chart-axis).
Light değerler eski hardcoded hex'lerle birebir aynı (regresyon yok); .dark'ta accent'ler
parlatılıyor, tint'ler translucent rgba'ya dönüyor. @theme inline'a --color-*-tint eklendi.

B — Tema state + toggle (client/src/lib/theme.tsx):
ThemeProvider + useTheme(). İlk açılışta localStorage['eqr:theme'], yoksa
prefers-color-scheme. Toggle seçimi saklıyor. .dark class'ı document.documentElement'e
SENKRON uygulanıyor (setTheme içinde imperatif) — böylece hem portal'lı Radix dropdown'ları/
Portfolio cam modal'ı temayı izliyor, hem de child effect'ler (grafik) toggle sonrası doğru
paleti okuyor (React child effect'leri parent'tan önce çalıştığı için kritik). index.html
<head>'ine FOUC önleyici inline script eklendi (render öncesi class'ı basıyor). main.tsx
<App/>'i ThemeProvider ile sardı; DashboardWidgetControls'a Sun/Moon toggle butonu eklendi.

C — Widget migrasyonu:
IdeasTableWidget/TradePlanWidget/PortfolioWidget/PaperTradingWidget'taki ~95 hardcoded hex
inline-style + App logosu var() token'larına çevrildi (yapısal refactor yok, sadece hex→var).

D — Grafik dark mode (client/src/features/widgets/TradePlanChart.tsx):
lightweight-charts canvas tabanlı olup CSS değişkeni okuyamadığından, effect içinde
getComputedStyle ile aktif tema renkleri (concrete token'lar: --green/--red/--faint2/
--chart-axis/--tp1..3/--blue) somut string'e çözülüyor. theme effect deps'ine eklendi
([plan, theme]) — grafik zaten her değişimde tamamen yeniden kurulduğundan toggle'da doğru
renklerle rebuild oluyor. Off-chart rozetler var() + color-mix border kullanıyor.

E — Bonus fix: GÖREV 22'nin tp1/tp2_hit → Geçmiş değişikliğiyle açığa çıkan gizli etiket
hatası düzeltildi — TradePlanWidget geçmiş rozeti artık status'e göre TP1/TP2/TP3/SL'yi
doğru gösteriyor (eskiden ternary sadece TP3 veya SL üretiyordu).

GÖREV 24 - Layouts Kaydetme Fonksiyonu ve Trade Plan Görsel Düzenleme

Canlıya giden değişiklikler
İŞ 1: Trade Plan grafiği artık en güncel tarihli aktif idea ile açılıyor (ORCL gibi geçmiş öneriler Aktif'ten çıktı, tüm statü mantığı /api/ideas'e dayalı)
İŞ 2: Seviye tablosu tek bir pill satırına birleşti (etiket + fiyat + %); ayrı tablo kalktı
İŞ 3: Header'da Kaydet butonu; düzen layouts tablosuna cihaz/tarayıcı + tarih-saat olarak yazılıyor, o cihazda açılışta otomatik geri yükleniyor

GÖREV 25 - Portföy Durumu Widget Kompakt Mod

Portföy Durumu widget'ı artık varsayılan kompakt (sadece K/Z + tek satır analiz) açılıyor; "Daha Fazla Göster" ile Maliyet/Güncel Değer ve tam analiz genişliyor.

GÖREV 26 - Mobil tek-kolon reflow (stacked fallback)

DashboardCanvas sabit 12-kolon grid kullanıyordu; ekran daralınca widget'lar yan
yana sıkışıp okunamaz hale geliyordu (design-critique bulgusu). Kütüphanenin yerleşik
ResponsiveGridLayout'u yerine kalıcılığa dokunmayan "stacked fallback" tercih edildi:
- Yeni useMediaQuery hook'u (client/src/lib/use-media-query.ts, theme.tsx matchMedia
  desenini aynalıyor).
- DashboardCanvas'ta ≤768px'de GridLayout tamamen atlanıp widget'lar tek dikey kolonda
  render ediliyor (aynı WidgetFrame + widgetRegistry). Sıra, masaüstü layout'unun (y, x)
  değerine göre → mobil dizilim masaüstü yukarıdan-aşağı görünümüyle eşleşiyor. Her widget
  70vh sabit sarmalayıcıda, uzun içerik widget içinde scroll ediyor.
- WidgetFrame'e showHandle prop'u (default true) eklendi; mobilde false → sürüklenemezliği
  ima eden grip ikonu gizleniyor.
- Mobilde sürükle/boyutlandır ve onLayoutChange YOK → kayıtlı layout (localStorage +
  layouts DB) hiç değişmiyor; pencere genişleyince grid aynı düzenle geri dönüyor.
Yan fayda: mobilde tam genişlik sayesinde Pozisyon Fikirleri'nin "Durum" kolonu artık
görünür (masaüstündeki tablo taşması sorunu mobilde ortadan kalkıyor). 