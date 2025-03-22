import * as vscode from 'vscode';
import * as path from 'path';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { refactorSmell as backendRefactorSmell } from '../api/backend'; // Import the backend function

/**
 * Handles the refactoring of a specific smell in a file.
 *
 * @param treeDataProvider - The tree data provider for updating the UI.
 * @param refactoringDetailsViewProvider - The refactoring details view provider.
 * @param filePath - The path of the file to refactor.
 * @param smell - The smell to refactor.
 */
export async function refactorSmell(
  treeDataProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  filePath: string,
  smell: Smell,
) {
  if (!filePath || !smell) {
    vscode.window.showErrorMessage('Error: Invalid file path or smell.');
    return;
  }

  vscode.window.showInformationMessage(
    `Refactoring code smells in: ${path.basename(filePath)}`,
  );

  try {
    // Call the backend to refactor the smell
    const refactoredData = await backendRefactorSmell(filePath, smell);

    // Log the response from the backend
    console.log('Refactoring response:', refactoredData);

    // Update the refactoring details view with the refactored file name
    refactoringDetailsViewProvider.updateRefactoringDetails(
      refactoredData.targetFile.refactored,
    );

    // Notify the user
    vscode.window.showInformationMessage(
      `Refactoring successful! Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );

    // Optionally, open the refactored file
    const refactoredFilePath = refactoredData.targetFile.refactored;
    const document = await vscode.workspace.openTextDocument(refactoredFilePath);
    await vscode.window.showTextDocument(document);
  } catch (error: any) {
    console.error('Refactoring failed:', error.message);
    vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);

    // Reset the refactoring details view on failure
    refactoringDetailsViewProvider.resetRefactoringDetails();
  }
}
