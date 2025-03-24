import * as vscode from 'vscode';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';
import { closeAllTrackedDiffEditors } from '../utils/trackedDiffEditors';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';

function normalizePath(filePath: string): string {
  return filePath.toLowerCase();
}

export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smellsViewProvider: SmellsViewProvider,
  context: vscode.ExtensionContext,
): Promise<void> {
  vscode.window.showInformationMessage('Refactoring rejected! Changes discarded.');

  // Clear state + UI
  if (refactoringDetailsViewProvider.targetFile?.original) {
    smellsViewProvider.setStatus(
      normalizePath(refactoringDetailsViewProvider.targetFile.original),
      'passed',
    );
  }
  await closeAllTrackedDiffEditors();
  refactoringDetailsViewProvider.resetRefactoringDetails();
  hideRefactorActionButtons();
}
