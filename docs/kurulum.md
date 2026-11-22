# Ozear kurulum rehberi

## 1. Yerel kurulum

Node.js 22.13 veya daha yeni bir sürümle depo kökünde çalıştır.

    npm run setup:local

Varsayılan adres http://127.0.0.1:5173. Terminalde yerel giriş sayfasının tam adresi görünür. Bu geliştirme sunucusu makinenin kendi adresine bağlanır. Yerel giriş, aynı bilgisayardaki geliştirme oturumu içindir.

- Yalnız hazırlamak için npm run setup:local -- --prepare-only çalıştır.
- Hazırlanmış çalışma alanını yeniden açmak için npm run dev çalıştır.
- 5173 numaralı port doluysa önce o porttaki mevcut uygulamayı kontrol et.
- Yerel veriler .wrangler/state dizinindedir. Yerel yedeğini bu dizin üzerinden tutabilirsin.

[Cloudflare D1 yerel geliştirme](https://developers.cloudflare.com/d1/best-practices/local-development/).

## 2. Kendi D1 veritabanını ve Worker'ını hazırla

Bu yol hem Vercel hem de VPS ile aynı şekilde çalışır. Cloudflare hesabında bu Ozear kurulumu için ozear-prod adlı yeni bir D1 veritabanı oluştur. Yerel kurulumdan sonra, yeni veritabanının ID değerini kendi terminalinde kullan.

    npm run cloudflare:configure -- --database-id <D1_DATABASE_ID>

Bu komut cloudflare/wrangler.json dosyasını yerelde oluşturur. Dosya, kendi D1 veritabanının kimliğini ve Worker ayarını tutar. Cloudflare hesabını ve hedef veritabanını gözden geçirdikten sonra şema geçişlerini uygula ve Worker'ı oluştur.

    npm run setup:gateway
    npm run prepare:production

İlk komut Cloudflare oturumunu ister, drizzle/ altındaki mevcut şema geçişlerini yeni D1'e uygular, Worker'ı yayımlar ve sunucudan sunucuya bağlantı anahtarını Cloudflare'da gizli değer olarak saklar. İkincisi web ve MCP için gereken anahtarları üretir ve .env.production.local dosyasına yazar. Bu ayarları kendi hesabında sakla. Örnek değişken listesi [.env.example](../.env.example) dosyasında.

[Cloudflare D1 ve Worker bağlantısı](https://developers.cloudflare.com/d1/get-started/).

## 3. Web sunucusunu seç

**Vercel.** Temiz deponu kendi Vercel projen olarak içe aktar. [vercel.json](../vercel.json) Next.js derleme komutunu belirler. .env.production.local dosyasında üretilen değerleri Vercel projesinin sunucu ortam değişkenleri bölümüne aktar. OZEAR_PUBLIC_URL değerini kendi web sunucunun HTTPS kök adresi olarak ayarla. Bu adresin sonunda /mcp olmamalı. D1_GATEWAY_URL olarak kendi Worker adresini kullan. Web ve Worker'daki OZEAR_OWNER_ID aynı olmalı.

[Vercel üzerinde Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs).

**VPS.** Node.js 22.13 veya üzeriyle aynı sunucu değişkenlerini ayarla. Linux sunucuda npm ci --legacy-peer-deps, npm run build:vercel ve npm run start:vercel sırasını kullan. Next.js sunucusunun 3000 numaralı portunu HTTPS terminasyonu yapan Caddy veya Nginx gibi bir ters vekilin arkasında tut. OZEAR_PUBLIC_URL dışarıdan açılan HTTPS adresi olmalı.

[Next.js kendi sunucunda barındırma](https://nextjs.org/docs/app/guides/self-hosting).

### Yayını doğrula

1. Tarayıcıda kendi HTTPS alan adını aç. Oturum açmadan çalışma alanı yerine giriş ekranı görünmeli.
2. Kendi giriş anahtarını yalnız giriş ekranına gir. Örnek bir proje ve görev oluştur. Sayfa yenilendiğinde kayıt görünmeli.
3. MCP adresini kimlik bilgisi olmadan dene. Yetkisiz isteğin 401 döndürdüğünü, ardından kendi istemcinde yetkili bir okuma çağrısının çalıştığını doğrula.
4. İlk kez yayın yapıyorsan [MCP rehberinde](mcp.md) yer alan salt okuma denemesiyle başla.

Sunucudaki D1 Worker anahtarı, web giriş anahtarı ve MCP istemci anahtarları farklı işlere yarar. Bunları kendi ortam değişkenlerinde sakla. Klonun varsayılan yerel akışında uzaktaki D1'e veri yazılmaz.
