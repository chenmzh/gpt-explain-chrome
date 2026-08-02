import { listArchiveEdges, listArchiveRecords } from "./archive-db.js";
import { filterArchiveRecords, layoutArchiveGraph, makeArchiveRecord } from "./archive-model.js";

const params = new URLSearchParams(location.search);
const isPreview = params.has("preview");
const SVG_NS = "http://www.w3.org/2000/svg";

const elements = {
  stats: document.querySelector("#libraryStats"),
  search: document.querySelector("#searchInput"),
  resultCount: document.querySelector("#resultCount"),
  recordList: document.querySelector("#recordList"),
  emptyLibrary: document.querySelector("#emptyLibrary"),
  detailViewButton: document.querySelector("#detailViewButton"),
  graphViewButton: document.querySelector("#graphViewButton"),
  viewHint: document.querySelector("#viewHint"),
  detailView: document.querySelector("#detailView"),
  graphView: document.querySelector("#graphView"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  detailDate: document.querySelector("#detailDate"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSource: document.querySelector("#detailSource"),
  detailUrl: document.querySelector("#detailUrl"),
  relationDetail: document.querySelector("#relationDetail"),
  relationList: document.querySelector("#relationList"),
  detailMessages: document.querySelector("#detailMessages"),
  reopen: document.querySelector("#reopenButton"),
  delete: document.querySelector("#deleteButton"),
  export: document.querySelector("#exportButton"),
  graph: document.querySelector("#graphCanvas"),
  toast: document.querySelector("#toast")
};

let records = [];
let edges = [];
let visibleRecords = [];
let selectedId = "";
let toastTimer = null;

function formatDate(timestamp) {
  if (!timestamp) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(new Date(timestamp));
}

function shortDate(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function recordById(recordId) {
  return records.find((record) => record.id === recordId) || null;
}

function safeWebUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function relationData(recordId) {
  const incoming = edges.filter((edge) => edge.toRecordId === recordId);
  const outgoing = edges.filter((edge) => edge.fromRecordId === recordId);
  return {
    parents: incoming.map((edge) => ({ edge, record: recordById(edge.fromRecordId) })).filter((item) => item.record),
    children: outgoing.map((edge) => ({ edge, record: recordById(edge.toRecordId) })).filter((item) => item.record)
  };
}

function renderRecordList() {
  visibleRecords = filterArchiveRecords(records, elements.search.value);
  elements.resultCount.textContent = `${visibleRecords.length} 条`;
  elements.emptyLibrary.hidden = records.length > 0;
  elements.recordList.replaceChildren();
  for (const record of visibleRecords) {
    const relations = relationData(record.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `record-card${record.id === selectedId ? " active" : ""}`;
    button.dataset.recordId = record.id;
    const title = document.createElement("strong");
    title.textContent = record.title;
    const meta = document.createElement("div");
    meta.className = "record-meta";
    const source = document.createElement("span");
    source.textContent = record.sourceDomain || "本地解释";
    const date = document.createElement("span");
    date.textContent = shortDate(record.updatedAt);
    meta.append(source, date);
    if (relations.parents.length) {
      const branch = document.createElement("span");
      branch.className = "branch-mark";
      branch.textContent = "↳ 分支";
      meta.prepend(branch);
    }
    button.append(title, meta);
    elements.recordList.append(button);
  }
}

function addRelationButton(kind, relation) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "relation-link";
  button.dataset.selectId = relation.record.id;
  button.title = relation.edge.anchor?.quote || relation.record.title;
  const direction = document.createElement("em");
  direction.textContent = kind;
  const label = document.createElement("span");
  label.textContent = relation.record.title;
  button.append(direction, label);
  elements.relationList.append(button);
}

function renderDetail() {
  const record = recordById(selectedId);
  elements.detailEmpty.hidden = Boolean(record);
  elements.detailContent.hidden = !record;
  if (!record) return;

  elements.detailDate.textContent = `${formatDate(record.createdAt)} · ${record.options?.model || "Codex"} / ${record.options?.reasoning || "默认"}`;
  elements.detailTitle.textContent = record.title;
  elements.detailSource.textContent = record.source?.text || "";
  const sourceUrl = safeWebUrl(record.source?.url);
  elements.detailUrl.textContent = sourceUrl || record.source?.title || "";
  elements.detailUrl.href = sourceUrl || "#";
  elements.detailUrl.hidden = !sourceUrl;

  const relations = relationData(record.id);
  elements.relationList.replaceChildren();
  for (const relation of relations.parents) addRelationButton("上游 ↖", relation);
  for (const relation of relations.children) addRelationButton("下游 ↘", relation);
  elements.relationDetail.hidden = !relations.parents.length && !relations.children.length;

  elements.detailMessages.replaceChildren();
  let assistantNumber = 0;
  for (const message of record.messages || []) {
    if (!message.text) continue;
    const card = document.createElement("article");
    card.className = `detail-message ${message.role}`;
    const heading = document.createElement("h3");
    if (message.role === "assistant") assistantNumber += 1;
    heading.textContent = message.role === "user" ? "追问" : (assistantNumber === 1 ? "解释" : `回答 ${assistantNumber}`);
    const text = document.createElement("p");
    text.textContent = message.text;
    card.append(heading, text);
    elements.detailMessages.append(card);
  }
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function renderGraph() {
  const visibleIds = new Set(visibleRecords.map((record) => record.id));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.fromRecordId) && visibleIds.has(edge.toRecordId));
  const layout = layoutArchiveGraph(visibleRecords, visibleEdges);
  const nodesById = new Map(layout.nodes.map((node) => [node.id, node]));
  elements.graph.replaceChildren();
  elements.graph.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  elements.graph.setAttribute("width", layout.width);
  elements.graph.setAttribute("height", layout.height);

  const defs = svgElement("defs");
  const marker = svgElement("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" });
  marker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "rgba(29,33,31,.45)" }));
  defs.append(marker);
  elements.graph.append(defs);

  for (const edge of layout.edges) {
    const from = nodesById.get(edge.fromRecordId);
    const to = nodesById.get(edge.toRecordId);
    if (!from || !to) continue;
    const startX = from.x + 176;
    const startY = from.y + 38;
    const endX = to.x;
    const endY = to.y + 38;
    const midX = (startX + endX) / 2;
    const pathData = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    const path = svgElement("path", { class: "graph-edge", d: pathData });
    const title = svgElement("title");
    title.textContent = edge.anchor?.quote || "划词解释关系";
    path.append(title);
    elements.graph.append(path);
  }

  for (const node of layout.nodes) {
    const isBranch = layout.edges.some((edge) => edge.toRecordId === node.id);
    const group = svgElement("g", {
      class: `graph-node${isBranch ? " branch" : ""}${node.id === selectedId ? " active" : ""}`,
      transform: `translate(${node.x} ${node.y})`,
      "data-record-id": node.id,
      tabindex: 0,
      role: "button",
      "aria-label": node.record.title
    });
    group.append(svgElement("rect", { width: 176, height: 76, rx: 3 }));
    const title = svgElement("text", { x: 13, y: 24 });
    const compact = node.record.title.length > 38 ? `${node.record.title.slice(0, 37)}…` : node.record.title;
    const firstLine = compact.slice(0, 20);
    const secondLine = compact.slice(20);
    const lineOne = svgElement("tspan", { x: 13, dy: 0 });
    lineOne.textContent = firstLine;
    title.append(lineOne);
    if (secondLine) {
      const lineTwo = svgElement("tspan", { x: 13, dy: 17 });
      lineTwo.textContent = secondLine;
      title.append(lineTwo);
    }
    const meta = svgElement("text", { class: "node-meta", x: 13, y: 64 });
    meta.textContent = `${node.record.sourceDomain || "本地"} · ${shortDate(node.record.updatedAt)}`;
    group.append(title, meta);
    elements.graph.append(group);
  }
}

function selectRecord(recordId) {
  selectedId = recordById(recordId)?.id || "";
  renderRecordList();
  renderDetail();
  renderGraph();
}

function setView(view) {
  const graph = view === "graph";
  elements.detailView.hidden = graph;
  elements.graphView.hidden = !graph;
  elements.detailViewButton.classList.toggle("active", !graph);
  elements.graphViewButton.classList.toggle("active", graph);
  elements.viewHint.textContent = graph
    ? "节点代表解释窗口；箭头指向由划词产生的分支。"
    : "查看选中文字、完整对话和上下游关系。";
  if (graph) renderGraph();
}

async function loadLibrary() {
  const previousSelection = selectedId;
  if (isPreview) {
    const now = Date.now();
    records = [
      makeArchiveRecord({ resultId: "a", source: { text: "真正的理解，是能够把知识迁移到一个陌生的问题里。", title: "学习与理解", url: "https://example.com/learning" }, messages: [{ id: "a1", role: "assistant", text: "理解不只是记忆，而是把概念迁移到新的场景。" }], options: { model: "gpt-5.6-luna", reasoning: "xhigh" }, status: "done", createdAt: now - 86_400_000, updatedAt: now - 82_000_000 }),
      makeArchiveRecord({ resultId: "b", parentResultId: "a", source: { text: "把概念迁移到新的场景", title: "解释分支", url: "https://example.com/learning" }, messages: [{ id: "b1", role: "assistant", text: "迁移意味着在陌生条件下重新组织已有知识。" }], options: { model: "gpt-5.6-luna", reasoning: "max" }, status: "done", createdAt: now - 43_000_000, updatedAt: now - 42_000_000 }),
      makeArchiveRecord({ resultId: "c", parentResultId: "a", source: { text: "理解不只是记忆", title: "解释分支", url: "https://example.com/learning" }, messages: [{ id: "c1", role: "assistant", text: "记忆保存答案，理解保存产生答案的结构。" }], options: { model: "gpt-5.6-luna", reasoning: "xhigh" }, status: "done", createdAt: now - 21_000_000, updatedAt: now - 20_000_000 })
    ];
    edges = [
      { id: "a::b", fromRecordId: "a", toRecordId: "b", anchor: { quote: "把概念迁移到新的场景" } },
      { id: "a::c", fromRecordId: "a", toRecordId: "c", anchor: { quote: "理解不只是记忆" } }
    ];
  } else {
    [records, edges] = await Promise.all([listArchiveRecords(), listArchiveEdges()]);
  }
  elements.stats.textContent = `${records.length} 条记录 · ${edges.length} 条连接`;
  selectedId = records.some((record) => record.id === previousSelection)
    ? previousSelection
    : (records[0]?.id || "");
  renderRecordList();
  renderDetail();
  renderGraph();
}

elements.search.addEventListener("input", () => {
  visibleRecords = filterArchiveRecords(records, elements.search.value);
  if (selectedId && !visibleRecords.some((record) => record.id === selectedId)) selectedId = visibleRecords[0]?.id || "";
  renderRecordList();
  renderDetail();
  renderGraph();
});
elements.recordList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-record-id]");
  if (button) selectRecord(button.dataset.recordId);
});
elements.relationList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-select-id]");
  if (button) selectRecord(button.dataset.selectId);
});
elements.graph.addEventListener("click", (event) => {
  const node = event.target.closest("[data-record-id]");
  if (node) selectRecord(node.dataset.recordId);
});
elements.graph.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const node = event.target.closest("[data-record-id]");
  if (!node) return;
  event.preventDefault();
  selectRecord(node.dataset.recordId);
});
elements.detailViewButton.addEventListener("click", () => setView("detail"));
elements.graphViewButton.addEventListener("click", () => setView("graph"));
elements.reopen.addEventListener("click", async () => {
  if (!selectedId || isPreview) return;
  const response = await chrome.runtime.sendMessage({ type: "openRecord", recordId: selectedId });
  if (!response?.ok) showToast(response?.error || "无法打开记录");
});
elements.delete.addEventListener("click", async () => {
  const record = recordById(selectedId);
  if (!record || isPreview || !confirm(`删除“${record.title}”？相关连接也会一并删除。`)) return;
  const response = await chrome.runtime.sendMessage({ type: "deleteRecord", recordId: record.id });
  if (!response?.ok) return showToast(response?.error || "无法删除记录");
  await loadLibrary();
  showToast("记录已删除");
});
elements.export.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records, edges }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gpt-explain-library-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 500);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.search.focus();
  }
});
if (!isPreview) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "archiveUpdated") loadLibrary().catch(console.error);
  });
}

loadLibrary().catch((error) => {
  elements.emptyLibrary.hidden = false;
  elements.emptyLibrary.querySelector("strong").textContent = "无法打开本地资料库";
  elements.emptyLibrary.querySelector("p").textContent = error.message;
});
