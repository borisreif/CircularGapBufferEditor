# Circular Gap Buffer Editor

A small browser-based plain text editor built around a custom circular gap
buffer data structure.

The project is both a working editor prototype and an exploration of editor
architecture, text storage, cursor movement, selection handling, persistence,
and clean separation between model, view, presenter, and storage.

## Features

- Plain text editing in the browser
- Circular gap buffer text storage
- Windowed text-buffer layer above the circular gap buffer
- Logical line counting
- Line number gutter
- Cursor and selection support
- Local persistence through `localStorage`
- Save on Ctrl+S
- Save on hard line break
- Save before page unload
- Debug view for inspecting editor state
- MVP-style architecture

## Project structure

```txt
srcs/
  CircularGapBuffer.js

  domain/
    BufferWindow.js
    EditorDocument.js
    TextSelection.js
    TextBoundaries.js

  app/
    EditorPresenter.js
    EditorStatus.js
    EditorDebug.js

  ui/
    TextareaEditorView.js

  storage/
    LocalDocumentStorage.js

test/
  buffer-window.test.js
  editor-document.test.js

styles/
  ...
```

## Architecture

The project uses an MVP-style architecture rather than classic MVC.

```txt
CircularGapBuffer
  low-level full-document text storage

BufferWindow
  sliding editable text window over the circular gap buffer

EditorDocument
  document-level editing and statistics API

TextareaEditorView
  DOM adapter around the native textarea

EditorPresenter
  coordinates user input, document changes, rendering, and storage

LocalDocumentStorage
  persists plain text through localStorage
```

The current text ownership model is:

```txt
CircularGapBuffer  stores the complete document
BufferWindow       stores only start/end/cursor metadata
Textarea           stores only the visible window text
```

So the textarea is no longer intended to be the full document store. It is a
working window onto the text stored in the circular gap buffer.

## Running locally

Clone the repository:

```bash
git clone https://github.com/borisreif/CircularGapBufferEditor.git
cd CircularGapBufferEditor
```

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Open `index.html` in a browser, or serve the folder with a small local server:

```bash
python3 -m http.server 8000
```

Then open:

```txt
http://localhost:8000
```

## Development notes

This editor currently uses a native `<textarea>` as the editing surface. That
keeps the UI simple and gives reliable plain-text behavior, selection handling,
keyboard input, clipboard support, and accessibility.

The text storage is intentionally separated from the textarea. The full document
lives in `CircularGapBuffer`, while `BufferWindow` exposes a smaller editable
section to the rest of the app.

The architecture is designed so that the textarea could later be replaced with
another view adapter, such as a `contenteditable` view or a custom rendered
editor surface.

## Future ideas

- Controls for moving/resizing the `BufferWindow`
- Multiple local documents
- Editable document title
- Import/export `.txt` files
- Configurable automatic line breaking
- Configurable tab behavior
- Better test coverage
- Optional syntax highlighting
- Custom editor surface experiment

## License

MIT
