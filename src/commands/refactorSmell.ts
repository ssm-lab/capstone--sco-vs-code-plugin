import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { backendRefactorSmell } from '../api/backend';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { ecoOutput } from '../extension';
import { serverStatus, ServerStatusType } from '../emitters/serverStatus';
import { showRefactorActionButtons } from '../utils/refactorActionButtons';
import { registerDiffEditor } from '../utils/trackedDiffEditors';

/**
 * Recursively collects all Python files (.py) in a directory and its subdirectories
 * @param dir - The root directory path to search from
 * @returns Array of absolute file paths to all Python files found
 */
function getAllPythonFiles(dir: string): string[] {
  const pythonFiles: string[] = [];

  /**
   * Recursive directory walker function
   * @param currentDir - Current directory being processed
   */
  const walkDirectory = (currentDir: string) => {
    try {
      const entries = fs.readdirSync(currentDir);

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDirectory(fullPath);
        } else if (stat.isFile() && fullPath.endsWith('.py')) {
          pythonFiles.push(fullPath);
        }
      }
    } catch (error) {
      ecoOutput.appendLine(`Error scanning directory ${currentDir}: ${error}`);
      console.error(`Directory scan error: ${error}`);
    }
  };

  walkDirectory(dir);
  return pythonFiles;
}

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

  // Mark all Python files as being refactored
  try {
    const allPythonFiles = getAllPythonFiles(workspacePath);
    allPythonFiles.forEach((filePath) => {
      smellsViewProvider.setStatus(filePath, 'refactoring');
    });
  } catch (error) {
    ecoOutput.appendLine(`Error marking files for refactoring: ${error}`);
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
    showRefactorActionButtons(context);

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
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);

    // Update file status
    smellsViewProvider.setStatus(smell.path, 'failed');
  } finally {
    // Ensure context is reset even if errors occur
    vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
  }
}
