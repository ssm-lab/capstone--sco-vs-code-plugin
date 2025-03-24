import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Opens a VS Code diff editor comparing the original and refactored file.
 *
 * @param originalFilePath - Path to the original file.
 * @param refactoredFilePath - Path to the refactored version of the file.
 */
export async function openDiffEditor(
  originalFilePath: string,
  refactoredFilePath: string,
): Promise<void> {
  const fileName = path.basename(originalFilePath);
  const originalUri = vscode.Uri.file(originalFilePath);
  const refactoredUri = vscode.Uri.file(refactoredFilePath);

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    refactoredUri,
    `Refactoring Comparison (${fileName})`,
    {
      preview: false,
    },
  );
}
