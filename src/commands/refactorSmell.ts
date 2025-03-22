import * as vscode from 'vscode';
import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import path from 'path';

/**
 * Handles the refactoring of a specific smell.
 *
 * @param treeDataProvider - The tree data provider for updating the UI.
 * @param refactoringDetailsViewProvider - The refactoring details view provider.
 * @param smell - The smell to refactor.
 */
export async function refactorSmell(
  treeDataProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smell: Smell,
) {
  if (!smell) {
    vscode.window.showErrorMessage('Error: Invalid smell.');
    return;
  }

  vscode.window.showInformationMessage(`Refactoring code smell: ${smell.symbol}`);

  try {
    // Call the backend to refactor the smell
    const refactoredData = await backendRefactorSmell(smell);

    // Log the response from the backend
    console.log('Refactoring response:', refactoredData);

    // Update the refactoring details view with the target file, affected files, and energy saved
    refactoringDetailsViewProvider.updateRefactoringDetails(
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved, // Pass the energy saved value
    );

    // Show a diff view for the target file
    const targetFile = refactoredData.targetFile;
    const fileName = path.basename(targetFile.original);
    const originalUri = vscode.Uri.file(targetFile.original);
    const refactoredUri = vscode.Uri.file(targetFile.refactored);
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      refactoredUri,
      `Refactoring Comparison (${fileName})`,
      {
        preview: false, // Ensure the diff editor is not in preview mode
      },
    );

    // Set a context key to track that refactoring is in progress
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

    // Notify the user
    vscode.window.showInformationMessage(
      `Refactoring successful! Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );
  } catch (error: any) {
    console.error('Refactoring failed:', error.message);
    vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);

    // Reset the refactoring details view on failure
    refactoringDetailsViewProvider.resetRefactoringDetails();
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}
