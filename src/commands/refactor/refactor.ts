import * as vscode from 'vscode';
import * as path from 'path';

import {
  backendRefactorSmell,
  backendRefactorSmellAll,
  backendRefactorSmellType,
} from '../../api/backend';
import { SmellsViewProvider } from '../../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../../providers/RefactoringDetailsViewProvider';
import { ecoOutput } from '../../extension';
import { serverStatus, ServerStatusType } from '../../emitters/serverStatus';
import {
  showRefactorActionButtons,
  hideRefactorActionButtons,
} from '../../utils/refactorActionButtons';
import { registerDiffEditor } from '../../utils/trackedDiffEditors';
import { envConfig } from '../../utils/envConfig';

/**
 * Orchestrates the complete refactoring workflow.
 * If isRefactorAllOfType is true, it sends a request to refactor all smells of the same type.
 *
 *  - Pre-flight validation checks
 * - Backend communication
 * - UI updates and diff visualization
 * - Success/error handling
 *
 * Shows carefully selected user notifications for key milestones and errors.
 */
export async function refactor(
  smellsViewProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  context: vscode.ExtensionContext,
  smell: Smell,
  refactorAction: string = 'single',
): Promise<void> {
  // Log and notify refactoring initiation
  let action: string;
  switch (refactorAction) {
    case 'single':
      action = 'Refactoring';
      break;
    case 'type':
      action = 'Refactoring all smells of type';
      break;
    case 'all':
      action = 'Refactoring all smells';
      break;
    default:
      action = 'Refactoring';
  }

  ecoOutput.info(`[refactor.ts] ${action} ${smell.symbol} in ${smell.path}`);
  vscode.window.showInformationMessage(`${action} ${smell.symbol}...`);

  // Validate workspace configuration
  const workspacePath = context.workspaceState.get<string>(
    envConfig.WORKSPACE_CONFIGURED_PATH!,
  );

  if (!workspacePath) {
    ecoOutput.error('[refactor.ts] Refactoring aborted: No workspace configured');
    vscode.window.showErrorMessage('Please configure workspace first');
    return;
  }

  // Verify backend availability
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    ecoOutput.warn('[refactor.ts] Refactoring blocked: Backend unavailable');
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
    ecoOutput.trace(`[refactor.ts] Sending ${action} request...`);
    let refactoredData: RefactoredData;
    if (refactorAction === 'single') {
      if (smell === undefined) {
        ecoOutput.error(
          '[refactor.ts] Refactoring aborted: No smell provided for single refactor action',
        );
        vscode.window.showErrorMessage(
          'Unable to refactor this file right now, please try again later',
        );
        return;
      }
      refactoredData = await backendRefactorSmell(smell, workspacePath);
    } else if (refactorAction === 'type')
      refactoredData = await backendRefactorSmellType(
        workspacePath,
        smell.symbol,
        smell.path,
      );
    else if (refactorAction === 'all')
      refactoredData = await backendRefactorSmellAll(workspacePath, smell.path);
    else {
      ecoOutput.error(
        '[refactor.ts] Refactoring aborted: Invalid refactoring action',
      );
      vscode.window.showErrorMessage(
        'Unable to refactor this file right now, please try again later',
      );
      return;
    }

    ecoOutput.info(
      `[refactor.ts] Refactoring completed for ${path.basename(smell.path)}. `,
    );

    await context.workspaceState.update(envConfig.UNFINISHED_REFACTORING!, {
      refactoredData,
      smell,
    });

    startRefactorSession(smell, refactoredData, refactoringDetailsViewProvider);
  } catch (error) {
    ecoOutput.error(
      `[refactor.ts] Refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    vscode.window.showErrorMessage('Refactoring failed. See output for details.');

    refactoringDetailsViewProvider.resetRefactoringDetails();
    hideRefactorActionButtons();
    smellsViewProvider.setStatus(smell.path, 'failed');
  } finally {
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}

export async function startRefactorSession(
  smell: Smell,
  refactoredData: RefactoredData,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
): Promise<void> {
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

  await vscode.commands.executeCommand('ecooptimizer.refactorView.focus');
  showRefactorActionButtons();

  vscode.window.showInformationMessage(
    `Refactoring complete. Estimated savings: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
  );
}
