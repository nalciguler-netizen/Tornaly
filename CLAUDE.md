# Tornaly – Proje Kuralları

## Amaç
CNC, sac/lazer, freze ve döküm atölyeleri için **teklif uygulaması**. Müşteriden gelen çizim (DXF, SVG, CAD PDF) ya da hızlı parça ölçüleri → 3D görünüm, ağırlık, hammadde, işçilik → PDF teklif. Arayüz Türkçe. Hedef: Türkiye'deki küçük/orta atölyeler, ücretli abonelikle satış.

## Altyapı (hepsi ücretsiz katman)
- **Uygulama:** tek dosya `index.html` (three.js, Barlow fontları gömülü), `sw.js` (önce ağ, önbellek `tornaly-vN`), `manifest.json`, `pdf.min.js` + `pdf.worker.min.js` (pdf.js 3.2.146), `gizlilik.html`, `kullanim-kosullari.html`.
- **Yayın:** GitHub Pages → `nalciguler-netizen/Tornaly` → https://nalciguler-netizen.github.io/Tornaly/
- **Play:** PWABuilder ile TWA, paket `com.tornaly.app`, geliştirici hesabı Yurdagül Güler. `signing.keystore` saklanır, paket adı asla değişmez.
- **Digital Asset Links:** kök depo `nalciguler-netizen.github.io/.well-known/assetlinks.json`. İçinde 4 uygulama var (yolhava, tornaly, sahnely, hukukplatformu); düzenlerken hepsi korunur.
- **Okuyucu:** Cloudflare Worker `tornaly-okuyucu` → https://tornaly-okuyucu.yolhava-destek.workers.dev (`/durum`, POST `/`). Claude API'ye (Anthropic) bağlanır; `ANTHROPIC_API_KEY` ve `PRO_KODLARI` secret'ları eklenene kadar **kapalı**.
- İçerik güncellemesi = GitHub'a dosya yüklemek. Yeni `.aab` yalnızca ad, simge, paket veya Play Billing değişirse gerekir.

## Alınan kararlar
- Çizimler **telefonda** işlenir (DXF/SVG/CAD PDF). Play veri güvenliği: "veri toplanmıyor".
- CAD PDF: çizgi kalınlığından katman seçimi, antet/çerçeve atma, "ÖLÇEK x:y" okuma, torna/sac otomatik ayrımı, "t=6" kalınlık okuma.
- Fotoğraf/taranmış çizim: ekranda büyütülebilir resim olarak açılır, ölçüleri usta girer.
- **OCR (Tesseract) denendi ve kaldırıldı:** önemli ölçüleri kaçırdı, yanlış teklif üretti.
- **Cloudflare Workers AI görüntü modelleri denendi, hepsi başarısız** (Llama 4 Scout, Mistral 3.1, Qwen 3.8, Llama 3.2).
- Fotoğraftan otomatik okuma **Claude (Sonnet)** ile yapılacak. Altyapı kurulu, kapalı; ilk ücretli müşteriden sonra açılır (rehber 12. bölüm).
- Ücretli servise **ilk gelir gelmeden geçilmez.**

## Yapılmayacaklar
- API anahtarı uygulamaya, GitHub'a ya da sohbete konmaz; yalnızca Cloudflare secret.
- Doğruluğu kanıtlanmamış otomatik ölçü doldurma eklenmez. Yanlış değer, boş alandan daha tehlikelidir.
- Frenler kaldırılmaz, sadece gevşetilir: Anthropic'te otomatik yükleme kapalı + aylık limit, kod başına günlük okuma sınırı (KV).
- Uygulama içinden Play dışı ödemeye yönlendirme yapılmaz (e-posta, havale, web linki).
- assetlinks dosyasında diğer uygulamaların kayıtları silinmez.
- Başka uygulamaların dosyaları bu projeye karıştırılmaz.

## Ticari kurallar
- Ücretli Pro yalnızca **Google Play Billing** aboneliğiyle satılır (Google payı %15). Bunun için tek seferlik yeni `.aab` gerekir.
- Pro kodları yalnızca **ücretsiz pilot/deneme** için verilir.
- Okuma açılınca: gizlilik metnine Anthropic paragrafı eklenir, Play veri güvenliği formu güncellenir, "Kod almak için: e-posta" satırı kaldırılır.
- Teklifler **ön teklif**tir. Kesin fiyat, onaylı teknik resim (DXF) ile verilir.
- Kullanım koşulları ticari kullanıma göre yazılmıştır; destek adresi yolhava.destek@gmail.com.

## Çalışma şekli
- Kullanıcı yalnızca telefondan çalışır. Kurulum adımları **tek tek**, kısa verilir; istenmedikçe ders anlatılmaz.
- Güncellemede yalnızca **değişen dosyalar** verilir; her paket teslimden önce test edilir (DXF, SVG, CAD PDF, hızlı parça regresyonu).
- En kolay yol önce önerilir; mümkünse Claude servislere kendisi bağlanıp kontrol eder.
