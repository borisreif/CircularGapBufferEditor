// srcs/domain/EditorViewport.js

const DEFAULT_MODE = "lines";
const DEFAULT_LINES_PER_WINDOW = 50;
const DEFAULT_CHARACTERS_PER_WINDOW = 4000;

/**
 * EditorViewport chooses which part of an EditorDocument should be exposed.
 *
 * This class is deliberately editor-specific. The generic structures below it
 * (`CircularGapBuffer` and `BufferWindow`) know only about offsets. The viewport
 * is where editor preferences such as "show 50 logical lines" or "show 4000
 * characters" are translated into concrete document offset ranges.
 */
export default class EditorViewport {
  #document;
  #mode;
  #linesPerWindow;
  #charactersPerWindow;
  #startLine;
  #startOffset;

  constructor(document, config = {}) {
    if (!document) {
      throw new Error("EditorViewport requires an EditorDocument.");
    }

    this.#document = document;
    this.#mode = EditorViewport.#normalizeMode(config.mode ?? DEFAULT_MODE);
    this.#linesPerWindow = EditorViewport.#positiveInteger(
      config.linesPerWindow,
      DEFAULT_LINES_PER_WINDOW
    );
    this.#charactersPerWindow = EditorViewport.#positiveInteger(
      config.charactersPerWindow,
      DEFAULT_CHARACTERS_PER_WINDOW
    );
    this.#startLine = 1;
    this.#startOffset = 0;
  }

  /** Applies the current viewport policy to the document's BufferWindow. */
  apply() {
    if (this.#mode === "lines") {
      this.#applyLineWindow();
      return this;
    }

    this.#applyCharacterWindow();
    return this;
  }

  /** Reapplies the current policy after text changed. */
  refresh() {
    if (this.#mode === "characters") {
      this.#startOffset = this.#document.getWindowStart();
    }

    return this.apply();
  }

  nextWindow() {
    if (this.#mode === "lines") {
      this.#startLine += this.#linesPerWindow;
    } else {
      this.#startOffset += this.#charactersPerWindow;
    }

    return this.apply();
  }

  previousWindow() {
    if (this.#mode === "lines") {
      this.#startLine -= this.#linesPerWindow;
    } else {
      this.#startOffset -= this.#charactersPerWindow;
    }

    return this.apply();
  }

  firstWindow() {
    this.#startLine = 1;
    this.#startOffset = 0;
    return this.apply();
  }

  lastWindow() {
    if (this.#mode === "lines") {
      this.#startLine = Math.max(
        1,
        this.#document.getLineCount() - this.#linesPerWindow + 1
      );
    } else {
      this.#startOffset = Math.max(
        0,
        this.#document.getFullLength() - this.#charactersPerWindow
      );
    }

    return this.apply();
  }

  setMode(mode) {
    const nextMode = EditorViewport.#normalizeMode(mode);

    if (nextMode === this.#mode) {
      return this;
    }

    // Preserve the user's approximate position when switching modes.
    const currentWindowStart = this.#document.getWindowStart();
    this.#mode = nextMode;
    this.#startOffset = currentWindowStart;
    this.#startLine = this.#document.getLineNumberAtOffset(currentWindowStart);

    return this.apply();
  }

  setLinesPerWindow(linesPerWindow) {
    this.#linesPerWindow = EditorViewport.#positiveInteger(
      linesPerWindow,
      DEFAULT_LINES_PER_WINDOW
    );
    return this.apply();
  }

  setCharactersPerWindow(charactersPerWindow) {
    this.#charactersPerWindow = EditorViewport.#positiveInteger(
      charactersPerWindow,
      DEFAULT_CHARACTERS_PER_WINDOW
    );
    return this.apply();
  }

  getInfo() {
    return {
      mode: this.#mode,
      startLine: this.#startLine,
      linesPerWindow: this.#linesPerWindow,
      startOffset: this.#document.getWindowStart(),
      endOffset: this.#document.getWindowEnd(),
      charactersPerWindow: this.#charactersPerWindow
    };
  }

  #applyCharacterWindow() {
    const sourceLength = this.#document.getFullLength();

    this.#startOffset = EditorViewport.#clamp(
      this.#startOffset,
      0,
      Math.max(0, sourceLength - this.#charactersPerWindow)
    );

    this.#document.resizeWindow(this.#charactersPerWindow);
    this.#document.moveWindowTo(this.#startOffset);
    this.#startOffset = this.#document.getWindowStart();
  }

  #applyLineWindow() {
    const lineCount = this.#document.getLineCount();

    this.#startLine = EditorViewport.#clamp(
      this.#startLine,
      1,
      lineCount
    );

    const range = this.#document.getOffsetRangeForLines(
      this.#startLine,
      this.#linesPerWindow
    );

    this.#document.setWindowRange(range.startOffset, range.endOffset);
    this.#startLine = range.startLine;
    this.#startOffset = range.startOffset;
  }

  static #normalizeMode(mode) {
    if (mode !== "lines" && mode !== "characters") {
      throw new TypeError("Viewport mode must be 'lines' or 'characters'.");
    }

    return mode;
  }

  static #positiveInteger(value, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return fallback;
    }

    const integer = Math.trunc(number);
    return integer > 0 ? integer : fallback;
  }

  static #clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
}
