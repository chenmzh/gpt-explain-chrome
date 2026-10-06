import {
  DEFAULT_SETTINGS, PERFORMANCE_PRESETS, normalizeSettings, performancePresetSettings,
  supportedReasoningOptions
} from "./default-settings.js";
import { createTranslator } from "./options-i18n.js";

const params = new URLSearchParams(location.search);
const isPreview = params.has("preview");
const previewLanguage = params.get("lang");
const form = document.querySelector("#settingsForm");
const fields = {
  uiLanguage: document.querySelector("#uiLanguage"),
  provider: document.querySelector("#provider"),
  deepseekReasoning: document.querySelector("#deepseekReasoning"),
  deepseekApiKey: document.querySelector("#deepseekApiKey"),
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
const deepseekFields = document.querySelector("#deepseekFields");
const deepseekKeyStatus = document.querySelector("#deepseekKeyStatus");
const connection = {
  dot: document.querySelector("#connectionDot"),
  title: document.querySelector("#connectionTitle"),
  detail: document.querySelector("#connectionDetail")
};
const toast = document.querySelector("#saveToast");
let toastTimer = null;
let i18n = createTranslator("auto", navigator.language);
let currentModels = [];
let healthRequestId = "";
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
  ensureModelOption(selected);
  fields.model.value = selected;
  updatePresetAvailability();
  updateReasoningOptions();
  updatePresetFields(false);
  updateCustomField();
}

function ensureModelOption(model) {
  if (!model || [...fields.model.options].some((option) => option.value === model)) return;
  const option = document.createElement("option");
  option.value = model;
  option.textContent = `${model} · ${t("configuredModel")}`;
  fields.model.insertBefore(option, fields.model.querySelector('option[value="custom"]'));
}

function updateReasoningOptions() {
  const allowed = supportedReasoningOptions(currentModels,
    fields.model.value === "custom" ? fields.customModel.value.trim() : fields.model.value);
  for (const option of fields.reasoning.options) {
    option.hidden = Boolean(option.value) && !allowed.includes(option.value);
    option.disabled = option.hidden;
  }
  if (fields.reasoning.selectedOptions[0]?.disabled) fields.reasoning.value = "";
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
  updatePresetAvailability();
  renderConnection();
}

function updateCustomField() {
  fields.customModelField.hidden = fields.model.value !== "custom";
  fields.customModel.required = fields.model.value === "custom";
}

function updateProviderFields() {
  const isCodex = fields.provider.value === "codex";
  const isReasonix = fields.provider.value === "reasonix";
  modelSection.hidden = !isCodex;
  deepseekFields.hidden = isCodex;
  const instantOption = [...fields.deepseekReasoning.options].find((option) => option.value === "off");
  if (instantOption) instantOption.disabled = isReasonix;
  if (isReasonix && fields.deepseekReasoning.value === "off") fields.deepseekReasoning.value = "high";
}

function setKeyStatus(key, kind = "") {
  deepseekKeyStatus.textContent = t(key);
  deepseekKeyStatus.className = `credential-status ${kind}`;
}

function updatePresetFields(applyValues = true) {
  let preset = fields.performanceMode.value;
  const values = performancePresetSettings(preset, currentModels);
  if (values && applyValues) {
    fields.model.value = values.model;
    fields.reasoning.value = values.reasoning;
  }
  if (values && !applyValues
    && (fields.model.value !== values.model || fields.reasoning.value !== values.reasoning)) {
    preset = "manual";
    fields.performanceMode.value = "manual";
  }
  modelSection.dataset.preset = preset;
  updateReasoningOptions();
  updateCustomField();
}

function updatePresetAvailability() {
  for (const option of fields.performanceMode.options) {
    const tier = PERFORMANCE_PRESETS[option.value]?.tier;
    option.disabled = Boolean(tier) && !currentModels.some((model) => model.id.endsWith(`-${tier}`));
  }
}

function fillForm(settings) {
  const value = normalizeSettings(settings);
  ensureModelOption(value.model);
  for (const key of [
    "uiLanguage", "provider", "deepseekReasoning", "performanceMode", "model", "customModel", "reasoning",
    "language", "responseLength", "promptTemplate"
  ]) {
    fields[key].value = value[key];
  }
  applyLanguage(value.uiLanguage);
  updateProviderFields();
  updatePresetFields(false);
}

function readForm() {
  return normalizeSettings({
    uiLanguage: fields.uiLanguage.value,
    provider: fields.provider.value,
    deepseekReasoning: fields.deepseekReasoning.value,
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
fields.provider.addEventListener("change", () => {
  updateProviderFields();
  if (!isPreview) checkConnection();
});
fields.performanceMode.addEventListener("change", () => updatePresetFields(true));
fields.model.addEventListener("change", () => {
  fields.performanceMode.value = "manual";
  updatePresetFields(false);
});
fields.customModel.addEventListener("input", updateReasoningOptions);
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

async function checkConnection() {
  if (isPreview) return;
  const requestId = crypto.randomUUID();
  healthRequestId = requestId;
  setConnection("checking", "checking", "checkingHost");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "checkHost", provider: fields.provider.value, requestId
    });
    if (!response?.ok && healthRequestId === requestId) {
      setConnection("error", "connectionFailed", "hostUnavailable");
    }
  } catch {
    if (healthRequestId === requestId) setConnection("error", "connectionFailed", "hostUnavailable");
  }
}

document.querySelector("#checkConnection").addEventListener("click", checkConnection);
document.querySelector("#refreshModels").addEventListener("click", checkConnection);

document.querySelector("#saveDeepSeekKey").addEventListener("click", async () => {
  const apiKey = fields.deepseekApiKey.value.trim();
  if (!apiKey) {
    setKeyStatus("deepseekKeyRequired", "error");
    fields.deepseekApiKey.focus();
    return;
  }
  setKeyStatus("deepseekKeySaving");
  const response = await chrome.runtime.sendMessage({ type: "configureDeepSeek", apiKey });
  if (!response?.ok) setKeyStatus("deepseekKeySaveFailed", "error");
});

document.querySelector("#clearDeepSeekKey").addEventListener("click", async () => {
  setKeyStatus("deepseekKeySaving");
  const response = await chrome.runtime.sendMessage({ type: "configureDeepSeek", clear: true });
  if (!response?.ok) setKeyStatus("deepseekKeySaveFailed", "error");
});

document.querySelector("#copyId").addEventListener("click", async () => {
  await navigator.clipboard.writeText(chrome.runtime.id);
  showToast("copied");
});

if (!isPreview) {
  chrome.runtime.onMessage.addListener((message) => {
    if (["healthProgress", "healthResult"].includes(message.type)
      && message.requestId !== healthRequestId) return;
    if (message.type === "healthProgress") {
      setConnection("checking", "checking", message.provider && message.provider !== "codex"
        ? "connectingDeepSeek"
        : "connectingCodex");
      return;
    }
    if (message.type !== "healthResult") return;
    if (message.ok) {
      if (message.provider === "codex") updateModelOptions(message.models);
      const defaultModel = message.defaultModel
        || message.models?.find((model) => model.isDefault)?.displayName
        || message.models?.find((model) => model.isDefault)?.id
        || "Codex";
      const detailKey = message.provider === "codex" ? "connectionReady" : "deepseekConnectionReady";
      setConnection("ok", "connectionOk", detailKey, {
        plan: message.planType ? ` · ${message.planType}` : "",
        model: defaultModel,
        provider: message.provider === "reasonix" ? "Reasonix CLI" : "DeepSeek API"
      });
      if (message.deepseekKeyConfigured) setKeyStatus("deepseekKeyConfigured", "ok");
    } else if (message.code === "NOT_LOGGED_IN") {
      setConnection("error", "connectionFailed", "loginRequired");
    } else if (message.code === "WRONG_ACCOUNT_TYPE") {
      setConnection("error", "connectionFailed", "wrongAccountType", { accountType: message.accountType || "API" });
    } else {
      setConnection("error", "connectionFailed", "reinstallHost");
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "configureResult") return;
    if (message.ok) {
      fields.deepseekApiKey.value = "";
      setKeyStatus(message.configured ? "deepseekKeyConfigured" : "deepseekKeyCleared", "ok");
    } else if (message.provider && message.provider !== "codex") {
      setConnection("error", "connectionFailed", "deepseekHealthFailed", { message: message.message || "" });
      setKeyStatus(message.deepseekKeyConfigured ? "deepseekKeyConfigured" : "deepseekKeyRequired",
        message.deepseekKeyConfigured ? "ok" : "error");
    } else {
      setKeyStatus("deepseekKeySaveFailed", "error");
    }
  });
}

async function initialize() {
  const stored = await chrome.storage.local.get("settings");
  fillForm(stored.settings || DEFAULT_SETTINGS);
  document.querySelector("#extensionId").textContent = chrome.runtime.id;
  if (fields.provider.value === "codex") await checkConnection();
}

if (isPreview) {
  fillForm({
    ...DEFAULT_SETTINGS,
    uiLanguage: ["en", "zh-CN", "de", "fr", "it", "auto"].includes(previewLanguage)
      ? previewLanguage
      : "en"
  });
  document.querySelector("#extensionId").textContent = "abcdefghijklmnopabcdefghijklmnop";
  setConnection("", "connectionUntested", "connectionHelp");
} else {
  initialize().catch(() => setConnection("error", "connectionFailed", "readSettingsFailed"));
}
