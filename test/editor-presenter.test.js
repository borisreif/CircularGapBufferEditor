import test from "node:test";
import assert from "node:assert/strict";

import EditorDocument from "../srcs/domain/EditorDocument.js";
import EditorViewport from "../srcs/domain/EditorViewport.js";
import EditorPresenter from "../srcs/app/EditorPresenter.js";

class FakeView {
  text = "";
  selection = { start: 0, end: 0 };

  getText() { return this.text; }
  setText(text) { this.text = String(text); }
  getSelection() { return this.selection; }
  setSelection(start, end = start) { this.selection = { start, end }; }
  focus() {}
  showStatus() {}
  showDebug() {}
  setWindowNavigationState() {}
  onBeforeUnload() {}
  onSave() {}
  onTab() {}
  onBeforeInput() {}
  onNativeInput() {}
  onSelectionChange() {}
  onPaste() {}
  onWindowNavigation() {}
}

const storage = {
  saveText() {}
};

test("EditorPresenter renders cursor from document after viewport refresh", () => {
  const document = new EditorDocument("one\ntwo\nthree\nfour", { windowSize: 8 });
  const viewport = new EditorViewport(document, {
    mode: "lines",
    linesPerWindow: 2,
    charactersPerWindow: 8
  });
  const view = new FakeView();
  const presenter = new EditorPresenter({ document, viewport, view, storage });

  viewport.apply();
  viewport.nextWindow();
  document.moveCursor(0);
  presenter.render({ start: 0, end: 0 });

  assert.equal(view.text, "three\nfour");
  assert.deepEqual(view.selection, { start: 0, end: 0 });

  presenter.deleteBackward();

  assert.equal(document.getFullText(), "one\ntwothree\nfour");
  assert.equal(view.text, "twothree\nfour");
  assert.deepEqual(view.selection, { start: 3, end: 3 });
  assert.equal(document.getGlobalCursor(), 7);
});

test("EditorPresenter syncs stale document cursor before backspace at final-window start", () => {
  const document = new EditorDocument("one\ntwo\nthree\nfour\nfive", { windowSize: 12 });
  const viewport = new EditorViewport(document, {
    mode: "lines",
    linesPerWindow: 2,
    charactersPerWindow: 12
  });
  const view = new FakeView();
  const presenter = new EditorPresenter({ document, viewport, view, storage });

  presenter.start();
  presenter.moveToDocumentEnd();

  assert.equal(view.text, "four\nfive");

  // Simulate a stale model cursor: the textarea caret is at the visible-window
  // start, but the document cursor still points somewhere else. This can happen
  // if browser selection-change notification is delayed/missed before Backspace.
  document.moveCursor(view.text.length);
  view.setSelection(0, 0);

  presenter.deleteBackward();

  assert.equal(document.getFullText(), "one\ntwo\nthreefour\nfive");
  assert.equal(document.getGlobalCursor(), "one\ntwo\nthree".length);
});

test("EditorPresenter syncs stale document cursor before deleteForward at final-window end", () => {
  const document = new EditorDocument("one\ntwo\nthree\nfour\nfive!", { windowSize: 12 });
  const viewport = new EditorViewport(document, {
    mode: "lines",
    linesPerWindow: 2,
    charactersPerWindow: 12
  });
  const view = new FakeView();
  const presenter = new EditorPresenter({ document, viewport, view, storage });

  presenter.start();
  presenter.moveToDocumentEnd();

  assert.equal(view.text, "four\nfive!");

  // Textarea caret is at the visible-window end/EOF, but the model cursor is
  // stale inside the window. DeleteForward at EOF should delete nothing, not the
  // character after the stale model cursor.
  document.moveCursor(0);
  view.setSelection(view.text.length, view.text.length);

  presenter.deleteForward();

  assert.equal(document.getFullText(), "one\ntwo\nthree\nfour\nfive!");
  assert.equal(document.getGlobalCursor(), document.getFullLength());
});
