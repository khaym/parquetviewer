import * as arrow from "apache-arrow";
import type { ParquetSchema, ParquetColumnSchema, ParquetRow } from "../shared/types";

// parquet-wasm types (loaded dynamically)
type ParquetWasmModule = typeof import("parquet-wasm/esm/parquet_wasm.js");

/**
 * Result of reading a Parquet file.
 */
export interface ParquetReadResult {
  schema: ParquetSchema;
  rows: ParquetRow[];
  totalRows: number;
}

let _pw: ParquetWasmModule | null = null;

/**
 * Initialize parquet-wasm. Must be called before using read/write functions.
 * Safe to call multiple times (idempotent).
 */
export async function initParquetWasm(): Promise<ParquetWasmModule> {
  if (_pw) return _pw;

  const pw = await import("parquet-wasm/esm/parquet_wasm.js");

  // In Node.js, we need to read the WASM file and use initSync
  const fs = await import("fs");
  const path = await import("path");
  const url = await import("url");

  // In bundled extension: __dirname = dist/, WASM is at dist/parquet_wasm_bg.wasm
  // In tests (ESM): use import.meta.url to resolve from node_modules
  const baseDir =
    typeof import.meta.url === "string"
      ? path.dirname(url.fileURLToPath(import.meta.url))
      : __dirname;

  // Try bundled location first (dist/parquet_wasm_bg.wasm), then node_modules
  const bundledWasmPath = path.resolve(baseDir, "parquet_wasm_bg.wasm");
  const nodeModulesWasmPath = path.resolve(
    baseDir,
    "..",
    "node_modules",
    "parquet-wasm",
    "esm",
    "parquet_wasm_bg.wasm",
  );
  const wasmPath = fs.existsSync(bundledWasmPath)
    ? bundledWasmPath
    : nodeModulesWasmPath;
  const wasmBytes = fs.readFileSync(wasmPath);
  pw.initSync({ module: wasmBytes });

  _pw = pw;
  return pw;
}

/**
 * Allow injecting a pre-initialized parquet-wasm module (for testing).
 */
export function setParquetWasm(pw: ParquetWasmModule): void {
  _pw = pw;
}

/**
 * Get the initialized parquet-wasm module.
 */
async function getPw(): Promise<ParquetWasmModule> {
  if (!_pw) {
    return initParquetWasm();
  }
  return _pw;
}

/**
 * Service for reading and writing Parquet files.
 * Wraps parquet-wasm and apache-arrow to provide a simple interface.
 */
export class ParquetService {
  /**
   * Read a Parquet file from a Uint8Array buffer.
   */
  async readFile(buffer: Uint8Array): Promise<ParquetReadResult> {
    const pw = await getPw();

    const wasmTable = pw.readParquet(buffer);
    const ipcStream = wasmTable.intoIPCStream();
    const arrowTable = arrow.tableFromIPC(ipcStream);

    const schema = extractSchema(arrowTable);
    const rows = extractRows(arrowTable, schema);

    return {
      schema,
      rows,
      totalRows: arrowTable.numRows,
    };
  }

  /**
   * Get a page of rows from a Parquet file buffer.
   */
  async readPage(
    buffer: Uint8Array,
    pageIndex: number,
    pageSize: number,
  ): Promise<ParquetReadResult> {
    const pw = await getPw();

    const wasmTable = pw.readParquet(buffer);
    const ipcStream = wasmTable.intoIPCStream();
    const arrowTable = arrow.tableFromIPC(ipcStream);

    const schema = extractSchema(arrowTable);
    const start = pageIndex * pageSize;
    const end = Math.min(start + pageSize, arrowTable.numRows);
    const rows = extractRows(arrowTable, schema, start, end);

    return {
      schema,
      rows,
      totalRows: arrowTable.numRows,
    };
  }

  /**
   * Write rows back to Parquet format.
   * Takes the original schema and modified rows, returns a Uint8Array.
   */
  async writeFile(schema: ParquetSchema, rows: ParquetRow[]): Promise<Uint8Array> {
    const pw = await getPw();

    const vectors: arrow.Vector[] = [];
    const fields: arrow.Field[] = [];

    for (const col of schema) {
      const values = rows.map((row) => row[col.name] ?? null);
      const { field, vector } = buildArrowColumn(col, values);
      fields.push(field);
      vectors.push(vector);
    }

    const arrowSchema = new arrow.Schema(fields);
    const children = vectors.map((v) => v.data[0]);
    const structData = arrow.makeData({
      type: new arrow.Struct(fields),
      length: rows.length,
      children,
      nullCount: 0,
    });
    const batch = new arrow.RecordBatch(arrowSchema, structData);
    const arrowTable = new arrow.Table(batch);

    const ipcStream = arrow.tableToIPC(arrowTable, "stream");
    const wasmTable = pw.Table.fromIPCStream(ipcStream);
    const parquetBuffer = pw.writeParquet(wasmTable);

    return parquetBuffer;
  }

  /**
   * Apply a cell edit to the in-memory rows and return the updated rows.
   */
  editCell(
    rows: ParquetRow[],
    rowIndex: number,
    column: string,
    value: unknown,
  ): ParquetRow[] {
    if (rowIndex < 0 || rowIndex >= rows.length) {
      throw new Error(`Row index ${rowIndex} out of bounds (0-${rows.length - 1})`);
    }

    const updated = [...rows];
    updated[rowIndex] = { ...updated[rowIndex], [column]: value };
    return updated;
  }
}

// ── Write helpers ─────────────────────────────────────────────

function parquetTypeToArrowType(type: ParquetColumnSchema["type"]): arrow.DataType {
  switch (type) {
    case "BOOLEAN": return new arrow.Bool();
    case "INT8": return new arrow.Int8();
    case "INT16": return new arrow.Int16();
    case "INT32": return new arrow.Int32();
    case "INT64": return new arrow.Int64();
    case "UINT8": return new arrow.Uint8();
    case "UINT16": return new arrow.Uint16();
    case "UINT32": return new arrow.Uint32();
    case "UINT64": return new arrow.Uint64();
    case "FLOAT": return new arrow.Float32();
    case "DOUBLE": return new arrow.Float64();
    case "DATE": return new arrow.DateDay();
    case "TIMESTAMP_MILLIS": return new arrow.TimestampMillisecond();
    case "TIMESTAMP_MICROS": return new arrow.TimestampMicrosecond();
    case "UTF8": return new arrow.Utf8();
    case "BYTE_ARRAY": return new arrow.Utf8();
  }
}

function buildArrowColumn(
  col: ParquetColumnSchema,
  values: unknown[],
): { field: arrow.Field; vector: arrow.Vector } {
  const arrowType = parquetTypeToArrowType(col.type);
  const field = new arrow.Field(col.name, arrowType, col.nullable);
  const builder = arrow.makeBuilder({ type: arrowType, nullValues: [null] });

  for (const val of values) {
    if (val === null || val === undefined) {
      builder.append(null);
      continue;
    }

    switch (col.type) {
      case "INT64":
      case "UINT64":
        builder.append(typeof val === "string" ? BigInt(val) : val);
        break;
      case "DATE":
        // String "YYYY-MM-DD" → epoch millis for DateDay builder
        builder.append(typeof val === "string" ? new Date(val + "T00:00:00Z").getTime() : val);
        break;
      case "TIMESTAMP_MILLIS":
      case "TIMESTAMP_MICROS":
        // ISO string → epoch millis for Timestamp builder
        builder.append(typeof val === "string" ? new Date(val).getTime() : val);
        break;
      default:
        builder.append(val);
        break;
    }
  }

  return { field, vector: builder.finish().toVector() };
}

// ── Read helpers ──────────────────────────────────────────────

function extractSchema(table: arrow.Table): ParquetSchema {
  return table.schema.fields.map((field) => ({
    name: field.name,
    type: arrowTypeToParquetType(field.type),
    nullable: field.nullable,
  }));
}

function extractRows(
  table: arrow.Table,
  schema: ParquetSchema,
  start?: number,
  end?: number,
): ParquetRow[] {
  const rows: ParquetRow[] = [];
  const sliced =
    start !== undefined && end !== undefined ? table.slice(start, end) : table;

  const typeMap = new Map(schema.map((c) => [c.name, c.type]));

  for (let i = 0; i < sliced.numRows; i++) {
    const row: ParquetRow = {};
    for (const field of sliced.schema.fields) {
      const column = sliced.getChild(field.name);
      if (column) {
        const val = column.get(i);
        row[field.name] = formatValue(val, typeMap.get(field.name) ?? "UTF8");
      }
    }
    rows.push(row);
  }

  return rows;
}

function formatValue(val: unknown, parquetType: ParquetColumnSchema["type"]): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "bigint") return val.toString();

  // Arrow may return epoch-ms numbers for Date/Timestamp
  if (parquetType === "DATE" && typeof val === "number") {
    return new Date(val).toISOString().slice(0, 10);
  }
  if ((parquetType === "TIMESTAMP_MILLIS" || parquetType === "TIMESTAMP_MICROS") && typeof val === "number") {
    return new Date(val).toISOString();
  }

  return val;
}

function arrowTypeToParquetType(type: arrow.DataType): ParquetColumnSchema["type"] {
  if ("bitWidth" in type && typeof (type as Record<string, unknown>).bitWidth === "number") {
    const bw = (type as { bitWidth: number }).bitWidth;
    const isSigned = "isSigned" in type ? (type as { isSigned: boolean }).isSigned : true;
    if (isSigned) {
      if (bw === 8) return "INT8";
      if (bw === 16) return "INT16";
      if (bw === 32) return "INT32";
      if (bw === 64) return "INT64";
    } else {
      if (bw === 8) return "UINT8";
      if (bw === 16) return "UINT16";
      if (bw === 32) return "UINT32";
      if (bw === 64) return "UINT64";
    }
  }

  if ("precision" in type && typeof (type as Record<string, unknown>).precision === "number") {
    const p = (type as { precision: number }).precision;
    if (p <= 1) return "FLOAT";
    return "DOUBLE";
  }

  const typeId = type.typeId;
  switch (typeId) {
    case 2: return "BOOLEAN";            // Type.Bool
    case 6: return "UTF8";               // Type.Utf8
    case 8: return "DATE";               // Type.Date
    case 10: return "TIMESTAMP_MILLIS";  // Type.Timestamp
    default: return "UTF8";
  }
}


