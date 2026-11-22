import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDashed,
  Sparkles,
  Terminal,
} from "lucide-react";
import type { Learning, Log } from "../lib/client-api";
export const date = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
export function StatusIcon({ status }: { status: string }) {
  return status === "done" ? (
    <CheckCircle2 size={16} className="done" />
  ) : status === "in_progress" ? (
    <CircleDashed size={16} className="progress" />
  ) : (
    <Circle size={16} className="muted" />
  );
}
export function learningBlock(l: Learning) {
  return (
    <div className="learning-fields">
      {l.files?.map((f) => (
        <div key={f.path}>
          <code>{f.path}</code>
          <p>{f.explanation}</p>
        </div>
      ))}
      {[
        ["Akış", l.flow],
        ["Karar ve gerekçe", l.reason],
        ["Doğrulama", l.verification],
        ["Bir düşünme sorusu", l.question],
      ]
        .filter(([, v]) => v)
        .map(([label, value]) => (
          <div key={label}>
            <span className="eyebrow">{label}</span>
            <p>{value}</p>
          </div>
        ))}
    </div>
  );
}
export function IntegrationView({ publicUrl }: { publicUrl: string }) {
  return (
    <div className="integration-grid">
      <section className="integration-main">
        <p className="integration-intro">
          MCP uç noktası hazır. Uç nokta:{" "}
          <code>
            {publicUrl ? `${publicUrl.replace(/\/$/, "")}/mcp` : "/mcp"}
          </code>
        </p>
        <div className="example-prompt">
          <Sparkles size={18} />
          <p>
            “Bu oturumda yaptıklarımızı ilgili bilete ekle. Değişen dosyaların
            görevini ve kodun akışını da açıkla.”
          </p>
        </div>
        <h3>Nasıl bağlanır?</h3>
        <ol className="connection-steps">
          <li>
            <strong>Ozear bağlantısını etkinleştir.</strong>
            <p>
              MCP adresini desteklenen istemcide kişisel erişim anahtarınla
              bağla.
            </p>
          </li>
          <li>
            <strong>Projeni ve biletini seç.</strong>
            <p>
              Yapay zekâ projeleri ve biletleri arayabilir; “yaptıklarımızı
              ekle” dediğinde çalışma notu oluşturabilir.
            </p>
          </li>
          <li>
            <strong>Kod açıklamalarını kaydet.</strong>
            <p>
              Kod araçlarına erişimi varsa gerçek dosyaları inceler. Dosya
              görevlerini, akışı, gerekçeyi ve test sonucunu kaydeder.
            </p>
          </li>
        </ol>
        <div className="connection-note">
          <BookOpen size={19} />
          <p>
            Rehber get_context veya rehber kaynağı ile yüklenir; bilet yanıtları
            sürüm işareti taşır. Uygulanması kullandığın yapay zekâ istemcisine
            bağlıdır. Ozear kendi başına kod depona erişmez.
          </p>
        </div>
        <a className="secondary inline" href="/api/skill">
          <ArrowDownToLine size={16} />
          SKILL.md rehberini indir
        </a>
      </section>
      <aside className="context-card tool-card">
        <div className="card-label">
          <Terminal size={15} /> KULLANILABİLİR ARAÇLAR
        </div>
        {[
          ["list_projects", "Projelerini gör"],
          ["get_project", "Proje ayrıntısını oku"],
          ["get_workspace", "Çalışma alanını özetle"],
          ["get_configuration", "Teknoloji kaydını oku"],
          ["list_worklogs", "Notlarda ara"],
          ["update_worklog", "Notu düzenle"],
          ["delete_worklog", "Notu sil"],
          ["log_work", "Tek çağrıda iş kaydet"],
          ["search_issues", "Biletleri ara"],
          ["get_issue", "Bileti ve notları oku"],
          ["create_issue", "Yeni bilet aç"],
          ["update_issue", "Durumu güncelle"],
          ["delete_issue", "Bileti sil"],
          ["add_worklog", "Yapılanları kaydet"],
          ["get_context", "Öğrenme rehberini yükle"],
          ["create_project", "Proje oluştur"],
          ["update_project", "Projeyi düzenle"],
          ["delete_project", "Projeyi sil"],
          ["export_data", "Verileri dışa aktar"],
          ["list_configuration", "Teknoloji envanterini gör"],
          ["create_configuration", "Teknoloji ekle"],
          ["update_configuration", "Teknolojiyi güncelle"],
          ["get_configuration_history", "Teknoloji geçmişini oku"],
        ].map(([name, label]) => (
          <div className="tool-row" key={name}>
            <code>{name}</code>
            <small>{label}</small>
          </div>
        ))}
        <div className="endpoint">
          <span className="eyebrow">MCP UÇ NOKTASI</span>
          <code>/mcp</code>
          <p>
            Kişisel hesap doğrulaması gerekir. Harici istemci bağlantıları
            ayrıca yapılandırılır.
          </p>
        </div>
      </aside>
    </div>
  );
}
export function JournalView({
  view,
  logCursor,
  journalLogs,
  mutate,
  moreLogs,
  openIssue,
  navigate,
}: {
  view: string;
  logCursor: string | null;
  journalLogs: Log[];
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
  moreLogs: () => Promise<void>;
  openIssue: (id: number) => Promise<void>;
  navigate: (view: string) => void;
}) {
  return (
    <section className="journal">
      {logCursor && (
        <button className="secondary" onClick={() => mutate(moreLogs)}>
          Daha eski kayıtlar
        </button>
      )}
      <div className="section-title">
        <span>{view === "journal" ? "ÇALIŞMA GEÇMİŞİ" : "BİRİKEN BİLGİ"}</span>
        <span>{journalLogs.length} kayıt</span>
      </div>
      {journalLogs.map((l) => (
        <article key={l.id} className="journal-card">
          <div className="journal-date">
            <span className="tiny-dot" />
            {date(l.createdAt)}
            <span className="source-tag">
              {l.source.startsWith("mcp") ? "Yapay zekâ" : "Web"}
            </span>
          </div>
          <button className="journal-link" onClick={() => openIssue(l.issueId)}>
            OZY-{l.issueId}
            <ArrowUpRight size={13} />
          </button>
          <p className="log-summary">{l.summary}</p>
          {learningBlock(l.learning)}
        </article>
      ))}
      {!journalLogs.length && (
        <div className="empty">
          <BookOpen size={30} />
          <h2>
            {view === "learning"
              ? "Henüz öğrenme notu yok."
              : "Henüz çalışma kaydı yok."}
          </h2>
          <p>
            Bir bilete çalışma notu eklediğinde{" "}
            {view === "learning"
              ? "akış, karar ve doğrulama açıklamaları"
              : "yaptığın işler"}{" "}
            burada görünür.
          </p>
          <button className="secondary" onClick={() => navigate("issues")}>
            Biletlere dön
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
