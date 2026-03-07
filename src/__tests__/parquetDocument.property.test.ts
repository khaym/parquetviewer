import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ParquetDocument } from "../parquetDocument";
import type { ParquetSchema, ParquetRow } from "../../shared/types";

const schema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: true },
  { name: "value", type: "FLOAT", nullable: true },
];

function makeDoc(rowCount: number): ParquetDocument {
  const rows: ParquetRow[] = Array.from({ length: rowCount }, (_, i) => ({
    id: i,
    name: `row${i}`,
    value: i * 1.5,
  }));
  return new ParquetDocument(schema, rows);
}

// ── getPage invariants ─────────────────────────────────────────

describe("ParquetDocument.getPage — property-based", () => {
  it("page rows never exceed pageSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),  // rowCount
        fc.integer({ min: 0, max: 20 }),   // pageIndex
        fc.integer({ min: 1, max: 100 }),  // pageSize
        (rowCount, pageIndex, pageSize) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(pageIndex, pageSize);
          expect(page.rows.length).toBeLessThanOrEqual(pageSize);
        },
      ),
    );
  });

  it("totalRows is always the full document row count", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        (rowCount, pageIndex, pageSize) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(pageIndex, pageSize);
          expect(page.totalRows).toBe(rowCount);
        },
      ),
    );
  });

  it("pageIndex and pageSize are echoed back correctly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        (rowCount, pageIndex, pageSize) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(pageIndex, pageSize);
          expect(page.pageIndex).toBe(pageIndex);
          expect(page.pageSize).toBe(pageSize);
        },
      ),
    );
  });

  it("pages cover all rows without overlap or gap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (rowCount, pageSize) => {
          const doc = makeDoc(rowCount);
          const totalPages = Math.ceil(rowCount / pageSize);
          let collectedRows = 0;

          for (let i = 0; i < totalPages; i++) {
            const page = doc.getPage(i, pageSize);
            collectedRows += page.rows.length;
          }

          expect(collectedRows).toBe(rowCount);
        },
      ),
    );
  });

  it("page beyond data returns empty rows", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 1, max: 20 }),
        (rowCount, pageSize) => {
          const doc = makeDoc(rowCount);
          const beyondIndex = Math.ceil(rowCount / pageSize) + 1;
          const page = doc.getPage(beyondIndex, pageSize);
          expect(page.rows.length).toBe(0);
        },
      ),
    );
  });
});

// ── getPage with filters invariants ────────────────────────────

describe("ParquetDocument.getPage with filters — property-based", () => {
  it("filteredTotalRows <= totalRows", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: -50, max: 150 }),
        (rowCount, pageSize, threshold) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(0, pageSize, [
            { column: "id", operator: "gt", value: threshold },
          ]);
          expect(page.filteredTotalRows).toBeLessThanOrEqual(page.totalRows);
        },
      ),
    );
  });

  it("rowIndices are within [0, totalRows) and ascending", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (rowCount, pageSize) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(0, pageSize, [
            { column: "id", operator: "gt", value: rowCount / 2 },
          ]);
          const indices = page.rowIndices!;
          for (let i = 0; i < indices.length; i++) {
            expect(indices[i]).toBeGreaterThanOrEqual(0);
            expect(indices[i]).toBeLessThan(rowCount);
            if (i > 0) expect(indices[i]).toBeGreaterThan(indices[i - 1]);
          }
        },
      ),
    );
  });

  it("filtered page rows count <= pageSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        (rowCount, pageIndex, pageSize) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(pageIndex, pageSize, [
            { column: "name", operator: "contains", value: "row" },
          ]);
          expect(page.rows.length).toBeLessThanOrEqual(pageSize);
        },
      ),
    );
  });

  it("no filters → no filteredTotalRows/rowIndices", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (rowCount) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(0, 10);
          expect(page.filteredTotalRows).toBeUndefined();
          expect(page.rowIndices).toBeUndefined();
        },
      ),
    );
  });

  it("empty filters array → no filteredTotalRows/rowIndices", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (rowCount) => {
          const doc = makeDoc(rowCount);
          const page = doc.getPage(0, 10, []);
          expect(page.filteredTotalRows).toBeUndefined();
          expect(page.rowIndices).toBeUndefined();
        },
      ),
    );
  });
});

// ── Edit + undo/redo invariants ────────────────────────────────

describe("ParquetDocument edit/undo/redo — property-based", () => {
  it("undo after edit restores original value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.string({ minLength: 1 }),
        (rowCount, newName) => {
          const doc = makeDoc(rowCount);
          const rowIdx = 0;
          const original = doc.currentRows[rowIdx].name;
          if (original === newName) return; // skip no-op

          doc.editCell(rowIdx, "name", newName);
          expect(doc.currentRows[rowIdx].name).toBe(newName);

          doc.undo();
          expect(doc.currentRows[rowIdx].name).toBe(original);
        },
      ),
    );
  });

  it("redo after undo restores edited value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.string({ minLength: 1 }),
        (rowCount, newName) => {
          const doc = makeDoc(rowCount);
          const original = doc.currentRows[0].name;
          if (original === newName) return;

          doc.editCell(0, "name", newName);
          doc.undo();
          doc.redo();
          expect(doc.currentRows[0].name).toBe(newName);
        },
      ),
    );
  });

  it("N edits followed by N undos restores original state", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        (edits) => {
          const doc = makeDoc(5);
          const original = doc.currentRows[0].name;

          for (const val of edits) {
            doc.editCell(0, "name", val);
          }

          // Undo all (some may be no-ops if consecutive values are the same)
          let undoCount = 0;
          while (doc.undo()) undoCount++;

          expect(doc.currentRows[0].name).toBe(original);
        },
      ),
    );
  });
});
