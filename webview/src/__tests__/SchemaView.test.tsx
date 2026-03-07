import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SchemaView } from "../components/SchemaView";
import type { ParquetSchema } from "@shared/types";

const schema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: true },
  { name: "active", type: "BOOLEAN", nullable: false },
];

describe("SchemaView", () => {
  it("renders a table with Name, Type, Nullable headers", () => {
    render(<SchemaView schema={schema} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Nullable")).toBeInTheDocument();
  });

  it("renders one row per column in the schema", () => {
    render(<SchemaView schema={schema} />);
    const rows = screen.getAllByRole("row");
    // 1 header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it("displays column names", () => {
    render(<SchemaView schema={schema} />);
    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("displays column types", () => {
    render(<SchemaView schema={schema} />);
    expect(screen.getByText("INT32")).toBeInTheDocument();
    expect(screen.getByText("UTF8")).toBeInTheDocument();
    expect(screen.getByText("BOOLEAN")).toBeInTheDocument();
  });

  it("displays nullable as Yes/No", () => {
    render(<SchemaView schema={schema} />);
    const rows = screen.getAllByRole("row").slice(1); // skip header

    // id: nullable=false → No
    expect(within(rows[0]).getByText("No")).toBeInTheDocument();
    // name: nullable=true → Yes
    expect(within(rows[1]).getByText("Yes")).toBeInTheDocument();
    // active: nullable=false → No
    expect(within(rows[2]).getByText("No")).toBeInTheDocument();
  });

  it("renders empty state when schema is empty", () => {
    render(<SchemaView schema={[]} />);
    expect(screen.getByText("No columns")).toBeInTheDocument();
  });

  it("shows column count", () => {
    render(<SchemaView schema={schema} />);
    expect(screen.getByText("3 columns")).toBeInTheDocument();
  });
});
