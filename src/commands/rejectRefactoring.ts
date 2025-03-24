import * as vscode from 'vscode';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';

export async function rejectRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
): Promise<void> {
  vscode.window.showInformationMessage('Refactoring rejected! Changes discarded.');

  refactoringDetailsViewProvider.resetRefactoringDetails();
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
}
