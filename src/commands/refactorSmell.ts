import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { ecoOutput } from '../extension';
import { openDiffEditor } from '../utils/openDiffEditor';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';
import { showRefactorActionButtons } from '../utils/refactorActionButtons'; // ← add this at the top

/**
 * Recursively collects all `.py` files in the given directory.
 */
function getAllPythonFiles(dir: string): string[] {
  const result: string[] = [];

  const walk = (current: string) => {
    const entries = fs.readdirSync(current);
    for (const entry of entries) {
      const fullPath = path.join(current, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && fullPath.endsWith('.py')) {
        result.push(fullPath);
      }
    }
  };

  walk(dir);
  return result;
}

/**
 * Handles the refactoring of a specific smell.
 */
export async function refactorSmell(
  smellsViewProvider: SmellsViewProvider,
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  smell: Smell,
  context: vscode.ExtensionContext,
): Promise<void> {
  vscode.window.showInformationMessage(`Refactoring code smell: ${smell.symbol}`);

  const workspacePath = context.workspaceState.get<string>(
    'workspaceConfiguredPath',
  );
  if (!workspacePath) {
    vscode.window.showErrorMessage('No workspace configured.');
    return;
  }

  // Step 1: Mark every Python file in the workspace as "refactoring"
  const allPythonFiles = getAllPythonFiles(workspacePath);
  for (const filePath of allPythonFiles) {
    smellsViewProvider.setStatus(filePath, 'refactoring');
  }

  // Step 2: Check if the server is down (can overwrite to "server_down" if needed)
  if (serverStatus.getStatus() === ServerStatusType.DOWN) {
    vscode.window.showWarningMessage(
      'Action blocked: Server is down and no cached smells exist for this file version.',
    );
    smellsViewProvider.setStatus(smell.path, 'server_down');
    return;
  }

  smellsViewProvider.setStatus(smell.path, 'queue');

  try {
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

    const refactoredData = await backendRefactorSmell(smell, workspacePath);

    ecoOutput.appendLine(`Refactoring response: ${JSON.stringify(refactoredData)}`);

    refactoringDetailsViewProvider.updateRefactoringDetails(
      smell.symbol,
      refactoredData.targetFile,
      refactoredData.affectedFiles,
      refactoredData.energySaved,
    );

    await openDiffEditor(
      refactoredData.targetFile.original,
      refactoredData.targetFile.refactored,
    );

    await vscode.commands.executeCommand('ecooptimizer.refactorView.focus');

    showRefactorActionButtons(context);

    vscode.window.showInformationMessage(
      `Refactoring successful! Energy saved: ${refactoredData.energySaved ?? 'N/A'} kg CO2`,
    );
  } catch (error: any) {
    console.error('Refactoring failed:', error.message);
    vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);

    refactoringDetailsViewProvider.resetRefactoringDetails();
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}
