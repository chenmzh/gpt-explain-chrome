import assert from "node:assert/strict";
import test from "node:test";

import { splitAmbiguousStrongText } from "../extension/markdown-normalize.js";

test("repairs strong Markdown ending in punctuation before adjacent Chinese text", () => {
  assert.deepEqual(
    splitAmbiguousStrongText('讲的是一个**度量标准自身会"虚涨"**的问题'),
    [
      { text: "讲的是一个" },
      { strong: '度量标准自身会"虚涨"' },
      { text: "的问题" }
    ]
  );
});

test("leaves ordinary and escaped strong markers to the Markdown parser", () => {
  assert.equal(splitAmbiguousStrongText("一个**正常加粗**的例子"), null);
  assert.equal(splitAmbiguousStrongText('一个\\**不要加粗"**的例子'), null);
});
