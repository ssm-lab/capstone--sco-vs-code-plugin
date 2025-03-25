import * as vscode from 'vscode';

/**
 * Opens a file in the VS Code editor.
 * Ensures the file is fully opened (not in preview mode).
 * Displays an error message if no file is selected.
 *
 * @param fileUri - The URI of the file to be opened.
 */
export async function openFile(fileUri: vscode.Uri) {
  if (!fileUri) {
    vscode.window.showErrorMessage('Error: No file selected.');
    return;
  }

  await vscode.window.showTextDocument(fileUri, {
    preview: false, // Ensures the file opens as a permanent tab (not in preview mode)
    viewColumn: vscode.ViewColumn.Active, // Opens in the active editor column
    preserveFocus: false, // Focuses the file when opened
  });
}
