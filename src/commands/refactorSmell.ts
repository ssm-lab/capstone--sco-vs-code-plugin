import * as vscode from 'vscode';
import * as path from 'path';

import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { ecoOutput } from '../extension';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';
import {
  showRefactorActionButtons,
  hideRefactorActionButtons,
} from '../utils/refactorActionButtons';
import { registerDiffEditor } from '../utils/trackedDiffEditors';

/**
 * Handles the complete refactoring workflow for a detected code smell
 * @param smellsViewProvider - Reference to the smells view provider
 * @param refactoringDetailsViewProvider - Reference to the refactoring details provider
 * @param smell - The smell object to refactor
 * @param context - VS Code extension context
 */
export async function refactorSmell(
  smellsViewProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smell: Smell,
  context: vscode.ExtensionContext,
): Promise<void> {
  // Notify user about refactoring start
  ecoOutput.appendLine(`Starting refactoring for smell: ${smell.symbol}`);
  vscode.window.showInformationMessage(`Refactoring ${smell.symbol} smell...`);

  // Verify workspace configuration
  const workspacePath = context.workspaceState.get<string>(
    'workspaceConfiguredPath',
  );
  if (!workspacePath) {
    const errorMsg = 'No workspace configured. Please set up workspace first.';
    ecoOutput.appendLine(errorMsg);
    vscode.window.showErrorMessage(errorMsg);
    return;
  }

  // Check backend server status
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    const warningMsg =
      'Server unavailable - cannot refactor without backend connection';
    ecoOutput.appendLine(warningMsg);
    vscode.window.showWarningMessage(warningMsg);
    smellsViewProvider.setStatus(smell.path, 'server_down');
    return;
  }

  // Begin refactoring process
  smellsViewProvider.setStatus(smell.path, 'queued');
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

  try {
    // Step 1: Send refactoring request to backend
    const refactoredData = await backendRefactorSmell(smell, workspacePath);
    ecoOutput.appendLine(`Refactoring completed for ${smell.path}`);
    ecoOutput.appendLine(
      `Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );

    // Step 2: Update UI with refactoring results
    refactoringDetailsViewProvider.updateRefactoringDetails(
      smell,
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved,
    );

    // Step 3: Show diff editor comparison
    const targetFile = refactoredData.targetFile;
    const fileName = path.basename(targetFile.original);
    const originalUri = vscode.Uri.file(targetFile.original);
    const refactoredUri = vscode.Uri.file(targetFile.refactored);
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      refactoredUri,
      `Refactoring Comparison (${fileName})`,
      {
        preview: false, // Ensure the diff editor is not in preview mode
      },
    );
    registerDiffEditor(originalUri, refactoredUri);

    // Step 4: Focus refactoring view and show action buttons
    await vscode.commands.executeCommand('ecooptimizer.refactorView.focus');
    showRefactorActionButtons();

    // Step 5: Notify user of success
    const successMsg = `Refactoring successful! Estimated savings: ${refactoredData.energySaved ?? 'N/A'} kg CO2`;
    ecoOutput.appendLine(successMsg);
    vscode.window.showInformationMessage(successMsg);
  } catch (error) {
    // Handle refactoring failures
    const errorMsg = `Refactoring failed: ${error instanceof Error ? error.message : String(error)}`;
    ecoOutput.appendLine(errorMsg);
    console.error('Refactoring error:', error);
    vscode.window.showErrorMessage(errorMsg);

    // Reset UI state
    refactoringDetailsViewProvider.resetRefactoringDetails();
    hideRefactorActionButtons();

    // Update file status
    smellsViewProvider.setStatus(smell.path, 'failed');
  }
}
