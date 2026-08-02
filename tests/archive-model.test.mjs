import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveTitle,
  filterArchiveRecords,
  layoutArchiveGraph,
  locateSelectionAnchor,
  makeArchiveRecord,
  makeRelationEdge,
  normalizeSelectionAnchor
} from "../extension/archive-model.js";

function state(resultId, text, createdAt = 1) {
  return {
    resultId,
    source: { text, title: "Article", url: "https://example.com/read" },
    messages: [{ id: `${resultId}-answer`, role: "assistant", text: `Answer for ${text}` }],
    createdAt,
    updatedAt: createdAt
  };
}

test("archive records retain conversation data and searchable text", () => {
  const record = makeArchiveRecord(state("record-1", "Transfer learning"));
  assert.equal(record.id, "record-1");
  assert.equal(record.sourceDomain, "example.com");
  assert.match(record.searchableText, /answer for transfer learning/i);
  assert.equal(archiveTitle(record), "Transfer learning");
});

test("selection anchors preserve exact text and bound surrounding context", () => {
  const anchor = normalizeSelectionAnchor({
    messageId: "answer-1",
    startOffset: 10,
    endOffset: 27,
    quote: "  selected\ntext  ",
    prefix: "p".repeat(300),
    suffix: "s".repeat(300)
  });
  assert.equal(anchor.quote, "selected\ntext");
  assert.equal(anchor.prefix.length, 160);
  assert.equal(anchor.suffix.length, 160);
});

test("one relation edge supports parent and child lookup", () => {
  const edge = makeRelationEdge("parent", "child", {
    messageId: "answer-1",
    startOffset: 4,
    endOffset: 11,
    quote: "concept"
  }, 123);
  assert.equal(edge.id, "parent::child");
  assert.equal(edge.fromRecordId, "parent");
  assert.equal(edge.toRecordId, "child");
  assert.equal(edge.anchor.quote, "concept");
  assert.equal(edge.createdAt, 123);
});

test("selection anchors use surrounding context when the quote appears more than once", () => {
  const text = "first repeated phrase here; second repeated phrase there";
  const location = locateSelectionAnchor(text, {
    quote: "repeated phrase",
    prefix: "second ",
    suffix: " there"
  });
  assert.equal(text.slice(location.startOffset, location.endOffset), "repeated phrase");
  assert.equal(location.startOffset, text.lastIndexOf("repeated phrase"));
});

test("local library search covers selected text and answers", () => {
  const records = [
    makeArchiveRecord(state("a", "Supply and demand")),
    makeArchiveRecord(state("b", "Transfer learning"))
  ];
  assert.deepEqual(filterArchiveRecords(records, "DEMAND").map((record) => record.id), ["a"]);
  assert.deepEqual(filterArchiveRecords(records, "answer for transfer").map((record) => record.id), ["b"]);
});

test("graph layout places descendants to the right and tolerates cycles", () => {
  const records = [
    makeArchiveRecord(state("a", "Root", 1)),
    makeArchiveRecord(state("b", "Child", 2)),
    makeArchiveRecord(state("c", "Grandchild", 3))
  ];
  const edges = [
    makeRelationEdge("a", "b", { quote: "one" }),
    makeRelationEdge("b", "c", { quote: "two" })
  ];
  const layout = layoutArchiveGraph(records, edges);
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.ok(nodes.get("a").x < nodes.get("b").x);
  assert.ok(nodes.get("b").x < nodes.get("c").x);

  const cyclic = layoutArchiveGraph(records, [
    ...edges,
    makeRelationEdge("c", "a", { quote: "cycle" })
  ]);
  assert.equal(cyclic.nodes.length, 3);
});
