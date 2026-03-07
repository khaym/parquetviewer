import { describe, it, expect, beforeAll } from "vitest";
import { ParquetService, initParquetWasm } from "../parquetService";
import type { ParquetSchema, ParquetRow } from "../../shared/types";

describe("ParquetService", () => {
  const service = new ParquetService();

  // Initialize WASM once for all integration tests
  beforeAll(async () => {
    await initParquetWasm();
  }, 30000);

  // ── editCell (pure logic, no WASM needed) ───────────────────

  describe("editCell", () => {
    const rows: ParquetRow[] = [
      { id: 1, name: "Alice", age: 30 },
      { id: 2, name: "Bob", age: 25 },
      { id: 3, name: "Charlie", age: 35 },
    ];

    it("updates a cell value at the specified row and column", () => {
      const updated = service.editCell(rows, 1, "name", "Robert");
      expect(updated[1].name).toBe("Robert");
    });

    it("does not mutate the original rows array", () => {
      const updated = service.editCell(rows, 0, "age", 31);
      expect(rows[0].age).toBe(30);
      expect(updated[0].age).toBe(31);
    });

    it("does not mutate other rows", () => {
      const updated = service.editCell(rows, 1, "name", "Robert");
      expect(updated[0]).toEqual(rows[0]);
      expect(updated[2]).toEqual(rows[2]);
    });

    it("can set a value to null", () => {
      const updated = service.editCell(rows, 0, "name", null);
      expect(updated[0].name).toBeNull();
    });

    it("throws on out-of-bounds row index", () => {
      expect(() => service.editCell(rows, -1, "name", "X")).toThrow("out of bounds");
      expect(() => service.editCell(rows, 3, "name", "X")).toThrow("out of bounds");
    });

    it("preserves array length", () => {
      const updated = service.editCell(rows, 0, "name", "Modified");
      expect(updated.length).toBe(rows.length);
    });
  });

  // ── Read/Write integration (requires WASM) ─────────────────

  describe("readFile / writeFile integration", () => {
    let testBuffer: Uint8Array;
    const testSchema: ParquetSchema = [
      { name: "id", type: "INT32", nullable: false },
      { name: "name", type: "UTF8", nullable: true },
      { name: "score", type: "DOUBLE", nullable: false },
    ];
    const testRows: ParquetRow[] = [
      { id: 1, name: "Alice", score: 95.5 },
      { id: 2, name: null, score: 87.0 },
      { id: 3, name: "Charlie", score: 72.3 },
    ];

    beforeAll(async () => {
      // Create a Parquet buffer from test data
      testBuffer = await service.writeFile(testSchema, testRows);
    });

    it("writeFile returns a Uint8Array", () => {
      expect(testBuffer).toBeInstanceOf(Uint8Array);
      expect(testBuffer.length).toBeGreaterThan(0);
    });

    it("readFile returns the correct schema", async () => {
      const result = await service.readFile(testBuffer);
      expect(result.schema).toHaveLength(3);

      expect(result.schema[0].name).toBe("id");
      expect(result.schema[0].type).toBe("INT32");
      expect(result.schema[0].nullable).toBe(false);

      expect(result.schema[1].name).toBe("name");
      expect(result.schema[1].type).toBe("UTF8");
      expect(result.schema[1].nullable).toBe(true);

      expect(result.schema[2].name).toBe("score");
      expect(result.schema[2].type).toBe("DOUBLE");
      expect(result.schema[2].nullable).toBe(false);
    });

    it("readFile returns the correct number of rows", async () => {
      const result = await service.readFile(testBuffer);
      expect(result.totalRows).toBe(3);
      expect(result.rows).toHaveLength(3);
    });

    it("readFile returns the correct data", async () => {
      const result = await service.readFile(testBuffer);
      expect(result.rows[0].id).toBe(1);
      expect(result.rows[0].name).toBe("Alice");
      expect(result.rows[0].score).toBeCloseTo(95.5);

      expect(result.rows[1].id).toBe(2);
      expect(result.rows[1].name).toBeNull();

      expect(result.rows[2].name).toBe("Charlie");
    });

    it("readPage returns a subset of rows", async () => {
      const result = await service.readPage(testBuffer, 0, 2);
      expect(result.rows).toHaveLength(2);
      expect(result.totalRows).toBe(3);
      expect(result.rows[0].id).toBe(1);
      expect(result.rows[1].id).toBe(2);
    });

    it("readPage handles the last partial page", async () => {
      const result = await service.readPage(testBuffer, 1, 2);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(3);
    });

    it("round-trips: write then read preserves data", async () => {
      const result = await service.readFile(testBuffer);
      const rewritten = await service.writeFile(result.schema, result.rows);
      const result2 = await service.readFile(rewritten);

      expect(result2.totalRows).toBe(result.totalRows);
      for (let i = 0; i < result.rows.length; i++) {
        expect(result2.rows[i].id).toBe(result.rows[i].id);
        expect(result2.rows[i].name).toBe(result.rows[i].name);
        expect(result2.rows[i].score).toBeCloseTo(result.rows[i].score as number);
      }
    });

    it("round-trips with edit: modify a cell and re-read", async () => {
      const result = await service.readFile(testBuffer);
      const edited = service.editCell(result.rows, 0, "name", "Alicia");
      const newBuffer = await service.writeFile(result.schema, edited);
      const result2 = await service.readFile(newBuffer);

      expect(result2.rows[0].name).toBe("Alicia");
      expect(result2.rows[1].name).toBeNull();
      expect(result2.rows[2].name).toBe("Charlie");
    });
  });
});
