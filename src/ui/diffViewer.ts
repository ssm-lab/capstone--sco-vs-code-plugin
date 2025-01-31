import * as vscode from 'vscode';
import * as fs from 'fs';

let statusBarItem: vscode.StatusBarItem | undefined; // Store globally
/**
 * Displays a native VS Code diff view to compare the original and refactored code.
 * Users can accept or reject the changes.
 */
export async function showDiffViewer(editor: vscode.TextEditor, refactoredCode: string, originalCode: string) {
  // Create temporary files for the original and refactored code
  const originalUri = vscode.Uri.file(`${editor.document.fileName}.eco-original`);
  const refactoredUri = vscode.Uri.file(`${editor.document.fileName}.eco-refactored`);

  // Write the original and refactored code to the temporary files
  await vscode.workspace.fs.writeFile(originalUri, Buffer.from(originalCode));
  await vscode.workspace.fs.writeFile(refactoredUri, Buffer.from(refactoredCode));

  // Store a reference to the original editor
  const originalEditor = editor;

  // Show the diff view
  await vscode.commands.executeCommand('vscode.diff', originalUri, refactoredUri, 'Eco: Code Refactor Preview');

  // Remove previous status bar item if it exists
  if (statusBarItem) {
    statusBarItem.dispose();
  }

  // Create a new status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '✅ Accept | ❌ Reject';
  statusBarItem.tooltip = 'Accept or reject the refactoring changes';
  statusBarItem.command = 'eco.refactor.decision';
  statusBarItem.show();

  // Register a command to handle the user's decision
  const disposable = vscode.commands.registerCommand('eco.refactor.decision', async () => {
    const choice = await vscode.window.showQuickPick(['Accept', 'Reject'], {
        placeHolder: 'Do you want to accept the refactoring changes?',
    });

    if (choice === 'Accept') {
        // Get the actual original file path (without the .eco-original suffix)
        const originalFileUri = vscode.Uri.file(editor.document.fileName);

        // Close the diff preview
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Open the actual original file
        const document = await vscode.workspace.openTextDocument(originalFileUri);
        const originalEditor = await vscode.window.showTextDocument(document, { preview: false });

        // Apply the refactored code to the actual file
        await applyRefactoredCode(originalEditor, refactoredCode);
    } else {
        vscode.window.showInformationMessage('Refactoring changes rejected.');
        // Close the diff preview
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }


    // Clean up temporary files and hide the status bar item
    await vscode.workspace.fs.delete(originalUri);
    await vscode.workspace.fs.delete(refactoredUri);
    statusBarItem?.hide();
    disposable.dispose();
});


}

/**
 * Replaces the selected code in the editor with the refactored version.
 */
async function applyRefactoredCode(editor: vscode.TextEditor, newCode: string) {
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(editor.document.lineCount, 0)
  );

  await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, newCode);
  });

  vscode.window.showInformationMessage('Refactoring changes applied successfully.');
}