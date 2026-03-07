import { useState, useEffect, useCallback } from "react";
import type {
  ParquetSchema,
  DataPage,
  ExtensionToWebviewMessage,
  ColumnFilter,
} from "@shared/types";
import { useVsCodeApi } from "./hooks/useVsCodeApi";
import { DataTable } from "./components/DataTable";
import { SchemaView } from "./components/SchemaView";
import { Pagination } from "./components/Pagination";
import "./components/DataTable.css";

const DEFAULT_PAGE_SIZE = 100;

type ActiveTab = "data" | "schema";

export function App() {
  const [schema, setSchema] = useState<ParquetSchema | null>(null);
  const [page, setPage] = useState<DataPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("data");
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [isDirty, setIsDirty] = useState(false);

  const handleMessage = useCallback((msg: ExtensionToWebviewMessage) => {
    switch (msg.type) {
      case "init":
        setSchema(msg.schema);
        setPage(msg.data);
        setValidationErrors(new Map());
        break;
      case "dataPage":
        setPage(msg.data);
        setValidationErrors(new Map());
        break;
      case "validationError":
        setValidationErrors((prev) => {
          const next = new Map(prev);
          next.set(
            `${msg.rowIndex}:${msg.column}`,
            msg.message,
          );
          return next;
        });
        setError(
          `Validation error at row ${msg.rowIndex}, column "${msg.column}": ${msg.message}`,
        );
        break;
      case "saveResult":
        if (!msg.success) {
          setError(`Save failed: ${msg.error ?? "Unknown error"}`);
        }
        break;
      case "dirtyState":
        setIsDirty(msg.isDirty);
        break;
    }
  }, []);

  const { postMessage } = useVsCodeApi(handleMessage);

  useEffect(() => {
    postMessage({ type: "ready" });
  }, [postMessage]);

  const handleEditCell = useCallback(
    (rowIndex: number, column: string, value: unknown) => {
      setValidationErrors((prev) => {
        const key = `${rowIndex}:${column}`;
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      postMessage({ type: "editCell", rowIndex, column, value });
    },
    [postMessage],
  );

  const handleFilterChange = useCallback(
    (newFilters: ColumnFilter[]) => {
      setFilters(newFilters);
      postMessage({ type: "setFilter", filters: newFilters });
    },
    [postMessage],
  );

  if (!schema || !page) {
    return <div className="loading">Loading...</div>;
  }

  const displayRows = page.filteredTotalRows ?? page.totalRows;
  const totalPages = Math.max(1, Math.ceil(displayRows / page.pageSize));

  const requestPage = (pageIndex: number, pageSize?: number) => {
    postMessage({ type: "requestPage", pageIndex, pageSize });
  };

  const rowInfoText =
    page.filteredTotalRows != null
      ? `${page.filteredTotalRows} of ${page.totalRows} rows`
      : `${page.totalRows} rows`;

  return (
    <div className="parquet-editor">
      <div className="tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "data"}
          className={`tab-button ${activeTab === "data" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("data")}
        >
          Data
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "schema"}
          className={`tab-button ${activeTab === "schema" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("schema")}
        >
          Schema
        </button>
        <span className="tab-bar-info">
          {rowInfoText}
          {isDirty && <span className="dirty-indicator"> (unsaved)</span>}
        </span>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {activeTab === "data" ? (
        <>
          <DataTable
            schema={schema}
            rows={page.rows}
            pageIndex={page.pageIndex}
            pageSize={page.pageSize}
            onEditCell={handleEditCell}
            validationErrors={validationErrors}
            filters={filters}
            onFilterChange={handleFilterChange}
            rowIndices={page.rowIndices}
          />
          <Pagination
            pageIndex={page.pageIndex}
            totalPages={totalPages}
            totalRows={page.totalRows}
            pageSize={page.pageSize}
            filteredTotalRows={page.filteredTotalRows}
            onPrevious={() => requestPage(page.pageIndex - 1)}
            onNext={() => requestPage(page.pageIndex + 1)}
            onPageSizeChange={(newSize) => requestPage(0, newSize)}
            onPageJump={(idx) => requestPage(idx)}
          />
        </>
      ) : (
        <SchemaView schema={schema} />
      )}
    </div>
  );
}
