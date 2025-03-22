import * as vscode from 'vscode';
import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';

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

    // Update the refactoring details view with the refactored file name
    refactoringDetailsViewProvider.updateRefactoringDetails(
      refactoredData.targetFile.refactored,
      refactoredData.targetFile.original,
    );

    // Show a diff view between the original and refactored files
    const originalUri = vscode.Uri.file(refactoredData.targetFile.original);
    const refactoredUri = vscode.Uri.file(refactoredData.targetFile.refactored);
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      refactoredUri,
      'Original ↔ Refactored',
    );

    // Set a context key to track that refactoring is in progress
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

    // Listen for the diff editor being closed manually
    const closeListener = vscode.window.onDidChangeVisibleTextEditors((editors) => {
      const diffEditorStillOpen = editors.some(
        (editor) =>
          editor.document.uri.toString() === originalUri.toString() ||
          editor.document.uri.toString() === refactoredUri.toString(),
      );

      if (!diffEditorStillOpen) {
        // Show a confirmation popup if the diff editor is closed manually
        vscode.window
          .showWarningMessage(
            'You need to accept or reject the refactoring. Do you want to stop refactoring?',
            { modal: true },
            'Stop Refactoring',
          )
          .then((choice) => {
            if (choice === 'Stop Refactoring') {
              // Reset the refactoring state
              refactoringDetailsViewProvider.resetRefactoringDetails();
              vscode.commands.executeCommand(
                'setContext',
                'refactoringInProgress',
                false,
              );
            } else {
              // Reopen the diff editor
              vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                refactoredUri,
                'Original ↔ Refactored',
              );
            }
          });
      }
    });

    // Notify the user
    vscode.window.showInformationMessage(
      `Refactoring successful! Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );

    // Return the close listener so it can be disposed later
    return closeListener;
  } catch (error: any) {
    console.error('Refactoring failed:', error.message);
    vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);

    // Reset the refactoring details view on failure
    refactoringDetailsViewProvider.resetRefactoringDetails();
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}
