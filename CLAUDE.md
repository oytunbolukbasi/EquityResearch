# Yatırım Dashboard — Proje Brief (Claude Code için)

# Rol
Sen modern web uygulamaları geliştiren kıdemli bir Frontend Geliştirici ve UI/UX Uzmanısın. Amacın, modern tasarım standartlarına uygun, kullanıcı dostu ve yüksek performanslı arayüzler kodlamaktır.


## Amaç
Günlük kontrol edilen, kişiselleştirilebilir bir yatırım takip dashboard'u. claude.ai (equity-research projesi) içinde MCP connector'ları ve web search ile üretilen içerikler (morning note, trade idea, trade plan, paper trading) bu panelde görselleştiriliyor. Tek kullanıcılı, düşük maliyetli, Railway'de deploy ediliyor.

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix tabanlı)
- **Yerleşim:** 6 sekmeli çalışma alanı, her sekmede en fazla iki panel. Kütüphane
  yok — `features/workspace/split.tsx` (~340 satır) divider'ı, %25/50/75 snap'ini ve
  panel takasını kendisi yönetir. *(react-grid-layout GÖREV 27'de kaldırıldı.)*
- **Animasyon:** Saf CSS keyframe. *(Framer Motion GÖREV 27'de kaldırıldı — tek bir
  0,9 sn logo dönüşü için ~120 kB'a değmiyordu.)*
- **Backend:** Node.js + Express — tek servis, build edilmiş React static dosyalarını da serve eder
- **ORM:** Drizzle ORM (Neon serverless driver ile birlikte)
- **Veritabanı:** Neon Postgres (mevcut hesap) — pooled connection string kullan
- **Deployment:** Railway (sadece uygulama; DB Neon'da kalıyor), GitHub'a push ile otomatik deploy
- **Kod stili:** `.prettierrc` — tek tırnak, noktalı virgül yok, 100 karakter. Prettier
  bağımlılık olarak kurulu DEĞİL; dosya, ayarsız çalıştırılan bir `npx prettier`'ın kendi
  varsayılanlarına (çift tırnak + noktalı virgül) düşüp kod tabanını yeniden biçimlendirmesini
  önlemek için var. (GÖREV 29)

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
- **Taban punto 12px.** Okunacak her metin — kart etiketleri, K/Z satırları, tablo alt
  satırları, form etiketleri, takvim hücreleri — en az 12px. 12px altı yalnızca *işaret*
  içindir, metin için değil: durum rozetleri (10px), grafik seviye etiketleri (10px),
  Risk/Getiri rozeti (11px) ve tablo `<th>` başlıkları (11px). (GÖREV 29)
- Widget eyebrow başlıkları: 14px / weight 600 / uppercase / tracking 0.01em.
- Tablo başlıkları `<th>`: 11px / weight 500 / uppercase / tracking 0.04em.
- Tablo hücreleri `<td>`: minimum 13px (CSS override, unlayered).
- Piyasa Nabzı bölüm başlıkları (Ana Görüş / Makro / Sektör Odağı): 14px / weight 600.
- Makro bullet satırları: 14px / line-height 1.65.

## Veri Modeli (Postgres / Drizzle, jsonb ağırlıklı — şema esnek kalsın)

- Ana DB tabloları: `morning_notes`, `ideas`, `trade_plans`, `portfolio_insights`,
  `layouts` (+ arayüzde kullanılmayan ama korunan `heatmaps`).
- Portföy pozisyonları AYRI bir DB'de (`PORTFOLIO_DATABASE_URL`): `positions`,
  `closed_positions`, `users`, `bist_symbols`.
  **Bu DB artık salt-okunur DEĞİL** — GÖREV 28 ile yazma yolu açıldı:
  - Okuma → `server/db/portfolio-client.ts` (yalnız SELECT, yazma metodu **eklenmez**)
  - Yazma → `server/db/portfolio-write.ts` (ayrı modül, her ifade elle yazılmış ve
    parametreli, hepsi `user_id` ile sınırlı; jenerik `query()` kaçamağı yok)
  - Tek sahip: `user_id = 'demo-user'`. Yeni satırlar da bu id ile yazılır.
  - Para ve adet Postgres'e **string** gider; kolonlar `decimal` ve float
    round-trip'i kesirli adetlerde hassasiyet kaybediyor (portföyde 0,809883524
    adetlik bir pozisyon var).
- İçerik JSON şeması ve alan isimleri: bu klasördeki cowork-instructions-final.md.
- Sanal Portföy taşıma planı ve fazları: bu klasördeki **SANAL-PORTFOY-PLAN.md**.

## Sekmeler (6 aktif)

Serbest canvas yok. Her sekmede **en fazla iki panel** yan yana durur; aralarındaki
divider sürüklenince genişlik imleci serbest takip eder ve bırakınca **tam olarak
%25/50/75**'ten birine oturur. Panel başlığı sürükleme tutamacıdır: imleç divider'ın
öbür tarafına geçtiği an iki panel **anında** yer değiştirir (geçiş süresi 0, DOM
sırası sabit — yalnız `flex order` değişir, dolayısıyla panel remount olmaz, grafik
ve scroll korunur). ≤800px tek kolona yığılır ve tüm sürükleme kapanır; ≤640px
Sanal Portföy ayrıca tabloyu bırakıp kart listesine geçer (GÖREV 30).

1. **Genel bakış** — 3 KPI kartı (Toplam / TL varlıklar / ABD hisseleri) + Portföy
   paneli (Hisse notları / Günlük analiz / Geçmiş) ↔ Piyasa Nabzı özeti. Portföy
   satırına tıklayınca sağ panel o varlığın detayına döner; makro başlığına tıklamak
   bültenin **tam o bölümüne** atlar.
2. **Piyasa Nabzı** — İçindekiler ↔ tam metin makale. Üstte ‹ tarih › adımlayıcı;
   yalnızca kaydı olan bültenler arasında gezer (datepicker yok).
3. **Pozisyon Fikirleri** — fikir tablosu (Aktif/Geçmiş, Risk/Getiri mini-bar, tarih
   kolonları) ↔ seçili trade planı. TradingView Lightweight Charts **aynen korundu**.
   Varsayılan açılış = en güncel tarihli aktif idea (statü `/api/ideas`'ten türetilir;
   senkron olmayan `trade_plans.status`'a güvenilmez).
4. **Paper Trading** — tek panel, split yok. Alpaca kâğıt hesabı; 4 özet kart +
   Açık/Kapatılan (FIFO)/Emirler. **Sadece NYSE/NASDAQ, BİST hariç.**
5. **Sanal Portföy** — pozisyon ekle / düzenle / sat / sil. **Giriş ister**
   (bkz. Kimlik Doğrulama). Kısmi satış destekli. Sütunlar sıralanabilir; Varlık ve
   İşlem sütunları sabitlenmiştir (panel daraldığında butonlar kaybolmasın diye).
   **≤640px'te tablo yerine kart listesi + bottom sheet** — sekiz sütun telefona
   sığmıyordu (GÖREV 30).
6. **Analiz** — portföy özeti, kâr/zarar özeti, performans metrikleri, **Dağılım**
   (yığılmış şerit + pay lejantı) ve kâr/zarar dağılımı. Günlük/Aylık/Tümü preset'li
   takvim seçici; başlığın hemen altında **dönem özeti şeridi** — seçili dönemde kaç
   pozisyon açıldı, kaç tanesi kapatıldı. *(Yarım daire donut GÖREV 29'da kaldırıldı.)*

> **Kaldırılanlar:** BIST + ABD Heatmap (GÖREV 17; `heatmaps` tablosu korundu),
> widget ekle/kaldır menüsü, serbest sürükle-bırak canvas (GÖREV 27).

**Yerleşim kalıcılığı:** split ve swap değerleri sürükleme bırakılınca localStorage'a
yazılır (`eqr2:splits:v2`, `eqr2:swapped`). Header'daki **Kaydet** ayrıca `layouts`
tablosuna cihaz bazında yazar (`workspace-v1` etiketiyle; tablodaki eski
react-grid-layout satırları geri yüklemede yok sayılır). **Sıfırla** varsayılanlara
döner. Son açık sekme de hatırlanır (`eqr2:tab`).

**Header:** scroll'da kimlik satırı katlanır, yalnızca sekme adları kalır (102→46px).
Kontroller: Sıfırla · Kaydet · satır aralığı (yoğunluk) · tema.

## Kimlik Doğrulama

Panelin geri kalanı açıktır; **yalnızca Sanal Portföy sekmesi giriş ister** ve portföyü
DEĞİŞTİREN her route oturum zorunlu kılar.

- Yeni bağımlılık yok: `node:crypto` ile scrypt hash + HMAC imzalı çerez.
- Parola **asla koda yazılmaz**. `PORTFOLIO_AUTH_HASH` env'de tutulur; hash'i sahibi
  `node scripts/hash-password.mjs` ile kendi terminalinde üretir (parola ekrana
  basılmaz, diske yazılmaz, argüman olarak geçilmez).
- Env: `PORTFOLIO_AUTH_USER`, `PORTFOLIO_AUTH_HASH`, `SESSION_SECRET`.
- Çerez `httpOnly` + `sameSite=strict` + production'da `secure`, 30 gün.
- Giriş 15 dakikada 8 denemeyle sınırlı. Yanlış kullanıcı adı da hash karşılaştırması
  çalıştırır, böylece cevap süresi bilgi sızdırmaz.
- `x-admin-key` YALNIZCA agent'ın `bulk-import`'unda kalır — iki mekanizma
  karıştırılmaz.

## Fiyat Boru Hattı

PortfoyTakip uygulamasının yaptığı iş devralındı. **İki ayrı ritim**, çünkü iki kaynağın
maliyeti çok farklı:

| Varlık | Kaynak | Ritim |
|---|---|---|
| BİST + ABD hisseleri | Google Apps Script + Sheet (GOOGLEFINANCE, ~15 dk gecikmeli) | **15 dakikada bir** + açılışta |
| TEFAS fonları | fintables.com kazıma (ScraperAPI, kotalı) | **Hafta içi 09:00 / 10:00 (TR)** — açılışta ÇEKİLMEZ |
| USD/TRY | Frankfurter | İstek anında |

- Env: `SHEETS_PRICE_URL`, `SCRAPER_API_KEY`.
- Zamanlayıcı `node-cron` kullanmaz; `price-scheduler.ts` içinde bir dakika-tick'i.
  `dueSlot()` saf fonksiyondur, 09:00'ı beklemeden test edilebilir.
- **Elle "Hisse fiyatlarını yenile" butonu yalnızca hisseleri yeniler.** Fon fiyatı
  günde bir değişir ve kazıma kotalıdır; her tıklamada değişmesi imkânsız bir sayıyı
  yeniden okumak için kota harcanmaz.
- **Fiyatı alınamayan sembol ATLANIR, sıfırlanmaz.** Ulaşılamayan bir kaynağın panelin
  dayandığı bir rakamı silebilmesi kabul edilemez.
- **Fiyatlandırma bir YAZMAYI asla bloklamaz.** Pozisyon kaydedilir kaydedilmez
  yanıt döner (`pricePending: true`); sembol kaydı ve ilk fiyat okuması arka
  plandaki `ensurePriceSoon`'a bırakılır (3/20/60/120 sn). Sıra korunur — önce
  `registerSymbol`, sonra okuma — ama kimse beklemez. *Bir ara bu ikisi istek
  işleyicisinde await ediliyordu ve "Pozisyon ekle" ~110 sn sürüyordu; satır ilk
  saniyede kaydedilmiş oluyordu. (GÖREV 31)*
- **Sheet okuması 60 sn timeout.** Aynı uç ölçüldüğünde bir okuma 3,2 sn, diğeri
  36,9 sn sürdü — ~40 GOOGLEFINANCE hücresi yeniden hesaplanıyor. 30 sn tavan
  sağlıklı bir sayfayı bile timeout'a düşürüyordu.
- **Deneme sayısı ve timeout çağıranın kararı** (`FetchOptions`): arka plan
  taraması 3 deneme, tek sembol okuması 1 deneme.
- **Eş zamanlı okumalar tek isteği paylaşır.** Apps Script script başına aynı
  anda tek istek işler; üst üste binen okumalar hızlanmaz, kuyruğa girip
  birbirini timeout'a düşürür.
- Arayüzde bayatlık göstergesi ("az önce / 3 saat önce / 2 gün önce"); iki günü aşarsa
  uyarı rengine döner. Fiyat akışı durursa panel sessizce yanlış göstermesin diye.

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
> tablo silindi). Çelişki görürsen **en yüksek numaralı GÖREV** geçerlidir. GÖREV 27 pek çok erken
> kararı geçersiz kıldı: react-grid-layout, widget ekle/kaldır menüsü ve Framer Motion
> artık yok. GÖREV 29 Analiz'deki yarım daire donut'ı kaldırdı ve panele 12px punto
> tabanı koydu. GÖREV 30 Sanal Portföy'e telefon için ayrı bir render dalı ekledi;
> GÖREV 31 fiyat okumasını yazma yolundan çıkardı; GÖREV 32 Analiz'deki
> "hisse hareketi / kur etkisi" ayrıştırmasını ekrandan kaldırdı ve isabet
> oranını bölüm başlığına rozet olarak taşıdı; GÖREV 33 Piyasa Nabzı'nın
> içindekiler panelini başlık gibi okuttu.

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
  zeka görüşü hariç — cowork agent zaten daha iyisini yapıyor).
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
