// src/EditorModel.js
import GapBuffer from "./CircularGapBuffer.js";

export default class EditorModel {
  // editor logic
      constructor(initialText = "") {
        this.buffer = new GapBuffer(Math.max(16, initialText.length * 2));
        this.buffer.insert(initialText);
      }

      getText() {
        return this.buffer.toString();
      }

      getCursor() {
        return this.buffer.cursor;
      }

      getLength() {
        return this.buffer.length;
      }

      moveCursor(position) {
        this.buffer.moveCursor(position);
      }

      insertText(text) {
        this.buffer.insert(text);
      }

      replaceRange(start, end, text) {
        this.buffer.deleteRange(start, end);
        this.buffer.insert(text);
      }

      backspace() {
        this.buffer.backspace();
      }

      deleteForward() {
        this.buffer.delete();
      }

      deleteRange(start, end) {
        this.buffer.deleteRange(start, end);
      }

      debugState() {
        return {
          textLength: this.buffer.length,
          internalBufferLength: this.buffer.buffer.length,
          cursor: this.buffer.cursor,
          gapStart: this.buffer.gapStart,
          gapEnd: this.buffer.gapEnd,
          gapSize: this.buffer.gapSize,
          buffer: this.buffer.buffer.map(value => value === null ? "·" : value).join(" ")
        };
      }
}