// srcs/ui/TextareaEditorView.js

const NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown"
]);

/**
 * Passive view adapter for a native <textarea>-based editor UI.
 *
 * This class owns DOM details only. It does not know about EditorDocument,
 * BufferWindow, storage, or CircularGapBuffer. It reports browser/user events
 * through callbacks and exposes a small view API used by EditorPresenter.
 */
export default class TextareaEditorView {
  #textarea;
  #lineNumbersElement;
  #statusElement;
  #statusElements;
  #debugElement;
  #windowButtons;
  #isComposing = false;

  /**
   * Creates a textarea view.
   *
   * The constructor supports both the modern object form and the older positional
   * form so old experiments do not immediately break.
   *
   * @param {object|HTMLTextAreaElement} elementsOrTextarea
   * @param {HTMLElement} [statusElement]
   * @param {HTMLElement} [debugElement]
   */
  constructor(elementsOrTextarea, statusElement, debugElement) {
    const isTextareaElement =
      typeof HTMLTextAreaElement !== "undefined" &&
      elementsOrTextarea instanceof HTMLTextAreaElement;

    const elements = isTextareaElement
      ? { textarea: elementsOrTextarea, statusElement, debugElement }
      : elementsOrTextarea;

    if (!elements?.textarea || !elements?.statusElement || !elements?.debugElement) {
      throw new Error(
        "TextareaEditorView requires textarea, statusElement, and debugElement."
      );
    }

    this.#textarea = elements.textarea;
    this.#lineNumbersElement = elements.lineNumbersElement ?? null;
    this.#statusElement = elements.statusElement;
    this.#statusElements = elements.statusElements ?? null;
    this.#debugElement = elements.debugElement;
    this.#windowButtons = {
      first: elements.firstWindowButton ?? null,
      previous: elements.previousWindowButton ?? null,
      next: elements.nextWindowButton ?? null,
      last: elements.lastWindowButton ?? null
    };

    this.#bindLineNumberScroll();
  }

  // -------------------------------------------------------------------------
  // View state API
  // -------------------------------------------------------------------------

  getText() {
    return this.#textarea.value;
  }

  setText(text) {
    const nextText = String(text);

    if (this.#textarea.value !== nextText) {
      this.#textarea.value = nextText;
    }
  }

  getSelection() {
    return {
      start: this.#textarea.selectionStart,
      end: this.#textarea.selectionEnd
    };
  }

  setSelection(start, end = start) {
    this.#textarea.setSelectionRange(start, end);
  }

  focus() {
    this.#textarea.focus();
  }

  /**
   * Renders either the old one-line status string or the newer structured
   * status view-model used by the card-style footer.
   *
   * The view does not calculate editor state. It only copies already-formatted
   * strings into DOM nodes supplied by main.js.
   */
  showStatus(status) {
    if (typeof status === "string" || !this.#statusElements) {
      this.#statusElement.textContent = String(status);
      return;
    }

    TextareaEditorView.#setText(this.#statusElements.cursorGlobal, status.cursorGlobal);
    TextareaEditorView.#setText(this.#statusElements.cursorLocal, status.cursorLocal);
    TextareaEditorView.#setText(this.#statusElements.windowLines, status.windowLines);
    TextareaEditorView.#setText(this.#statusElements.windowChars, status.windowChars);
    TextareaEditorView.#setText(this.#statusElements.documentLines, status.documentLines);
    TextareaEditorView.#setText(this.#statusElements.documentSize, status.documentSize);
    TextareaEditorView.#setText(this.#statusElements.mode, status.mode);
    TextareaEditorView.#setText(this.#statusElements.save, status.save);
  }

  showDebug(text) {
    this.#debugElement.textContent = text;
  }

  /**
   * Renders logical line numbers for the current visible text window.
   *
   * @param {number} lineCount - Number of logical lines in the visible text.
   * @param {number} [startLine=1] - Global logical line number of the first line.
   */
  showLineNumbers(lineCount, startLine = 1) {
    if (!this.#lineNumbersElement) return;

    const count = Math.max(1, Math.trunc(Number(lineCount) || 1));
    const first = Math.max(1, Math.trunc(Number(startLine) || 1));

    this.#lineNumbersElement.textContent = Array
      .from({ length: count }, (_, index) => String(first + index))
      .join("\n");
  }

  /**
   * Enables/disables window-navigation buttons at document boundaries.
   *
   * Keyboard shortcuts remain active because repeatedly asking to move beyond a
   * boundary is harmless; the model simply clamps the window.
   */
  setWindowNavigationState({ canMovePrevious, canMoveNext }) {
    if (this.#windowButtons.first) {
      this.#windowButtons.first.disabled = !canMovePrevious;
    }

    if (this.#windowButtons.previous) {
      this.#windowButtons.previous.disabled = !canMovePrevious;
    }

    if (this.#windowButtons.next) {
      this.#windowButtons.next.disabled = !canMoveNext;
    }

    if (this.#windowButtons.last) {
      this.#windowButtons.last.disabled = !canMoveNext;
    }
  }

  // -------------------------------------------------------------------------
  // Event binding API
  // -------------------------------------------------------------------------

  onBeforeUnload(callback) {
    window.addEventListener("beforeunload", callback);
  }

  onSave(callback) {
    this.#textarea.addEventListener("keydown", event => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();
      callback();
    });
  }

  onTab(callback) {
    this.#textarea.addEventListener("keydown", event => {
      const isPlainTab =
        event.key === "Tab" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey;

      if (!isPlainTab) {
        return;
      }

      event.preventDefault();
      callback();
    });
  }

  onBeforeInput(callback) {
    this.#textarea.addEventListener("beforeinput", event => {
      if (this.#isComposing) {
        return;
      }

      callback({
        type: event.inputType,
        data: event.data ?? "",
        preventDefault: () => event.preventDefault()
      });
    });
  }

  onNativeInput(callback) {
    this.#textarea.addEventListener("input", () => {
      if (!this.#isComposing) {
        callback();
      }
    });

    this.#textarea.addEventListener("compositionstart", () => {
      this.#isComposing = true;
    });

    this.#textarea.addEventListener("compositionend", () => {
      this.#isComposing = false;
      queueMicrotask(callback);
    });
  }

  onSelectionChange(callback) {
    this.#textarea.addEventListener("click", callback);
    this.#textarea.addEventListener("mouseup", callback);
    this.#textarea.addEventListener("focus", callback);
    this.#textarea.addEventListener("select", callback);

    this.#textarea.addEventListener("keyup", event => {
      if (NAVIGATION_KEYS.has(event.key)) {
        callback();
      }
    });
  }

  onPaste(callback) {
    this.#textarea.addEventListener("paste", event => {
      event.preventDefault();
      callback(event.clipboardData?.getData("text/plain") ?? "");
    });
  }

  /**
   * Reports user requests to slide the current text window.
   *
   * Buttons:
   * - first / previous / next / last
   *
   * Keyboard shortcuts while the textarea is focused:
   * - Alt+ArrowLeft or Alt+PageUp: previous window
   * - Alt+ArrowRight or Alt+PageDown: next window
   * - Alt+Home: first window
   * - Alt+End: last window
   *
   * Plain arrow keys remain normal textarea cursor-navigation keys.
   */
  onWindowNavigation(callback) {
    this.#windowButtons.first?.addEventListener("click", () => callback("first"));
    this.#windowButtons.previous?.addEventListener("click", () => callback("previous"));
    this.#windowButtons.next?.addEventListener("click", () => callback("next"));
    this.#windowButtons.last?.addEventListener("click", () => callback("last"));

    this.#textarea.addEventListener("keydown", event => {
      if (!event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const action = TextareaEditorView.#windowNavigationActionForKey(event.key);

      if (!action) {
        return;
      }

      event.preventDefault();
      callback(action);
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  static #setText(element, text) {
    if (element) {
      element.textContent = text ?? "";
    }
  }

  static #windowNavigationActionForKey(key) {
    switch (key) {
      case "ArrowLeft":
      case "PageUp":
        return "previous";

      case "ArrowRight":
      case "PageDown":
        return "next";

      case "Home":
        return "first";

      case "End":
        return "last";

      default:
        return null;
    }
  }

  #bindLineNumberScroll() {
    if (!this.#lineNumbersElement) return;

    this.#textarea.addEventListener("scroll", () => {
      this.#lineNumbersElement.scrollTop = this.#textarea.scrollTop;
    });
  }
}
