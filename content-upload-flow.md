İçerik ekleme akışı: Claude Chat üzerinde alınan verilerin dashboard'a eklenme süreci şu şekilde işleyecek:

1. İçerik oluşturma (Claude Chat):

   - Claude Chat üzerinde ilgili MCP araçlarını kullanarak (web search, FMP, Matriks, Quartr vb.)
     gerekli verileri topluyorsun.
   - Toplanan verileri kullanarak morning note, teknik tablo, trade plan, heatmaps gibi içerikleri
     hazırlıyorsun.
   - Çıktıyı JSON formatında kaydediyorsun.

2. Veri yükleme (dashboard):

   - Hazırlanan JSON verisini dashboard'daki "İçerik Ekle" sayfasına yapıştırıyorsun.
   - Tablo seçimi yaparak veriyi ilgili tabloya kaydediyorsun.

3. Otomasyon (kısmen kullanımda): scripts/ klasöründe Claude Code ile yazılan tek seferlik
   script'ler bu adımı şimdiden destekliyor:

   - scripts/seed.ts — 4 tablo için idempotent (anahtar bazlı sil-ekle) seed.
   - scripts/update-trade-plan-prices.ts — trade_plans için manuel currentPrice/priceHistory
     upsert'i (entry/tp/sl/thesis dokunulmaz).
   - scripts/fetch_ohlc.py + scripts/backfill-trade-plan-history.ts — Python yfinance ile
     gerçek günlük OHLC çekip (BIST ticker'ları için ".IS" uzantısıyla sorgulanır, DB'ye
     uzantısız kaydedilir) trade_plans.priceHistory'i günceller. Önce dry-run ile bir diff
     raporu (eski/yeni fiyat, %3 eşik aşımı, seviye geçişi) basar; sadece "İncelenmesi
     gereken değişiklik yok" görüldükten sonra --apply ile DB'ye yazılır.

   Bunlar hâlâ elle (npx tsx / python3 ile) tetiklenen tek seferlik araçlar — sürekli çalışan
   bir pipeline değil. Gerçek otomasyon (zamanlanmış/tetiklenen toplu güncelleme) sonraki bir
   aşama.