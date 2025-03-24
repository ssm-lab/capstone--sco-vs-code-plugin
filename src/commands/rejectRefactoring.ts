import * as vscode from 'vscode';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';
import { closeAllTrackedDiffEditors } from '../utils/trackedDiffEditors';

export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  context: vscode.ExtensionContext,
): Promise<void> {
  vscode.window.showInformationMessage('Refactoring rejected! Changes discarded.');

  // Clear state + UI
  refactoringDetailsViewProvider.resetRefactoringDetails();
  hideRefactorActionButtons(context);

  // Close any tracked diff editors
  await closeAllTrackedDiffEditors();
}
