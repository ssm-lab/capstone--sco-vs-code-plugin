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
 * Orchestrates the complete refactoring workflow including:
 * - Pre-flight validation checks
 * - Backend communication
 * - UI updates and diff visualization
 * - Success/error handling
 *
 * Shows carefully selected user notifications for key milestones and errors.
 */
export async function refactorSmell(
  smellsViewProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smell: Smell,
  context: vscode.ExtensionContext,
): Promise<void> {
  // Log and notify refactoring initiation
  ecoOutput.appendLine(
    `[refactor.ts] Initiating refactoring for ${smell.symbol} in ${smell.path}`,
  );
  vscode.window.showInformationMessage(
    `Starting refactoring for ${smell.symbol}...`,
  );

  // Validate workspace configuration
  const workspacePath = context.workspaceState.get<string>(
    'workspaceConfiguredPath',
  );
  if (!workspacePath) {
    const errorMsg = '[refactor.ts] Refactoring aborted: No workspace configured';
    ecoOutput.appendLine(errorMsg);
    vscode.window.showErrorMessage('Please configure workspace first');
    return;
  }

  // Verify backend availability
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    const warningMsg = '[refactor.ts] Refactoring blocked: Backend unavailable';
    ecoOutput.appendLine(warningMsg);
    vscode.window.showWarningMessage(
      'Cannot refactor - backend service unavailable',
    );
    smellsViewProvider.setStatus(smell.path, 'server_down');
    return;
  }

  // Update UI state
  smellsViewProvider.setStatus(smell.path, 'queued');
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

  try {
    // Execute backend refactoring
    ecoOutput.appendLine(
      `[refactor.ts] Sending refactoring request for ${smell.symbol}`,
    );
    const refactoredData = await backendRefactorSmell(smell, workspacePath);

    ecoOutput.appendLine(
      `[refactor.ts] Refactoring completed for ${path.basename(smell.path)}. ` +
        `Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );

    // Update refactoring details view
    refactoringDetailsViewProvider.updateRefactoringDetails(
      smell,
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved,
    );

    // Show diff comparison
    const targetFile = refactoredData.targetFile;
    const fileName = path.basename(targetFile.original);
    await vscode.commands.executeCommand(
      'vscode.diff',
      vscode.Uri.file(targetFile.original),
      vscode.Uri.file(targetFile.refactored),
      `Refactoring Comparison (${fileName})`,
      { preview: false },
    );
    registerDiffEditor(
      vscode.Uri.file(targetFile.original),
      vscode.Uri.file(targetFile.refactored),
    );

    // Finalize UI updates
    await vscode.commands.executeCommand('ecooptimizer.refactorView.focus');
    showRefactorActionButtons();

    // Show completion notification
    const successMsg = `Refactoring complete. Estimated savings: ${refactoredData.energySaved ?? 'N/A'} kg CO2`;
    ecoOutput.appendLine(`[refactor.ts] ${successMsg}`);
    vscode.window.showInformationMessage(successMsg);
  } catch (error) {
    // Handle errors and cleanup
    const errorMsg = `[refactor.ts] Refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    ecoOutput.appendLine(errorMsg);

    vscode.window.showErrorMessage('Refactoring failed. See output for details.', {
      modal: false,
    });

    // Reset UI state
    refactoringDetailsViewProvider.resetRefactoringDetails();
    hideRefactorActionButtons();
    smellsViewProvider.setStatus(smell.path, 'failed');
  } finally {
    // Ensure context is always reset
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}
