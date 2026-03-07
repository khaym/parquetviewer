import * as vscode from "vscode";
import { ParquetEditorDocument } from "./parquetEditorDocument";
import { ParquetService, initParquetWasm } from "./parquetService";
import { validateCellValue } from "../shared/validation";
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage, ColumnFilter } from "../shared/types";

const DEFAULT_PAGE_SIZE = 100;

/**
 * CustomEditorProvider for Parquet files.
 * Manages the lifecycle of ParquetEditorDocument instances and their Webview panels.
 */
export class ParquetEditorProvider
  implements vscode.CustomEditorProvider<ParquetEditorDocument>
{
  static readonly viewType = "parquetEditor.editor";

  private readonly _service = new ParquetService();
  private readonly _pageIndexes = new Map<string, number>();
  private readonly _pageSizes = new Map<string, number>();
  private readonly _filters = new Map<string, ColumnFilter[]>();
  private readonly _panels = new Map<string, vscode.WebviewPanel>();

  private readonly _onDidChangeCustomDocument =
    new vscode.EventEmitter<vscode.CustomDocumentEditEvent<ParquetEditorDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  /**
   * Register this provider with VS Code.
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ParquetEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      ParquetEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  // ── CustomEditorProvider interface ─────────────────────────────

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<ParquetEditorDocument> {
    await initParquetWasm();
    return ParquetEditorDocument.create(uri, this._service);
  }

  async resolveCustomEditor(
    document: ParquetEditorDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "webview", "dist"),
      ],
    };

    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

    const key = document.uri.toString();
    this._panels.set(key, webviewPanel);
    webviewPanel.onDidDispose(() => this._panels.delete(key));

    this._setupMessageHandler(document, webviewPanel);
  }

  async saveCustomDocument(
    document: ParquetEditorDocument,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.save();
    this._sendDirtyState(document);
  }

  async saveCustomDocumentAs(
    document: ParquetEditorDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.saveAs(destination);
  }

  async revertCustomDocument(
    document: ParquetEditorDocument,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.revert();
    const panel = this._panels.get(document.uri.toString());
    if (panel) {
      this._sendInit(document, panel);
      this._sendDirtyState(document);
    }
  }

  async backupCustomDocument(
    _document: ParquetEditorDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    // Minimal backup implementation — return an ID that can be used to restore
    return {
      id: context.destination.toString(),
      delete: () => {
        /* no-op */
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────

  private _setupMessageHandler(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
  ): void {
    panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => {
        switch (msg.type) {
          case "ready":
            this._sendInit(document, panel);
            break;

          case "requestPage":
            if (msg.pageSize !== undefined) {
              this._pageSizes.set(document.uri.toString(), msg.pageSize);
            }
            this._pageIndexes.set(document.uri.toString(), msg.pageIndex);
            this._sendPage(document, panel, msg.pageIndex, msg.pageSize);
            break;

          case "editCell":
            this._handleEditCell(document, panel, msg);
            break;

          case "setFilter":
            this._handleSetFilter(document, panel, msg.filters);
            break;

          case "save":
            this.saveCustomDocument(
              document,
              new vscode.CancellationTokenSource().token,
            ).then(
              () => this._postMessage(panel, { type: "saveResult", success: true }),
              (err) =>
                this._postMessage(panel, {
                  type: "saveResult",
                  success: false,
                  error: String(err),
                }),
            );
            break;
        }
      },
      undefined,
      [],
    );
  }

  private _sendInit(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
  ): void {
    const doc = document.parquetDocument;
    const data = doc.getPage(0, DEFAULT_PAGE_SIZE);
    this._postMessage(panel, {
      type: "init",
      schema: doc.schema,
      data,
    });
  }

  private _sendPage(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
    pageIndex: number,
    pageSize?: number,
  ): void {
    const key = document.uri.toString();
    const size = pageSize ?? this._pageSizes.get(key) ?? DEFAULT_PAGE_SIZE;
    const filters = this._filters.get(key);
    const data = document.parquetDocument.getPage(pageIndex, size, filters);
    this._postMessage(panel, { type: "dataPage", data });
  }

  private _handleSetFilter(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
    filters: ColumnFilter[],
  ): void {
    const key = document.uri.toString();
    if (filters.length > 0) {
      this._filters.set(key, filters);
    } else {
      this._filters.delete(key);
    }
    this._pageIndexes.set(key, 0);
    this._sendCurrentPage(document, panel);
  }

  private _handleEditCell(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
    msg: Extract<WebviewToExtensionMessage, { type: "editCell" }>,
  ): void {
    const doc = document.parquetDocument;
    const column = doc.schema.find((c) => c.name === msg.column);

    if (!column) {
      this._postMessage(panel, {
        type: "validationError",
        rowIndex: msg.rowIndex,
        column: msg.column,
        message: `Unknown column: ${msg.column}`,
      });
      return;
    }

    // Validate value against column schema
    const validation = validateCellValue(column, msg.value);
    if (!validation.success) {
      this._postMessage(panel, {
        type: "validationError",
        rowIndex: msg.rowIndex,
        column: msg.column,
        message: validation.error,
      });
      return;
    }

    doc.editCell(msg.rowIndex, msg.column, msg.value);

    // Fire edit event for VS Code undo/redo integration
    this._onDidChangeCustomDocument.fire({
      document,
      undo: async () => {
        doc.undo();
        this._sendCurrentPage(document, panel);
        this._sendDirtyState(document);
      },
      redo: async () => {
        doc.redo();
        this._sendCurrentPage(document, panel);
        this._sendDirtyState(document);
      },
      label: `Edit ${msg.column}[${msg.rowIndex}]`,
    });

    // Send updated page and dirty state to webview
    this._sendCurrentPage(document, panel);
    this._sendDirtyState(document);
  }

  private _sendCurrentPage(
    document: ParquetEditorDocument,
    panel: vscode.WebviewPanel,
  ): void {
    const key = document.uri.toString();
    const pageIndex = this._pageIndexes.get(key) ?? 0;
    const pageSize = this._pageSizes.get(key) ?? DEFAULT_PAGE_SIZE;
    const filters = this._filters.get(key);
    const data = document.parquetDocument.getPage(pageIndex, pageSize, filters);
    this._postMessage(panel, { type: "dataPage", data });
  }

  private _sendDirtyState(document: ParquetEditorDocument): void {
    const panel = this._panels.get(document.uri.toString());
    if (panel) {
      this._postMessage(panel, {
        type: "dirtyState",
        isDirty: document.parquetDocument.isDirty,
      });
    }
  }

  private _postMessage(
    panel: vscode.WebviewPanel,
    message: ExtensionToWebviewMessage,
  ): void {
    panel.webview.postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(
      this._context.extensionUri,
      "webview",
      "dist",
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, "assets", "index.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distUri, "assets", "index.css"),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Parquet Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
