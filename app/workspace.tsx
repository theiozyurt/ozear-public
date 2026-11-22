"use client";
import {
  IntegrationView,
  JournalView,
  learningBlock,
  StatusIcon,
  date,
} from "./workspace-views";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Configuration from "./configuration";
import { useDialog, hasUnsavedFields } from "../hooks/use-dialog";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Settings2,
  Terminal,
  X,
  Trash2,
  LogOut,
  UserRound,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

import { call, type Project, type Issue, type Log } from "../lib/client-api";
const states = {
  backlog: "Bekliyor",
  in_progress: "Yapılıyor",
  done: "Tamamlandı",
};
const priorities = { low: "Düşük", normal: "Normal", high: "Yüksek" };

function readData() {
  return call("get_workspace");
}
export default function Workspace({
  displayName,
  email,
  publicUrl = "",
}: {
  displayName: string;
  email: string;
  publicUrl?: string;
}) {
  const [nextCursor, setNextCursor] = useState<string | null>(null),
    [logCursor, setLogCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<
    { projectId: string; status: string; count: number }[]
  >([]);
  const [projects, setProjects] = useState<Project[]>([]),
    [issues, setIssues] = useState<Issue[]>([]),
    [logs, setLogs] = useState<Log[]>([]);
  const [view, setView] = useState("configuration"),
    [projectId, setProjectId] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [board, setBoard] = useState(false);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
      "project" | "issue" | "edit-project" | null
    >(null),
    [selected, setSelected] = useState<{
      issue: Issue;
      worklogs: Log[];
      nextWorklogCursor?: string | null;
      totalWorklogs?: number;
    } | null>(null),
    [detailLoading, setDetailLoading] = useState(false);
  const [showLearning, setShowLearning] = useState(false),
    [note, setNote] = useState(""),
    [flow, setFlow] = useState(""),
    [reason, setReason] = useState(""),
    [verification, setVerification] = useState(""),
    [question, setQuestion] = useState("");
  const search = useRef<HTMLInputElement>(null),
    requestKey = useRef(crypto.randomUUID()),
    noteKey = useRef(crypto.randomUUID());
  const [editingProject, setEditingProject] = useState<Project | null>(null),
    [deleteCandidate, setDeleteCandidate] = useState<Project | null>(null),
    [deleteName, setDeleteName] = useState("");
  const [profileOpen, setProfileOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [techCounts, setTechCounts] = useState<Record<string, number>>({});
  const busyLock = useRef(false),
    issueRequest = useRef(0),
    profileRef = useRef<HTMLDivElement>(null);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("tr");
  const dialogRef = useRef<HTMLElement | null>(null);
  function closeDialog() {
    if (busyLock.current) return;
    if (
      (modal || selected) &&
      (hasUnsavedFields(dialogRef.current) ||
        Boolean(
          selected &&
            [note, flow, reason, verification, question].some((value) =>
              value.trim(),
            ),
        )) &&
      !window.confirm(
        "Kaydedilmemiş değişiklikler var. Kaydetmeden kapatılsın mı?",
      )
    )
      return;
    issueRequest.current++;
    setDetailLoading(false);
    setModal(null);
    setSelected(null);
    setDeleteCandidate(null);
    setAccountOpen(false);
    setError("");
  }
  useDialog(
    modal ||
      (selected
        ? "issue"
        : deleteCandidate
          ? "delete-project"
          : accountOpen
            ? "account"
            : false),
    closeDialog,
    dialogRef,
  );
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && document.getElementById("profile-menu")) {
        setProfileOpen(false);
        profileRef.current
          ?.querySelector<HTMLButtonElement>(".profile-trigger")
          ?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const currentProject = projectMap.get(projectId);
  const applyData = useCallback(
    (data: Awaited<ReturnType<typeof readData>>) => {
      setProjects(data.projects);
      setIssues(data.issues);
      setLogs(data.worklogs);
      setCounts(data.counts);
      setNextCursor(data.nextCursor);
      setTechCounts(
        Object.fromEntries(
          data.technologyCounts.map((c) => [c.projectId, c.count]),
        ),
      );
      return data;
    },
    [],
  );
  async function refresh() {
    return applyData(await readData());
  }
  useEffect(() => {
    let active = true;
    readData()
      .then((data) => {
        if (active) applyData(data);
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
  }, [applyData]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        /INPUT|TEXTAREA|SELECT/.test(target.tagName) ||
        target.isContentEditable;
      if (document.querySelector('[role="dialog"]') || busyLock.current) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (view !== "issues") return;
        e.preventDefault();
        search.current?.focus();
      }
      if (
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key === "n" &&
        projects.length
      ) {
        e.preventDefault();
        requestKey.current = crypto.randomUUID();
        setModal("issue");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [projects.length, view]);
  useEffect(() => {
    if (modal === "project") requestKey.current = crypto.randomUUID();
  }, [modal]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const scoped = useMemo(
    () => issues.filter((i) => !projectId || i.projectId === projectId),
    [issues, projectId],
  );
  const scopedIds = useMemo(
    () => new Set(scoped.map((issue) => issue.id)),
    [scoped],
  );
  const filtered = useMemo(
    () =>
      scoped
        .filter((i) => status === "all" || i.status === status)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [scoped, status],
  );
  const statusCounts = useMemo(
    () =>
      counts
        .filter((c) => !projectId || c.projectId === projectId)
        .reduce<Record<string, number>>((totals, c) => {
          totals[c.status] = (totals[c.status] ?? 0) + c.count;
          totals.all = (totals.all ?? 0) + c.count;
          return totals;
        }, {}),
    [counts, projectId],
  );
  const completed = statusCounts.done ?? 0;
  const scopedLogs = useMemo(
    () =>
      logs
        .filter(
          (l) =>
            view === "journal" ||
            view === "learning" ||
            !projectId ||
            scopedIds.has(l.issueId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [logs, scopedIds, projectId, view],
  );
  const journalLogs = useMemo(
    () =>
      scopedLogs.filter(
        (l) =>
          view !== "learning" ||
          Object.values(l.learning).some((v) =>
            Array.isArray(v) ? v.length : Boolean(v),
          ),
      ),
    [scopedLogs, view],
  );
  const projectCounts = useMemo(
    () =>
      counts.reduce<Record<string, number>>((result, c) => {
        result[c.projectId] = (result[c.projectId] ?? 0) + c.count;
        return result;
      }, {}),
    [counts],
  );
  function navigate(v: string, p = "") {
    issueRequest.current++;
    setDetailLoading(false);
    setProfileOpen(false);
    setView(v);
    setProjectId(p);
    setQuery("");
    setStatus("all");
  }
  function newIssue() {
    if (busyLock.current) return;
    setError("");
    requestKey.current = crypto.randomUUID();
    setModal(projects.length ? "issue" : "project");
  }
  async function mutate(fn: () => Promise<unknown>) {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyLock.current = false;
      setBusy(false);
    }
  }
  function saveIssue(issue: Issue, previous?: Issue) {
    setIssues((rows) => [issue, ...rows.filter((row) => row.id !== issue.id)]);
    setCounts((rows) => {
      const next = rows.map((row) => ({ ...row }));
      if (previous) {
        const old = next.find(
          (row) =>
            row.projectId === previous.projectId &&
            row.status === previous.status,
        );
        if (old) old.count--;
      }
      const current = next.find(
        (row) =>
          row.projectId === issue.projectId && row.status === issue.status,
      );
      if (current) current.count++;
      else
        next.push({
          projectId: issue.projectId,
          status: issue.status,
          count: 1,
        });
      return next;
    });
  }
  function saveProject(project: Project) {
    setProjects((rows) => [
      project,
      ...rows.filter((row) => row.id !== project.id),
    ]);
  }
  async function moreIssues() {
    const data = await call("search_issues", {
      projectId: projectId || undefined,
      query: query || undefined,
      status: status === "all" ? undefined : status,
      limit: 100,
      cursor: nextCursor,
    });
    setIssues((rows) => [
      ...rows,
      ...data.issues.filter((i) => !rows.some((row) => row.id === i.id)),
    ]);
    setNextCursor(data.nextCursor);
  }
  async function moreLogs() {
    const data = await call("list_worklogs", {
      projectId: projectId || undefined,
      hasLearning: view === "learning" ? true : undefined,
      cursor: logCursor,
    });
    setLogs((rows) => [
      ...rows,
      ...data.worklogs.filter((l) => !rows.some((row) => row.id === l.id)),
    ]);
    setLogCursor(data.nextCursor);
  }
  async function moreNotes() {
    if (!selected?.nextWorklogCursor) return;
    const id = selected.issue.id;
    const data = await call("get_issue", {
      issueId: id,
      worklogCursor: selected.nextWorklogCursor,
    });
    setSelected((previous) =>
      previous?.issue.id === id
        ? { ...data, worklogs: [...previous.worklogs, ...data.worklogs] }
        : previous,
    );
  }
  useEffect(() => {
    if (view !== "issues") return;
    let active = true;
    call("search_issues", {
      projectId: projectId || undefined,
      query: query || undefined,
      status: status === "all" ? undefined : status,
      limit: 100,
    })
      .then((data) => {
        if (active) {
          setIssues(data.issues);
          setNextCursor(data.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, projectId, query, status]);
  useEffect(() => {
    if (view !== "journal" && view !== "learning") return;
    let active = true;
    call("list_worklogs", {
      projectId: projectId || undefined,
      hasLearning: view === "learning" ? true : undefined,
    })
      .then((data) => {
        if (active) {
          setLogs(data.worklogs);
          setLogCursor(data.nextCursor);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [view, projectId]);
  async function openIssue(id: number) {
    if (busyLock.current) return;
    const request = ++issueRequest.current;
    setDetailLoading(true);
    setSelected(null);
    setError("");
    setNote("");
    setFlow("");
    setReason("");
    setVerification("");
    setQuestion("");
    setShowLearning(false);
    noteKey.current = crypto.randomUUID();
    try {
      const result = await call("get_issue", { issueId: id });
      if (request === issueRequest.current) setSelected(result);
    } catch (e) {
      if (request === issueRequest.current) setError((e as Error).message);
    } finally {
      if (request === issueRequest.current) setDetailLoading(false);
    }
  }
  function editProject(project: Project) {
    setError("");
    setEditingProject(project);
    setModal("edit-project");
  }
  async function prepareProjectDeletion() {
    if (!editingProject || busyLock.current) return;
    if (
      hasUnsavedFields(dialogRef.current) &&
      !window.confirm("Düzenlemeleri kaydetmeden silme ekranına geçilsin mi?")
    )
      return;
    const id = editingProject.id;
    await mutate(async () => {
      const data = await refresh();
      const latest = data.projects.find((project) => project.id === id);
      if (!latest)
        throw new Error(
          "Proje artık mevcut değil. Pencereyi kapatıp listeyi kontrol et.",
        );
      setDeleteCandidate(latest);
      setDeleteName("");
      setModal(null);
    });
  }
  async function removeProject(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteCandidate) return;
    const target = deleteCandidate;
    await mutate(async () => {
      await call("delete_project", {
        projectId: target.id,
        confirmName: deleteName,
      });
      setDeleteCandidate(null);
      setSelected(null);
      navigate("issues");
      setProjects((rows) => rows.filter((p) => p.id !== target.id));
      setIssues((rows) => rows.filter((i) => i.projectId !== target.id));
      setCounts((rows) => rows.filter((c) => c.projectId !== target.id));
      setNotice("Proje ve bağlı kayıtları silindi.");
    });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(async () => {
      if (modal === "project") {
        saveProject(
          (
            await call("create_project", {
              name: f.get("name"),
              description: f.get("description"),
              requestKey: requestKey.current,
            })
          ).project,
        );
      } else if (modal === "edit-project" && editingProject) {
        saveProject(
          (
            await call("update_project", {
              projectId: editingProject.id,
              name: f.get("name"),
              description: f.get("description"),
            })
          ).project,
        );
      } else {
        saveIssue(
          (
            await call("create_issue", {
              projectId: f.get("projectId"),
              title: f.get("title"),
              description: f.get("description"),
              priority: f.get("priority"),
              status: f.get("status"),
              requestKey: requestKey.current,
            })
          ).issue,
        );
      }
      setModal(null);
      setNotice("Kaydedildi.");
    });
  }
  async function updateIssue(patch: object) {
    if (!selected) return;
    await mutate(async () => {
      const result = await call("update_issue", {
        issueId: selected.issue.id,
        expectedUpdatedAt: selected.issue.updatedAt,
        ...patch,
      });
      saveIssue(result.issue, selected.issue);
      setSelected({
        ...selected,
        issue: result.issue,
        worklogs: result.worklog
          ? [result.worklog, ...selected.worklogs]
          : selected.worklogs,
      });
      if (result.worklog) setLogs((rows) => [result.worklog!, ...rows]);
      setNotice("Bilet güncellendi.");
    });
  }
  async function removeIssue() {
    if (!selected || busyLock.current) return;
    const target = selected.issue;
    if (
      !window.confirm(
        `${target.code} — ${target.title} bileti ve bağlı çalışma notları kalıcı olarak silinsin mi?`,
      )
    )
      return;
    await mutate(async () => {
      await call("delete_issue", {
        issueId: target.id,
        confirmCode: target.code,
      });
      issueRequest.current++;
      setSelected(null);
      setIssues((rows) => rows.filter((i) => i.id !== target.id));
      setLogs((rows) => rows.filter((l) => l.issueId !== target.id));
      setCounts((rows) =>
        rows.map((c) =>
          c.projectId === target.projectId && c.status === target.status
            ? { ...c, count: c.count - 1 }
            : c,
        ),
      );
      setNotice("Bilet ve bağlı notları silindi.");
    });
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await mutate(async () => {
      const result = await call("add_worklog", {
        issueId: selected.issue.id,
        summary: note,
        learning: { flow, reason, verification, question, files: [] },
        requestKey: noteKey.current,
      });
      noteKey.current = crypto.randomUUID();
      setNote("");
      setFlow("");
      setReason("");
      setVerification("");
      setQuestion("");
      setSelected({
        ...selected,
        worklogs: [result.worklog, ...selected.worklogs],
        issue: { ...selected.issue, updatedAt: result.worklog.createdAt },
      });
      setLogs((rows) => [result.worklog, ...rows]);
      setIssues((rows) =>
        rows.map((i) =>
          i.id === selected.issue.id
            ? { ...i, updatedAt: result.worklog.createdAt }
            : i,
        ),
      );
      setNotice("Çalışma notu eklendi.");
    });
  }
  async function exportData() {
    await mutate(async () => {
      const data = await call("export_data");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `ozear-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  const title =
    view === "issues"
      ? (currentProject?.name ?? "Tüm biletler")
      : view === "journal"
        ? "Çalışma günlüğü"
        : view === "learning"
          ? "Öğrenme arşivi"
          : view === "configuration"
            ? "Projeler"
            : "Yapay zekâ bağlantısı";
  function issueRow(i: Issue) {
    return (
      <button key={i.id} className="issue-row" onClick={() => openIssue(i.id)}>
        <span className="issue-code">{i.code}</span>
        <StatusIcon status={i.status} />
        <span className="issue-title">{i.title}</span>
        <span className="project-tag">{projectMap.get(i.projectId)?.name}</span>
        <span className={`priority ${i.priority}`}>
          {i.priority === "high" ? "↑" : i.priority === "low" ? "↓" : "−"}{" "}
          <span>{priorities[i.priority as keyof typeof priorities]}</span>
        </span>
        <span className="row-date">
          {date(i.updatedAt).split(" ").slice(0, 2).join(" ")}
        </span>
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("configuration")}>
          <span className="brand-mark">
            <Layers size={20} />
          </span>
          <strong>Ozear</strong>
        </button>
        <div className="workspace-label">
          <span className="avatar">{initials}</span>
          <div>
            <strong>Kişisel çalışma alanı</strong>
            <small>Ozear çalışma alanı</small>
          </div>
        </div>
        <p className="nav-label">ÇALIŞMA ALANI</p>
        <nav>
          <button
            className={view === "issues" && !projectId ? "active" : ""}
            onClick={() => navigate("issues")}
          >
            <Layers size={17} />
            Tüm biletler
            <span className="count">
              {counts.reduce((n, c) => n + c.count, 0)}
            </span>
          </button>
          <button
            className={view === "journal" ? "active" : ""}
            onClick={() => navigate("journal")}
          >
            <Activity size={17} />
            Çalışma günlüğü
          </button>
          <button
            className={view === "learning" ? "active" : ""}
            onClick={() => navigate("learning")}
          >
            <BookOpen size={17} />
            Öğrenme arşivi
            <span className="tiny-dot" />
          </button>
        </nav>
        <nav>
          <button
            className={view === "configuration" ? "active" : ""}
            onClick={() => navigate("configuration")}
          >
            <Settings2 size={17} />
            Projeler ve konfigürasyon
          </button>
          <button className="mobile-mcp" onClick={() => navigate("mcp")}>
            <Terminal size={17} />
            Yapay zekâ bağlantısı
          </button>
        </nav>
        <div className="nav-label project-heading">
          PROJELER
          <button
            title="Proje oluştur"
            aria-label="Proje oluştur"
            onClick={() => setModal("project")}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="project-nav">
          {projects.map((p, n) => (
            <div className="project-entry" key={p.id}>
              <button
                title={p.name}
                className={`project-open ${projectId === p.id ? "active" : ""}`}
                onClick={() => navigate("issues", p.id)}
              >
                <span className={`project-dot dot-${n % 4}`} />
                <span className="truncate">{p.name}</span>
                <span className="count">{projectCounts[p.id] ?? 0}</span>
              </button>
              <button
                className="project-settings"
                aria-label={`${p.name} projesini düzenle`}
                title="Projeyi düzenle"
                onClick={() => editProject(p)}
              >
                <Settings2 size={14} />
              </button>
            </div>
          ))}
          {!projects.length && (
            <button className="add-project" onClick={() => setModal("project")}>
              <Plus size={15} />
              İlk projeni oluştur
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <nav>
            <button
              className={view === "mcp" ? "active" : ""}
              onClick={() => navigate("mcp")}
            >
              <Terminal size={17} />
              Yapay zekâ bağlantısı
              <ArrowUpRight size={14} />
            </button>
            <button onClick={exportData} disabled={busy}>
              <ArrowDownToLine size={17} />
              Verileri dışa aktar
            </button>
          </nav>
          <div className="profile" ref={profileRef}>
            <button
              className="profile-trigger"
              aria-label="Hesap menüsü"
              aria-expanded={profileOpen}
              aria-controls="profile-menu"
              aria-haspopup="true"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              <span className="avatar">{initials}</span>
              <span className="profile-name">
                {displayName}
                <small>Kişisel hesap</small>
              </span>
              {profileOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronUp size={16} />
              )}
            </button>
            {profileOpen && (
              <div className="profile-menu" id="profile-menu">
                <strong>{displayName}</strong>
                <small>{email}</small>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setAccountOpen(true);
                  }}
                >
                  <UserRound size={15} />
                  Hesap bilgileri
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setProfileOpen(false);
                    exportData();
                  }}
                >
                  <ArrowDownToLine size={15} />
                  Verileri dışa aktar
                </button>
                <form action="/logout" method="post" target="_top">
                  <button type="submit">
                    <LogOut size={15} />
                    Çıkış yap
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Çalışma alanı
            <ChevronRight size={13} />
            <span>{title}</span>
          </div>
          <select
            className="mobile-project-select"
            aria-label="Proje seç"
            value={projectId}
            onChange={(e) =>
              e.target.value === "__new"
                ? setModal("project")
                : navigate("issues", e.target.value)
            }
          >
            <option value="">Tüm projeler</option>
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
            <option value="__new">+ Yeni proje</option>
          </select>
          <span className="private-label">
            <span /> Kişisel
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {view !== "configuration" && (
            <div className="page-heading">
              <div>
                <h1>{title}</h1>
              </div>
              {view !== "configuration" && (
                <button className="primary" onClick={newIssue}>
                  <Plus size={17} />
                  {projects.length ? "Yeni bilet" : "İlk projeni oluştur"}
                  <kbd>N</kbd>
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button
                className="retry-action"
                disabled={busy}
                onClick={() => mutate(refresh)}
              >
                <RefreshCw size={14} />
                Tekrar dene
              </button>
              <button aria-label="Hatayı kapat" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === "issues" && currentProject && (
            <div className="project-controls">
              <p>
                {currentProject.description ||
                  "Bu projeye henüz açıklama eklenmedi."}
              </p>
              <button
                className="secondary"
                onClick={() => editProject(currentProject)}
              >
                <Settings2 size={14} />
                Projeyi düzenle
              </button>
              <button
                className="secondary"
                onClick={() => navigate("configuration", currentProject.id)}
              >
                Konfigürasyon
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {view === "issues" && (
            <>
              <div className="summary-strip">
                <div>
                  <span className="summary-icon">
                    <Layers size={18} />
                  </span>
                  <span>
                    <strong>{statusCounts.all ?? 0}</strong>
                    <small>Toplam bilet</small>
                  </span>
                </div>
                <div>
                  <span className="summary-icon amber">
                    <CircleDashed size={18} />
                  </span>
                  <span>
                    <strong>{statusCounts.in_progress ?? 0}</strong>
                    <small>Devam eden</small>
                  </span>
                </div>
                <div>
                  <span className="summary-icon green">
                    <CheckCircle2 size={18} />
                  </span>
                  <span>
                    <strong>{completed}</strong>
                    <small>Tamamlanan</small>
                  </span>
                </div>
                <div className="progress-summary">
                  <span>
                    <small>Tamamlanma</small>
                    <strong>
                      %
                      {statusCounts.all
                        ? Math.round((completed / statusCounts.all) * 100)
                        : 0}
                    </strong>
                  </span>
                  <div className="progress-track">
                    <span
                      style={{
                        width: `${statusCounts.all ? (completed / statusCounts.all) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="work-grid">
                <section className="ticket-section">
                  <div className="toolbar">
                    <div className="status-tabs">
                      {[
                        ["all", "Tümü"],
                        ["backlog", "Bekliyor"],
                        ["in_progress", "Yapılıyor"],
                        ["done", "Tamamlandı"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          className={status === id ? "selected" : ""}
                          onClick={() => setStatus(id)}
                        >
                          {label}
                          <span>{statusCounts[id] ?? 0}</span>
                        </button>
                      ))}
                    </div>
                    <div className="view-toggle">
                      <button
                        title="Liste görünümü"
                        aria-label="Liste görünümü"
                        aria-pressed={!board}
                        onClick={() => setBoard(false)}
                      >
                        <List size={16} />
                      </button>
                      <button
                        title="Pano görünümü"
                        aria-label="Pano görünümü"
                        aria-pressed={board}
                        onClick={() => setBoard(true)}
                      >
                        <LayoutGrid size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="search-row">
                    <Search size={15} />
                    <input
                      ref={search}
                      placeholder="Biletlerde ara…"
                      aria-label="Biletlerde ara"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <kbd>⌘ K</kbd>
                    <span className="result-count">
                      {filtered.length} bilet
                    </span>
                  </div>
                  {loading ? (
                    <div className="empty">
                      <Loader2 className="spin" />
                      <p>Çalışma alanın yükleniyor…</p>
                    </div>
                  ) : !filtered.length ? (
                    <div className="empty">
                      <div className="empty-art">
                        <Layers size={30} />
                        <span>
                          <Plus size={15} />
                        </span>
                      </div>
                      <h2>
                        {issues.length
                          ? "Burada henüz bilet yok"
                          : "Henüz bilet yok."}
                      </h2>
                      <p>
                        {query || status !== "all"
                          ? "Bu filtrelerle eşleşen bilet bulunamadı."
                          : projects.length
                            ? "Bu projeye bir bilet ekleyerek başlayabilirsin."
                            : "Bilet eklemek için önce bir proje oluştur."}
                      </p>
                      {query || status !== "all" ? (
                        <button
                          className="secondary"
                          onClick={() => {
                            setQuery("");
                            setStatus("all");
                          }}
                        >
                          Filtreleri temizle
                        </button>
                      ) : (
                        <button className="secondary" onClick={newIssue}>
                          <Plus size={15} />
                          {projects.length ? "Bilet oluştur" : "Proje oluştur"}
                        </button>
                      )}
                    </div>
                  ) : board ? (
                    <div className="board">
                      {Object.entries(states).map(([id, label]) => (
                        <div className="board-column" key={id}>
                          <h3>
                            <StatusIcon status={id} />
                            {label}
                            <span>
                              {filtered.filter((i) => i.status === id).length}
                            </span>
                          </h3>
                          {filtered
                            .filter((i) => i.status === id)
                            .map((i) => (
                              <button
                                className="board-card"
                                key={i.id}
                                onClick={() => openIssue(i.id)}
                              >
                                <small>{i.code}</small>
                                <strong>{i.title}</strong>
                                <span className="project-tag">
                                  {projectMap.get(i.projectId)?.name}
                                </span>
                              </button>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="issue-list">{filtered.map(issueRow)}</div>
                  )}
                  {nextCursor && (
                    <button
                      className="secondary"
                      onClick={() => mutate(moreIssues)}
                    >
                      Daha fazla bilet
                    </button>
                  )}
                  <div className="table-footer">
                    <span>
                      <span className="tiny-dot" /> Biletler ve notlar hesabında
                      saklanır
                    </span>
                    <span>
                      Bilet oluştur <kbd>N</kbd>
                    </span>
                  </div>
                </section>
                <aside className="context-column">
                  <div className="context-card">
                    <div className="card-label">
                      <Activity size={15} /> SON HAREKETLER
                    </div>
                    {scopedLogs.length ? (
                      scopedLogs.slice(0, 4).map((l) => (
                        <button
                          className="activity"
                          key={l.id}
                          onClick={() => openIssue(l.issueId)}
                        >
                          <span className="activity-dot" />
                          <div>
                            <p>{l.summary.slice(0, 100)}</p>
                            <small>
                              OZY-{l.issueId} · {date(l.createdAt)}
                            </small>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="quiet-state">
                        <span>Henüz hareket yok.</span>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
          {(view === "journal" || view === "learning") && (
            <JournalView
              view={view}
              logCursor={logCursor}
              journalLogs={journalLogs}
              mutate={mutate}
              moreLogs={moreLogs}
              openIssue={openIssue}
              navigate={navigate}
            />
          )}
          {view === "configuration" &&
            (loading ? (
              <div className="empty" role="status">
                <Loader2 className="spin" />
                Projeler yükleniyor…
              </div>
            ) : (
              <Configuration
                key={projectId}
                technologyCounts={techCounts}
                initialProjectId={projectId}
                onOpenTickets={(id) => navigate("issues", id)}
                projects={projects}
                onProjectsChanged={refresh}
                onCreateProject={() => setModal("project")}
              />
            ))}
          {view === "mcp" && <IntegrationView publicUrl={publicUrl} />}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {detailLoading && (
        <div className="detail-loading" role="status">
          <Loader2 className="spin" />
          Bilet yükleniyor…
        </div>
      )}
      {modal && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <span className="eyebrow">ÇALIŞMA ALANINA EKLE</span>
              <button
                aria-label="Pencereyi kapat"
                disabled={busy}
                onClick={closeDialog}
              >
                <X size={19} />
              </button>
            </header>
            <h2 id="modal-title">
              {modal === "project"
                ? "Yeni proje"
                : modal === "edit-project"
                  ? "Projeyi düzenle"
                  : "Yeni bilet"}
            </h2>
            <form onSubmit={submit}>
              <label>
                {modal !== "issue" ? "Proje adı" : "Bilet başlığı"}
                <input
                  autoFocus
                  required
                  maxLength={240}
                  name={modal !== "issue" ? "name" : "title"}
                  defaultValue={
                    modal === "edit-project" ? editingProject?.name : ""
                  }
                  placeholder={
                    modal === "project"
                      ? "Örn. Stok Uygulaması"
                      : "Ne üzerinde çalışacaksın?"
                  }
                />
              </label>
              <label>
                Açıklama
                <textarea
                  name="description"
                  defaultValue={
                    modal === "edit-project" ? editingProject?.description : ""
                  }
                  maxLength={modal !== "issue" ? 5000 : 20000}
                  rows={4}
                  placeholder="Amacı, kapsamı ve önemli notları yaz…"
                />
              </label>
              {modal === "issue" && (
                <>
                  <label>
                    Proje
                    <select
                      name="projectId"
                      defaultValue={projectId || projects[0]?.id}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Durum
                      <select name="status">
                        {Object.entries(states).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Öncelik
                      <select name="priority" defaultValue="normal">
                        {Object.entries(priorities).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                {modal === "edit-project" && editingProject && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={prepareProjectDeletion}
                  >
                    <Trash2 size={15} />
                    Projeyi sil
                  </button>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Vazgeç
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {modal === "edit-project" ? "Kaydet" : "Oluştur"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleteCandidate && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <section
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
          >
            <header>
              <span className="eyebrow">PROJEYİ KALICI SİL</span>
              <button
                disabled={busy}
                onClick={closeDialog}
                aria-label="Pencereyi kapat"
              >
                <X size={19} />
              </button>
            </header>
            <h2 id="delete-project-title">
              {deleteCandidate.name} silinsin mi?
            </h2>
            <p className="delete-explanation">
              Bu proje ile birlikte {projectCounts[deleteCandidate.id] ?? 0}{" "}
              bilet, tüm bağlı çalışma notları ve{" "}
              {techCounts[deleteCandidate.id] ?? 0} teknoloji kaydı ile bunların
              geçmişi silinecek. Bu işlem geri alınamaz.
            </p>
            <form onSubmit={removeProject}>
              <label>
                Onaylamak için proje adını yaz:{" "}
                <strong>{deleteCandidate.name}</strong>
                <input
                  autoComplete="off"
                  required
                  value={deleteName}
                  onChange={(e) => setDeleteName(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Vazgeç
                </button>
                <button
                  className="danger"
                  disabled={busy || deleteName !== deleteCandidate.name}
                >
                  {busy ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  Kalıcı olarak sil
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {accountOpen && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <section
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
          >
            <header>
              <span className="eyebrow">KİŞİSEL HESAP</span>
              <button onClick={closeDialog} aria-label="Pencereyi kapat">
                <X size={19} />
              </button>
            </header>
            <h2 id="account-title">Hesap bilgileri</h2>
            <dl className="account-details">
              <dt>Ad</dt>
              <dd>{displayName}</dd>
              <dt>E-posta</dt>
              <dd>{email}</dd>
              <dt>Çalışma alanı</dt>
              <dd>Kişisel çalışma alanı</dd>
            </dl>
            <div className="modal-actions">
              <button className="secondary" onClick={closeDialog}>
                Kapat
              </button>
            </div>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="overlay detail-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            className="detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="detail-header">
              <span>
                {selected.issue.code}
                <ChevronRight size={14} />
                {projectMap.get(selected.issue.projectId)?.name}
              </span>
              <button
                aria-label="Bileti kapat"
                disabled={busy}
                onClick={closeDialog}
              >
                <X size={20} />
              </button>
            </header>
            <div className="detail-content">
              <div className="detail-meta">
                <button
                  className="danger delete-issue"
                  title="Bileti sil"
                  disabled={busy}
                  onClick={removeIssue}
                >
                  <Trash2 size={14} />
                  Bileti sil
                </button>
                <label>
                  <StatusIcon status={selected.issue.status} />
                  <select
                    aria-label="Bilet durumu"
                    disabled={busy}
                    value={selected.issue.status}
                    onChange={(e) => updateIssue({ status: e.target.value })}
                  >
                    {Object.entries(states).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <select
                    aria-label="Bilet önceliği"
                    disabled={busy}
                    value={selected.issue.priority}
                    onChange={(e) => updateIssue({ priority: e.target.value })}
                  >
                    {Object.entries(priorities).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label} öncelik
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <h2 id="detail-title">{selected.issue.title}</h2>
              <p className="description">
                {selected.issue.description ||
                  "Bu bilete henüz açıklama eklenmemiş."}
              </p>
              <details className="edit-details">
                <summary>Bilet içeriğini düzenle</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    updateIssue({
                      title: data.get("title"),
                      description: data.get("description"),
                    });
                  }}
                >
                  <label>
                    Başlık
                    <input
                      required
                      maxLength={240}
                      name="title"
                      defaultValue={selected.issue.title}
                    />
                  </label>
                  <label>
                    Açıklama
                    <textarea
                      rows={4}
                      maxLength={20000}
                      name="description"
                      defaultValue={selected.issue.description}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    Değişiklikleri kaydet
                  </button>
                </form>
              </details>
              <div className="section-title">
                <span>ÇALIŞMA GÜNLÜĞÜ</span>
                <span>{selected.worklogs.length} kayıt</span>
              </div>
              {selected.worklogs.map((l) => (
                <article className="detail-log" key={l.id}>
                  <div className="journal-date">
                    <span className="tiny-dot" />
                    {date(l.createdAt)}
                    <span className="source-tag">
                      {l.source.startsWith("mcp") ? "Yapay zekâ" : "Web"}
                    </span>
                  </div>
                  <p className="log-summary">{l.summary}</p>
                  {learningBlock(l.learning)}
                </article>
              ))}
              {selected.nextWorklogCursor && (
                <button className="secondary" onClick={() => mutate(moreNotes)}>
                  Daha eski notlar
                </button>
              )}
              {!selected.worklogs.length && (
                <p className="muted first-note">
                  Bugün ne yaptın? İlk notunu ekleyerek başla.
                </p>
              )}
              <form onSubmit={addNote} className="note-form">
                <label>
                  Çalışma notu
                  <textarea
                    required
                    maxLength={12000}
                    rows={4}
                    placeholder="Ne yaptın, neyi çözdün, nerede kaldın?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="learning-toggle"
                  onClick={() => setShowLearning(!showLearning)}
                >
                  <BookOpen size={15} />
                  Öğrenme notu ekle
                  <ChevronDown size={14} />
                </button>
                {showLearning && (
                  <div className="learning-form">
                    {[
                      ["Kodun akışı", flow, setFlow],
                      ["Karar ve gerekçe", reason, setReason],
                      ["Doğrulama / test", verification, setVerification],
                      ["Düşünme sorusu", question, setQuestion],
                    ].map(([label, value, setter]) => (
                      <label key={label as string}>
                        {label as string}
                        <textarea
                          rows={2}
                          maxLength={
                            label === "Düşünme sorusu"
                              ? 1000
                              : label === "Doğrulama / test"
                                ? 3000
                                : 5000
                          }
                          value={value as string}
                          onChange={(e) =>
                            (setter as (v: string) => void)(e.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="note-footer">
                  <small>Notlar bu biletin geçmişinde saklanır.</small>
                  <button className="primary" disabled={busy}>
                    {busy ? (
                      <Loader2 size={15} className="spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    Notu ekle
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
