/**
 * Tests for the dev mock defined inline in index.html.
 *
 * Since the production mock lives in index.html as an inline <script>,
 * we cannot directly import it. Instead, we test the equivalent logic
 * from dev/setup.ts (which is kept as a testable reference) and also
 * test that the inline mock pattern works correctly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionToWebviewMessage } from "@shared/types";

describe("dev/setup", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (window as Record<string, unknown>).acquireVsCodeApi;
  });

  async function loadSetup() {
    await vi.importActual("../dev/setup");
  }

  it("installs acquireVsCodeApi on window", async () => {
    await loadSetup();
    expect(typeof window.acquireVsCodeApi).toBe("function");
  });

  it("acquireVsCodeApi returns an object with postMessage, getState, setState", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();
    expect(typeof api.postMessage).toBe("function");
    expect(typeof api.getState).toBe("function");
    expect(typeof api.setState).toBe("function");
  });

  it("getState/setState work as in-memory storage", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();
    expect(api.getState()).toEqual({});
    api.setState({ page: 1 });
    expect(api.getState()).toEqual({ page: 1 });
  });

  it("responds to 'ready' with 'init' message containing schema and data", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();

    const received: ExtensionToWebviewMessage[] = [];
    const handler = (event: MessageEvent) => {
      if (event.data?.type) {
        received.push(event.data);
      }
    };
    window.addEventListener("message", handler);

    api.postMessage({ type: "ready" });
    await new Promise((r) => setTimeout(r, 50));

    window.removeEventListener("message", handler);

    const initMsg = received.find((m) => m.type === "init");
    expect(initMsg).toBeDefined();
    if (initMsg?.type !== "init") throw new Error("unreachable");

    expect(initMsg.schema.length).toBeGreaterThan(0);
    expect(initMsg.data.rows.length).toBe(10);
    expect(initMsg.data.pageIndex).toBe(0);
    expect(initMsg.data.totalRows).toBe(30);
  });

  it("responds to 'requestPage' with 'dataPage' for the correct page", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();

    const received: ExtensionToWebviewMessage[] = [];
    const handler = (event: MessageEvent) => {
      if (event.data?.type) {
        received.push(event.data);
      }
    };
    window.addEventListener("message", handler);

    api.postMessage({ type: "requestPage", pageIndex: 2 });
    await new Promise((r) => setTimeout(r, 50));

    window.removeEventListener("message", handler);

    const pageMsg = received.find((m) => m.type === "dataPage");
    expect(pageMsg).toBeDefined();
    if (pageMsg?.type !== "dataPage") throw new Error("unreachable");

    expect(pageMsg.data.pageIndex).toBe(2);
    expect(pageMsg.data.rows.length).toBe(10);
  });

  it("handles 'editCell' by updating sample data and sending dataPage", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const received: ExtensionToWebviewMessage[] = [];
    const handler = (event: MessageEvent) => {
      if (event.data?.type) {
        received.push(event.data);
      }
    };
    window.addEventListener("message", handler);

    api.postMessage({ type: "editCell", rowIndex: 0, column: "name", value: "Updated" });
    await new Promise((r) => setTimeout(r, 50));

    window.removeEventListener("message", handler);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[dev] editCell"),
      "Updated",
    );
    consoleSpy.mockRestore();

    // Should also send a dataPage with the updated data
    const pageMsg = received.find((m) => m.type === "dataPage");
    expect(pageMsg).toBeDefined();
    if (pageMsg?.type !== "dataPage") throw new Error("unreachable");
    expect(pageMsg.data.pageIndex).toBe(0);
  });

  it("respects pageSize in requestPage", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();

    const received: ExtensionToWebviewMessage[] = [];
    const handler = (event: MessageEvent) => {
      if (event.data?.type) {
        received.push(event.data);
      }
    };
    window.addEventListener("message", handler);

    api.postMessage({ type: "requestPage", pageIndex: 0, pageSize: 5 });
    await new Promise((r) => setTimeout(r, 50));

    window.removeEventListener("message", handler);

    const pageMsg = received.find((m) => m.type === "dataPage");
    expect(pageMsg).toBeDefined();
    if (pageMsg?.type !== "dataPage") throw new Error("unreachable");

    expect(pageMsg.data.rows.length).toBe(5);
    expect(pageMsg.data.pageSize).toBe(5);
  });

  it("schema covers multiple Parquet types", async () => {
    await loadSetup();
    const api = window.acquireVsCodeApi();

    const received: ExtensionToWebviewMessage[] = [];
    const handler = (event: MessageEvent) => {
      if (event.data?.type) received.push(event.data);
    };
    window.addEventListener("message", handler);

    api.postMessage({ type: "ready" });
    await new Promise((r) => setTimeout(r, 50));

    window.removeEventListener("message", handler);

    const initMsg = received.find((m) => m.type === "init");
    if (initMsg?.type !== "init") throw new Error("no init message");

    const types = initMsg.schema.map((c) => c.type);
    expect(types).toContain("INT32");
    expect(types).toContain("UTF8");
    expect(types).toContain("BOOLEAN");
    expect(types).toContain("FLOAT");
    expect(types).toContain("INT64");
    expect(types).toContain("DATE");
    expect(types).toContain("TIMESTAMP_MILLIS");
  });
});
