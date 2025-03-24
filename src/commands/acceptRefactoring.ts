import * as vscode from 'vscode';
import * as fs from 'fs';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { ecoOutput } from '../extension';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';

/**
 * Normalizes file paths for consistent comparison and caching
 * @param filePath - The file path to normalize
 * @returns Lowercase version of the path for case-insensitive comparison
 */
function normalizePath(filePath: string): string {
  return filePath.toLowerCase();
}

/**
 * Handles acceptance and application of refactoring changes to the codebase.
 * Performs the following operations:
 * 1. Applies refactored changes to target and affected files
 * 2. Updates energy savings metrics
 * 3. Clears cached smell data for modified files
 * 4. Updates UI components to reflect changes
 *
 * @param refactoringDetailsViewProvider - Provides access to refactoring details
 * @param metricsDataProvider - Handles metrics tracking and updates
 * @param smellsCacheManager - Manages smell detection cache invalidation
 * @param smellsViewProvider - Controls the smells view UI updates
 * @param context - VS Code extension context
 */
export async function acceptRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  metricsDataProvider: MetricsViewProvider,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
  context: vscode.ExtensionContext,
): Promise<void> {
  const targetFile = refactoringDetailsViewProvider.targetFile;
  const affectedFiles = refactoringDetailsViewProvider.affectedFiles;

  // Validate refactoring data exists
  if (!targetFile || !affectedFiles) {
    ecoOutput.appendLine(
      '[refactorActions.ts] Error: No refactoring data available',
    );
    vscode.window.showErrorMessage('No refactoring data available.');
    return;
  }

  try {
    ecoOutput.appendLine(
      `[refactorActions.ts] Applying refactoring to target file: ${targetFile.original}`,
    );

    // Apply refactored changes to filesystem
    fs.copyFileSync(targetFile.refactored, targetFile.original);
    affectedFiles.forEach((file) => {
      fs.copyFileSync(file.refactored, file.original);
      ecoOutput.appendLine(
        `[refactorActions.ts] Updated affected file: ${file.original}`,
      );
    });

    // Update metrics if energy savings data exists
    if (
      refactoringDetailsViewProvider.energySaved &&
      refactoringDetailsViewProvider.targetSmell
    ) {
      metricsDataProvider.updateMetrics(
        targetFile.original,
        refactoringDetailsViewProvider.energySaved,
        refactoringDetailsViewProvider.targetSmell.symbol,
      );
      ecoOutput.appendLine('[refactorActions.ts] Updated energy savings metrics');
    }

    // Invalidate cache for modified files
    await Promise.all([
      smellsCacheManager.clearCachedSmellsForFile(
        normalizePath(targetFile.original),
      ),
      ...affectedFiles.map((file) =>
        smellsCacheManager.clearCachedSmellsForFile(normalizePath(file.original)),
      ),
    ]);
    ecoOutput.appendLine(
      '[refactorActions.ts] Cleared smell caches for modified files',
    );

    // Update UI state
    smellsViewProvider.setStatus(normalizePath(targetFile.original), 'outdated');
    affectedFiles.forEach((file) => {
      smellsViewProvider.setStatus(normalizePath(file.original), 'outdated');
    });

    // Reset UI components
    refactoringDetailsViewProvider.resetRefactoringDetails();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    hideRefactorActionButtons();
    smellsViewProvider.refresh();

    vscode.window.showInformationMessage('Refactoring successfully applied');
    ecoOutput.appendLine(
      '[refactorActions.ts] Refactoring changes completed successfully',
    );
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : 'Unknown error';
    ecoOutput.appendLine(
      `[refactorActions.ts] Error applying refactoring: ${errorDetails}`,
    );
    vscode.window.showErrorMessage('Failed to apply refactoring. Please try again.');
  }
}
