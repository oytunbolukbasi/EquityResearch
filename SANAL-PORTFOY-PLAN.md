# Sanal Portföy — PortfoyTakip'i EQR'ye Taşıma Planı

> Amaç: `oytunbolukbasi/PortfoyTakip` uygulamasını **tamamen kapatmak** ve portföy
> yönetimini EQR paneli içindeki "Sanal Portföy" sekmesine taşımak.
>
> Durum: **Faz 1 tamamlandı** (kod + testler). Faz 0 kullanıcıda, Faz 2 sırada. Son güncelleme: 4 Eylül 2026.

---

## 0. Önce bilinmesi gerekenler

### 0.1 İki uygulama zaten aynı veritabanını paylaşıyor

EQR'nin `PORTFOLIO_DATABASE_URL`'i doğrudan PortfoyTakip'in `positions` ve
`closed_positions` tablolarını okuyor. **Veri taşıma işi yok.** Yapılacak iş:

1. EQR'ye bir **yazma yolu** açmak,
2. **fiyat güncelleme boru hattını** devralmak,
3. eski app'i kapatmak.

`server/db/portfolio-client.ts` içindeki not bu anı öngörmüş:

> *"If a future portfolio_write need ever comes up, it must go through a
> different, explicitly-named module — never add a write method here."*

Bu kurala uyulacak: okuma istemcisine **dokunulmayacak**, yazma ayrı modüle gidecek.

### 0.2 🔴 ACİL güvenlik bulgusu

`PortfoyTakip` reposu **herkese açık** (`visibility: public`, doğrulandı) ve
`server/routes.ts:51` şu satırı içeriyor:

```ts
const validPassword = process.env.APP_PASSWORD || "Slither1986";
```

Yani uygulamanın parolası GitHub üzerinden **herkes tarafından okunabilir durumda**.
Dosyadan silmek yetmez — parola git geçmişinde de duruyor.

**Yapılması gerekenler (kod işi değil, hesap işi — kullanıcı tarafından):**

- [ ] Bu parolanın kullanıldığı **her yerde** parolayı değiştir (parola tekrar
      kullanıldıysa diğer hesaplar dahil)
- [ ] Repoyu private yap veya arşivle
- [ ] Yeni parola **asla** kaynak koda yazılmayacak — bkz. Faz 1 kimlik doğrulama

Ayrıca öğrenilenler:
- Parola hiçbir yerde **hash'lenmiyor**, düz metin karşılaştırması yapılıyor.
- `users` tablosu aslında kimlik doğrulamada **kullanılmıyor**; auth env
  değişkenine bakıyor, `userId` ise her yerde `"demo-user"` olarak sabit.
- Yeni sistem bu şemayı **devralmayacak**, sıfırdan düzgün kurulacak.

### 0.3 🟠 Sıralama uyarısı

Fiyat güncellemeyi EQR devralmadan eski app kapatılırsa `current_price` donar.
Bu yalnızca yeni sekmeyi değil, **mevcut EQR panelini de** bozar — KPI kartları,
K/Z, günlük analiz hepsi o alandan besleniyor ve **sessizce yanlış** gösterir.

**Kural: eski app, Faz 2 doğrulanana kadar ayakta kalır.**

---

## 1. Eski app'in fonksiyon envanteri

| # | Fonksiyon | Karar |
|---|---|---|
| 1 | Açık pozisyonları listele | EQR'de var (salt-okunur) |
| 2 | Pozisyon ekle (tür, adet, fiyat, tarih; ABD için tarihsel kur otomatik) | **Faz 1** |
| 3 | Pozisyon düzenle | **Faz 1** |
| 4 | Pozisyon sil | **Faz 1** |
| 5 | Pozisyon kapat (satış fiyatı + tarihi → K/Z, geçmişe taşı) | **Faz 1** |
| 6 | **Kısmi satış** — eski app'te YOK, yeni eksik olarak eklenecek | **Faz 1** |
| 7 | Kapatılan kaydı sil | **Faz 1** |
| 8 | Fiyat yenileme (tek + toplu + 09:00/10:00 cron) | **Faz 2** |
| 9 | BIST sembol araması (otomatik tamamlama) | **Faz 3** |
| 10 | Analiz sayfası (dönem K/Z, tür dağılımı) | **Faz 3** (KPI kartları kısmen karşılıyor) |
| 11 | Yapay zeka yorumu (Gemini) | **Taşınmayacak** — cowork agent zaten daha iyisini yapıyor |
| 12 | Profil / tema | EQR'de var |

---

## 2. Kimlik doğrulama tasarımı

Bugün EQR'nin girişi yok; URL'yi bilen paneli görebiliyor. Yazma işlemleri için
bu yeterli değil.

**Kapsam kararı:** Panelin geri kalanı açık kalır (araştırma içeriği hassas değil).
**Sanal Portföy sekmesi giriş ister** ve yalnızca giriş sonrası aktifleşir.

**Mekanizma:**
- Parola `scrypt` ile hash'lenir (`node:crypto`, yeni bağımlılık yok).
- Hash **env değişkeninde** tutulur (`PORTFOLIO_AUTH_HASH`), kaynak kodda değil.
  Kullanıcı parolayı kendi belirler; hash'i üreten küçük bir script eklenir.
- Oturum: `httpOnly` + `secure` + `sameSite=strict` imzalı çerez.
- Giriş denemesi hız sınırlı (basit bellek-içi sayaç) — kaba kuvvet denemesine karşı.
- Yazma route'ları oturum ister; `x-admin-key` yalnız agent'ın `bulk-import`'unda kalır
  (ayrı endişe, karıştırılmayacak).

**Not:** Parolayı ben belirlemem ve göremem — kullanıcı kendi terminalinde üretir.

---

## 3. Fiyat boru hattı devri

| Varlık | Kaynak | Devir |
|---|---|---|
| BIST hisseleri | Google Apps Script + Sheet | Tek HTTP GET → kolay |
| ABD hisseleri | Aynı sheet | Kolay |
| TEFAS fonları | fintables.com kazıma + ScraperAPI | Kazıyıcı taşınacak |
| USD/TRY | Frankfurter | EQR'de zaten var |

Google Sheet ve ScraperAPI **app'ten bağımsız** çalışıyor; eski app kapansa da
ayakta kalırlar. EQR ikisini de doğrudan devralabilir.

Cron: `node-cron`, hafta içi 09:00 ve 10:00 (TR) — eski app'le birebir aynı.

---

## 4. Fazlar

### Faz 0 — Güvenlik (kod öncesi, kullanıcı aksiyonu)
- [ ] Parolayı her yerde değiştir
- [ ] PortfoyTakip reposunu private yap / arşivle

### Faz 1 — Kimlik doğrulama + yazma yolu + sekme
**Backend**
- [x] `server/db/portfolio-write.ts` — ayrı, açıkça adlandırılmış modül
- [x] `server/routes/auth.ts` — login / logout / me, scrypt + oturum çerezi
- [x] `server/routes/portfolio-manage.ts` — oturum korumalı:
      `POST /positions`, `PATCH /positions/:id`, `DELETE /positions/:id`,
      `POST /positions/:id/close` (**kısmi destekli**), `DELETE /closed-positions/:id`
- [x] `userId` doğrulandı — canlı DB'de tek sahip: `demo-user` (17 açık / 23 kapalı).
      Yazma yolu aynı id'yi kullanıyor, böylece geçiş döneminde iki app yan yana çalışabiliyor.

**Faz 1 testleri (canlı DB'ye karşı, kendini temizleyen)**
- [x] Oturumsuz yazma → 401 · yanlış parola → 401 · yanlış kullanıcı adı → 401
- [x] Giriş → `httpOnly` çerez kuruldu, `/auth/me` doğruladı
- [x] Türkçe ondalık ayrıştırma (`100,50` → `100.50`)
- [x] ABD pozisyonunda tarihsel USD/TRY otomatik çekildi (15 Ağu 2026 → 47,8840)
- [x] Kısmi satış: 12 adetin 5'i satıldı → 7 açık kaldı, K/Z 97,50 (%19,4)
- [x] Elde olandan fazlasını satma denemesi → 400
- [x] Kalanın tamamı satıldı → pozisyon silindi, K/Z 206,50 (%29,35)
- [x] Temizlik sonrası portföy **birebir başlangıç haline döndü** (17/23, sıfır kalıntı)
- [x] Miktar gösterimi düzeltildi: `fmtQty` — APO 0,8099 (önce hatalı "1"), MA 6,11 (önce "6")

**Kısmi satış mantığı**
- Satılan adet < mevcut adet → `positions.quantity` düşülür + `closed_positions`'a
  yalnız satılan adet için satır yazılır
- Satılan adet == mevcut adet → pozisyon silinir (eski davranış)
- Şema değişikliği **gerekmiyor**; `closed_positions.quantity` zaten var

**Frontend**
- [x] "Sanal Portföy" sekmesi — giriş yoksa giriş formu
- [x] Pozisyon tablosu + satır aksiyonları (düzenle / kapat / sil)
- [x] Pozisyon ekleme formu
- [x] Kapatma formu (adet alanı ile — kısmi satış)
- [x] Mevcut `Panel` / `SplitPane` / `UnderlineTabs` bileşenleri kullanılacak,
      yeni tasarım turu yok

### Faz 2 — Fiyat boru hattı
- [ ] `server/services/price-source.ts` (Google Apps Script: BIST + ABD)
- [ ] `server/services/fund-price.ts` (Fintables + ScraperAPI, önbellekli)
- [ ] `node-cron` 09:00 / 10:00 TR, hafta içi
- [ ] Elle "Fiyatları yenile" butonu (tek pozisyon + toplu)
- [ ] Railway env: `SCRAPER_API_KEY`, `SHEETS_PRICE_URL`
- [ ] **Doğrulama:** iki app bir hafta paralel çalışır, fiyatlar karşılaştırılır

### Faz 3 — Eski app'in kapatılması
- [ ] Fiyatların EQR'den güncellendiği teyit edilir
- [ ] PortfoyTakip Railway servisi durdurulur
- [ ] Repo arşivlenir
- [ ] EQR `CLAUDE.md` güncellenir (portföy artık salt-okunur değil)

### Faz 4 — İsteğe bağlı
- [ ] BIST sembol otomatik tamamlama (`bist_symbols` tablosu zaten dolu)
- [ ] Dönem K/Z ve tür dağılımı görünümü
- [ ] Mobil form iyileştirmesi (gerekirse; şimdilik web-only kabul edildi)

---

## 5. Riskler

| Risk | Önlem |
|---|---|
| Yazma hatası gerçek finansal kaydı bozar | Onay diyalogları, kısmi satışta adet doğrulaması, silme işlemleri geri alınamaz olduğu için ayrıca teyit |
| Fiyatlar donarsa panel sessizce yanlış gösterir | Faz 2 doğrulanmadan eski app kapatılmaz; `lastUpdated` arayüzde gösterilir |
| Yazma yolu okuma istemcisine sızar | Ayrı modül; `portfolio-client.ts`'e write metodu **eklenmeyecek** |
| Parola halka açık | Faz 0, kod işinden önce |
| Mobilde form kullanılamaz | Kabul edildi: gerekirse bir süre web-only |
