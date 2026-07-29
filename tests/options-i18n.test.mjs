import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { UI_MESSAGES, createTranslator, resolveUiLanguage } from "../extension/options-i18n.js";

test("every settings-page locale contains the complete English key set", () => {
  const expected = Object.keys(UI_MESSAGES.en).sort();
  for (const [locale, messages] of Object.entries(UI_MESSAGES)) {
    assert.deepEqual(Object.keys(messages).sort(), expected, `${locale} message keys`);
  }
});

test("every translation key used by the settings HTML exists", () => {
  const html = readFileSync(new URL("../extension/options.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map((match) => match[1]);
  for (const key of keys) assert.ok(Object.hasOwn(UI_MESSAGES.en, key), `missing key: ${key}`);
});

test("automatic interface language follows supported browser languages and falls back to English", () => {
  assert.equal(resolveUiLanguage("auto", "de-CH"), "de");
  assert.equal(resolveUiLanguage("auto", "fr-FR"), "fr");
  assert.equal(resolveUiLanguage("auto", "it-IT"), "it");
  assert.equal(resolveUiLanguage("auto", "zh-Hant"), "zh-CN");
  assert.equal(resolveUiLanguage("auto", "es-ES"), "en");
  assert.equal(resolveUiLanguage("fr", "de-CH"), "fr");
});

test("translator interpolates localized connection details", () => {
  const { locale, t } = createTranslator("de", "en-US");
  assert.equal(locale, "de");
  assert.match(t("connectionReady", { plan: " · Plus", model: "GPT-5.6-Sol" }), /Plus/);
  assert.match(t("connectionReady", { plan: " · Plus", model: "GPT-5.6-Sol" }), /GPT-5\.6-Sol/);
});
