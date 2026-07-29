import { DEFAULT_SETTINGS, normalizeSettings } from "./default-settings.js";

const form = document.querySelector("#settingsForm");
const fields = {
  performanceMode: document.querySelector("#performanceMode"),
  model: document.querySelector("#model"),
  customModel: document.querySelector("#customModel"),
  customModelField: document.querySelector("#customModelField"),
  reasoning: document.querySelector("#reasoning"),
  language: document.querySelector("#language"),
  responseLength: document.querySelector("#responseLength"),
  promptTemplate: document.querySelector("#promptTemplate")
};
const modelSection = document.querySelector(".model-section");
const connection = {
  dot: document.querySelector("#connectionDot"),
  title: document.querySelector("#connectionTitle"),
  detail: document.querySelector("#connectionDetail")
};
const toast = document.querySelector("#saveToast");
let toastTimer = null;
const isPreview = new URLSearchParams(location.search).has("preview");

function updateCustomField() {
  fields.customModelField.hidden = fields.model.value !== "custom";
  fields.customModel.required = fields.model.value === "custom";
}

function updatePresetFields(applyValues = true) {
  let preset = fields.performanceMode.value;
  const values = {
    balanced: ["gpt-5.6-sol", "medium"],
    fast: ["gpt-5.6-terra", "low"],
    accurate: ["gpt-5.6-sol", "high"]
  }[preset];
  if (values && applyValues) {
    [fields.model.value, fields.reasoning.value] = values;
  }
  if (values && !applyValues
    && (fields.model.value !== values[0] || fields.reasoning.value !== values[1])) {
    preset = "manual";
    fields.performanceMode.value = "manual";
  }
  modelSection.dataset.preset = preset;
  updateCustomField();
}

function fillForm(settings) {
  const value = normalizeSettings(settings);
  for (const key of ["performanceMode", "model", "customModel", "reasoning", "language", "responseLength", "promptTemplate"]) {
    fields[key].value = value[key];
  }
  updatePresetFields(false);
}

function readForm() {
  return normalizeSettings({
    performanceMode: fields.performanceMode.value,
    model: fields.model.value,
    customModel: fields.customModel.value,
    reasoning: fields.reasoning.value,
    language: fields.language.value,
    responseLength: fields.responseLength.value,
    promptTemplate: fields.promptTemplate.value
  });
}

function showToast() {
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
}

function setConnection(kind, title, detail) {
  connection.dot.className = `connection-dot ${kind}`;
  connection.title.textContent = title;
  connection.detail.textContent = detail;
}

function updateModelOptions(models) {
  if (!Array.isArray(models) || !models.length) return;
  const selected = fields.model.value;
  const customOption = [...fields.model.options].find((option) => option.value === "custom");
  for (const option of [...fields.model.options]) {
    if (option.value && option.value !== "custom") option.remove();
  }
  for (const model of models) {
    if (!model?.id) continue;
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.displayName || model.id}${model.isDefault ? " · 账号默认" : ""}`;
    fields.model.insertBefore(option, customOption || null);
  }
  fields.model.value = [...fields.model.options].some((option) => option.value === selected)
    ? selected
    : "";
  updateCustomField();
}

fields.performanceMode.addEventListener("change", () => updatePresetFields(true));
fields.model.addEventListener("change", () => {
  fields.performanceMode.value = "manual";
  updatePresetFields(false);
});
fields.reasoning.addEventListener("change", () => {
  fields.performanceMode.value = "manual";
  updatePresetFields(false);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (fields.model.value === "custom" && !fields.customModel.value.trim()) {
    fields.customModel.focus();
    return;
  }
  if (!isPreview) await chrome.storage.local.set({ settings: readForm() });
  showToast();
});

document.querySelector("#resetButton").addEventListener("click", () => fillForm(DEFAULT_SETTINGS));

document.querySelector("#checkConnection").addEventListener("click", async () => {
  setConnection("checking", "正在检测", "正在连接 Native Host 并检查 Codex 登录状态…");
  const response = await chrome.runtime.sendMessage({ type: "checkHost" });
  if (!response?.ok) setConnection("error", "连接失败", response?.error || "无法连接本地 Host");
});

document.querySelector("#copyId").addEventListener("click", async () => {
  await navigator.clipboard.writeText(chrome.runtime.id);
  showToast();
});

if (!isPreview) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "healthProgress") {
      setConnection("checking", "正在检测", message.message || "正在连接 Codex…");
      return;
    }
    if (message.type !== "healthResult") return;
    if (message.ok) {
      updateModelOptions(message.models);
      setConnection("ok", "连接正常", message.detail || "Codex 已安装并登录");
    } else {
      setConnection("error", "连接失败", message.message || "请重新安装 Native Host");
    }
  });
}

async function initialize() {
  const stored = await chrome.storage.local.get("settings");
  fillForm(stored.settings || DEFAULT_SETTINGS);
  document.querySelector("#extensionId").textContent = chrome.runtime.id;
}

if (isPreview) {
  fillForm(DEFAULT_SETTINGS);
  document.querySelector("#extensionId").textContent = "abcdefghijklmnopabcdefghijklmnop";
  setConnection("ok", "连接正常", "Logged in using ChatGPT");
} else {
  initialize().catch((error) => setConnection("error", "读取设置失败", error.message));
}
