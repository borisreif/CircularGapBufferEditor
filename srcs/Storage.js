// srcs/Storage.js

export default class Storage {
  constructor(key = "circular-gap-buffer-document") {
    this.key = key;
  }

  save(text) {
    localStorage.setItem(this.key, text);
  }

  load() {
    return localStorage.getItem(this.key);
  }

  clear() {
    localStorage.removeItem(this.key);
  }
}