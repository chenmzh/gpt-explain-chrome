import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  PERFORMANCE_PRESETS,
  effectiveModel,
  effectiveReasoning,
  normalizeSettings
} from "../extension/default-settings.js";

test("new installs use Luna with xhigh reasoning by default", () => {
  assert.equal(DEFAULT_SETTINGS.performanceMode, "luna-xhigh");
  assert.equal(DEFAULT_SETTINGS.model, "gpt-5.6-luna");
  assert.equal(DEFAULT_SETTINGS.reasoning, "xhigh");
  assert.deepEqual(Object.keys(PERFORMANCE_PRESETS), [
    "luna-xhigh",
    "luna-max",
    "balanced",
    "accurate"
  ]);
  assert.deepEqual(PERFORMANCE_PRESETS["luna-max"], {
    model: "gpt-5.6-luna",
    reasoning: "max"
  });
});

test("the retired Terra preset migrates to the new Luna default", () => {
  const settings = normalizeSettings({
    performanceMode: "fast",
    model: "gpt-5.6-terra",
    reasoning: "low"
  });
  assert.equal(settings.performanceMode, "luna-xhigh");
  assert.equal(settings.model, "gpt-5.6-luna");
  assert.equal(settings.reasoning, "xhigh");
});

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
    performanceMode: "manual",
    model: "custom",
    customModel: "gpt-5.5",
    reasoning: "medium"
  });
  assert.equal(effectiveModel(settings), "gpt-5.5");
  assert.equal(effectiveReasoning(settings), "medium");
});
