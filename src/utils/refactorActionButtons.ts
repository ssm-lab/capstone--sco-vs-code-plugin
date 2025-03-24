import * as vscode from 'vscode';

export function showRefactorActionButtons(context: vscode.ExtensionContext) {
  const acceptButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  acceptButton.text = '$(check) Accept Refactoring';
  acceptButton.command = 'ecooptimizer.acceptRefactoring';
  acceptButton.color = 'lightgreen';
  acceptButton.tooltip = 'Apply the suggested refactoring';

  const rejectButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1,
  );
  rejectButton.text = '$(x) Reject Refactoring';
  rejectButton.command = 'ecooptimizer.rejectRefactoring';
  rejectButton.color = 'red';
  rejectButton.tooltip = 'Discard the suggested refactoring';

  context.subscriptions.push(acceptButton, rejectButton);

  // Show them only when refactoring is active
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);

  acceptButton.show();
  rejectButton.show();
}

/**
 * Hides the refactor action buttons from the status bar.
 */
export function hideRefactorActionButtons(context: vscode.ExtensionContext) {
  const acceptButton = context.workspaceState.get<vscode.StatusBarItem>(
    'ecooptimizer.refactorAcceptButton',
  );
  const rejectButton = context.workspaceState.get<vscode.StatusBarItem>(
    'ecooptimizer.refactorRejectButton',
  );

  acceptButton?.hide();
  rejectButton?.hide();

  vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
}
