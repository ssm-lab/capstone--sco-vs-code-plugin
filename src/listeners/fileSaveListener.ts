import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import path from 'path';

/**
 * Listens for file save events to detect outdated files.
 * @param smellsCacheManager - Manages the caching of smells and file hashes.
 * @param smellsDisplayProvider - The UI provider for updating the tree view.
 */
export function registerFileSaveListener(
  smellsCacheManager: SmellsCacheManager,
  smellsDisplayProvider: SmellsViewProvider,
): vscode.Disposable {
  return vscode.workspace.onDidSaveTextDocument(async (document) => {
    const filePath = document.fileName;

    // Ignore files that have no cached smells
    const cachedSmells = smellsCacheManager.getCachedSmells(filePath);
    if (!cachedSmells) return;

    const updated = await smellsCacheManager.updateFileHash(
      filePath,
      document.getText(),
    );
    if (updated) {
      vscode.window.showWarningMessage(
        `The file "${path.basename(
          filePath,
        )}" has been modified since the last analysis.`,
      );

      await smellsCacheManager.clearCachedSmellsForFile(filePath);
      // Mark file as outdated in the UI
      smellsDisplayProvider.markFileAsOutdated(filePath);
    }
  });
}
