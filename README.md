# Ozear

Ozear, kendi bilgisayarında veya kendi sunucu ortamında çalıştırabileceğin bir iş takip aracıdır. Proje görevlerini, kullanılan teknolojileri ve bir işin nasıl çözüldüğünü aynı çalışma alanında tutar. MCP bağlantısıyla desteklenen bir yapay zekâ asistanı görevleri bulabilir ve çalışma notlarını kaydedebilir.

- **Görevler.** Durum, öncelik, arama ve pano görünümü.
- **Teknolojiler.** Sürüm, kullanım amacı, teknik kararlar ve değişiklik geçmişi.
- **Çalışma notları.** İlgili dosyalar, kod akışı, karar gerekçesi ve test sonucu.
- **MCP.** Web paneliyle aynı kayıtları kullanır. Bir asistan, örneğin “Stok kontrolü görevini bul ve yaptığımız değişikliği o göreve kaydet” isteğini işleyebilir.

## Bilgisayarında dene

Node.js **22.13 veya üzeri**, npm ve Git ile başla. Terminalde şu komutları çalıştır.

    git clone https://github.com/theiozyurt/ozear-public.git
    cd ozear-public
    npm run setup:local

Terminalin gösterdiği yerel adresi aç. İlk kurulum bağımlılıkları indirir, projeyi kontrol eder, yerel D1 şemasını hazırlar ve sunucuyu başlatır. Proje kayıtları bu klonun .wrangler/state dizininde tutulur. Yerel deneme için Cloudflare hesabı, uzaktan veritabanı, yapay zekâ anahtarı veya barındırma hesabı gerekmez. Sunucuyu Ctrl+C ile durdurabilirsin.

Örnek olarak bir stok projesi ve “Stok yokken siparişi engelle” görevi oluştur. Projenin teknolojilerine kullandığın veri tabanını ekle. Görevin çalışma notuna ilgili dosyayı, değişikliği ve uyguladığın testi yaz.

## Bir yapay zekâ aracıyla kur

Klon klasörünü Codex, Claude Code, Cursor veya terminal erişimi olan başka bir kodlama asistanında aç. Ardından şu isteği ver.

> Bu depo Ozear. Önce README.md ile docs/kurulum.md dosyalarını oku. Node ve npm sürümlerini kontrol et. Ozear'ı bu bilgisayarda yerel geliştirme modunda kurmak için npm run setup:local çalıştır ve çıkan adresi bana ver. Herhangi bir yayın veya uzak veritabanı işlemi yapma. Kurulumda hata olursa gerçek hata mesajını incele ve sonucu doğrula.

Bu aşamada yapay zekâ aracı kurulum komutlarını senin adına çalıştırır. Ozear'ı asistanın araçlarından biri olarak kullanmak için kendi dağıtımının MCP adresini ayrıca bağla. [MCP kurulum rehberi](docs/mcp.md).

## Sunucu ve veritabanı seçenekleri

| Kullanım | Sunucu | Veritabanı |
| --- | --- | --- |
| Bilgisayarında deneme ve geliştirme | Yerel Vinext / Wrangler | Yerel D1 emülasyonu |
| İnternetten erişilen kişisel kurulum | Vercel üzerinde Next.js | Kendi Cloudflare D1 veritabanın ve kimlik doğrulamalı Worker |
| VPS üzerinde kişisel kurulum | Node.js üzerinde Next.js ve HTTPS ters vekili | Kendi Cloudflare D1 veritabanın ve kimlik doğrulamalı Worker |

İlk deneme için yerel kurulumu öneririm. İnternetten erişmek istediğinde yeni bir D1 veritabanı ve kendi barındırma projenle devam edebilirsin. Yerel kurulum için ayrı bir görev takip aboneliği gerekmez. Kullandığın yapay zekâ hizmeti ve barındırma sağlayıcısı kendi ücretlerini uygulayabilir. [Dağıtım ve doğrulama adımları](docs/kurulum.md).

## Kodun akışı

| Dosya | Görevi |
| --- | --- |
| [app/workspace.tsx](app/workspace.tsx) | Projeleri, görevleri ve çalışma notlarını gösterir. |
| [app/configuration.tsx](app/configuration.tsx) | Projede kullanılan teknolojileri ve değişiklik geçmişini gösterir. |
| [app/api/action/route.ts](app/api/action/route.ts) | Web oturumunu doğrular ve istekleri ortak servise gönderir. |
| [app/mcp/route.ts](app/mcp/route.ts) | MCP istemcisini doğrular ve araç çağrılarını ortak servise gönderir. |
| [lib/service.ts](lib/service.ts) | Girdiyi doğrular ve doğru hesaba ait kayıtlarla işlem yapar. |
| [db/schema.ts](db/schema.ts) | Projelerin, görevlerin, çalışma notlarının ve teknoloji geçmişinin yapısını tanımlar. |

Bir çalışma notu eklediğinde tarayıcı web API'sine istek gönderir. Sunucu oturumu doğrular, servis görevin doğru hesaba ait olduğunu kontrol eder ve notu veritabanına kaydeder. MCP üzerinden gelen istek de aynı iş kurallarını kullanır.
