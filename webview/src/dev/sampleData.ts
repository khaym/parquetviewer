import type { ParquetSchema, ParquetRow, DataPage } from "@shared/types";

export const sampleSchema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: false },
  { name: "active", type: "BOOLEAN", nullable: false },
  { name: "score", type: "FLOAT", nullable: true },
  { name: "big_number", type: "INT64", nullable: true },
  { name: "created_date", type: "DATE", nullable: false },
  { name: "updated_at", type: "TIMESTAMP_MILLIS", nullable: true },
  { name: "notes", type: "UTF8", nullable: true },
];

function makeRow(i: number): ParquetRow {
  const names = [
    "Alice", "Bob", "Charlie", "Diana", "Eve",
    "Frank", "Grace", "Hank", "Ivy", "Jack",
  ];
  const nullEvery5 = i % 5 === 4;
  return {
    id: i + 1,
    name: names[i % names.length],
    active: i % 3 !== 0,
    score: nullEvery5 ? null : Math.round((i * 7.3 + 1.5) * 100) / 100,
    big_number: nullEvery5 ? null : (i * 1000000000).toString(),
    created_date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
    updated_at: nullEvery5 ? null : `2024-06-${String((i % 28) + 1).padStart(2, "0")}T10:${String(i % 60).padStart(2, "0")}:00.000Z`,
    notes: i % 7 === 0 ? null : `Note for row ${i + 1}`,
  };
}

export const sampleRows: ParquetRow[] = Array.from({ length: 30 }, (_, i) =>
  makeRow(i),
);

/**
 * Returns a page slice of sample data.
 */
export function getSamplePage(pageIndex: number, pageSize: number): DataPage {
  const start = pageIndex * pageSize;
  const rows = sampleRows.slice(start, start + pageSize);
  return {
    rows,
    pageIndex,
    pageSize,
    totalRows: sampleRows.length,
  };
}
