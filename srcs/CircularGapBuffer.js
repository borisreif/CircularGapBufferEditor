/**
 * Mutable circular gap buffer data structure.
 * 
 * @author Boris A. Reif
 *
 * Background information:
 * 
 * An ordinary gap buffer stores text in an array with an empty "gap" 
 * at the cursor. Insertions at the cursor are efficient because characters 
 * are written directly into the gap.
 * 
 * A circular gap buffer allows the buffer to wrap around, avoiding
 * memory shifts when moving the cursor. This data structure combines
 * the "gap" concept with a "circular" array.
 *
 * Classic gap buffer:
 * @link https://en.wikipedia.org/wiki/Gap_buffer
 * @link https://www.geeksforgeeks.org/dsa/gap-buffer-data-structure/
 * @link https://workdad.dev/posts/building-a-text-editor-the-gap-buffer/
 * @link https://coredumped.dev/2023/08/09/text-showdown-gap-buffers-vs-ropes/
 * @link https://iq.opengenus.org/data-structures-used-in-text-editor/
 * @link https://belanyi.fr/2024/07/06/gap-buffer/
 * 
 * The internal array is divided into three regions:
 *
 *   [ text before cursor ][      gap      ][ text after cursor ]
 *
 * Example:
 *
 *   buffer:   [ "H", "e", "l", "l", "o", null, null, null, "!", "!" ]
 *   indexes:     0    1    2    3    4     5     6     7     8    9
 *                                      ^gapStart         ^gapEnd
 *
 * Logical text:
 *
 *   "Hello!!"
 *
 * The cursor is always located at gapStart.
 * Insertions happen at gapStart by filling the gap.
 * Moving the cursor left/right shifts characters across the gap.
 * 
 * 
 * CIRCULAR GAP BUFFER:
 * A circular buffer as implemented here lets the underlying array wrap around.
 * The buffer stores text in a ring-shaped array with an empty circular gap 
 * at the cursor. Insertions at the cursor are efficient because characters 
 * are written directly into the gap. Unlike a linear gap buffer, the logical 
 * start of the text does not have to begin at the physical array index 0.
 * 
 * The main benefit is that it avoids expensive reshuffling when edits happen 
 * near the beginning or end of the buffer.
 * In a circular gap buffer, the logical text can wrap:
 * 
 * physical array:
 * [ after cursor part ][ free space / gap ][ before cursor part ]
 * 
 * logical text:
 * before cursor + after cursor
 * 
 * So instead of insisting that the first character lives at array index 0, 
 * you track a logical start offset. That gives several advantages:
 * 
 * 1. Efficient insertion near the cursor
 * Like a normal gap buffer, inserting at the cursor is usually O(1) amortized, 
 * as long as the gap has space.
 * 
 * Before insert:
 * abc[     ]def
 * cursor
 * 
 * Insert X:
 * abcX[    ]def
 * 
 * 2. Better behavior at buffer boundaries
 * Because the array wraps, moving the cursor past the physical end 
 * does not require moving all data back to the front. You can just 
 * wrap indices modulo the capacity.
 * This can make beginning/end edits smoother than a plain linear gap buffer.
 * 
 * 3. Fewer full-buffer shifts
 * A normal array-based editor buffer often has to shift large portions 
 * of text when inserting or deleting near the front. A circular gap buffer 
 * can avoid some of those shifts by changing offsets and 
 * moving the smaller side of the text.
 * 
 * 4. Natural support for deque-like behavior
 * It becomes easier to insert/delete at both logical ends, 
 * because the “front” and “back” are not tied to fixed physical positions.
 * 
 * 5. Cleaner growth strategy
 * When the buffer fills, you allocate a larger circular array and 
 * copy the logical contents into the new array, 
 * usually placing a fresh gap at the cursor. 
 * That gives amortized efficient insertions, similar to dynamic arrays.
 * 
 * Tradeoff:
 * The downside is complexity. Every access needs index normalization:
 * physicalIndex = (start + logicalIndex) % capacity
 * And gap movement becomes more subtle because the text 
 * may wrap around the end of the array.
 *
 * Big picture:
 *
 *   Logical text:
 *
 *     "abc|def"
 *         ^ cursor
 *
 *   One possible physical circular layout:
 *
 *     physical array indexes:
 *
 *       0   1   2   3   4   5   6   7
 *     +---+---+---+---+---+---+---+---+
 *     | d | e | f |   |   | a | b | c |
 *     +---+---+---+---+---+---+---+---+
 *                   ^       ^
 *                   |       |
 *                gapEnd  gapStart
 *
 *   The logical text still reads as:
 *
 *     a b c d e f
 *
 *   But physically, the text wraps around the end of the array.
 * 
 * See also: 
 * @link https://flexichain.common-lisp.dev/download/StrandhVilleneuveMoore.pdf
 * @link https://en.wikipedia.org/wiki/Circular_buffer
 *
 *
 * Indexing model:
 * This class uses JavaScript string offsets, meaning positions are measured
 * in UTF-16 code units. This matches String.prototype.length,
 * String.prototype.slice(), textarea.selectionStart, and textarea.selectionEnd.
 *
 * Note:
 * User-perceived characters such as emoji, flags, and combined accents may
 * span multiple UTF-16 code units. Grapheme-aware cursor movement should be
 * implemented at the editor/model layer, not inside this low-level buffer.
 *
 * Core API:
 * - length
 * - cursor
 * - capacity
 * - isEmpty
 * - toString()
 * - moveCursor(position)
 * - insert(text)
 * - backspace()
 * - deleteForward()
 * - deleteRange(start, end)
 * - clear()
 * - setText(text)
 * - charAt(index)
 * 
 * Serialization API:
 * - toSerializable()
 * - fromText(text)
 * - fromSerializable(data)
 *
 * Debug API:
 * - debugSnapshot()
 * - debugValidate()
 *
 *
 * @example
 * const buffer = new GapBuffer();
 *
 * buffer.insert("hello");
 * buffer.moveCursor(2);
 * buffer.insert("X");
 *
 * console.log(buffer.toString()); // "heXllo"
 * console.log(buffer.cursor);     // 3
 * console.log(buffer.length);     // 6
 *
 *
 */





/**
 * Mutable circular gap buffer data structure.
 *

 */
export default class CircularGapBuffer {
  /** @type {Array<string|null>} */
  #buffer;

  /**
   * Physical index where the circular gap begins.
   * Insertions write at this index.
   *
   * Example before inserting "X" at the cursor:
   *
   *   Logical text:
   *
   *     "abc|def"
   *         ^ cursor
   *
   *   Physical ring:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *                   ^       ^
   *                   |       |
   *                gapEnd  gapStart
   *
   *   Insertion writes at gapStart, then advances gapStart clockwise.
   *
   * @type {number}
   */
  #gapStart;

  /**
   * Physical index immediately after the circular gap.
   * The text after the cursor begins at this index.
   *
   * Example:
   *
   *   Logical text:
   *
   *     before cursor:  "abc"
   *     after cursor:   "def"
   *
   *   Physical ring:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *       ^           ^       ^
   *       |           |       |
   *    gapEnd      empty   gapStart
   *
   *   The text after the cursor starts at gapEnd and continues clockwise.
   *
   * @type {number}
   */
  #gapEnd;

  /**
   * Logical cursor position in the text.
   * This is independent from the physical gap index.
   *
   * In a linear gap buffer, people often think:
   *
   *   cursor === gapStart
   *
   * In a circular gap buffer, this is no longer true:
   *
   *   cursor    = logical text position
   *   gapStart  = physical array position
   *
   * Example:
   *
   *   Logical cursor position is 3:
   *
   *     a b c | d e f
   *     0 1 2 3
   *
   *   But physical gapStart might be 5:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *                       ^
   *                       gapStart
   *
   * @type {number}
   */
  #cursor;

  /**
   * Number of actual UTF-16 code units stored in the buffer.
   *
   * The internal array has this many real characters:
   *
   *   length = number of non-gap slots
   *
   * And this many empty gap slots:
   *
   *   gapSize = capacity - length
   *
   * Example:
   *
   *       capacity = 8
   *       length   = 6
   *       gapSize  = 2
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *
   * @type {number}
   */
  #length;

  /**
   * Creates a new empty circular gap buffer.
   *
   * Non-finite initial sizes fall back to 16. Finite values are floored
   * and clamped to at least 1.
   *
   * Initial state:
   *
   *       0   1   2   3
   *     +---+---+---+---+
   *     |   |   |   |   |
   *     +---+---+---+---+
   *       ^
   *       gapStart and gapEnd are both 0
   *
   * The whole array is gap space.
   *
   * @param {number} [initialSize=16] - Initial capacity of the internal buffer.
   */
  constructor(initialSize = 16) {
    const size = Number.isFinite(initialSize)
      ? Math.max(1, Math.floor(initialSize))
      : 16;

    this.#buffer = new Array(size).fill(null);
    this.#gapStart = 0;
    this.#gapEnd = 0;
    this.#cursor = 0;
    this.#length = 0;
  }

  // ----------------------------
  // Public API
  // ----------------------------

  /**
   * Returns the number of actual characters stored in the buffer.
   *
   * This excludes the unused gap area.
   *
   * @returns {number} The current text length.
   */
  get length() {
    return this.#length;
  }

  /**
   * Returns the current logical cursor position.
   *
   * @returns {number} The current cursor index.
   */
  get cursor() {
    return this.#cursor;
  }

  /**
   * Returns the total capacity of the internal buffer.
   *
   * This includes both real characters and unused gap space.
   *
   * @returns {number} The internal buffer capacity.
   */
  get capacity() {
    return this.#buffer.length;
  }

  /**
   * Indicates whether the buffer contains no text.
   *
   * @returns {boolean} True if the buffer is empty, otherwise false.
   */
  get isEmpty() {
    return this.#length === 0;
  }

  /**
   * Converts the circular gap buffer contents into a normal string.
   *
   * The internal circular gap is skipped.
   *
   * Example:
   *
   *   Physical ring:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *
   *   Logical read order:
   *
   *     a -> b -> c -> d -> e -> f
   *
   *   toString():
   *
   *     "abcdef"
   *
   * @returns {string} The text stored in the buffer.
   */
  toString() {
    const chars = new Array(this.#length);

    for (let i = 0; i < this.#length; i++) {
      chars[i] = this.#buffer[this.#physicalIndex(i)];
    }

    return chars.join("");
  }

  /**
   * Moves the cursor to the given logical text position.
   *
   * Numeric positions outside the valid range are clamped to [0, this.length].
   * Invalid positions such as NaN or non-number values throw a TypeError.
   *
   * Moving the cursor means moving the gap.
   *
   *   Move left:
   *
   *     before:
   *       a b c | d e f
   *
   *     after one step left:
   *       a b | c d e f
   *
   *   Move right:
   *
   *     before:
   *       a b c | d e f
   *
   *     after one step right:
   *       a b c d | e f
   *
   * Internally this is done by copying one character across the gap.
   *
   * @param {number} position - Desired cursor position.
   * @throws {TypeError} If position is not a valid number.
   * @returns {CircularGapBuffer} This buffer instance, for method chaining.
   */
  moveCursor(position) {
    const target = this.#clampPosition(position);

    // A zero-sized gap cannot be moved safely because there is no empty slot
    // to shift characters through. Grow once to create space.
    if (target !== this.#cursor && this.#gapSize === 0) {
      this.#ensureGapSpace(1);
    }

    while (target < this.#cursor) {
      this.#moveGapLeft();
    }

    while (target > this.#cursor) {
      this.#moveGapRight();
    }

    return this;
  }

  /**
   * Inserts text at the current cursor position.
   *
   * If the gap is too small, the internal buffer automatically grows.
   *
   * Example inserting "X":
   *
   *   Logical before:
   *
   *     abc|def
   *
   *   Physical before:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *                   ^       ^
   *                   |       |
   *                gapEnd  gapStart
   *
   *   Write "X" at gapStart and advance gapStart:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   | X | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *                   ^   ^
   *                   |   |
   *                gapEnd gapStart
   *
   *   Logical after:
   *
   *     abcX|def
   *
   * @param {string} text - Text to insert at the cursor.
   * @throws {TypeError} If text is not a string.
   * @returns {CircularGapBuffer} This buffer instance, for method chaining.
   */
  insert(text) {
    if (typeof text !== "string") {
      throw new TypeError("CircularGapBuffer.insert() expects a string.");
    }

    if (text.length === 0) return this;

    this.#ensureGapSpace(text.length);

    for (let i = 0; i < text.length; i++) {
      this.#buffer[this.#gapStart] = text[i];
      this.#gapStart = this.#next(this.#gapStart);
      this.#cursor++;
      this.#length++;
    }

    return this;
  }

  /**
   * Deletes the character immediately before the cursor.
   *
   * This behaves like the Backspace key in a text editor.
   *
   * Logical example:
   *
   *     before:  abc|def
   *     delete:    c
   *     after:   ab|def
   *
   * Physical idea:
   *
   *     gapStart moves one slot backward, turning the previous character slot
   *     into new gap space.
   *
   *       before:
   *
   *         ... [ c ][ gap ][ after... ]
   *                 ^
   *              gapStart is just after c
   *
   *       after:
   *
   *         ... [   ][ gap ][ after... ]
   *             ^
   *          gapStart moved backward
   *
   * @returns {string|null} The deleted character; null if nothing was deleted.
   */
  backspace() {
    if (this.#cursor === 0) return null;

    this.#gapStart = this.#prev(this.#gapStart);

    const deleted = this.#buffer[this.#gapStart];
    this.#buffer[this.#gapStart] = null;

    this.#cursor--;
    this.#length--;

    return deleted;
  }

  /**
   * Deletes the character immediately after the cursor.
   *
   * This behaves like the Delete key in a text editor.
   *
   * Logical example:
   *
   *     before:  abc|def
   *     delete:     d
   *     after:   abc|ef
   *
   * Physical idea:
   *
   *     gapEnd moves one slot forward, absorbing the first character after
   *     the cursor into the gap.
   *
   *       before:
   *
   *         [ gap ][ d ][ e ][ f ]
   *                 ^
   *              gapEnd
   *
   *       after:
   *
   *         [ gap gap ][ e ][ f ]
   *                     ^
   *                  gapEnd moved forward
   *
   * @returns {string|null} The deleted character; null if nothing was deleted.
   */
  deleteForward() {
    if (this.#cursor === this.#length) return null;

    const deleted = this.#buffer[this.#gapEnd];
    this.#buffer[this.#gapEnd] = null;
    this.#gapEnd = this.#next(this.#gapEnd);
    this.#length--;

    return deleted;
  }

  /**
   * Deletes a range of characters from the buffer.
   *
   * The range is interpreted as [start, end), meaning start is included
   * and end is excluded.
   *
   * Logical example:
   *
   *     text:        abcdefgh
   *     range:          ^^^
   *                  delete [2, 5)
   *
   *     result:      abfgh
   *
   * Implementation idea:
   *
   *     1. Move the cursor to start.
   *     2. Repeatedly deleteForward().
   *
   * That turns range deletion into a simple sequence of normal gap operations.
   *
   * Numeric positions outside the valid range are clamped. Invalid positions
   * such as NaN or non-number values throw a TypeError.
   *
   * @param {number} start - Start index of the range to delete.
   * @param {number} end - End index of the range to delete.
   * @throws {TypeError} If start or end is not a valid number.
   * @returns {number} The number of characters deleted.
   */
  deleteRange(start, end) {
    const safeStart = this.#clampPosition(start);
    const safeEnd = Math.max(safeStart, this.#clampPosition(end));
    const count = safeEnd - safeStart;

    this.moveCursor(safeStart);

    for (let i = 0; i < count; i++) {
      this.deleteForward();
    }

    return count;
  }

  /**
   * Removes all text from the buffer.
   *
   * The internal capacity is preserved.
   *
   * Before:
   *
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *
   * After:
   *
   *     +---+---+---+---+---+---+---+---+
   *     |   |   |   |   |   |   |   |   |
   *     +---+---+---+---+---+---+---+---+
   *       ^
   *       gapStart and gapEnd reset to 0
   *
   * @returns {CircularGapBuffer} This buffer instance, for method chaining.
   */
  clear() {
    this.#buffer.fill(null);
    this.#gapStart = 0;
    this.#gapEnd = 0;
    this.#cursor = 0;
    this.#length = 0;

    return this;
  }

  /**
   * Replaces the entire contents of the buffer with new text.
   *
   * The internal buffer is recreated with enough capacity to hold the text
   * plus extra gap space for future insertions. After this operation, the
   * cursor is positioned at the end of the inserted text.
   *
   * Example setText("hello"):
   *
   *     logical text:
   *
   *       hello|
   *
   *     normalized physical layout:
   *
   *       0   1   2   3   4   5   6   ...
   *     +---+---+---+---+---+---+---+
   *     | h | e | l | l | o |   |   |
   *     +---+---+---+---+---+---+---+
   *                       ^
   *                       gapStart and cursor are at the end
   *
   * @param {string} text - New text content for the buffer.
   * @throws {TypeError} If text is not a string.
   * @returns {CircularGapBuffer} This buffer instance, for method chaining.
   */
  setText(text) {
    if (typeof text !== "string") {
      throw new TypeError("CircularGapBuffer.setText() expects a string.");
    }

    const size = Math.max(1, text.length * 2, 16);

    this.#buffer = new Array(size).fill(null);
    this.#gapStart = 0;
    this.#gapEnd = 0;
    this.#cursor = 0;
    this.#length = 0;

    return this.insert(text);
  }

  /**
   * Returns the character at the given logical text index.
   *
   * Numeric positions outside the valid range are clamped. If the final
   * position is equal to the text length, an empty string is returned.
   *
   * Example:
   *
   *     logical text:     a b c d e f
   *     logical indexes:  0 1 2 3 4 5
   *
   *     charAt(4) -> "e"
   *
   * Even if the physical layout is wrapped:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *
   *     logical index 4 maps to physical index 1.
   *
   * Note:
   * This is slightly different from String.prototype.charAt(): negative
   * indexes are clamped to 0 instead of returning "".
   *
   * @param {number} index - Logical text index.
   * @throws {TypeError} If index is not a valid number.
   * @returns {string} Character at the index, or an empty string at the end.
   */
  charAt(index) {
    const safeIndex = this.#clampPosition(index);

    if (safeIndex === this.#length) return "";

    return this.#buffer[this.#physicalIndex(safeIndex)];
  }

  /**
   * Creates a serializable representation of the buffer.
   *
   * This stores the logical text and cursor position, not the internal
   * circular array. The internal representation is intentionally omitted so
   * future versions can change the implementation without breaking saved data.
   *
   * Serialized shape:
   *
   *     {
   *       version: 1,
   *       text: "abcdef",
   *       cursor: 3
   *     }
   *
   * This is independent of whether the physical buffer currently looks like:
   *
   *     abc[ gap ]def
   *
   * or:
   *
   *     def[ gap ]abc
   *
   * @returns {{ version: number, text: string, cursor: number }}
   * A plain serializable object representing the buffer state.
   */
  toSerializable() {
    return {
      version: 1,
      text: this.toString(),
      cursor: this.#cursor,
    };
  }

  /**
   * Creates a new CircularGapBuffer from text.
   *
   * The cursor is positioned at the end of the inserted text.
   *
   * @param {string} text - Text used to initialize the buffer.
   * @throws {TypeError} If text is not a string.
   * @returns {CircularGapBuffer} A new circular gap buffer containing the text.
   */
  static fromText(text) {
    if (typeof text !== "string") {
      throw new TypeError("CircularGapBuffer.fromText() expects a string.");
    }

    const buffer = new CircularGapBuffer(Math.max(16, text.length * 2));
    buffer.insert(text);

    return buffer;
  }

  /**
   * Creates a new CircularGapBuffer from serialized buffer data.
   *
   * @param {{ version: number, text: string, cursor: number }} data
   * Serializable buffer data.
   * @throws {TypeError} If the data is malformed.
   * @returns {CircularGapBuffer} A new buffer restored from serialized data.
   */
  static fromSerializable(data) {
    if (data === null || typeof data !== "object") {
      throw new TypeError("CircularGapBuffer.fromSerializable() expects an object.");
    }

    if (data.version !== 1) {
      throw new TypeError("Unsupported CircularGapBuffer serialization version.");
    }

    if (typeof data.text !== "string") {
      throw new TypeError("Serialized CircularGapBuffer text must be a string.");
    }

    if (typeof data.cursor !== "number" || Number.isNaN(data.cursor)) {
      throw new TypeError(
        "Serialized CircularGapBuffer cursor must be a valid number."
      );
    }

    const buffer = CircularGapBuffer.fromText(data.text);
    buffer.moveCursor(data.cursor);

    return buffer;
  }

  /**
   * Returns a debugging snapshot of the current internal state.
   *
   * The `logicalToPhysical` array is especially useful for learning.
   *
   * Example:
   *
   *     logical text:       a b c d e f
   *     logical indexes:    0 1 2 3 4 5
   *     physical indexes:   5 6 7 0 1 2
   *
   *     logicalToPhysical = [5, 6, 7, 0, 1, 2]
   *
   * @returns {{
   *   text: string,
   *   cursor: number,
   *   length: number,
   *   capacity: number,
   *   gapStart: number,
   *   gapEnd: number,
   *   gapSize: number,
   *   buffer: Array<string|null>,
   *   logicalToPhysical: Array<number>
   * }} A snapshot of the circular gap buffer state.
   */
  debugSnapshot() {
    return {
      text: this.toString(),
      cursor: this.#cursor,
      length: this.#length,
      capacity: this.capacity,
      gapStart: this.#gapStart,
      gapEnd: this.#gapEnd,
      gapSize: this.#gapSize,
      buffer: [...this.#buffer],
      logicalToPhysical: Array.from({ length: this.#length }, (_, index) =>
        this.#physicalIndex(index)
      ),
    };
  }

  /**
   * Validates the internal circular gap buffer state.
   *
   * This method is intended for debugging and testing. If the buffer is valid,
   * it returns true. If the buffer is invalid, it throws an error.
   *
   * @throws {Error} If the internal state is invalid.
   * @returns {boolean} True if the internal state is valid.
   */
  debugValidate() {
    this.#assertInvariant();
    return true;
  }

  // ----------------------------
  // Private internals
  // ----------------------------

  /** @returns {number} The number of unused slots in the circular gap. */
  get #gapSize() {
    return this.capacity - this.#length;
  }

  /**
   * Wraps an index into the valid physical buffer range.
   *
   * Example with capacity 8:
   *
   *     #mod( 0) -> 0
   *     #mod( 7) -> 7
   *     #mod( 8) -> 0
   *     #mod( 9) -> 1
   *     #mod(-1) -> 7
   *
   * This is what makes the array circular.
   *
   * @param {number} index - Possibly out-of-range index.
   * @returns {number} Wrapped physical index.
   */
  #mod(index) {
    const size = this.capacity;
    return ((index % size) + size) % size;
  }

  /** @param {number} index @returns {number} Next physical index. */
  #next(index) {
    return (index + 1) % this.capacity;
  }

  /** @param {number} index @returns {number} Previous physical index. */
  #prev(index) {
    return (index - 1 + this.capacity) % this.capacity;
  }

  /**
   * Maps a logical text index to a physical array index.
   *
   * The logical text is split around the cursor:
   *
   *   logical text:
   *
   *     before cursor     after cursor
   *     a b c          |  d e f
   *
   *   physical ring:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *       ^           ^       ^
   *       |           |       |
   *    gapEnd      empty   gapStart
   *
   * Rule:
   *
   *   - indexes before the cursor are counted backward from gapStart
   *   - indexes at/after the cursor are counted forward from gapEnd
   *
   * In the example:
   *
   *     logical index 0, "a" -> physical index 5
   *     logical index 1, "b" -> physical index 6
   *     logical index 2, "c" -> physical index 7
   *     logical index 3, "d" -> physical index 0
   *     logical index 4, "e" -> physical index 1
   *     logical index 5, "f" -> physical index 2
   *
   * @param {number} logicalIndex - Logical index in [0, this.length).
   * @returns {number} Physical array index.
   */
  #physicalIndex(logicalIndex) {
    if (logicalIndex < this.#cursor) {
      return this.#mod(this.#gapStart - this.#cursor + logicalIndex);
    }

    return this.#mod(this.#gapEnd + (logicalIndex - this.#cursor));
  }

  /**
   * Clamps a position so that it lies inside the valid text range.
   *
   * Finite numeric positions are truncated to integers. Infinity is clamped
   * to the end of the buffer, and -Infinity is clamped to the beginning.
   *
   * @param {number} position - Position to clamp.
   * @throws {TypeError} If position is not a valid number.
   * @returns {number} A valid cursor/text position.
   */
  #clampPosition(position) {
    if (typeof position !== "number" || Number.isNaN(position)) {
      throw new TypeError("Position must be a valid number.");
    }

    if (position === Infinity) return this.#length;
    if (position === -Infinity) return 0;

    return Math.max(0, Math.min(Math.trunc(position), this.#length));
  }

  /**
   * Ensures that the circular gap has at least `required` unused slots.
   *
   * Example:
   *
   *     Need to insert 5 characters.
   *     Current gap has only 2 slots.
   *
   *     grow until:
   *
   *       newCapacity - length >= 5
   *
   * This keeps insertions amortized efficient: most inserts write directly
   * into existing gap space, and occasional large rebuilds create more room.
   *
   * @param {number} required - Required gap space.
   * @returns {void}
   */
  #ensureGapSpace(required) {
    if (required <= this.#gapSize) return;

    let newSize = this.capacity;

    do {
      newSize = Math.max(1, newSize * 2);
    } while (newSize - this.#length < required);

    this.#rebuild(newSize);
  }

  /**
   * Rebuilds the internal array with a new capacity.
   *
   * The logical text and cursor are preserved. The new physical layout is
   * normalized so that text before the cursor starts at index 0, the gap sits
   * after it, and text after the cursor is placed after the gap.
   *
   * Before rebuild, physical layout may be wrapped:
   *
   *       0   1   2   3   4   5   6   7
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *
   * Logical text:
   *
   *     abc|def
   *
   * After rebuild into a larger normalized array:
   *
   *       0   1   2   3   4   5   6   7   8   9
   *     +---+---+---+---+---+---+---+---+---+---+
   *     | a | b | c |   |   |   |   | d | e | f |
   *     +---+---+---+---+---+---+---+---+---+---+
   *               ^               ^
   *               |               |
   *            gapStart        gapEnd
   *
   * The text is still logically:
   *
   *     abc|def
   *
   * @param {number} newCapacity - New internal buffer capacity.
   * @returns {void}
   */
  #rebuild(newCapacity) {
    const chars = new Array(this.#length);

    for (let i = 0; i < this.#length; i++) {
      chars[i] = this.#buffer[this.#physicalIndex(i)];
    }

    const newBuffer = new Array(newCapacity).fill(null);
    const newGapStart = this.#cursor;
    const newGapSize = newCapacity - this.#length;
    const newGapEnd = newGapSize === newCapacity ? 0 : newGapStart + newGapSize;

    for (let i = 0; i < this.#cursor; i++) {
      newBuffer[i] = chars[i];
    }

    for (let i = this.#cursor; i < this.#length; i++) {
      newBuffer[newGapEnd + (i - this.#cursor)] = chars[i];
    }

    this.#buffer = newBuffer;
    this.#gapStart = newGapStart % newCapacity;
    this.#gapEnd = newGapEnd % newCapacity;
  }

  /**
   * Moves the circular gap one character to the left.
   *
   * The character immediately before the cursor moves to the beginning of the
   * text after the cursor.
   *
   * Logical view:
   *
   *     before:
   *
   *       a b c | d e f
   *           ^
   *           character crossing the gap
   *
   *     after:
   *
   *       a b | c d e f
   *
   * Physical idea:
   *
   *     1. Move gapStart backward.
   *     2. Move gapEnd backward.
   *     3. Copy the character at the new gapStart to the new gapEnd.
   *     4. Clear the new gapStart slot.
   *
   * Diagram:
   *
   *     before moving left:
   *
   *       [ before... ][ c ][ gap gap ][ after... ]
   *                      ^             ^
   *                   previous      gapEnd
   *                   character
   *
   *     after moving left:
   *
   *       [ before... ][ gap gap ][ c ][ after... ]
   *                    ^          ^
   *                 gapStart   gapEnd
   *
   * @returns {void}
   */
  #moveGapLeft() {
    if (this.#cursor === 0) return;

    this.#gapStart = this.#prev(this.#gapStart);
    this.#gapEnd = this.#prev(this.#gapEnd);

    this.#buffer[this.#gapEnd] = this.#buffer[this.#gapStart];
    this.#buffer[this.#gapStart] = null;

    this.#cursor--;
  }

  /**
   * Moves the circular gap one character to the right.
   *
   * The character immediately after the cursor moves to the end of the text
   * before the cursor.
   *
   * Logical view:
   *
   *     before:
   *
   *       a b c | d e f
   *               ^
   *               character crossing the gap
   *
   *     after:
   *
   *       a b c d | e f
   *
   * Physical idea:
   *
   *     1. Copy the character at gapEnd into gapStart.
   *     2. Clear the old gapEnd slot.
   *     3. Move gapStart forward.
   *     4. Move gapEnd forward.
   *
   * Diagram:
   *
   *     before moving right:
   *
   *       [ before... ][ gap gap ][ d ][ after... ]
   *                    ^          ^
   *                 gapStart   gapEnd
   *
   *     after moving right:
   *
   *       [ before... ][ d ][ gap gap ][ after... ]
   *                         ^          ^
   *                      gapStart   gapEnd
   *
   * @returns {void}
   */
  #moveGapRight() {
    if (this.#cursor === this.#length) return;

    this.#buffer[this.#gapStart] = this.#buffer[this.#gapEnd];
    this.#buffer[this.#gapEnd] = null;

    this.#gapStart = this.#next(this.#gapStart);
    this.#gapEnd = this.#next(this.#gapEnd);

    this.#cursor++;
  }

  /**
   * Checks whether the internal circular gap state is valid.
   *
   * The core invariants are:
   *
   *   1. length is between 0 and capacity.
   *   2. cursor is between 0 and length.
   *   3. gapStart and gapEnd are valid physical indexes.
   *   4. the circular distance from gapStart to gapEnd equals gapSize,
   *      except when the gap is empty or the whole array is gap space.
   *   5. every logical character maps to exactly one non-null physical slot.
   *   6. the number of null slots equals gapSize.
   *
   * Visual invariant:
   *
   *     All null slots belong to the gap.
   *     All non-null slots belong to logical text.
   *
   *     +---+---+---+---+---+---+---+---+
   *     | d | e | f |   |   | a | b | c |
   *     +---+---+---+---+---+---+---+---+
   *                   ^^^^^
   *                   gap
   *
   * @throws {Error} If the internal circular gap state is invalid.
   * @returns {void}
   */
  #assertInvariant() {
    const capacity = this.capacity;
    const gapSize = this.#gapSize;

    if (capacity < 1) {
      throw new Error("Invalid circular gap state: capacity must be at least 1.");
    }

    if (!Number.isInteger(this.#length) || this.#length < 0 || this.#length > capacity) {
      throw new Error(
        `Invalid circular gap state: length=${this.#length}, capacity=${capacity}.`
      );
    }

    if (!Number.isInteger(this.#cursor) || this.#cursor < 0 || this.#cursor > this.#length) {
      throw new Error(
        `Invalid circular gap state: cursor=${this.#cursor}, length=${this.#length}.`
      );
    }

    if (
      !Number.isInteger(this.#gapStart) ||
      this.#gapStart < 0 ||
      this.#gapStart >= capacity ||
      !Number.isInteger(this.#gapEnd) ||
      this.#gapEnd < 0 ||
      this.#gapEnd >= capacity
    ) {
      throw new Error(
        [
          "Invalid circular gap indexes:",
          `gapStart=${this.#gapStart}`,
          `gapEnd=${this.#gapEnd}`,
          `capacity=${capacity}`,
        ].join(" ")
      );
    }

    const circularDistance = this.#mod(this.#gapEnd - this.#gapStart);

    if (gapSize === 0 || gapSize === capacity) {
      if (this.#gapStart !== this.#gapEnd) {
        throw new Error(
          [
            "Invalid circular gap boundary state:",
            `gapStart=${this.#gapStart}`,
            `gapEnd=${this.#gapEnd}`,
            `gapSize=${gapSize}`,
          ].join(" ")
        );
      }
    } else if (circularDistance !== gapSize) {
      throw new Error(
        [
          "Invalid circular gap size:",
          `gapStart=${this.#gapStart}`,
          `gapEnd=${this.#gapEnd}`,
          `distance=${circularDistance}`,
          `gapSize=${gapSize}`,
        ].join(" ")
      );
    }

    const seen = new Set();

    for (let i = 0; i < this.#length; i++) {
      const physical = this.#physicalIndex(i);

      if (seen.has(physical)) {
        throw new Error(
          `Invalid circular gap mapping: duplicate physical index ${physical}.`
        );
      }

      seen.add(physical);

      if (this.#buffer[physical] === null) {
        throw new Error(
          `Invalid circular gap mapping: logical index ${i} maps to null slot ${physical}.`
        );
      }
    }

    let nullCount = 0;

    for (let i = 0; i < capacity; i++) {
      if (this.#buffer[i] === null) {
        nullCount++;
      }
    }

    if (nullCount !== gapSize) {
      throw new Error(
        `Invalid circular gap null count: nullCount=${nullCount}, gapSize=${gapSize}.`
      );
    }
  }
}
