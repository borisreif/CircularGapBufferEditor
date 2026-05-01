import test from "node:test";
import assert from "node:assert/strict";

import EditorDocument from "../srcs/domain/EditorDocument.js";

test("EditorDocument distinguishes full text from visible text", () => {
  const document = new EditorDocument("abcdefghijklmnopqrstuvwxyz", { windowSize: 5 });

  assert.equal(document.getText(), "abcdefghijklmnopqrstuvwxyz");
  assert.equal(document.getVisibleText(), "abcde");
  assert.equal(document.getLength(), 26);
  assert.equal(document.getVisibleLength(), 5);
});

test("EditorDocument visible edits update the full document", () => {
  const document = new EditorDocument("abcdefghijklmnopqrstuvwxyz", { windowSize: 10 });

  document.replaceVisibleRange(2, 4, "XX");

  assert.equal(document.getVisibleText(), "abXXefghij");
  assert.equal(document.getText(), "abXXefghijklmnopqrstuvwxyz");
});

test("EditorDocument stats include full-document and visible-window values", () => {
  const document = new EditorDocument("one two\nthree four", { windowSize: 8 });
  const stats = document.getStats();

  assert.equal(stats.length, 18);
  assert.equal(stats.words, 4);
  assert.equal(stats.lines, 2);
  assert.equal(stats.visibleLength, 8);
  assert.equal(stats.visibleLines, 2);
});


test("EditorDocument slides the visible window forward and backward", () => {
  const document = new EditorDocument("abcdefghijklmnopqrstuvwxyz", { windowSize: 5 });

  assert.equal(document.getVisibleText(), "abcde");

  document.moveToNextWindow();
  assert.equal(document.getWindowStart(), 5);
  assert.equal(document.getVisibleText(), "fghij");

  document.moveToPreviousWindow();
  assert.equal(document.getWindowStart(), 0);
  assert.equal(document.getVisibleText(), "abcde");
});

test("EditorDocument clamps the final window at the end of the document", () => {
  const document = new EditorDocument("abcdefghijklmnopqrstuvwxyz", { windowSize: 5 });

  document.moveToDocumentEnd();

  assert.equal(document.getWindowStart(), 21);
  assert.equal(document.getVisibleText(), "vwxyz");
  assert.equal(document.canMoveToNextWindow(), false);
  assert.equal(document.canMoveToPreviousWindow(), true);
});
