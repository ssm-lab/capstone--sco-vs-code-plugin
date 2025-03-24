import * as vscode from 'vscode';

/**
 * Resets the workspace configuration by clearing the selected workspace path.
 * Prompts the user for confirmation before performing the reset.
 *
 * @param context - The extension context for managing workspace state.
 */
export async function resetConfiguration(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure you want to reset the workspace configuration? This will remove the currently selected workspace and all analysis data will be lost.',
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

    return true; // signal that reset happened
  }

  return false;
}
