import * as vscode from 'vscode';

import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { ecoOutput } from '../extension';
import { openDiffEditor } from '../utils/openDiffEditor';

function normalizePath(filePath: string): string {
  const normalizedPath = filePath.toLowerCase(); // Normalize case for consistent Map keying
  return normalizedPath;
}

/**
 * Handles the refactoring of a specific smell.
 *
 * @param treeDataProvider - The tree data provider for updating the UI.
 * @param refactoringDetailsViewProvider - The refactoring details view provider.
 * @param smell - The smell to refactor.
 */
export async function refactorSmell(
  smellsDataProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smell: Smell,
): Promise<void> {
  if (!smell) {
    vscode.window.showErrorMessage('Error: Invalid smell.');
    return;
  }

  vscode.window.showInformationMessage(`Refactoring code smell: ${smell.symbol}`);

  // Update UI to indicate the file is queued for analysis
  smellsDataProvider.setStatus(smell.path, 'queued');

  try {
    // Set a context key to track that refactoring is in progress
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

    // Call the backend to refactor the smell
    const refactoredData = await backendRefactorSmell(smell);

    // Log the response from the backend
    ecoOutput.appendLine(`Refactoring response: ${JSON.stringify(refactoredData)}`);

    // Update the refactoring details view with the target file, affected files, and energy saved
    refactoringDetailsViewProvider.updateRefactoringDetails(
      smell.symbol,
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved, // Pass the energy saved value
    );

    // Show a diff view for the target file
    await openDiffEditor(
      refactoredData.targetFile.original,
      refactoredData.targetFile.refactored,
    );

    // Focus on the Refactoring Details view
    await vscode.commands.executeCommand('ecooptimizer.refactorView.focus');

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
