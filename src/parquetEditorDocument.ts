import * as vscode from "vscode";
import { ParquetDocument } from "./parquetDocument";
import { ParquetService } from "./parquetService";

/**
 * VS Code CustomDocument wrapper that integrates ParquetDocument (edit state)
 * with ParquetService (file I/O).
 */
export class ParquetEditorDocument implements vscode.CustomDocument {
  readonly uri: vscode.Uri;
  private _parquetDocument: ParquetDocument;
  private readonly _service: ParquetService;

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private constructor(
    uri: vscode.Uri,
    parquetDocument: ParquetDocument,
    service: ParquetService,
  ) {
    this.uri = uri;
    this._parquetDocument = parquetDocument;
    this._service = service;
  }

  get parquetDocument(): ParquetDocument {
    return this._parquetDocument;
  }

  /**
   * Create a new ParquetEditorDocument by reading a file from disk.
   */
  static async create(
    uri: vscode.Uri,
    service: ParquetService,
  ): Promise<ParquetEditorDocument> {
    const fileData = await vscode.workspace.fs.readFile(uri);
    const result = await service.readFile(new Uint8Array(fileData));
    const doc = new ParquetDocument(result.schema, result.rows);
    return new ParquetEditorDocument(uri, doc, service);
  }

  /**
   * Save the document to its original URI.
   */
  async save(): Promise<void> {
    const buffer = await this._service.writeFile(
      this._parquetDocument.schema,
      this._parquetDocument.currentRows,
    );
    await vscode.workspace.fs.writeFile(this.uri, buffer);
    this._parquetDocument.markSaved();
  }

  /**
   * Save the document to a different URI.
   */
  async saveAs(targetUri: vscode.Uri): Promise<void> {
    const buffer = await this._service.writeFile(
      this._parquetDocument.schema,
      this._parquetDocument.currentRows,
    );
    await vscode.workspace.fs.writeFile(targetUri, buffer);
  }

  /**
   * Revert the document by re-reading from disk.
   */
  async revert(): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(this.uri);
    const result = await this._service.readFile(new Uint8Array(fileData));
    this._parquetDocument = new ParquetDocument(result.schema, result.rows);
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
  }
}
