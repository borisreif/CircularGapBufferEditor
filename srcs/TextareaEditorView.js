// srcs/TextareaEditorView.js

import EditorModel from "./EditorModel.js";
import Storage from "./Storage.js";

const DEFAULT_TEXT = "Hello, circular gap buffer!\n\nTry typing here.";
const TAB_TEXT = "  ";

export default class TextareaEditorView {
  constructor(textarea, statusElement, debugElement) {
    if (!textarea || !statusElement || !debugElement) {
      throw new Error("TextareaEditorView requires textarea, status, and debug elements.");
    }

    this.textarea = textarea;
    this.statusElement = statusElement;
    this.debugElement = debugElement;
    this.storage = new Storage();
    this.isComposing = false;

    const savedText = this.storage.load();
    this.model = new EditorModel(savedText ?? DEFAULT_TEXT);

    this.bindEvents();
    this.render();
  }

  save() {
    this.storage.save(this.model.getText());
    this.updateStatus("Saved");
  }

  bindEvents() {
    window.addEventListener("beforeunload", () => {
      this.storage.save(this.model.getText());
    });

    this.textarea.addEventListener("keydown", event => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (isSaveShortcut) {
        event.preventDefault();
        this.save();
        return;
      }

      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.replaceSelection(TAB_TEXT);
      }
    });

    this.textarea.addEventListener("beforeinput", event => {
      if (!this.isComposing) {
        this.handleBeforeInput(event);
      }
    });

    // Native edits that we intentionally do not model in beforeinput, such as
    // browser undo/redo, are mirrored back into the model here.
    this.textarea.addEventListener("input", () => {
      if (!this.isComposing) {
        this.rebuildFromTextarea();
      }
    });

    this.textarea.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });

    this.textarea.addEventListener("compositionend", () => {
      this.isComposing = false;
      queueMicrotask(() => this.rebuildFromTextarea());
    });

    this.textarea.addEventListener("click", () => this.syncCursorFromTextarea());
    this.textarea.addEventListener("mouseup", () => this.syncCursorFromTextarea());
    this.textarea.addEventListener("focus", () => this.syncCursorFromTextarea());

    this.textarea.addEventListener("keyup", event => {
      if (this.isNavigationKey(event.key)) {
        this.syncCursorFromTextarea();
      }
    });

    this.textarea.addEventListener("select", () => {
      this.syncCursorFromTextarea({ updateDebug: true });
    });

    this.textarea.addEventListener("paste", event => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      this.replaceSelection(text);
    });
  }

  handleBeforeInput(event) {
    const type = event.inputType;
    const data = event.data ?? "";

    switch (type) {
      case "insertText":
      case "insertReplacementText":
        event.preventDefault();
        this.replaceSelection(data);
        break;

      case "insertLineBreak":
      case "insertParagraph":
        event.preventDefault();
        this.replaceSelection("\n");
        break;

      case "insertTab":
        event.preventDefault();
        this.replaceSelection(TAB_TEXT);
        break;

      case "deleteContentBackward":
        event.preventDefault();
        this.deleteBackward();
        break;

      case "deleteContentForward":
        event.preventDefault();
        this.deleteForward();
        break;

      case "deleteByCut":
      case "deleteByDrag":
        event.preventDefault();
        this.deleteSelection();
        break;

      default:
        // Let the browser perform the operation. The input listener will rebuild
        // the model from the textarea afterwards.
        break;
    }
  }

  replaceSelection(text) {
    const replacement = String(text);
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    this.model.replaceRange(start, end, replacement);
    this.render(start + replacement.length);
  }

  deleteSelection() {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;

    if (start === end) {
      return false;
    }

    this.model.deleteRange(start, end);
    this.render(start);
    return true;
  }

  deleteBackward() {
    if (this.deleteSelection()) {
      return;
    }

    const cursor = this.textarea.selectionStart;
    const text = this.model.getText();
    const start = this.previousDeleteBoundary(text, cursor);

    if (start === cursor) {
      this.render(cursor);
      return;
    }

    this.model.deleteRange(start, cursor);
    this.render(start);
  }

  deleteForward() {
    if (this.deleteSelection()) {
      return;
    }

    const cursor = this.textarea.selectionStart;
    const text = this.model.getText();
    const end = this.nextDeleteBoundary(text, cursor);

    if (end === cursor) {
      this.render(cursor);
      return;
    }

    this.model.deleteRange(cursor, end);
    this.render(cursor);
  }

  syncCursorFromTextarea({ updateDebug = true } = {}) {
    this.model.moveCursor(this.textarea.selectionStart);
    this.updateStatus();

    if (updateDebug) {
      this.updateDebug();
    }
  }

  rebuildFromTextarea() {
    const cursor = this.textarea.selectionStart;
    const text = this.textarea.value;

    this.model = new EditorModel(text);
    this.model.moveCursor(cursor);
    this.render(cursor);
  }

  render(cursorPosition = this.model.getCursor()) {
    const text = this.model.getText();
    const cursor = this.clamp(cursorPosition, 0, text.length);

    if (this.textarea.value !== text) {
      this.textarea.value = text;
    }

    this.textarea.selectionStart = cursor;
    this.textarea.selectionEnd = cursor;

    this.updateStatus();
    this.updateDebug();
  }

  updateStatus(extra = "") {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const length = this.model.getLength();
    const words = this.model.getWordCount();
    const lines = this.model.getLineCount();

    const base = start === end
      ? `Cursor: ${start} | Length: ${length} | # Words: ${words} | # Lines: ${lines}`
      : `Selection: ${start}–${end} | Length: ${length} | # Words: ${words} | # Lines: ${lines}`;

    this.statusElement.textContent = extra ? `${base} | ${extra} | ${words} | ${lines}` : base;
  }

  updateDebug() {
    this.debugElement.textContent = JSON.stringify(this.model.debugState(), null, 2);
  }

  isNavigationKey(key) {
    return [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown"
    ].includes(key);
  }

  previousDeleteBoundary(text, cursor) {
    if (cursor <= 0) {
      return 0;
    }

    const segment = this.findGraphemeSegmentAtOrBefore(text, cursor);
    if (segment) {
      return segment.index;
    }

    const previous = text.charCodeAt(cursor - 1);
    const beforePrevious = text.charCodeAt(cursor - 2);
    const deletesSurrogatePair =
      cursor >= 2 &&
      previous >= 0xdc00 && previous <= 0xdfff &&
      beforePrevious >= 0xd800 && beforePrevious <= 0xdbff;

    return cursor - (deletesSurrogatePair ? 2 : 1);
  }

  nextDeleteBoundary(text, cursor) {
    if (cursor >= text.length) {
      return text.length;
    }

    const segment = this.findGraphemeSegmentAtOrAfter(text, cursor);
    if (segment) {
      return segment.index + segment.segment.length;
    }

    const current = text.charCodeAt(cursor);
    const next = text.charCodeAt(cursor + 1);
    const deletesSurrogatePair =
      cursor + 1 < text.length &&
      current >= 0xd800 && current <= 0xdbff &&
      next >= 0xdc00 && next <= 0xdfff;

    return cursor + (deletesSurrogatePair ? 2 : 1);
  }

  findGraphemeSegmentAtOrBefore(text, cursor) {
    if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
      return null;
    }

    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let previousSegment = null;

    for (const segment of segmenter.segment(text)) {
      if (segment.index >= cursor) {
        break;
      }
      previousSegment = segment;
    }

    return previousSegment;
  }

  findGraphemeSegmentAtOrAfter(text, cursor) {
    if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
      return null;
    }

    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    for (const segment of segmenter.segment(text)) {
      if (segment.index >= cursor) {
        return segment;
      }

      const segmentEnd = segment.index + segment.segment.length;
      if (cursor < segmentEnd) {
        return segment;
      }
    }

    return null;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
}