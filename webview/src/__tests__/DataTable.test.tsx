import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DataTable } from "../components/DataTable";
import type { ParquetSchema, ParquetRow } from "@shared/types";

const schema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: true },
  { name: "active", type: "BOOLEAN", nullable: false },
];

const rows: ParquetRow[] = [
  { id: 1, name: "Alice", active: true },
  { id: 2, name: null, active: false },
];

import type { ColumnFilter } from "@shared/types";

const defaultProps = {
  schema,
  rows,
  pageIndex: 0,
  pageSize: 10,
  onEditCell: vi.fn(),
  validationErrors: new Map<string, string>(),
  filters: [] as ColumnFilter[],
  onFilterChange: vi.fn(),
};

describe("DataTable", () => {
  it("renders column headers with name and type", () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("INT32")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("UTF8")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("BOOLEAN")).toBeInTheDocument();
  });

  it("renders cell values in rows", () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("NULL")).toBeInTheDocument();
  });

  it("renders correct number of rows", () => {
    render(<DataTable {...defaultProps} />);
    const tableBody = screen.getAllByRole("row");
    // 1 header row + 2 data rows
    expect(tableBody).toHaveLength(3);
  });

  it("calls onEditCell with absolute row index when cell is edited", async () => {
    const onEditCell = vi.fn();
    render(<DataTable {...defaultProps} onEditCell={onEditCell} />);
    // Click the "Alice" cell to edit
    await userEvent.click(screen.getByText("Alice"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Bob{Enter}");
    expect(onEditCell).toHaveBeenCalledWith(0, "name", "Bob");
  });

  it("computes absolute row index from pageIndex and pageSize", async () => {
    const onEditCell = vi.fn();
    render(<DataTable {...defaultProps} pageIndex={2} pageSize={10} onEditCell={onEditCell} />);
    // Click the name in 2nd row (local index 1, absolute = 2*10+1 = 21)
    await userEvent.click(screen.getByText("NULL"));
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "Test{Enter}");
    expect(onEditCell).toHaveBeenCalledWith(21, "name", "Test");
  });

  it("toggles boolean value on click", async () => {
    const onEditCell = vi.fn();
    render(<DataTable {...defaultProps} onEditCell={onEditCell} />);
    // Click "true" in the active column of first row
    await userEvent.click(screen.getByText("true"));
    expect(onEditCell).toHaveBeenCalledWith(0, "active", false);
  });

  it("shows validation error on the correct cell", () => {
    const errors = new Map<string, string>();
    errors.set("0:name", "Invalid value");
    render(<DataTable {...defaultProps} validationErrors={errors} />);
    const errorCell = screen.getByTitle("Invalid value");
    expect(errorCell).toHaveClass("validation-error");
  });

  it("renders empty table body when rows is empty", () => {
    render(<DataTable {...defaultProps} rows={[]} />);
    const allRows = screen.getAllByRole("row");
    // Only header row
    expect(allRows).toHaveLength(1);
  });

  it("handles single-column schema", () => {
    const singleSchema: ParquetSchema = [{ name: "val", type: "UTF8", nullable: false }];
    const singleRows: ParquetRow[] = [{ val: "test" }];
    render(
      <DataTable
        {...defaultProps}
        schema={singleSchema}
        rows={singleRows}
      />
    );
    expect(screen.getByText("val")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
  });

  it("renders resize handles in header cells", () => {
    const { container } = render(<DataTable {...defaultProps} />);
    const resizeHandles = container.querySelectorAll(".resize-handle");
    // One resize handle per column
    expect(resizeHandles).toHaveLength(schema.length);
  });

  describe("column resizing", () => {
    const getHeader = (container: HTMLElement, index: number) =>
      container.querySelectorAll<HTMLTableCellElement>("thead th")[index];
    const getHandle = (container: HTMLElement, index: number) =>
      getHeader(container, index).querySelector<HTMLElement>(".resize-handle")!;

    it("uses the default column width of 150px", () => {
      const { container } = render(<DataTable {...defaultProps} />);
      expect(getHeader(container, 0).style.width).toBe("150px");
      expect(container.querySelector("table")!.style.width).toBe(
        `${150 * schema.length}px`,
      );
    });

    it("widens the column, its cells and the table while dragging the handle", () => {
      const { container } = render(<DataTable {...defaultProps} />);
      fireEvent.mouseDown(getHandle(container, 0), { clientX: 0 });
      fireEvent.mouseMove(document, { clientX: 100 });

      expect(getHeader(container, 0).style.width).toBe("250px");
      expect(getHeader(container, 1).style.width).toBe("150px");
      const firstCell = container.querySelector<HTMLElement>("tbody tr td")!;
      expect(firstCell.style.width).toBe("250px");
      expect(container.querySelector("table")!.style.width).toBe(
        `${150 * schema.length + 100}px`,
      );

      fireEvent.mouseUp(document, { clientX: 100 });
      expect(getHeader(container, 0).style.width).toBe("250px");
    });

    it("marks the handle as resizing only during the drag", () => {
      const { container } = render(<DataTable {...defaultProps} />);
      const handle = getHandle(container, 0);
      expect(handle).not.toHaveClass("resizing");

      fireEvent.mouseDown(handle, { clientX: 0 });
      fireEvent.mouseMove(document, { clientX: 10 });
      expect(getHandle(container, 0)).toHaveClass("resizing");

      fireEvent.mouseUp(document, { clientX: 10 });
      expect(getHandle(container, 0)).not.toHaveClass("resizing");
    });

    it("does not shrink a column below its 80px minimum width", () => {
      const { container } = render(<DataTable {...defaultProps} />);
      fireEvent.mouseDown(getHandle(container, 0), { clientX: 200 });
      fireEvent.mouseMove(document, { clientX: 0 });
      fireEvent.mouseUp(document, { clientX: 0 });

      expect(getHeader(container, 0).style.width).toBe("80px");
    });
  });

  it("renders filter icon buttons for each column", () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByLabelText("Filter id")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter name")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter active")).toBeInTheDocument();
  });

  it("highlights filter icon when filter is active", () => {
    const filters: ColumnFilter[] = [{ column: "name", operator: "equals", value: "Alice" }];
    render(<DataTable {...defaultProps} filters={filters} />);
    const btn = screen.getByLabelText("Filter name");
    expect(btn).toHaveClass("filter-active");
    // Other columns should not be active
    expect(screen.getByLabelText("Filter id")).not.toHaveClass("filter-active");
  });

  it("uses rowIndices for absolute row index when filtered", async () => {
    const onEditCell = vi.fn();
    // rowIndices maps displayed row 0 → original row 5, row 1 → original row 10
    render(
      <DataTable
        {...defaultProps}
        onEditCell={onEditCell}
        rowIndices={[5, 10]}
      />,
    );
    await userEvent.click(screen.getByText("Alice"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Updated{Enter}");
    expect(onEditCell).toHaveBeenCalledWith(5, "name", "Updated");
  });

  it("opens FilterDropdown when filter icon is clicked", async () => {
    render(<DataTable {...defaultProps} />);
    await userEvent.click(screen.getByLabelText("Filter name"));
    expect(screen.getByLabelText("Filter operator")).toBeInTheDocument();
  });

  it("renders empty table with empty schema", () => {
    render(
      <DataTable {...defaultProps} schema={[]} rows={[]} />
    );
    const allRows = screen.getAllByRole("row");
    // Only header row with no columns
    expect(allRows).toHaveLength(1);
  });

  it("shows multiple validation errors on different cells", () => {
    const errors = new Map<string, string>();
    errors.set("0:id", "Too large");
    errors.set("1:name", "Required");
    render(<DataTable {...defaultProps} validationErrors={errors} />);
    expect(screen.getByTitle("Too large")).toHaveClass("validation-error");
    expect(screen.getByTitle("Required")).toHaveClass("validation-error");
  });

  it("closes filter dropdown when another column filter is clicked", async () => {
    render(<DataTable {...defaultProps} />);
    // Open filter for "name"
    await userEvent.click(screen.getByLabelText("Filter name"));
    expect(screen.getByLabelText("Filter operator")).toBeInTheDocument();

    // Click filter for "id" — name dropdown should close
    await userEvent.click(screen.getByLabelText("Filter id"));
    // Should still have one dropdown open (for id)
    const dropdowns = screen.getAllByLabelText("Filter operator");
    expect(dropdowns).toHaveLength(1);
  });

  it("displays numeric values correctly", () => {
    const numSchema: ParquetSchema = [
      { name: "price", type: "FLOAT", nullable: false },
    ];
    const numRows: ParquetRow[] = [{ price: 3.14 }];
    render(
      <DataTable {...defaultProps} schema={numSchema} rows={numRows} />
    );
    expect(screen.getByText("3.14")).toBeInTheDocument();
  });
});
