# Geliştirme Günlüğü — EQR Dashboard

Kronolojik kayıt. Projenin **güncel** durumu ve kalıcı kurallar `CLAUDE.md`'de;
burası her kararın gerekçesi, ölçümü ve elenen seçenekleri için. Erken kararların
bir kısmı sonrakilerle değişti — çelişki görürsen **en yüksek numaralı GÖREV**
geçerlidir. (GÖREV 62'ye kadar CLAUDE.md'nin içindeydi; 21 Eylül 2026'da ayrıldı.)

BAŞLANGIÇ — İskelet (20 Haziran 2026)

Proje `dashboard-proje-brief.md` adlı bir brief'le başladı; o brief zamanla bu
panelin `CLAUDE.md`'sine dönüştü ve dosya ayrıca silindi (`96b9b63`). İskelet
altı adımda, her adım onaylanarak kuruldu (`1b9e819` → `d056d7e`):

1. React 19 + Vite + TypeScript, Tailwind v4 + shadcn/ui; brief'teki renk
   token'ları. Font Open Sans + JetBrains Mono (→ Inter, GÖREV 14).
2. react-grid-layout ile sürükle/bırak, yeniden boyutlanan widget canvas'ı,
   yerleşim localStorage'da (→ sekmeli çalışma alanı, GÖREV 27).
3. Express + Drizzle + Neon Postgres (pooled), dört içerik tablosu.
4. Beş widget: Morning Note, alım-satım tablosu, trade plan görüntüleyici,
   BIST ve ABD heatmap (heatmap'ler → GÖREV 17'de kaldırıldı).
5. `/admin`: tek textarea'ya JSON yapıştırılıp tabloya POST edilen içerik
   sayfası, `x-admin-key` korumalı.
6. Railway deploy yapılandırması + `DEPLOY.md` (o da `96b9b63`'te silindi;
   deploy notları CLAUDE.md'de).

GÖREV 1 — Widget başlık fontu
Widget başlık çubukları JetBrains Mono'dan Open Sans 600'e ve `--mid`'den
`--ink`'e alındı; sayısal değerler mono'da bırakıldı. *(Font → Inter, GÖREV 14;
başlıkların tamamı widget çerçevesiyle birlikte kalktı, GÖREV 27/48.)*

GÖREV 2 — Header'a tarih seçici
Seçilen tarih tüm widget'lara `/history` uçları üzerinden uygulandı; o güne
kayıt yoksa boş durum, "Tümünü Gör" filtreyi kaldırıp her tablonun en son
kaydına döndü. *(Dropdown'a çevrildi GÖREV 8, Nabız kendi adımlayıcısına geçti
GÖREV 12, genel tarih filtresi GÖREV 27'de kaldırıldı.)*

GÖREV 3 — "Morning Note" → "Piyasa Nabzı"
Yalnız görünen etiket değişti; bileşen, route ve tablo adları (`morning_notes`,
`/api/morning-notes`) aynı kaldı.

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


GÖREV 27 — react-grid-layout yerine 6 sekmeli çalışma alanı

Serbest sürükle-bırak canvas kaldırıldı. Yerine her sekmede en fazla iki panelin yan
yana durduğu sekmeli yapı geldi. Widget içerikleri, API'ler ve veri modeli değişmedi —
değişen kabuk.

- SplitPane: sürüklerken genişlik imleci serbest takip eder ve 25/50/75 kılavuz
  çizgileri görünür; bırakınca EN YAKIN preset'e oturur, ara değerde kalmak imkânsız.
- Panel başlığı sürükleme tutamacı. İmleç divider'ın öbür tarafına geçtiği AN takas
  olur, geçiş süresi 0. DOM sırası sabit, yalnız `flex order` değişir → remount yok,
  grafik ve scroll korunur.
- **Pointer capture kullanılıyor.** Capture olmadan tarayıcı başlığın üstünde kendi
  metin-seçme hareketini başlatıp `pointermove`'ları yutuyor ve sürükleme sessizce
  hiçbir şey yapmıyordu. Sentetik olaylarla test etseydik gözden kaçardı.
- ≤800px tek kolon; divider gizli, sürükleme kapalı.
- Kaldırılanlar: react-grid-layout + @types + process-shim + tüm `.react-grid-*` CSS'i,
  Framer Motion, widget ekle/kaldır menüsü, WidgetFrame, widget-registry, date-filter.
  Paket 586 → 464 kB.
- Header: Sıfırla/Kaydet geri geldi (`layouts` tablosuna `workspace-v1` etiketiyle;
  eski RGL satırları geri yüklemede yok sayılır), satır aralığı toggle'ı eklendi, son
  açık sekme hatırlanıyor, logo dönüşü CSS keyframe'e taşındı.
- Scroll'da header daralıyor (102→46px), yalnız sekme adları kalıyor. Sentinel +
  IntersectionObserver; `grid-rows: 0fr→1fr` ile doğal yüksekliğe animasyon.
- `useMediaQuery` `useSyncExternalStore`'a geçirildi. Bayat kalıp geniş ekranda
  yığılmış düzen render edebiliyordu; o durumda sağ panel tablonun çok altına düşüyor
  ve butonlar ölü görünüyordu.


GÖREV 28 — Sanal Portföy: PortfoyTakip uygulamasının içeri alınması

Ayrı bir mobil portföy uygulaması (`oytunbolukbasi/PortfoyTakip`) emekliye ayrılıyor.
İki uygulama zaten aynı veritabanını paylaşıyordu, dolayısıyla veri taşıma işi yoktu;
yapılan iş bir yazma yolu açmak ve fiyat boru hattını devralmaktı. Faz planı ve
kalan adımlar: **SANAL-PORTFOY-PLAN.md**.

- `portfolio-write.ts` ayrı modül olarak açıldı (`portfolio-client.ts`'teki "yeni bir
  yazma ihtiyacı çıkarsa ayrı ve açıkça adlandırılmış bir modülden geçmeli" notuna
  uyularak). Okuma istemcisi hâlâ yalnızca SELECT içeriyor.
- Kimlik doğrulama: scrypt + imzalı çerez, yeni bağımlılık yok. Parola koda yazılmaz.
- **Kısmi satış** eklendi — eski uygulamada yoktu, pozisyon ancak tamamen kapatılabiliyordu.
  Şema değişikliği gerekmedi; `closed_positions.quantity` zaten vardı.
- Fiyat boru hattı devralındı: hisseler 15 dk (Apps Script), fonlar hafta içi
  09:00/10:00 (Fintables + ScraperAPI, açılışta çekilmez — kota koruması).
- Analiz sekmesi: eski uygulamanın analytics sayfasındaki her metrik taşındı (yapay
  zeka görüşü hariç — içerik üretimi zaten daha iyisini yapıyor).
- **Kur yöntemi farkı:** eski uygulama ABD maliyetini bugünkü kurla, EQR alış anındaki
  kurla hesaplıyor; fark 23.480 TL / 1,70 puandı. Birini seçip diğerini gizlemek
  yerine toplam EQR'nin yöntemiyle verilip ikiye ayrılıyor (hisse hareketi + kur
  etkisi), çünkü tam ayrışıyor. "Hisse hareketi" satırı eski uygulamanın rakamını
  birebir verir.
- Genel Bakış ve Analiz **tek hesaptan** besleniyor (`computeAnalytics`). Ayrı bir
  `computeTotals` vardı; aynı etiketin altında farklı rakam çıkması an meselesiydi,
  kaldırıldı. `portfolio-calc.ts` artık yalnızca biçimlendirme.
- Doğrulama: `scripts/verify-analytics.ts` aynı metrikleri **doğrudan SQL** ile üretip
  karşılaştırıyor (on metrik, fark 0,0000). `scripts/compare-tabs.ts` iki sekmenin
  aynı sayıyı verdiğini kontrol ediyor.
- `window.confirm` yerine kendi modalımız. Tarayıcıya "başka iletişim kutusu gösterme"
  denmişse `confirm()` hiçbir şey göstermeden `false` döner; silme o zaman hiç
  denenmiyor ve buton ölü görünüyordu.
- Hap bildirimler (sağ üst, 3 sn, × ile kapanır) — yazma aksiyonları sessizce
  tamamlanıyordu.
- Pozisyon tablosunda Varlık ve İşlem sütunları sabitlendi. Sekiz sütun panel
  daraldığında satır aksiyonlarını sağ kenarın dışına itiyordu: DOM'da var, ekranda
  yok, tıklama arkadaki panele gidiyordu.

GÖREV 29 — Analiz: dönem özeti şeridi, dağılım grafiği, 12px punto tabanı

Üç iş; üçü de Analiz sekmesinde buluşuyor. Tasarım turu için `/design` canvas'ı
kullanıldı (üç yerleşim seçeneği yan yana çizilip biri seçildi).

A — Dönem özeti şeridi (`PeriodBand`, AnalyticsTab.tsx):
Tarih seçicinin ima ettiği ama göstermediği satır: seçili dönemde kaç pozisyon
açıldı, kaç tanesi kapatıldı. PortfoyTakip'te vardı, GÖREV 28'de taşınırken atlanmış.
- "Tümü"nde sayım olay değil DURUM olarak okunur ("17 açık pozisyon", "23 kapanmış
  pozisyon") — tüm zamanlar için açılma/kapanma bir dönem hareketi değil, portföyün hâli.
- Boş dönemde iki sıfır yazmak yerine "işlem yapılmadı".
- Renk yok: açılış/kapanış bir olay, yeşil burada kâr okunurdu.
- `analytics-calc.ts` → `openedCountPeriod`: açık pozisyonlara EK OLARAK o aralıkta
  alınıp yine o aralıkta satılanları da sayar. Eski uygulama yalnızca hâlâ açık olanlara
  bakıyor, aynı ay içinde kapanan pozisyonu hiç saymıyordu.
- `rangePreset()` date-range-picker'dan export edildi (şerit "Bugün"/"Bu ay" diyebilsin,
  seçicinin zaten gösterdiği tarihleri tekrarlamasın diye). `TabHeading`'e `below` slot'u.
- Sayımlar doğrudan SQL ile karşılaştırıldı: 17/23, bu ay 1/1, bugün 1/1, 2-3 Haz 0/1.

B — Tür dağılımı: yarım daire donut → yığılmış şerit (`AllocationBar`):
Donut'un yüksekliği veriye değil panelin GENİŞLİĞİNE bağlıydı; %75'te üç sayı
göstermek için 400px'i aşıyordu. Şerit her genişlikte ~45px. Pay yüzdeleri artık
lejantta; altındaki satırlar nokta ve yüzdeyi tekrarlamıyor (her bilgi bir kez).
Kart başlığı "Tür dağılımı" → **"Dağılım"**. Yeni tür eklenirse üç yer: `TYPE_LABELS`
(analytics-calc), `TYPE_COLOR` + `TYPE_SHORT` (AnalyticsTab) — şerit N segment çalışır.

C — 12px punto tabanı:
Panelde 12px altındaki 65 noktanın 48'i büyütüldü (kart etiketleri, K/Z satırları,
tablo alt satırları, form etiketleri, takvim hücreleri, sayfalama butonları).
Risk/Getiri rozeti 9 → 11px (12 mini-bar satırını taşırıyordu), Paper Trading tablo
başlıkları 10 → 11px (diğer tablolarla aynı). Durum rozetleri, grafik seviye etiketleri
ve `<th>` başlıkları bilerek bırakıldı — okunacak metin değil, işaret. Kural artık
Tipografi bölümünde yazılı.

Yan iş: `.prettierrc` eklendi ve `split.tsx`'teki `DEFAULT_SWAPPED` tamamlandı — Sanal
Portföy ve Analiz sekmeleri eklendiğinde güncellenmemiş, `npm run typecheck` kırıktı.

Ders (kendi hatam): prettier'ı ayar dosyası olmadan çalıştırdım, dört dosyayı repo'nun
kullanmadığı stile çevirdi ve 60 satırlık diff 800 satır oldu. Dosyalar HEAD'den geri
alınıp değişiklikler yeniden uygulandı. Bir biçimlendiriciyi ayarını doğrulamadan
çalıştırma.

GÖREV 30 — Sanal Portföy telefonda: kart listesi + bottom sheet (Faz 5B)

Tasarım turu `/design` canvas'ında yapıldı; üç yerleşim yerine tek bir yön
(kart + sheet) çizilip dört ekran üzerinden onaylandı.

Sorun: sekiz sütunlu tablo 375px'te **Varlık, Adet'in yarısı ve İşlem**'i
gösteriyordu. Değer, K/Z ve K/Z % — sekmeyi açma sebebi — yatay scroll'un
arkasındaydı; kesilen Adet ise yanlış sayı gibi okunuyordu (0,809883524 →
"0,8"). Üç ayrı scroll ekseni vardı: sayfa, panel gövdesi, tablonun yatayı.

- **`CARD_QUERY = '(max-width: 640px)'`** — `useMediaQuery` ile ayrı render
  dalı. Sınır `sm:` ile aynı tutuldu; iki farklı kırılma noktası taşımamak için.
  641–800px arası eskisi gibi: tablo, yığılmış paneller.
- **Kart** yalnız değer + K/Z taşır; kalan altı değer bir dokunuş ötede.
- **`BottomSheet`** (`client/src/components/ui/bottom-sheet.tsx`): scrim +
  alttan sheet, gövde kayar, footer sabit. Tam ekran sayfa yerine sheet, çünkü
  sheet her zaman bir SATIRDAN açılıyor — o satırın arkada görünür kalması
  hangi pozisyonda olduğunuzu söyleyen şey.
- Ekle / düzenle / sat üçü de aynı sheet'te; mevcut `PositionForm` ve
  `CloseForm` aynen kullanılıyor (form mantığı çoğaltılmadı).
- **Sheet state'i masaüstünün `mode`/`selectedId` ikilisinden AYRI.** İkisinin
  yaşam döngüsü farklı — masaüstü form paneli hep ekranda, sheet değil — ve tek
  state'te sheet açılışta kendiliğinden açılıyordu.
- Kapanan sekmesi de kart; dokunmak satış detayını ve kayıt silmeyi açıyor.

Aynı ekranın sıkışmaları (yan iş):
- Sayfa telefonda **41px sağa taşıyordu** (`scrollWidth` 416 / ekran 375):
  `TabHeading` satırı sarmalanmıyordu. Şüphelenilen sekme şeridi değildi —
  şerit zaten yatay kayan bir şerit, kesik görünmesinin sebebi bu taşmaydı.
- Kullanıcı adı + Çıkış başlıktan listenin altına indi; dört kontrol 327px'e
  sığmıyordu.
- Sekme şeridine **kısa etiketler** (Genel / Nabız / Fikirler / Paper / Portföy
  / Analiz): altısı da sığıyor, şerit artık hiç kaymıyor. Masaüstünde tam
  etiketler (`sm:` ile iki span).
- Form input'ları telefonda **16px** — iOS 16px altındaki alana odaklanınca
  sayfayı zoomluyor. Masaüstünde 13px.

Masaüstü tablosu, sıralama ve form paneli değişmedi.

GÖREV 31 — Pozisyon ekleme fiyat sayfasını beklemiyor

Telefondan bir pozisyon eklemek ~2 dakika sürdü. Satır aslında ilk saniyede
kaydedilmişti; bekleyen şey bir Google E-Tablosuydu.

`POST /manage/positions` şu sırayı **await** ediyordu:

| Adım | Süre |
|---|---|
| `registerSymbol` | 15 sn timeout |
| `refreshOnePrice` → `fetchSharePrices` | 3 deneme × 30 sn + backoff |

Toplam en kötü ihtimalle ~110 sn — hepsi de zaten commit edilmiş bir satır için.

**Kök sebep bir regresyon, kaynak arızası değil.** Yeniden deneme (3×30 sn) ve
`await registerSymbol`, GÖREV 28 sonrası fiyat yenileme yolunu düzeltirken
eklenmişti; ikisinin de bir istek işleyicisinin içinde oturduğu gözden kaçtı.
Kural: **yavaş ve oynak bir dış bağımlılık bir yazmanın kritik yolunda olamaz.**

- Fiyatlandırma yazıyı hiç bloklamıyor; sembol kaydı + okuma arka plana taşındı.
- `readSheet` timeout 30 → 60 sn. Ölçüm: aynı uç bir okumada 3,2 sn, diğerinde
  36,9 sn. Değişkenlik ~10 kat.
- Deneme/timeout artık çağıranın kararı (`FetchOptions`).
- Eş zamanlı okumalar tek isteği paylaşıyor (`inFlight`). Üç eş zamanlı çağrı
  ölçüldü: tek okuma, aynı sonuç nesnesi.
- Arka plan denemeleri 4/12/30 → 3/20/60/120 sn; istemci yoklaması
  6/18/35 → 8/25/60/120/200 sn. Eskiler ilk başarılı okumadan önce bitiyordu.

Ölçüm: `POST /manage/positions` **~110 sn → 200 ms** (uçtan uca, oturum açık
tarayıcıdan; test satırı hemen silindi, portföy 18 açık / 23 kapalı olarak
doğrulandı).

GÖREV 32 — Analiz: kur ayrıştırması ekrandan kalktı

"Açık pozisyon K/Z" altındaki iki satır kaldırıldı:

    ↳ hisse hareketi   −₺53.727
    ↳ kur etkisi       +₺25.974   (ABD pozisyonlarında)

Bu ayrıştırma GÖREV 28'de, EQR'nin rakamını emekliye ayrılan PortfoyTakip'in
rakamıyla uzlaştırmak için eklenmişti ("hisse hareketi" satırı eski uygulamanın
sayısını birebir veriyordu). O uygulama kapanınca satırların cevapladığı soru
da ortadan kalktı; geriye okuyucunun sormadığı bir soru soran iki satır kaldı.

- **Hesap duruyor.** `analytics-calc.ts` hâlâ `fromShares` / `fromCurrency`
  üretiyor, çünkü `scripts/verify-analytics.ts` bunları SQL ile karşılaştırıp
  ayrışmanın tam olduğunu doğruluyor. İkisi `unrealized`'a toplanmayı bırakırsa
  kur işleme mantığı kaymış demektir — bu yüzden silinmediler.
- Yöntemi açıklayan dipnot (panelin altında, "ABD pozisyonlarının maliyeti alış
  günündeki kurla…") KORUNDU; artık yöntemi anlatan tek yer o.

Aynı turda isabet oranı da taşındı: bölümün altındaki gri 12px satırdan
("İsabet oranı %59") **"Performans metrikleri" başlığının sağındaki rozete**
(`HitRate` — hedef ikonu + 12px etiket + 14px semibold sayı, `--neutral-tint`).
Rozet **renksiz**: hemen altındaki kazanan/kaybeden sayaçları zaten yeşil ve
kırmızı, ve toplamı boyamak %51'i "iyi" %49'u "kötü" gibi okuturdu. Görünürlük
renkten değil punto ve ağırlıktan geliyor. `SectionTitle`'a `right` slotu
eklendi; başlık `truncate`, rozet `shrink-0` — panel daralınca kenardan taşan
şey başlık olur, sayı değil. Dönem seçiliyken "Tüm zamanlarda N kapanış"
satırı altta kalır.

GÖREV 33 — Piyasa Nabzı: içindekiler paneli

İki küçük değişiklik, ikisi de aynı sebeple: bu panel bülteni tarayarak
okuduğunuz yer, dolayısıyla girdileri gövde metni gibi değil başlık gibi
görünmeli.

- **Kicker "Makro 01" → "01".** Makale gövdesi bölümleri zaten "01", "02" diye
  numaralandırıyordu; içindekilerde "Makro" yazmak ikisini farklı dile
  düşürüyordu. `kicker` yalnızca bu panelde kullanıldığı için değişiklik
  kaynağında (`note-sections.ts`) yapıldı.
- **Girdiler kalın ve `--ink`.** Eskiden hepsi `--mid` gövde metniydi. Hover
  rengi butondan `group-hover:` ile sürülüyor — span'e konan bir renk butonun
  hover'ını ezerdi.
- **"İçindekiler" başlığı kaldırıldı.** Bültenin bölüm başlıklarından oluşan
  bir liste, bültenin yanında dururken kendini anlatıyor. `nav`'ın
  `aria-label`'ı duruyor, yani ekran okuyucuda hâlâ adlandırılmış.

GÖREV 34 — Dağılım grafiğine kendi renk skalası

Şerit `--info` / `--up` / `--warn` kullanıyordu. Yeşil olan ABD payı, hemen
altındaki gerçekten yeşil-kırmızı K/Z çubuklarının yanında "kâr" okunuyordu:
iki grafik aynı dili konuşup farklı şey söylüyordu.

`--alloc-1..3` eklendi — mavi `#2563a8` · turuncu `#e09a10` · gül kurusu
`#c47aa4`; koyuda `#4a8fd1` · `#c08000` · `#c458a0`.

- **Renkler ölçülerek seçildi**, `dataviz` doğrulayıcısıyla: açıklık bandı,
  doygunluk tabanı, renk körlüğü ayrışması, karta karşı kontrast — her iki
  temada da 5/5.
- **Ek olarak `--down`'a uzaklık ölçüldü**, çünkü istenen gül kurusu zarar
  kırmızısına komşu bir hue. Aday taraması yapıldı; 15 eşiğini geçen tek
  kombinasyon bu çıktı (gül↔kırmızı ΔE 17,7 açık / 14,1 koyu).
- **Koyuda koyulaştırılır, parlatılmaz.** Panelin diğer accent'leri koyu temada
  açılır (`--green` #1a7a5e → #3fae86); dolgu markları için bu yanlış — açık
  zeminde doğru olan ton koyu kartta parlıyor. Doğrulayıcının koyu bandı
  L 0,48–0,67, yani bizim parlatılmış accent'lerimizin tamamının altında.
- **4. renk ayrılmadı.** Turkuaz ve mor adayları gül kurusuyla renk körlüğünde
  çakıştı; iki temada birden geçen bir dördüncü bulunamadı. Var olmayan bir tür
  için yanlış renk rezerve etmektense, Avrupa hissesi eklendiğinde çözülecek.

GÖREV 35 — Kullanıcı menüsü header'a taşındı

Kullanıcı adı ve Çıkış, Sanal Portföy'ün başlık satırında duruyordu. Oturum tek
bir sekmeyi kapıyor ama **panelin tamamına ait**; orada durunca o sekmenin kendi
kontrolü gibi okunuyordu ve zaten tazelik etiketi + yenile butonuyla dolu bir
satırı sıkıştırıyordu.

- `ProfileMenu` (`features/workspace/ProfileMenu.tsx`) header kontrollerinin
  **en sonuna** eklendi: ad + ⌄, altında tek bir "Çıkış yap" (`--down`).
  Masaüstünde kullanıcı ikonu YOK — adın yanında ikon, adın söylemediği bir şey
  söylemiyor. İkon yalnızca telefonda görünür, çünkü orada ad gizli ve tetikleyici
  tek başına bir ⌄ olurdu. Sol iç boşluk `sm:pl-3` ile korundu.
- **Oturum yoksa hiç render edilmez** — giriş yapmamış birinin header'ı eskisiyle
  birebir aynı.
- Telefonda tetikleyici yalnız ikon (`sm:` altında ad gizli); ad menünün içinde
  gösteriliyor. Dört ikon butonun yanına 90px'lik bir ad sığmıyordu.
- Scroll ve resize menüyü kapatır: header scroll'da katlanıyor, yani tetikleyici
  menünün ölçüldüğü konumdan kayıyor.
- **Elle yazıldı**, date-range-picker ile aynı gerekçeyle: tek öğeli bir popover
  bir buton, konumlanmış bir kart ve iki dinleyicidir.
  `@radix-ui/react-dropdown-menu` bağımlılıkta ve `components/ui/dropdown-menu.tsx`
  duruyor, ama ikisini de henüz hiçbir yer import etmiyor — tek bir öğe için
  paketi taşımaya başlamanın sebebi yok.

Giriş mantığı değişmedi.

GÖREV 36 — Tür seçici: native `<select>` yerine kendi bileşenimiz

Pozisyon formundaki Tür alanı tarayıcının `<select>`'iydi. Bir `<select>` kenarlığının
ötesinde biçimlendirilemez: oku ve açılan listesi işletim sistemi tarafından çizilir,
yani kontrol formun içinde misafir gibi duruyordu ve **koyu temada açık bir menü
açıyordu**.

`components/ui/select.tsx` — form input'larıyla birebir aynı görünen bir listbox:

- Ölçüm: tetikleyici ile gerçek input aynı — 34px yükseklik, 6/10 padding, 14px
  köşe, 13px punto (telefonda 16px, iOS zoom'u için).
- **Liste portal'lı ve `fixed`**, date-range-picker ile aynı sebeple: form,
  kayabilen bir panelin içinde; normal akıştaki bir menü panel tarafından kırpılır.
  Scroll ve resize listeyi kapatır.
- Yer yoksa yukarı açılır (`place()` alttaki boşluğu ölçer).
- Klavye: ↓/Enter/Space açar, ↑↓/Home/End gezinir, Enter seçer, Esc kapatır ve
  **odağı tetikleyiciye geri verir**, Tab kapatıp geçer.
- Fare hover'ı ile klavye imleci tek bir vurgu paylaşır — bir listede iki ayrı
  "şu anki satır" kafa karıştırır.

`FormState['type']` değerleri ve `TYPE_OPTIONS` etiketleri DB'nin `type` kolonuyla
aynı; seçenek listesi `TYPE_LABEL`'ın hemen yanında duruyor ki ikisi ayrışmasın.

GÖREV 37 — Almanya ve Kripto varlık sınıfları

İki yeni sınıf için önce taban değişti: kodda `type === 'us_stock'` diye
dallanan 12 yer vardı, hepsi tek bir para birimi haritasına indi.

**`shared/asset-types.ts`** — istemci ve sunucunun aynı cevabı verdiği tek yer.
Bir türün hangi para biriminde fiyatlandığı, değerinin liraya nasıl çevrileceğini
belirliyor; iki kopya birbirinden kayarsa hata fırlatmaz, sessizce yanlış para
raporlar. Vite'a `@shared` alias'ı, iki tsconfig'e de `../shared` eklendi.

- **Almanya:** mevcut Google Sheet'ten. Sheet bir GOOGLEFINANCE hücre listesi,
  ticker'ın hangi borsada işlem gördüğünü umursamıyor — yeni kaynak gerekmedi.
- **Kripto:** CoinGecko, anahtarsız, tek istekte tüm semboller. **Alpaca
  kullanılmadı**: XAUT listesinde yok (73 sembol tarandı) ve iki pozisyon için
  iki kaynak çalıştırmak tek kaynaktan kötü. Sembol→id haritası elle kurulu,
  çünkü CoinGecko'da onlarca coin aynı ticker'ı paylaşıyor ve sembolle arama
  sessizce başka bir varlığı döndürebilir.
- **Kur:** `getRates()` USD ve EUR'yu tek seferde getiriyor — bir pozisyonun para
  birimi satırlar okunmadan belli değil, pozisyon başına sormak satır başına bir
  istek demekti. `buyRate` kolonunun anlamı genişledi ("bu pozisyonun para
  birimi → TRY, alındığı gün"), şema değişmedi.

**Renk:** `--alloc-1..4`. Beşinci renk yok — `dataviz` doğrulayıcısıyla ölçüldü,
yeşil ve kırmızı dışarıdayken (burada kâr/zarar demek) beşli hiçbir set ayrışma
eşiğini geçmiyor. Bu yüzden BİST ve fon **her yerde** tek grup: "Borsa İstanbul
ve Fon". Bir sınıf panelin her yerinde tek renk ve tek isim (`GROUP_COLOR`).

**Kaldırılanlar:** `costBasisTRY` / `currentValueTRY` sunucuda hesaplanıyordu ama
istemcide hiç okunmuyordu; aynı parayı iki yerde hesaplamak zaten risk.

Yolda çıkan iki zaman dilimi hatası (ikisi de üretimde UTC olduğu için
görünmüyordu, ikisi de sunucunun saat dilimine bağlı çalışıyordu):

1. `buy_date`/`sell_date` okurken ham cast ediliyordu; `Date` olarak JSON'a
   gidip takvim gününü kaydırıyordu — 18 Haziran'da alınan pozisyon 17 Haziran
   görünüyordu. Artık `last_updated` ile aynı normalleştirmeden geçiyorlar.
2. **Daha kötüsü, kendi açtığım:** `writePrice` fiyatı yazmak için satırın
   tamamını geri yazıyordu. `toISOString()` zone'suz değeri yeniden çapaladığı
   için her fiyat yenilemesi alış tarihini yerel fark kadar geriye yürüttü;
   19 pozisyon bir gün kaydı, geri alındı. Kural: **bir fiyat yazması yalnızca
   `current_price` ve `last_updated`'a dokunur** (`updatePrice`).

GÖREV 38 — Almanya/kripto testinden çıkan üç düzeltme

1. **Borsa ön eki.** SAP hem Frankfurt'ta hem ABD'de işlem görüyor; çıplak
   `SAP` GOOGLEFINANCE'ta Amerikan fiyatını veriyordu. `FRA:SAP` olarak eklenince
   sheet doğru fiyatı getirdi ama panel "Sheet'te bulunamadı" dedi — çünkü Apps
   Script ön eki kırpıp satırı `SAP` anahtarıyla döndürüyor.
   Ön ek artık TÜRDEN geliyor (`EXCHANGE_FOR_TYPE`): kayıt `FRA:SAP` gönderiyor,
   arama `bareSymbol()` ile `SAP`'a bakıyor, DB her zaman çıplak saklıyor.
   Mevcut üç satır (`FRA:SAP`, `FRA:DTE`, `FRA:ENR`) çıplağa çevrildi.
   *Sınır:* sheet ticker başına tek satır tuttuğundan aynı sembolü iki borsada
   birden taşımak temsil edilemiyor.

2. **Kripto ondalıkları kırpılmıyor.** `DECIMALS` haritası türe göre basamak
   veriyor. Kırpma iki şeyi bozuyordu: girilmemiş bir adet basmak (0,32831331 →
   "0,3283") ve 14 sentlik bir pozisyonu "$0" göstermek. Hisse fiyatının ALT
   sınırı 2'de tutuldu — bunu unutunca "₺69,60" bir tur için "₺69,6" oldu.

3. **Kayıttan sonra form temizleniyor.** Alanlarda kaydedilen veri durunca
   "girmedim galiba" hissi veriyordu. Düzenleme formu değerlerini koruyor;
   o form düzenlediği pozisyona bağlı kalmalı.

GÖREV 39 — Piyasa Nabzı'nda Avrupa bölümü + talimatnamenin Frankfurt'a açılması

Portföyde artık EUR bazlı pozisyonlar var (GÖREV 37). Bunların değeri iki şeye
bağlı — hissenin kendi hikâyesi ve EUR/TRY — ve ikisi de genel makro
maddelerinin arasına serpiştirilmiş halde geliyordu. Almanya tarafına bakmak
isteyen okuyucu her sabah metin taramak zorundaydı.

**Panel:** `morning_notes.europe_bullets` (jsonb, nullable —
`drizzle/0005_add_morning_note_europe.sql`). `macroBullets` ile birebir aynı
`{label, detail}` biçimi. Alan boş ya da yoksa bölüm hiç çizilmez, dolayısıyla
mevcut bültenler etkilenmedi.

- Kicker `noteSections.ts`'te **tek yerde** kararlaştırılıyor. Makale gövdesi
  eskiden kendi dizin numarasını türetiyordu; içindekiler ile gövdenin bir
  bölümün adı konusunda ayrı ayrı anlaşması gerekiyordu.
- Avrupa girdileri numaranın yanında **kelimeyi de taşıyor** ("Avrupa 01").
  GÖREV 33 makro girdilerinden "Makro" kelimesini kaldırmıştı; burada kelime
  bölüm sınırını işaretlediği için duruyor.

**Talimatname (`panel-icerik-talimatnamesi.md`):**
- Almanya hisseleri birincil kaynak `yfinance` + `.DE` (`SAP.DE`); fallback
  Twelve Data `TICKER:XETR`. `.DE` yalnız sorgu içindir — panele **çıplak**
  ticker ve `exchange: "XETRA"` gider, `FRA:` ön ekini panel kendi ekler.
- ADIM 2 ikiye bölündü: genel makro → `macroBullets`, Avrupa/Almanya →
  `europeBullets`. O gün kayda değer bir şey yoksa `[]`; yer doldurulmaz.
- ADIM 3'te Frankfurt dipnot olmaktan çıkıp birinci sınıf av sahası oldu.
  Fiyatlar EUR verilir, dolara çevrilmez.
- **Kripto açıkça kapsam dışı.** Panelde varlık sınıfı olarak var ama haber
  taraması, fikir veya trade planı üretilmiyor; fiyatı panel kendi kaynağından
  çekiyor.

GÖREV 40 — İki temel skill talimatnameden çıkıp repo'ya taşındı

İçerik üretimi claude.ai'daki cowork agent'tan **bu repo'ya** alındı. Bunun
sonucu olarak `idea-generation` ve `morning-note` artık repo'nun kendi
skill'leri: `.claude/skills/eqr-idea-generation/` ve `.claude/skills/eqr-morning-note/`.
Talimatname 545 → 393 satır.

**Gömülü kopya bir tuzaktı ve dosya bunu kendi uyarısında yazıyordu:** *"metin
gözünün önünde olduğu için skill'i çağırmadan 'zaten biliyorum' deyip devam
etmek çok kolay."* Kopya yoksa ezberden uygulanacak bir şey de yok — uyarı
kopyayla birlikte silindi. Hatırlanması gereken bir kural yerine yapı halletti.

- **Metin olduğu gibi taşınmadı.** Gömülü bloğun çoğu jenerik tarama bilgisiydi
  (F/K sektör medyanının altında, ciro >%15 YoY…) ve bunu kopyalamak hiçbir şey
  kazandırmıyordu. Davranışı değiştiren kısım ADIM 3'e dağılmış EQR özeliydi;
  skill artık o: R:R ≥ 2,0 barı, izleme listesi, eleme tablosu, BİST/Frankfurt
  metrik uyarlaması, panel JSON çıktı biçimi.
- **`eqr-` ön eki zorunlu.** `equity-research` eklentisinin aynı adlı skill'leri
  de kurulu ve ad çakışmasında **eklenti kazanıyor** — ölçüldü: çıplak `Skill(idea-generation)`
  eklentinin jenerik İngilizce sürümünü yükledi, repo dosyası gölgede kaldı.
  Gerekçe iki `SKILL.md`'ye de yazıldı ki ileride "gereksiz ön ek" diye silinmesin.
- **Jargon tablosu ve JSON şeması talimatnamede kaldı.** İkisi de `ideas.thesis`,
  `ideas.invalidation` ve `portfolio_insight`'i kapsıyor; tek bir skill'e koymak
  diğerinden gizlerdi. Skill'ler oraya işaret ediyor — `shared/asset-types.ts`
  ile aynı gerekçe: aynalamak değil paylaşmak.

**Skill'in taşıdığı yeni kural (GÖREV 39 turundan çıktı):** kaynaklar bir veri
üzerinde çelişiyorsa sayıyı seçme — piyasanın ölçülebilir tepkisini yaz. O gün
ağustos istihdam rakamı için iki farklı sayı dolaşıyordu; bülten rakamı değil
tahvil faizinin bir yılın zirvesine çıkışını anlattı.

*Sınır:* oturum içinde eklenen skill'ler yeniden başlatılana kadar `Skill`
aracına görünmüyor.

Yan iş: `cowork-instructions-final.md` → **`panel-icerik-talimatnamesi.md`**. Adı
artık var olmayan bir ajanı işaret ediyordu. Referanslar (CLAUDE.md'de üç, iki
`SKILL.md`'de birer) güncellendi.

**İçerik yüklemek deploy GEREKTİRMEZ.** İkisi ayrı yol: içerik `POST /api/admin/bulk-import`
ile doğrudan çalışan uygulamaya gider, deploy yalnızca panel KODU değiştiğinde gerekir.
GÖREV 39'da ikisi aynı turda oldu — içerik yüklendi *ve* Avrupa bölümünü çizen kod
deploy edildi — ama bağlı oldukları için değil, aynı gün yapıldıkları için.


GÖREV 41 — Fon fiyatı altı basamak, Genel bakış tipe duyarlı oldu

YKT "₺0,90" görünüyordu; DB'deki değer **0,904355**. Değeri 1 civarında olan bir
fon için iki basamak bilginin neredeyse tamamını atıyor: kullanıcı paneldeki sayıyı
TEFAS ile karşılaştıramıyor, ve bir altın fonu tam bir günlük hareketi o atılan
basamakların içinde yapabiliyor.

- `DECIMALS`'a `fund` eklendi: `price 6` · `priceMin 2` (GÖREV 38 dersi — yoksa
  "₺1,00" bir tur "₺1" olur). Değer ve K/Z tam lira kalıyor; fon pozisyonu büyük
  bir TL sayısı.
- **Haritayı düzeltmek tek başına yetmedi.** `OverviewTab` tipe duyarlı değildi,
  çıplak `fmtMoney`/`fmtQty` çağırıyordu. Dört çağrı `fmtPriceOf`/`fmtQtyOf`'a
  çevrildi — bu ikinci bir hatayı da kapattı: **kripto adedi orada da kırpılıyordu**
  (SOL 3,14034628 → "3,1403"). Ders: tür bazlı bir kural varsa, o türü gösteren
  HER çağrı yerinin ortak fonksiyondan geçtiği kontrol edilmeli.

*Doğrulanamayan:* kazımanın TEFAS ile birebir aynı olduğu teyit edilemedi —
yerelde `SCRAPER_API_KEY` yok, Fintables doğrudan erişimi 403 veriyor. Depolanan
değerin tam hassasiyette olduğu ve zamanlayıcının 10:00'da çalıştığı doğrulandı.

*Açık soru (kullanıcıya bırakıldı):* fon 17 Şubat alışından bu yana −%7,91, ama
aynı dönemde TL bazında altın +%1,54 (ons 4.882,90→4.476,60 $, kur 43,72→48,42).
Fonun hareketi TL altına değil, **dolar bazlı altına** (−%8,32) yakın duruyor.


GÖREV 42 — Bayat önbellek artık tazelik damgasını tazelemiyor

Panelin fiyat göstergesinin varlık sebebi CLAUDE.md'de yazılıydı: *"Fiyat akışı
durursa panel sessizce yanlış göstermesin diye."* O koruma çalışmıyordu.

Kaynak çökünce üçü de (sheet · CoinGecko · Fintables) önbellekteki fiyatı
döndürüyordu — bu doğru, "bayat gerçek fiyat, boşluktan iyidir". Ama `refreshX`
bu değerleri `writePrice` ile geri yazıyor, `updatePrice` de her yazmada
`last_updated = now()` yapıyordu. Sonuç: panel "az önce güncellendi" diyor,
fiyat saatler öncesinin. Uzun bir kesintide kullanıcı hiçbir uyarı almazdı.

8 Eylül 2026'da Railway logunda görüldü: sheet aralıklı `HTTP 404` veriyordu
(Apps Script'in yönlendirdiği geçici adresin süresi doluyor, ~40 GOOGLEFINANCE
hücresi yeniden hesaplanırken). Üç deneme de düşünce önbellek yolu devreye
girmişti.

- **Kaynaklar artık cevabın ikinci el olduğunu bildiriyor** — `PriceMap
  { prices, stale }` ve `FundPrice { price, stale }`. TTL içindeki önbellek
  isabeti bayat DEĞİL: birkaç saniye önce başarılı bir okuma var.
- **Bayat cevapta zaten fiyatı olan satır yeniden yazılmaz** (`keepsStoredPrice`);
  damga korunur ve satır "kayıtlı fiyat korunuyor" diye atlanmış raporlanır.
  Hiç fiyatı olmayan yeni pozisyon istisna — orada bayat bir sayı boşluktan iyi.
- **Yeniden yazmak zaten hiçbir şey kazandırmıyordu:** önbellekteki değer
  tazeyken o satıra yazılmıştı. Tek yaptığı saati yalanlamaktı.
- `/api/portfolio/price-source` sağlık ucu önbellekten gelen cevaba artık
  `ok: true` demiyor — kontrol etmesi gereken şeyi yanlış raporluyordu.
- Zamanlayıcı kesintide 21 sembolü tek tek listelemek yerine tek satır yazıyor;
  önemli olan tek olgu kaynağın düştüğü.

**Test:** sahte bir sheet sunucusu önbelleğe kasten yanlış fiyatlar (1,11 / 2,22 /
3,33) yazdı, sonra 404'e döndü; canlı DB'ye karşı çalıştırıldı → bayat bildirildi,
**0 yazma, 21 koruma, değişen satır yok.** Eski kodda 21 satırın hepsi damgalanırdı.

*Ders:* bir düşme yolu (fallback) sessizce doğru veriyi bozmasa bile, o verinin
**ne kadar güvenilir olduğunu söyleyen sinyali** bozabiliyor. Fallback eklerken
"hangi değer dönüyor" kadar "bu değer nasıl etiketleniyor" da sorulmalı.


GÖREV 43 — Günlük analiz panelden çıkıp tam genişliğe taşındı

Analiz, Portföy panelinde "Hisse notları" ve "Geçmiş"in yanında **üçüncü bir
sekmeydi**. O ikisi aynı listenin iki hâli (açık / kapanmış pozisyonlar); analiz
ise bütüne dair bir metin. Üçünü kardeş yapmak "bunlar aynı türden seçim"
diyordu — değiller. İki bedeli vardı: ilk okunması gereken şey bir sekmenin
arkasında saklıydı, ve açınca pozisyon tablosu ekrandan kayboluyordu.

**Yerleşim:** blok KPI şeridi ile panellerin arasına, **tam genişliğe** alındı.
Önce paneli aşağı iteceği için çekince koymuştum; maddeli yazım bu hesabı
değiştirdi — bu genişlikte her madde tek satır, dar panelde her biri ikiye sarardı.
Yani tam genişlik israf değil, maddelerin çalışma koşulu.

- Sekmeler ikiye indi: **Aktif | Geçmiş** — panelin geri kalanının dili zaten bu
  (Pozisyon Fikirleri, Trade Planı, Sanal Portföy hepsi ikili). Üstelik eski
  isimler paralel bile değildi: biri içeriğin türünü, diğeri zaman durumunu
  söylüyordu.
- **Varsayılan açık.** Günün paranıza dair tek cümlesi bir tıklamayı hak etmemeli.
- **Tetikleyici yalnız blok kapalıyken görünür** — açıkken blok kendi ×'ini
  taşıdığı için iki ayrı kapatma noktası olurdu.

**İçerik:** `portfolio_insights.bullets` (jsonb, nullable —
`drizzle/0006_add_portfolio_insight_bullets.sql`). Analiz artık `summary` +
`bullets`, yani bültenin `topCall` + `macroBullets` yapısının **aynısı**;
okuyucu o biçime alışkın, ikinci bir şekil öğrenmesi gerekmiyor. Tek blok
paragraf olarak yazıldığı için okunmuyordu. Talimatnamede kural: 3-6 madde,
madde başına tek fikir, `summary` özet geçmez giriş yapar.

**Geriye uyumluluk ölçüldü:** `bullets` null bırakılıp render kontrol edildi —
blok yine çizildi, 0 madde, paragraf basıldı. Eski 23 kayıt bozulmuyor.

*Elenen seçenekler:* analizi **sağ panele** koymak (portföyün yazısını piyasa
tarafına taşır ve pozisyon detayı açılınca kaybolur); panel içinde **satır içi
açılır** yapmak (dar panelde maddeler sarar).

*Geri çevrilen istek:* analize Piyasa Nabzı'ndaki gibi **tarih adımlayıcısı**.
Kullanıcı sordu, birlikte vazgeçildi: rozetler de aynı kayıttan geldiği için
onların da geriye gitmesi gerekir, o zaman sağdaki Piyasa Nabzı bugünde kalır,
onun da gitmesi gerekir — zincir KPI kartlarına kadar uzuyor. Arşiv duruyor
(24 kayıt), istenirse ayrı bir yüzeyde ele alınır.

*Yan iş:* `origin` HTTPS'ten **SSH'a** çevrildi. Klasik/ince ayarlı token iki kez
403 verdi; sebebi token'ın kendisi değil, macOS Keychain'in eski bir kimlikle
cevap verip yeni token'a hiç uzanmamasıydı (GitHub'da "Never used" yazıyordu).
SSH'ta süre dolma derdi yok.


GÖREV 44 — Trade planı grafiği: ızgara kalktı, mum yerine bar, barlar nötr

Okunurluk turu. Üç değişiklik, üçü de aynı sebeple: grafikte **anlam taşıyan
şeyler öne çıksın**.

- **Kanvas ızgarası kaldırıldı.** Burada okunacak yatay çizgiler seviyelerdir:
  giriş bandı, TP merdiveni, hard SL. Izgara onlarla yarışıyordu; gidince
  seviyeler kendiliğinden öne çıktı.
- **`CandlestickSeries` → `BarSeries`** (açılış/kapanış çentikli OHLC barı).
- **Barlar tek renk ve nötr** — `--chart-bar`: açıkta `#1a1a18`, koyuda `#f0ede8`.

**Renk neden nötr:** yeşil/kırmızı "bu gün yükselerek kapandı" diyordu, ki barın
kendi şekli zaten söylüyor — üstelik **AYNI iki renk birkaç piksel ötede kâr ve
zarar demek**. Tek palet, iki anlam.

Yolda tek bir vurgu rengi (amber, sonra kullanıcının istediği `#FFDB58`) denendi
ve bırakıldı: grafik zaten **üç anlamlı renk** taşıyor (TP yeşili, giriş mavisi,
SL kırmızısı); dördüncüsü onlarla yarışıyordu. Kullanıcının ifadesiyle "renk
cümbüşü oldu".

**Ölçüm karara girdi:** `#FFDB58` koyu kartta 12,5:1 ama beyaz kartta **1,35:1** —
açık temada barlar kaybolurdu (grafik markı tabanı 3:1). Nötr değerler 17,4:1 ve
14,5:1. Renk isteği ölçülmeden uygulanmadı, sayılar kullanıcıya verilip karar
birlikte değişti.

*Tarihçe:* GÖREV 6 bar'a geçmiş, GÖREV 12 mum'a dönmüştü. Bu üçüncü tur ve
gerekçesi öncekilerden farklı: mum/bar tercihi değil, ızgara ve kontrast
okunurluğu.

*Bilinen, dokunulmadı:* off-chart TP rozeti fiyat skalası etiketiyle çakışabiliyor
(GÖREV 5'ten beri var). Izgara gidince daha görünür oldu ama sebebi bu değil;
rozet grafiğin köşesine, etiket kendi yerine sabitleniyor ve ikisi birbirini
bilmiyor.


GÖREV 45 — Oturum panelin tamamına yayıldı

Panel URL'i bilen herkese açıktı; yalnızca yazmalar korunuyordu. Tek kullanıcı,
tek kapı: `/api` altındaki her şey artık oturum istiyor. Bir odaya kilit takmak,
evin geri kalanı açıkken iş görmüyordu.

Kapının ÖNÜNDE kalan iki şey var ve yalnızca bu ikisi: `/auth` (oturum isteyen
bir kapıdan giriş yapılamaz) ve `/admin` (içerik hattının kendi kapısı). İki
mekanizma bilerek ayrı — admin anahtarı paneli açmaz, oturum da içe aktarıcıyı
açmaz.

Ölçüldü: oturumsuz `portfolio` / `ideas` / `morning-notes` / `trade-plans` /
`paper-trading` / `layouts` → **401**; `health` ve `auth/me` → 200;
`bulk-import` anahtarsız 401, anahtarlı 200 — **içerik akışı etkilenmedi.**

İstemcide giriş ekranı Sanal Portföy sekmesinden panel köküne taşındı
(`LoginScreen`). `/admin` sayfası bilerek açık bırakıldı: `x-admin-key` ile
korunuyor ve o ayrı mekanizma (kullanıcıyla mutabık kalındı).

GÖREV 46 — Header ayarları profil menüsüne toplandı

Header'da ad'ın yanında dört etiketsiz ikon buton vardı: sıfırla, kaydet, satır
aralığı, tema. Dört glif hangisinin ne olduğunu hatırlamayı gerektiriyordu ve
hemen üstündeki sekme şeridiyle aynı ağırlıktaydı — gereç, gezinmeyle yarışıyordu.

Dördü de **panelin bütününe ait ayarlar**, yani hesap menüsünün zaten olduğu şey.
Header'da yalnızca görünce anlaşılması gereken kaldı: tarih ve kim girmiş.

- Eylemler (kaydet/sıfırla) menüyü **kapatır** — tek seferlik, sonucu başka yerde
  görünür. Açma/kapama anahtarları **açık bırakır** — birini çevirip görmek için.
- `IconToggle` bileşeninin tek kullanıcısı bu dört butondu, silindi.

GÖREV 47 — Satır işlemleri hover'a geçti

Düzenle/Sat/Sil kendi sabitlenmiş "İşlem" sütunundaydı: 24 satırın hepsinde aynı
genişliği harcıyordu, oysa anında yalnızca bir satırda kullanılıyor. Dar panelde
o sütun Değer ve K/Z'yi — sekmeyi açma sebebini — görünür alanın dışına itiyordu.

- Butonlar satırın sonunda hover'da beliriyor; blur ve sola doğru solan geçiş
  alttaki sayıyı okunur bırakıyor. Hem açık hem kapanan pozisyon tablosunda.
- **Son hücreye bağlandı, satıra değil:** `<tr>` mutlak konumlu çocuk için
  güvenilir bir kapsayıcı değil, `<td>` öyle.
- **Maske piksel cinsinden, yüzde değil.** Şerit içindeki buton sayısı kadar
  geniş (açık pozisyonda üç, kapananda bir); yüzdeyle geçiş her tabloda başka
  yere kayardı. Ölçüldü: ilk buton 88px'de başlıyor, maske 80px'de tam opak.
- `backdrop-filter` elemanın kutusu boyunca eşit uygulanıp kenarında birden
  bitiyor — arka plan gradyanı ne kadar yumuşak olsa da blur düz bir çizgi
  çiziyordu. Çözüm elemanın kendisini maskelemek; maske filtrelenmiş sonucu da
  birlikte soldurur.
- Boşta kalan `.eqr-pin-r` CSS'i silindi.

*Yolda çıkan hata:* GÖREV 45'in giriş kapısı `IntersectionObserver` efektini
kırdı. Oturum yüklenirken `null` döndüğümüz için sentinel ilk render'da DOM'da
yok; efekt boş bağımlılık listesiyle bir kez çalışıp boş referans görüp çıkıyor,
oturum gelince bir daha çalışmıyordu — header scroll'da açık kalıyordu.
`[authenticated]` bağımlılığa eklendi.

GÖREV 48 — Piyasa Nabzı'ndan "EQR / GÜNLÜK ARAŞTIRMA" etiketi kaldırıldı

Sekmenin adı Piyasa Nabzı, panelin adı EQR, ve hemen altındaki başlık zaten aynı
şeyi söylüyor. Üç kez tekrarlanan bir şey bilgi taşımıyor.

GÖREV 49 — Panel takasına kısa bir kaydırma animasyonu

Paneller birbirinin yerine anında geçiyordu. Kullanıcının deyimiyle "kütük gibi".

**Kütüphane alınmadı** (dnd-kit önerilmişti, gerekmedi). İşin zorluğu şu:
`order` CSS ile geçişlenemez, ve takasın bir `order` değişimi olması GÖREV 27'de
bilinçli bir seçimdi — DOM sırası sabit kaldığı için panel remount olmuyor,
grafik ve scroll hayatta kalıyor. O kısıtı bozmadan animasyon yapmanın yolu
**FLIP**: panelin nereden gittiğini ölç, gideceği yere bıraksın, `transform` ile
geri koy, serbest bırak. 220ms, ~50 satır, bağımlılık sıfır.

**Çift `requestAnimationFrame` şart:** tek karede tarayıcı iki stil değişimini
tek hesaplamaya katlar ve hiçbir şey animasyon olmaz.

**CSS kuralı daraltıldı, kaldırılmadı — bu satırı okuyan dikkat etsin:**
```css
.eqr-split > * { transition: none !important; }   /* GÖREV 27 */
```
Animasyon ilk denemede hiç oynamadı, sebebi buydu. Gerekçesi yazılıydı: divider
sürüklenirken genişlik geçişli olursa panel imlecin gerisinde kalır ("sloppy
drift"). `!important` düşürüldü — genişlik hâlâ geçişsiz (bu sarmalayıcılara
kimse `transition` vermiyor, flex-basis'leri satır içi stilden geliyor), ama
satır içi `transform` geçişi artık geçebiliyor. **`!important`'ı geri koyan
animasyonu sessizce öldürür.**

Ölçüldü: takasta iki panelde de `transform` geçişi 0,22s (start + end),
sonrasında `transform: none`; divider sürüklemesinde **0 geçiş olayı**, snap
%75'e oturuyor; `prefers-reduced-motion` açıksa animasyon atlanıyor.

*Geri alma:* tek commit (`dab51ad`) — `useSwapAnimation` kancası, iki ref ve
`index.css`'te tek satır.

GÖREV 50 — Notlar: panelin içinde bir not defteri

Panel okunacak bir yerdi; artık üzerinde çalışılan bir yer. Panel güncelleme
özetleri, fikirler ve kendi notları aynı yüzeyde duruyor — başka bir uygulamaya
geçip bağlamı orada yeniden kurmak gerekmiyor.

**Yüzey.** Profil menüsündeki anahtarla açılan, şeritte ×'i olan bir sekme.
Kalıcı sekme yapılmadı — arkasında kuyrukta başka bir şey yokken yedinci bir
sekme, ara sıra açılan bir şey için şeridi sürekli meşgul ederdi. Kapatma
hatırlanıyor (`eqr2:notes-open`): `readTab()` "notes"u yalnız açıkken geri verir,
yoksa kapatılan sekme her açılışta geri gelirdi.

**Editör: BlockNote, yalnız ücretsiz katman.** Çekirdek MPL-2.0; `@blocknote/xl-*`
(çoklu kullanıcı, AI, dışa aktarma) GPL-3.0/ticari ve **kurulmadı** —
bağımlılıkta yoksa yanlışlıkla import edilemez.

- **`React.lazy` ile ayrıldı.** Ölçüldü: editör **271,86 kB gzip**, uygulamanın
  geri kalanı **164,17 kB**. Yani en ağır parça paneldeki her şeyin toplamından
  büyük; sekme açılana kadar hiç inmiyor, ilk boyama değişmedi. *Bu modül ilk
  boyamada çalışan bir yerden import edilirse kazanç biter.*
- **`@blocknote/core/fonts/inter.css` bilerek import EDİLMİYOR** — panel Inter'ı
  zaten yüklüyor, o stil sayfası aynı aileyi ~200 kB woff2 olarak tekrar çekiyor.
- **Token eşlemesi aşırı nitelikli bir seçiciyle yazılıyor**
  (`.eqr-note-editor.bn-root[data-color-scheme]`, özgüllük 0,3,0). Kütüphane
  paletini iki kuralda veriyor: `.bn-root` ve `.bn-root[data-color-scheme="dark"]`.
  Çıplak `.eqr-note-editor` birincisiyle **berabere** kalıp yalnızca kaynak
  sırasından kazanıyordu, ikincisine ise düpedüz kaybediyordu — koyu temada editör
  panelin kartı ve ink'i yerine kütüphanenin kendi `#1f1f1f`/`#cfcfcf`'ini
  taşıyordu. **Seçiciyi kısaltan koyu temayı geri kırar.**
- **`.bn-editor` sol iç boşluğu 48px, süs değil.** Sürükle ve `+` düğmeleri bloğun
  SOLUNDAKİ 48px'lik şeritte duruyor; o boşluk onların yaşadığı yer. Sıfırlanınca
  ikisi kartın dışına taştı. 48'de `+`'nın sol kenarı kartın 18px içinde — paneldeki
  diğer her satırla aynı hizada. (36px taşmayı durduruyordu ama kenardan 6px
  kalıyordu.) Sağ tarafta yer açılacak bir şey yok, o yüzden yalnız sol.

**Kenar çubuğu.** Bölümler ve içlerindeki sayfalar; sabitlenenler en üstte ayrı bir
grupta. Satır fiilleri (yeniden adlandır · sabitle · sil) hover'da beliriyor —
GÖREV 47 ile aynı kalıp.

- **Sayfa yeniden adlandırmanın kendi tetikleyicisi var, bölümünkinin yok.** Bir
  bölümün başlığı yalnızca başlıktır (aç/kapa'yı chevron yapar), dolayısıyla
  doğrudan yazılabilir bir kutu olabilir. Bir **sayfanın başlığı ise sayfayı açan
  düğmenin kendisi**; aynı muamele tek tıklamayı iki anlama sokardı — notu açmaya
  nişan alırken adının içine imleç düşerdi. Bu yüzden kalem düğmesi + başlığa çift
  tıklama, ve düzenleme sırasında satır tıklamayla açılmıyor.
- Düzenleme açılınca ad **tamamen seçili** geliyor; kutu var olan bir adın üzerinde
  açılıyor ve çoğu zaman yapılan şey üzerine yazmak.
- **Silme `window.confirm` değil, panelin kendi modalı** (`useConfirm`). GÖREV 28'de
  yazılmış sebep: tarayıcıya "başka iletişim kutusu gösterme" denmişse `confirm()`
  hiçbir şey göstermeden `false` döner, silme hiç denenmez ve buton ölü görünür.

**Enter bir odak olayına bağlı olamaz.** `InlineTitle` yalnızca blur'da kaydediyordu
ve Enter da sadece blur tetikliyordu. **Pencere odakta değilken tarayıcı
blur/focusout'u hiç ateşlemiyor** — `document.hasFocus()` false iken yeniden
adlandırma sessizce düşüyordu, istek bile gitmiyordu. Enter artık doğrudan commit
ediyor; blur "başka yere tıklayıp çıkma" yolu olarak duruyor. Bir mandal ikisinin
aynı düzenlemeyi iki kez kaydetmesini engelliyor; mandalı **hem odak hem yazma**
sıfırlıyor — odak olayının gelmediği durum zaten bu mandalın var oluş sebebi.

**Otomatik kayıt.** Yazma durunca 800 ms sonra. `SavedFlash` "Kaydedildi" yazıp
soluyor: kalıcı bir etiket okunmaz hale gelir ve o zaman bir hatayı da bildiremez.
`at` boolean değil **zaman damgası** — art arda iki kayıtta solma yeniden başlamalı,
true→true React'in görebileceği bir değişiklik değil.

**API.** `GET /api/notes` kenar çubuğunun tamamını tek istekte verir ama **gövdeleri
dışarıda bırakır**: liste küçük, gövde değil; başlıkları çizmek için her notu
yüklemek yanıtı yazılan her sayfayla büyütürdü. Gövde `GET /pages/:id` ile tek tek
gelir. Başlık/gövde/sabitleme **tek PATCH**'te — otomatik kayıt her yazma molasında
ateşleniyor, üç ayrı route editörün tek sayfa saydığı şey için üç gidiş-dönüş olurdu.

**Test edildi (yerelde, canlı DB'ye karşı):** bölüm/sayfa oluşturma · içerik otomatik
kaydı · `SavedFlash` 1467 ms görünür · yeniden adlandırma (kalem, çift tıklama,
Enter, Escape; bölümde üst üste iki kez) · sabitleme · sayfa silme · bölüm silme +
cascade · "Vazgeç" hiçbir satıra dokunmuyor · açık ve koyu temada token'lar.

*Ölçüm dersi:* testin kendisi üç kez yanlış rapor verdi — `innerText` CSS
`uppercase`'i uyguladığı için "Sabitlenenler" bulunamadı (Türkçe'de "SABİTLENENLER"),
ayrı script çağrıları arasında seçim dağıldığı için yazılan metin ortaya düştü, ve
odaksız pencerede blur ateşlenmedi. Üçü de ölçüm aracının kusuruydu; ikincisi
düzeltildikten sonra üçüncüsü gerçek bir ürün kırılganlığını açığa çıkardı.

GÖREV 51 — Grafikte sağ boşluk, açık temada daha yumuşak bar, satırlarda solan yıkama

Üç okunurluk düzeltmesi. İkisi grafikte, biri portföy tablolarında; üçü de
ölçülerek yapıldı, göz kararıyla değil.

**A — Seviye etiketleri artık barların üstünü örtmüyor.**

Bir `createPriceLine` başlığı fiyat skalasına değil, **panelin içine**, sağ
kenarına çizilir — kütüphane ona yer ayırmaz. `fitContent()` barları tüm
genişliğe yayınca en yeni barlar, yani bakmak için grafiği açtığın barlar,
"Giriş — 101,50" ve "Hard SL — 93,00"un arkasında kalıyordu.

Mantıksal aralık artık son barın ötesine, en geniş etiketi geçecek kadar
uzatılıyor. Etiket genişliği karakter sayısından **tahmin edilmiyor, kanvasla
ölçülüyor**: metinler Türkçe ve değişken ("TP1 — 116,00" ile "Hard SL — 93,00"
uzunluklarının ima ettiğinden fazla farklı), panel de yeniden boyutlanabiliyor.

*Yolda yapılan hata, ölçüm yakaladı:* dolgu ilk sürümde **mevcut** bar
aralığına göre hesaplanıyordu. Ama dolguyu uygulamak grafiği sıkıştırıyor, yani
hesap kendi yarattığı sıkışma kadar eksik kalıyor — 18 pikselin 18'i duruyordu.
Dolgu artık **nihai** ölçeğe göre çözülüyor:
`barSayısı × gereken ÷ (panelGenişliği − gereken)`.
Ölçüm: son barın sağ kenarı 360 px → **345,5 px**, en geniş etiket kutusu
342 px'de başlıyor. Kalan ~3 px'in görsel karşılığı yok; o kutu ("Hard SL")
panelin dibinde, son barlar ise ortada.

*Sınır:* dar panelde dolgu grafiğin yarısıyla sınırlanır — sıkıştırılmış bir
grafik, örtülmüş bir etiketten kötüdür.

**B — Açık temada bar rengi `#1a1a18` → `#4a4a46`.**

Neredeyse siyah barlar göz yoruyordu. Kontrast **17,43:1 → 8,90:1**: yarı
yarıya yumuşuyor ama grafik markları için gereken 3:1 tabanının çok üstünde
(GÖREV 44'te ölçülmüştü). Renk dışarıdan gelmiyor — panelin sıcak gri
rampasında `--ink` ile `--mid`'in tam ortasına düşüyor. **Koyu tema
değişmedi**; orası `#f0ede8` ve 14,5:1.

**C — Portföy satırlarında solan yıkama (`.eqr-row`).**

Bildirilen şikâyet "hover rengi sadece hisse adı kutusunda kalıyor ve orada
keskin kesiliyor"du. Kesilmiyormuş — **boyanan tek yer orasıymış.**

`<tr>`'ye satır içi `background` veriliyordu; **satır içi stil stylesheet
kuralını yener**, dolayısıyla `hover:bg-bg` hiç uygulanmıyordu. Ekranda görünen
renk yalnızca `.eqr-pin-l`'in kendi kuralından geliyordu ve o da sabitlenmiş
hücrenin sınırında bitiyordu. Arka plan CSS'e taşındı.

> Bu, günlükte artık **üçüncü** kez karşılaşılan tuzak: GÖREV 47'de blur
> şeridi, GÖREV 49'da takas animasyonu, burada satır yıkaması. Kural:
> **etkileşimle değişen bir görsel özellik satır içi stile yazılmaz.**

- **Hover ve seçili tek görünüm.** Önce ikisini ayırmıştım (hover solan, seçili
  düz); kullanıcı tek görünüm istedi ve haklı: ikisi de "bu satır" diyor, iki
  ayrı görünüm tabloyu aynı soruya iki ağızdan cevap verdiriyordu.
- **Sağa doğru sönüyor**, düz dolmuyor: sağ uçta satır aksiyonlarının bulanık
  şeridi var (GÖREV 47) ve satırı okuma sebebin olan sayılar orada.
- **Plato %55'e kadar düz**, çünkü Sanal Portföy'ün sabitlenmiş sütunu o
  bölgede kalmalı, yoksa düz hücre ile solmaya başlamış gradyan arasında dikiş
  görünür. Ölçüldü: sütunun payı 1127px'de %33,7, 700px'de %20 — panel
  daraldıkça **düşüyor**, çünkü sütun içeriğiyle boyutlanıyor.
- Aynı sınıf **Genel bakış'taki portföy widget'ında da** kullanılıyor; orada da
  aynı satır içi stil hatası vardı ve hover hiç çalışmıyordu.

*Yanlış çıkan beklenti, ölçülüp söylendi:* bu değişikliğin `BEKLE` / `SAT`
rozetlerini okunur kılması bekleniyordu. Kılmaz — rozetler **kendi opak
çiplerinin** üzerinde durur, arkalarındaki satır ne yaparsa yapsın metin
kontrastı değişmez (BEKLE metni kendi çipine karşı 5,50:1, eşiği geçiyor).
Silik görünmelerinin sebebi çipin kendisi: karta karşı **1,11:1**, yani rozet
bir çip gibi değil soluk bir yazı gibi okunuyor.

**D — `POZİSYON ARTIR` rozeti yeşilden amber'a.**

Eşiğin altında kalması (4,30:1) bulgunun yalnızca görünen yüzüydü. Rozet TP
merdiveninin yeşilini (`--tp3`) ödünç alıyordu ve bu, `KISMİ KÂR AL` ile
**birebir aynı metin rengi**: birbirinin zıddı iki talimat — "daha koy" ve "bir
kısmını al" — tek ağızdan konuşuyordu. Ayıran tek şey çip tonuydu, o da karta
karşı 1,11:1, yani pratikte hiçbir şey ayırmıyordu.

`--warn` bu haritanın harcamadığı tek accent'ti ve "burada yapılacak bir şey
var" diye okunuyor. Ölçüm: **4,81:1 açık · 5,82:1 koyu** (eski yeşil açıkta
4,30:1). `--tp3` duruyor — TP merdiveni onu asıl işi için kullanmaya devam
ediyor, yalnız rozet oradan ayrıldı.

*Elenen aday ve dersi:* sabit koyu amber `#8a5800` açık temada daha iyiydi
(5,70:1) ama koyuda **2,17:1**'e çöktü. Sabit bir hex temayı takip edemiyor;
rozetin iki yarısı da bu yüzden token. Ölçüm `shared.tsx`'teki yoruma yazıldı
ki ileride "daha koyusu daha okunur olur" diye sabit renge dönülmesin.

*Nasıl bakıldı:* panelde `POZİSYON ARTIR` örneği yoktu. Portföye örnek pozisyon
eklemek işe yaramazdı — rozet pozisyondan değil `portfolio_insights.actions`'tan
geliyor, yani canlı içeriğe de yazmak gerekirdi; üstelik yerel sunucu canlı
veritabanına bağlı. Adaylar bunun yerine panelin kendi token'larıyla **DOM'a
geçici olarak enjekte edilip** iki temada da karşılaştırıldı: veriye ve koda
dokunmayan, yenileyince kaybolan bir önizleme.

*Yan iş:* `--chart-grid` token'ı silindi. GÖREV 44 ızgarayı kaldırmıştı ama
tanım kalmıştı; hiçbir yerden okunmayan bir renk token'ı, yeniden uygulanmayı
bekleyen bir karar gibi duruyor.

GÖREV 52 — Fon fiyatı TEFAS'tan doğrudan; bayat pozisyon artık adıyla görünüyor

Kullanıcı "YKT fiyatı neden güncellenmemiş?" diye sordu. İki ayrı şey çıktı ve
ilki bizde değildi.

**A — Kazıma zinciri koptu, boru hattı doğru davrandı.**

Railway logu kesin: zamanlayıcı iki fon slotunda da saniyesinde çalıştı
(06:00:50 ve 07:00:48 UTC = 09:00 ve 10:00 TR), kazıma ikisinde de
`HTTP 500` aldı. ScraperAPI paneli tamamladı: aynı URL için **45 ve 46
deneme**, "Request failed after automatic retries". Yani kota bitmemişti,
hesap kapanmamıştı — **Fintables engelliyordu**, ve her denemede kotadan
45+ istek yanıyordu.

GÖREV 42'nin koruması tam tasarlandığı gibi çalıştı: çekemediği bir fiyatı
yeniden damgalamadı, cumadan kalma değeri olduğu gibi bıraktı. Panel yalan
söylemedi — söyleyemediğini de söyleyemedi, bkz. B.

**Çözüm: aracıyı atmak.** `fund-price.ts` "TEFAS'ın açık API'si yok" diye
açılıyordu; yazıldığında doğruydu ve tüm düzeneğin sebebi buydu. TEFAS o
zamandan beri sitesini Next.js uygulamasına çevirdi ve kendi sayfaları düz bir
JSON ucu çağırıyor: `POST /api/funds/fonFiyatBilgiGetir`,
gövde `{fonKodu, dil, periyod}`.

| | Fintables + ScraperAPI | TEFAS doğrudan |
|---|---|---|
| 14 Eylül sonucu | 45-46 deneme, HTTP 500, fiyat YOK | `0.884321` |
| Süre | dakikalar | **182 ms** (gerçek kod yolu, yerelde) |
| Kimlik bilgisi | API anahtarı | **yok** |
| Kota | metreli | yok |

**Fintables'ın bu veriyi yeniden sattığı kanıtlandı:** TEFAS'ın 11 Eylül değeri
`0.892774`, bizim kayıtlı değerimizle birebir aynı.

- Uç **tarayıcının ağ trafiği izlenerek** bulundu, tahminle değil. İlk iki
  tahmin (`/api/DB/BindHistoryInfo`, sonra gövde varyantları) "Method not found"
  ve "Sistem Hatası" döndü; doğru gövde ancak sitenin kendi `fetch`'i sarmalanıp
  bir dönem düğmesine basılarak yakalandı.
- **`Authorization` GÖNDERİLMİYOR.** Site bir bearer token yolluyor; uç onsuz da
  aynı cevabı veriyor (ölçüldü). Başkasının sayfasından kopyalanan bir kimlik
  bilgisini kullanmak, bize verilmemiş bir yetkiyi ödünç almak olurdu.
- **Son satır alınır, "bugün" diye filtrelenmez.** Fon fiyatı gecikmeli
  yayınlanır ve hafta sonu hiç yayınlanmaz; "TEFAS'ın elindeki en yenisi" her
  zaman doğru olan tek cevap.
- **Fintables silinmedi, fallback oldu** — tek kaynak bir tedarik değildir.
  Yalnız TEFAS düştüğünde çalışır ve çalıştığını loga yazar. Kullanıcı
  ScraperAPI hesabını bu yüzden açık tuttu (ücretsiz katman).

**B — Asıl hata bizdeydi: panel doğruyu biliyordu ama göstermedi.**

Tazelik göstergesi `Math.max(...times)` kullanıyordu — yani **en TAZE** satırın
yaşını raporluyordu, izlenmesi hiç gerekmeyen satırın. Ölçüldü: etiket
"3,2 saat önce" derken YKT **86 saat** eskiydi. 22 taze pozisyon bir bayatı
arkasına saklıyordu.

En can alıcısı, o fonksiyonun kendi yorumu şunu diyordu: *"yenileme işi durursa
paneldeki her sayı otoriter görünmeye devam eder; yaşı göstermek bunu görünür
kılar."* Tam da yapamadığı işi tarif ediyormuş. GÖREV 42 dürüst sinyali boru
hattına koydu, arayüz onu `Math.max` ile attı.

- `stalePositions()` her pozisyonu **kendi kaynağının ritmine** göre ölçer:
  sheet ve kripto 3 saat, fon 48 saat. Tek eşik ya fonu her öğleden sonra bayat
  ilan ederdi (fon zaten günde bir güncellenir) ya da sheet saatlerdir ölmüşken
  susardı.
- Başlık en tazeyi göstermeye devam eder; bayat olanlar **adıyla** eklenir
  (`⚠ YKT 3 gün`). İkiden fazlaysa sayıya düşer, yoksa başlık listeye döner.

*Ders:* bir sinyali üretmek yetmiyor, onu **taşıyan yolun her halkasını**
kontrol etmek gerekiyor. Boru hattı doğru sinyali üretti, arayüz bir tek
fonksiyon çağrısıyla onu yok etti ve kimse üç gün fark etmedi.

*Yan iş:* bugünkü fiyat (`0.884321`) panele elle yazıldı — yalnız
`current_price` ve `last_updated`, GÖREV 37 kuralı gereği; alış tarihi
(17 Şubat) korunduğu doğrulandı.

*Açık, ertelendi:* kota artık kısıt olmadığı için iki şey gevşetilebilir —
fonun günde iki kez çekilme zorunluluğu ve "elle yenile butonu fonu yenilemez"
kuralı (GÖREV 28'den beri kota koruması olarak duruyor).

GÖREV 53 — "Günlük analizi göster" butonuna kenar parıltısı, logo maviye döndü

Analiz bloğu kapatıldığında başlıkta kalan tek yol bu buton; küçük, mavi bir
metin olduğu için gözden kaçıyordu. Üç küçük değişiklik:

- **İkon:** `IoDocumentTextOutline` → lucide `MessageSquareQuote`. "Belge"
  değil "yorum" diyor — bloğun içeriği de bu.
- **Kenar parıltısı (`.eqr-glow`, index.css):** butonun arkasında 1,5px taşan,
  kayan bir gradyan; `::after` içini sayfa zeminiyle (`--bg`) geri örtüyor,
  geriye yalnız kenar kalıyor. Açılışta bir kez yanıp ~3 sn'de söner, hover ve
  klavye odağında yanık kalır.
  - **Renkler tek accent'ten türetilir** (`--info` ve onun `color-mix`
    açık/koyu tonları) — örnekteki gökkuşağı değil. Temayla birlikte döner.
  - **Bulanıklık YOK, bilerek.** İlk sürümde `blur(5px)` vardı; gradyanı
    butonun dışına yayıp gölge gibi okunuyordu, buton sayfanın üstünde
    yüzüyordu. Panel düz — blur'u geri koyan bunu geri getirir.
  - Butonun 1px'lik şeffaf kenarlığı kalktı, iç boşluk 1px artırıldı:
    yükseklik ölçüldü, önce ve sonra 29,5px.
  - `prefers-reduced-motion`: kayma ve açılış animasyonu kapalı, hover'da
    kenar yine yanar.
  - Blok × ile kapatılınca buton yeniden mount olduğu için açılış animasyonu
    o an da bir kez oynar — kasıtlı: bloğun nereye gittiğini gösteriyor.
- **Header logosu yeşilden `--info` mavisine** (`text-info`). Logo `--up`
  kullanıyordu; panelde yeşil kâr demek. Giriş ekranındaki logo zaten maviydi,
  ikisi artık aynı.

GÖREV 54 — Aksiyon rozetlerine ikon

Portföy widget'ındaki not rozetleri (`ActionBadge`, `shared.tsx`) artık bir
ikon taşıyor: BEKLE `Clock7` · KISMİ KÂR AL `BadgeCheck` · SAT `CircleStop` ·
POZİSYON ARTIR `CirclePlus`.

- **İkon rozetin içinde ve rozetin kendi renginde** (`currentColor`). Beşinci
  bir renk eklemiyor; rengin söylediğini renkleri ayıramayan okuyucu için
  tekrarlıyor.
- 12px, `gap-1`. Rozet yüksekliği ölçüldü: önce ve sonra 22,5px — satırlar
  kaymadı.
- **Bilinmeyen aksiyon ikonsuz çizilir**, tahmin edilmiş bir ikonla değil.
  Panelde "KÂR AL" ya da "İZLE" diye bir aksiyon yok (geçerli dört aksiyon
  talimatnamede ve `verify-insight.ts`'te); eklenirse haritaya da girmeli.

GÖREV 55 — Panel genişliğine üçte birler eklendi

Divider'ın oturabildiği kademeler üçten beşe çıktı: **¼ · ⅓ · ½ · ⅔ · ¾**
(`PRESETS`, `split.tsx`).

- **Tam üçte bir, yuvarlanmış %33 değil** (`100 / 3`, `200 / 3`). Kademenin
  var oluş sebebi "üçte bir / üçte iki" bölmesi; yuvarlanmış değer iki paneli
  o orandan gözle görülür biçimde kaydırıyordu. Kayıtta 33,333… durur,
  `isWorkspaceLayout` yalnız `number` baktığı için Kaydet/geri yükleme etkilenmez.
- **%50 etrafında simetrik**, dolayısıyla kademe sayısı hep tek: ortayı
  bırakmadan iki tarafa eşit seçenek vermenin yolu bu. İstenen "6 kademe"
  bu yüzden 5 oldu, kullanıcıyla birlikte seçildi. %20/%80 de önerildi ve
  elendi — 1280px ekranda ~250px, portföy tablosu orada okunmaz.
- Eski kayıtlar (25/50/75) hâlâ geçerli kademe; migration yok.
- **Test:** 13 bırakma noktası (%20–%90) sentetik pointer olaylarıyla — hepsi
  en yakın kademeye oturdu, geçiş noktaları iki kademenin tam ortası
  (29,2 · 41,7 · 58,3 · 70,8); ekrandaki genişlik kayıtla birebir. Takaslı
  düzende %36 → ayırıcı ⅓'te. Kılavuzlar sürüklerken beşte de çıkıyor.
  *Ölçüm dersi:* tarayıcı aracının `left_click_drag`'i koordinatları tutarsız
  aktardı (aynı sürükleme bir okumada ¾, diğerinde ⅔); pointer olaylarını
  divider'a doğrudan göndermek aynı kod yolunu belirsizliksiz sınadı.

*Bilinen, dokunulmadı:* ⅓ ve ¼'te Genel bakış'taki portföy tablosunun Not
sütunu kırpılıyor ("BEKL…"). Dar genişlikte Son fiyat sütununu gizlemek bir
seçenek.

GÖREV 56 — Piyasa Nabzı telefonda: içindekiler katlandı, iç kaydırma kalktı

Telefonda bülteni okumak fazladan çaba istiyordu ve sebebi iki ayrı şeydi.
Ölçüldü (375×812): içindekiler **545px**, makale sayfanın **768.** pikselinde
başlıyor — yani ilk ekranda bültenin kendisi hiç yok, yalnız neler
anlatacağının listesi var. Üstüne makale `maxHeight: 78vh` + `overflow:auto`
ile **kendi içinde** kayıyordu: 633px'lik pencerede 3.736px içerik. Sayfa da
kaydığı için aynı hareket, parmağın nereye denk geldiğine göre farklı şey
yapıyordu.

- **İç kaydırma yalnız masaüstünde.** Yığılmış düzende (`STACK_QUERY`) makale
  doğal boyunda akar, tek kaydırma sayfanındır. Masaüstü değişmedi (ölçüldü:
  78vh, `overflow:auto`, atlayınca bölüm makalenin 12px altında).
- **İçindekiler telefonda katlanır tek satır** ("9 başlık", 46px). Açılır,
  bir başlığa dokununca kapanır ve atlar. Makale artık 269px'te başlıyor.
- **Atlama kapanmayı bekler** (`requestAnimationFrame`): açık liste,
  istenen bölümü ekrandan aşağı itiyordu.

**Yapışkan header, atlamayı iki kez bozdu — kalıcı ders:**
`header` `sticky` ama **akışın içinde**; sayfa tepeden ayrılınca 102px'ten
46px'e katlanıyor ve altındaki HER ŞEY 56px yukarı kayıyor. Dolayısıyla
atlamayı o anki header yüksekliğine göre hesaplamak yetmiyor:
1. Tek geçiş → başlık 56px aşağıda kalıyordu.
2. "İki kare sonra düzelt" → katlanmayı tetikleyen `IntersectionObserver`
   asenkron olduğu için bazen düzeltme katlanmadan ÖNCE koşuyordu; hata
   rastgele görünüyordu (aynı başlık kimi zaman 58px, kimi zaman 114px).
Çözüm: hizalama **400ms boyunca her karede** tekrarlanır ve okuyucu
`wheel`/`touchstart`/`pointerdown` ile müdahale ederse anında iptal olur.
Ölçüm: altı başlık da 57–58px (header 46 + 12). Genel bakış'tan gelen
bağlantı da aynı yere geliyor.

*Ölçüm dersi:* `requestAnimationFrame` **gizli sekmede çalışmaz**. Tarayıcı
paneli arkada dururken hem ölçüm betiği takıldı hem de sonuçlar tutarsız
göründü; panel öne alınınca üçü de düzeldi. rAF'e dayanan bir davranış, arka
plandaki bir sekmede test edilemez.

GÖREV 57 — Frankfurt fiyatı: anahtarsız bir kaynak (`scripts/de-price.mjs`)

Haftalardır her içerik turunda aynı satır yazılıyordu: *"XETRA barı üç kaynakta
da alınamadı, MBG yalnız currentPrice"*. 20 Eylül 2026'da Mercedes fikri zarar
kesme seviyesinin altında kapanınca bu bir rahatsızlıktan çıkıp karar verilemez
hale geldi: statü değişimi, doğrulanamayan tek bir sayıya bakıyordu.

**Sorun sanıldığı yerde değildi.** yfinance MCP'si Alman sembollerini
getiremiyor değil; getiriyor, ama GÜNLÜK barların son iki günü `null` geliyor ve
sunucu **tüm yanıtı** şema hatasıyla reddediyor
(`data/result/252/Open must be number`). Yani "veri yok" değil, "son bar boş".

- **Çözüm:** aynı Yahoo chart ucundan günlük bar İSTEMEDEN
  `meta.regularMarketPrice` okunuyor. Anahtar yok, kota yok, 8 sembol tek
  çağrıda. `scripts/de-price.mjs`.
- **Doğrulandı:** Volkswagen'in 18 Eylül kapanışı bu yolla 76,52 € — Twelve
  Data'nın (ücretli katman, aynı gün) verdiği rakamla birebir aynı.
- **Elenen kaynaklar:** Twelve Data ücretsiz planı XETRA'da yalnız VOW3'ü
  açıyor (MBG, MUV2, DBK, ALV "Grow plan" istiyor). Stooq'un CSV ucu artık
  JavaScript proof-of-work istiyor — bot korumasıdır, aşılmadı.
- **Bar çekilmiyor, bilinçli.** Kullanıcı kararı: "TradingView tarafı için
  barlar çok önemli değil, güncel fiyatları alabiliyorsan yeter." Saatlik
  barlardan seans barı kurmak denendi ve çalıştı (MBG 18 Eylül: o 45,83 ·
  h 45,83 · l 43,60 · c 43,99) ama kapsama alınmadı.
- **Panelin fiyat hattı bu değil.** Portföy satırlarını hâlâ Google E-Tablosu
  besliyor; betik yalnız içerik turunda okumak içindir. İki kaynağın aynı gün
  farklı sayı verdiği görüldü (MBG: sheet 44,22 · bu kaynak 43,995 · bir Alman
  finans sitesi 44,61) — üçü de zarar kesme seviyesi 44,80'in altında olduğu
  için 21 Eylül kararı hiçbirinde değişmiyordu.

*Yan fayda:* izleme listesindeki üç Alman aday (Munich Re, Deutsche Bank,
Allianz) haftalardır fiyatsız duruyordu ve "koşulu test edilemiyorsa listede
durmamalı" diye işaretlenmişti. Artık okunuyorlar; listede kalıyorlar.

GÖREV 58 — Mobil uyumluluk: kalan dört ekran

Sanal Portföy (GÖREV 30) ve Piyasa Nabzı (GÖREV 56) telefonda zaten
çalışıyordu; bu tur Genel bakış, Notlar, Pozisyon Fikirleri ve Paper'ı aldı.
Tasarım önce canvas'ta çizilip onaylandı, sonra yazıldı.

**Tekrarlayan tek hata:** masaüstünün iki panelli düzeni telefonda üst üste
yığılıyor ve **her panel kendi içinde ayrıca kayıyordu** — aynı anda iki, yer
yer üç kaydırma ekseni. Çözüm her ekranda aynı: telefonda `maxBodyHeight`
verilmez, tek kaydırma sayfanındır.

**Tek eşik: `PHONE_QUERY = '(max-width: 640px)'`** (`split.tsx`'ten export).
Sanal Portföy'ün yerel `CARD_QUERY`'si buna bağlandı. `STACK_QUERY` (800px)
duruyor ve farkı bilinçli: 641–800 arası paneller yığılır ama içlerindeki
masaüstü düzeni hâlâ sığar; 640 altında tablo listeye, yan panel alt sayfaya
dönmek zorunda.

**Genel bakış**
- "Günlük analizi göster" 167×30px'lik bir metin bağlantısıydı ve başlık satırı
  sarmaladığı için sola düşüyordu. Artık tam genişlikte 46px'lik bir satır
  (ikon · ad · tarih · chevron), dokununca analiz **alt sayfada** açılıyor.
  Masaüstündeki tam genişlik bloğu ve varsayılan-açık davranışı değişmedi —
  telefonda blok açılsa sayfa 1.245 → 2.267px oluyordu.
- Portföy tablosu telefonda **iki sütun**: fiyat sembolün altına, rozet K/Z'nin
  altına. Dört sütun 375px ekranda 414px istiyordu (Not sütunu kırpık).
- Satıra dokunmak araştırma notunu **alt sayfada** açıyor; masaüstünde sağ panel
  aynen duruyor. Sağ panel telefonda bir ekran aşağıdaydı, yani dokunmanın
  sonucu görünmüyordu.

**Notlar**
- Bölüm listesi telefonda katlanır tek satır ve satır **açık sayfanın adını**
  taşıyor; sayfa seçilince kapanıyor. Liste 545px'ti, not ilk ekranda hiç
  başlamıyordu.
- Editörün sol şeridi 48 → 16px. O 48px sürükle ve `+` düğmelerinin yeri
  (GÖREV 50) ama ikisi de **hover ile** çıkıyor; telefonda hover yok.
- Başlıklar 32 → 19px. **Not içindeki tablolar küçültülmez, yatay kayar.**
  BlockNote tablo genişliğini satır içi `width: 1000px` yazıp kendi kuralıyla
  `!important` eziyor; sonuç 242px'e sıkışan dört sütun ve harf harf kırılan
  başlıklardı ("Se-mb-ol"). Bu yüzden CSS'te `!important` var, kısayol değil.

**Pozisyon Fikirleri**
- Sekiz sütunlu tablo (581px) telefonda **kart listesine** dönüyor.
- **Grafik telefonda hiç çizilmiyor.** 375px'te çizim alanı 228px'e düşüyordu ve
  seviye etiketleri barların üstüne biniyordu. Yerine **seviye merdiveni**:
  fiyat sırasına dizili seviyeler, aralarında vurgulu "Son fiyat" satırı, her
  birinin yanında bugünkü fiyata uzaklığı. Altında **Tez** ve **Tezi bozan**
  (uyarı tonunda — o metin fikri bitiren şeyi söylüyor).
- Merdiven **alt sayfada** açılıyor, yerinde değil. Kullanıcı kararı: "aşağı
  yukarı gezinmek mobil için iyi bir deneyim değil."
- "Şu an" etiketi **"Son fiyat"** oldu ve yanında panele yazıldığı an duruyor.
  O sayı canlı değil, içerik turunda yazılan son fiyat; seviyelerin arasında
  canlı kotasyon gibi okunuyordu.
- Vurgulu satırın iç boşluğu fiyat sütununu 10px içeri itiyordu; `-mx` + `px`
  ile zemin dışarı taşıyor, sayılar hizada (beş fiyatın sağ kenarı 295px).

**Paper Trading** (kullanıcı "fazla uğraşmayalım" demişti, sonra kart listesi
de istendi)
- **Asıl bozukluk sayfanın kendisiydi:** widget'ın sekme şeridi 443px yer
  kaplıyor ve DOKÜMANI 68px yana kaydırıyordu. Şerit artık kendi içinde kayıyor.
- Özet kutuları telefonda 2×2 (etiketler "TOP…", "KAZ…" diye kırpılıyordu) ve
  etiketler büyük harften normal yazıya döndü.
- Üç sekme de kart listesi + alt sayfa. **Pozisyon kapatma telefonda ancak şimdi
  mümkün:** o işlem satır sonundaki "⋯" menüsündeydi ve o sütun ekran dışındaydı.
  Onay panelin kendi modalıyla (`useConfirm`).

**Ortak**
- Dokunma hedefleri telefonda 44px. Sekme şeridi bununla 46 → 70px büyüyordu;
  **negatif margin** ile yerleşim yüksekliği geri alındı (58px), hit-area 44px
  kaldı.
- **Yatay kaydırma çubukları gizlendi** (`.eqr-hscroll`): sekme şeritlerinin
  altındaki gri çizgi bozuk bir ayraç gibi okunuyordu.
- **Seçili sekme kendini görünür yere çeker** (`lib/scroll-tab-into-view.ts`).
  `scrollIntoView` kullanılmadı: o tüm kaydırılabilir ataları dolaşır, yani
  sekme seçmek alttaki listeyi de kaydırırdı.
  *Hata ve dersi:* ilk sürüm `offsetLeft` kullanıyordu — o değer şeride değil,
  en yakın KONUMLANMIŞ ataya (panel) göre. Son sekmede tesadüfen doğru, ilk
  sekmede yanlış hedefe kaydırıyordu. Hesap `getBoundingClientRect` farklarına
  çevrildi.
- **Analiz sekmesine dokunulmadı** — ölçüldü, taşma yok. Paper'ın masaüstü
  tablosu da aynen duruyor.

GÖREV 59 — Spinner yerine iskelet yükleme

Panel yüklenirken üç ayrı şey yanlış yapıyordu ve ikisi spinner'dan kötüydü:

1. **₺0,00.** Genel bakış'ın KPI kartları boş diziden hesaplanıyordu; ilk
   görünen şey gerçek gibi duran yanlış bir rakamdı.
2. **Yanlış boş-durum yazıları.** "Henüz bülten eklenmedi" ve "Henüz analiz
   eklenmedi" istek havadayken çıkıyordu. "Kayıt yok" bir cevaptır, elimizde
   cevap yoktu. Aynı sınıftan: "0 plan", "0 araştırma notu", "Açık 0",
   "Aktif Pozisyonlar (0)", Paper'da "+$0.00" ve "—".
3. **Tam ekran spinner.** Fikirler ve Nabız'da sekme başlığı dahil her şey
   kayboluyordu.

`components/ui/skeleton.tsx` — `Skeleton` · `SkeletonLines` · `SkeletonKpi` ·
`SkeletonRows` · `SkeletonCards`. Nabız CSS'te (`.eqr-sk`, 1,4 sn opaklık),
`prefers-reduced-motion` açıkken sabit.

- **Sabit olan her şey anında çizilir** (sekme şeridi, başlıklar, panel
  başlıkları, Aktif/Geçmiş). Yalnız veriden gelen alanlar bloğa döner.
- **Blok gerçeğin ölçüsünde.** KPI iskeleti göz kararıyla yapıldı, 94px çıktı;
  gerçek kart 264×125. Aradaki 31px veri gelince şeridi zıplatıyordu — ölçülüp
  birebir eşitlendi (fark 0).
- **Tazelemede iskelet yok:** `useApi` `loading`'i yalnız mount'ta veriyor,
  yani arka plan yenilemesi ekrandaki veriyi bozmuyor.
- Bağlandığı yerler: Genel bakış, Nabız, Fikirler, Sanal Portföy (telefonda
  kart iskeleti), Analiz, Notlar, Paper. Panelde geriye yalnız oturum açılırken
  çıkan tam ekran spinner kaldı — orada hangi ekranın geleceği henüz belli değil.

*Ölçüm notu:* iskeletleri görmek için `fetch` geçici olarak sarmalanıp `/api/`
isteklerine 5-6 sn eklendi. Yerelde yükleme o kadar hızlı ki aksi halde
yakalanamıyor.

GÖREV 60 — Fikirlerde canlı fiyat, yeni Risk/Getiri çubuğu, ⅖ · ⅗ kademeleri

**A — Fikirler artık e-tablonun fiyatını gösteriyor.** Tablo ve trade planı
içerik turunda yazılan son fiyatı gösteriyordu; gün içinde bayat bir sayı canlı
kotasyon gibi okunuyordu. Kaynak portföyün kullandığı Google E-Tablosu (~15 dk
gecikmeli), yeni bir tedarikçi değil.
- `GET /api/trade-plans/live-prices` → `{prices, readAt, stale}`. **`/:ticker`'dan
  önce tanımlı** — sonra olsaydı "live-prices" bir ticker sanılırdı. Tek deneme,
  60 sn; kaynak düşerse 503, önbellekten dönerse `stale: true`. `PriceMap`'e
  okuma anı (`at`) eklendi; `readAt` o, istek anı değil.
- **Fikir sembolleri e-tabloda yoktu** — yalnız portföy pozisyonları vardı.
  `scripts/register-idea-symbols.ts` (`--dry` destekli) açık fikirleri tarayıp
  eksikleri ekliyor ve yeniden okuyarak doğruluyor (BIMAS, NVDA, SCHW eklendi).
  bulk-import da yeni açık fikrin sembolünü **arka planda** kaydediyor —
  GÖREV 31 kuralı: yazma yolunu beklemez. Talimatnamede ADIM 6'ya işlendi.
- `typeForExchange()` (`shared/asset-types.ts`): fikrin borsasından türe, yani
  doğru `FRA:` ön ekine.
- Tabloda **Son fiyat** sütunu; başlıktaki kırmızı saat ikonu okuma saatini
  söyler. Trade planındaki büyük fiyatın yanında da aynı ikon: gecikme + okuma
  saati + **grafiğin son barının tarihi** (barlar içerik turunda çekiliyor,
  canlı değil). Telefondaki merdivende "Son fiyat" satırı da canlı sayıyı taşıyor.
- **Grafiğin son-fiyat etiketi ve çizgisi kaldırıldı** (`lastValueVisible`/
  `priceLineVisible: false`): son barın kapanışını gösteriyordu, yani yanındaki
  canlı fiyatla çelişen ikinci bir "son fiyat".
- `HintTooltip` (`components/ui/hint-tooltip.tsx`): tıkla/dokun ile açılır
  (telefonda hover yok), portal + `fixed`, `align` start/end — fiyat ipucu
  sola açılınca tablonun üstüne biniyordu.

**B — Risk/Getiri çubuğu baştan çizildi.** Kırmızı→yeşil gradyanın üstünde
giriş bandı yarı saydam koyu bir leke gibi duruyordu; kullanıcı "koyu kırmızı
noktalar ne?" diye sordu — cevabı olmayan bir işaretti. Şimdi stoptan TP1'e iki
düz parça, girişte kesiliyor: kırmızı risk, yeşil getiri; oran okunacak bir
etiket değil, iki uzunluğun oranı. Üstte `2,3×`, girişte ink çentik, **canlı
fiyat mavi halka** (SCHW'nin halkası kırmızıda, S TP1'e yakın).
- Renkler `color-mix(--down/--up 75%, --card)`: tam doygunlukta sert duruyordu
  ve üstündeki iki işaretle aynı yüksekten konuşuyordu. Ölçüldü: %75 iki temada
  da 3:1 grafik eşiğinin üstünde (açık 3,55 / 3,28 · koyu 3,48 / 4,04); %65 altına
  düşüyor.
- Genişlik 80px — seviye etiketi yok, çünkü SL/Giriş/TP1 hemen solundaki sütunlar.

**C — Tablo yatay kaydırmaya düşmüyor.** Son fiyat sütunu tabloyu 60px taşırdı.
Yön sütunu ticker'ın yanına rozet olarak katlandı, bu yılın tarihlerinden yıl
atıldı, hücre boşluğu 10 → 8px. Ölçüldü (1280px): ½'de 608px, ⅗'te 731px, taşma 0.

**D — ⅖ ve ⅗ kademeleri.** `PRESETS` yedi kademe: ¼ · ⅓ · ⅖ · ½ · ⅗ · ⅔ · ¾.
**Çift olarak eklendi** — GÖREV 55'in simetri kuralı. Sebep: grafiği genişletip
tabloyu kaydırmaya düşürmeden durulabilecek bir ara nokta. Ölçüldü: %37→40,
%62→60, %70→⅔.

**E — Genel bakış portföy tablosu.**
- Grup başlığındaki "N pozisyon" masaüstünde adın hemen yanında (telefonda sağa
  yaslı kaldı — kullanıcı "mobildekine dokunmayalım" dedi).
- **Sağdaki boşluk:** veri sütunları panelle birlikte büyüyor, boşluğu sayıların
  arasına dağıtıyordu. Varlık sütunu `w-full`, veri sütunları `w-px` +
  `whitespace-nowrap`: artık fazla genişliği ad sütunu yutuyor, sayılar sağda
  bitişik (94/82/133px sabit; Varlık ½'de 288, ⅔'te 494px).
- **Not sütunu sağa yaslı**, başlığı dahil — tablonun geri kalanı zaten sağa
  yaslı. Ölçüldü: 22 rozetin ve başlığın sağ kenarı tablonun 18px içinde.

**F — Piyasa Nabzı telefonda:** "← Genel bakışa dön" kalktı (alt sekme şeridi
zaten orada), tarih adımlayıcısı ortalandı, oklar 44px dokunma hedefi, "N / M"
tarihin altında.


GÖREV 61 — Açılır pencereler Safari'de kayıyordu; telefonda parıltının haresi

**A — Profil menüsü ekranın sağına yapışıyordu (Safari).** Menü butonun ~77px
sağında açılıyor, yarısı ekran dışında kalıyordu. Konum
`right: window.innerWidth - rect.right` ile veriliyordu: iki ayrı koordinat
sisteminden bir sayı. Rect layout viewport'un CSS pikselinde; `innerWidth` her
zaman öyle değil — kullanıcının ekran görüntüsündeki oranlar Safari sayfa
yakınlaştırmasını gösteriyordu (Safari'de test edilemedi, bu bir çıkarım).
Chrome'da iki sayı aynı olduğu için hata burada hiç görünmedi.
- `lib/anchor.ts` → `endAlignedLeft(rect, width)`: `left = rect.right − width`.
  Hizalama yalnız tetikleyicinin kendi rect'inden; viewport genişliği
  (`clientWidth`) yalnız kartı kenarda ekranın içinde tutmak için.
- Aynı hesabı taşıyan beş yer geçirildi: profil menüsü, tarih aralığı seçici,
  Risk/Getiri bilgisi, `HintTooltip`, Paper satır menüsü. Paper'ınki içeriğe
  göre genişliyor (menü / onay kartı), o yüzden `useLayoutEffect` ile çizimden
  sonra ölçülüp boyamadan önce hizalanıyor.
- Ölçüldü: dördünde sağ kenar tetikleyiciyle birebir (1336/1336, 649/649…);
  Paper'da ofsetWidth + left = buton sağı.
- **Kural:** fixed bir popover'ı `innerWidth`'ten türetme; tetikleyicinin rect'i
  ile popover'ın genişliğinden hesapla.

**B — Telefonda "Günlük portföy analizi" satırının etrafında hare kalıyordu.**
`.eqr-glow`'un iç örtüsü (`::after`) masaüstü butonu için yazılmıştı: 9px köşe,
sayfa zemini (`--bg`). Telefondaki satır 14px köşeli beyaz bir kart; 9px'lik gri
örtü kartın yuvarlak köşelerinin dışına taşıyordu. Köşe ve dolgu artık değişken
(`--glow-r`, `--glow-fill`); kart için `.eqr-glow-card` 13px (14 − 1px kenarlık)
ve `--card`.
- Hover yanması `@media (hover: hover)` içine alındı: dokunmatik ekranda `:hover`
  dokunuştan sonra takılı kalır ve kenar animasyon hiç bitmemiş gibi yanık durur.
  Klavye odağı (`:focus-visible`) her yerde yanmaya devam ediyor.

GÖREV 62 — Telefondaki plan sayfasına Risk/Getiri çubuğu

Tablodaki çubuk (GÖREV 60) telefondaki plan sayfasının en üstüne, tam genişlikte
geldi: önce tek bakışlık cevap (oran + fiyatın nerede olduğu), altında merdiven
ayrıntıyı veriyor.
- Çizim tek yerde: `risk-reward-bar.tsx` → `measure()` + `Track`; tablo
  `RiskRewardBar` (80px), sayfa `RiskRewardStrip` (tam genişlik, 2px kalın).
- Uçlarda yalnız "Stop" ve "TP1" yazıyor, fiyat yok — hepsi hemen altındaki
  merdivende, iki kez söylenirdi.
- Kapanmış fikirde halka çizilmez (tablodaki kural).
- Yön planda yok; TP1 stopun altındaysa short sayılıyor.

GÖREV 63 — Telefonda tür seçici: alt sayfanın altında kalıyordu

Telefonda "Yeni pozisyon" alt sayfasında tür seçici üç ayrı şekilde bozuktu ve
üçü de tek bir sebebe bağlıydı: liste alt sayfadan **daha düşük bir katmanda**
çiziliyordu (`z-index` 320, alt sayfa 400).

- **Görünmüyordu:** liste açılıyordu ama sayfanın yarı saydam karartmasının
  arkasında. Kullanıcının ekran görüntüsündeki soluk gri görünüm buydu —
  "açılmıyor" diye okunması doğal.
- **Seçim sayfayı kapatıyordu:** dokunuş listeye değil arkadaki karartmaya
  gidiyor, o da "dışarı tıklandı" sayıp alt sayfayı kapatıyordu. Yarım
  doldurulmuş form da onunla birlikte gidiyordu.
- **Liste artık 420'de**, ve kendi **görünmez arka katmanı** (419) var: dışarı
  dokunuş ona takılır, yalnız listeyi kapatır, sayfa açık kalır. Alt sayfanın
  katmanı `SHEET_Z` olarak seçici dosyasında yazılı — ikisi birbirini bilmek
  zorunda.

**Üçüncü hata ayrıydı ve daha sinsiydi:** liste `resize` ve `scroll`
olaylarında **kapanıyordu**. Telefonda sembol alanından çıkıp seçiciye
dokunmak klavyeyi kapatır, klavyenin kapanması bir `resize`'dır — yani liste
açıldığı karede kendini kapatıyordu. Artık kapanmıyor, `place()` ile
tetikleyiciyi takip ediyor. Kaydırmada da aynısı: konumu güncellemek, kapatmaktan
her zaman daha doğru.

**Ölçüldü (375×812):** liste 420 / sayfa 400; listenin orta noktasındaki en
üstteki öğe listenin kendisi. "Almanya hissesi" dokunuşu türü değiştirdi, liste
kapandı, sayfa açık kaldı. Listenin dışına dokunmak yalnız listeyi kapattı.
Klavye kapanmasını taklit eden `resize`'da liste açık kaldı. Masaüstünde
değişiklik yok: liste tetikleyicinin 6px altında, dışarı tıklamada kapanıyor.

*Yan not:* `npx prettier` ilgisiz bir satırı yeniden biçimlendirdi (GÖREV 29'un
dersi), elle geri alındı.
