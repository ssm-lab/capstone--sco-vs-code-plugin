import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';

/**
 * Clears the smells cache and refreshes the UI.
 * @param smellsCacheManager - Manages the caching of smells and file hashes.
 * @param smellsViewProvider - The UI provider for updating the tree view.
 */
export async function wipeWorkCache(
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
) {
  const userResponse = await vscode.window.showWarningMessage(
    'Are you sure you want to clear the smells cache? This action cannot be undone.',
    { modal: true },
    'Confirm',
  );

  if (userResponse === 'Confirm') {
    smellsCacheManager.clearAllCachedSmells();
    smellsViewProvider.clearAllStatuses();
    smellsViewProvider.refresh();

    vscode.window.showInformationMessage('Smells cache cleared successfully.');
  } else {
    vscode.window.showInformationMessage('Operation cancelled.');
  }
}
