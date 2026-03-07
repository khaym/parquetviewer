import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { matchesFilter, filterRowsWithIndices } from "../filterRows";
import type {
  ParquetRow,
  ParquetSchema,
  ParquetPrimitiveType,
  ColumnFilter,
  FilterOperator,
} from "../types";

// ── Arbitraries ────────────────────────────────────────────────

const stringOperators: FilterOperator[] = ["equals", "notEquals", "contains", "startsWith"];
const numberOperators: FilterOperator[] = ["equals", "notEquals", "gt", "lt", "gte", "lte"];
const booleanOperators: FilterOperator[] = ["isTrue", "isFalse"];

const arbStringOp = fc.constantFrom(...stringOperators);
const arbNumberOp = fc.constantFrom(...numberOperators);
const arbBooleanOp = fc.constantFrom(...booleanOperators);

const schema: ParquetSchema = [
  { name: "str", type: "UTF8", nullable: true },
  { name: "num", type: "INT32", nullable: true },
  { name: "flag", type: "BOOLEAN", nullable: false },
  { name: "big", type: "INT64", nullable: true },
  { name: "score", type: "FLOAT", nullable: true },
  { name: "date", type: "DATE", nullable: true },
];

function arbRow(): fc.Arbitrary<ParquetRow> {
  return fc.record({
    str: fc.oneof(fc.string(), fc.constant(null)),
    num: fc.oneof(fc.integer({ min: -2147483648, max: 2147483647 }), fc.constant(null)),
    flag: fc.boolean(),
    big: fc.oneof(
      fc.bigInt().map((n) => String(n)),
      fc.constant(null),
    ),
    score: fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.constant(null)),
    date: fc.oneof(
      fc.date({ min: new Date("1970-01-01"), max: new Date("2099-12-31"), noInvalidDate: true }).map(
        (d) => d.toISOString().slice(0, 10),
      ),
      fc.constant(null),
    ),
  });
}

// ── matchesFilter: Invariants ──────────────────────────────────

describe("matchesFilter — property-based", () => {
  it("null values never match any filter", () => {
    fc.assert(
      fc.property(arbStringOp, fc.string(), (op, value) => {
        const row: ParquetRow = { str: null };
        expect(matchesFilter(row, { column: "str", operator: op, value }, schema)).toBe(false);
      }),
    );
  });

  it("undefined values never match any filter", () => {
    fc.assert(
      fc.property(arbNumberOp, fc.integer(), (op, value) => {
        const row: ParquetRow = {}; // num is missing
        expect(matchesFilter(row, { column: "num", operator: op, value }, schema)).toBe(false);
      }),
    );
  });

  it("unknown column never matches", () => {
    fc.assert(
      fc.property(arbRow(), arbStringOp, fc.string(), (row, op, value) => {
        expect(
          matchesFilter(row, { column: "nonexistent", operator: op, value }, schema),
        ).toBe(false);
      }),
    );
  });

  it("string equals is reflexive (value equals itself)", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const row: ParquetRow = { str: s };
        expect(
          matchesFilter(row, { column: "str", operator: "equals", value: s }, schema),
        ).toBe(true);
      }),
    );
  });

  it("string equals and notEquals are complementary", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (cellVal, filterVal) => {
        const row: ParquetRow = { str: cellVal };
        const eq = matchesFilter(row, { column: "str", operator: "equals", value: filterVal }, schema);
        const neq = matchesFilter(row, { column: "str", operator: "notEquals", value: filterVal }, schema);
        expect(eq).not.toBe(neq);
      }),
    );
  });

  it("contains always matches when filter value is empty string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const row: ParquetRow = { str: s };
        expect(
          matchesFilter(row, { column: "str", operator: "contains", value: "" }, schema),
        ).toBe(true);
      }),
    );
  });

  it("startsWith always matches when filter value is empty string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const row: ParquetRow = { str: s };
        expect(
          matchesFilter(row, { column: "str", operator: "startsWith", value: "" }, schema),
        ).toBe(true);
      }),
    );
  });

  it("startsWith implies contains", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (cellVal, filterVal) => {
        const row: ParquetRow = { str: cellVal };
        const sw = matchesFilter(row, { column: "str", operator: "startsWith", value: filterVal }, schema);
        const ct = matchesFilter(row, { column: "str", operator: "contains", value: filterVal }, schema);
        if (sw) expect(ct).toBe(true);
      }),
    );
  });

  it("number equals is reflexive", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (n) => {
          const row: ParquetRow = { num: n };
          expect(
            matchesFilter(row, { column: "num", operator: "equals", value: n }, schema),
          ).toBe(true);
        },
      ),
    );
  });

  it("number gt and lte are complementary", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2147483648, max: 2147483647 }),
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (cellVal, filterVal) => {
          const row: ParquetRow = { num: cellVal };
          const gt = matchesFilter(row, { column: "num", operator: "gt", value: filterVal }, schema);
          const lte = matchesFilter(row, { column: "num", operator: "lte", value: filterVal }, schema);
          expect(gt).not.toBe(lte);
        },
      ),
    );
  });

  it("number lt and gte are complementary", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2147483648, max: 2147483647 }),
        fc.integer({ min: -2147483648, max: 2147483647 }),
        (cellVal, filterVal) => {
          const row: ParquetRow = { num: cellVal };
          const lt = matchesFilter(row, { column: "num", operator: "lt", value: filterVal }, schema);
          const gte = matchesFilter(row, { column: "num", operator: "gte", value: filterVal }, schema);
          expect(lt).not.toBe(gte);
        },
      ),
    );
  });

  it("boolean isTrue and isFalse are complementary", () => {
    fc.assert(
      fc.property(fc.boolean(), (b) => {
        const row: ParquetRow = { flag: b };
        const isTrue = matchesFilter(row, { column: "flag", operator: "isTrue" }, schema);
        const isFalse = matchesFilter(row, { column: "flag", operator: "isFalse" }, schema);
        expect(isTrue).not.toBe(isFalse);
      }),
    );
  });

  it("matchesFilter never throws for any valid input", () => {
    fc.assert(
      fc.property(arbRow(), (row) => {
        for (const col of schema) {
          const ops =
            col.type === "BOOLEAN"
              ? booleanOperators
              : col.type === "UTF8"
                ? stringOperators
                : numberOperators;
          for (const op of ops) {
            // Should not throw, regardless of value
            expect(() =>
              matchesFilter(row, { column: col.name, operator: op, value: "test" }, schema),
            ).not.toThrow();
          }
        }
      }),
    );
  });
});

// ── filterRowsWithIndices: Invariants ──────────────────────────

describe("filterRowsWithIndices — property-based", () => {
  it("filtered rows are always a subset of input rows", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 0, maxLength: 50 }),
        (rows) => {
          const filters: ColumnFilter[] = [{ column: "num", operator: "gt", value: 0 }];
          const result = filterRowsWithIndices(rows, filters, schema);
          expect(result.filteredRows.length).toBeLessThanOrEqual(rows.length);
        },
      ),
    );
  });

  it("indices length always matches filteredRows length", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 0, maxLength: 50 }),
        fc.constantFrom(
          { column: "num", operator: "gt" as const, value: 0 },
          { column: "flag", operator: "isTrue" as const },
          { column: "str", operator: "contains" as const, value: "a" },
        ),
        (rows, filter) => {
          const result = filterRowsWithIndices(rows, [filter], schema);
          expect(result.indices.length).toBe(result.filteredRows.length);
        },
      ),
    );
  });

  it("all indices are valid (within bounds and ascending)", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 0, maxLength: 50 }),
        (rows) => {
          const filters: ColumnFilter[] = [{ column: "flag", operator: "isTrue" }];
          const result = filterRowsWithIndices(rows, filters, schema);

          for (let i = 0; i < result.indices.length; i++) {
            const idx = result.indices[i];
            // Index in bounds
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(rows.length);
            // Strictly ascending
            if (i > 0) {
              expect(idx).toBeGreaterThan(result.indices[i - 1]);
            }
          }
        },
      ),
    );
  });

  it("filtered rows match the rows at their original indices", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 1, maxLength: 50 }),
        (rows) => {
          const filters: ColumnFilter[] = [{ column: "flag", operator: "isTrue" }];
          const result = filterRowsWithIndices(rows, filters, schema);

          for (let i = 0; i < result.filteredRows.length; i++) {
            expect(result.filteredRows[i]).toBe(rows[result.indices[i]]);
          }
        },
      ),
    );
  });

  it("empty filters return all rows unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 0, maxLength: 20 }),
        (rows) => {
          const result = filterRowsWithIndices(rows, [], schema);
          expect(result.filteredRows).toBe(rows); // same reference
          expect(result.indices).toEqual(rows.map((_, i) => i));
        },
      ),
    );
  });

  it("adding more filters never increases result count", () => {
    fc.assert(
      fc.property(
        fc.array(arbRow(), { minLength: 0, maxLength: 30 }),
        (rows) => {
          const filter1: ColumnFilter[] = [{ column: "flag", operator: "isTrue" }];
          const filter2: ColumnFilter[] = [
            { column: "flag", operator: "isTrue" },
            { column: "num", operator: "gt", value: 0 },
          ];
          const r1 = filterRowsWithIndices(rows, filter1, schema);
          const r2 = filterRowsWithIndices(rows, filter2, schema);
          expect(r2.filteredRows.length).toBeLessThanOrEqual(r1.filteredRows.length);
        },
      ),
    );
  });
});
