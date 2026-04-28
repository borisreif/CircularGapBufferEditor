// srcs/domain/EditorDocument.js

import CircularGapBuffer from "../CircularGapBuffer.js";
import TextSelection from "./TextSelection.js";

const MIN_INITIAL_CAPACITY = 16;

/**
 * EditorDocument is the editor-shaped text model.
 *
 * It is the only application layer that knows about CircularGapBuffer. UI code,
 * storage code, and presenter code should use this document API instead of
 * reaching into the buffer directly.
 */
export default class EditorDocument {
  #buffer;

  constructor(initialText = "") {
    EditorDocument.#assertString(initialText, "initialText");

    this.#buffer = new CircularGapBuffer(
      Math.max(MIN_INITIAL_CAPACITY, initialText.length * 2)
    );
    this.#buffer.insert(initialText);
  }

  getText() {
    return this.#buffer.toString();
  }

  setText(text) {
    EditorDocument.#assertString(text, "text");
    this.#buffer.setText(text);
    return this;
  }

  getCursor() {
    return this.#buffer.cursor;
  }

  getLength() {
    return this.#buffer.length;
  }

  isEmpty() {
    return this.getLength() === 0;
  }

  moveCursor(position) {
    this.#buffer.moveCursor(position);
    return this.getCursor();
  }

  insertText(text) {
    EditorDocument.#assertString(text, "text");
    this.#buffer.insert(text);
    return this.getCursor();
  }

  replaceRange(start, end, text) {
    EditorDocument.#assertString(text, "text");

    const range = this.#range(start, end);
    this.#buffer.deleteRange(range.start, range.end);
    this.#buffer.insert(text);

    return new TextSelection(this.getCursor(), this.getCursor());
  }

  deleteRange(start, end) {
    const range = this.#range(start, end);
    return this.#buffer.deleteRange(range.start, range.end);
  }

  backspace() {
    return this.#buffer.backspace();
  }

  deleteForward() {
    return this.#buffer.deleteForward();
  }

  getWordCount() {
    const text = this.getText().trim();
    return text === "" ? 0 : text.split(/\s+/).length;
  }

  getLineCount() {
    const text = this.getText();
    return text === "" ? 1 : text.split("\n").length;
  }

  getStats() {
    return {
      length: this.getLength(),
      words: this.getWordCount(),
      lines: this.getLineCount(),
      cursor: this.getCursor()
    };
  }

  find(query, from = 0) {
    EditorDocument.#assertString(query, "query");
    if (query === "") return -1;
    return this.getText().indexOf(query, this.#offset(from));
  }

  findNext(query) {
    return this.find(query, this.getCursor());
  }

  findNextAndMoveCursor(query) {
    const index = this.findNext(query);

    if (index !== -1) {
      this.moveCursor(index);
    }

    return index;
  }

  findAll(query) {
    EditorDocument.#assertString(query, "query");
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

  debugState() {
    const snapshot = this.#buffer.debugSnapshot();

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

  debugValidate() {
    this.#buffer.debugValidate();
  }

  #range(start, end) {
    return new TextSelection(start, end).normalize().clamp(this.getLength());
  }

  #offset(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError("Text offset must be a finite number.");
    }

    return Math.max(0, Math.min(Math.trunc(value), this.getLength()));
  }

  static #assertString(value, name) {
    if (typeof value !== "string") {
      throw new TypeError(`EditorDocument ${name} must be a string.`);
    }
  }
}
