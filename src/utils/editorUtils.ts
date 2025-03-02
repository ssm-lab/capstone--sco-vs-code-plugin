import * as vscode from 'vscode';

/**
 * Gets the active editor and its file path if an editor is open.
 * @returns {{ editor: vscode.TextEditor | undefined, filePath: string | undefined }}
 * An object containing the active editor and the file path, or undefined for both if no editor is open.
 */
export function getEditorAndFilePath(): {
  editor: vscode.TextEditor | undefined;
  filePath: string | undefined;
} {
  const activeEditor = vscode.window.activeTextEditor;
  const filePath = activeEditor?.document.uri.fsPath;
  return { editor: activeEditor, filePath };
}

/**
 * Gets the active editor if an editor is open.
 */
export function getEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}
