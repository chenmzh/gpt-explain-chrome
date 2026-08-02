import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const popupHtml = readFileSync(new URL("../extension/popup.html", import.meta.url), "utf8");
const libraryHtml = readFileSync(new URL("../extension/library.html", import.meta.url), "utf8");
const backgroundJs = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");

test("the popup keeps the explanation target visible and exposes both relationship directions", () => {
  assert.match(popupHtml, /<section class="source-card"/);
  assert.doesNotMatch(popupHtml, /<details class="source-card"/);
  for (const id of ["sourceText", "parentRelation", "parentButton", "childrenRelation", "childrenList"]) {
    assert.match(popupHtml, new RegExp(`id="${id}"`));
  }
});

test("the local library provides search, record detail, and a relationship graph", () => {
  for (const id of ["searchInput", "recordList", "detailView", "graphView", "graphCanvas"]) {
    assert.match(libraryHtml, new RegExp(`id="${id}"`));
  }
  assert.match(libraryHtml, /type="module" src="library\.js"/);
  assert.doesNotMatch(libraryHtml, /<script[^>]+src="https?:/);
});

test("the background can persist anchors and navigate archived records", () => {
  assert.match(backgroundJs, /putArchiveState/);
  assert.match(backgroundJs, /putArchiveEdge/);
  assert.match(backgroundJs, /message\.type === "setSelectionAnchor"/);
  assert.match(backgroundJs, /message\.type === "openRecord"/);
});
