# Circular Gap Buffer Editor

A small browser-based plain text editor built around a custom circular gap buffer data structure.

The project is both a working editor prototype and an exploration of editor architecture, text storage, cursor movement, selection handling, persistence, and clean separation between model, view, presenter, and storage.

## Features

- Plain text editing in the browser
- Circular gap buffer text storage
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

styles/
  ...
```
## Architecture

The project uses an MVP-style architecture rather than classic MVC.
```
CircularGapBuffer
  low-level text storage

EditorDocument
  document-level editing API

TextareaEditorView
  DOM adapter around the native textarea

EditorPresenter
  coordinates user input, document changes, rendering, and storage

LocalDocumentStorage
  persists plain text through localStorage
```

## Running locally
Clone repository
```
git clone https://github.com/borisreif/CircularGapBufferEditor.git
cd CircularGapBufferEditor
```
Install dependencies:
```
npm install
```
Run tests:
```
npm test
```
Open index.html in a browser, or serve the folder with a small local server:
```
python3 -m http.server 8000
```
Then open:
```
http://localhost:8000
```
## Development notes
This editor currently uses a native <textarea> as the editing surface. 
That keeps the UI simple and gives reliable plain-text behavior, selection 
handling, keyboard input, clipboard support, and accessibility.

The architecture is designed so that the textarea could later be replaced with 
another view adapter, such as a contenteditable view or 
a custom rendered editor surface.

## Future ideas

- Multiple local documents
- Editable document title
- Import/export .txt files
- Configurable automatic line breaking
- Configurable tab behavior
- Better test coverage
- Optional syntax highlighting
- Custom editor surface experiment

## License
MIT

