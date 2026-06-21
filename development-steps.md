Bu klasördeki dashboard-proje-brief.md dosyasını oku ve projeyi bu brief'e göre scaffold et.
Aynı klasörde görsel/yapısal referans olarak morning-note.pdf ve trade plan view.html dosyaları
var — mevcut tasarım dilini (renk paleti, kart hiyerarşisi, SVG trade plan yaklaşımı) bu
örneklerden çıkar, sıfırdan tasarlamana gerek yok.

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

New Development Tasks

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