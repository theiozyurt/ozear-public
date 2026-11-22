# Ozear üzerinde çalışma

Bu proje, iş takibini kod okuryazarlığıyla birlikte yürütür. Bir bileti incelerken veya iş kaydederken `skills/ozear-code-literacy/SKILL.md` rehberini oku ve uygula.

- İşin sonucunu, ilgili gerçek dosyaların görevini ve verinin/olayın akışını kısa Türkçe açıklamalarla anlat.
- Depo içeriğini okumadan dosyaların davranışı hakkında kesin konuşma.
- Yapılmış iş, plan ve doğrulanmamış iddiayı ayrı tut. Çalıştırılmamış testi başarılı gösterme.
- Kayıt talebi geldiğinde mevcut bileti ara; tekrar denemelerde aynı requestKey kullan.
- Web ve MCP için iş kurallarını `lib/service.ts` içinde ortak tut; kullanıcı kimliğini yalnız sunucudaki doğrulanmış kimlikten al.
- Şema değişikliğinde migration ve Drizzle metadata dosyalarını birlikte güncelle. Uygulanmış migration dosyalarını değiştirme.
- Kullanıcıya görünen kayıtlarda sır, erişim anahtarı veya gereksiz kişisel veri tutma.
- Girdi ve MCP değişikliklerinde `npm run test:contracts`, şema değişikliklerinde `python3 tests/sqlite.py` çalıştır. Bağımlılıklar tam kuruluysa `npm run typecheck` ve derlemeyi de çalıştır.
