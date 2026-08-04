import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const popupCss = await readFile(new URL("../extension/popup.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return popupCss.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
}

test("popup uses a solid page background", () => {
  const bodyRule = rule("body");
  assert.match(bodyRule, /background:\s*var\(--paper\)/);
  assert.doesNotMatch(bodyRule, /gradient\(/);
});

test("waiting indicators remain static", () => {
  assert.doesNotMatch(rule(".thinking span"), /animation\s*:/);
  assert.doesNotMatch(rule(".status-badge.running i"), /animation\s*:/);
  assert.doesNotMatch(popupCss, /@keyframes\s+(?:dot-pulse|pulse)\b/);
});
