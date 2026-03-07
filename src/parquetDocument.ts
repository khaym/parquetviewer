import type { ParquetSchema, ParquetRow, DataPage, ColumnFilter } from "../shared/types";
import { filterRowsWithIndices } from "../shared/filterRows";

/**
 * A single cell edit operation, stored in the undo/redo stack.
 */
interface CellEdit {
  rowIndex: number;
  column: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * In-memory document model for a Parquet file.
 * Manages edit state, dirty tracking, and undo/redo.
 */
export class ParquetDocument {
  readonly schema: ParquetSchema;
  private _rows: ParquetRow[];
  private _undoStack: CellEdit[] = [];
  private _redoStack: CellEdit[] = [];
  /**
   * Index into the undo stack where the document was last saved.
   * Used to determine isDirty by comparing current stack position.
   */
  private _savedAtUndoIndex = 0;

  constructor(schema: ParquetSchema, rows: ParquetRow[]) {
    this.schema = schema;
    this._rows = rows.map((r) => ({ ...r }));
  }

  /** Current rows (defensive copy). */
  get currentRows(): ParquetRow[] {
    return this._rows.map((r) => ({ ...r }));
  }

  /** Total number of rows. */
  get totalRows(): number {
    return this._rows.length;
  }

  /** Whether the document has unsaved changes. */
  get isDirty(): boolean {
    return this._undoStack.length !== this._savedAtUndoIndex;
  }

  /** Whether there are edits that can be undone. */
  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  /** Whether there are edits that can be redone. */
  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  /**
   * Edit a single cell value.
   * No-op if the new value equals the current value.
   */
  editCell(rowIndex: number, column: string, value: unknown): void {
    if (rowIndex < 0 || rowIndex >= this._rows.length) {
      throw new Error(
        `Row index ${rowIndex} out of bounds (0-${this._rows.length - 1})`,
      );
    }

    const oldValue = this._rows[rowIndex][column];

    // Skip if value is the same (no-op)
    if (Object.is(oldValue, value)) {
      return;
    }

    this._undoStack.push({ rowIndex, column, oldValue, newValue: value });
    this._redoStack = [];
    this._rows[rowIndex] = { ...this._rows[rowIndex], [column]: value };
  }

  /**
   * Undo the last edit. Returns false if nothing to undo.
   */
  undo(): boolean {
    const edit = this._undoStack.pop();
    if (!edit) return false;

    this._rows[edit.rowIndex] = {
      ...this._rows[edit.rowIndex],
      [edit.column]: edit.oldValue,
    };
    this._redoStack.push(edit);
    return true;
  }

  /**
   * Redo the last undone edit. Returns false if nothing to redo.
   */
  redo(): boolean {
    const edit = this._redoStack.pop();
    if (!edit) return false;

    this._rows[edit.rowIndex] = {
      ...this._rows[edit.rowIndex],
      [edit.column]: edit.newValue,
    };
    this._undoStack.push(edit);
    return true;
  }

  /**
   * Get a page of rows for display.
   * When filters are provided and non-empty, returns paginated filtered results
   * with filteredTotalRows and rowIndices for index mapping.
   */
  getPage(pageIndex: number, pageSize: number, filters?: ColumnFilter[]): DataPage {
    const hasFilters = filters && filters.length > 0;

    if (hasFilters) {
      const { filteredRows, indices } = filterRowsWithIndices(
        this._rows,
        filters,
        this.schema,
      );
      const start = pageIndex * pageSize;
      const end = Math.min(start + pageSize, filteredRows.length);
      const pageRows =
        start >= filteredRows.length
          ? []
          : filteredRows.slice(start, end).map((r) => ({ ...r }));
      const pageIndices =
        start >= indices.length ? [] : indices.slice(start, end);

      return {
        rows: pageRows,
        pageIndex,
        pageSize,
        totalRows: this._rows.length,
        filteredTotalRows: filteredRows.length,
        rowIndices: pageIndices,
      };
    }

    const start = pageIndex * pageSize;
    const end = Math.min(start + pageSize, this._rows.length);
    const pageRows =
      start >= this._rows.length
        ? []
        : this._rows.slice(start, end).map((r) => ({ ...r }));

    return {
      rows: pageRows,
      pageIndex,
      pageSize,
      totalRows: this._rows.length,
    };
  }

  /**
   * Mark the document as saved at the current state.
   * isDirty will be false until further edits.
   */
  markSaved(): void {
    this._savedAtUndoIndex = this._undoStack.length;
  }

  /**
   * Revert to the last saved state, discarding all unsaved edits.
   * Clears both undo and redo stacks.
   */
  revert(): void {
    // Undo all edits back to the saved point
    while (this._undoStack.length > this._savedAtUndoIndex) {
      const edit = this._undoStack.pop()!;
      this._rows[edit.rowIndex] = {
        ...this._rows[edit.rowIndex],
        [edit.column]: edit.oldValue,
      };
    }
    this._redoStack = [];
  }
}
