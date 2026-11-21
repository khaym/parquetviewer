import {
  useTable,
  tableFeatures,
  columnSizingFeature,
  columnResizingFeature,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { ParquetSchema, ParquetRow, ColumnFilter, FilterOperator } from "@shared/types";
import { EditableCell } from "./EditableCell";
import { FilterDropdown } from "./FilterDropdown";

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
});

interface DataTableProps {
  schema: ParquetSchema;
  rows: ParquetRow[];
  pageIndex: number;
  pageSize: number;
  onEditCell: (rowIndex: number, column: string, value: unknown) => void;
  validationErrors: Map<string, string>;
  filters: ColumnFilter[];
  onFilterChange: (filters: ColumnFilter[]) => void;
  rowIndices?: number[];
}

export function DataTable({
  schema,
  rows,
  pageIndex,
  pageSize,
  onEditCell,
  validationErrors,
  filters,
  onFilterChange,
  rowIndices,
}: DataTableProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const filterMap = useMemo(() => {
    const map = new Map<string, ColumnFilter>();
    for (const f of filters) {
      map.set(f.column, f);
    }
    return map;
  }, [filters]);

  const handleApplyFilter = (column: string, operator: FilterOperator, value: string) => {
    const newFilters = filters.filter((f) => f.column !== column);
    newFilters.push({ column, operator, value });
    onFilterChange(newFilters);
    setOpenFilter(null);
  };

  const handleClearFilter = (column: string) => {
    const newFilters = filters.filter((f) => f.column !== column);
    onFilterChange(newFilters);
    setOpenFilter(null);
  };

  const columns = useMemo<ColumnDef<typeof features, ParquetRow>[]>(
    () =>
      schema.map((col) => ({
        id: col.name,
        accessorKey: col.name,
        header: () => (
          <>
            {col.name}
            <span className="column-type">{col.type}</span>
          </>
        ),
        cell: ({ row }) => {
          const absoluteRowIndex = rowIndices
            ? rowIndices[row.index]
            : pageIndex * pageSize + row.index;
          const errorKey = `${absoluteRowIndex}:${col.name}`;
          return (
            <EditableCell
              value={row.original[col.name] as unknown}
              column={col}
              onCommit={(value) =>
                onEditCell(absoluteRowIndex, col.name, value)
              }
              validationError={validationErrors.get(errorKey)}
            />
          );
        },
        size: 150,
        minSize: 80,
      })),
    [schema, pageIndex, pageSize, onEditCell, validationErrors, rowIndices],
  );

  const table = useTable({
    features,
    data: rows,
    columns,
    columnResizeMode: "onChange",
  });

  return (
    <div className="table-container">
      <table style={{ width: table.getCenterTotalSize() }}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const colName = header.column.id;
                const colSchema = schema.find((c) => c.name === colName);
                const hasActiveFilter = filterMap.has(colName);
                const currentFilter = filterMap.get(colName);
                return (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    <div className="header-content">
                      <div className="header-text">
                        <table.FlexRender header={header} />
                      </div>
                      <button
                        className={`filter-icon ${hasActiveFilter ? "filter-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFilter(openFilter === colName ? null : colName);
                        }}
                        aria-label={`Filter ${colName}`}
                      >
                        ▼
                      </button>
                    </div>
                    {openFilter === colName && colSchema && (
                      <FilterDropdown
                        columnName={colName}
                        columnType={colSchema.type}
                        currentOperator={currentFilter?.operator}
                        currentValue={currentFilter?.value != null ? String(currentFilter.value) : undefined}
                        onApply={(op, val) => handleApplyFilter(colName, op, val)}
                        onClear={() => handleClearFilter(colName)}
                        onClose={() => setOpenFilter(null)}
                      />
                    )}
                    <div
                      className={`resize-handle ${header.column.getIsResizing() ? "resizing" : ""}`}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                    />
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
