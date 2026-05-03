import test from "node:test";
import assert from "node:assert/strict";

import EditorDocument from "../srcs/domain/EditorDocument.js";
import EditorViewport from "../srcs/domain/EditorViewport.js";

test("EditorViewport line mode exposes stable logical-line windows", () => {
  const document = new EditorDocument("one\ntwo\nthree\nfour\nfive", { windowSize: 3 });
  const viewport = new EditorViewport(document, {
    mode: "lines",
    linesPerWindow: 2,
    charactersPerWindow: 3
  });

  viewport.apply();
  assert.equal(document.getVisibleText(), "one\ntwo");
  assert.equal(document.getVisibleLineCount(), 2);
  assert.equal(document.getVisibleStartLine(), 1);

  viewport.nextWindow();
  assert.equal(document.getVisibleText(), "three\nfour");
  assert.equal(document.getVisibleLineCount(), 2);
  assert.equal(document.getVisibleStartLine(), 3);

  viewport.nextWindow();
  assert.equal(document.getVisibleText(), "five");
  assert.equal(document.getVisibleLineCount(), 1);
  assert.equal(document.getVisibleStartLine(), 5);
});

test("EditorViewport character mode still moves by character windows", () => {
  const document = new EditorDocument("abcdefghijklmnopqrstuvwxyz", { windowSize: 4 });
  const viewport = new EditorViewport(document, {
    mode: "characters",
    linesPerWindow: 2,
    charactersPerWindow: 5
  });

  viewport.apply();
  assert.equal(document.getVisibleText(), "abcde");

  viewport.nextWindow();
  assert.equal(document.getVisibleText(), "fghij");

  viewport.lastWindow();
  assert.equal(document.getVisibleText(), "vwxyz");
});

test("EditorViewport.refresh preserves cursor when line-window start shifts", () => {
  const document = new EditorDocument("one\ntwo\nthree\nfour", { windowSize: 8 });
  const viewport = new EditorViewport(document, {
    mode: "lines",
    linesPerWindow: 2,
    charactersPerWindow: 8
  });

  viewport.apply();
  viewport.nextWindow();
  assert.equal(document.getVisibleText(), "three\nfour");

  document.moveCursor(0);
  assert.equal(document.getGlobalCursor(), 8);

  document.backspace(); // delete the hidden newline before "three"
  assert.equal(document.getFullText(), "one\ntwothree\nfour");
  assert.equal(document.getGlobalCursor(), 7);

  viewport.refresh();

  assert.equal(document.getVisibleText(), "twothree\nfour");
  assert.equal(document.getGlobalCursor(), 7);
  assert.equal(document.getCursor(), 3);
});
