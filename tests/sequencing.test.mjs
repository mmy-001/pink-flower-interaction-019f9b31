import test from "node:test";
import assert from "node:assert/strict";
import {
  afterimageFrames,
  bloomFrame,
  playbackDuration,
} from "../src/sequencing.mjs";

test("bloom sequencing reaches the final flower frame", () => {
  assert.equal(bloomFrame(0, 0, 35, 5400), 0);
  assert.equal(bloomFrame(5400, 0, 35, 5400), 35);
});

test("afterimages never cross the first frame", () => {
  assert.deepEqual(afterimageFrames(2, 4), [1, 0]);
});

test("playback timing keeps the approved 1.2 rate", () => {
  assert.equal(playbackDuration(7.2, 1.2), 5400);
});

