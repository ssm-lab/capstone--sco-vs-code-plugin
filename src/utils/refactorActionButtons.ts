import * as vscode from 'vscode';
import { ecoOutput } from '../extension';

let acceptButton: vscode.StatusBarItem | undefined;
let rejectButton: vscode.StatusBarItem | undefined;

/**
 * Create and register the status bar buttons (called once at activation).
 */
export function initializeRefactorActionButtons(
  context: vscode.ExtensionContext,
): void {
  ecoOutput.appendLine('Initializing refactor action buttons...');

  acceptButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    0,
  );
  rejectButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1,
  );

  acceptButton.text = '$(check) ACCEPT REFACTOR';
  acceptButton.command = 'ecooptimizer.acceptRefactoring';
  acceptButton.tooltip = 'Accept and apply the suggested refactoring';
  acceptButton.color = new vscode.ThemeColor('charts.green');

  rejectButton.text = '$(x) REJECT REFACTOR';
  rejectButton.command = 'ecooptimizer.rejectRefactoring';
  rejectButton.tooltip = 'Reject the suggested refactoring';
  rejectButton.color = new vscode.ThemeColor('charts.red');

  context.subscriptions.push(acceptButton, rejectButton);

  ecoOutput.appendLine('Status bar buttons created and registered.');
}

/**
 * Show the status bar buttons when a refactoring is in progress.
 */
export function showRefactorActionButtons(): void {
  if (!acceptButton || !rejectButton) {
    ecoOutput.appendLine(
      '❌ Tried to show refactor buttons but they are not initialized.',
    );
    return;
  }

  ecoOutput.appendLine('Showing refactor action buttons...');
  acceptButton.show();
  rejectButton.show();
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', true);
}

/**
 * Hide the status bar buttons when the refactoring ends.
 */
export function hideRefactorActionButtons(): void {
  if (!acceptButton || !rejectButton) {
    ecoOutput.appendLine(
      '❌ Tried to hide refactor buttons but they are not initialized.',
    );
    return;
  }

  ecoOutput.appendLine('Hiding refactor action buttons...');
  acceptButton.hide();
  rejectButton.hide();
  vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);
}
