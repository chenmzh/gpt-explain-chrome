import {
  ANSWER_LANGUAGES,
  DEFAULT_SETTINGS,
  HOST_NAME,
  MAX_SELECTION_LENGTH,
  MENU_ID,
  effectiveModel,
  effectiveReasoning,
  normalizeSettings
} from "./default-settings.js";
import { choosePopupPlacement } from "./window-layout.js";
import {
  deleteArchiveRecord,
  getArchiveRecord,
  getRecordRelations,
  listArchiveRecords,
  putArchiveEdge,
  putArchiveState
} from "./archive-db.js";

const POPUP_WINDOWS_KEY = "resultPopupWindows";
const LATEST_RESULT_KEY = "latestResultId";
const STATE_PREFIX = "resultState:";
const SELECTION_PREFIX = "resultSelection:";
const FOCUS_PREFIX = "resultFocus:";
const POPUP_WIDTH = 420;
const POPUP_HEIGHT = 620;
const MAX_FOLLOWUP_LENGTH = 12_000;
const MAX_CONTEXT_LENGTH = 30_000;
const MAX_ANSWER_LENGTH = 500_000;

let nativePort = null;
let nativeMessageQueue = Promise.resolve();
let popupWindows = null;
let latestResultId = null;
const popupPromises = new Map();
const stateCache = new Map();
const persistenceTimers = new Map();
const requestToResult = new Map();
const selectionAnchors = new Map();

function makeId(prefix = "req") {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function stateKey(resultId) {
  return `${STATE_PREFIX}${resultId}`;
}

function selectionKey(resultId) {
  return `${SELECTION_PREFIX}${resultId}`;
}

function focusKey(resultId) {
  return `${FOCUS_PREFIX}${resultId}`;
}

async function createContextMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "用 GPT 解释“%s”",
    contexts: ["selection"]
  });
}

chrome.runtime.onInstalled.addListener(() => createContextMenu().catch(console.error));
chrome.runtime.onStartup.addListener(() => createContextMenu().catch(console.error));

async function loadPopupWindows() {
  if (popupWindows) return popupWindows;
  const stored = await chrome.storage.session.get(POPUP_WINDOWS_KEY);
  popupWindows = stored[POPUP_WINDOWS_KEY] || {};
  return popupWindows;
}

async function persistPopupWindows() {
  await chrome.storage.session.set({ [POPUP_WINDOWS_KEY]: popupWindows || {} });
}

async function setLatestResult(resultId) {
  if (latestResultId === resultId) return;
  latestResultId = resultId;
  await chrome.storage.session.set({ [LATEST_RESULT_KEY]: resultId });
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await loadPopupWindows();
  let changed = false;
  for (const [resultId, storedWindowId] of Object.entries(windows)) {
    if (storedWindowId === windowId) {
      delete windows[resultId];
      const state = stateCache.get(resultId);
      if (state && state.status !== "running") {
        stateCache.delete(resultId);
        const timer = persistenceTimers.get(resultId);
        if (timer) clearTimeout(timer);
        persistenceTimers.delete(resultId);
        await chrome.storage.session.remove(stateKey(resultId));
      }
      changed = true;
    }
  }
  if (changed) await persistPopupWindows();
});

async function getReferenceWindow(windowId) {
  if (Number.isInteger(windowId)) {
    try { return await chrome.windows.get(windowId); } catch { /* try last focused */ }
  }
  try { return await chrome.windows.getLastFocused(); } catch { return null; }
}

async function getOccupiedPopupBounds(excludeResultId) {
  const windows = await loadPopupWindows();
  const occupied = [];
  let changed = false;
  for (const [resultId, windowId] of Object.entries(windows)) {
    if (resultId === excludeResultId) continue;
    try {
      const popup = await chrome.windows.get(windowId);
      if ([popup.left, popup.top, popup.width, popup.height].every(Number.isFinite)) {
        occupied.push({ left: popup.left, top: popup.top, width: popup.width, height: popup.height });
      }
    } catch {
      delete windows[resultId];
      changed = true;
    }
  }
  if (changed) await persistPopupWindows();
  return occupied;
}

async function createOrFocusResultPopup(resultId, referenceWindowId) {
  const windows = await loadPopupWindows();
  const existingId = windows[resultId];
  if (Number.isInteger(existingId)) {
    try {
      await chrome.windows.update(existingId, { focused: true, state: "normal" });
      await setLatestResult(resultId);
      return existingId;
    } catch {
      delete windows[resultId];
      await persistPopupWindows();
    }
  }

  const [reference, displays, occupied] = await Promise.all([
    getReferenceWindow(referenceWindowId),
    chrome.system.display.getInfo(),
    getOccupiedPopupBounds(resultId)
  ]);
  const placement = choosePopupPlacement({
    displays,
    occupied,
    reference,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT
  });
  const created = await chrome.windows.create({
    url: chrome.runtime.getURL(`popup.html?resultId=${encodeURIComponent(resultId)}`),
    type: "popup",
    ...placement,
    focused: true
  });
  if (!Number.isInteger(created.id)) throw new Error("Chrome 未能创建结果窗口");
  windows[resultId] = created.id;
  await Promise.all([persistPopupWindows(), setLatestResult(resultId)]);
  return created.id;
}

function openResultPopup(resultId, referenceWindowId) {
  if (!popupPromises.has(resultId)) {
    popupPromises.set(
      resultId,
      createOrFocusResultPopup(resultId, referenceWindowId)
        .finally(() => popupPromises.delete(resultId))
    );
  }
  return popupPromises.get(resultId);
}

chrome.action.onClicked.addListener(async (tab) => {
  const stored = await chrome.storage.session.get(LATEST_RESULT_KEY);
  const latestArchive = stored[LATEST_RESULT_KEY] ? null : (await listArchiveRecords())[0];
  const resultId = stored[LATEST_RESULT_KEY] || latestArchive?.id || makeId("result");
  if (!stored[LATEST_RESULT_KEY]) await setLatestResult(resultId);
  await openResultPopup(resultId, tab?.windowId);
});

async function loadSettings() {
  const stored = await chrome.storage.local.get("settings");
  return normalizeSettings(stored.settings || DEFAULT_SETTINGS);
}

async function migrateSessionStatesToArchive() {
  const stored = await chrome.storage.session.get(null);
  const states = Object.entries(stored)
    .filter(([key, value]) => key.startsWith(STATE_PREFIX) && value?.resultId)
    .map(([, value]) => value);
  for (const state of states) {
    await putArchiveState(state);
    if (state.parentResultId) {
      await putArchiveEdge(
        state.parentResultId,
        state.resultId,
        state.sourceAnchor,
        state.createdAt
      );
    }
  }
}

async function saveState(resultId, nextState, persistImmediately = false) {
  stateCache.set(resultId, nextState);
  chrome.runtime.sendMessage({ type: "stateUpdated", resultId, state: nextState }).catch(() => {});

  const previousTimer = persistenceTimers.get(resultId);
  if (previousTimer) clearTimeout(previousTimer);
  if (persistImmediately) {
    await chrome.storage.session.set({ [stateKey(resultId)]: nextState });
    await putArchiveState(nextState).catch((error) => console.error("Archive write failed", error));
    chrome.runtime.sendMessage({ type: "archiveUpdated", recordId: resultId }).catch(() => {});
    persistenceTimers.delete(resultId);
    return;
  }
  const timer = setTimeout(() => {
    chrome.storage.session.set({ [stateKey(resultId)]: stateCache.get(resultId) }).catch(console.error);
    persistenceTimers.delete(resultId);
  }, 120);
  persistenceTimers.set(resultId, timer);
}

async function readState(resultId) {
  if (!resultId) return null;
  if (stateCache.has(resultId)) return stateCache.get(resultId);
  const key = stateKey(resultId);
  const stored = await chrome.storage.session.get(key);
  let state = stored[key] || await getArchiveRecord(resultId);
  if (state?.status === "running" && !stored[key]) {
    const next = updateCurrentAssistant(state, (answer) => ({
      ...answer,
      status: "error",
      error: "浏览器重启后生成连接已结束，可以重新解释或继续追问。"
    }));
    state = {
      ...next,
      status: "error",
      statusText: "已从本地资料库恢复",
      error: "浏览器重启后生成连接已结束，可以重新解释或继续追问。",
      updatedAt: Date.now()
    };
    await putArchiveState(state);
  }
  if (state) stateCache.set(resultId, state);
  return state;
}

async function saveSelectionAnchor(resultId, anchor) {
  if (!resultId || !anchor?.quote) return;
  selectionAnchors.set(resultId, { ...anchor, capturedAt: Date.now() });
  await chrome.storage.session.set({
    [selectionKey(resultId)]: selectionAnchors.get(resultId)
  });
}

async function consumeSelectionAnchor(resultId) {
  if (!resultId) return null;
  const key = selectionKey(resultId);
  const stored = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  const anchor = selectionAnchors.get(resultId) || stored[key] || null;
  selectionAnchors.delete(resultId);
  return anchor && Date.now() - (anchor.capturedAt || 0) < 60_000 ? anchor : null;
}

async function focusArchivedRecord(recordId, anchor, referenceWindowId) {
  const state = await readState(recordId);
  if (!state?.source?.text) throw new Error("本地资料库中找不到这条记录");
  if (anchor) await chrome.storage.session.set({ [focusKey(recordId)]: anchor });
  await openResultPopup(recordId, referenceWindowId);
  chrome.runtime.sendMessage({ type: "focusAnchor", resultId: recordId, anchor }).catch(() => {});
}

async function markCachedRunsDisconnected(detail) {
  for (const [resultId, state] of stateCache.entries()) {
    if (state?.status !== "running") continue;
    const next = updateCurrentAssistant(state, (answer) => ({ ...answer, status: "error", error: detail }));
    await saveState(resultId, {
      ...next,
      status: "error",
      statusText: "本地连接已断开",
      error: detail,
      updatedAt: Date.now()
    }, true);
  }
}

function connectNative() {
  if (nativePort) return nativePort;
  nativePort = chrome.runtime.connectNative(HOST_NAME);
  nativePort.onMessage.addListener((message) => {
    nativeMessageQueue = nativeMessageQueue
      .then(() => handleNativeMessage(message))
      .catch((error) => console.error("Native message handling failed", error));
  });
  nativePort.onDisconnect.addListener(async () => {
    const detail = chrome.runtime.lastError?.message || "本地辅助程序已断开";
    nativePort = null;
    await markCachedRunsDisconnected(detail);
    chrome.runtime.sendMessage({ type: "nativeDisconnected", error: detail }).catch(() => {});
  });
  return nativePort;
}

function updateCurrentAssistant(state, updater) {
  const messages = [...(state.messages || [])];
  const index = messages.findIndex((message) => message.id === state.currentMessageId);
  if (index < 0) return state;
  messages[index] = updater({ ...messages[index] });
  return { ...state, messages };
}

async function handleNativeMessage(message) {
  if (message.type === "healthResult" || message.type === "healthProgress") {
    chrome.runtime.sendMessage(message).catch(() => {});
    return;
  }

  const resultId = requestToResult.get(message.requestId);
  if (!resultId) return;
  const state = await readState(resultId);
  if (!state || message.requestId !== state.requestId) return;

  if (message.type === "status") {
    await saveState(resultId, { ...state, statusText: message.message, updatedAt: Date.now() });
    return;
  }
  if (message.type === "modelResolved") {
    await saveState(resultId, {
      ...state,
      statusText: message.message || state.statusText,
      options: {
        ...state.options,
        model: message.model || state.options?.model,
        reasoning: typeof message.reasoning === "string" ? message.reasoning : state.options?.reasoning
      },
      updatedAt: Date.now()
    });
    return;
  }
  if (message.type === "answerReset") {
    const next = updateCurrentAssistant(state, (answer) => ({ ...answer, text: "" }));
    await saveState(resultId, { ...next, updatedAt: Date.now() });
    return;
  }
  if (message.type === "answerDelta") {
    const next = updateCurrentAssistant(state, (answer) => ({
      ...answer,
      text: `${answer.text || ""}${message.text || ""}`.slice(0, MAX_ANSWER_LENGTH)
    }));
    await saveState(resultId, { ...next, updatedAt: Date.now() });
    return;
  }
  if (["done", "canceled", "error"].includes(message.type)) {
    requestToResult.delete(message.requestId);
    const terminalStatus = message.type === "done" ? "done" : message.type;
    const statusText = message.type === "done"
      ? (state.mode === "followup" ? "回答完成" : "解释完成")
      : (message.type === "canceled" ? "已停止" : "生成失败");
    const next = updateCurrentAssistant(state, (answer) => ({
      ...answer,
      status: terminalStatus,
      error: message.type === "error" ? (message.message || "Codex 返回了未知错误") : ""
    }));
    await saveState(resultId, {
      ...next,
      status: terminalStatus,
      statusText,
      error: message.type === "error" ? (message.message || "Codex 返回了未知错误") : "",
      updatedAt: Date.now()
    }, true);
  }
}

function buildContextSnapshot(state, maxLength = MAX_CONTEXT_LENGTH) {
  if (!state) return "";
  const parts = [
    state.source?.text ? `原始选段：\n${state.source.text}` : "",
    ...(state.messages || []).map((message) => (
      `${message.role === "user" ? "用户追问" : "解释回答"}：\n${message.text || ""}`
    ))
  ].filter(Boolean);
  return parts.join("\n\n").slice(-maxLength);
}

function parseParentResultId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== new URL(chrome.runtime.getURL("/")).origin) return "";
    if (!parsed.pathname.endsWith("/popup.html")) return "";
    return parsed.searchParams.get("resultId") || "";
  } catch { return ""; }
}

async function startExplanation(resultId, source, parentState = null, sourceAnchor = null) {
  const settings = await loadSettings();
  const selectedText = (source.text || "").trim();
  if (!selectedText) throw new Error("没有可解释的选中文本");

  const truncated = selectedText.length > MAX_SELECTION_LENGTH;
  const text = selectedText.slice(0, MAX_SELECTION_LENGTH);
  const requestId = makeId();
  const answerId = makeId("assistant");
  const state = {
    resultId,
    conversationId: resultId,
    parentResultId: parentState?.resultId || "",
    sourceAnchor: sourceAnchor || null,
    requestId,
    currentMessageId: answerId,
    mode: "explain",
    status: "running",
    statusText: "正在连接本地 Codex…",
    error: "",
    source: {
      text,
      title: source.title || "",
      url: source.url || "",
      truncated
    },
    messages: [{ id: answerId, role: "assistant", text: "", status: "running", error: "" }],
    options: {
      model: effectiveModel(settings),
      reasoning: effectiveReasoning(settings),
      language: settings.language,
      responseLength: settings.responseLength
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await saveState(resultId, state, true);
  if (parentState?.resultId) {
    await putArchiveEdge(parentState.resultId, resultId, sourceAnchor, state.createdAt);
    chrome.runtime.sendMessage({ type: "relationsUpdated", resultId: parentState.resultId }).catch(() => {});
    chrome.runtime.sendMessage({ type: "archiveUpdated", recordId: resultId }).catch(() => {});
  }
  requestToResult.set(requestId, resultId);

  try {
    connectNative().postMessage({
      type: "explain",
      requestId,
      conversationId: resultId,
      text,
      pageTitle: source.title || "",
      pageUrl: source.url || "",
      parentContext: buildContextSnapshot(parentState),
      settings: {
        ...settings,
        model: effectiveModel(settings),
        reasoning: effectiveReasoning(settings)
      }
    });
  } catch (error) {
    requestToResult.delete(requestId);
    const next = updateCurrentAssistant(state, (answer) => ({ ...answer, status: "error", error: error.message }));
    await saveState(resultId, {
      ...next,
      status: "error",
      error: error.message,
      statusText: "无法启动本地辅助程序",
      updatedAt: Date.now()
    }, true);
  }
  return state;
}

async function startFollowup(resultId, rawText) {
  const state = await readState(resultId);
  if (!state?.source?.text) throw new Error("没有可继续的解释");
  if (state.status === "running") throw new Error("请等待当前回答完成");
  const text = (rawText || "").trim().slice(0, MAX_FOLLOWUP_LENGTH);
  if (!text) throw new Error("请输入追问内容");

  const settings = await loadSettings();
  const requestId = makeId();
  const userId = makeId("user");
  const answerId = makeId("assistant");
  const messages = [
    ...(state.messages || []),
    { id: userId, role: "user", text, status: "done", error: "" },
    { id: answerId, role: "assistant", text: "", status: "running", error: "" }
  ].slice(-24);
  const next = {
    ...state,
    requestId,
    currentMessageId: answerId,
    mode: "followup",
    status: "running",
    statusText: "正在继续对话…",
    error: "",
    messages,
    updatedAt: Date.now()
  };
  await saveState(resultId, next, true);
  requestToResult.set(requestId, resultId);
  try {
    connectNative().postMessage({
      type: "followup",
      requestId,
      conversationId: state.conversationId || resultId,
      text,
      history: buildContextSnapshot(state),
      settings: {
        ...settings,
        model: effectiveModel(settings),
        reasoning: effectiveReasoning(settings)
      }
    });
  } catch (error) {
    requestToResult.delete(requestId);
    const failed = updateCurrentAssistant(next, (answer) => ({ ...answer, status: "error", error: error.message }));
    await saveState(resultId, {
      ...failed,
      status: "error",
      statusText: "无法继续对话",
      error: error.message,
      updatedAt: Date.now()
    }, true);
    throw error;
  }
  return next;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const parentResultId = parseParentResultId(info.pageUrl || tab?.url || "");
  const parentState = parentResultId ? await readState(parentResultId) : null;
  const sourceAnchor = parentResultId
    ? (await consumeSelectionAnchor(parentResultId) || {
      messageId: "unknown",
      quote: info.selectionText,
      startOffset: null,
      endOffset: null,
      prefix: "",
      suffix: ""
    })
    : null;
  const resultId = makeId("result");
  const source = {
    text: info.selectionText,
    title: parentState ? `解释分支 · ${parentState.source?.title || "上一级解释"}` : (tab?.title || ""),
    url: parentState?.source?.url || info.pageUrl || tab?.url || ""
  };
  await startExplanation(resultId, source, parentState, sourceAnchor);
  await openResultPopup(resultId, tab?.windowId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "getState") {
      const [state, relations] = await Promise.all([
        readState(message.resultId),
        getRecordRelations(message.resultId)
      ]);
      sendResponse({ ok: true, state, relations });
      return;
    }
    if (message.type === "getRelations") {
      sendResponse({ ok: true, relations: await getRecordRelations(message.resultId) });
      return;
    }
    if (message.type === "setSelectionAnchor") {
      await saveSelectionAnchor(message.resultId, message.anchor);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "consumeFocusTarget") {
      const key = focusKey(message.resultId);
      const stored = await chrome.storage.session.get(key);
      await chrome.storage.session.remove(key);
      sendResponse({ ok: true, anchor: stored[key] || null });
      return;
    }
    if (message.type === "openRecord") {
      await focusArchivedRecord(message.recordId, message.anchor, _sender.tab?.windowId);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "deleteRecord") {
      const recordId = message.recordId;
      await deleteArchiveRecord(recordId);
      stateCache.delete(recordId);
      await chrome.storage.session.remove([stateKey(recordId), focusKey(recordId), selectionKey(recordId)]);
      const latest = await chrome.storage.session.get(LATEST_RESULT_KEY);
      if (latest[LATEST_RESULT_KEY] === recordId) {
        latestResultId = null;
        await chrome.storage.session.remove(LATEST_RESULT_KEY);
      }
      const windows = await loadPopupWindows();
      const windowId = windows[recordId];
      if (Number.isInteger(windowId)) {
        delete windows[recordId];
        await persistPopupWindows();
        chrome.windows.remove(windowId).catch(() => {});
      }
      chrome.runtime.sendMessage({ type: "archiveUpdated", recordId }).catch(() => {});
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "retry") {
      const state = await readState(message.resultId);
      if (!state?.source?.text) throw new Error("没有可重试的内容");
      const parentState = state.parentResultId ? await readState(state.parentResultId) : null;
      sendResponse({
        ok: true,
        state: await startExplanation(message.resultId, state.source, parentState, state.sourceAnchor)
      });
      return;
    }
    if (message.type === "followup") {
      sendResponse({ ok: true, state: await startFollowup(message.resultId, message.text) });
      return;
    }
    if (message.type === "setLanguage") {
      if (!ANSWER_LANGUAGES.includes(message.language)) throw new Error("回答语言无效");
      const settings = await loadSettings();
      await chrome.storage.local.set({ settings: normalizeSettings({ ...settings, language: message.language }) });
      const state = await readState(message.resultId);
      if (!state?.source?.text) throw new Error("没有可更新的解释窗口");
      const next = {
        ...state,
        options: { ...state.options, language: message.language },
        updatedAt: Date.now()
      };
      await saveState(message.resultId, next, true);
      sendResponse({ ok: true, state: next });
      return;
    }
    if (message.type === "cancel") {
      const state = await readState(message.resultId);
      if (state?.status === "running") {
        connectNative().postMessage({ type: "cancel", requestId: state.requestId });
      }
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "checkHost") {
      const requestId = makeId("health");
      connectNative().postMessage({ type: "health", requestId });
      sendResponse({ ok: true, requestId });
      return;
    }
    sendResponse({ ok: false, error: "未知消息" });
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

createContextMenu().catch(() => {});
migrateSessionStatesToArchive().catch((error) => console.error("Archive migration failed", error));
