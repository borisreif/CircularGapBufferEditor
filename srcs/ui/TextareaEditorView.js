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
 * This class owns DOM details only. It does not know about the editor document,
 * storage, or CircularGapBuffer. It reports user intent through callbacks and
 * exposes a small view API used by EditorPresenter.
 */
export default class TextareaEditorView {
  constructor(elementsOrTextarea, statusElement, debugElement) {
    const isTextareaElement =
      typeof HTMLTextAreaElement !== "undefined" &&
      elementsOrTextarea instanceof HTMLTextAreaElement;

    const elements = isTextareaElement
      ? { textarea: elementsOrTextarea, statusElement, debugElement }
      : elementsOrTextarea;

    if (!elements?.textarea || !elements?.statusElement || !elements?.debugElement) {
      throw new Error("TextareaEditorView requires textarea, statusElement, and debugElement.");
    }

    this.lineNumbersElement = elements.lineNumbersElement ?? null;
    this.textarea = elements.textarea;
    this.statusElement = elements.statusElement;
    this.debugElement = elements.debugElement;
    this.isComposing = false;
  }

  getText() {
    return this.textarea.value;
  }

  setText(text) {
    const nextText = String(text);

    if (this.textarea.value !== nextText) {
      this.textarea.value = nextText;
    }
  }

  getSelection() {
    return {
      start: this.textarea.selectionStart,
      end: this.textarea.selectionEnd
    };
  }

  setSelection(start, end = start) {
    this.textarea.setSelectionRange(start, end);
  }

  focus() {
    this.textarea.focus();
  }

  showStatus(text) {
    this.statusElement.textContent = text;
  }

  showDebug(text) {
    this.debugElement.textContent = text;
  }

  onBeforeUnload(callback) {
    window.addEventListener("beforeunload", callback);
  }

  onSave(callback) {
    this.textarea.addEventListener("keydown", event => {
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
    this.textarea.addEventListener("keydown", event => {
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
    this.textarea.addEventListener("beforeinput", event => {
      if (this.isComposing) {
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
    this.textarea.addEventListener("input", () => {
      if (!this.isComposing) {
        callback();
      }
    });

    this.textarea.addEventListener("compositionstart", () => {
      this.isComposing = true;
    });

    this.textarea.addEventListener("compositionend", () => {
      this.isComposing = false;
      queueMicrotask(callback);
    });
  }

  onSelectionChange(callback) {
    this.textarea.addEventListener("click", callback);
    this.textarea.addEventListener("mouseup", callback);
    this.textarea.addEventListener("focus", callback);
    this.textarea.addEventListener("select", callback);

    this.textarea.addEventListener("keyup", event => {
      if (NAVIGATION_KEYS.has(event.key)) {
        callback();
      }
    });
  }

  onPaste(callback) {
    this.textarea.addEventListener("paste", event => {
      event.preventDefault();
      callback(event.clipboardData?.getData("text/plain") ?? "");
    });
  }

  showLineNumbers(lineCount) {
    if (!this.lineNumbersElement) return;
    
    this.lineNumbersElement.textContent = Array
    .from({ length: lineCount }, (_, index) => String(index + 1))
    .join("\n");
  }

  bindLineNumberScroll() {
    if (!this.lineNumbersElement) return;
    
    this.textarea.addEventListener("scroll", () => {
      this.lineNumbersElement.scrollTop = this.textarea.scrollTop;
    });
  }
}
