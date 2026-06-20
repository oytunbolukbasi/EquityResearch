# Yatırım Dashboard — Proje Brief (Claude Code için)

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
Mevcut PDF bültenlerden ve trade plan HTML'inden taşınıyor, sadece font değişiyor.

```css
:root {
  --bg:    #f7f6f3;
  --white: #ffffff;
  --ink:   #1a1a18;
  --mid:   #6b6b67;
  --faint: #d8d7d2;
  --faint2:#eeede9;
  --green: #1a7a5e;
  --red:   #c0392b;
  --blue:  #2563a8;
  --amber: #9a6200;
  --sans: 'Open Sans', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
```
Light mode, minimal, yuvarlatılmış köşeli kartlar (radius ~14px), bol boşluk. Fiyat/oran gibi sayısal değerler hep `--mono` ile, başlık ve metin `--sans` ile yazılır. Türkçe karakter desteği (ç, ğ, ı, ş, ü, ö) her iki fontta da sorunsuz.

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

## Widget'lar (v1 — 5 adet)
1. **Günlük Morning Note** — `morning_notes` tablosundan en son kayıt; Top Call + madde listesi.
2. **Teknik Alım-Satım Önerileri Tablosu** — `ideas` tablosu, günlük + historical filtre, durum etiketiyle (active/hit/stopped).
3. **Trade Plan Viewer** — `trade_plans` tablosu, mevcut HTML'deki SVG yaklaşımı React component'e taşınır (giriş bandı, TP1/TP2/TP3, hard SL çizgileri).
4. **BIST Sektör Heatmap** — `heatmaps` (market='BIST').
5. **ABD Sektör Heatmap** — `heatmaps` (market='US').

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

## Claude Code İçin Açık Noktalar
- Admin "İçerik Ekle" sayfası tek textarea mı olsun, yoksa her widget tipi için ayrı form mu? (Başlangıç için tek textarea + JSON paste öneriyoruz.)
- Layout kalıcılığı: localStorage yeterli mi, yoksa DB'ye mi yazılsın? (Tek kullanıcı olduğu için localStorage v1 için yeterli.)
- Trade Plan Viewer'da fiyat geçmişi canlı mı çekilsin (FMP/web search), yoksa sadece publish anındaki statik veri mi gösterilsin? (v1: statik, publish anındaki veri.)
