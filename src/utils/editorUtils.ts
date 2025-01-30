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
// /**
//  * Gets the active editor, its file path and the workspace that contains it if an editor is open.
//  * @returns {{ editor: vscode.TextEditor | undefined, filePath: string | undefined, workspace: string | undefined }}
//  * An object containing the active editor, the file path and workspace, or undefined for all three if no editor is open.
//  */
// export function getEditorAndPaths(): {
//   editor: vscode.TextEditor | undefined;
//   filePath: string | undefined;
//   workspace: string | undefined;
// } {
//   const activeEditor = vscode.window.activeTextEditor;
//   const fileUri = activeEditor?.document.uri!;
//   const workspace = vscode.workspace.getWorkspaceFolder(fileUri)?.uri.fsPath;
//   return {
//     editor: activeEditor,
//     filePath: fileUri.fsPath,
//     workspace: workspace
//   };
// }

/**
 * Gets the active editor if an editor is open.
 */
export function getEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}
