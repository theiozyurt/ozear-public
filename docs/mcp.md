# Yapay zekâ asistanını Ozear'a bağla

MCP, asistanın kendi Ozear kurulumunda projeleri ve görevleri aramasını, görev açmasını ve açıkça istendiğinde çalışma notu kaydetmesini sağlar. Bu rehber internete açtığın ve kimlik doğrulaması olan kendi kurulumun içindir. Bağlantı adresi, kendi web sunucunun HTTPS adresine /mcp eklenerek oluşur.

| İstemci | Bağlantı |
| --- | --- |
| Claude ve Gemini gibi HTTP ve Bearer header destekleyen istemciler | Streamable HTTP adresini gir. Asistana ayrılmış anahtarı istemcinin gizli ayarında Authorization başlığında Bearer biçiminde kullan. |
| OAuth kullanan uzak istemciler | [OAuth kurulumunu](chatgpt-mcp-oauth.md) kendi kimlik sağlayıcı hesabınla tamamla. |

[Claude ayar örneği](../examples/mcp/claude.json) ve [Gemini ayar örneği](../examples/mcp/gemini.json). Adres ve anahtar alanlarını kendi istemci ayarlarında değiştir. D1 Worker anahtarı, MCP erişim anahtarı olarak kullanılmaz.

## Yapay zekâ aracına örnek istekler

Önce şu salt okuma isteğini dene.

> Ozear adlı MCP bağlantısını kullan. Projeleri listele ve “Örnek Stok Uygulaması” projesindeki açık görevleri özetle. Hiçbir kayıt oluşturma veya güncelleme.

Örnek bir görevde çalıştıktan sonra şu isteği kullanabilirsin.

> Ozear'da “Stok yokken siparişi engelle” görevini bul. Bu oturumda tamamladığımız değişikliği o göreve çalışma notu olarak ekle. İlgili dosyaların görevini, verinin nasıl ilerlediğini, kararın gerekçesini ve gerçekten çalıştırdığın testleri yaz.

MCP, görev kayıtlarına erişim sağlar. Kod açıklaması hazırlayabilmek için asistanın Git deposuna da kendi kod araçları üzerinden erişebilmesi gerekir. [Öğrenme rehberi](../skills/ozear-code-literacy/SKILL.md).

[Model Context Protocol HTTP taşıması](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).
