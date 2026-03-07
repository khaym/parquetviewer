import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EditableCell, parseInputValue } from "../components/EditableCell";
import type { ParquetColumnSchema } from "@shared/types";

const stringCol: ParquetColumnSchema = { name: "name", type: "UTF8", nullable: false };
const intCol: ParquetColumnSchema = { name: "age", type: "INT32", nullable: false };
const nullableIntCol: ParquetColumnSchema = { name: "score", type: "INT32", nullable: true };
const boolCol: ParquetColumnSchema = { name: "active", type: "BOOLEAN", nullable: false };
const int64Col: ParquetColumnSchema = { name: "big", type: "INT64", nullable: false };
const floatCol: ParquetColumnSchema = { name: "ratio", type: "FLOAT", nullable: false };
const nullableBoolCol: ParquetColumnSchema = { name: "flag", type: "BOOLEAN", nullable: true };

describe("parseInputValue", () => {
  it("converts numeric string for INT8-UINT32, FLOAT, DOUBLE", () => {
    expect(parseInputValue("42", "INT32")).toBe(42);
    expect(parseInputValue("3.14", "FLOAT")).toBeCloseTo(3.14);
    expect(parseInputValue("255", "UINT8")).toBe(255);
    expect(parseInputValue("-1.5", "DOUBLE")).toBe(-1.5);
  });

  it("keeps string for INT64, UINT64", () => {
    expect(parseInputValue("9999999999999999", "INT64")).toBe("9999999999999999");
    expect(parseInputValue("12345", "UINT64")).toBe("12345");
  });

  it("keeps string for UTF8, BYTE_ARRAY, DATE, TIMESTAMP types", () => {
    expect(parseInputValue("hello", "UTF8")).toBe("hello");
    expect(parseInputValue("2024-01-15", "DATE")).toBe("2024-01-15");
    expect(parseInputValue("data", "BYTE_ARRAY")).toBe("data");
    expect(parseInputValue("2024-01-15T10:00:00Z", "TIMESTAMP_MILLIS")).toBe("2024-01-15T10:00:00Z");
  });

  it("empty string on string type returns empty string (not null)", () => {
    expect(parseInputValue("", "UTF8")).toBe("");
  });

  it("empty string on numeric type returns 0 (Number('') === 0)", () => {
    expect(parseInputValue("", "INT32")).toBe(0);
  });

  // --- BOOLEAN type ---
  it("returns true for 'true' string on BOOLEAN type", () => {
    expect(parseInputValue("true", "BOOLEAN")).toBe(true);
  });

  it("returns false for 'false' string on BOOLEAN type", () => {
    expect(parseInputValue("false", "BOOLEAN")).toBe(false);
  });

  it("empty string on BOOLEAN returns false ('false' !== 'true')", () => {
    expect(parseInputValue("", "BOOLEAN")).toBe(false);
  });

  // --- whitespace strings ---
  it("whitespace string on numeric type returns 0 (Number(' ') === 0)", () => {
    expect(parseInputValue(" ", "INT32")).toBe(0);
  });

  it("whitespace string on string type passes through as-is", () => {
    expect(parseInputValue(" ", "UTF8")).toBe(" ");
  });

  // --- Infinity / NaN strings ---
  it("'Infinity' on numeric type returns Infinity", () => {
    expect(parseInputValue("Infinity", "FLOAT")).toBe(Infinity);
  });

  it("'-Infinity' on numeric type returns -Infinity", () => {
    expect(parseInputValue("-Infinity", "DOUBLE")).toBe(-Infinity);
  });

  it("'NaN' on numeric type returns NaN", () => {
    expect(parseInputValue("NaN", "INT32")).toBeNaN();
  });

  // --- UINT64 negative value (pass-through, validation catches it) ---
  it("negative string for UINT64 passes through as string", () => {
    expect(parseInputValue("-1", "UINT64")).toBe("-1");
  });

  // --- DATE / TIMESTAMP invalid format (pass-through, validation catches it) ---
  it("invalid date format passes through as string for DATE type", () => {
    expect(parseInputValue("not-a-date", "DATE")).toBe("not-a-date");
  });

  it("invalid timestamp passes through as string for TIMESTAMP_MILLIS", () => {
    expect(parseInputValue("bad", "TIMESTAMP_MILLIS")).toBe("bad");
  });
});

describe("EditableCell", () => {
  it("displays the value as text in view mode", () => {
    render(
      <EditableCell value="hello" column={stringCol} onCommit={vi.fn()} />
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("displays NULL for null values with special styling", () => {
    const nullableCol: ParquetColumnSchema = { name: "x", type: "UTF8", nullable: true };
    render(
      <EditableCell value={null} column={nullableCol} onCommit={vi.fn()} />
    );
    const nullSpan = screen.getByText("NULL");
    expect(nullSpan).toHaveClass("null-value");
  });

  it("displays empty string with quotes to distinguish from null", () => {
    render(
      <EditableCell value="" column={stringCol} onCommit={vi.fn()} />
    );
    const emptySpan = screen.getByText('""');
    expect(emptySpan).toHaveClass("empty-string-value");
  });

  it("enters edit mode on click and shows input with current value", async () => {
    render(
      <EditableCell value="hello" column={stringCol} onCommit={vi.fn()} />
    );
    await userEvent.click(screen.getByText("hello"));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("hello");
    expect(input).toHaveFocus();
  });

  it("commits value on Enter", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="old" column={stringCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("old"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "new{Enter}");
    expect(onCommit).toHaveBeenCalledWith("new");
  });

  it("cancels edit on Escape without committing", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="original" column={stringCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("original"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "changed{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("original")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("parses numeric input for INT32 column", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={10} column={intCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("10"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "42{Enter}");
    expect(onCommit).toHaveBeenCalledWith(42);
  });

  it("commits 0 for empty input on nullable numeric column (null via Set NULL button)", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={5} column={nullableIntCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("5"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("commits null when Set NULL button is clicked on nullable column", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={5} column={nullableIntCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("5"));
    const nullBtn = screen.getByRole("button", { name: "Set NULL" });
    await userEvent.click(nullBtn);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it("does not show Set NULL button on non-nullable column", async () => {
    render(
      <EditableCell value={5} column={intCol} onCommit={vi.fn()} />
    );
    await userEvent.click(screen.getByText("5"));
    expect(screen.queryByRole("button", { name: "Set NULL" })).not.toBeInTheDocument();
  });

  it("commits null on Ctrl+Delete for nullable column", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="hello" column={{ name: "x", type: "UTF8", nullable: true }} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("hello"));
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Control>}{Delete}{/Control}");
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it("does not commit null on Ctrl+Delete for non-nullable column", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="hello" column={stringCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("hello"));
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "{Control>}{Delete}{/Control}");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("toggles boolean value on click (no input mode)", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={true} column={boolCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("true"));
    expect(onCommit).toHaveBeenCalledWith(false);
  });

  it("shows validation error with red border and title", () => {
    render(
      <EditableCell
        value="hello"
        column={stringCol}
        onCommit={vi.fn()}
        validationError="Invalid value"
      />
    );
    const cell = screen.getByTitle("Invalid value");
    expect(cell).toHaveClass("validation-error");
  });

  it("commits value on blur", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="test" column={stringCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("test"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "updated");
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith("updated");
  });

  it("adds cell-numeric class for numeric types", () => {
    const { container } = render(
      <EditableCell value={42} column={intCol} onCommit={vi.fn()} />
    );
    expect(container.querySelector(".cell-numeric")).toBeInTheDocument();
  });

  it("adds cell-numeric class for FLOAT type", () => {
    const { container } = render(
      <EditableCell value={3.14} column={floatCol} onCommit={vi.fn()} />
    );
    expect(container.querySelector(".cell-numeric")).toBeInTheDocument();
  });

  it("does not add cell-numeric class for non-numeric types", () => {
    const { container } = render(
      <EditableCell value="hello" column={stringCol} onCommit={vi.fn()} />
    );
    expect(container.querySelector(".cell-numeric")).not.toBeInTheDocument();
  });

  it("does not add cell-numeric class for BOOLEAN type", () => {
    const { container } = render(
      <EditableCell value={true} column={boolCol} onCommit={vi.fn()} />
    );
    expect(container.querySelector(".cell-numeric")).not.toBeInTheDocument();
  });

  it("does not add cell-numeric class for INT64 (string-serialized)", () => {
    const { container } = render(
      <EditableCell value="999" column={int64Col} onCommit={vi.fn()} />
    );
    expect(container.querySelector(".cell-numeric")).not.toBeInTheDocument();
  });

  // --- null/undefined value click-to-edit ---

  it("enters edit mode with empty input when value is null", async () => {
    const nullableCol: ParquetColumnSchema = { name: "x", type: "UTF8", nullable: true };
    render(
      <EditableCell value={null} column={nullableCol} onCommit={vi.fn()} />
    );
    await userEvent.click(screen.getByText("NULL"));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("enters edit mode with empty input when value is undefined", async () => {
    render(
      <EditableCell value={undefined} column={stringCol} onCommit={vi.fn()} />
    );
    await userEvent.click(screen.getByText("NULL"));
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  // --- Non-numeric input on numeric column ---

  it("commits NaN for non-numeric input on INT32 column", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={10} column={intCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("10"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "abc{Enter}");
    expect(onCommit).toHaveBeenCalledWith(NaN);
  });

  // --- Edit → confirm → re-click → edit again ---

  it("can re-enter edit mode after committing", async () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <EditableCell value="hello" column={stringCol} onCommit={onCommit} />
    );
    // First edit
    await userEvent.click(screen.getByText("hello"));
    await userEvent.type(screen.getByRole("textbox"), "{Enter}");
    expect(onCommit).toHaveBeenCalledTimes(1);

    // Re-render with new value, then click again
    rerender(
      <EditableCell value="hello" column={stringCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("hello"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  // --- Escape then re-click ---

  it("can re-enter edit mode after Escape", async () => {
    render(
      <EditableCell value="test" column={stringCol} onCommit={vi.fn()} />
    );
    await userEvent.click(screen.getByText("test"));
    await userEvent.type(screen.getByRole("textbox"), "{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("test"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  // --- Nullable boolean toggle ---

  it("toggles nullable boolean null → true", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value={null} column={nullableBoolCol} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("NULL"));
    expect(onCommit).toHaveBeenCalledWith(true);
  });

  it("keeps INT64 value as string", async () => {
    const onCommit = vi.fn();
    render(
      <EditableCell value="9999999999999999" column={int64Col} onCommit={onCommit} />
    );
    await userEvent.click(screen.getByText("9999999999999999"));
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "1234567890123456{Enter}");
    expect(onCommit).toHaveBeenCalledWith("1234567890123456");
  });
});
