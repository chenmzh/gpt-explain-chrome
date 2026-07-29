import { DEFAULT_SETTINGS, normalizeSettings } from "./default-settings.js";
import { createTranslator } from "./options-i18n.js";

const params = new URLSearchParams(location.search);
const isPreview = params.has("preview");
const previewLanguage = params.get("lang");
const form = document.querySelector("#settingsForm");
const fields = {
  uiLanguage: document.querySelector("#uiLanguage"),
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
let i18n = createTranslator("auto", navigator.language);
let currentModels = [];
let connectionState = {
  kind: "",
  titleKey: "connectionUntested",
  detailKey: "connectionHelp",
  replacements: {}
};

function t(key, replacements) {
  return i18n.t(key, replacements);
}

function renderConnection() {
  connection.dot.className = `connection-dot ${connectionState.kind}`;
  connection.title.textContent = t(connectionState.titleKey, connectionState.replacements);
  connection.detail.textContent = t(connectionState.detailKey, connectionState.replacements);
}

function setConnection(kind, titleKey, detailKey, replacements = {}) {
  connectionState = { kind, titleKey, detailKey, replacements };
  renderConnection();
}

function updateModelOptions(models) {
  if (!Array.isArray(models) || !models.length) return;
  currentModels = models;
  const selected = fields.model.value;
  const customOption = [...fields.model.options].find((option) => option.value === "custom");
  for (const option of [...fields.model.options]) {
    if (option.value && option.value !== "custom") option.remove();
  }
  for (const model of models) {
    if (!model?.id) continue;
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = `${model.displayName || model.id}${model.isDefault ? ` · ${t("accountDefault")}` : ""}`;
    fields.model.insertBefore(option, customOption || null);
  }
  fields.model.value = [...fields.model.options].some((option) => option.value === selected)
    ? selected
    : "";
  updateCustomField();
}

function applyLanguage(preference) {
  i18n = createTranslator(preference, navigator.language);
  document.documentElement.lang = i18n.locale;
  document.title = t("pageTitle");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  if (currentModels.length) updateModelOptions(currentModels);
  renderConnection();
}

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
  for (const key of [
    "uiLanguage", "performanceMode", "model", "customModel", "reasoning",
    "language", "responseLength", "promptTemplate"
  ]) {
    fields[key].value = value[key];
  }
  applyLanguage(value.uiLanguage);
  updatePresetFields(false);
}

function readForm() {
  return normalizeSettings({
    uiLanguage: fields.uiLanguage.value,
    performanceMode: fields.performanceMode.value,
    model: fields.model.value,
    customModel: fields.customModel.value,
    reasoning: fields.reasoning.value,
    language: fields.language.value,
    responseLength: fields.responseLength.value,
    promptTemplate: fields.promptTemplate.value
  });
}

function showToast(messageKey = "settingsSaved") {
  toast.textContent = t(messageKey);
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
}

fields.uiLanguage.addEventListener("change", () => applyLanguage(fields.uiLanguage.value));
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
  setConnection("checking", "checking", "checkingHost");
  const response = await chrome.runtime.sendMessage({ type: "checkHost" });
  if (!response?.ok) setConnection("error", "connectionFailed", "hostUnavailable");
});

document.querySelector("#copyId").addEventListener("click", async () => {
  await navigator.clipboard.writeText(chrome.runtime.id);
  showToast("copied");
});

if (!isPreview) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "healthProgress") {
      setConnection("checking", "checking", "connectingCodex");
      return;
    }
    if (message.type !== "healthResult") return;
    if (message.ok) {
      updateModelOptions(message.models);
      const defaultModel = message.defaultModel
        || message.models?.find((model) => model.isDefault)?.displayName
        || message.models?.find((model) => model.isDefault)?.id
        || "Codex";
      setConnection("ok", "connectionOk", "connectionReady", {
        plan: message.planType ? ` · ${message.planType}` : "",
        model: defaultModel
      });
    } else if (message.code === "NOT_LOGGED_IN") {
      setConnection("error", "connectionFailed", "loginRequired");
    } else if (message.code === "WRONG_ACCOUNT_TYPE") {
      setConnection("error", "connectionFailed", "wrongAccountType", { accountType: message.accountType || "API" });
    } else {
      setConnection("error", "connectionFailed", "reinstallHost");
    }
  });
}

async function initialize() {
  const stored = await chrome.storage.local.get("settings");
  fillForm(stored.settings || DEFAULT_SETTINGS);
  document.querySelector("#extensionId").textContent = chrome.runtime.id;
}

if (isPreview) {
  fillForm({
    ...DEFAULT_SETTINGS,
    uiLanguage: ["en", "zh-CN", "de", "fr", "it", "auto"].includes(previewLanguage)
      ? previewLanguage
      : "en"
  });
  document.querySelector("#extensionId").textContent = "abcdefghijklmnopabcdefghijklmnop";
  setConnection("ok", "connectionOk", "connectionReady", { plan: " · Plus", model: "GPT-5.6-Sol" });
} else {
  initialize().catch(() => setConnection("error", "connectionFailed", "readSettingsFailed"));
}
