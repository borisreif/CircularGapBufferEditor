// srcs/domain/BufferWindow.js

import CircularGapBuffer from "../CircularGapBuffer.js";

const DEFAULT_WINDOW_SIZE = 2500;
const MIN_BUFFER_CAPACITY = 16;

/**
 * BufferWindow is a generic sliding editing window over a larger text buffer.
 *
 * It owns the full `CircularGapBuffer`, but exposes only a linear window of that
 * buffer to its callers. The caller edits with window-local offsets; this class
 * translates those offsets into global offsets in the underlying buffer.
 *
 * The important memory model is:
 *
 *   CircularGapBuffer  stores the full text.
 *   BufferWindow       stores only start/size/cursor metadata.
 *   Textarea           stores only BufferWindow.toString().
 *
 * This class is intentionally not editor-specific. It knows nothing about DOM,
 * line numbers, saving, status bars, or textareas. It is a buffer-like facade.
 *
 * Coordinate model:
 *
 * - source/global offsets are offsets in the full backing buffer.
 * - local offsets are offsets inside the current window.
 * - all public editing methods use local offsets unless their name explicitly
 *   says `Window`, `Source`, `Global`, `localToGlobal`, or `globalToLocal`.
 */
export default class BufferWindow {
  #buffer;
  #start;
  #size;
  #cursor;

  /**
   * Creates a new buffer window and initializes the hidden backing buffer.
   *
   * @param {string} initialText - Full source text stored in the backing buffer.
   * @param {object} options
   * @param {number} [options.start=0] - Initial global source offset of the window.
   * @param {number} [options.size=4000] - Preferred maximum visible window size.
   * @param {number} [options.cursor=0] - Initial local cursor offset in the window.
   */
  constructor(
    initialText = "",
    { start = 0, size = DEFAULT_WINDOW_SIZE, cursor = 0 } = {}
  ) {
    BufferWindow.#assertString(initialText, "initialText");

    this.#buffer = new CircularGapBuffer(
      Math.max(MIN_BUFFER_CAPACITY, initialText.length * 2)
    );
    this.#buffer.insert(initialText);

    this.#size = BufferWindow.#toPositiveInteger(size, DEFAULT_WINDOW_SIZE);
    this.#start = this.#clampWindowStart(start);
    this.#cursor = this.#clampLocalOffset(cursor);

    this.#syncSourceCursor();
  }

  // -------------------------------------------------------------------------
  // Buffer-like API, using window-local offsets
  // -------------------------------------------------------------------------

  /**
   * Inserts text at the current local cursor and moves the cursor after it.
   *
   * @param {string} text
   * @returns {object} Edit result metadata.
   */
  insert(text) {
    BufferWindow.#assertString(text, "text");

    if (text.length === 0) {
      return this.#editResult({ insertedLength: 0, removedLength: 0 });
    }

    const localCursor = this.#cursor;
    const globalCursor = this.localToGlobal(localCursor);

    this.#buffer.moveCursor(globalCursor);
    this.#buffer.insert(text);

    this.#setGlobalCursor(globalCursor + text.length);

    return this.#editResult({
      insertedLength: text.length,
      removedLength: 0,
      localStart: localCursor,
      localEnd: localCursor,
      globalStart: globalCursor,
      globalEnd: globalCursor
    });
  }

  /**
   * Replaces a local window range with text.
   *
   * @param {number} start - Local start offset, inclusive.
   * @param {number} end - Local end offset, exclusive.
   * @param {string} text - Replacement text.
   * @returns {object} Edit result metadata.
   */
  replaceRange(start, end, text) {
    BufferWindow.#assertString(text, "text");

    const range = this.#localRange(start, end);
    const globalStart = this.localToGlobal(range.start);
    const globalEnd = this.localToGlobal(range.end);
    const removedLength = globalEnd - globalStart;

    this.#buffer.deleteRange(globalStart, globalEnd);
    this.#buffer.moveCursor(globalStart);
    this.#buffer.insert(text);

    this.#start = this.#clampWindowStart(this.#start);
    this.#setGlobalCursor(globalStart + text.length);

    return this.#editResult({
      insertedLength: text.length,
      removedLength,
      localStart: range.start,
      localEnd: range.end,
      globalStart,
      globalEnd
    });
  }

  /**
   * Deletes a local window range.
   *
   * @param {number} start - Local start offset, inclusive.
   * @param {number} end - Local end offset, exclusive.
   * @returns {object} Edit result metadata.
   */
  deleteRange(start, end) {
    return this.replaceRange(start, end, "");
  }

  /**
   * Deletes one UTF-16 code unit before the cursor, even across window edges.
   *
   * Higher-level grapheme-aware deletion should be implemented above this class.
   *
   * @returns {object} Edit result metadata.
   */
  backspace() {
    const globalCursor = this.getGlobalCursor();

    if (globalCursor <= 0) {
      return this.#editResult({ insertedLength: 0, removedLength: 0 });
    }

    this.#buffer.deleteRange(globalCursor - 1, globalCursor);
    this.#start = this.#clampWindowStart(this.#start);
    this.#setGlobalCursor(globalCursor - 1);

    return this.#editResult({ insertedLength: 0, removedLength: 1 });
  }

  /**
   * Deletes one UTF-16 code unit after the cursor, even across window edges.
   *
   * Higher-level grapheme-aware deletion should be implemented above this class.
   *
   * @returns {object} Edit result metadata.
   */
  deleteForward() {
    const globalCursor = this.getGlobalCursor();

    if (globalCursor >= this.getSourceLength()) {
      return this.#editResult({ insertedLength: 0, removedLength: 0 });
    }

    this.#buffer.deleteRange(globalCursor, globalCursor + 1);
    this.#start = this.#clampWindowStart(this.#start);
    this.#setGlobalCursor(globalCursor);

    return this.#editResult({ insertedLength: 0, removedLength: 1 });
  }

  /**
   * Moves the cursor to a local window offset.
   *
   * @param {number} position - Local window offset.
   * @returns {BufferWindow} This instance.
   */
  moveCursor(position) {
    this.#cursor = this.#clampLocalOffset(position);
    this.#syncSourceCursor();
    return this;
  }

  /** @returns {number} Local cursor offset inside the current window. */
  getCursor() {
    return this.#cursor;
  }

  /** @returns {number} Global cursor offset inside the full source buffer. */
  getGlobalCursor() {
    return this.localToGlobal(this.#cursor);
  }

  /** @returns {number} Length of the currently exposed window text. */
  getLength() {
    return this.getWindowEnd() - this.getWindowStart();
  }

  /** @returns {boolean} Whether the current window text is empty. */
  get isEmpty() {
    return this.getLength() === 0;
  }

  /** @returns {string} Text in the current window only. */
  getText() {
    return this.#buffer.toString().slice(this.getWindowStart(), this.getWindowEnd());
  }

  /** @returns {string} Text in the current window only. */
  toString() {
    return this.getText();
  }

  // -------------------------------------------------------------------------
  // Source/full-buffer API
  // -------------------------------------------------------------------------

  /** @returns {string} Full source text stored in the backing buffer. */
  getSourceText() {
    return this.#buffer.toString();
  }

  /** @returns {number} Full source text length. */
  getSourceLength() {
    return this.#buffer.length;
  }

  /**
   * Replaces the entire backing buffer and resets the window.
   *
   * @param {string} text - New full source text.
   * @returns {BufferWindow} This instance.
   */
  setSourceText(text) {
    BufferWindow.#assertString(text, "text");

    this.#buffer.setText(text);
    this.#start = this.#clampWindowStart(0);
    this.#cursor = 0;
    this.#syncSourceCursor();

    return this;
  }

  // -------------------------------------------------------------------------
  // Window-specific API
  // -------------------------------------------------------------------------

  /** @returns {number} Global source offset where the window starts. */
  getWindowStart() {
    return this.#start;
  }

  /** @returns {number} Global source offset immediately after the window. */
  getWindowEnd() {
    return Math.min(this.#start + this.#size, this.getSourceLength());
  }

  /** @returns {number} Preferred maximum window size. */
  getWindowSize() {
    return this.#size;
  }

  /**
   * Moves the window to a global source offset. The cursor remains local and is
   * clamped if the new window is shorter.
   *
   * @param {number} globalStart
   * @returns {BufferWindow} This instance.
   */
  moveWindowTo(globalStart) {
    this.#start = this.#clampWindowStart(globalStart);
    this.#cursor = this.#clampLocalOffset(this.#cursor);
    this.#syncSourceCursor();
    return this;
  }

  /**
   * Moves the window by a number of global source offsets.
   *
   * @param {number} delta
   * @returns {BufferWindow} This instance.
   */
  moveWindowBy(delta) {
    return this.moveWindowTo(this.#start + BufferWindow.#toInteger(delta));
  }

  /**
   * Changes the preferred maximum window size.
   *
   * @param {number} size
   * @returns {BufferWindow} This instance.
   */
  resizeWindow(size) {
    this.#size = BufferWindow.#toPositiveInteger(size, DEFAULT_WINDOW_SIZE);
    this.#start = this.#clampWindowStart(this.#start);
    this.#cursor = this.#clampLocalOffset(this.#cursor);
    this.#syncSourceCursor();
    return this;
  }

  /**
   * Makes the window contain the current global cursor position.
   *
   * @returns {BufferWindow} This instance.
   */
  ensureCursorVisible() {
    this.#ensureGlobalOffsetVisible(this.getGlobalCursor());
    this.#cursor = this.globalToLocal(this.getGlobalCursor());
    this.#syncSourceCursor();
    return this;
  }

  // -------------------------------------------------------------------------
  // Mapping API
  // -------------------------------------------------------------------------

  /**
   * Converts a local window offset to a global source offset.
   *
   * @param {number} localOffset
   * @returns {number}
   */
  localToGlobal(localOffset) {
    return this.#start + this.#clampLocalOffset(localOffset);
  }

  /**
   * Converts a global source offset to a local window offset. Values outside the
   * current window are clamped to the nearest local edge.
   *
   * @param {number} globalOffset
   * @returns {number}
   */
  globalToLocal(globalOffset) {
    return this.#clampLocalOffset(BufferWindow.#toInteger(globalOffset) - this.#start);
  }

  /**
   * @param {number} globalOffset
   * @returns {boolean} Whether the global offset is inside the current window.
   */
  containsGlobalOffset(globalOffset) {
    const offset = BufferWindow.#toInteger(globalOffset);
    return offset >= this.getWindowStart() && offset <= this.getWindowEnd();
  }

  // -------------------------------------------------------------------------
  // Debug / inspection API
  // -------------------------------------------------------------------------

  /**
   * Returns serializable state useful for status and debug displays.
   *
   * @param {object} options
   * @param {boolean} [options.includeText=false] - Include current window text.
   * @param {boolean} [options.includeSourceText=false] - Include full source text.
   * @returns {object}
   */
  snapshot({ includeText = false, includeSourceText = false } = {}) {
    const state = {
      windowStart: this.getWindowStart(),
      windowEnd: this.getWindowEnd(),
      windowSize: this.getWindowSize(),
      windowLength: this.getLength(),
      sourceLength: this.getSourceLength(),
      localCursor: this.getCursor(),
      globalCursor: this.getGlobalCursor()
    };

    if (includeText) {
      state.text = this.getText();
    }

    if (includeSourceText) {
      state.sourceText = this.getSourceText();
    }

    return state;
  }

  /**
   * Returns combined window and backing-buffer debug information.
   *
   * By default this method deliberately returns a compact backing-buffer summary.
   * Calling CircularGapBuffer.debugSnapshot() on a large document is expensive:
   * it materializes the full text, copies the full internal array, and builds a
   * logical-to-physical index table. That is useful for small learning examples,
   * but it is much too heavy for every UI render.
   *
   * @param {object} options
   * @param {boolean} [options.includeText=false] - Include current window text.
   * @param {boolean} [options.includeSourceText=false] - Include full source text.
   * @param {boolean} [options.includeBackingBuffer=false] - Include the full
   *   CircularGapBuffer debug snapshot. Use only for small documents/manual tests.
   * @returns {object}
   */
  debugState({
    includeText = false,
    includeSourceText = false,
    includeBackingBuffer = false
  } = {}) {
    const bufferSummary = {
      length: this.#buffer.length,
      cursor: this.#buffer.cursor,
      capacity: this.#buffer.capacity,
      isEmpty: this.#buffer.isEmpty
    };

    return {
      ...this.snapshot({ includeText, includeSourceText }),
      buffer: includeBackingBuffer && this.#buffer.debugSnapshot
        ? this.#buffer.debugSnapshot()
        : bufferSummary
    };
  }

  /**
   * Checks local window invariants and delegates deeper validation to the buffer.
   *
   * @returns {boolean}
   */
  validate() {
    const sourceLength = this.getSourceLength();
    const localInvariantsHold =
      this.#start >= 0 &&
      this.#start <= sourceLength &&
      this.getWindowEnd() >= this.#start &&
      this.getWindowEnd() <= sourceLength &&
      this.#cursor >= 0 &&
      this.#cursor <= this.getLength();

    this.#buffer.debugValidate?.();
    return localInvariantsHold;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  #setGlobalCursor(globalCursor) {
    const cursor = this.#clampGlobalOffset(globalCursor);
    this.#ensureGlobalOffsetVisible(cursor);
    this.#cursor = this.globalToLocal(cursor);
    this.#syncSourceCursor();
  }

  #syncSourceCursor() {
    this.#buffer.moveCursor(this.getGlobalCursor());
  }

  #ensureGlobalOffsetVisible(globalOffset) {
    const offset = this.#clampGlobalOffset(globalOffset);

    if (offset < this.getWindowStart()) {
      this.#start = this.#clampWindowStart(offset);
      return;
    }

    if (offset > this.getWindowEnd()) {
      this.#start = this.#clampWindowStart(offset - this.#size);
    }
  }

  #clampWindowStart(start) {
    const sourceLength = this.getSourceLength();
    const maxStart = Math.max(0, sourceLength - this.#size);
    return BufferWindow.#clamp(BufferWindow.#toInteger(start), 0, maxStart);
  }

  #clampLocalOffset(offset) {
    return BufferWindow.#clamp(BufferWindow.#toInteger(offset), 0, this.getLength());
  }

  #clampGlobalOffset(offset) {
    return BufferWindow.#clamp(BufferWindow.#toInteger(offset), 0, this.getSourceLength());
  }

  #localRange(start, end) {
    const safeStart = this.#clampLocalOffset(start);
    const safeEnd = this.#clampLocalOffset(end);

    return {
      start: Math.min(safeStart, safeEnd),
      end: Math.max(safeStart, safeEnd)
    };
  }

  #editResult({
    insertedLength,
    removedLength,
    localStart = this.#cursor,
    localEnd = this.#cursor,
    globalStart = this.getGlobalCursor(),
    globalEnd = this.getGlobalCursor()
  }) {
    const delta = insertedLength - removedLength;

    return {
      insertedLength,
      removedLength,
      delta,
      localStart,
      localEnd,
      globalStart,
      globalEnd,
      localCursor: this.getCursor(),
      globalCursor: this.getGlobalCursor(),
      windowStart: this.getWindowStart(),
      windowEnd: this.getWindowEnd(),
      windowText: this.getText()
    };
  }

  static #assertString(value, name) {
    if (typeof value !== "string") {
      throw new TypeError(`BufferWindow ${name} must be a string.`);
    }
  }

  static #toInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : 0;
  }

  static #toPositiveInteger(value, fallback) {
    const integer = BufferWindow.#toInteger(value);
    return integer > 0 ? integer : fallback;
  }

  static #clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
}
