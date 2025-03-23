import * as vscode from 'vscode';
import { basename } from 'path';
import * as fs from 'fs';

import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

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
  smellsDataProvider.updateStatus(smell.path, 'queued');

  try {
    // Set a context key to track that refactoring is in progress
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

    // Call the backend to refactor the smell
    const refactoredData = await backendRefactorSmell(smell);

    // Log the response from the backend
    ecoOutput.appendLine('Refactoring response:', refactoredData);

    // Update the refactoring details view with the target file, affected files, and energy saved
    refactoringDetailsViewProvider.updateRefactoringDetails(
      smell.symbol,
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved, // Pass the energy saved value
    );

    // Show a diff view for the target file
    const targetFile = refactoredData.targetFile;
    const fileName = basename(targetFile.original);
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

    // Focus on the Refactoring Details view
    await vscode.commands.executeCommand('ecooptimizer.refactoringDetails.focus');

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

/**
 * Accepts the refactoring changes and saves the refactored files.
 * Marks the modified files as outdated and clears their smell cache.
 */
export async function acceptRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  metricsDataProvider: MetricsViewProvider,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  const targetFile = refactoringDetailsViewProvider.targetFile;
  const affectedFiles = refactoringDetailsViewProvider.affectedFiles;

  if (!targetFile || !affectedFiles) {
    vscode.window.showErrorMessage('No refactoring data available.');
    return;
  }

  try {
    // Save the refactored target file
    fs.copyFileSync(targetFile.refactored, targetFile.original);

    // Save the refactored affected files
    for (const file of affectedFiles) {
      fs.copyFileSync(file.refactored, file.original);
    }

    const energySaved = refactoringDetailsViewProvider.energySaved;
    const targetSmell = refactoringDetailsViewProvider.targetSmell;
    const file = vscode.Uri.file(targetFile.original).fsPath;

    ecoOutput.appendLine('Energy: %d, smell: %s', energySaved, targetSmell);

    if (energySaved && targetSmell) {
      ecoOutput.appendLine('Updating metrics for', file);
      metricsDataProvider.updateMetrics(file, energySaved, targetSmell);
    }

    // Notify the user
    vscode.window.showInformationMessage('Refactoring accepted! Changes applied.');

    // Clear the smell cache for the target file and affected files
    await smellsCacheManager.clearCachedSmellsForFile(
      normalizePath(targetFile.original),
    );
    for (const file of affectedFiles) {
      await smellsCacheManager.clearCachedSmellsForFile(
        normalizePath(file.original),
      );
    }

    // Mark the target file and affected files as outdated
    smellsViewProvider.markFileAsOutdated(normalizePath(targetFile.original));
    for (const file of affectedFiles) {
      smellsViewProvider.markFileAsOutdated(normalizePath(file.original));
    }

    // Reset the refactoring details view
    refactoringDetailsViewProvider.resetRefactoringDetails();

    // Close all diff editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    // Set the context key to indicate refactoring is no longer in progress
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);

    // Refresh the UI to reflect the outdated status of the modified files
    smellsViewProvider.refresh();
  } catch (error) {
    console.error('Failed to accept refactoring:', error);
    vscode.window.showErrorMessage(
      'Failed to accept refactoring. Please try again.',
    );
  }
}

/**
 * Rejects the refactoring changes and keeps the original files.
 */
export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
): Promise<void> {
  // Notify the user
  vscode.window.showInformationMessage('Refactoring rejected! Changes discarded.');

  // Reset the refactoring details view
  refactoringDetailsViewProvider.resetRefactoringDetails();

  // Close all diff editors
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');

  // Set the context key to indicate refactoring is no longer in progress
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
}
