# Deploy — Railway

## Build akışı

```
npm run build   →  Vite, client/ → dist/public/
npm start       →  Express, /api/* + dist/public/ static
```

Tek Railway servisi. Ek config gerekmez.

---

## İlk kurulum

### 1. GitHub remote ekle ve push et

```bash
git remote add origin https://github.com/oytunbolukbasi/EquityResearch.git
git push -u origin main
```

### 2. Railway'de proje oluştur

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub repo** → `EquityResearch` reposunu seç
3. Branch: `main` (otomatik)
4. Railway `railway.toml` dosyasını algılar, build + start komutlarını oradan alır

### 3. Environment variables ekle

Railway dashboard → projeyi aç → **Variables** sekmesi:

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (`.env`'deki ile aynı) |
| `ADMIN_KEY` | Güçlü rastgele string (`.env`'deki ile aynı veya yeni) |
| `NODE_ENV` | `production` |

> `PORT` ekleme — Railway bunu otomatik atar.

### 4. İlk deploy

Variables kaydedilince Railway otomatik deploy başlatır.
Build logunu takip et: Railway dashboard → **Deployments** → son satır `✓` olunca hazır.

### 5. Public URL al

Railway dashboard → **Settings** → **Domains** → **Generate Domain**

Admin sayfası: `https://xxx.railway.app/admin`

---

## Sonraki deploylar (otomatik)

`main` branch'e her `git push` sonrası Railway yeni build başlatır.
Önceki deploy sıfır-downtime ile değiştirilir.

---

## Env değişkenlerini güncelleme

Railway dashboard → Variables → değeri düzenle → **Deploy** (otomatik tetiklenir).

---

## Sorun giderme

| Belirti | Kontrol |
|---|---|
| Build başarısız | Railway Logs → `npm run build` çıktısına bak |
| `500 internal_error` | Variables → `DATABASE_URL` doğru mu? |
| `/admin` → 401 | Variables → `ADMIN_KEY` girilmiş mi? |
| Sayfa açılmıyor | `GET /api/health` → 200 dönüyor mu? |
