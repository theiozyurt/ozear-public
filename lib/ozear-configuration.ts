import packageInfo from "../package.json";
import type { z } from "zod";
import type { configurationFields } from "./configuration-contracts";

type Entry = z.infer<typeof configurationFields> & {
  key: string;
  role: string;
};
const entry = (
  key: string,
  role: string,
  name: string,
  category: Entry["category"],
  version: string,
  purpose: string,
  notes: string,
  state: Entry["state"] = "active",
): Entry => ({
  key,
  role,
  name,
  category,
  version,
  purpose,
  notes,
  state,
  url: "",
});
// Repository-backed example. Active means used by this code, not deployed to production.
export const ozearConfiguration: Entry[] = [
  entry(
    "typescript-ui",
    "Programlama dili",
    "TypeScript",
    "frontend",
    packageInfo.devDependencies.typescript,
    "Arayüz davranışlarını ve veri tiplerini yazdığımız dil. JavaScript'e tip kontrolü ekler.",
    "app/workspace.tsx ve app/configuration.tsx. TSX, TypeScript içinde React ekranlarını tanımlamamızı sağlar; ayrı bir programlama dili değildir.",
  ),
  entry(
    "react",
    "Arayüz kütüphanesi",
    "React",
    "frontend",
    packageInfo.dependencies.react,
    "Bilet listesi, formlar ve açılır pencereleri bileşenlerle oluşturur. Durum değiştiğinde ekranı günceller.",
    "app/workspace.tsx, app/configuration.tsx. React bir dil değildir; TypeScript ile kullanılır.",
  ),
  entry(
    "css",
    "Görünüm ve yerleşim",
    "CSS",
    "frontend",
    "",
    "Renkleri, boyutları, sayfa yerleşimini ve mobil görünümü belirler.",
    "app/globals.css özel tasarım kurallarını içerir. Tailwind CSS 4.2.1 de bu dosyadan içe aktarılır.",
  ),
  entry(
    "typescript-api",
    "Sunucu dili",
    "TypeScript",
    "backend",
    packageInfo.devDependencies.typescript,
    "Proje, bilet ve not işlemlerini doğrular; web ile yapay zekâ aynı iş kurallarını kullanır.",
    "app/api/action/route.ts → lib/service.ts → db/index.ts. Arayüz tarayıcıda, iş kuralları sunucuda çalışır.",
  ),
  entry(
    "vinext",
    "Web çalışma ortamı",
    "Vinext / Next.js API",
    "backend",
    packageInfo.devDependencies.vinext,
    "Next.js uygulama yapısını Vite ve Cloudflare çalışma ortamıyla çalıştırır.",
    `vite.config.ts ve scripts/run-framework.mjs. Next.js paket sürümü ${packageInfo.dependencies.next}; mevcut derleme Vinext kullanır. Standart Vercel/Next.js geçişi tamamlanmadı.`,
  ),
  entry(
    "d1",
    "Veritabanı",
    "Cloudflare D1 / SQLite",
    "database",
    "",
    "Projeleri, biletleri, çalışma notlarını ve teknoloji geçmişini ilişkili tablolarda saklar.",
    "db/schema.ts tabloları; drizzle/ SQL şema geçişlerini; db/index.ts DB bağlantısını tanımlar. Yerel geliştirme yerel D1 kullanır; canlı bağlantı ayrıca doğrulanmalıdır.",
  ),
  entry(
    "drizzle",
    "Veritabanı erişim aracı",
    "Drizzle ORM",
    "database",
    packageInfo.dependencies["drizzle-orm"],
    "TypeScript sorgularını SQL'e çevirir. Veri kaydını ve ilişkili kayıtların birlikte silinmesini yönetmemizi sağlar.",
    "lib/service.ts ve db/schema.ts. Drizzle veritabanının kendisi değildir; D1'e erişim katmanıdır.",
  ),
  entry(
    "zod",
    "Girdi doğrulama",
    "Zod",
    "backend",
    packageInfo.dependencies.zod,
    "Boş başlık, geçersiz durum veya yanlış biçimdeki API girdilerinin kayda dönüşmesini engeller.",
    "lib/contracts.ts, lib/configuration-contracts.ts ve lib/client-api.ts. İstekleri ve tarayıcının aldığı yanıtları doğrular.",
  ),
  entry(
    "workers",
    "Sunucu çalışma ortamı",
    "Cloudflare Workers",
    "hosting",
    "",
    "Mevcut uygulama çalışma ortamı ve D1'e erişecek gateway burada çalışacak biçimde hazırlanmış durumda.",
    "vite.config.ts, db/index.ts ve cloudflare/gateway.ts. Kodda kullanılıyor; canlı yayın yapıldığı anlamına gelmez.",
  ),
  entry(
    "vercel",
    "Web barındırma seçeneği",
    "Vercel",
    "hosting",
    "",
    "Web arayüzünü ve MCP uç noktasını barındırmak için kullanılabilen platform.",
    "docs/kurulum.md. Node çalışma ortamı D1 veritabanına korumalı Worker üzerinden erişir.",
    "planned",
  ),
];
