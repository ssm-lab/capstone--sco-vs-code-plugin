import * as vscode from 'vscode';
import { SmellsCacheManager } from '../context/SmellsCacheManager';
import { SmellsViewProvider } from '../providers/SmellsViewProvider';
import { MetricsViewProvider } from '../providers/MetricsViewProvider';

export async function resetConfiguration(
  context: vscode.ExtensionContext,
  smellsCacheManager: SmellsCacheManager,
  smellsViewProvider: SmellsViewProvider,
  metricsViewProvider: MetricsViewProvider,
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

    // Clear any cached smells, if needed
    // smellsCacheManager.clear();

    // 🔥 Trigger view refreshes
    smellsViewProvider.refresh();
    metricsViewProvider.refresh();

    vscode.window.showInformationMessage(
      'Workspace configuration has been reset. All cached smells have been cleared.',
    );
  }
}
