import GapBuffer  from './GapBuffer.js';

class TextEditor {
  constructor(elementId) {
    this.element = document.getElementById(elementId);
    
    if (!this.element) {
      console.error(`Could not find element with ID: ${elementId}`);
      return; // Stop here so we don't hit the addEventListener error
    }

    this.buffer = new GapBuffer(100);
    this.setupEventListeners();
    this.render();
  }

  // View Logic
  render() {
    const text = this.buffer.toString();
    const prefix = text.substring(0, this.buffer.gapStart);
    const suffix = text.substring(this.buffer.gapStart);
    
    // Update the DOM
    this.element.innerHTML = ''; 
    // (Add the spans for prefix, cursor, and suffix here)
  }

  // IO Logic
  save() {
    const blob = new Blob([this.buffer.toString()], { type: 'text/plain' });
    // (Trigger download)
  }

  setupEventListeners() {
  // Using an Arrow Function (=>) is CRITICAL here
  this.element.addEventListener('keydown', (e) => {
  // 1. Ignore modifier keys like Ctrl/Alt by themselves
  if (e.altKey || e.ctrlKey || e.metaKey) return;

  // 2. Handle special keys
  switch (e.key) {
    case 'Enter':
      this.buffer.insert('\n');
      break;
    case 'Backspace':
      this.buffer.backspace();
      break;
    case 'Delete':
      this.buffer.delete();
      break;
    case 'ArrowLeft':
      this.buffer.moveCursor(buffer.gapStart - 1);
      break;
    case 'ArrowRight':
      this.buffer.moveCursor(buffer.gapStart + 1);
      break;
    default:
      // 3. Insert actual characters (length 1 check filters out 'Shift', etc.)
      if (e.key.length === 1) {
        this.buffer.insert(e.key);
      }
  }

  this.render();
    e.preventDefault();
    });
  }
}

// Usage
// const myEditor = new TextEditor('editor');
// Bottom of TextEditor.js
window.addEventListener('DOMContentLoaded', () => {
  const myEditor = new TextEditor('editor');
});
