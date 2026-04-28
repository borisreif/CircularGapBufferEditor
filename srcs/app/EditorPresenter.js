// srcs/app/EditorPresenter.js

import TextSelection from "../domain/TextSelection.js";
import {
  nextGraphemeBoundary,
  previousGraphemeBoundary
} from "../domain/TextBoundaries.js";
import { formatDebugState } from "./EditorDebug.js";
import { formatEditorStatus } from "./EditorStatus.js";

const DEFAULT_TAB_TEXT = "  ";

/**
 * EditorPresenter coordinates the document, view, and storage.
 *
 * The presenter owns editor behavior: it interprets user intent, mutates the
 * document, updates the view, and triggers persistence. It deliberately does
 * not know about CircularGapBuffer internals or concrete DOM element details.
 */
export default class EditorPresenter {
  constructor({ document, view, storage, tabText = DEFAULT_TAB_TEXT }) {
    if (!document || !view || !storage) {
      throw new Error("EditorPresenter requires document, view, and storage.");
    }

    this.document = document;
    this.view = view;
    this.storage = storage;
    this.tabText = tabText;
  }

  start() {
    this.#bindViewEvents();
    this.render(TextSelection.collapsed(this.document.getCursor()));
    this.view.focus();
  }

  save() {
    this.storage.saveText(this.document.getText());
    this.render(this.view.getSelection(), "Saved");
  }

  persist() {
    this.storage.saveText(this.document.getText());
  }

  handleBeforeInput(input) {
    const type = input.type;
    const data = input.data ?? "";

    switch (type) {
      case "insertText":
      case "insertReplacementText":
        input.preventDefault();
        this.replaceSelection(data);
        break;

      case "insertLineBreak":
      case "insertParagraph":
        input.preventDefault();
        this.replaceSelection("\n");
        break;

      case "insertTab":
        input.preventDefault();
        this.replaceSelection(this.tabText);
        break;

      case "deleteContentBackward":
        input.preventDefault();
        this.deleteBackward();
        break;

      case "deleteContentForward":
        input.preventDefault();
        this.deleteForward();
        break;

      case "deleteByCut":
      case "deleteByDrag":
        input.preventDefault();
        this.deleteSelection();
        break;

      default:
        // Native operations such as undo/redo are allowed to happen in the
        // view. The input event will then rebuild the document from view text.
        break;
    }
  }

  replaceSelection(text) {
    const replacement = String(text);
    const selection = this.#currentSelection();

    this.document.replaceRange(selection.start, selection.end, replacement);
    this.render(TextSelection.collapsed(selection.start + replacement.length));
  }

  deleteSelection() {
    const selection = this.#currentSelection();

    if (selection.isCollapsed) {
      return false;
    }

    this.document.deleteRange(selection.start, selection.end);
    this.render(selection.collapseToStart());
    return true;
  }

  deleteBackward() {
    if (this.deleteSelection()) {
      return;
    }

    const selection = this.#currentSelection();
    const cursor = selection.start;
    const text = this.document.getText();
    const start = previousGraphemeBoundary(text, cursor);

    if (start === cursor) {
      this.render(selection);
      return;
    }

    this.document.deleteRange(start, cursor);
    this.render(TextSelection.collapsed(start));
  }

  deleteForward() {
    if (this.deleteSelection()) {
      return;
    }

    const selection = this.#currentSelection();
    const cursor = selection.start;
    const text = this.document.getText();
    const end = nextGraphemeBoundary(text, cursor);

    if (end === cursor) {
      this.render(selection);
      return;
    }

    this.document.deleteRange(cursor, end);
    this.render(TextSelection.collapsed(cursor));
  }

  syncCursorFromView() {
    const selection = this.#currentSelection();
    this.document.moveCursor(selection.end);
    this.renderStatus(selection);
    this.renderDebug();
  }

  rebuildDocumentFromView() {
    const selection = TextSelection
      .from(this.view.getSelection())
      .clamp(this.view.getText().length);

    this.document.setText(this.view.getText());
    this.document.moveCursor(selection.end);
    this.render(selection);
  }

  render(selection = this.view.getSelection(), message = "") {
    const text = this.document.getText();
    const safeSelection = TextSelection.from(selection).clamp(text.length);

    this.view.showLineNumbers?.(this.document.getLineCount());
    this.view.setText(text);
    this.view.setSelection(safeSelection.start, safeSelection.end);
    this.renderStatus(safeSelection, message);
    this.renderDebug();
  }

  renderStatus(selection = this.view.getSelection(), message = "") {
    this.view.showStatus(formatEditorStatus({
      selection,
      stats: this.document.getStats(),
      message
    }));
  }

  renderDebug() {
    this.view.showDebug(formatDebugState(this.document.debugState()));
  }

  #bindViewEvents() {
    this.view.onBeforeUnload(() => this.persist());
    this.view.onSave(() => this.save());
    this.view.onTab(() => this.replaceSelection(this.tabText));
    this.view.onBeforeInput(input => this.handleBeforeInput(input));
    this.view.onNativeInput(() => this.rebuildDocumentFromView());
    this.view.onSelectionChange(() => this.syncCursorFromView());
    this.view.onPaste(text => this.replaceSelection(text));
  }

  #currentSelection() {
    return TextSelection
      .from(this.view.getSelection())
      .normalize()
      .clamp(this.document.getLength());
  }
}
