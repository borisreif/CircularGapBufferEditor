// srcs/EditorModel.js

import CircularGapBuffer from "./CircularGapBuffer.js";

/**
 * EditorModel contains text-editing logic.
 *
 * It is the only layer that talks directly to CircularGapBuffer. The view should
 * use this editor-shaped API instead of reaching into buffer internals.
 */
export default class EditorModel {
  /**
   * @param {string} [initialText=""] Initial editor contents.
   */
  constructor(initialText = "") {
    if (typeof initialText !== "string") {
      throw new TypeError("EditorModel expects initialText to be a string.");
    }

    this.buffer = new CircularGapBuffer(Math.max(16, initialText.length * 2));
    this.buffer.insert(initialText);
  }

  /** @returns {string} The full editor text. */
  getText() {
    return this.buffer.toString();
  }

  /** @returns {number} The cursor offset in UTF-16 code units. */
  getCursor() {
    return this.buffer.cursor;
  }

  /** @returns {number} The current text length in UTF-16 code units. */
  getLength() {
    return this.buffer.length;
  }

  /**
   * Returns the number of words in the editor.
   *
   * Words are counted as non-whitespace sequences.
   *
   * @returns {number} The word count.
   */
  getWordCount() {
    const text = this.getText().trim();
    if (text === "") return 0;
    return text.split(/\s+/).length;
  }

  /**
   * Returns the number of lines in the editor.
   *
   * An empty editor is treated as having 1 line,
   * like most text editors.
   *
   * @returns {number} The line count.
   */
  getLineCount() {
    const text = this.getText();
    if (text === "") return 1;
    return text.split("\n").length;
  }

  /**
   * Moves the cursor to a new offset.
   *
   * @param {number} position New cursor offset.
   */
  moveCursor(position) {
    this.buffer.moveCursor(position);
  }

  /**
   * Inserts text at the current cursor position.
   *
   * @param {string} text Text to insert.
   */
  insertText(text) {
    this.buffer.insert(text);
  }

  /**
   * Replaces the text in [start, end) with new text.
   *
   * @param {number} start Start offset.
   * @param {number} end End offset.
   * @param {string} text Replacement text.
   */
  replaceRange(start, end, text) {
    this.buffer.deleteRange(start, end);
    this.buffer.insert(text);
  }

  /** Deletes the character before the cursor. */
  backspace() {
    this.buffer.backspace();
  }

  /** Deletes the character after the cursor. */
  deleteForward() {
    this.buffer.deleteForward();
  }

  /**
   * Deletes the text in [start, end).
   *
   * @param {number} start Start offset.
   * @param {number} end End offset.
   */
  deleteRange(start, end) {
    this.buffer.deleteRange(start, end);
  }

  /**
   * Replaces the full document contents.
   *
   * @param {string} text New text.
   */
  setText(text) {
    this.buffer.setText(text);
  }

  /**
   * Finds the first occurrence of a query string.
   *
   * @param {string} query - Text to search for.
   * @param {number} [from=0] - Position to start searching from.
   * @returns {number} The index of the match, or -1 if not found.
   */
  find(query, from = 0) {
    if (query === "") return -1;
    return this.getText().indexOf(query, from);
  }

  /**
   * Finds the next occurrence of a query after the current cursor.
   *
   * @param {string} query - Text to search for.
   * @returns {number} The index of the next match, or -1 if not found.
   */
  findNext(query) {
    if (query === "") return -1;
    return this.getText().indexOf(query, this.getCursor());
  }

  /**
   * Finds the next occurrence of a query and moves the cursor there.
   *
   * @param {string} query - Text to search for.
   * @returns {number} The index of the match, or -1 if not found.
   */
  findNextAndMoveCursor(query) {
    const index = this.findNext(query);
    
    if (index !== -1) {
      this.moveCursor(index);
    }
    
    return index;
  }

  /**
   * Finds all occurrences of a query string.
   *
   * @param {string} query - Text to search for.
   * @returns {number[]} Array of starting indexes for all matches.
   */
  findAll(query) {
    if (query === "") return [];
    
    const text = this.getText();
    const results = [];
    
    let index = text.indexOf(query);
    
    while (index !== -1) {
      results.push(index);
      index = text.indexOf(query, index + query.length);
    }
    
    return results;
  }

  /**
   * Returns debugging information about the editor and circular gap buffer.
   *
   * @returns {{
   *   textLength: number,
   *   internalBufferLength: number,
   *   cursor: number,
   *   gapStart: number,
   *   gapEnd: number,
   *   gapSize: number,
   *   buffer: string
   * }} Debugging state.
   */
  debugState() {
    const snapshot = this.buffer.debugSnapshot();

    return {
      textLength: snapshot.length,
      wordCount: this.getWordCount(),
      lineCount: this.getLineCount(),
      internalBufferLength: snapshot.capacity,
      cursor: snapshot.cursor,
      gapStart: snapshot.gapStart,
      gapEnd: snapshot.gapEnd,
      gapSize: snapshot.gapSize,
      buffer: snapshot.buffer
        .map(value => value === null ? "·" : value)
        .join(" ")
    };
  }

  /** Throws if the underlying buffer invariant is broken. Useful while testing. */
  debugValidate() {
    this.buffer.debugValidate();
  }
}