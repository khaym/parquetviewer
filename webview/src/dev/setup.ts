import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "@shared/types";
import { sampleSchema, sampleRows, getSamplePage } from "./sampleData";

const DEFAULT_PAGE_SIZE = 10;

let currentPageSize = DEFAULT_PAGE_SIZE;
let state: Record<string, unknown> = {};

/**
 * Dispatch a message event on window, simulating VS Code extension → webview messaging.
 */
function sendToWebview(data: ExtensionToWebviewMessage): void {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

function handleMessage(msg: WebviewToExtensionMessage): void {
  switch (msg.type) {
    case "ready": {
      const page = getSamplePage(0, currentPageSize);
      sendToWebview({ type: "init", schema: sampleSchema, data: page });
      break;
    }
    case "requestPage": {
      if (msg.pageSize !== undefined) {
        currentPageSize = msg.pageSize;
      }
      const page = getSamplePage(msg.pageIndex, currentPageSize);
      sendToWebview({ type: "dataPage", data: page });
      break;
    }
    case "editCell": {
      const row = sampleRows[msg.rowIndex];
      if (row) {
        row[msg.column] = msg.value;
        console.log(
          `[dev] editCell row=${msg.rowIndex} col=${msg.column} value=`,
          msg.value,
        );
        // Send updated page so webview reflects the edit
        const pageIndex = Math.floor(msg.rowIndex / currentPageSize);
        const page = getSamplePage(pageIndex, currentPageSize);
        sendToWebview({ type: "dataPage", data: page });
      }
      break;
    }
    case "save": {
      console.log("[dev] save requested (no-op in dev mode)");
      sendToWebview({ type: "saveResult", success: true });
      break;
    }
  }
}

window.acquireVsCodeApi = () => ({
  postMessage(message: unknown) {
    // Delay to mimic async Extension Host response
    setTimeout(() => handleMessage(message as WebviewToExtensionMessage), 0);
  },
  getState() {
    return state;
  },
  setState(newState: unknown) {
    state = newState as Record<string, unknown>;
  },
});

console.log("[dev] VS Code API mock installed");
