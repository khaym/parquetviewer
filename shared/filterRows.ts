import type {
  ParquetRow,
  ParquetSchema,
  ParquetColumnSchema,
  ParquetPrimitiveType,
  ColumnFilter,
  FilterOperator,
} from "./types";

const STRING_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "UTF8",
  "BYTE_ARRAY",
]);

const NUMERIC_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "INT8",
  "INT16",
  "INT32",
  "UINT8",
  "UINT16",
  "UINT32",
  "FLOAT",
  "DOUBLE",
]);

const BIGINT_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "INT64",
  "UINT64",
]);

const DATE_TYPES: ReadonlySet<ParquetPrimitiveType> = new Set([
  "DATE",
  "TIMESTAMP_MILLIS",
  "TIMESTAMP_MICROS",
]);

/**
 * Test whether a single row matches a single filter condition.
 * null/undefined values never match any condition.
 */
export function matchesFilter(
  row: ParquetRow,
  filter: ColumnFilter,
  schema: ParquetSchema,
): boolean {
  const colSchema = schema.find((c) => c.name === filter.column);
  if (!colSchema) return false;

  const cellValue = row[filter.column];
  if (cellValue === null || cellValue === undefined) return false;

  const { type } = colSchema;
  const op = filter.operator;

  if (type === "BOOLEAN") {
    return matchBoolean(cellValue, op);
  }

  if (STRING_TYPES.has(type)) {
    return matchString(String(cellValue), op, filter.value);
  }

  if (NUMERIC_TYPES.has(type)) {
    return matchNumber(Number(cellValue), op, Number(filter.value));
  }

  if (BIGINT_TYPES.has(type)) {
    return matchBigInt(cellValue, op, filter.value);
  }

  if (DATE_TYPES.has(type)) {
    return matchDate(String(cellValue), op, String(filter.value));
  }

  return false;
}

function matchBoolean(value: unknown, op: FilterOperator): boolean {
  if (op === "isTrue") return value === true;
  if (op === "isFalse") return value === false;
  return false;
}

function matchString(
  value: string,
  op: FilterOperator,
  filterValue: unknown,
): boolean {
  const fv = String(filterValue ?? "");
  switch (op) {
    case "equals":
      return value === fv;
    case "notEquals":
      return value !== fv;
    case "contains":
      return value.toLowerCase().includes(fv.toLowerCase());
    case "startsWith":
      return value.toLowerCase().startsWith(fv.toLowerCase());
    default:
      return false;
  }
}

function matchNumber(
  value: number,
  op: FilterOperator,
  filterValue: number,
): boolean {
  switch (op) {
    case "equals":
      return value === filterValue;
    case "notEquals":
      return value !== filterValue;
    case "gt":
      return value > filterValue;
    case "lt":
      return value < filterValue;
    case "gte":
      return value >= filterValue;
    case "lte":
      return value <= filterValue;
    default:
      return false;
  }
}

function matchBigInt(
  value: unknown,
  op: FilterOperator,
  filterValue: unknown,
): boolean {
  try {
    const v = BigInt(String(value));
    const fv = BigInt(String(filterValue));
    switch (op) {
      case "equals":
        return v === fv;
      case "notEquals":
        return v !== fv;
      case "gt":
        return v > fv;
      case "lt":
        return v < fv;
      case "gte":
        return v >= fv;
      case "lte":
        return v <= fv;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

function matchDate(
  value: string,
  op: FilterOperator,
  filterValue: string,
): boolean {
  const d = new Date(value).getTime();
  const fd = new Date(filterValue).getTime();
  if (isNaN(d) || isNaN(fd)) return false;

  switch (op) {
    case "equals":
      return d === fd;
    case "notEquals":
      return d !== fd;
    case "before":
      return d < fd;
    case "after":
      return d > fd;
    default:
      return false;
  }
}

/**
 * Filter rows and return both the filtered rows and their original indices.
 */
export function filterRowsWithIndices(
  rows: ParquetRow[],
  filters: ColumnFilter[],
  schema: ParquetSchema,
): { filteredRows: ParquetRow[]; indices: number[] } {
  if (filters.length === 0) {
    return {
      filteredRows: rows,
      indices: rows.map((_, i) => i),
    };
  }

  const filteredRows: ParquetRow[] = [];
  const indices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (filters.every((f) => matchesFilter(row, f, schema))) {
      filteredRows.push(row);
      indices.push(i);
    }
  }

  return { filteredRows, indices };
}
