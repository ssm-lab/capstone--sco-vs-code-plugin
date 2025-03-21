import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager'; // Updated import
import { SmellsDisplayProvider } from '../providers/SmellsViewProvider';

/**
 * Resets the workspace configuration by clearing the stored path and wiping cached smells.
 * Prompts the user for confirmation before performing the reset.
 *
 * @param context - The VS Code extension context.
 * @param smellsCacheManager - The cache manager handling cached smells.
 * @param treeDataProvider - The tree data provider to refresh the UI.
 */
export async function resetConfiguration(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  treeDataProvider: SmellsDisplayProvider,
) {
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure you want to reset the workspace configuration? This will remove the currently selected folder and wipe cached smells.',
    { modal: true },
    'Reset',
  );

  if (confirm === 'Reset') {
    await context.workspaceState.update('workspaceConfiguredPath', undefined);
    vscode.commands.executeCommand(
      'setContext',
      'workspaceState.workspaceConfigured',
      false,
    );

    // Clear smells & refresh UI using SmellsCacheManager
    await smellsCacheManager.clearCacheAndRefreshUI(treeDataProvider);

    vscode.window.showInformationMessage(
      'Workspace configuration has been reset. All cached smells have been cleared.',
    );
  }
}
