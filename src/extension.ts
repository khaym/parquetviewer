import * as vscode from "vscode";
import { ParquetEditorProvider } from "./parquetEditor";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(ParquetEditorProvider.register(context));
}

export function deactivate(): void {
  // no-op
}
