/**
 * History Manager — bounded undo/redo for user-authored world edits.
 * Entries are plain { undo(), redo() } functions; callers capture the
 * minimal serializable before/after data at push time.
 * Per-frame motion (trains, smoke, camera) never enters history.
 */
export class HistoryManager {
  constructor(limit = 50) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.onChange = null;
  }

  push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    entry.undo();
    this.redoStack.push(entry);
    this.notify();
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    entry.redo();
    this.undoStack.push(entry);
    this.notify();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  notify() {
    if (this.onChange) this.onChange();
  }
}
