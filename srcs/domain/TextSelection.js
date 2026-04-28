// srcs/domain/TextSelection.js

/**
 * Immutable selection range measured in UTF-16 code units.
 *
 * The editor deliberately uses the same offset model as JavaScript strings and
 * HTMLTextAreaElement.selectionStart / selectionEnd. User-perceived character
 * boundaries, such as emoji and combined accents, are handled separately in
 * TextBoundaries.js.
 */
export default class TextSelection {
  constructor(start = 0, end = start) {
    this.start = TextSelection.#toOffset(start, "start");
    this.end = TextSelection.#toOffset(end, "end");
    Object.freeze(this);
  }

  static collapsed(position = 0) {
    return new TextSelection(position, position);
  }

  static from(value) {
    if (value instanceof TextSelection) {
      return value;
    }

    if (value && typeof value === "object") {
      return new TextSelection(value.start, value.end ?? value.start);
    }

    return TextSelection.collapsed(value ?? 0);
  }

  get isCollapsed() {
    return this.start === this.end;
  }

  get length() {
    return Math.abs(this.end - this.start);
  }

  get anchor() {
    return this.start;
  }

  get focus() {
    return this.end;
  }

  get normalizedStart() {
    return Math.min(this.start, this.end);
  }

  get normalizedEnd() {
    return Math.max(this.start, this.end);
  }

  normalize() {
    return new TextSelection(this.normalizedStart, this.normalizedEnd);
  }

  clamp(textLength) {
    const length = TextSelection.#toOffset(textLength, "textLength");
    return new TextSelection(
      TextSelection.#clamp(this.start, 0, length),
      TextSelection.#clamp(this.end, 0, length)
    );
  }

  collapseToStart() {
    return TextSelection.collapsed(this.normalizedStart);
  }

  collapseToEnd() {
    return TextSelection.collapsed(this.normalizedEnd);
  }

  toJSON() {
    return {
      start: this.start,
      end: this.end,
      isCollapsed: this.isCollapsed
    };
  }

  static #toOffset(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`TextSelection ${name} must be a finite number.`);
    }

    return Math.trunc(value);
  }

  static #clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
}
