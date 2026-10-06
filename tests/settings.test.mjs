import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_SETTINGS,
  LEGACY_DEFAULT_PROMPT_TEMPLATE,
  PERFORMANCE_PRESETS,
  effectiveModel,
  effectiveReasoning,
  normalizeSettings,
  performancePresetSettings,
  supportedReasoningOptions
} from "../extension/default-settings.js";

test("the default prompt teaches step by step and migrates the old template", () => {
  assert.match(DEFAULT_PROMPT_TEMPLATE, /patient tutor/);
  assert.match(DEFAULT_PROMPT_TEMPLATE, /why it follows from the previous step/);
  assert.match(DEFAULT_PROMPT_TEMPLATE, /Do not skip logical links/);
  assert.match(DEFAULT_PROMPT_TEMPLATE, /likely misunderstanding/);
  assert.equal(
    normalizeSettings({ promptTemplate: LEGACY_DEFAULT_PROMPT_TEMPLATE }).promptTemplate,
    DEFAULT_PROMPT_TEMPLATE
  );
  assert.equal(normalizeSettings({ promptTemplate: "My custom teaching prompt" }).promptTemplate,
    "My custom teaching prompt");
});

test("new installs follow the local Codex recommended model and effort", () => {
  assert.equal(DEFAULT_SETTINGS.provider, "codex");
  assert.equal(DEFAULT_SETTINGS.deepseekReasoning, "high");
  assert.equal(DEFAULT_SETTINGS.performanceMode, "auto");
  assert.equal(DEFAULT_SETTINGS.model, "");
  assert.equal(DEFAULT_SETTINGS.reasoning, "");
  assert.deepEqual(Object.keys(PERFORMANCE_PRESETS), [
    "auto",
    "luna-xhigh",
    "luna-max",
    "balanced",
    "accurate"
  ]);
  assert.deepEqual(PERFORMANCE_PRESETS["luna-max"], {
    tier: "luna",
    reasoning: "max"
  });
});

test("accepts both DeepSeek providers and rejects unknown providers", () => {
  assert.equal(normalizeSettings({ provider: "deepseek-api" }).provider, "deepseek-api");
  assert.equal(normalizeSettings({ provider: "reasonix" }).provider, "reasonix");
  assert.equal(normalizeSettings({ provider: "other" }).provider, "codex");
  assert.equal(normalizeSettings({ deepseekReasoning: "max" }).deepseekReasoning, "max");
  assert.equal(normalizeSettings({ deepseekReasoning: "ultra" }).deepseekReasoning, "high");
});

test("the retired automatic preset migrates to Codex auto", () => {
  const settings = normalizeSettings({
    performanceMode: "fast",
    model: "gpt-5.6-terra",
    reasoning: "low"
  });
  assert.equal(settings.performanceMode, "auto");
  assert.equal(settings.model, "");
  assert.equal(settings.reasoning, "");
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

test("Luna presets resolve the newest locally available version and its supported effort", () => {
  const models = [
    { id: "gpt-5.6-luna", supportedReasoningEfforts: ["xhigh", "max"] },
    { id: "gpt-6-luna", isDefault: true, supportedReasoningEfforts: ["medium", "high"], defaultReasoningEffort: "medium" }
  ];
  assert.deepEqual(performancePresetSettings("luna-max", models), { model: "gpt-6-luna", reasoning: "medium" });
  assert.deepEqual(performancePresetSettings("auto", models), { model: "", reasoning: "" });
  assert.deepEqual(performancePresetSettings("balanced", models), { model: "", reasoning: "medium" });
  assert.equal(performancePresetSettings("manual", models), null);
});

test("reasoning options follow the selected or recommended model and tolerate older catalogs", () => {
  const models = [
    { id: "old-model" },
    { id: "local-default", isDefault: true, supportedReasoningEfforts: ["none", "minimal", "medium"] },
    { id: "no-effort", supportedReasoningEfforts: [] }
  ];
  assert.deepEqual(supportedReasoningOptions(models), ["none", "minimal", "medium"]);
  assert.deepEqual(supportedReasoningOptions(models, "no-effort"), []);
  assert.ok(supportedReasoningOptions(models, "old-model").includes("high"));
  for (const reasoning of ["none", "minimal"]) {
    assert.equal(normalizeSettings({ reasoning }).reasoning, reasoning);
  }
});

test("existing explicit model and reasoning settings survive the automatic default change", () => {
  const settings = normalizeSettings({ performanceMode: "luna-max", model: "gpt-5.6-luna", reasoning: "max" });
  assert.equal(settings.model, "gpt-5.6-luna");
  assert.equal(settings.reasoning, "max");
});
