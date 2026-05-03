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
 *
 * In the windowed design the textarea selection is local to the visible window.
 * The presenter therefore uses EditorDocument's visible/window APIs when editing
 * and uses the full-text API only for persistence.
 */
export default class EditorPresenter {
  #document;
  #view;
  #storage;
  #viewport;
  #tabText;

  constructor({ document, view, storage, viewport = null, tabText = DEFAULT_TAB_TEXT }) {
    if (!document || !view || !storage) {
      throw new Error("EditorPresenter requires document, view, and storage.");
    }

    this.#document = document;
    this.#view = view;
    this.#storage = storage;
    this.#viewport = viewport;
    this.#tabText = tabText;
  }

  start() {
    this.#bindViewEvents();
    this.#viewport?.apply();
    this.#document.moveCursor(0);
    this.render(TextSelection.collapsed(this.#document.getCursor()));
    this.#view.focus();
  }

  save() {
    this.#storage.saveText(this.#document.getFullText());
    this.render(this.#view.getSelection(), "Saved");
  }

  persist() {
    this.#storage.saveText(this.#document.getFullText());
  }

  /**
   * Moves the visible text window one page backward and re-renders the textarea.
   *
   * This does not change the document text. It only changes which slice of the
   * document is currently exposed through the textarea.
   */
  moveToPreviousWindow() {
    this.#viewport?.previousWindow() ?? this.#document.moveToPreviousWindow();
    this.#document.moveCursor(0);
    this.render(TextSelection.collapsed(0), "Previous window");
  }

  /**
   * Moves the visible text window one page forward and re-renders the textarea.
   */
  moveToNextWindow() {
    this.#viewport?.nextWindow() ?? this.#document.moveToNextWindow();
    this.#document.moveCursor(0);
    this.render(TextSelection.collapsed(0), "Next window");
  }

  /** Moves the visible text window to the beginning of the document. */
  moveToDocumentStart() {
    this.#viewport?.firstWindow() ?? this.#document.moveToDocumentStart();
    this.#document.moveCursor(0);
    this.render(TextSelection.collapsed(0), "Start of document");
  }

  /** Moves the visible text window to the final window of the document. */
  moveToDocumentEnd() {
    this.#viewport?.lastWindow() ?? this.#document.moveToDocumentEnd();
    this.#document.moveCursor(0);
    this.render(TextSelection.collapsed(0), "End of document");
  }

  /**
   * Dispatches window navigation commands reported by the view.
   *
   * @param {"previous"|"next"|"first"|"last"} action
   */
  handleWindowNavigation(action) {
    switch (action) {
      case "previous":
        this.moveToPreviousWindow();
        break;

      case "next":
        this.moveToNextWindow();
        break;

      case "first":
        this.moveToDocumentStart();
        break;

      case "last":
        this.moveToDocumentEnd();
        break;

      default:
        throw new Error(`Unknown window navigation action: ${action}`);
    }
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
        this.persist();
        break;

      case "insertTab":
        input.preventDefault();
        this.replaceSelection(this.#tabText);
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
        // view. The input event will then rebuild the visible document window
        // from the textarea's current text.
        break;
    }
  }

  replaceSelection(text) {
    const replacement = String(text);
    const selection = this.#currentSelection();

    const result = this.#document.replaceVisibleRange(
      selection.start,
      selection.end,
      replacement
    );

    this.#viewport?.refresh();
    this.render(TextSelection.collapsed(result.localCursor));
  }

  deleteSelection() {
    const selection = this.#currentSelection();

    if (selection.isCollapsed) {
      return false;
    }

    const result = this.#document.deleteRange(selection.start, selection.end);
    this.#viewport?.refresh();
    this.render(TextSelection.collapsed(result.localCursor));
    return true;
  }

  deleteBackward() {
    if (this.deleteSelection()) {
      return;
    }

    const selection = this.#currentSelection();
    const cursor = selection.start;
    const visibleText = this.#document.getVisibleText();

    if (cursor > 0) {
      const start = previousGraphemeBoundary(visibleText, cursor);
      const result = this.#document.deleteRange(start, cursor);
      this.#viewport?.refresh();
      this.render(TextSelection.collapsed(result.localCursor));
      return;
    }

    const result = this.#document.backspace();
    this.#viewport?.refresh();
    this.render(TextSelection.collapsed(result.localCursor));
  }

  deleteForward() {
    if (this.deleteSelection()) {
      return;
    }

    const selection = this.#currentSelection();
    const cursor = selection.start;
    const visibleText = this.#document.getVisibleText();

    if (cursor < visibleText.length) {
      const end = nextGraphemeBoundary(visibleText, cursor);
      const result = this.#document.deleteRange(cursor, end);
      this.#viewport?.refresh();
      this.render(TextSelection.collapsed(result.localCursor));
      return;
    }

    const result = this.#document.deleteForward();
    this.#viewport?.refresh();
    this.render(TextSelection.collapsed(result.localCursor));
  }

  syncCursorFromView() {
    const selection = this.#currentSelection();
    this.#document.moveCursor(selection.end);

    // Cursor movement can fire very frequently while the user navigates with
    // arrow keys. Updating the compact status is useful; rebuilding the debug
    // panel on every cursor movement is unnecessarily expensive for large files.
    this.renderStatus(selection, "", this.#view.getText());
  }

  rebuildDocumentFromView() {
    const selection = TextSelection
      .from(this.#view.getSelection())
      .clamp(this.#view.getText().length);

    this.#document.setVisibleText(this.#view.getText());
    this.#viewport?.refresh();
    this.#document.moveCursor(selection.end);
    this.render(selection);
  }

  render(selection = this.#view.getSelection(), message = "") {
    const visibleText = this.#document.getVisibleText();
    const safeSelection = TextSelection.from(selection).clamp(visibleText.length);

    this.#view.setWindowNavigationState?.({
      canMovePrevious: this.#document.canMoveToPreviousWindow(),
      canMoveNext: this.#document.canMoveToNextWindow()
    });
    this.#view.setText(visibleText);
    this.#view.setSelection(safeSelection.start, safeSelection.end);
    this.renderStatus(safeSelection, message, visibleText);
    this.renderDebug(visibleText);
  }

  renderStatus(selection = this.#view.getSelection(), message = "", visibleText = null) {
    const currentVisibleText = visibleText ?? this.#document.getVisibleText();
    const safeSelection = TextSelection
      .from(selection)
      .normalize()
      .clamp(currentVisibleText.length);

    this.#view.showStatus(formatEditorStatus({
      cursor: this.#document.getCursorInfo(safeSelection.end, {
        visibleText: currentVisibleText
      }),
      viewport: this.#getViewportInfo(),
      stats: this.#document.getStats({ visibleText: currentVisibleText }),
      message
    }));
  }

  renderDebug(visibleText = null) {
    this.#view.showDebug(formatDebugState(
      this.#document.debugState({ visibleText })
    ));
  }

  #getViewportInfo() {
    if (this.#viewport) {
      return this.#viewport.getInfo();
    }

    const stats = this.#document.getStats();

    return {
      mode: "characters",
      startLine: stats.visibleStartLine,
      endLine: stats.visibleEndLine,
      startOffset: stats.windowStart,
      endOffset: stats.windowEnd
    };
  }

  #bindViewEvents() {
    this.#view.onBeforeUnload(() => this.persist());
    this.#view.onSave(() => this.save());
    this.#view.onTab(() => this.replaceSelection(this.#tabText));
    this.#view.onBeforeInput(input => this.handleBeforeInput(input));
    this.#view.onNativeInput(() => this.rebuildDocumentFromView());
    this.#view.onSelectionChange(() => this.syncCursorFromView());
    this.#view.onPaste(text => this.replaceSelection(text));
    this.#view.onWindowNavigation?.(action => this.handleWindowNavigation(action));
  }

  #currentSelection() {
    return TextSelection
      .from(this.#view.getSelection())
      .normalize()
      .clamp(this.#document.getVisibleLength());
  }
}
