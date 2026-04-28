// src/TextareaEditorView.js
import EditorModel from "./EditorModel_old.js";
import Storage from "./Storage.js";

export default class TextareaEditorView {
  // DOM/input/rendering logic
      constructor(textarea, statusElement, debugElement) {
        this.textarea = textarea;
        this.statusElement = statusElement;
        this.debugElement = debugElement;
        this.storage = new Storage();

        this.model = new EditorModel("Hello, gap buffer!\n\nTry typing here.");
        this.isComposing = false;

        this.bindEvents();
        this.render();
      }

      save() {
        this.storage.save(this.model.getText());
        this.updateStatus("Saved");
      }

      bindEvents() {
        window.addEventListener("beforeunload", () => {
          this.save();
        });
        
        this.textarea.addEventListener("keydown", event => {
          const isSaveShortcut =
           (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
          if (isSaveShortcut) {
            event.preventDefault();
            this.save();
          }
        });

        this.textarea.addEventListener("beforeinput", event => {
          if (this.isComposing) return;
          this.handleBeforeInput(event);
        });

        this.textarea.addEventListener("compositionstart", () => {
          this.isComposing = true;
        });

        this.textarea.addEventListener("compositionend", () => {
          this.isComposing = false;
          this.rebuildFromTextarea();
        });

        this.textarea.addEventListener("click", () => {
          this.syncCursorFromTextarea();
        });

        this.textarea.addEventListener("keyup", event => {
          if (this.isNavigationKey(event.key)) {
            this.syncCursorFromTextarea();
          }
        });

        this.textarea.addEventListener("select", () => {
          this.updateStatus();
        });

        this.textarea.addEventListener("paste", event => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          this.replaceSelection(text);
        });
      }

      handleBeforeInput(event) {
        const type = event.inputType;
        const data = event.data ?? "";

        event.preventDefault();

        switch (type) {
          case "insertText":
          case "insertReplacementText":
            this.replaceSelection(data);
            break;
            
          case "insertLineBreak":
          case "insertParagraph":
            this.replaceSelection("\n");
            this.save();
            break;

          case "insertTab":
            this.replaceSelection("  ");
            break;

          case "deleteContentBackward":
            this.deleteBackward();
            break;

          case "deleteContentForward":
            this.deleteForward();
            break;

          case "deleteByCut":
          case "deleteByDrag":
            this.deleteSelection();
            break;

          default:
            // Fallback for browser operations we do not explicitly model yet.
            queueMicrotask(() => this.rebuildFromTextarea());
            break;
        }
      }

      replaceSelection(text) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        this.model.replaceRange(start, end, text);
        this.render(start + [...text].length);
      }

      deleteSelection() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        if (start === end) return;

        this.model.deleteRange(start, end);
        this.render(start);
      }

      deleteBackward() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        if (start !== end) {
          this.model.deleteRange(start, end);
          this.render(start);
          return;
        }

        this.model.moveCursor(start);
        this.model.backspace();
        this.render(Math.max(0, start - 1));
      }

      deleteForward() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;

        if (start !== end) {
          this.model.deleteRange(start, end);
          this.render(start);
          return;
        }

        this.model.moveCursor(start);
        this.model.deleteForward();
        this.render(start);
      }

      syncCursorFromTextarea() {
        this.model.moveCursor(this.textarea.selectionStart);
        this.updateStatus();
        this.updateDebug();
      }

      rebuildFromTextarea() {
        this.model = new EditorModel(this.textarea.value);
        this.model.moveCursor(this.textarea.selectionStart);
        this.render(this.textarea.selectionStart);
      }

      render(cursorPosition = this.model.getCursor()) {
        const text = this.model.getText();
        this.textarea.value = text;

        const cursor = Math.max(0, Math.min(cursorPosition, text.length));
        this.textarea.selectionStart = cursor;
        this.textarea.selectionEnd = cursor;

        this.updateStatus();
        this.updateDebug();
      }
      /*
      // Old version
      updateStatus() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const length = this.model.getLength();

        if (start === end) {
          this.statusElement.textContent = `Cursor: ${start} | Length: ${length}`;
        } else {
          this.statusElement.textContent = `Selection: ${start}–${end} | Length: ${length}`;
        }
      }
      */
     
      updateStatus(extra = "") {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const length = this.model.getLength();
        
        const base =
        start === end
        ? `Cursor: ${start} | Length: ${length}`
        : `Selection: ${start}–${end} | Length: ${length}`;
        this.statusElement.textContent = extra ? `${base} | ${extra}` : base;
      }

      updateDebug() {
        this.debugElement.textContent = JSON.stringify(this.model.debugState(), null, 2);
      }

      isNavigationKey(key) {
        return [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown"
        ].includes(key);
      }



  
}