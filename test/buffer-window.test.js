import test from "node:test";
import assert from "node:assert/strict";

import BufferWindow from "../srcs/domain/BufferWindow.js";

test("BufferWindow exposes a visible slice but owns the full source text", () => {
  const window = new BufferWindow("abcdefghijklmnopqrstuvwxyz", { size: 10 });

  assert.equal(window.toString(), "abcdefghij");
  assert.equal(window.getSourceText(), "abcdefghijklmnopqrstuvwxyz");
  assert.equal(window.getLength(), 10);
  assert.equal(window.getSourceLength(), 26);
});

test("BufferWindow edits with local offsets and updates the hidden source buffer", () => {
  const window = new BufferWindow("abcdefghijklmnopqrstuvwxyz", { start: 5, size: 10 });

  assert.equal(window.toString(), "fghijklmno");

  window.moveCursor(2);
  const result = window.insert("XXX");

  assert.equal(result.localCursor, 5);
  assert.equal(result.globalCursor, 10);
  assert.equal(window.toString(), "fgXXXhijkl");
  assert.equal(window.getSourceText(), "abcdefgXXXhijklmnopqrstuvwxyz");
});

test("BufferWindow clamps movement at linear document boundaries", () => {
  const window = new BufferWindow("abcdefghij", { size: 4 });

  window.moveWindowTo(999);
  assert.equal(window.getWindowStart(), 6);
  assert.equal(window.toString(), "ghij");

  window.moveWindowBy(-999);
  assert.equal(window.getWindowStart(), 0);
  assert.equal(window.toString(), "abcd");
});

test("BufferWindow backspace can delete before the current window", () => {
  const window = new BufferWindow("abcdefghij", { start: 5, size: 3, cursor: 0 });

  assert.equal(window.toString(), "fgh");
  window.backspace();

  assert.equal(window.getSourceText(), "abcdfghij");
  assert.equal(window.getGlobalCursor(), 4);
  assert.equal(window.toString(), "fgh");
});
