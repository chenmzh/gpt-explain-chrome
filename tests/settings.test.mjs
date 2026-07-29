import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  effectiveModel,
  effectiveReasoning,
  normalizeSettings
} from "../extension/default-settings.js";

test("new installs default to English and accept every supported answer language", () => {
  assert.equal(DEFAULT_SETTINGS.language, "en");
  assert.equal(DEFAULT_SETTINGS.uiLanguage, "auto");
  for (const language of ["en", "zh-CN", "de", "fr", "it", "auto"]) {
    assert.equal(normalizeSettings({ language }).language, language);
  }
  assert.equal(normalizeSettings({ language: "unsupported" }).language, "en");
  assert.equal(normalizeSettings({ uiLanguage: "de" }).uiLanguage, "de");
  assert.equal(normalizeSettings({ uiLanguage: "unsupported" }).uiLanguage, "auto");
});

test("an explicit Terra selection wins even if a stale preset says balanced", () => {
  const settings = normalizeSettings({
    performanceMode: "balanced",
    model: "gpt-5.6-terra",
    reasoning: "high"
  });
  assert.equal(effectiveModel(settings), "gpt-5.6-terra");
  assert.equal(effectiveReasoning(settings), "high");
});

test("custom model selection is sent exactly as displayed", () => {
  const settings = normalizeSettings({
    performanceMode: "fast",
    model: "custom",
    customModel: "gpt-5.5",
    reasoning: "medium"
  });
  assert.equal(effectiveModel(settings), "gpt-5.5");
  assert.equal(effectiveReasoning(settings), "medium");
});
