// srcs/main.js

import EditorPresenter from "./app/EditorPresenter.js";
import { DEFAULT_EDITOR_CONFIG } from "./config/EditorConfig.js";
import EditorDocument from "./domain/EditorDocument.js";
import EditorViewport from "./domain/EditorViewport.js";
import LocalDocumentStorage from "./storage/LocalDocumentStorage.js";
import TextareaEditorView from "./ui/TextareaEditorView.js";

const DEFAULT_TEXT = "Hello, circular gap buffer!\n\nTry typing here.";

const storage = new LocalDocumentStorage();
const documentModel = new EditorDocument(storage.loadText() ?? DEFAULT_TEXT, {
  windowSize: DEFAULT_EDITOR_CONFIG.viewport.charactersPerWindow
});
const viewport = new EditorViewport(documentModel, DEFAULT_EDITOR_CONFIG.viewport);

const view = new TextareaEditorView({
  textarea: document.querySelector("#editor"),
  lineNumbersElement: document.querySelector("#line-numbers"),
  statusElement: document.querySelector("#status"),
  debugElement: document.querySelector("#debug"),
  firstWindowButton: document.querySelector("#first-window"),
  previousWindowButton: document.querySelector("#previous-window"),
  nextWindowButton: document.querySelector("#next-window"),
  lastWindowButton: document.querySelector("#last-window")
});

const presenter = new EditorPresenter({
  document: documentModel,
  viewport,
  view,
  storage,
  tabText: DEFAULT_EDITOR_CONFIG.indentation.tabText
});

presenter.start();
