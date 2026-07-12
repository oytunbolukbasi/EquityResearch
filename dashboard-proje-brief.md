# Yatırım Dashboard — Proje Brief (Claude Code için)

# Rol
Sen modern web uygulamaları geliştiren kıdemli bir Frontend Geliştirici ve UI/UX Uzmanısın. Amacın, modern tasarım standartlarına uygun, kullanıcı dostu ve yüksek performanslı arayüzler kodlamaktır.


## Amaç
Günlük kontrol edilen, kişiselleştirilebilir bir yatırım takip dashboard'u. claude.ai (equity-research projesi) içinde MCP connector'ları ve web search ile üretilen içerikler (morning note, trade idea, trade plan, sektör heatmap) bu panelde görselleştiriliyor. Tek kullanıcılı, düşük maliyetli, Railway'de deploy ediliyor.

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix tabanlı)
- **Canvas / widget sistemi:** react-grid-layout — sürükle, yeniden boyutlandır, grid'e snap, layout JSON olarak saklanır
- **Animasyon:** Framer Motion (widget ekleme/taşıma geçişleri için, abartısız)
- **Backend:** Node.js + Express (veya Hono) — tek servis, build edilmiş React static dosyalarını da serve eder
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

```ts
morning_notes: { id, date, top_call: text, macro_bullets: jsonb, sector_deep_dive: jsonb, created_at }

ideas: {
  id, date, ticker, exchange, direction, thesis: text,
  metrics: jsonb,            // F/K, PD/DD, ROE, temettü verimi, yıllık/haftalık değişim — sektöre göre değişken alanlar
  entry_low, entry_high, stop_loss, target_1, target_2,
  risk_reward_h1, note: text, risk_note: text,
  status,                    // active | hit_target | stopped | watch
  created_at
}

trade_plans: {
  id, ticker, exchange, current_price,
  entry_low, entry_high, tp1, tp2, tp3, hard_sl,
  thesis: text, invalidation: text,
  price_history: jsonb,      // sparkline/candle için OHLC dizisi
  created_at, updated_at
}

heatmaps: {
  id, date, market,          // 'BIST' | 'US'
  sectors: jsonb,            // [{ name, change_pct, note }]
  created_at
}
```

## Widget'lar (v1 — 6 adet)
1. **Piyasa Nabzı** (eski: Morning Note) — `morning_notes` tablosundan; Top Call + Makro madde listesi + Sektör Odağı. Widget içi ◀ ▶ navigasyonuyla geçmiş notlara erişim.
2. **Pozisyon Fikirleri** (eski: Alım-Satım Önerileri) — `ideas` tablosu, Aktif/Geçmiş sekmeli. Aktif: her ticker'ın kendi en son kaydı (`selectDistinctOn`). Geçmiş: stopped pozisyonlar. Satıra tıklayınca Trade Planı widget'ı o ticker'a geçer.
3. **Trade Planı** — `trade_plans` tablosu. TradingView Lightweight Charts (CandlestickSeries) ile gerçek OHLC grafiği, Y-ekseni sadece fiyat geçmişine kilitli, dışarıda kalan seviyeler off-chart rozet olarak gösteriliyor. Aktif/Geçmiş sekmeli.
4. **BIST Heatmap** — `heatmaps` (market='BIST').
5. **ABD Heatmap** — `heatmaps` (market='US').
6. **Portföy Durumu** — Ayrı salt-okunur Neon DB'den (`PORTFOLIO_DATABASE_URL`) açık/kapalı pozisyonlar. TL ve USD blokları ayrı özet kutularında; K/Z değer/yüzde toggle (IoSwapHorizontal); canlı USD/TRY kuru (Frankfurter API, fallback 41.50 TL); Günlük Analiz (portfolio_insights); Geçmiş sekmesinde kapatılan pozisyonlar.

Tüm widget'lar react-grid-layout canvas'ında bağımsız öğeler; kullanıcı ekleyebilir, taşıyabilir, boyutlandırabilir, kaldırabilir. Layout `localStorage`'da veya basit bir `layouts` tablosunda saklanır.

## API (taslak)
```
GET  /api/morning-notes?date=          → tek kayıt
GET  /api/morning-notes/history
POST /api/morning-notes                 (admin)

GET  /api/ideas?date=
GET  /api/ideas/history
POST /api/ideas                         (admin)

GET  /api/trade-plans
GET  /api/trade-plans/:ticker
POST /api/trade-plans                   (admin)

GET  /api/heatmaps?market=&date=
POST /api/heatmaps                      (admin)
```
POST route'ları basit bir shared-secret header (`x-admin-key`) ile korunur — ayrı bir auth sistemine gerek yok, tek kullanıcı için fazla mühendislik olur.

## İçerik Besleme Akışı
claude.ai (equity-research projesi) içinde Claude, MCP connector'ları (FMP, Matriks AI, Quartr) ve web search kullanarak içeriği üretir ve yukarıdaki şemaya uygun JSON döner. Bu JSON, dashboard'daki basit bir **"İçerik Ekle"** sayfasına yapıştırılıp kaydedilir (tek bir textarea + POST). Bu chat'in network erişimi sandboxlı olduğu için şu an otomatik push yapılamıyor; ileride istenirse Claude Code üzerinden (ayrı MCP kurulumuyla) otomatikleştirilebilir — v1 kapsamında değil.

## Deployment Notları
- Neon: proje oluştur, **pooled** connection string'i al, `DATABASE_URL` olarak Railway env'ine ekle.
- Railway: GitHub repo'ya bağla, push'ta otomatik deploy. Tek servis (API + static frontend).
- Drizzle migration'ları local'den veya Claude Code'dan `drizzle-kit push` ile Neon'a uygulanır.

