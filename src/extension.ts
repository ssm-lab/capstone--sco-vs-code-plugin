import * as vscode from 'vscode';

import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';

import { SmellsViewProvider } from './providers/SmellsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';

import { SmellsCacheManager } from './context/SmellsCacheManager';
import { openFile } from './commands/openFile';

/**
 * Activates the Eco-Optimizer extension and registers all necessary commands, providers, and listeners.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  const smellsCacheManager = new SmellsCacheManager(context);
  const smellsViewProvider = new SmellsViewProvider(context);
  const codeSmellsView = vscode.window.createTreeView('ecooptimizer.smellsView', {
    treeDataProvider: smellsViewProvider,
  });
  context.subscriptions.push(codeSmellsView);

  const metricsViewProvider = new MetricsViewProvider(context);
  vscode.window.createTreeView('ecooptimizer.metricsView', {
    treeDataProvider: metricsViewProvider,
    showCollapseAll: true,
  });

  const workspaceConfigured = Boolean(
    context.workspaceState.get<string>('workspaceConfiguredPath'),
  );
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    workspaceConfigured,
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.configureWorkspace', () =>
      configureWorkspace(context, smellsViewProvider, metricsViewProvider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer.resetConfiguration',
      () =>
        resetConfiguration(
          context,
          smellsCacheManager,
          smellsViewProvider,
          metricsViewProvider,
        ),
      smellsViewProvider.refresh(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.openFile', openFile),
  );
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  console.log('Deactivating Eco-Optimizer extension...');
}
