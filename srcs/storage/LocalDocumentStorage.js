// srcs/storage/LocalDocumentStorage.js

/**
 * Small localStorage adapter for plain editor document text.
 *
 * Storage deliberately knows nothing about CircularGapBuffer or editor behavior.
 */
export default class LocalDocumentStorage {
  constructor(key = "circular-gap-buffer-document") {
    this.key = key;
  }

  saveText(text) {
    localStorage.setItem(this.key, String(text));
  }

  loadText() {
    return localStorage.getItem(this.key);
  }

  clear() {
    localStorage.removeItem(this.key);
  }

  // Backwards-compatible aliases for older project code.
  save(text) {
    this.saveText(text);
  }

  load() {
    return this.loadText();
  }
}
