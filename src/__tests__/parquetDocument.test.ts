import { describe, it, expect, beforeEach } from "vitest";
import { ParquetDocument } from "../parquetDocument";
import type { ParquetSchema, ParquetRow } from "../../shared/types";

// ── Test fixtures ──────────────────────────────────────────

const testSchema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: true },
  { name: "age", type: "INT32", nullable: true },
];

function makeRows(count: number): ParquetRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `user${i + 1}`,
    age: 20 + i,
  }));
}

// ── Tests ──────────────────────────────────────────────────

describe("ParquetDocument", () => {
  let doc: ParquetDocument;
  const rows = makeRows(5);

  beforeEach(() => {
    doc = new ParquetDocument(testSchema, rows);
  });

  // ── Construction ──

  describe("construction", () => {
    it("stores schema", () => {
      expect(doc.schema).toEqual(testSchema);
    });

    it("stores rows as a copy", () => {
      expect(doc.currentRows).toEqual(rows);
      expect(doc.currentRows).not.toBe(rows);
    });

    it("reports totalRows", () => {
      expect(doc.totalRows).toBe(5);
    });

    it("is not dirty initially", () => {
      expect(doc.isDirty).toBe(false);
    });

    it("has nothing to undo initially", () => {
      expect(doc.canUndo).toBe(false);
    });

    it("has nothing to redo initially", () => {
      expect(doc.canRedo).toBe(false);
    });
  });

  // ── editCell ──

  describe("editCell", () => {
    it("updates the specified cell value", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.currentRows[0].name).toBe("Alice");
    });

    it("does not modify other rows", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.currentRows[1].name).toBe("user2");
    });

    it("does not modify other columns in the same row", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.currentRows[0].id).toBe(1);
      expect(doc.currentRows[0].age).toBe(20);
    });

    it("sets isDirty to true", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.isDirty).toBe(true);
    });

    it("throws on row index out of bounds (negative)", () => {
      expect(() => doc.editCell(-1, "name", "x")).toThrow();
    });

    it("throws on row index out of bounds (too large)", () => {
      expect(() => doc.editCell(5, "name", "x")).toThrow();
    });

    it("allows setting a cell to null", () => {
      doc.editCell(0, "name", null);
      expect(doc.currentRows[0].name).toBeNull();
    });

    it("enables undo after edit", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.canUndo).toBe(true);
    });
  });

  // ── Undo ──

  describe("undo", () => {
    it("reverts the last edit", () => {
      doc.editCell(0, "name", "Alice");
      const result = doc.undo();
      expect(result).toBe(true);
      expect(doc.currentRows[0].name).toBe("user1");
    });

    it("returns false when nothing to undo", () => {
      expect(doc.undo()).toBe(false);
    });

    it("clears isDirty when all edits are undone", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.isDirty).toBe(true);
      doc.undo();
      expect(doc.isDirty).toBe(false);
    });

    it("handles multiple undos in sequence", () => {
      doc.editCell(0, "name", "Alice");
      doc.editCell(1, "name", "Bob");
      doc.editCell(2, "name", "Charlie");

      doc.undo();
      expect(doc.currentRows[2].name).toBe("user3");
      expect(doc.currentRows[1].name).toBe("Bob");

      doc.undo();
      expect(doc.currentRows[1].name).toBe("user2");
      expect(doc.currentRows[0].name).toBe("Alice");

      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1");
    });

    it("enables redo after undo", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      expect(doc.canRedo).toBe(true);
    });

    it("disables undo after all edits are undone", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      expect(doc.canUndo).toBe(false);
    });
  });

  // ── Redo ──

  describe("redo", () => {
    it("re-applies the last undone edit", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      const result = doc.redo();
      expect(result).toBe(true);
      expect(doc.currentRows[0].name).toBe("Alice");
    });

    it("returns false when nothing to redo", () => {
      expect(doc.redo()).toBe(false);
    });

    it("restores isDirty after redo", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      expect(doc.isDirty).toBe(false);
      doc.redo();
      expect(doc.isDirty).toBe(true);
    });

    it("clears redo stack when a new edit is made", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      expect(doc.canRedo).toBe(true);

      doc.editCell(0, "name", "Bob");
      expect(doc.canRedo).toBe(false);
    });

    it("handles undo-redo-undo-redo cycle", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      doc.redo();
      expect(doc.currentRows[0].name).toBe("Alice");
      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1");
      doc.redo();
      expect(doc.currentRows[0].name).toBe("Alice");
    });

    it("handles multiple redos in sequence", () => {
      doc.editCell(0, "name", "Alice");
      doc.editCell(1, "name", "Bob");
      doc.editCell(2, "name", "Charlie");

      doc.undo();
      doc.undo();
      doc.undo();

      doc.redo();
      expect(doc.currentRows[0].name).toBe("Alice");

      doc.redo();
      expect(doc.currentRows[1].name).toBe("Bob");

      doc.redo();
      expect(doc.currentRows[2].name).toBe("Charlie");
    });
  });

  // ── Undo/Redo with same cell ──

  describe("undo/redo with same cell edited multiple times", () => {
    it("tracks each edit independently", () => {
      doc.editCell(0, "name", "A");
      doc.editCell(0, "name", "B");
      doc.editCell(0, "name", "C");

      expect(doc.currentRows[0].name).toBe("C");

      doc.undo();
      expect(doc.currentRows[0].name).toBe("B");

      doc.undo();
      expect(doc.currentRows[0].name).toBe("A");

      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1");
    });
  });

  // ── getPage ──

  describe("getPage", () => {
    let bigDoc: ParquetDocument;

    beforeEach(() => {
      bigDoc = new ParquetDocument(testSchema, makeRows(25));
    });

    it("returns the first page", () => {
      const page = bigDoc.getPage(0, 10);
      expect(page.rows).toHaveLength(10);
      expect(page.pageIndex).toBe(0);
      expect(page.pageSize).toBe(10);
      expect(page.totalRows).toBe(25);
      expect(page.rows[0].id).toBe(1);
      expect(page.rows[9].id).toBe(10);
    });

    it("returns a middle page", () => {
      const page = bigDoc.getPage(1, 10);
      expect(page.rows).toHaveLength(10);
      expect(page.rows[0].id).toBe(11);
      expect(page.rows[9].id).toBe(20);
    });

    it("returns a partial last page", () => {
      const page = bigDoc.getPage(2, 10);
      expect(page.rows).toHaveLength(5);
      expect(page.rows[0].id).toBe(21);
      expect(page.rows[4].id).toBe(25);
    });

    it("returns an empty page if pageIndex is beyond data", () => {
      const page = bigDoc.getPage(3, 10);
      expect(page.rows).toHaveLength(0);
    });

    it("reflects edits in the page data", () => {
      bigDoc.editCell(0, "name", "Edited");
      const page = bigDoc.getPage(0, 10);
      expect(page.rows[0].name).toBe("Edited");
    });
  });

  // ── markSaved ──

  describe("markSaved", () => {
    it("clears isDirty after save", () => {
      doc.editCell(0, "name", "Alice");
      expect(doc.isDirty).toBe(true);
      doc.markSaved();
      expect(doc.isDirty).toBe(false);
    });

    it("marks dirty again when edited after save", () => {
      doc.editCell(0, "name", "Alice");
      doc.markSaved();
      doc.editCell(0, "name", "Bob");
      expect(doc.isDirty).toBe(true);
    });

    it("preserves undo stack after save", () => {
      doc.editCell(0, "name", "Alice");
      doc.markSaved();
      expect(doc.canUndo).toBe(true);
    });

    it("undoing past save point makes document dirty again", () => {
      doc.editCell(0, "name", "Alice");
      doc.markSaved();
      expect(doc.isDirty).toBe(false);
      doc.undo();
      expect(doc.isDirty).toBe(true);
    });

    it("redo back to save point clears dirty", () => {
      doc.editCell(0, "name", "Alice");
      doc.markSaved();
      doc.undo();
      expect(doc.isDirty).toBe(true);
      doc.redo();
      expect(doc.isDirty).toBe(false);
    });
  });

  // ── revert ──

  describe("revert", () => {
    it("restores rows to the last saved state", () => {
      doc.editCell(0, "name", "Alice");
      doc.editCell(1, "name", "Bob");
      doc.revert();
      expect(doc.currentRows).toEqual(rows);
    });

    it("clears isDirty", () => {
      doc.editCell(0, "name", "Alice");
      doc.revert();
      expect(doc.isDirty).toBe(false);
    });

    it("clears undo stack", () => {
      doc.editCell(0, "name", "Alice");
      doc.revert();
      expect(doc.canUndo).toBe(false);
    });

    it("clears redo stack", () => {
      doc.editCell(0, "name", "Alice");
      doc.undo();
      doc.revert();
      expect(doc.canRedo).toBe(false);
    });

    it("reverts to last saved state, not original", () => {
      doc.editCell(0, "name", "Alice");
      doc.markSaved();
      doc.editCell(0, "name", "Bob");
      doc.revert();
      expect(doc.currentRows[0].name).toBe("Alice");
    });
  });

  // ── getPage with filters ──

  describe("getPage with filters", () => {
    let bigDoc: ParquetDocument;

    beforeEach(() => {
      // 25 rows: id=1..25, name=user1..user25, age=20..44
      bigDoc = new ParquetDocument(testSchema, makeRows(25));
    });

    it("filters rows and paginates the filtered set", () => {
      // age >= 40 means rows with age 40,41,42,43,44 => id 21..25
      const page = bigDoc.getPage(0, 10, [{ column: "age", operator: "gte", value: 40 }]);
      expect(page.rows).toHaveLength(5);
      expect(page.rows[0].id).toBe(21);
      expect(page.totalRows).toBe(25); // always full count
      expect(page.filteredTotalRows).toBe(5);
    });

    it("returns rowIndices mapping to original row positions", () => {
      const page = bigDoc.getPage(0, 10, [{ column: "age", operator: "gte", value: 40 }]);
      expect(page.rowIndices).toEqual([20, 21, 22, 23, 24]);
    });

    it("paginates within filtered results", () => {
      // age >= 30 => rows 11..25 (15 rows), page size 10
      const page0 = bigDoc.getPage(0, 10, [{ column: "age", operator: "gte", value: 30 }]);
      expect(page0.rows).toHaveLength(10);
      expect(page0.filteredTotalRows).toBe(15);
      expect(page0.rows[0].id).toBe(11);

      const page1 = bigDoc.getPage(1, 10, [{ column: "age", operator: "gte", value: 30 }]);
      expect(page1.rows).toHaveLength(5);
      expect(page1.rows[0].id).toBe(21);
    });

    it("returns empty page when filter matches no rows", () => {
      const page = bigDoc.getPage(0, 10, [{ column: "age", operator: "gt", value: 100 }]);
      expect(page.rows).toHaveLength(0);
      expect(page.filteredTotalRows).toBe(0);
      expect(page.rowIndices).toEqual([]);
    });

    it("returns unfiltered results when filters array is empty", () => {
      const page = bigDoc.getPage(0, 10, []);
      expect(page.rows).toHaveLength(10);
      expect(page.filteredTotalRows).toBeUndefined();
      expect(page.rowIndices).toBeUndefined();
    });

    it("does not include filteredTotalRows/rowIndices when no filters", () => {
      const page = bigDoc.getPage(0, 10);
      expect(page.filteredTotalRows).toBeUndefined();
      expect(page.rowIndices).toBeUndefined();
    });

    it("AND-combines multiple filters", () => {
      // name contains "1" AND age >= 30
      // name containing "1": user1, user10..user19, user21
      // age >= 30: id 11..25
      // intersection: user10..user19, user21 (but user10 age=29, so user11..user19, user21)
      const page = bigDoc.getPage(0, 100, [
        { column: "name", operator: "contains", value: "1" },
        { column: "age", operator: "gte", value: 30 },
      ]);
      // user11(age30), user12(age31)..user19(age38), user21(age40) => 10 rows
      expect(page.filteredTotalRows).toBe(10);
    });

    it("filtered page reflects edits", () => {
      bigDoc.editCell(24, "age", 100); // row 25, age was 44 => 100
      const page = bigDoc.getPage(0, 10, [{ column: "age", operator: "gte", value: 50 }]);
      expect(page.filteredTotalRows).toBe(1);
      expect(page.rows[0].age).toBe(100);
      expect(page.rowIndices).toEqual([24]);
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    it("handles empty document", () => {
      const emptyDoc = new ParquetDocument(testSchema, []);
      expect(emptyDoc.totalRows).toBe(0);
      expect(emptyDoc.isDirty).toBe(false);
      expect(emptyDoc.getPage(0, 10).rows).toHaveLength(0);
    });

    it("editing same value does not add to undo stack", () => {
      doc.editCell(0, "name", "user1"); // same as original
      expect(doc.canUndo).toBe(false);
      expect(doc.isDirty).toBe(false);
    });

    it("works with single-row document", () => {
      const singleDoc = new ParquetDocument(testSchema, [{ id: 1, name: "solo", age: 99 }]);
      singleDoc.editCell(0, "name", "updated");
      expect(singleDoc.currentRows[0].name).toBe("updated");
      singleDoc.undo();
      expect(singleDoc.currentRows[0].name).toBe("solo");
    });

    // --- Object.is edge cases ---

    it("null → null is no-op (Object.is)", () => {
      doc.editCell(0, "name", null);
      expect(doc.canUndo).toBe(true); // first edit: "user1" → null
      doc.editCell(0, "name", null); // same null → no-op
      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1"); // only one undo needed
    });

    it("NaN → NaN is no-op (Object.is treats NaN === NaN)", () => {
      doc.editCell(0, "age", NaN);
      expect(doc.canUndo).toBe(true);
      doc.editCell(0, "age", NaN); // same NaN → no-op
      doc.undo();
      expect(doc.currentRows[0].age).toBe(20); // only one undo needed
    });

    it("0 and -0 are treated as equal by Object.is? No — they differ", () => {
      doc.editCell(0, "age", 0);
      doc.editCell(0, "age", -0); // Object.is(0, -0) === false, so this IS a new edit
      doc.undo();
      expect(doc.currentRows[0].age).toBe(0);
      doc.undo();
      expect(doc.currentRows[0].age).toBe(20);
    });

    // --- Non-existent column ---

    it("editCell on non-existent column creates the property", () => {
      doc.editCell(0, "nonExistent", "val");
      expect(doc.currentRows[0].nonExistent).toBe("val");
      doc.undo();
      expect(doc.currentRows[0].nonExistent).toBeUndefined();
    });

    // --- undefined value ---

    it("setting cell to undefined", () => {
      doc.editCell(0, "name", undefined);
      expect(doc.currentRows[0].name).toBeUndefined();
      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1");
    });

    // --- Defensive copy from getPage ---

    it("modifying getPage result does not affect internal state", () => {
      const page = doc.getPage(0, 10);
      page.rows[0].name = "HACKED";
      expect(doc.currentRows[0].name).toBe("user1");
    });

    // --- getPage with pageSize=1 ---

    it("getPage with pageSize=1 returns one row at a time", () => {
      const page0 = doc.getPage(0, 1);
      expect(page0.rows).toHaveLength(1);
      expect(page0.rows[0].id).toBe(1);

      const page4 = doc.getPage(4, 1);
      expect(page4.rows).toHaveLength(1);
      expect(page4.rows[0].id).toBe(5);

      const page5 = doc.getPage(5, 1);
      expect(page5.rows).toHaveLength(0);
    });
  });

  // ── State transitions: markSaved combinations ──

  describe("markSaved — advanced state transitions", () => {
    it("multiple saves: save → edit → save → undo makes dirty", () => {
      doc.editCell(0, "name", "A");
      doc.markSaved();
      expect(doc.isDirty).toBe(false);

      doc.editCell(0, "name", "B");
      doc.markSaved();
      expect(doc.isDirty).toBe(false);

      doc.undo(); // undo "B" → "A"
      expect(doc.isDirty).toBe(true);
    });

    it("multiple saves: save → edit → save → undo → redo restores clean", () => {
      doc.editCell(0, "name", "A");
      doc.markSaved();
      doc.editCell(0, "name", "B");
      doc.markSaved();

      doc.undo();
      expect(doc.isDirty).toBe(true);
      doc.redo();
      expect(doc.isDirty).toBe(false);
    });
  });

  // ── State transitions: revert then re-edit ──

  describe("revert — advanced state transitions", () => {
    it("revert then edit creates fresh undo history", () => {
      doc.editCell(0, "name", "A");
      doc.editCell(0, "name", "B");
      doc.revert();

      expect(doc.isDirty).toBe(false);
      expect(doc.canUndo).toBe(false);

      doc.editCell(0, "name", "C");
      expect(doc.isDirty).toBe(true);
      expect(doc.canUndo).toBe(true);

      doc.undo();
      expect(doc.currentRows[0].name).toBe("user1");
      expect(doc.isDirty).toBe(false);
    });

    it("markSaved → edit → revert restores to saved state", () => {
      doc.editCell(0, "name", "saved");
      doc.markSaved();
      doc.editCell(0, "name", "unsaved");
      doc.revert();

      expect(doc.currentRows[0].name).toBe("saved");
      expect(doc.isDirty).toBe(false);
    });
  });

  // ── Filter + edit interaction ──

  describe("getPage filters + edit interaction", () => {
    it("editing a cell to match filter adds it to filtered results", () => {
      // age >= 100: initially no rows match
      const before = doc.getPage(0, 10, [{ column: "age", operator: "gte", value: 100 }]);
      expect(before.filteredTotalRows).toBe(0);

      // edit row 0 age to 100
      doc.editCell(0, "age", 100);
      const after = doc.getPage(0, 10, [{ column: "age", operator: "gte", value: 100 }]);
      expect(after.filteredTotalRows).toBe(1);
      expect(after.rows[0].id).toBe(1);
    });

    it("editing a cell to not match filter removes it from filtered results", () => {
      // age >= 20: all 5 rows match
      const before = doc.getPage(0, 10, [{ column: "age", operator: "gte", value: 20 }]);
      expect(before.filteredTotalRows).toBe(5);

      // edit row 0 age to 10
      doc.editCell(0, "age", 10);
      const after = doc.getPage(0, 10, [{ column: "age", operator: "gte", value: 20 }]);
      expect(after.filteredTotalRows).toBe(4);
    });
  });
});
