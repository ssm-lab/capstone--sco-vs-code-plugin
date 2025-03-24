import * as vscode from 'vscode';
import * as fs from 'fs';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';
import { RefactoringDetailsViewProvider } from '../providers/RefactoringDetailsViewProvider';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { ecoOutput } from '../extension';
import { hideRefactorActionButtons } from '../utils/refactorActionButtons';

function normalizePath(filePath: string): string {
  return filePath.toLowerCase();
}

export async function acceptRefactoring(
  refactoringDetailsViewProvider: RefactoringDetailsViewProvider,
  metricsDataProvider: MetricsViewProvider,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
  context: vscode.ExtensionContext,
): Promise<void> {
  const targetFile = refactoringDetailsViewProvider.targetFile;
  const affectedFiles = refactoringDetailsViewProvider.affectedFiles;

  if (!targetFile || !affectedFiles) {
    vscode.window.showErrorMessage('No refactoring data available.');
    return;
  }

  try {
    fs.copyFileSync(targetFile.refactored, targetFile.original);
    for (const file of affectedFiles) {
      fs.copyFileSync(file.refactored, file.original);
    }

    const energySaved = refactoringDetailsViewProvider.energySaved;
    const targetSmell = refactoringDetailsViewProvider.targetSmell?.symbol;
    const file = vscode.Uri.file(targetFile.original).fsPath;

    if (energySaved && targetSmell) {
      ecoOutput.appendLine(`Updating metrics for ${file}`);
      metricsDataProvider.updateMetrics(file, energySaved, targetSmell);
    }

    vscode.window.showInformationMessage('Refactoring accepted! Changes applied.');

    await smellsCacheManager.clearCachedSmellsForFile(
      normalizePath(targetFile.original),
    );
    for (const file of affectedFiles) {
      await smellsCacheManager.clearCachedSmellsForFile(
        normalizePath(file.original),
      );
    }

    smellsViewProvider.setStatus(normalizePath(targetFile.original), 'outdated');
    for (const file of affectedFiles) {
      smellsViewProvider.setStatus(normalizePath(file.original), 'outdated');
    }

    refactoringDetailsViewProvider.resetRefactoringDetails();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    hideRefactorActionButtons(context);

    smellsViewProvider.refresh();
  } catch (error) {
    console.error('Failed to accept refactoring:', error);
    vscode.window.showErrorMessage(
      'Failed to accept refactoring. Please try again.',
    );
  }
}
