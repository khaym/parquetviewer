import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionToWebviewMessage, ParquetSchema, DataPage } from "@shared/types";

// Mock acquireVsCodeApi
const mockPostMessage = vi.fn();
vi.stubGlobal("acquireVsCodeApi", () => ({
  postMessage: mockPostMessage,
  getState: () => null,
  setState: vi.fn(),
}));

import { App } from "../App";

const schema: ParquetSchema = [
  { name: "id", type: "INT32", nullable: false },
  { name: "name", type: "UTF8", nullable: true },
];

const dataPage: DataPage = {
  rows: [{ id: 1, name: "Alice" }],
  pageIndex: 0,
  pageSize: 100,
  totalRows: 1,
};

function sendMessage(msg: ExtensionToWebviewMessage) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data: msg }));
  });
}

describe("App — before init", () => {
  it("renders without crashing before receiving init message", () => {
    const { container } = render(<App />);
    // Should not show data table or schema view
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });
});

describe("App tab switching", () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it("shows Data tab as active by default", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    const dataTab = screen.getByRole("tab", { name: "Data" });
    expect(dataTab).toHaveAttribute("aria-selected", "true");
  });

  it("shows Schema tab as inactive by default", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    const schemaTab = screen.getByRole("tab", { name: "Schema" });
    expect(schemaTab).toHaveAttribute("aria-selected", "false");
  });

  it("switches to SchemaView when Schema tab is clicked", async () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    await userEvent.click(screen.getByRole("tab", { name: "Schema" }));

    // SchemaView should be visible with column info
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Nullable")).toBeInTheDocument();
    expect(screen.getByText("2 columns")).toBeInTheDocument();
  });

  it("switches back to DataTable when Data tab is clicked", async () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    // Switch to Schema
    await userEvent.click(screen.getByRole("tab", { name: "Schema" }));
    // Switch back to Data
    await userEvent.click(screen.getByRole("tab", { name: "Data" }));

    const dataTab = screen.getByRole("tab", { name: "Data" });
    expect(dataTab).toHaveAttribute("aria-selected", "true");
    // DataTable content should be visible
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("hides pagination when Schema tab is active", async () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    await userEvent.click(screen.getByRole("tab", { name: "Schema" }));

    expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
  });

  it("shows total rows in the tab bar", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    const tabBar = screen.getByRole("tablist");
    expect(tabBar).toHaveTextContent("1 rows");
  });

  it("shows filtered row count when filteredTotalRows is present", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });
    sendMessage({
      type: "dataPage",
      data: { ...dataPage, totalRows: 100, filteredTotalRows: 5 },
    });

    const tabBar = screen.getByRole("tablist");
    expect(tabBar).toHaveTextContent("5 of 100 rows");
  });

  it("sends setFilter message when filter is applied", async () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    // Click filter icon for "name" column
    await userEvent.click(screen.getByLabelText("Filter name"));
    // Type a value and apply
    const input = screen.getByLabelText("Filter value");
    await userEvent.type(input, "Alice");
    await userEvent.click(screen.getByText("Apply"));

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "setFilter",
      filters: [{ column: "name", operator: "equals", value: "Alice" }],
    });
  });
});

describe("App — dirty state", () => {
  beforeEach(() => {
    mockPostMessage.mockClear();
  });

  it("does not show dirty indicator initially", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });

    expect(screen.queryByText("(unsaved)")).not.toBeInTheDocument();
  });

  it("shows dirty indicator when dirtyState isDirty=true", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });
    sendMessage({ type: "dirtyState", isDirty: true });

    expect(screen.getByText("(unsaved)")).toBeInTheDocument();
  });

  it("hides dirty indicator when dirtyState isDirty=false", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });
    sendMessage({ type: "dirtyState", isDirty: true });
    sendMessage({ type: "dirtyState", isDirty: false });

    expect(screen.queryByText("(unsaved)")).not.toBeInTheDocument();
  });

  it("shows save error in error banner", () => {
    render(<App />);
    sendMessage({ type: "init", schema, data: dataPage });
    sendMessage({ type: "saveResult", success: false, error: "Disk full" });

    expect(screen.getByText(/Save failed: Disk full/)).toBeInTheDocument();
  });
});
