import { languageLabel, providerModelLabel, reasoningLabel } from "./default-settings.js";
import { locateSelectionAnchor } from "./archive-model.js";
import { splitAmbiguousStrongText } from "./markdown-normalize.js";

const params = new URLSearchParams(location.search);
const isPreview = params.has("preview");
const resultId = params.get("resultId") || (isPreview ? "preview" : "");

const elements = {
  empty: document.querySelector("#emptyState"),
  result: document.querySelector("#resultView"),
  dock: document.querySelector("#conversationDock"),
  model: document.querySelector("#modelBadge"),
  reasoning: document.querySelector("#reasoningBadge"),
  language: document.querySelector("#languageSelect"),
  branch: document.querySelector("#branchBadge"),
  status: document.querySelector("#statusBadge"),
  source: document.querySelector("#sourceText"),
  sourceCount: document.querySelector("#sourceCount"),
  sourceMeta: document.querySelector("#sourceMeta"),
  sourceLink: document.querySelector("#sourceLink"),
  truncated: document.querySelector("#truncatedNotice"),
  parentRelation: document.querySelector("#parentRelation"),
  parentQuote: document.querySelector("#parentQuote"),
  parentButton: document.querySelector("#parentButton"),
  childrenRelation: document.querySelector("#childrenRelation"),
  childrenCount: document.querySelector("#childrenCount"),
  childrenList: document.querySelector("#childrenList"),
  messages: document.querySelector("#conversationMessages"),
  copy: document.querySelector("#copyButton"),
  retry: document.querySelector("#retryButton"),
  stop: document.querySelector("#stopButton"),
  library: document.querySelector("#libraryButton"),
  settings: document.querySelector("#settingsButton"),
  check: document.querySelector("#checkButton"),
  health: document.querySelector("#healthText"),
  followupForm: document.querySelector("#followupForm"),
  followupInput: document.querySelector("#followupInput"),
  send: document.querySelector("#sendButton"),
  toast: document.querySelector("#toast")
};

const rendered = new WeakMap();
const renderTimers = new WeakMap();
let latestState = null;
let latestRelations = { parent: null, children: [] };
let pendingFocusAnchor = null;
let toastTimer = null;

function hostName(url) {
  try { return new URL(url).hostname; } catch { return url || ""; }
}

function safeWebUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

function relationTitle(record) {
  return record?.title || record?.source?.text || "未命名解释";
}

function renderRelations(relations = latestRelations) {
  latestRelations = relations || { parent: null, children: [] };
  const parent = latestRelations.parent;
  elements.parentRelation.hidden = !parent?.record;
  if (parent?.record) {
    elements.parentQuote.textContent = parent.edge?.anchor?.quote || relationTitle(parent.record);
    elements.parentButton.title = `打开：${relationTitle(parent.record)}`;
  }

  const children = latestRelations.children || [];
  elements.childrenRelation.hidden = !children.length;
  elements.childrenCount.textContent = children.length ? `${children.length} 个分支` : "";
  elements.childrenList.replaceChildren();
  for (const relation of children) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "child-link";
    button.dataset.recordId = relation.record.id;
    const label = document.createElement("span");
    label.textContent = relationTitle(relation.record);
    button.title = relation.edge?.anchor?.quote || label.textContent;
    button.append(label);
    elements.childrenList.append(button);
  }
}

function selectionContainer(node) {
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const message = element?.closest?.(".message-card");
  if (message) return {
    container: message.querySelector(".rich-text"),
    messageId: message.dataset.messageId
  };
  if (element?.closest?.(".source-card")) return {
    container: elements.source,
    messageId: "source"
  };
  return null;
}

function textOffset(container, node, offset) {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function captureSelectionAnchor() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const start = selectionContainer(range.startContainer);
  const end = selectionContainer(range.endContainer);
  if (!start?.container || start.container !== end?.container) return null;
  const fullText = start.container.textContent || "";
  const startOffset = textOffset(start.container, range.startContainer, range.startOffset);
  const endOffset = textOffset(start.container, range.endContainer, range.endOffset);
  const quote = selection.toString().trim();
  if (!quote) return null;
  return {
    messageId: start.messageId,
    startOffset,
    endOffset,
    quote,
    prefix: fullText.slice(Math.max(0, startOffset - 120), startOffset),
    suffix: fullText.slice(endOffset, endOffset + 120)
  };
}

function rangeForOffsets(container, startOffset, endOffset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let position = 0;
  let startNode = null;
  let startInNode = 0;
  let endNode = null;
  let endInNode = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const next = position + (node.nodeValue?.length || 0);
    if (!startNode && startOffset >= position && startOffset <= next) {
      startNode = node;
      startInNode = startOffset - position;
    }
    if (endOffset >= position && endOffset <= next) {
      endNode = node;
      endInNode = endOffset - position;
      break;
    }
    position = next;
  }
  if (!startNode || !endNode) return null;
  range.setStart(startNode, startInNode);
  range.setEnd(endNode, endInNode);
  return range;
}

function focusSelectionAnchor(anchor) {
  if (!anchor?.messageId) return;
  let target = anchor.messageId === "source"
    ? elements.source
    : elements.messages.querySelector(`[data-message-id="${CSS.escape(anchor.messageId)}"] .rich-text`);
  if (!target && anchor.quote) {
    target = [elements.source, ...elements.messages.querySelectorAll(".rich-text")]
      .find((candidate) => locateSelectionAnchor(candidate.textContent || "", anchor));
  }
  if (!target) {
    pendingFocusAnchor = anchor;
    return;
  }
  const text = target.textContent || "";
  const location = locateSelectionAnchor(text, anchor);
  const range = location
    ? rangeForOffsets(target, location.startOffset, location.endOffset)
    : null;
  if (range && globalThis.CSS?.highlights && globalThis.Highlight) {
    CSS.highlights.set("origin-anchor", new Highlight(range));
  }
  const card = target.closest(".message-card, .source-card") || target;
  card.classList.remove("anchor-target");
  requestAnimationFrame(() => {
    card.classList.add("anchor-target");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  pendingFocusAnchor = null;
}

function protectMath(markdown) {
  const segments = [];
  const text = markdown.replace(
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?:\\.|[^$\n])+?\$)/g,
    (value) => {
      const token = `LEXIMATHPLACEHOLDER${segments.length}ZZ`;
      segments.push(value);
      return token;
    }
  );
  return { text, segments };
}

function restoreMath(container, segments) {
  if (!segments.length) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const tokenPattern = /LEXIMATHPLACEHOLDER(\d+)ZZ/g;
  for (const node of nodes) {
    if (!node.nodeValue?.includes("LEXIMATHPLACEHOLDER")) continue;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of node.nodeValue.matchAll(tokenPattern)) {
      fragment.append(node.nodeValue.slice(offset, match.index));
      fragment.append(segments[Number(match[1])] || match[0]);
      offset = match.index + match[0].length;
    }
    fragment.append(node.nodeValue.slice(offset));
    node.replaceWith(fragment);
  }
}

function repairAmbiguousStrong(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const repairs = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest("code, pre")) continue;
    const parts = splitAmbiguousStrongText(node.nodeValue);
    if (parts) repairs.push({ node, parts });
  }

  for (const { node, parts } of repairs) {
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (Object.hasOwn(part, "strong")) {
        const strong = document.createElement("strong");
        strong.textContent = part.strong;
        fragment.append(strong);
      } else {
        fragment.append(part.text);
      }
    }
    node.replaceWith(fragment);
  }
}

function messageText(messageId) {
  return latestState?.messages?.find((message) => message.id === messageId)?.text || "";
}

function applyRichRendering(container, text, messageId) {
  if (messageText(messageId) !== text) return;
  const markedApi = globalThis.marked?.parse ? globalThis.marked : globalThis.marked?.marked;
  if (!markedApi?.parse || !globalThis.DOMPurify) {
    container.textContent = text;
    return;
  }

  const protectedMath = protectMath(text);
  const parsed = markedApi.parse(protectedMath.text, { gfm: true, breaks: true, async: false });
  container.innerHTML = globalThis.DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "a", "hr",
      "table", "thead", "tbody", "tr", "th", "td", "span"
    ],
    ALLOWED_ATTR: ["href", "title", "class"]
  });
  repairAmbiguousStrong(container);
  restoreMath(container, protectedMath.segments);
  for (const link of container.querySelectorAll("a")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  if (typeof globalThis.renderMathInElement === "function") {
    globalThis.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false }
      ],
      throwOnError: false,
      strict: "ignore",
      trust: false,
      output: "htmlAndMathml"
    });
  }
  rendered.set(container, { text, formatted: true });
}

function renderRichText(container, text, messageId, immediately = false) {
  const value = text || "";
  const previous = rendered.get(container);
  const previousTimer = renderTimers.get(container);
  if (previousTimer) clearTimeout(previousTimer);

  if (previous?.text !== value) {
    container.textContent = value;
    rendered.set(container, { text: value, formatted: false });
  }
  if (!value) return;
  if (previous?.text === value && previous.formatted) return;
  if (immediately) {
    applyRichRendering(container, value, messageId);
    return;
  }
  const timer = setTimeout(() => {
    applyRichRendering(container, value, messageId);
    renderTimers.delete(container);
  }, 120);
  renderTimers.set(container, timer);
}

function createMessageCard(message) {
  const card = document.createElement("article");
  card.className = `message-card ${message.role}`;
  card.dataset.messageId = message.id;

  const heading = document.createElement("div");
  heading.className = "message-heading";
  const number = document.createElement("span");
  number.className = "rule-number";
  const title = document.createElement("h2");
  heading.append(number, title);

  const thinking = document.createElement("div");
  thinking.className = "thinking";
  thinking.innerHTML = "<span></span><span></span><span></span><em>正在思考…</em>";

  const content = document.createElement("div");
  content.className = "rich-text";

  const error = document.createElement("div");
  error.className = "error-box";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const errorTitle = document.createElement("strong");
  errorTitle.textContent = "没有得到答案";
  const errorText = document.createElement("p");
  error.append(errorTitle, errorText);

  card.append(heading, thinking, content, error);
  return card;
}

function renderMessages(state) {
  const messages = state.messages || [];
  const validIds = new Set(messages.map((message) => message.id));
  for (const card of [...elements.messages.children]) {
    if (!validIds.has(card.dataset.messageId)) card.remove();
  }

  let assistantNumber = 0;
  let messageIndex = 0;
  for (const message of messages) {
    let card = elements.messages.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
    if (!card) card = createMessageCard(message);
    card.className = `message-card ${message.role}`;
    const isAssistant = message.role === "assistant";
    if (isAssistant) assistantNumber += 1;
    card.querySelector(".rule-number").textContent = isAssistant
      ? String(assistantNumber).padStart(2, "0")
      : "↳";
    card.querySelector("h2").textContent = isAssistant
      ? (assistantNumber === 1 ? "解释" : "回答")
      : "追问";

    const running = isAssistant && state.status === "running" && message.id === state.currentMessageId;
    const thinking = card.querySelector(".thinking");
    thinking.hidden = !running;
    thinking.querySelector("em").textContent = state.statusText || "正在思考…";
    const error = card.querySelector(".error-box");
    error.hidden = !message.error;
    error.querySelector("p").textContent = message.error || "";
    renderRichText(card.querySelector(".rich-text"), message.text, message.id, !running);
    const cardAtIndex = elements.messages.children[messageIndex];
    if (cardAtIndex !== card) elements.messages.insertBefore(card, cardAtIndex || null);
    messageIndex += 1;
  }
}

function render(state, relations = latestRelations) {
  latestState = state;
  const hasState = Boolean(state?.source?.text);
  elements.empty.hidden = hasState;
  elements.result.hidden = !hasState;
  elements.dock.hidden = !hasState;
  if (!hasState) return;

  const wasNearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 120;
  const running = state.status === "running";
  elements.model.textContent = providerModelLabel(state.options);
  elements.reasoning.textContent = reasoningLabel(state.options?.reasoning);
  elements.language.value = state.options?.language || "en";
  elements.branch.hidden = !state.parentResultId;
  elements.status.className = `status-badge ${state.status || ""}`;
  elements.status.querySelector("span").textContent = state.statusText || state.status;
  elements.source.textContent = state.source.text;
  elements.sourceCount.textContent = `${state.source.text.length.toLocaleString()} 字符`;
  elements.sourceMeta.textContent = [state.source.title, hostName(state.source.url)].filter(Boolean).join(" · ");
  const sourceUrl = safeWebUrl(state.source.url);
  elements.sourceLink.href = sourceUrl || "#";
  elements.sourceLink.hidden = !sourceUrl;
  elements.truncated.hidden = !state.source.truncated;
  renderMessages(state);
  renderRelations(relations);
  elements.copy.disabled = !(state.messages || []).some((message) => message.text);
  elements.retry.disabled = running;
  elements.stop.hidden = !running;
  elements.followupInput.disabled = running;
  elements.send.disabled = running || !elements.followupInput.value.trim();
  if (pendingFocusAnchor) requestAnimationFrame(() => focusSelectionAnchor(pendingFocusAnchor));
  if (wasNearBottom) requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

async function send(message) {
  return chrome.runtime.sendMessage({ ...message, resultId });
}

elements.copy.addEventListener("click", async () => {
  const text = (latestState?.messages || [])
    .filter((message) => message.text)
    .map((message) => `${message.role === "user" ? "追问" : "回答"}：\n${message.text}`)
    .join("\n\n");
  if (!text) return;
  await navigator.clipboard.writeText(text);
  showToast("对话已复制");
});

elements.retry.addEventListener("click", async () => {
  elements.retry.disabled = true;
  const response = await send({ type: "retry" });
  if (!response?.ok) showToast(response?.error || "无法重新解释");
});

elements.stop.addEventListener("click", () => send({ type: "cancel" }));
elements.library.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("library.html") }));
elements.settings.addEventListener("click", () => chrome.runtime.openOptionsPage());

elements.parentButton.addEventListener("click", async () => {
  const parent = latestRelations.parent;
  if (!parent?.record) return;
  const response = await send({
    type: "openRecord",
    recordId: parent.record.id,
    anchor: parent.edge?.anchor || null
  });
  if (!response?.ok) showToast(response?.error || "无法打开来源记录");
});

elements.childrenList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-record-id]");
  if (!button) return;
  const response = await send({ type: "openRecord", recordId: button.dataset.recordId });
  if (!response?.ok) showToast(response?.error || "无法打开分支记录");
});

document.addEventListener("contextmenu", () => {
  if (isPreview || !resultId) return;
  const anchor = captureSelectionAnchor();
  if (anchor) send({ type: "setSelectionAnchor", anchor }).catch(() => {});
}, true);

elements.language.addEventListener("change", async () => {
  const response = await send({ type: "setLanguage", language: elements.language.value });
  if (!response?.ok) {
    elements.language.value = latestState?.options?.language || "en";
    showToast(response?.error || "无法切换语言");
    return;
  }
  showToast(`${languageLabel(elements.language.value)} · 下一条回答生效`);
});

elements.check.addEventListener("click", async () => {
  elements.health.textContent = "正在检查…";
  const response = await send({ type: "checkHost" });
  if (!response?.ok) elements.health.textContent = response?.error || "无法连接";
});

elements.followupInput.addEventListener("input", () => {
  elements.send.disabled = latestState?.status === "running" || !elements.followupInput.value.trim();
});

elements.followupInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.followupForm.requestSubmit();
  }
});

elements.followupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = elements.followupInput.value.trim();
  if (!text || latestState?.status === "running") return;
  elements.send.disabled = true;
  const response = await send({ type: "followup", text });
  if (response?.ok) elements.followupInput.value = "";
  else showToast(response?.error || "无法继续对话");
});

if (!isPreview) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "stateUpdated" && message.resultId === resultId) render(message.state);
    if (message.type === "relationsUpdated" && message.resultId === resultId) {
      send({ type: "getRelations" }).then((response) => {
        if (response?.ok) renderRelations(response.relations);
      });
    }
    if (message.type === "focusAnchor" && message.resultId === resultId && message.anchor) {
      pendingFocusAnchor = message.anchor;
      focusSelectionAnchor(message.anchor);
    }
    if (message.type === "healthProgress") elements.health.textContent = message.message || "正在检查…";
    if (message.type === "healthResult") {
      elements.health.textContent = message.ok
        ? `连接正常 · ${message.detail || "Codex 已登录"}`
        : `连接失败 · ${message.message || "请检查安装"}`;
    }
    if (message.type === "nativeDisconnected" && !latestState) {
      elements.health.textContent = `连接失败 · ${message.error}`;
    }
  });
}

async function initialize() {
  if (!resultId) return;
  const response = await send({ type: "getState" });
  render(response?.state || null, response?.relations);
  const focus = await send({ type: "consumeFocusTarget" });
  if (focus?.anchor) focusSelectionAnchor(focus.anchor);
}

if (isPreview) {
  const previewState = {
    resultId: "preview",
    parentResultId: "parent-preview",
    status: "done",
    statusText: "回答完成",
    source: {
      text: "真正的理解，是能够把知识迁移到一个陌生的问题里。",
      title: "示例文章",
      url: "https://example.com",
      truncated: false
    },
    messages: [
      {
        id: "preview-a1",
        role: "assistant",
        text: "这段话强调 **理解不等于记忆**。\n\n- 记忆：知道定义\n- 理解：能迁移到新问题\n\n例如二次公式：\\[x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]",
        status: "done"
      },
      { id: "preview-u1", role: "user", text: "可以再举一个生活中的例子吗？", status: "done" },
      {
        id: "preview-a2",
        role: "assistant",
        text: "当然。**记住**供需定律只是知识；能用它解释雨天打车涨价，才是把知识迁移到现实。",
        status: "done"
      }
    ],
    options: { model: "gpt-5.6-luna", reasoning: "xhigh", language: "en" }
  };
  render(previewState, {
    parent: {
      edge: { anchor: { messageId: "preview-a1", quote: "理解不等于记忆" } },
      record: { id: "parent-preview", title: "学习到底意味着什么？" }
    },
    children: [
      {
        edge: { anchor: { quote: "雨天打车涨价" } },
        record: { id: "child-preview", title: "为什么雨天打车会涨价？" }
      }
    ]
  });
} else {
  initialize().catch((error) => { elements.health.textContent = error.message; });
}
