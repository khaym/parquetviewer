import { describe, it, expect } from "vitest";
import { matchesFilter, filterRowsWithIndices } from "../filterRows";
import type {
  ParquetRow,
  ParquetSchema,
  ColumnFilter,
} from "../types";

// ── Helper schema ──────────────────────────────────────────────

const schema: ParquetSchema = [
  { name: "name", type: "UTF8", nullable: true },
  { name: "age", type: "INT32", nullable: false },
  { name: "active", type: "BOOLEAN", nullable: false },
  { name: "score", type: "FLOAT", nullable: true },
  { name: "big", type: "INT64", nullable: true },
  { name: "created", type: "DATE", nullable: false },
  { name: "updated", type: "TIMESTAMP_MILLIS", nullable: true },
  { name: "data", type: "BYTE_ARRAY", nullable: true },
];

// ── matchesFilter: String (UTF8 / BYTE_ARRAY) ─────────────────

describe("matchesFilter — String types", () => {
  const row: ParquetRow = { name: "Alice", data: "Hello World" };

  it("equals — matches exact value", () => {
    expect(matchesFilter(row, { column: "name", operator: "equals", value: "Alice" }, schema)).toBe(true);
  });

  it("equals — no match", () => {
    expect(matchesFilter(row, { column: "name", operator: "equals", value: "Bob" }, schema)).toBe(false);
  });

  it("notEquals — matches when different", () => {
    expect(matchesFilter(row, { column: "name", operator: "notEquals", value: "Bob" }, schema)).toBe(true);
  });

  it("notEquals — no match when same", () => {
    expect(matchesFilter(row, { column: "name", operator: "notEquals", value: "Alice" }, schema)).toBe(false);
  });

  it("contains — case-insensitive match", () => {
    expect(matchesFilter(row, { column: "name", operator: "contains", value: "ali" }, schema)).toBe(true);
  });

  it("contains — no match", () => {
    expect(matchesFilter(row, { column: "name", operator: "contains", value: "xyz" }, schema)).toBe(false);
  });

  it("startsWith — case-insensitive match", () => {
    expect(matchesFilter(row, { column: "name", operator: "startsWith", value: "ali" }, schema)).toBe(true);
  });

  it("startsWith — no match", () => {
    expect(matchesFilter(row, { column: "name", operator: "startsWith", value: "Bob" }, schema)).toBe(false);
  });

  it("BYTE_ARRAY uses string comparison", () => {
    expect(matchesFilter(row, { column: "data", operator: "contains", value: "world" }, schema)).toBe(true);
  });
});

// ── matchesFilter: Number types ────────────────────────────────

describe("matchesFilter — Number types", () => {
  const row: ParquetRow = { age: 30, score: 85.5 };

  it("equals — matches", () => {
    expect(matchesFilter(row, { column: "age", operator: "equals", value: 30 }, schema)).toBe(true);
  });

  it("equals — no match", () => {
    expect(matchesFilter(row, { column: "age", operator: "equals", value: 25 }, schema)).toBe(false);
  });

  it("notEquals", () => {
    expect(matchesFilter(row, { column: "age", operator: "notEquals", value: 25 }, schema)).toBe(true);
  });

  it("gt", () => {
    expect(matchesFilter(row, { column: "age", operator: "gt", value: 29 }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "age", operator: "gt", value: 30 }, schema)).toBe(false);
  });

  it("lt", () => {
    expect(matchesFilter(row, { column: "age", operator: "lt", value: 31 }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "age", operator: "lt", value: 30 }, schema)).toBe(false);
  });

  it("gte", () => {
    expect(matchesFilter(row, { column: "age", operator: "gte", value: 30 }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "age", operator: "gte", value: 31 }, schema)).toBe(false);
  });

  it("lte", () => {
    expect(matchesFilter(row, { column: "age", operator: "lte", value: 30 }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "age", operator: "lte", value: 29 }, schema)).toBe(false);
  });

  it("works with FLOAT", () => {
    expect(matchesFilter(row, { column: "score", operator: "gt", value: 85 }, schema)).toBe(true);
  });

  it("equals with string value input (coercion)", () => {
    expect(matchesFilter(row, { column: "age", operator: "equals", value: "30" }, schema)).toBe(true);
  });
});

// ── matchesFilter: INT64/UINT64 (BigInt as string) ─────────────

describe("matchesFilter — INT64 (BigInt as string)", () => {
  const row: ParquetRow = { big: "9000000000" };

  it("equals", () => {
    expect(matchesFilter(row, { column: "big", operator: "equals", value: "9000000000" }, schema)).toBe(true);
  });

  it("gt", () => {
    expect(matchesFilter(row, { column: "big", operator: "gt", value: "8999999999" }, schema)).toBe(true);
  });

  it("lt", () => {
    expect(matchesFilter(row, { column: "big", operator: "lt", value: "9000000001" }, schema)).toBe(true);
  });
});

// ── matchesFilter: Boolean ─────────────────────────────────────

describe("matchesFilter — Boolean", () => {
  it("isTrue — matches true", () => {
    expect(matchesFilter({ active: true }, { column: "active", operator: "isTrue" }, schema)).toBe(true);
  });

  it("isTrue — no match on false", () => {
    expect(matchesFilter({ active: false }, { column: "active", operator: "isTrue" }, schema)).toBe(false);
  });

  it("isFalse — matches false", () => {
    expect(matchesFilter({ active: false }, { column: "active", operator: "isFalse" }, schema)).toBe(true);
  });

  it("isFalse — no match on true", () => {
    expect(matchesFilter({ active: true }, { column: "active", operator: "isFalse" }, schema)).toBe(false);
  });
});

// ── matchesFilter: Date / Timestamp ────────────────────────────

describe("matchesFilter — Date / Timestamp", () => {
  const row: ParquetRow = { created: "2024-06-15", updated: "2024-06-15T10:30:00.000Z" };

  it("equals — DATE", () => {
    expect(matchesFilter(row, { column: "created", operator: "equals", value: "2024-06-15" }, schema)).toBe(true);
  });

  it("notEquals — DATE", () => {
    expect(matchesFilter(row, { column: "created", operator: "notEquals", value: "2024-06-14" }, schema)).toBe(true);
  });

  it("before — DATE", () => {
    expect(matchesFilter(row, { column: "created", operator: "before", value: "2024-06-16" }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "created", operator: "before", value: "2024-06-15" }, schema)).toBe(false);
  });

  it("after — DATE", () => {
    expect(matchesFilter(row, { column: "created", operator: "after", value: "2024-06-14" }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "created", operator: "after", value: "2024-06-15" }, schema)).toBe(false);
  });

  it("TIMESTAMP_MILLIS — before", () => {
    expect(matchesFilter(row, { column: "updated", operator: "before", value: "2024-06-16T00:00:00.000Z" }, schema)).toBe(true);
  });
});

// ── matchesFilter: null handling ───────────────────────────────

describe("matchesFilter — null values", () => {
  it("null value does not match any operator", () => {
    const row: ParquetRow = { name: null, score: null };
    expect(matchesFilter(row, { column: "name", operator: "equals", value: "Alice" }, schema)).toBe(false);
    expect(matchesFilter(row, { column: "name", operator: "contains", value: "" }, schema)).toBe(false);
    expect(matchesFilter(row, { column: "score", operator: "gt", value: 0 }, schema)).toBe(false);
  });

  it("undefined value does not match any operator", () => {
    const row: ParquetRow = {};
    expect(matchesFilter(row, { column: "name", operator: "equals", value: "Alice" }, schema)).toBe(false);
  });
});

// ── matchesFilter: INT64 remaining operators ────────────────

describe("matchesFilter — INT64 remaining operators", () => {
  const row: ParquetRow = { big: "9000000000" };

  it("notEquals", () => {
    expect(matchesFilter(row, { column: "big", operator: "notEquals", value: "9000000000" }, schema)).toBe(false);
    expect(matchesFilter(row, { column: "big", operator: "notEquals", value: "1" }, schema)).toBe(true);
  });

  it("gte", () => {
    expect(matchesFilter(row, { column: "big", operator: "gte", value: "9000000000" }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "big", operator: "gte", value: "9000000001" }, schema)).toBe(false);
  });

  it("lte", () => {
    expect(matchesFilter(row, { column: "big", operator: "lte", value: "9000000000" }, schema)).toBe(true);
    expect(matchesFilter(row, { column: "big", operator: "lte", value: "8999999999" }, schema)).toBe(false);
  });
});

// ── matchesFilter: invalid operator for type ────────────────

describe("matchesFilter — invalid operator for type", () => {
  it("string operator on numeric column returns false", () => {
    expect(matchesFilter({ age: 30 }, { column: "age", operator: "contains", value: "3" }, schema)).toBe(false);
    expect(matchesFilter({ age: 30 }, { column: "age", operator: "startsWith", value: "3" }, schema)).toBe(false);
  });

  it("numeric operator on boolean column returns false", () => {
    expect(matchesFilter({ active: true }, { column: "active", operator: "gt", value: 0 }, schema)).toBe(false);
    expect(matchesFilter({ active: true }, { column: "active", operator: "equals", value: true }, schema)).toBe(false);
  });

  it("boolean operator on string column returns false", () => {
    expect(matchesFilter({ name: "Alice" }, { column: "name", operator: "isTrue" }, schema)).toBe(false);
  });

  it("string operator on date column returns false", () => {
    expect(matchesFilter({ created: "2024-06-15" }, { column: "created", operator: "contains", value: "06" }, schema)).toBe(false);
  });
});

// ── matchesFilter: BigInt conversion failure ────────────────

describe("matchesFilter — BigInt edge cases", () => {
  it("returns false when cell value is not convertible to BigInt", () => {
    expect(matchesFilter({ big: "not-a-number" }, { column: "big", operator: "equals", value: "0" }, schema)).toBe(false);
  });

  it("returns false when filter value is not convertible to BigInt", () => {
    expect(matchesFilter({ big: "9000000000" }, { column: "big", operator: "equals", value: "abc" }, schema)).toBe(false);
  });
});

// ── matchesFilter: Date edge cases ──────────────────────────

describe("matchesFilter — Date edge cases", () => {
  it("returns false when cell value is invalid date", () => {
    expect(matchesFilter({ created: "not-a-date" }, { column: "created", operator: "equals", value: "2024-06-15" }, schema)).toBe(false);
  });

  it("returns false when filter value is invalid date", () => {
    expect(matchesFilter({ created: "2024-06-15" }, { column: "created", operator: "equals", value: "not-a-date" }, schema)).toBe(false);
  });

  it("TIMESTAMP_MICROS — equals", () => {
    const microSchema: ParquetSchema = [{ name: "ts", type: "TIMESTAMP_MICROS", nullable: false }];
    const row: ParquetRow = { ts: "2024-06-15T10:30:00.000Z" };
    expect(matchesFilter(row, { column: "ts", operator: "equals", value: "2024-06-15T10:30:00.000Z" }, microSchema)).toBe(true);
    expect(matchesFilter(row, { column: "ts", operator: "before", value: "2024-06-16T00:00:00.000Z" }, microSchema)).toBe(true);
  });
});

// ── matchesFilter: Numeric edge cases ───────────────────────

describe("matchesFilter — Numeric edge cases", () => {
  it("NaN filter value: Number('abc') = NaN, NaN comparisons return false", () => {
    expect(matchesFilter({ age: 30 }, { column: "age", operator: "equals", value: "abc" }, schema)).toBe(false);
    expect(matchesFilter({ age: 30 }, { column: "age", operator: "gt", value: "abc" }, schema)).toBe(false);
  });

  it("empty string filter value coerces to 0", () => {
    expect(matchesFilter({ age: 0 }, { column: "age", operator: "equals", value: "" }, schema)).toBe(true);
    expect(matchesFilter({ age: 1 }, { column: "age", operator: "gt", value: "" }, schema)).toBe(true);
  });
});

// ── filterRowsWithIndices ──────────────────────────────────────

describe("filterRowsWithIndices", () => {
  const rows: ParquetRow[] = [
    { name: "Alice", age: 30, active: true },
    { name: "Bob", age: 25, active: false },
    { name: "Charlie", age: 35, active: true },
    { name: "Diana", age: 28, active: true },
  ];

  it("returns all rows when filters is empty", () => {
    const result = filterRowsWithIndices(rows, [], schema);
    expect(result.filteredRows).toEqual(rows);
    expect(result.indices).toEqual([0, 1, 2, 3]);
  });

  it("filters by single condition", () => {
    const filters: ColumnFilter[] = [{ column: "age", operator: "gt", value: 28 }];
    const result = filterRowsWithIndices(rows, filters, schema);
    expect(result.filteredRows).toHaveLength(2);
    expect(result.filteredRows[0].name).toBe("Alice");
    expect(result.filteredRows[1].name).toBe("Charlie");
    expect(result.indices).toEqual([0, 2]);
  });

  it("AND-combines multiple filters", () => {
    const filters: ColumnFilter[] = [
      { column: "active", operator: "isTrue" },
      { column: "age", operator: "lt", value: 30 },
    ];
    const result = filterRowsWithIndices(rows, filters, schema);
    expect(result.filteredRows).toHaveLength(1);
    expect(result.filteredRows[0].name).toBe("Diana");
    expect(result.indices).toEqual([3]);
  });

  it("returns empty when no rows match", () => {
    const filters: ColumnFilter[] = [{ column: "age", operator: "gt", value: 100 }];
    const result = filterRowsWithIndices(rows, filters, schema);
    expect(result.filteredRows).toHaveLength(0);
    expect(result.indices).toEqual([]);
  });

  it("handles empty rows array", () => {
    const filters: ColumnFilter[] = [{ column: "age", operator: "gt", value: 0 }];
    const result = filterRowsWithIndices([], filters, schema);
    expect(result.filteredRows).toHaveLength(0);
    expect(result.indices).toEqual([]);
  });

  it("handles empty rows with empty filters", () => {
    const result = filterRowsWithIndices([], [], schema);
    expect(result.filteredRows).toHaveLength(0);
    expect(result.indices).toEqual([]);
  });
});
