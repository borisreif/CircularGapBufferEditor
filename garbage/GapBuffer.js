export default class GapBuffer {
  constructor(initialSize = 10) {
    const size = Math.max(1, initialSize);
    this.buffer = new Array(size).fill(null);
    this.gapStart = 0;
    this.gapEnd = size;
  }

  toString() {
    const prefix = this.buffer.slice(0, this.gapStart).join('');
    const suffix = this.buffer.slice(this.gapEnd).join('');
    return prefix + suffix;
  }

  moveCursor(position) {
    // Clamp position to valid range
    const textLength = this.buffer.length - (this.gapEnd - this.gapStart);
    const target = Math.max(0, Math.min(position, textLength));

    if (this.gapStart === this.gapEnd) {
      this.gapStart = target;
      this.gapEnd = target;
      return;
    }

    while (target < this.gapStart) {
      this.moveGapLeft();
    }
    while (target > this.gapStart) {
      this.moveGapRight();
    }
  }

  moveGapLeft() {
    if (this.gapStart > 0) {
      this.gapStart--;
      this.gapEnd--;
      this.buffer[this.gapEnd] = this.buffer[this.gapStart];
      this.buffer[this.gapStart] = null;
    }
  }

  moveGapRight() {
    if (this.gapEnd < this.buffer.length) {
      this.buffer[this.gapStart] = this.buffer[this.gapEnd];
      this.buffer[this.gapEnd] = null;
      this.gapStart++;
      this.gapEnd++;
    }
  }
/*
  insert(char) {
    if (this.gapStart === this.gapEnd) {
      this.grow();
    }
    this.buffer[this.gapStart] = char;
    this.gapStart++;
  }*/

  insert(text) {
    for (const ch of text) {
      if (this.gapStart === this.gapEnd) {
        this.grow();
      }
      this.buffer[this.gapStart++] = ch;
    }
  }

  get length() {
    return this.buffer.length - (this.gapEnd - this.gapStart);
  }
  
  get cursor() {
    return this.gapStart;
  }

  grow() {
    const oldSize = this.buffer.length;
    const newSize = oldSize * 2;
    const newBuffer = new Array(newSize).fill(null);

    for (let i = 0; i < this.gapStart; i++) {
      newBuffer[i] = this.buffer[i];
    }

    const suffixLen = oldSize - this.gapEnd;
    const newGapEnd = newSize - suffixLen;
    for (let i = 0; i < suffixLen; i++) {
      newBuffer[newGapEnd + i] = this.buffer[this.gapEnd + i];
    }

    this.buffer = newBuffer;
    this.gapEnd = newGapEnd;
  }

  backspace() {
    if (this.gapStart > 0) {
      this.gapStart--;
      this.buffer[this.gapStart] = null; // Clear the slot
    }
  }

  delete() {
    if (this.gapEnd < this.buffer.length) {
      this.buffer[this.gapEnd] = null; // Clear the slot
      this.gapEnd++;
    }
  }
}


function testGapBuffer() {
  const editor = new GapBuffer(5); // Start small to trigger 'grow()' early
  
  console.log("--- Step 1: Typing 'Hello' ---");
  "Hello".split('').forEach(char => editor.insert(char));
  console.log(`Buffer: [${editor.buffer}]`);
  console.log(`String: "${editor.toString()}"`);

  console.log("\n--- Step 2: Moving cursor to index 2 and inserting 'y ' ---");
  // Logic: He|llo -> Hey |llo
  editor.moveCursor(2);
  editor.insert('y');
  editor.insert(' ');
  console.log(`String: "${editor.toString()}"`);

  console.log("\n--- Step 3: Testing Backspace ---");
  // Hey |llo -> He |llo
  editor.backspace();
  console.log(`String: "${editor.toString()}"`);

  console.log("\n--- Step 4: Testing Forward Delete ---");
  // He |llo -> He |lo
  editor.delete();
  console.log(`String: "${editor.toString()}"`);

  console.log("\n--- Step 5: Final Buffer State ---");
  console.log(`Final String: "${editor.toString()}"`);
  console.log("Internal Array Structure:", editor.buffer);
}

// testGapBuffer();



