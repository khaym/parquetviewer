import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterDropdown, getOperatorsForType } from "../components/FilterDropdown";
import type { ParquetPrimitiveType } from "@shared/types";

describe("getOperatorsForType", () => {
  it("returns string operators for UTF8", () => {
    const ops = getOperatorsForType("UTF8");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "contains", "startsWith"]);
  });

  it("returns string operators for BYTE_ARRAY", () => {
    const ops = getOperatorsForType("BYTE_ARRAY");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "contains", "startsWith"]);
  });

  it("returns number operators for INT32", () => {
    const ops = getOperatorsForType("INT32");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "gt", "lt", "gte", "lte"]);
  });

  it("returns number operators for INT64", () => {
    const ops = getOperatorsForType("INT64");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "gt", "lt", "gte", "lte"]);
  });

  it("returns boolean operators for BOOLEAN", () => {
    const ops = getOperatorsForType("BOOLEAN");
    expect(ops.map((o) => o.value)).toEqual(["isTrue", "isFalse"]);
  });

  it("returns date operators for DATE", () => {
    const ops = getOperatorsForType("DATE");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "before", "after"]);
  });

  it("returns date operators for TIMESTAMP_MILLIS", () => {
    const ops = getOperatorsForType("TIMESTAMP_MILLIS");
    expect(ops.map((o) => o.value)).toEqual(["equals", "notEquals", "before", "after"]);
  });
});

describe("FilterDropdown", () => {
  const defaultProps = {
    columnName: "name",
    columnType: "UTF8" as ParquetPrimitiveType,
    onApply: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders operator select and value input", () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByLabelText("Filter operator")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter value")).toBeInTheDocument();
  });

  it("renders Apply and Clear buttons", () => {
    render(<FilterDropdown {...defaultProps} />);
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("calls onApply with operator and value on Apply click", async () => {
    const onApply = vi.fn();
    render(<FilterDropdown {...defaultProps} onApply={onApply} />);
    const input = screen.getByLabelText("Filter value");
    await userEvent.type(input, "Alice");
    await userEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith("equals", "Alice");
  });

  it("calls onClear on Clear click", async () => {
    const onClear = vi.fn();
    render(<FilterDropdown {...defaultProps} onClear={onClear} />);
    await userEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalled();
  });

  it("does not show value input for BOOLEAN type", () => {
    render(<FilterDropdown {...defaultProps} columnType="BOOLEAN" />);
    expect(screen.queryByLabelText("Filter value")).not.toBeInTheDocument();
  });

  it("changes operator via select", async () => {
    const onApply = vi.fn();
    render(<FilterDropdown {...defaultProps} onApply={onApply} />);
    const select = screen.getByLabelText("Filter operator");
    await userEvent.selectOptions(select, "contains");
    const input = screen.getByLabelText("Filter value");
    await userEvent.type(input, "li");
    await userEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith("contains", "li");
  });

  it("pre-fills current filter values", () => {
    render(
      <FilterDropdown
        {...defaultProps}
        currentOperator="contains"
        currentValue="test"
      />,
    );
    const select = screen.getByLabelText("Filter operator") as HTMLSelectElement;
    expect(select.value).toBe("contains");
    const input = screen.getByLabelText("Filter value") as HTMLInputElement;
    expect(input.value).toBe("test");
  });

  it("applies filter on Enter key in value input", async () => {
    const onApply = vi.fn();
    render(<FilterDropdown {...defaultProps} onApply={onApply} />);
    const input = screen.getByLabelText("Filter value");
    await userEvent.type(input, "Bob{Enter}");
    expect(onApply).toHaveBeenCalledWith("equals", "Bob");
  });
});
