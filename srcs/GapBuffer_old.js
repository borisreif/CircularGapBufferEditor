// src/GapBuffer.js
export default class GapBuffer {
  // pure data structure
      constructor(initialSize = 16) {
        const size = Math.max(1, initialSize);
        this.buffer = new Array(size).fill(null);
        this.gapStart = 0;
        this.gapEnd = size;
      }

      get length() {
        return this.buffer.length - this.gapSize;
      }

      get cursor() {
        return this.gapStart;
      }

      get gapSize() {
        return this.gapEnd - this.gapStart;
      }

      toString() {
        const prefix = this.buffer.slice(0, this.gapStart).join("");
        const suffix = this.buffer.slice(this.gapEnd).join("");
        return prefix + suffix;
      }


      moveCursor(position) {
        const target = Math.max(0, Math.min(position, this.length));

        while (target < this.gapStart) {
          this.moveGapLeft();
        }

        while (target > this.gapStart) {
          this.moveGapRight();
        }
      }

      moveGapLeft() {
        if (this.gapStart <= 0) return;

        this.gapStart--;
        this.gapEnd--;
        this.buffer[this.gapEnd] = this.buffer[this.gapStart];
        this.buffer[this.gapStart] = null;
      }

      moveGapRight() {
        if (this.gapEnd >= this.buffer.length) return;

        this.buffer[this.gapStart] = this.buffer[this.gapEnd];
        this.buffer[this.gapEnd] = null;
        this.gapStart++;
        this.gapEnd++;
      }

      insert(text) {
        for (const ch of text) {
          if (this.gapStart === this.gapEnd) {
            this.grow();
          }
          this.buffer[this.gapStart] = ch;
          this.gapStart++;
        }
      }
      
      grow() {
        const oldSize = this.buffer.length;
        const newSize = Math.max(1, oldSize * 2);
        const newBuffer = new Array(newSize).fill(null);
        
        for (let i = 0; i < this.gapStart; i++) {
          newBuffer[i] = this.buffer[i];
        }
        
        const suffixLength = oldSize - this.gapEnd;
        const newGapEnd = newSize - suffixLength;
        
        for (let i = 0; i < suffixLength; i++) {
          newBuffer[newGapEnd + i] = this.buffer[this.gapEnd + i];
        }
        
        this.buffer = newBuffer;
        this.gapEnd = newGapEnd;
      }

      
      backspace() {
        if (this.gapStart <= 0) return;

        this.gapStart--;
        this.buffer[this.gapStart] = null;
      }

      delete() {
        if (this.gapEnd >= this.buffer.length) return;

        this.buffer[this.gapEnd] = null;
        this.gapEnd++;
      }

      deleteRange(start, end) {
        const safeStart = Math.max(0, Math.min(start, this.length));
        const safeEnd = Math.max(safeStart, Math.min(end, this.length));

        this.moveCursor(safeStart);

        for (let i = safeStart; i < safeEnd; i++) {
          this.delete();
        }
      }

      clear() {
        this.buffer.fill(null);
        this.gapStart = 0;
        this.gapEnd = this.buffer.length;
      }

      checkInvariant() {
        const valid =
          this.gapStart >= 0 &&
          this.gapStart <= this.gapEnd &&
          this.gapEnd <= this.buffer.length;

        if (!valid) {
          throw new Error(
            `Invalid gap state: gapStart=${this.gapStart}, gapEnd=${this.gapEnd}, length=${this.buffer.length}`
          );
        }
      }

}