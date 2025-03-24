import * as vscode from 'vscode';
import * as path from 'path';

const openedRefactorDiffs: [vscode.Uri, vscode.Uri][] = [];

export async function openDiffEditor(
  originalFilePath: string,
  refactoredFilePath: string,
): Promise<void> {
  const fileName = path.basename(originalFilePath);
  const originalUri = vscode.Uri.file(originalFilePath);
  const refactoredUri = vscode.Uri.file(refactoredFilePath);

  // Store this diff pair for later cleanup
  openedRefactorDiffs.push([originalUri, refactoredUri]);

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    refactoredUri,
    `Refactoring Comparison (${fileName})`,
    { preview: false },
  );
}

// Utility to close all tracked diff editors
export async function closeAllRefactorDiffEditors(): Promise<void> {
  const visibleEditors = vscode.window.visibleTextEditors;

  for (const editor of visibleEditors) {
    const uri = editor.document.uri;
    const isRefactorDiff = openedRefactorDiffs.some(
      ([original, refactored]) =>
        uri.toString() === original.toString() ||
        uri.toString() === refactored.toString(),
    );

    if (isRefactorDiff) {
      await vscode.window.showTextDocument(uri, { preview: false });
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }

  openedRefactorDiffs.length = 0; // clear tracked diffs
}
