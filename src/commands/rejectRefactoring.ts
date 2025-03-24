import * as vscode from 'vscode';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { closeAllRefactorDiffEditors } from '../utils/openDiffEditor';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';
export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  context: vscode.ExtensionContext,
): Promise<void> {
  vscode.window.showInformationMessage('Refactoring rejected! Changes discarded.');

  // Clear state + UI
  refactoringDetailsViewProvider.resetRefactoringDetails();
  await closeAllRefactorDiffEditors();
  hideRefactorActionButtons(context);
}
