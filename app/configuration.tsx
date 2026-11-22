"use client";
import { foldForSearch } from "../lib/search";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  Clock3,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useDialog, hasUnsavedFields } from "../hooks/use-dialog";
import { configurationFields } from "../lib/configuration-contracts";
import {
  call,
  type Project,
  type ConfigurationItem,
  type ConfigurationHistory,
} from "../lib/client-api";
import { ozearConfiguration } from "../lib/ozear-configuration";
const categories = {
  frontend: "Frontend / Arayüz",
  backend: "Backend / API",
  database: "Veritabanı",
  hosting: "Sunucu / Hosting",
  tooling: "Geliştirme aracı",
  other: "Diğer",
};
const states = {
  active: "Kullanılıyor",
  retired: "Artık kullanılmıyor",
  planned: "Planlanıyor",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
export default function Configuration({
  projects,
  onCreateProject,
  onProjectsChanged,
  initialProjectId = "",
  technologyCounts = {},
  onOpenTickets,
}: {
  technologyCounts?: Record<string, number>;
  initialProjectId?: string;
  onOpenTickets: (id: string) => void;
  projects: Project[];
  onCreateProject: () => void;
  onProjectsChanged: () => Promise<unknown>;
}) {
  const [items, setItems] = useState<ConfigurationItem[]>([]),
    [loading, setLoading] = useState(Boolean(initialProjectId));
  const [inventoryReady, setInventoryReady] = useState(!initialProjectId);
  const [projectId, setProjectId] = useState(initialProjectId),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<ConfigurationItem | "new" | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [history, setHistory] = useState<
      Record<string, ConfigurationHistory[]>
    >({}),
    [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});
  const [draftProject, setDraftProject] = useState("");
  const [draftRows, setDraftRows] = useState<
    { id: string; category: keyof typeof categories }[]
  >([]);
  const [savedRows, setSavedRows] = useState<Record<string, boolean>>({});
  const [exampleNotice, setExampleNotice] = useState("");
  async function load() {
    if (!projectId) {
      setInventoryReady(true);
      return;
    }
    const data = await call("list_configuration", { projectId });
    setItems(data.items);
    setInventoryReady(true);
  }
  useEffect(() => {
    let active = true;
    if (!projectId) return;
    call("list_configuration", { projectId })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setInventoryReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  const busyLock = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  function closeEditor() {
    if (busyLock.current) return;
    if (
      hasUnsavedFields(dialogRef.current) &&
      !window.confirm(
        "Kaydedilmemiş teknoloji bilgileri var. Kaydetmeden kapatılsın mı?",
      )
    )
      return;
    setEditing(null);
    setError("");
  }
  useDialog(Boolean(editing), closeEditor, dialogRef);
  function open(
    item: ConfigurationItem | "new",
    targetProject = typeof item === "object" ? item.projectId : projectId,
    category?: keyof typeof categories,
  ) {
    if (
      busyLock.current ||
      !targetProject ||
      !projects.some((project) => project.id === targetProject)
    )
      return;
    setError("");
    setSavedRows({});
    setDraftProject(targetProject);
    if (item === "new")
      setDraftRows(
        (category
          ? [category]
          : ([
              "frontend",
              "backend",
              "database",
              "hosting",
            ] as (keyof typeof categories)[])
        ).map((category) => ({ id: crypto.randomUUID(), category })),
      );
    setEditing(item);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyLock.current) return;
    const data = new FormData(event.currentTarget);
    setError("");
    if (editing === "new") {
      const pending = [];
      for (const row of draftRows) {
        if (savedRows[row.id]) continue;
        const fields = Object.fromEntries(
          [
            "name",
            "category",
            "version",
            "purpose",
            "notes",
            "url",
            "state",
          ].map((name) => [name, data.get(`${row.id}.${name}`) ?? ""]),
        );
        if (
          !["name", "version", "purpose", "notes", "url"].some((name) =>
            String(fields[name]).trim(),
          )
        )
          continue;
        const parsed = configurationFields.safeParse(fields);
        if (!parsed.success) {
          setError(
            "Her dolu satır için teknoloji adı, kategori ve geçerli bir bağlantı gir. Bağlantı alanını boş bırakabilirsin.",
          );
          return;
        }
        pending.push({ id: row.id, fields: parsed.data });
      }
      if (!pending.length) {
        setError(
          "En az bir teknoloji ekle. Kullanmadığın kategorileri boş bırakabilirsin.",
        );
        return;
      }
      busyLock.current = true;
      setBusy(true);
      let saved = Object.keys(savedRows).length;
      try {
        for (const row of pending) {
          await call("create_configuration", {
            ...row.fields,
            projectId: draftProject,
            requestKey: row.id,
          });
          setSavedRows((previous) => ({ ...previous, [row.id]: true }));
          saved++;
        }
        setEditing(null);
        setHistory({});
        await load().catch(() =>
          setError(
            "Kayıt kaydedildi ancak liste yenilenemedi. Sayfayı yenileyebilirsin.",
          ),
        );
      } catch (e) {
        setError(
          `${saved} teknoloji kaydedildi. Kalanları kaydetmek için tekrar dene. ${(e as Error).message}`,
        );
        try {
          await load();
        } catch {}
      } finally {
        busyLock.current = false;
        setBusy(false);
      }
      return;
    }
    if (!editing) return;
    const fields = Object.fromEntries(
      ["name", "category", "version", "purpose", "notes", "url", "state"].map(
        (name) => [name, data.get(name) ?? ""],
      ),
    );
    busyLock.current = true;
    setBusy(true);
    try {
      await call("update_configuration", {
        ...fields,
        itemId: editing.id,
        expectedRevision: editing.revision,
      });
      setEditing(null);
      setHistory({});
      await load().catch(() =>
        setError(
          "Kayıt kaydedildi ancak liste yenilenemedi. Sayfayı yenileyebilirsin.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyLock.current = false;
      setBusy(false);
    }
  }
  async function saveOzearExample() {
    if (
      busyLock.current ||
      !activeProject ||
      activeProject.name.trim().toLocaleLowerCase("tr").replace(/ı/g, "i") !==
        "ozear"
    )
      return;
    const project = activeProject;
    busyLock.current = true;
    setBusy(true);
    setError("");
    setExampleNotice("");
    let added = 0;
    try {
      const existing = (
        await call("list_configuration", { projectId: project.id })
      ).items;
      for (const item of ozearConfiguration) {
        const { key } = item;
        const fields = configurationFields.parse(item);
        const requestKey = `ozear-example-v1:${project.id}:${key}`;
        if (
          existing.some(
            (item) =>
              item.requestKey === requestKey ||
              (item.name.toLocaleLowerCase("tr").replace(/ı/g, "i") ===
                fields.name.toLocaleLowerCase("tr").replace(/ı/g, "i") &&
                item.category === fields.category),
          )
        )
          continue;
        await call("create_configuration", {
          ...fields,
          projectId: project.id,
          requestKey,
        });
        added++;
      }
      setExampleNotice(
        `${added} teknoloji kaydı eklendi. Mevcut kayıtlar korundu.`,
      );
      setProjectId(project.id);
      setQuery("");
      setFilter("all");
    } catch (e) {
      setError(
        `${added} kayıt eklendi. ${(e as Error).message} Tekrar denediğinde aynı kayıtlar çoğaltılmaz.`,
      );
    } finally {
      try {
        await Promise.all([load(), onProjectsChanged()]);
      } catch {
        setError(
          (previous) =>
            previous ||
            "Kayıt işlemi tamamlandı ancak liste yenilenemedi. Sayfayı yenile.",
        );
      }
      busyLock.current = false;
      setBusy(false);
    }
  }
  function technologyFields(
    prefix = "",
    item: ConfigurationItem | null = null,
    category: keyof typeof categories = "frontend",
    required = true,
  ) {
    return (
      <>
        <div className="form-grid">
          <label>
            Teknoloji adı
            <input
              required={required}
              maxLength={240}
              name={`${prefix}name`}
              defaultValue={item?.name}
              placeholder={
                category === "backend"
                  ? "Örn. .NET, Node.js"
                  : category === "database"
                    ? "Örn. D1, PostgreSQL"
                    : category === "hosting"
                      ? "Örn. Vercel, Oracle"
                      : "Örn. Flutter, React"
              }
            />
          </label>
          <label>
            Sürüm
            <input
              maxLength={120}
              name={`${prefix}version`}
              defaultValue={item?.version}
              placeholder="Bilmiyorsan boş bırak"
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Kategori
            <select
              name={`${prefix}category`}
              defaultValue={item?.category ?? category}
            >
              {Object.entries(categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kullanım durumu
            <select
              name={`${prefix}state`}
              defaultValue={item?.state ?? "active"}
            >
              {Object.entries(states).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Ne için kullandın?
          <textarea
            rows={2}
            maxLength={3000}
            name={`${prefix}purpose`}
            defaultValue={item?.purpose}
            placeholder="Projede hangi sorumluluğu üstleniyor?"
          />
        </label>
        <details className="technology-extra">
          <summary>Bağlantı ve karar notları</summary>
          <label>
            Doküman veya depo bağlantısı
            <input
              type="url"
              maxLength={2000}
              name={`${prefix}url`}
              defaultValue={item?.url}
              placeholder="https://…"
            />
          </label>
          <label>
            Kararlar ve notlar
            <textarea
              rows={2}
              maxLength={8000}
              name={`${prefix}notes`}
              defaultValue={item?.notes}
              placeholder="Neden seçtin? Hatırlamak istediğin ayarlar neler?"
            />
          </label>
        </details>
      </>
    );
  }
  async function showHistory(item: ConfigurationItem) {
    if (history[item.id] || historyLoading[item.id]) return;
    setHistoryLoading((previous) => ({ ...previous, [item.id]: true }));
    try {
      const data = await call("get_configuration_history", { itemId: item.id });
      setHistory((previous) => ({ ...previous, [item.id]: data.history }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHistoryLoading((previous) => ({ ...previous, [item.id]: false }));
    }
  }
  const activeProject = projects.find((project) => project.id === projectId);
  const byProject = useMemo(() => {
    const grouped = new Map<string, ConfigurationItem[]>();
    for (const item of items) {
      const list = grouped.get(item.projectId) ?? [];
      list.push(item);
      grouped.set(item.projectId, list);
    }
    return grouped;
  }, [items]);
  const projectItems = byProject.get(projectId) ?? [];
  const searchText = foldForSearch(query.trim());
  const filtered = projectItems.filter(
    (item) =>
      (filter === "all" || item.state === filter) &&
      foldForSearch(
        `${item.name} ${item.version} ${item.purpose} ${item.notes}`,
      ).includes(searchText),
  );
  const visibleProjects = projects.filter((project) =>
    foldForSearch(`${project.name} ${project.description}`).includes(
      searchText,
    ),
  );
  const initial = editing && editing !== "new" ? editing : null;
  async function retryLoad() {
    if (busyLock.current) return;
    setLoading(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function chooseProject(id: string) {
    setLoading(Boolean(id));
    setInventoryReady(!id);
    setProjectId(id);
    setQuery("");
    setFilter("all");
    setExampleNotice("");
  }
  function renderItem(item: ConfigurationItem) {
    return (
      <article
        className="configuration-card"
        data-category={item.category}
        key={item.id}
      >
        <div className="configuration-card-top">
          <span className="project-tag">{categories[item.category]}</span>
          <span className={`configuration-state ${item.state}`}>
            {states[item.state]}
          </span>
        </div>
        <h3>
          {item.name}
          <code>{item.version || "Sürüm belirtilmemiş"}</code>
        </h3>
        <p className="configuration-purpose">
          {item.purpose || "Kullanım amacı henüz eklenmedi."}
        </p>
        {item.notes && (
          <details className="decision-notes">
            <summary>Kararlar ve koddaki yeri</summary>
            <p>{item.notes}</p>
          </details>
        )}
        <div className="configuration-card-actions">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Bağlantıyı aç
              <ArrowUpRight size={14} />
            </a>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => open(item)}
          >
            Düzenle
          </button>
        </div>
        <details
          onToggle={(e) => {
            if (e.currentTarget.open) showHistory(item);
          }}
        >
          <summary>
            <Clock3 size={14} />
            Değişiklik geçmişi · {item.revision}
          </summary>
          <div className="configuration-history">
            <p>Güncel kayıt · {date(item.updatedAt)}</p>
            {historyLoading[item.id] ? (
              <p role="status">Geçmiş yükleniyor…</p>
            ) : history[item.id]?.length ? (
              history[item.id].map((entry) => (
                <div key={entry.id}>
                  <small>{date(entry.createdAt)} öncesi</small>
                  <strong>
                    {entry.snapshot.name} {entry.snapshot.version}
                  </strong>
                  <p>
                    {states[entry.snapshot.state]} ·{" "}
                    {categories[entry.snapshot.category]}
                  </p>
                  <p>{entry.snapshot.purpose}</p>
                  <p>{entry.snapshot.notes}</p>
                </div>
              ))
            ) : history[item.id] ? (
              <p>Henüz değişiklik yapılmadı.</p>
            ) : (
              <button className="secondary" onClick={() => showHistory(item)}>
                Geçmişi yeniden yükle
              </button>
            )}
          </div>
        </details>
      </article>
    );
  }
  return (
    <section
      className="configuration-page"
      aria-label="Proje konfigürasyonları"
    >
      {error && (
        <div className="error" role="alert">
          {error}
          <button disabled={loading || busy} onClick={retryLoad}>
            Tekrar dene
          </button>
        </div>
      )}
      {!activeProject ? (
        <>
          <div className="project-directory-heading">
            <div>
              <h2>Projeler</h2>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={onCreateProject}
            >
              <Plus size={17} />
              Yeni proje
            </button>
          </div>
          <div className="configuration-filters">
            <div className="configuration-search">
              <Search size={17} />
              <input
                aria-label="Projelerde ara"
                placeholder="Proje adı veya açıklamasında ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span>{visibleProjects.length} proje</span>
          </div>
          {!projects.length ? (
            <div className="empty">
              <Box size={32} />
              <h2>Henüz proje yok.</h2>
              <p>
                Teknolojiler, oluşturduğun projenin konfigürasyonunda yer alır.
              </p>
              <button className="secondary" onClick={onCreateProject}>
                İlk projeni oluştur
                <ArrowRight size={16} />
              </button>
            </div>
          ) : !visibleProjects.length ? (
            <div className="empty">
              <h2>Proje bulunamadı.</h2>
              <button className="secondary" onClick={() => setQuery("")}>
                Aramayı temizle
              </button>
            </div>
          ) : (
            <div className="project-directory">
              {visibleProjects.map((project, index) => {
                const records = byProject.get(project.id) ?? [];
                return (
                  <button
                    className="project-directory-card"
                    key={project.id}
                    onClick={() => chooseProject(project.id)}
                  >
                    <span className="project-card-top">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <ArrowUpRight size={24} />
                    </span>
                    <h3>{project.name}</h3>
                    <p>{project.description || "Açıklama eklenmemiş."}</p>
                    <div className="project-card-tags">
                      {Array.from(
                        new Set(records.map((item) => item.category)),
                      ).map((category) => (
                        <span key={category}>{categories[category]}</span>
                      ))}
                    </div>
                    <span className="project-card-bottom">
                      {loading
                        ? "Konfigürasyon yükleniyor…"
                        : !inventoryReady
                          ? "Konfigürasyon yüklenemedi"
                          : (technologyCounts[project.id] ?? records.length)
                            ? `${technologyCounts[project.id] ?? records.length} teknoloji`
                            : "Konfigürasyon eklenmemiş"}
                      <span>Projeyi aç →</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="project-detail-nav">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => chooseProject("")}
            >
              <ArrowLeft size={17} />
              Tüm projeler
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onOpenTickets(activeProject.id)}
            >
              Projenin biletleri
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="project-directory-heading">
            <div>
              <h2>{activeProject.name}</h2>
              {activeProject.description && <p>{activeProject.description}</p>}
            </div>
            <button
              className="primary"
              disabled={loading || busy || !inventoryReady}
              onClick={() => open("new", activeProject.id)}
            >
              <Plus size={17} />
              Bu projeye teknoloji ekle
            </button>
          </div>
          <div className="project-facts">
            <div>
              <strong>{inventoryReady ? projectItems.length : "—"}</strong>
              <span>Teknoloji</span>
            </div>
            <div>
              <strong>
                {inventoryReady
                  ? new Set(projectItems.map((item) => item.category)).size
                  : "—"}
              </strong>
              <span>Kategori</span>
            </div>
            <div>
              <strong>
                {inventoryReady
                  ? projectItems.filter((item) => item.state === "planned")
                      .length
                  : "—"}
              </strong>
              <span>Planlanan</span>
            </div>
          </div>
          {activeProject.name
            .trim()
            .toLocaleLowerCase("tr")
            .replace(/ı/g, "i") === "ozear" && (
            <details className="ozear-example">
              <summary>
                Ozear’ın kaynak koddan hazırlanan konfigürasyonu
              </summary>
              <p>
                TypeScript programlama dili; React arayüz kütüphanesi; CSS
                görünüm katmanı. Aşağıdaki örnek yalnız bu projeye kaydedilir.
                Vercel henüz planlanıyor.
              </p>
              <div className="ozear-stack-table">
                <table>
                  <thead>
                    <tr>
                      <th>Görevi</th>
                      <th>Teknoloji</th>
                      <th>Açıklama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ozearConfiguration.map((item) => (
                      <tr key={item.key}>
                        <td>{item.role}</td>
                        <td>
                          {item.name}
                          <small>
                            {item.version} · {states[item.state]}
                          </small>
                        </td>
                        <td>{item.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="secondary"
                disabled={busy || loading || !inventoryReady}
                onClick={saveOzearExample}
              >
                Bu projenin eksik konfigürasyonlarını ekle
              </button>
              <p>Mevcut kayıtların üzerine yazılmaz.</p>
              {exampleNotice && <p role="status">{exampleNotice}</p>}
            </details>
          )}
          <div className="configuration-filters">
            <div className="configuration-search">
              <Search size={17} />
              <input
                aria-label="Bu projenin teknolojilerinde ara"
                placeholder="Teknoloji, sürüm veya karar ara…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Kullanım durumuna göre filtrele"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Tüm durumlar</option>
              {Object.entries(states).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="empty" role="status">
              <Loader2 className="spin" />
              Projenin konfigürasyonu yükleniyor…
            </div>
          ) : !inventoryReady ? (
            <div className="empty">
              <h2>Konfigürasyon yüklenemedi.</h2>
              <p>Mevcut kayıtları görebilmek için yeniden dene.</p>
              <button className="secondary" onClick={retryLoad}>
                Konfigürasyonu yeniden yükle
              </button>
            </div>
          ) : !filtered.length ? (
            <div className="empty">
              <Box size={30} />
              <h2>
                {projectItems.length
                  ? "Eşleşen teknoloji yok."
                  : "Bu projede teknoloji kaydı yok."}
              </h2>
              <p>
                {projectItems.length
                  ? "Aramayı veya durum filtresini değiştirebilirsin."
                  : "Arayüz, backend, veritabanı ve sunucu bilgilerini bu projeye ekle."}
              </p>
              {projectItems.length ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Filtreleri temizle
                </button>
              ) : (
                <button
                  className="secondary"
                  onClick={() => open("new", activeProject.id)}
                >
                  İlk teknolojileri ekle
                  <Plus size={16} />
                </button>
              )}
            </div>
          ) : (
            Object.entries(categories).map(([category, label]) => {
              const entries = filtered.filter(
                (item) => item.category === category,
              );
              return entries.length ? (
                <section className="configuration-category" key={category}>
                  <div className="section-title">
                    <h3>{label}</h3>
                    <span>{entries.length} teknoloji</span>
                  </div>
                  <div className="configuration-cards">
                    {entries.map(renderItem)}
                  </div>
                </section>
              ) : null;
            })
          )}
        </>
      )}
      {editing && (
        <div className="overlay" onClick={closeEditor}>
          <section
            ref={dialogRef}
            id="configuration-dialog"
            className={`modal ${initial ? "" : "stack-modal"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="configuration-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <span className="eyebrow">PROJENİN TEKNOLOJİLERİ</span>
              <button
                disabled={busy}
                aria-label="Pencereyi kapat"
                onClick={closeEditor}
              >
                <X size={19} />
              </button>
            </header>
            <h2 id="configuration-title">
              {initial ? "Teknolojiyi düzenle" : "Projeye teknolojiler ekle"}
            </h2>
            <form onSubmit={submit}>
              {!initial && (
                <>
                  <p className="project-context">
                    Proje:{" "}
                    <strong>
                      {
                        projects.find((project) => project.id === draftProject)
                          ?.name
                      }
                    </strong>
                  </p>
                  <p className="stack-form-description">
                    Bir proje birden fazla kategoride, her kategoride de birden
                    fazla teknoloji kullanabilir. Kullanmadığın satırları boş
                    bırak.
                  </p>
                  <div className="stack-draft-rows">
                    {draftRows.map((row, index) => (
                      <fieldset
                        className="stack-draft-row"
                        key={row.id}
                        disabled={busy || savedRows[row.id]}
                      >
                        <legend>
                          {index + 1}. teknoloji{" "}
                          {savedRows[row.id] && " · Kaydedildi"}
                        </legend>
                        {!savedRows[row.id] && (
                          <button
                            className="stack-remove"
                            type="button"
                            disabled={busy || draftRows.length === 1}
                            aria-label={`${index + 1}. satırı kaldır`}
                            onClick={() =>
                              setDraftRows((previous) =>
                                previous.filter((item) => item.id !== row.id),
                              )
                            }
                          >
                            <X size={15} />
                          </button>
                        )}
                        {technologyFields(
                          `${row.id}.`,
                          null,
                          row.category,
                          false,
                        )}
                      </fieldset>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || draftRows.length >= 30}
                    onClick={() =>
                      setDraftRows((previous) => [
                        ...previous,
                        { id: crypto.randomUUID(), category: "other" },
                      ])
                    }
                  >
                    <Plus size={15} />
                    Başka bir teknoloji ekle
                  </button>
                </>
              )}
              {initial && technologyFields("", initial, initial.category)}
              <p className="configuration-form-hint">
                Sürümü hatırlamıyorsan boş bırakabilirsin. Parola, token veya
                erişim anahtarı ekleme. Düzenlemelerde önceki kayıt geçmişte
                korunur.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={closeEditor}
                >
                  Vazgeç
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Plus size={15} />
                  )}{" "}
                  {initial ? "Kaydet" : "Teknolojileri kaydet"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
