import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

/**
 * Resets the workspace configuration by clearing the selected workspace path,
 * analysis data, and refreshing the views. Prompts the user for confirmation
 * before performing the reset.
 *
 * @param context - The extension context for managing workspace state.
 * @param smellsCacheManager - The manager for handling cached smells.
 * @param smellsViewProvider - The provider for the smells view.
 * @param metricsViewProvider - The provider for the metrics view.
 */
export async function resetConfiguration(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
) {
  // Prompt the user for confirmation before resetting the configuration
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure you want to reset the workspace configuration? This will remove the currently selected workspace and all analysis data will be lost.',
    { modal: true },
    'Reset',
  );

  if (confirm === 'Reset') {
    // Clear the configured workspace path from the workspace state
    await context.workspaceState.update('workspaceConfiguredPath', undefined);

    // Update the workspace context to indicate that no workspace is configured
    vscode.commands.executeCommand(
      'setContext',
      'workspaceState.workspaceConfigured',
      false,
    );

    // Clear all analysis data and reset statuses in the smells view
    smellsCacheManager.clearAllCachedSmells();
    smellsViewProvider.clearAllStatuses();

    // Refresh the views to reflect the reset state
    smellsViewProvider.refresh();
    metricsViewProvider.refresh();

    // Notify the user that the reset was successful
    vscode.window.showInformationMessage(
      'Workspace configuration has been reset. All analysis data has been cleared.',
    );
  }
}
