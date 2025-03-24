import * as vscode from 'vscode';

import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';
import { closeAllTrackedDiffEditors } from '../utils/trackedDiffEditors';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { ecoOutput } from '../extension';

/**
 * Normalizes file paths for consistent comparison and caching
 * @param filePath - The file path to normalize
 * @returns Lowercase version of the path for case-insensitive operations
 */
function normalizePath(filePath: string): string {
  return filePath.toLowerCase();
}

/**
 * Handles rejection of proposed refactoring changes by:
 * 1. Resetting UI components
 * 2. Cleaning up diff editors
 * 3. Restoring original file states
 * 4. Providing user feedback
 *
 * Only shows a single notification to avoid interrupting workflow.
 */
export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smellsViewProvider: SmellsViewProvider,
): Promise<void> {
  ecoOutput.appendLine('[refactorActions.ts] User rejected refactoring changes');
  vscode.window.showInformationMessage('Refactoring changes discarded');

  try {
    // Restore original file status if target exists
    if (refactoringDetailsViewProvider.targetFile?.original) {
      const originalPath = refactoringDetailsViewProvider.targetFile.original;
      smellsViewProvider.setStatus(normalizePath(originalPath), 'passed');
      ecoOutput.appendLine(`[refactorActions.ts] Reset status for ${originalPath}`);
    }

    // Clean up UI components
    await closeAllTrackedDiffEditors();
    refactoringDetailsViewProvider.resetRefactoringDetails();
    hideRefactorActionButtons();

    ecoOutput.appendLine('[refactorActions.ts] Refactoring rejection completed');
  } catch (error) {
    const errorMsg = `[refactorActions.ts] Error during rejection cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`;
    ecoOutput.appendLine(errorMsg);
  }
}
