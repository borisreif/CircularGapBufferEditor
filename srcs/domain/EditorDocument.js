// srcs/domain/EditorDocument.js

import BufferWindow from "./BufferWindow.js";

const DEFAULT_WINDOW_SIZE = 2000;

/**
 * EditorDocument is the editor-shaped model above BufferWindow.
 *
 * Responsibilities:
 *
 * - Own the `BufferWindow`.
 * - Expose document/editor vocabulary to the presenter and viewport.
 * - Keep the circular gap buffer hidden behind BufferWindow.
 * - Provide line/offset helpers for editor-specific windowing policies.
 * - Provide stats and compact debug information.
 *
 * Layering:
 *
 *   CircularGapBuffer  generic full text storage
 *   BufferWindow       generic offset window over that storage
 *   EditorDocument     editor/document semantics: lines, words, stats
 *
 * Important distinction:
 *
 * - `getText()` / `getFullText()` return the full document text.
 * - `getVisibleText()` returns only the current window text shown in the textarea.
 * - Cursor and selection methods use visible/window-local offsets, because the
 *   textarea also uses local offsets.
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

  /** Alias used by EditorViewport to make the distinction explicit. */
  getFullLength() {
    return this.getLength();
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
   * Sets the exact visible source range by global offsets.
   *
   * This is the method used by line-window mode. BufferWindow remains generic
   * and offset-based; EditorDocument decides which offsets correspond to lines.
   *
   * @param {number} startOffset - Global source offset, inclusive.
   * @param {number} endOffset - Global source offset, exclusive.
   * @returns {EditorDocument} This instance.
   */
  setWindowRange(startOffset, endOffset) {
    const length = this.getLength();
    const safeStart = EditorDocument.#offset(startOffset, length);
    const safeEnd = EditorDocument.#offset(endOffset, length);

    this.#window.setWindowRange(
      Math.min(safeStart, safeEnd),
      Math.max(safeStart, safeEnd)
    );

    return this;
  }

  /** Moves the visible window one full character-window-size step backward. */
  moveToPreviousWindow() {
    return this.moveWindowBy(-this.getWindowSize());
  }

  /** Moves the visible window one full character-window-size step forward. */
  moveToNextWindow() {
    return this.moveWindowBy(this.getWindowSize());
  }

  /** Moves the visible window to the start of the document. */
  moveToDocumentStart() {
    return this.moveWindowTo(0);
  }

  /** Moves the visible window to the final full character window of the document. */
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
  // Line and offset API
  // -------------------------------------------------------------------------

  getLineCount() {
    return this.#getDocumentMetrics().lines;
  }

  /**
   * Returns the one-based logical line number containing a global offset.
   *
   * A logical line is text between hard `\n` characters. Soft wrapping in the
   * textarea is deliberately ignored here.
   */
  getLineNumberAtOffset(offset) {
    return this.#lineNumberAtOffset(offset);
  }

  /** Returns the global offset where a one-based logical line starts. */
  getLineStartOffset(lineNumber) {
    const { lineStarts } = this.#getDocumentMetrics();
    const index = this.#lineIndex(lineNumber);
    return lineStarts[index];
  }

  /**
   * Returns the global offset where a logical line ends.
   *
   * By default the returned offset excludes the line-break character. This makes
   * a range of N logical lines contain exactly N logical lines when displayed in
   * the textarea, instead of adding an extra empty line after the final `\n`.
   */
  getLineEndOffset(lineNumber, { includeLineBreak = false } = {}) {
    const { lineStarts, length } = this.#getDocumentMetrics();
    const index = this.#lineIndex(lineNumber);
    const nextStart = lineStarts[index + 1];

    if (nextStart === undefined) {
      return length;
    }

    return includeLineBreak ? nextStart : Math.max(lineStarts[index], nextStart - 1);
  }

  /**
   * Returns the global offset range containing `lineCount` logical lines.
   *
   * Line numbers are one-based. The returned `endOffset` excludes the final
   * selected line's line-break character so the visible line count remains stable.
   */
  getOffsetRangeForLines(startLine, lineCount) {
    const totalLines = this.getLineCount();
    const count = Math.max(1, EditorDocument.#toInteger(lineCount));
    const safeStartLine = EditorDocument.#clamp(
      EditorDocument.#toInteger(startLine),
      1,
      totalLines
    );
    const endLine = Math.min(totalLines, safeStartLine + count - 1);

    return {
      startLine: safeStartLine,
      endLine,
      lineCount: endLine - safeStartLine + 1,
      startOffset: this.getLineStartOffset(safeStartLine),
      endOffset: this.getLineEndOffset(endLine)
    };
  }

  getVisibleStartLine() {
    return this.#lineNumberAtOffset(this.#window.getWindowStart());
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

  getVisibleLineCount(visibleText = this.getVisibleText()) {
    return EditorDocument.#countLines(visibleText);
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

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

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

  #lineIndex(lineNumber) {
    const { lineStarts } = this.#getDocumentMetrics();
    return EditorDocument.#clamp(
      EditorDocument.#toInteger(lineNumber) - 1,
      0,
      lineStarts.length - 1
    );
  }

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

    return EditorDocument.#clamp(Math.trunc(value), 0, max);
  }

  static #toInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : 0;
  }

  static #clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  static #assertString(value, name) {
    if (typeof value !== "string") {
      throw new TypeError(`EditorDocument ${name} must be a string.`);
    }
  }
}
