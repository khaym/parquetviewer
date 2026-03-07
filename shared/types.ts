/**
 * Parquet physical/logical types supported by the editor.
 */
export type ParquetPrimitiveType =
  | "BOOLEAN"
  | "INT8"
  | "INT16"
  | "INT32"
  | "INT64"
  | "UINT8"
  | "UINT16"
  | "UINT32"
  | "UINT64"
  | "FLOAT"
  | "DOUBLE"
  | "UTF8"
  | "DATE"
  | "TIMESTAMP_MILLIS"
  | "TIMESTAMP_MICROS"
  | "BYTE_ARRAY";

/**
 * A single column definition in a Parquet schema.
 */
export interface ParquetColumnSchema {
  name: string;
  type: ParquetPrimitiveType;
  nullable: boolean;
}

/**
 * Full schema of a Parquet file.
 */
export type ParquetSchema = ParquetColumnSchema[];

/**
 * A single row of data, keyed by column name.
 */
export type ParquetRow = Record<string, unknown>;

/**
 * A page of data sent from Extension Host to Webview.
 */
export interface DataPage {
  rows: ParquetRow[];
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  filteredTotalRows?: number;
  rowIndices?: number[];
}

// ─── Filter Types ───────────────────────────────────────────────

export type StringFilterOperator = "equals" | "notEquals" | "contains" | "startsWith";
export type NumberFilterOperator = "equals" | "notEquals" | "gt" | "lt" | "gte" | "lte";
export type BooleanFilterOperator = "isTrue" | "isFalse";
export type DateFilterOperator = "equals" | "notEquals" | "before" | "after";

export type FilterOperator =
  | StringFilterOperator
  | NumberFilterOperator
  | BooleanFilterOperator
  | DateFilterOperator;

export interface ColumnFilter {
  column: string;
  operator: FilterOperator;
  value?: unknown;
}

// ─── Extension ↔ Webview Messages ───────────────────────────────

/**
 * Messages sent from Extension Host → Webview.
 */
export type ExtensionToWebviewMessage =
  | { type: "init"; schema: ParquetSchema; data: DataPage }
  | { type: "dataPage"; data: DataPage }
  | { type: "saveResult"; success: boolean; error?: string }
  | { type: "validationError"; rowIndex: number; column: string; message: string }
  | { type: "dirtyState"; isDirty: boolean };

/**
 * Messages sent from Webview → Extension Host.
 */
export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "requestPage"; pageIndex: number; pageSize?: number }
  | { type: "editCell"; rowIndex: number; column: string; value: unknown }
  | { type: "save" }
  | { type: "setFilter"; filters: ColumnFilter[] };
