// Component interaction tests with a small hook harness; not a browser/layout test.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTs } from "./helpers.mjs";
const packageInfo = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url)),
);
const template = loadTs("../lib/ozear-configuration.ts", {
  "../package.json": { default: packageInfo },
});
const projects = [
  { id: "ozear", name: "Ozear", description: "Kişisel işler" },
  { id: "empty", name: "Boş proje", description: "" },
];
function harness({ initialProjectId = "", failLoad = false } = {}) {
  const slots = [],
    effects = [],
    calls = [];
  let cursor = 0,
    tree,
    created = 0;
  const items = [
    {
      id: "react",
      projectId: "ozear",
      name: "React",
      category: "frontend",
      version: "19",
      state: "active",
      purpose: "Ekranlar",
      notes: "",
      url: "",
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const hooks = {
    useState(value) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof value === "function" ? value() : value;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === "function" ? value(slots[i]) : value;
        },
      ];
    },
    useRef(value) {
      const i = cursor++;
      return slots[i] ?? (slots[i] = { current: value });
    },
    useMemo(fn) {
      cursor++;
      return fn();
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || !deps || deps.some((v, n) => v !== previous.deps?.[n])) {
        slots[i] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const call = async (action, args = {}) => {
    calls.push({ action, args });
    if (action === "list_configuration") {
      if (failLoad) {
        failLoad = false;
        throw new Error("Bağlantı kesildi");
      }
      return {
        items: args.projectId
          ? items.filter((item) => item.projectId === args.projectId)
          : [...items],
      };
    }
    if (action === "create_configuration") {
      const item = {
        ...args,
        id: crypto.randomUUID(),
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.push(item);
      return { item, duplicate: false };
    }
    throw new Error(`Unexpected ${action}`);
  };
  const Component = loadTs("../app/configuration.tsx", {
    react: hooks,
    "../hooks/use-dialog": {
      useDialog() {},
      hasUnsavedFields() {
        return false;
      },
    },
    "../lib/client-api": { call },
    "../lib/ozear-configuration": template,
  }).default;
  function render() {
    cursor = 0;
    tree = Component({
      projects,
      initialProjectId,
      onCreateProject() {
        created++;
      },
      async onProjectsChanged() {},
      onOpenTickets() {},
    });
    return tree;
  }
  function nodes(node) {
    if (node == null || typeof node === "boolean") return [];
    if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
    if (typeof node !== "object") return [];
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (node == null || typeof node === "boolean") return "";
    if (Array.isArray(node)) return node.map(text).join("");
    if (typeof node !== "object") return String(node);
    return text(node.props?.children);
  }
  async function settle() {
    for (const effect of effects.splice(0)) effect();
    await new Promise((resolve) => setImmediate(resolve));
    render();
    if (effects.length) await settle();
  }
  async function click(label) {
    const button = nodes(tree).find(
      (node) => node.type === "button" && text(node).includes(label),
    );
    assert.ok(button, `Button: ${label}`);
    assert.ok(!button.props.disabled);
    await button.props.onClick();
    await settle();
  }
  render();
  return {
    render,
    settle,
    click,
    nodes: () => nodes(tree),
    text: () => text(tree),
    calls,
    get created() {
      return created;
    },
  };
}
test("directory shows empty projects and no unattached technology creation", async () => {
  const ui = harness();
  await ui.settle();
  assert.match(ui.text(), /Boş proje/);
  assert.match(ui.text(), /Konfigürasyon eklenmemiş/);
  assert.doesNotMatch(ui.text(), /Bu projeye teknoloji ekle|Ozear’ın kaynak/);
  await ui.click("Yeni proje");
  assert.equal(ui.created, 1);
});
test("opening a project shows only its technology records", async () => {
  const ui = harness();
  await ui.settle();
  await ui.click("Boş proje");
  assert.doesNotMatch(ui.text(), /React|Ozear’ın kaynak/);
  assert.match(ui.text(), /Bu projeye teknoloji ekle/);
  await ui.click("Tüm projeler");
  await ui.click("Ozear");
  assert.match(ui.text(), /React/);
});
test("technology creation is locked to the opened project without a project picker", async () => {
  const ui = harness({ initialProjectId: "empty" });
  await ui.settle();
  await ui.click("Bu projeye teknoloji ekle");
  assert.match(ui.text(), /Proje: Boş proje/);
  assert.equal(
    ui
      .nodes()
      .filter(
        (node) => node.type === "select" && node.props.name === "projectId",
      ).length,
    0,
  );
  assert.ok(ui.nodes().some((node) => node.props?.role === "dialog"));
});
test("Ozear example only adds to selected project, skips existing technologies, and retries without duplication", async () => {
  const ui = harness({ initialProjectId: "ozear" });
  await ui.settle();
  await ui.click("Bu projenin eksik konfigürasyonlarını ekle");
  const writes = ui.calls.filter(
    (call) => call.action === "create_configuration",
  );
  assert.equal(writes.length, 9);
  assert.ok(writes.every((call) => call.args.projectId === "ozear"));
  assert.ok(!ui.calls.some((call) => call.action === "create_project"));
  await ui.click("Bu projenin eksik konfigürasyonlarını ekle");
  assert.equal(
    ui.calls.filter((call) => call.action === "create_configuration").length,
    9,
  );
});
test("failed inventory load can be retried without recreating any records", async () => {
  const ui = harness({ initialProjectId: "ozear", failLoad: true });
  await ui.settle();
  assert.match(ui.text(), /Bağlantı kesildi/);
  await ui.click("Tekrar dene");
  assert.doesNotMatch(ui.text(), /Bağlantı kesildi/);
  assert.match(ui.text(), /React/);
  assert.equal(
    ui.calls.filter((call) => call.action.startsWith("create")).length,
    0,
  );
});
test("a missing project returns to the directory without an orphan create action", async () => {
  const ui = harness({ initialProjectId: "removed-project" });
  await ui.settle();
  assert.match(ui.text(), /Projeler/);
  assert.doesNotMatch(ui.text(), /Bu projeye teknoloji ekle/);
});
test("D opening inventory requests only selected project", async () => {
  const ui = harness({ initialProjectId: "ozear" });
  await ui.settle();
  assert.ok(
    ui.calls
      .filter((c) => c.action === "list_configuration")
      .every((c) => c.args.projectId === "ozear"),
  );
});
