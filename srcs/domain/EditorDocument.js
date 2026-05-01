// srcs/domain/EditorDocument.js

import BufferWindow from "./BufferWindow.js";

const DEFAULT_WINDOW_SIZE = 4000;

/**
 * EditorDocument is the editor-shaped model above BufferWindow.
 *
 * Responsibilities:
 *
 * - Own the `BufferWindow`.
 * - Expose document/editor vocabulary to the presenter.
 * - Keep the circular gap buffer hidden behind BufferWindow.
 * - Provide stats, line counts, and debug information.
 *
 * Important distinction:
 *
 * - `getText()` / `getFullText()` return the full document text.
 * - `getVisibleText()` returns only the current window text shown in the textarea.
 * - Cursor and selection methods currently use visible/window-local offsets,
 *   because the textarea also uses local offsets.
 */
export default class EditorDocument {
  #window;
  #documentMetrics = null;

  constructor(initialText = "", { windowSize = DEFAULT_WINDOW_SIZE } = {}) {
    EditorDocument.#assertString(initialText, "initialText");

    this.#window = new BufferWindow(initialText, {
      size: windowSize
    });
  }

  // -------------------------------------------------------------------------
  // Full document API
  // -------------------------------------------------------------------------

  getText() {
    return this.getFullText();
  }

  getFullText() {
    return this.#window.getSourceText();
  }

  setText(text) {
    EditorDocument.#assertString(text, "text");
    this.#window.setSourceText(text);
    this.#invalidateDocumentMetrics();
    return this;
  }

  getLength() {
    return this.#window.getSourceLength();
  }

  isEmpty() {
    return this.getLength() === 0;
  }

  // -------------------------------------------------------------------------
  // Visible/window text API
  // -------------------------------------------------------------------------

  getVisibleText() {
    return this.#window.toString();
  }

  getVisibleLength() {
    return this.#window.getLength();
  }

  setVisibleText(text) {
    EditorDocument.#assertString(text, "text");
    this.#window.replaceRange(0, this.#window.getLength(), text);
    this.#invalidateDocumentMetrics();
    return this;
  }

  replaceVisibleRange(start, end, text) {
    EditorDocument.#assertString(text, "text");
    const result = this.#window.replaceRange(start, end, text);
    this.#invalidateDocumentMetrics();
    return result;
  }

  insertText(text) {
    EditorDocument.#assertString(text, "text");
    const result = this.#window.insert(text);
    this.#invalidateDocumentMetrics();
    return result;
  }

  // Backwards-compatible aliases. In the windowed design, these ranges are
  // visible/window-local, because they usually come from textarea.selectionStart.
  replaceRange(start, end, text) {
    return this.replaceVisibleRange(start, end, text);
  }

  deleteRange(start, end) {
    const result = this.#window.deleteRange(start, end);
    this.#invalidateDocumentMetrics();
    return result;
  }

  backspace() {
    const result = this.#window.backspace();
    this.#invalidateDocumentMetrics();
    return result;
  }

  deleteForward() {
    const result = this.#window.deleteForward();
    this.#invalidateDocumentMetrics();
    return result;
  }

  // -------------------------------------------------------------------------
  // Cursor and window API
  // -------------------------------------------------------------------------

  moveCursor(position) {
    this.#window.moveCursor(position);
    return this.getCursor();
  }

  getCursor() {
    return this.#window.getCursor();
  }

  getGlobalCursor() {
    return this.#window.getGlobalCursor();
  }

  moveWindowTo(globalOffset) {
    this.#window.moveWindowTo(globalOffset);
    return this;
  }

  moveWindowBy(delta) {
    this.#window.moveWindowBy(delta);
    return this;
  }

  /**
   * Moves the visible window one full window-size step backward.
   *
   * This is character-offset based, not line based. The window clamps at the
   * beginning of the document, so this method is safe to call repeatedly.
   */
  moveToPreviousWindow() {
    return this.moveWindowBy(-this.getWindowSize());
  }

  /**
   * Moves the visible window one full window-size step forward.
   *
   * This is character-offset based, not line based. The window clamps at the
   * end of the document, so this method is safe to call repeatedly.
   */
  moveToNextWindow() {
    return this.moveWindowBy(this.getWindowSize());
  }

  /** Moves the visible window to the start of the document. */
  moveToDocumentStart() {
    return this.moveWindowTo(0);
  }

  /** Moves the visible window to the final full window of the document. */
  moveToDocumentEnd() {
    return this.moveWindowTo(this.getLength());
  }

  resizeWindow(size) {
    this.#window.resizeWindow(size);
    return this;
  }

  getWindowInfo() {
    return this.#window.snapshot();
  }

  getWindowStart() {
    return this.#window.getWindowStart();
  }

  getWindowEnd() {
    return this.#window.getWindowEnd();
  }

  getWindowSize() {
    return this.#window.getWindowSize();
  }

  canMoveToPreviousWindow() {
    return this.getWindowStart() > 0;
  }

  canMoveToNextWindow() {
    return this.getWindowEnd() < this.getLength();
  }

  localToGlobal(localOffset) {
    return this.#window.localToGlobal(localOffset);
  }

  globalToLocal(globalOffset) {
    return this.#window.globalToLocal(globalOffset);
  }

  // -------------------------------------------------------------------------
  // Document statistics
  // -------------------------------------------------------------------------

  getWordCount() {
    return this.#getDocumentMetrics().words;
  }

  getVisibleWordCount(visibleText = this.getVisibleText()) {
    return EditorDocument.#countWords(visibleText);
  }

  getLineCount() {
    return this.#getDocumentMetrics().lines;
  }

  getVisibleLineCount(visibleText = this.getVisibleText()) {
    return EditorDocument.#countLines(visibleText);
  }

  getVisibleStartLine() {
    return this.#lineNumberAtOffset(this.#window.getWindowStart());
  }

  getStats({ visibleText = null } = {}) {
    const metrics = this.#getDocumentMetrics();
    const window = this.getWindowInfo();
    const currentVisibleText = visibleText ?? this.getVisibleText();

    return {
      length: metrics.length,
      words: metrics.words,
      lines: metrics.lines,
      cursor: this.getCursor(),
      globalCursor: this.getGlobalCursor(),
      visibleLength: this.getVisibleLength(),
      visibleWords: this.getVisibleWordCount(currentVisibleText),
      visibleLines: this.getVisibleLineCount(currentVisibleText),
      visibleStartLine: this.getVisibleStartLine(),
      windowStart: window.windowStart,
      windowEnd: window.windowEnd,
      windowSize: window.windowSize,
      canMovePreviousWindow: this.canMoveToPreviousWindow(),
      canMoveNextWindow: this.canMoveToNextWindow()
    };
  }

  // -------------------------------------------------------------------------
  // Search API, currently full-document based
  // -------------------------------------------------------------------------

  find(query, from = 0) {
    EditorDocument.#assertString(query, "query");
    if (query === "") return -1;
    return this.getFullText().indexOf(query, EditorDocument.#offset(from, this.getLength()));
  }

  findNext(query) {
    return this.find(query, this.getGlobalCursor());
  }

  findAll(query) {
    EditorDocument.#assertString(query, "query");
    if (query === "") return [];

    const text = this.getFullText();
    const results = [];
    let index = text.indexOf(query);

    while (index !== -1) {
      results.push(index);
      index = text.indexOf(query, index + query.length);
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Debug API
  // -------------------------------------------------------------------------

  debugState({ visibleText = null, includeWindowText = true } = {}) {
    const window = this.#window.snapshot();

    if (includeWindowText) {
      window.text = visibleText ?? this.getVisibleText();
    }

    return {
      stats: this.getStats({ visibleText }),
      window,
      source: this.#window.debugState().buffer
    };
  }

  debugValidate() {
    return this.#window.validate();
  }

  #invalidateDocumentMetrics() {
    this.#documentMetrics = null;
  }

  #getDocumentMetrics() {
    if (this.#documentMetrics) {
      return this.#documentMetrics;
    }

    const text = this.getFullText();
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        lineStarts.push(index + 1);
      }
    }

    this.#documentMetrics = {
      length: text.length,
      words: EditorDocument.#countWords(text),
      lines: lineStarts.length,
      lineStarts
    };

    return this.#documentMetrics;
  }

  #lineNumberAtOffset(offset) {
    const { lineStarts } = this.#getDocumentMetrics();
    const safeOffset = EditorDocument.#offset(offset, this.getLength());

    let low = 0;
    let high = lineStarts.length - 1;
    let best = 0;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);

      if (lineStarts[middle] <= safeOffset) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return best + 1;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  static #countWords(text) {
    const trimmed = text.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  }

  static #countLines(text) {
    return text === "" ? 1 : text.split("\n").length;
  }

  static #offset(value, max) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("EditorDocument offset must be a finite number.");
    }

    return Math.max(0, Math.min(Math.trunc(value), max));
  }

  static #assertString(value, name) {
    if (typeof value !== "string") {
      throw new TypeError(`EditorDocument ${name} must be a string.`);
    }
  }
}
