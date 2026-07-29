import assert from "node:assert/strict";
import test from "node:test";

import { choosePopupPlacement, rectanglesOverlap } from "../extension/window-layout.js";

test("detects overlapping popup bounds", () => {
  assert.equal(rectanglesOverlap(
    { left: 0, top: 0, width: 420, height: 620 },
    { left: 430, top: 0, width: 420, height: 620 },
    14
  ), true);
  assert.equal(rectanglesOverlap(
    { left: 0, top: 0, width: 420, height: 620 },
    { left: 440, top: 0, width: 420, height: 620 },
    14
  ), false);
});

test("places new windows in the first non-overlapping display slot", () => {
  const first = { left: 1006, top: 14, width: 420, height: 620 };
  const placement = choosePopupPlacement({
    displays: [{ workArea: { left: 0, top: 0, width: 1440, height: 900 } }],
    occupied: [first],
    reference: { left: 0, top: 0, width: 1440, height: 900 },
    width: 420,
    height: 620
  });
  assert.equal(rectanglesOverlap(first, placement, 14), false);
  assert.deepEqual(placement, { left: 572, top: 14, width: 420, height: 620 });
});
