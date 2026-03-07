import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "../components/Pagination";

describe("Pagination", () => {
  const defaultProps = {
    pageIndex: 0,
    totalPages: 5,
    totalRows: 50,
    pageSize: 100,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onPageSizeChange: vi.fn(),
    onPageJump: vi.fn(),
  };

  it("displays current page, total pages, and total rows", () => {
    render(<Pagination {...defaultProps} pageIndex={2} />);
    expect(screen.getByText("Page 3 of 5 (50 rows)")).toBeInTheDocument();
  });

  it("disables Previous button on first page", () => {
    render(<Pagination {...defaultProps} pageIndex={0} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(<Pagination {...defaultProps} pageIndex={4} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("enables both buttons on a middle page", () => {
    render(<Pagination {...defaultProps} pageIndex={2} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("calls onPrevious when Previous is clicked", async () => {
    const onPrevious = vi.fn();
    render(<Pagination {...defaultProps} pageIndex={2} onPrevious={onPrevious} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("calls onNext when Next is clicked", async () => {
    const onNext = vi.fn();
    render(<Pagination {...defaultProps} pageIndex={2} onNext={onNext} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("handles single page (both buttons disabled)", () => {
    render(<Pagination {...defaultProps} pageIndex={0} totalPages={1} totalRows={5} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("Page 1 of 1 (5 rows)")).toBeInTheDocument();
  });

  it("renders page size select with options", () => {
    render(<Pagination {...defaultProps} pageSize={100} />);
    const select = screen.getByRole("combobox", { name: "Page size" });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("100");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(5);
    expect(options.map((o) => o.textContent)).toEqual([
      "10 rows", "50 rows", "100 rows", "500 rows", "1000 rows",
    ]);
  });

  it("calls onPageSizeChange when select value changes", async () => {
    const onPageSizeChange = vi.fn();
    render(<Pagination {...defaultProps} pageSize={100} onPageSizeChange={onPageSizeChange} />);
    const select = screen.getByRole("combobox", { name: "Page size" });
    await userEvent.selectOptions(select, "50");
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it("renders page jump input", () => {
    render(<Pagination {...defaultProps} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    expect(input).toBeInTheDocument();
  });

  it("calls onPageJump with correct page index on Enter", async () => {
    const onPageJump = vi.fn();
    render(<Pagination {...defaultProps} totalPages={5} onPageJump={onPageJump} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    await userEvent.type(input, "3{Enter}");
    expect(onPageJump).toHaveBeenCalledWith(2); // 0-indexed
  });

  it("does not call onPageJump for out-of-range page number", async () => {
    const onPageJump = vi.fn();
    render(<Pagination {...defaultProps} totalPages={5} onPageJump={onPageJump} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    await userEvent.type(input, "10{Enter}");
    expect(onPageJump).not.toHaveBeenCalled();
  });

  it("does not call onPageJump for page 0", async () => {
    const onPageJump = vi.fn();
    render(<Pagination {...defaultProps} totalPages={5} onPageJump={onPageJump} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    await userEvent.type(input, "0{Enter}");
    expect(onPageJump).not.toHaveBeenCalled();
  });

  it("clears jump input after successful jump", async () => {
    const onPageJump = vi.fn();
    render(<Pagination {...defaultProps} totalPages={5} onPageJump={onPageJump} />);
    const input = screen.getByRole("spinbutton", { name: "Jump to page" });
    await userEvent.type(input, "3{Enter}");
    expect(input).toHaveValue(null); // cleared
  });
});
