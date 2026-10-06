import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import test from "node:test";
import * as settingsModule from "../extension/default-settings.js";
import { createTranslator } from "../extension/options-i18n.js";

const html = readFileSync(new URL("../extension/options.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../extension/options.js", import.meta.url), "utf8")
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^\"]+";/g, "");

function element() {
  return {
    value: "", dataset: {}, textContent: "", classList: { add() {}, remove() {} },
    listeners: new Map(),
    addEventListener(type, handler) { this.listeners.set(type, handler); },
    dispatch(type) { return this.listeners.get(type)?.({ preventDefault() {} }); }
  };
}

function option(value = "") {
  return { value, hidden: false, disabled: false, textContent: "", remove() {
    this.parent.options.splice(this.parent.options.indexOf(this), 1);
  } };
}

// Model the select behavior that caused saved unknown IDs to disappear on page load.
function select(markup) {
  const field = element();
  field.options = [...markup.matchAll(/<option value="([^"]*)"/g)].map((match) => option(match[1]));
  let selected = field.options[0];
  Object.defineProperties(field, {
    value: {
      get: () => field.options.includes(selected) ? selected.value : "",
      set: (value) => { selected = field.options.find((entry) => entry.value === value); }
    },
    selectedOptions: { get: () => field.options.includes(selected) ? [selected] : [] }
  });
  field.insertBefore = (entry, before) => {
    entry.parent = field;
    field.options.splice(before ? field.options.indexOf(before) : field.options.length, 0, entry);
  };
  field.querySelector = (selector) => field.options.find((entry) => selector === `option[value="${entry.value}"]`);
  for (const entry of field.options) entry.parent = field;
  return field;
}

async function optionsPage(storedSettings = {}) {
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map((match) => [`#${match[1]}`, element()]));
  for (const match of html.matchAll(/<select id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    elements.set(`#${match[1]}`, select(match[2]));
  }
  elements.set(".model-section", element());
  const requests = [];
  const listeners = [];
  let saved;
  const context = createContext({
    ...settingsModule, createTranslator, URLSearchParams, crypto: { randomUUID },
    location: { search: "" }, navigator: { language: "en", clipboard: { async writeText() {} } },
    document: {
      documentElement: {},
      querySelector: (selector) => elements.get(selector),
      querySelectorAll: () => [],
      createElement: () => option()
    },
    chrome: {
      storage: { local: {
        async get() { return { settings: storedSettings }; },
        async set(value) { saved = value.settings; }
      } },
      runtime: {
        id: "extension-test-id",
        onMessage: { addListener: (listener) => listeners.push(listener) },
        async sendMessage(message) { requests.push(message); return { ok: true, requestId: message.requestId }; }
      }
    },
    setTimeout: () => 0, clearTimeout() {}
  });
  new Script(source, { filename: "options.js" }).runInContext(context);
  await new Promise(setImmediate);
  return {
    field: (id) => elements.get(`#${id}`), requests,
    saved: () => saved,
    receive(message) { for (const listener of listeners) listener(message); },
    catalog(models) {
      this.receive({ type: "healthResult", requestId: requests.at(-1).requestId, provider: "codex", ok: true, models });
    }
  };
}

const models = [
  { id: "local-default", displayName: "Local default", isDefault: true, supportedReasoningEfforts: ["medium", "high"] },
  { id: "local-fast", displayName: "Local fast", supportedReasoningEfforts: ["none", "minimal"] }
];

test("options automatically fetch models and constrain reasoning when a model is changed", async () => {
  const page = await optionsPage();
  assert.equal(page.requests[0].type, "checkHost");
  assert.equal(page.requests[0].provider, "codex");
  page.catalog(models);
  assert.deepEqual(page.field("model").options.map((entry) => entry.value), ["", "local-default", "local-fast", "custom"]);
  page.field("reasoning").value = "high";
  page.field("model").value = "local-fast";
  page.field("model").dispatch("change");
  assert.equal(page.field("reasoning").value, "");
  assert.deepEqual(page.field("reasoning").options.filter((entry) => !entry.disabled).map((entry) => entry.value), ["", "none", "minimal"]);
});

test("opening, refreshing, translating and saving retain a previously configured model ID", async () => {
  const page = await optionsPage({ model: "previous-local-model", reasoning: "high", performanceMode: "manual" });
  assert.equal(page.field("model").value, "previous-local-model");
  page.catalog(models);
  page.field("uiLanguage").value = "zh-CN";
  page.field("uiLanguage").dispatch("change");
  assert.equal(page.field("model").value, "previous-local-model");
  await page.field("settingsForm").dispatch("submit");
  assert.equal(page.saved().model, "previous-local-model");
  assert.equal(page.saved().reasoning, "high");
});

test("refresh uses an unsaved provider selection and ignores stale connection results", async () => {
  const page = await optionsPage();
  const oldRequest = page.requests[0];
  page.field("provider").value = "reasonix";
  await page.field("provider").dispatch("change");
  assert.equal(page.requests.at(-1).provider, "reasonix");
  page.receive({ type: "healthResult", requestId: oldRequest.requestId, provider: "codex", ok: true, models });
  assert.equal(page.field("model").options.some((entry) => entry.value === "local-fast"), false);
});
