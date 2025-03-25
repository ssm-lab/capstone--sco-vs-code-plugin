import * as vscode from 'vscode';
import * as fs from 'fs';
import { SmellsViewProvider } from '../../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../../providers/MetricsViewProvider';
import { RefactoringDetailsViewProvider } from '../../providers/RefactoringDetailsViewProvider';
import { SmellsCacheManager } from '../../context/SmellsCacheManager';
import { ecoOutput } from '../../extension';
import { hideRefactorActionButtons } from '../../utils/refactorActionButtons';
import { detectSmellsFile } from '../detection/detectSmells';
import { closeAllTrackedDiffEditors } from '../../utils/trackedDiffEditors';
import { envConfig } from '../../utils/envConfig';

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
  context: vscode.ExtensionContext,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  metricsDataProvider: MetricsViewProvider,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  const targetFile = refactoringDetailsViewProvider.targetFile;
  const affectedFiles = refactoringDetailsViewProvider.affectedFiles;

  // Validate refactoring data exists
  if (!targetFile || !affectedFiles) {
    ecoOutput.error('[refactorActions.ts] Error: No refactoring data available');
    vscode.window.showErrorMessage('No refactoring data available.');
    return;
  }

  try {
    ecoOutput.info(
      `[refactorActions.ts] Applying refactoring to target file: ${targetFile.original}`,
    );

    // Apply refactored changes to filesystem
    fs.copyFileSync(targetFile.refactored, targetFile.original);
    affectedFiles.forEach((file) => {
      fs.copyFileSync(file.refactored, file.original);
      ecoOutput.info(`[refactorActions.ts] Updated affected file: ${file.original}`);
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
      ecoOutput.info('[refactorActions.ts] Updated energy savings metrics');
    }

    // Invalidate cache for modified files
    await Promise.all([
      smellsCacheManager.clearCachedSmellsForFile(targetFile.original),
      ...affectedFiles.map((file) =>
        smellsCacheManager.clearCachedSmellsForFile(file.original),
      ),
    ]);
    ecoOutput.trace('[refactorActions.ts] Cleared smell caches for modified files');

    // Update UI state
    smellsViewProvider.setStatus(targetFile.original, 'outdated');
    affectedFiles.forEach((file) => {
      smellsViewProvider.setStatus(file.original, 'outdated');
    });

    await detectSmellsFile(
      targetFile.original,
      smellsViewProvider,
      smellsCacheManager,
    );

    // Reset UI components
    refactoringDetailsViewProvider.resetRefactoringDetails();
    closeAllTrackedDiffEditors();
    hideRefactorActionButtons();
    smellsViewProvider.refresh();

    context.workspaceState.update(envConfig.UNFINISHED_REFACTORING!, undefined);

    vscode.window.showInformationMessage('Refactoring successfully applied');
    ecoOutput.info(
      '[refactorActions.ts] Refactoring changes completed successfully',
    );
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : 'Unknown error';
    ecoOutput.error(
      `[refactorActions.ts] Error applying refactoring: ${errorDetails}`,
    );
    vscode.window.showErrorMessage('Failed to apply refactoring. Please try again.');
  }
}
