# ChatGPT ile özel Ozear MCP bağlantısı

Sunucu adresi `https://ozear.example/mcp`. ChatGPT'ye **özel MCP sunucusu** olarak ekle ve **OAuth** seç. Bu seçenek dağıtım ve aşağıdaki kişisel OAuth yapılandırması tamamlanınca çalışır.

## AuthKit yapılandırması

1. Kendi [WorkOS AuthKit](https://dashboard.workos.com/) ortamı kullan. Bağlanacak kişisel kullanıcıyı oluştur veya davet et. Users ekranındaki sabit kullanıcı kimliğini (ör. `user_…`) al.
2. AuthKit'in MCP Resource Indicators listesine tam olarak `https://ozear.example/mcp` ekle. WorkOS Connect içinde ChatGPT için ayrı bir OAuth uygulaması oluştur. Authorization Code + S256 PKCE ve `openid` kapsamını kullan. Uygulama gizli istemciyse ChatGPT'ye bu uygulamanın OAuth Client ID ve Client Secret değerlerini özel eklenti ekranında gir.
3. ChatGPT'deki bağlantı yönetim ekranının gösterdiği **tam** callback adresini WorkOS Redirect URIs listesine ekle. OpenAI'nin sabit callback adresini yalnız ekran onu gösteriyorsa kullan. URL veya OAuth istemci sırrını koda ya da Git'e koyma.

## Ozear sunucu değişkenleri

| Sunucu değişkeni | Değer |
| --- | --- |
| `OZEAR_PUBLIC_URL` | `https://ozear.example` |
| `OZEAR_MCP_OAUTH_ISSUER` | Kişisel AuthKit HTTPS issuer origin'i. Örnek: `https://ornek.authkit.app`. |
| `OZEAR_MCP_OAUTH_SUBJECT` | 1. adımda alınan WorkOS kullanıcı kimliği. |
| `OZEAR_MCP_OAUTH_CLIENT_ID` | 2. adımın OAuth Client ID değeri. |
| `OZEAR_OWNER_ID` | Mevcut Ozear sahip kimliği. Aynen kullan. |

Değerler Vercel'in sunucu ortamına girilir. OAuth Client Secret yalnız ChatGPT'nin OAuth formuna girilir. Claude ve Gemini'nin mevcut MCP anahtarları kendi istemcilerinde kalır.

Dağıtım adımlarını kurulum rehberinden izle. MCP bağlantısını doğrulamak için önce araç keşfi ve salt okuma `list_projects` kullan.

`app/mcp/route.ts` OAuth açıkken kimliksiz isteklerde korunan kaynak keşif adresini duyurur. `lib/mcp-oauth.ts` AuthKit'in imzasını, issuer'ı, MCP audience'ını, kullanıcıyı, istemciyi, kapsamı ve süreyi doğrular. `app/chatgpt-auth.ts` başarılı tokenı yalnız mevcut Ozear sahibi için MCP kanalına bağlar. Yeniden giriş gerekirse özel eklenti bağlantısını yeniden yetkilendir. OAuth'u kapatmak için OAuth değişkenlerini kaldırıp Vercel sürümünü güncelle.

[ChatGPT özel MCP kurulumu](https://developers.openai.com/api/docs/guides/custom-mcp-server) · [OpenAI OAuth kuralları](https://developers.openai.com/plugins/build/auth) · [WorkOS MCP ayarları](https://workos.com/docs/authkit/mcp) · [WorkOS OAuth uygulamaları](https://workos.com/docs/authkit/connect/oauth)
