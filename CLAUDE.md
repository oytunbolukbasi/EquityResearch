# Yatırım Dashboard — Proje Brief (Claude Code için)

# Rol
Sen modern web uygulamaları geliştiren kıdemli bir Frontend Geliştirici ve UI/UX Uzmanısın. Amacın, modern tasarım standartlarına uygun, kullanıcı dostu ve yüksek performanslı arayüzler kodlamaktır.


## Amaç
Günlük kontrol edilen bir yatırım çalışma alanı: portföy yönetimi, günlük araştırma
içeriği ve kendi notların aynı panelde. Tek kullanıcılı, düşük maliyetli, Railway'de
deploy ediliyor.

İçerik (morning note, trade idea, trade plan, portfolio insight) **bu repo'da Claude
Code ile** üretilir — bkz. İçerik Besleme Akışı. *(GÖREV 40'a kadar claude.ai'daki
ayrı bir projede üretiliyordu; "cowork agent" diye bir şey artık yok.)* Portföy
yönetimi de dışarıdan devralındı: ayrı bir mobil uygulama olan PortfoyTakip GÖREV 28
ile içeri alındı ve 13 Eylül 2026'da emekliye ayrıldı.

**"Kişiselleştirilebilir" değil.** İlk sürümde serbest sürükle-bırak bir canvas ve
widget ekle/kaldır menüsü vardı; GÖREV 27'de ikisi de kaldırıldı. Bugün düzen
sabittir, ayarlanabilen tek şey iki panelin genişliği ve sırası.

## Tech Stack
- **Frontend:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first). **shadcn/ui iskeleti kaldı ama neredeyse
  boşaldı:** `components/ui/` altındaki bileşenlerden yalnızca `button.tsx` kullanılıyor
  (tek yer: AdminPage). `dropdown-menu.tsx` duruyor ama **hiçbir yerden import
  edilmiyor**; select, date-range-picker, bottom-sheet ve profil menüsü elle yazıldı
  (GÖREV 35, 36). Radix bağımlılığı `react-slot` üzerinden button'da, bir de kullanılmayan
  dropdown'da. Yani "Radix tabanlı bir arayüz" beklemeyin.
- **Yerleşim:** 6 sekme + açılıp kapanan Notlar yüzeyi; her sekmede en fazla iki panel.
  Kütüphane yok — `features/workspace/split.tsx` divider'ı, ¼ · ⅓ · ⅖ · ½ · ⅗ · ⅔ · ¾ snap'ini ve panel
  takasını kendisi yönetir. *(react-grid-layout GÖREV 27'de kaldırıldı.)*
- **Not editörü:** BlockNote (`@blocknote/core` + `react` + `mantine`) — yalnız
  ücretsiz katman. `@blocknote/xl-*` paketleri GPL-3.0/ticari lisanslı, **kurulu
  değil**. Çekirdek MPL-2.0. Modül `React.lazy` ile ayrılır. (GÖREV 50)
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

> Yukarıdaki kesitte `--card`'ın yalnız `.dark`'ta görünmesi eksiklik değil: açık
> temada `--card` ham bir renk değil, dosyanın alt kısmındaki shadcn eşlemesinde
> `var(--white)`'a bağlanıyor. Koyu tema onu doğrudan eziyor.

- **Semantic accent katmanı** — inline-style'ların tek renk kaynağı. Widget badge/status
  chip, chart serisi ve seviye çizgileri bunları `var()` ile kullanır; `.dark` bunları
  yeniden eşler (parlatılmış accent + translucent tint dolgular):
  - Accent alias'ları: `--up` / `--down` / `--info` / `--warn`
  - Badge tint arka planları: `--up-tint` / `--down-tint` / `--info-tint` / `--warn-tint` /
    `--neutral-tint` (light'ta pale hex, dark'ta translucent rgba)
  - TP merdiveni: `--tp1..3` + `--tp1..3-tint`
  - Cam modal + scrim: `--glass-bg` / `--glass-border` / `--scrim`
  - Grafik: `--chart-axis` / `--chart-bar` (açıkta `#4a4a46`, koyuda `#f0ede8`)
  - Dağılım serisi: **`--alloc-1..4`** — mavi (Borsa İstanbul ve Fon) · turuncu
    (ABD) · mor (Almanya) · turkuaz (Kripto). **Kendi skalası**, çünkü
    `--up`/`--warn` bu panelde anlam taşıyor; yeşil bir dilim hemen üstündeki K/Z
    çubuklarıyla karışıp "kâr" okunuyordu. Renkler göz kararı değil, `dataviz`
    doğrulayıcısıyla iki temada da ölçüldü. Koyu temada bu dördü
    **koyulaştırılır**, diğer accent'ler gibi parlatılmaz.
    **Beşinci renk yok** ve bu bir eksiklik değil bir sınır: yeşil ile kırmızı
    dışarıdayken (burada kâr/zarar demek) beşli hiçbir set ayrışma eşiğini
    geçmiyor. Bu yüzden BİST ve fon **her yerde** tek grup. Yeni bir varlık sınıfı
    eklenirse önce bu ölçüm tekrarlanmalı. (GÖREV 34, 37)
    *(GÖREV 34 üç renkli ve gül kurusu içeren bir skala kurmuştu; GÖREV 37 Almanya
    ve kripto gelince dördüne çıkardı ve gül kurusunu mor+turkuaz ile değiştirdi.)*

**Portföy tablosu satırları (`.eqr-row`, GÖREV 51):** hover ve seçili durum
**aynı** görünümü paylaşır — soldan `--bg`, %55'e kadar düz, sağ uçta şeffaf.
İkisi de "bu satır" diyor; iki ayrı görünüm tabloyu aynı soruya iki ağızdan
cevap verdiriyordu. Sağa doğru sönmesinin sebebi süs değil: satır aksiyonlarının
bulanık şeridi (GÖREV 47) ve satırı okuma sebebin olan sayılar o tarafta.
Satır arka planı **asla satır içi stille** yazılmaz — inline stil stylesheet
kuralını yener ve `hover:` hiç uygulanmaz.

**Tema state + toggle (`client/src/lib/theme.tsx`):**
- İlk açılışta OS tercihini (`prefers-color-scheme`) izler; **profil menüsündeki
  "Koyu tema" anahtarıyla** override edilir ve seçim `localStorage['eqr:theme']`'de
  saklanır. *(Header'daki Sun/Moon ikon butonu GÖREV 46'da menüye taşındı.)*
- `.dark` class'ı `document.documentElement`'e **senkron** uygulanır — böylece portal'lı
  Radix dropdown'ları/modal'lar temayı izler ve child effect'ler (grafik) toggle sonrası
  doğru paleti okur. `index.html`'e FOUC önleyici inline script eklendi (render öncesi
  class'ı basar → açık→koyu flash yok).

**Grafik dark mode (lightweight-charts):** Kütüphane canvas tabanlı olup CSS değişkeni
okuyamaz; renkler effect içinde `getComputedStyle` ile aktif temanın *concrete* token'larından
(`--chart-bar`/`--chart-axis`/`--tp1..3`/`--blue`/`--red`) somut string'e çözülür.
Bu yüzden `--chart-bar` iki temada da **somut hex** yazılır; `var(--ink)` alias'ı
çözülmemiş döner.
`theme`, effect deps'inde (`[plan, theme]`) — grafik her değişimde tamamen yeniden
kurulduğundan toggle'da doğru renklerle rebuild olur.

**Tipografi:**
- Tek font: **Inter** (400/500/600/700, latin + latin-ext — Türkçe karakter tam desteği).
- **Ondalık basamak sayısı türe göre** (`portfolio-calc.ts` → `DECIMALS`):
  kripto adet 8, fiyat 0–8, değer ve K/Z 2; **fon fiyatı 2–6** (TEFAS'ın kotasyon
  hassasiyeti), değer ve K/Z tam lira; diğer türler adet 4, fiyat tam 2, değer ve
  K/Z 0. Kripto kesirlerini kırpmak girilmemiş bir sayı basıyor (0,32831331 →
  "0,3283") ve 14 sentlik bir pozisyonu "$0" gösteriyordu; hisse fiyatının alt
  sınırı 2'de tutulur, yoksa "₺69,60" → "₺69,6" olur. (GÖREV 38, 41)
- Sayısal değerlerde (fiyat, yüzde, miktar) mono font YOK; bunun yerine `font-variant-numeric: tabular-nums` ile sütun hizalaması korunuyor. CSS utility class: `.num` ve `.tnum`.
- **Taban punto 12px.** Okunacak her metin — kart etiketleri, K/Z satırları, tablo alt
  satırları, form etiketleri, takvim hücreleri — en az 12px. 12px altı yalnızca *işaret*
  içindir, metin için değil: durum rozetleri (10px), grafik seviye etiketleri (10px),
  Risk/Getiri rozeti (11px) ve tablo `<th>` başlıkları (11px). (GÖREV 29)
- Panel başlıkları (`Panel.tsx`): 15px / weight 500 / tracking −0.25px — **uppercase
  değil**. *(GÖREV 27 öncesi her widget'ın 14px/600/uppercase bir "eyebrow"u vardı;
  widget çerçevesiyle birlikte gitti, sonuncusu GÖREV 48'de kaldırıldı.)*
- Tablo başlıkları `<th>`: 11px / weight 500 / uppercase / tracking 0.04em.
- Tablo hücreleri `<td>`: minimum 13px (CSS override, unlayered).
- Piyasa Nabzı bölüm başlıkları (Ana görüş / numaralı makro / **Avrupa NN** / Sektör
  odağı): 14px / weight 600. Bölüm listesi ve kicker'ları **tek yerde**
  `note-sections.ts`'te kararlaştırılır (GÖREV 39).
- Makro bullet satırları: 14px / line-height 1.65.

## Veri Modeli (Postgres / Drizzle, jsonb ağırlıklı — şema esnek kalsın)

- **Varlık türleri ve para birimleri: `shared/asset-types.ts`** — istemci ve
  sunucunun ortak kaynağı (GÖREV 37). Beş tür: `stock` · `us_stock` · `de_stock`
  · `fund` · `crypto`. `CURRENCY_FOR_TYPE` bir türün hangi para biriminde
  fiyatlandığını söyler (BİST/fon → TRY, ABD/kripto → USD, Almanya → EUR);
  `PRICE_SOURCE_FOR_TYPE` fiyatın nereden geldiğini (sheet / fund / crypto);
  `ASSET_GROUPS` gösterimde dört grubu. Aynalamak yerine paylaşıldı: iki kopya
  kayarsa hata fırlatmaz, sessizce yanlış para raporlar. `type` kolonu düz
  `text`, tür eklemek migration istemez.
- **Tarih kolonları zone'suz `timestamp`.** Sürücü onları yerel saatte
  ayrıştırıyor, dolayısıyla okurken `toIsoUtc`/`naiveIso` ile YEREL bileşenler
  UTC olarak yeniden yazılır — `toISOString()` değeri yeniden çapalayıp takvim
  gününü kaydırır. Ve **fiyat yazan bir işlem yalnızca fiyat yazar**
  (`updatePrice`); satırın tamamını geri yazmak alış tarihini her yenilemede
  yerel fark kadar geriye yürütüyordu. (GÖREV 37)
- Ana DB tabloları: `morning_notes`, `ideas`, `trade_plans`, `portfolio_insights`,
  `layouts`, `note_sections`, `note_pages` (+ arayüzde kullanılmayan ama korunan
  `heatmaps`).
- **Not gövdesi sunucuda hiç ayrıştırılmaz** (`note_pages.content`, jsonb):
  BlockNote'un belge biçimi olduğu gibi saklanır. Ayrıştıran bir sunucu editör her
  blok türü kazandığında güncellenmek zorunda kalırdı ve hiçbir sorgu notun içine
  bakmıyor. `note_pages.section_id` **cascade** siler. (GÖREV 50)
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
- İçerik JSON şeması ve alan isimleri: bu klasördeki panel-icerik-talimatnamesi.md.
- Sanal Portföy taşımasının kaydı: bu klasördeki **SANAL-PORTFOY-PLAN.md**. Plan
  **tamamlandı**, açık maddesi yok; yapılacaklar listesi değil tarihsel kayıt.

## Sekmeler (6 sekme + Notlar yüzeyi)

Serbest canvas yok. Her sekmede **en fazla iki panel** yan yana durur; aralarındaki
divider sürüklenince genişlik imleci serbest takip eder ve bırakınca **tam olarak
¼ · ⅓ · ⅖ · ½ · ⅗ · ⅔ · ¾**'ten birine oturur (GÖREV 55, 60). Panel başlığı sürükleme tutamacıdır: imleç divider'ın
öbür tarafına geçtiği an iki panel yer değiştirir — 220ms'lik bir FLIP kaydırmasıyla
(GÖREV 49); DOM sırası sabit, yalnız `flex order` değişir, dolayısıyla panel remount
olmaz, grafik ve scroll korunur. ≤800px (`STACK_QUERY`) tek kolona yığılır ve tüm
sürükleme kapanır; ≤640px (`PHONE_QUERY`) her sekme telefon düzenine geçer —
tablolar kart listesine, yan paneller alt sayfaya, tek kaydırma sayfanındır
(GÖREV 30, 56, 58).

1. **Genel bakış** — grup başına bir KPI kartı + Toplam, **yatay kayan şeritte**
   (`ScrollRail`; son kart bilerek yarım kesilir, kenar solmaları yalnızca o yöne
   kaydırılabildiğinde çıkar, fareyle sürüklenir). Portföy paneli **varlık
   sınıfına göre bölümlü** (kalın renkli çizgi + ad + pozisyon sayısı) ↔ Piyasa
   Nabzı özeti. Portföy
   satırına tıklayınca sağ panel o varlığın detayına döner; makro başlığına tıklamak
   bültenin **tam o bölümüne** atlar. KPI şeridi ile paneller arasında **tam
   genişlikte günlük analiz bloğu** (varsayılan açık, × ile kapanır, tercih
   `eqr2:overview-analysis`'te). Portföy panelinin sekmeleri **Aktif | Geçmiş**.
   (GÖREV 43)
2. **Piyasa Nabzı** — İçindekiler ↔ tam metin makale. Üstte ‹ tarih › adımlayıcı;
   yalnızca kaydı olan bültenler arasında gezer (datepicker yok).
3. **Pozisyon Fikirleri** — fikir tablosu (Aktif/Geçmiş, Risk/Getiri çubuğu, **Son fiyat** —
   e-tablodan ~15 dk gecikmeli, tarih kolonları) ↔ seçili trade planı. TradingView Lightweight Charts **aynen korundu**.
   Varsayılan açılış = en güncel tarihli aktif idea (statü `/api/ideas`'ten türetilir;
   senkron olmayan `trade_plans.status`'a güvenilmez).
4. **Paper Trading** — tek panel, split yok. Alpaca kâğıt hesabı; 4 özet kart +
   Açık/Kapatılan (FIFO)/Emirler. **Sadece NYSE/NASDAQ, BİST hariç.**
5. **Sanal Portföy** — pozisyon ekle / düzenle / sat / sil. Kısmi satış destekli. Sütunlar sıralanabilir; Varlık
   sütunu sabitlenmiştir (panel daraldığında kaybolmasın diye).
   **≤640px'te tablo yerine kart listesi + bottom sheet** — sekiz sütun telefona
   sığmıyordu (GÖREV 30). Satır işlemleri (Düzenle/Sat/Sil) kendi sütunlarında
   değil, **hover'da satırın üzerinde** belirir (GÖREV 47).
6. **Analiz** — portföy özeti, kâr/zarar özeti, performans metrikleri, **Dağılım**
   (yığılmış şerit + pay lejantı) ve kâr/zarar dağılımı. Günlük/Aylık/Tümü preset'li
   takvim seçici; başlığın hemen altında **dönem özeti şeridi** — seçili dönemde kaç
   pozisyon açıldı, kaç tanesi kapatıldı. *(Yarım daire donut GÖREV 29'da kaldırıldı.)*

**Notlar — sekme değil, açılıp kapanan bir yüzey (GÖREV 50).** Profil menüsündeki
anahtarla açılır, şeritte ×'i olan bir sekme olarak belirir. Kalıcı yedinci sekme
yapılmadı: şeridi ara sıra açılan bir şey için sürekli meşgul ederdi. Tercih
`eqr2:notes-open`'da; kapatılmışsa açılışta gelmez ve `eqr2:tab` "notes" diyorsa
bile o sekmeye dönülmez.

> **Kaldırılanlar:** BIST + ABD Heatmap (GÖREV 17; `heatmaps` tablosu korundu),
> widget ekle/kaldır menüsü, serbest sürükle-bırak canvas (GÖREV 27).

**Yerleşim kalıcılığı:** split ve swap değerleri sürükleme bırakılınca localStorage'a
yazılır (`eqr2:splits:v2`, `eqr2:swapped`). Header'daki **Kaydet** ayrıca `layouts`
tablosuna cihaz bazında yazar (`workspace-v1` etiketiyle; tablodaki eski
react-grid-layout satırları geri yüklemede yok sayılır). **Sıfırla** varsayılanlara
döner. Son açık sekme de hatırlanır (`eqr2:tab`).

**Header:** scroll'da kimlik satırı katlanır, yalnızca sekme adları kalır (102→46px).
Görünen tek şey **tarih ve profil menüsü**; panelin bütününe ait her ayar menünün
içinde (Notlar · Düzeni kaydet · Düzeni sıfırla · Koyu tema · Satır aralığı ·
Çıkış yap).
Menüde eylemler menüyü kapatır, açma/kapama anahtarları açık bırakır.
(GÖREV 35, 46)

## Kimlik Doğrulama

**Panelin tamamı giriş ister** (GÖREV 45). `/api` altındaki her şey oturum
arkasında; kapının önünde yalnızca iki şey var ve bilerek:
- `/auth` — oturum isteyen bir kapıdan giriş yapılamaz.
- `/admin` — içerik hattının kendi kapısı, `x-admin-key` ile. İki mekanizma
  karıştırılmaz: admin anahtarı paneli açmaz, oturum da içe aktarıcıyı açmaz.

- Yeni bağımlılık yok: `node:crypto` ile scrypt hash + HMAC imzalı çerez.
- Parola **asla koda yazılmaz**. `PORTFOLIO_AUTH_HASH` env'de tutulur; hash'i sahibi
  `node scripts/hash-password.mjs` ile kendi terminalinde üretir (parola ekrana
  basılmaz, diske yazılmaz, argüman olarak geçilmez).
- Env: `PORTFOLIO_AUTH_USER`, `PORTFOLIO_AUTH_HASH`, `SESSION_SECRET`.
- Çerez `httpOnly` + `sameSite=strict` + production'da `secure`, 30 gün.
- Giriş 15 dakikada 8 denemeyle sınırlı. Yanlış kullanıcı adı da hash karşılaştırması
  çalıştırır, böylece cevap süresi bilgi sızdırmaz.

## Fiyat Boru Hattı

Bu iş PortfoyTakip'ten devralındı; **o uygulama artık yok** (servis durduruldu, repo
arşivlendi — 13 Eylül 2026), yani fiyatları yazan tek yer burası. **İki ayrı ritim**,
çünkü iki kaynağın maliyeti çok farklı:

| Varlık | Kaynak | Ritim |
|---|---|---|
| BİST + ABD + Almanya hisseleri | Google Apps Script + Sheet (GOOGLEFINANCE, ~15 dk gecikmeli) | **15 dakikada bir** + açılışta |
| Kripto | CoinGecko (anahtarsız, tek istekte tüm semboller) | Hisselerle aynı süpürmede |
| TEFAS fonları | **TEFAS'ın kendi JSON ucu** (`/api/funds/fonFiyatBilgiGetir`, anahtarsız) — fallback: fintables.com kazıma (ScraperAPI) | **Hafta içi 09:00 / 10:00 (TR)** — açılışta ÇEKİLMEZ |
| USD/TRY ve EUR/TRY | Frankfurter | İstek anında (`getRates()`) |

- Env: `SHEETS_PRICE_URL`; `SCRAPER_API_KEY` yalnız fon **fallback**'i için
  (birincil yol TEFAS ve anahtar istemiyor — GÖREV 52).
- Zamanlayıcı `node-cron` kullanmaz; `price-scheduler.ts` içinde bir dakika-tick'i.
  `dueSlot()` saf fonksiyondur, 09:00'ı beklemeden test edilebilir.
- **Elle "Hisse fiyatlarını yenile" butonu yalnızca hisseleri yeniler.** Fon fiyatı
  günde bir değişir ve kazıma kotalıdır; her tıklamada değişmesi imkânsız bir sayıyı
  yeniden okumak için kota harcanmaz.
- **Borsa ön eki türden gelir, sembolden değil.** SAP hem Frankfurt'ta hem ABD'de
  işlem görüyor; GOOGLEFINANCE'a çıplak `SAP` verilince Amerikan fiyatını
  döndürüyordu. `sheetSymbol()` Alman hisselerine `FRA:` ekliyor, `bareSymbol()`
  yanıtı çıplak ticker'la eşliyor — sheet cevaplarını çıplak anahtarla veriyor.
  Pozisyonlar DB'de her zaman çıplak saklanır. Sınır: sheet ticker başına tek
  satır tuttuğu için aynı sembolü iki borsada birden taşımak temsil edilemiyor.
  (GÖREV 38)
- **Fiyatı alınamayan sembol ATLANIR, sıfırlanmaz.** Ulaşılamayan bir kaynağın panelin
  dayandığı bir rakamı silebilmesi kabul edilemez.
- **Bayat önbellek tazelik damgasını tazelemez.** Üç kaynak da çökünce önbellekteki
  fiyatı döndürür, ama cevabın ikinci el olduğunu `stale` ile bildirir; zaten fiyatı
  olan satır yeniden YAZILMAZ, `last_updated` olduğu gibi kalır. (GÖREV 42)
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
- Arayüzde bayatlık göstergesi ("az önce / 3 saat önce / 2 gün önce"). Fiyat akışı
  durursa panel sessizce yanlış göstermesin diye.
- **Bayatlık KAYNAK BAZINDA ölçülür** (`stalePositions`, GÖREV 52): sheet ve kripto
  3 saat, fon 48 saat. Başlıktaki yaş en TAZE satırı gösterir — panelin ne kadar
  güncel olduğunun dürüst cevabı o — ama eşiğini aşan pozisyonlar ayrıca **adıyla**
  yazılır (`⚠ YKT 3 gün`). Tek eşik ya fonu her öğleden sonra bayat ilan ederdi ya
  da sheet saatlerdir ölmüşken susardı.

## İçerik Besleme Akışı
Günlük içerik (morning_note / ideas / trade_plans / portfolio_insight) **bu repo'da
Claude Code ile** üretilir; yfinance MCP birincil, fallback Twelve Data + tek web_search.
İki temel adım repo'nun kendi skill'leridir — `Skill(eqr-idea-generation)` ve
`Skill(eqr-morning-note)`, `.claude/skills/` altında. Üretilen JSON, `/admin` sayfasındaki
**"Toplu İçerik Girişi"** textarea'sına yapıştırılıp `POST /api/admin/bulk-import` ile
kaydedilir (`x-admin-key` korumalı; her tablo bağımsız hata izolasyonlu upsert). ABD
(NYSE/NASDAQ) fikirleri için bulk-import ayrıca otomatik Alpaca Paper Trading emri yönetir.

*(GÖREV 40'a kadar içerik claude.ai'daki ayrı bir "cowork agent"ta üretiliyordu; skill'ler
o projenin plugin'inde yaşıyordu ve talimatnamede ikinci bir kopyası duruyordu.)*

Her turun kalıcı kaydı **Notlar sekmesine** yazılır (ADIM 8): günün özeti
"İçerik Güncelleme Özetleri" bölümüne `14 Eylül 2026` biçiminde başlıklı bir
sayfa olarak, eleme tablosu da "Fikirler" altındaki tek "İzleme Listesi"
sayfasına tarihli bölüm eklenerek. Notlar API'si de oturum arkasında olduğu için
bu yazma `note_pages` tablosuna doğrudan yapılır.

- Tam görev akışı, statü yaşam döngüsü ve JSON şeması: bu klasördeki panel-icerik-talimatnamesi.md.

## Deployment Notları
- Neon: proje oluştur, **pooled** connection string'i al, `DATABASE_URL` olarak Railway env'ine ekle.
- Railway: GitHub repo'ya bağla, push'ta otomatik deploy. Tek servis (API + static frontend).
- Drizzle migration'ları local'den veya Claude Code'dan `drizzle-kit push` ile Neon'a uygulanır.

## Kalıcı Kurallar

Günlükten süzülmüş, **bozulunca sessizce bozulan** kurallar. Her biri bir kez
yanlış yapıldı; gerekçesi parantezdeki GÖREV'de, `GELISTIRME-GUNLUGU.md`'de.

**Arayüz ve CSS**
- Etkileşimle değişen bir görsel özellik (hover, seçili, geçiş) **satır içi stile
  yazılmaz** — satır içi stil stylesheet kuralını yener. Üç kez yaşandı. (47, 49, 51)
- `.eqr-split > * { transition: none }` kuralına `!important` **geri konmaz**;
  takas animasyonunu sessizce öldürür. (49)
- Fixed bir popover'ın konumu `window.innerWidth`'ten türetilmez; tetikleyicinin
  rect'i + popover genişliği (`lib/anchor.ts`). Safari'de menü ekrandan taştı. (61)
- Hover'la yanan bir şey `@media (hover: hover)` içinde; dokunmatikte `:hover`
  dokunuştan sonra takılı kalır. (61)
- `scrollIntoView` kullanılmaz (tüm kaydırılabilir ataları kaydırır); konum
  hesabında `offsetLeft` değil `getBoundingClientRect` farkı. (58)
- Sürüklemede pointer capture şart — yoksa tarayıcı metin seçimi `pointermove`'u
  yutar. (27)
- Yapışkan header akışın içinde ve katlanınca altındaki her şeyi 56px kaydırır;
  bir bölüme atlama tek hesapla değil, 400ms'lik hizalama döngüsüyle yapılır. (56)
- `window.confirm` yok, `useConfirm` var: engellenmiş diyalogda `confirm()` sessizce
  `false` döner ve buton ölü görünür. (28, 50)
- Enter bir odak olayına bağlanmaz: odaksız pencerede blur hiç ateşlenmez. (50)
- Veri gelmeden "kayıt yok", "0" veya "₺0,00" yazılmaz — iskelet gösterilir. (59)
- Telefonda panele `maxBodyHeight` verilmez: tek kaydırma sayfanındır. (58)
- `PRESETS` %50 etrafında simetrik kalır; kademe hep çift eklenir. (55, 60)

**Renk ve ölçüm**
- Panelde yeşil **kâr**, kırmızı **zarar** demek; başka bir anlam için kullanılmaz
  (bar rengi, logo, dağılım dilimi). (34, 44, 53)
- Bir renk isteği **ölçülmeden** uygulanmaz: metin 4,5:1, grafik markı 3:1, iki
  temada da. Sabit hex temayı takip edemez — token kullanılır. (44, 51, 60)
- BlockNote: seçici `.eqr-note-editor.bn-root[data-color-scheme]` kısaltılmaz
  (koyu tema kırılır), `@blocknote/core/fonts/inter.css` import edilmez, editör
  `React.lazy`'nin dışına çıkmaz. (50)

**Veri ve fiyat**
- Fiyat yazan işlem yalnız `current_price` + `last_updated`'a dokunur; zone'suz
  tarihte `toISOString()` kullanılmaz. (37)
- Yavaş ve oynak bir dış kaynak bir **yazmanın kritik yolunda** olamaz. (31)
- Fallback eklerken değerin **etiketi** de taşınır: bayat önbellek tazelik
  damgasını tazelemez. Sinyali taşıyan yolun her halkası kontrol edilir — arayüz
  tek bir `Math.max` ile onu yok edebilir. (42, 52)
- Tür bazlı bir kural varsa (ondalık, para birimi, borsa ön eki) o türü gösteren
  **her** çağrı yeri ortak fonksiyondan geçer. (38, 41)
- TEFAS'a `Authorization` gönderilmez — sitenin token'ı bize verilmiş bir yetki
  değil. (52)

**Araç ve süreç**
- Prettier ayarı doğrulanmadan çalıştırılmaz (60 satırlık diff 800 oldu). (29)
- Skill'ler `eqr-` ön ekiyle çağrılır; çıplak ad eklentinin skill'ini yükler. (40)
- İçerik yüklemek deploy gerektirmez; deploy yalnız kod değişince. (40)
- Ölçüm tuzakları: `requestAnimationFrame` gizli sekmede çalışmaz (56);
  `innerText` CSS `uppercase`'i uygular (50); tarayıcı aracının
  `left_click_drag`'i tutarsız — pointer olaylarını doğrudan gönder (55);
  yerelde yükleme durumları ancak `fetch` geciktirilerek görülür (59).

## Geliştirme Günlüğü

GÖREV 1'den bu yana her değişikliğin gerekçesi, ölçümü ve elenen seçenekleri
**`GELISTIRME-GUNLUGU.md`**'de (kronolojik; çelişkide en yüksek numara geçerli).
Her oturumda yüklenmesin diye buradan ayrıldı — bir kararın *neden* öyle olduğu
lazım olduğunda oradan okunur. Yeni GÖREV kayıtları **oraya** eklenir; bir kayıt
kalıcı bir kural doğurduysa kural yukarıdaki listeye de bir satır olarak girer.
