// src/EditorModel.js

import GapBuffer from "./GapBuffer.js";

/**
 * EditorModel contains the text-editing logic.
 *
 * It wraps the lower-level GapBuffer and exposes editor-style operations.
 */
export default class EditorModel {
  /**
   * Creates a new editor model.
   *
   * @param {string} [initialText=""] - Initial text content.
   */
  constructor(initialText = "") {
    this.buffer = new GapBuffer(Math.max(16, initialText.length * 2));
    this.buffer.insert(initialText);
  }

  /**
   * Returns the full editor text.
   *
   * @returns {string} The current text.
   */
  getText() {
    return this.buffer.toString();
  }

  /**
   * Returns the current cursor position.
   *
   * @returns {number} The cursor index.
   */
  getCursor() {
    return this.buffer.cursor;
  }

  /**
   * Returns the current text length.
   *
   * @returns {number} The number of characters in the editor.
   */
  getLength() {
    return this.buffer.length;
  }

  /**
   * Moves the cursor to a new position.
   *
   * @param {number} position - New cursor position.
   * @returns {void}
   */
  moveCursor(position) {
    this.buffer.moveCursor(position);
  }

  /**
   * Inserts text at the current cursor position.
   *
   * @param {string} text - Text to insert.
   * @returns {void}
   */
  insertText(text) {
    this.buffer.insert(text);
  }

  /**
   * Replaces the text in the range [start, end) with new text.
   *
   * @param {number} start - Start index of the replacement range.
   * @param {number} end - End index of the replacement range.
   * @param {string} text - Replacement text.
   * @returns {void}
   */
  replaceRange(start, end, text) {
    this.buffer.deleteRange(start, end);
    this.buffer.insert(text);
  }

  /**
   * Deletes the character before the cursor.
   *
   * @returns {void}
   */
  backspace() {
    this.buffer.backspace();
  }

  /**
   * Deletes the character after the cursor.
   *
   * @returns {void}
   */
  deleteForward() {
    this.buffer.deleteForward();
  }

  /**
   * Deletes the text in the range [start, end).
   *
   * @param {number} start - Start index of the range.
   * @param {number} end - End index of the range.
   * @returns {void}
   */
  deleteRange(start, end) {
    this.buffer.deleteRange(start, end);
  }

  /**
   * Returns debugging information about the editor and gap buffer.
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
    const snapshot = this.buffer.snapshot();

    return {
      textLength: snapshot.length,
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
}