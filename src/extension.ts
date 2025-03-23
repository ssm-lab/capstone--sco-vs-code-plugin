import * as vscode from 'vscode';

export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer');

import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';

import { SmellsViewProvider } from './providers/SmellsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';

import { SmellsCacheManager } from './context/SmellsCacheManager';
import { openFile } from './commands/openFile';
import { detectSmellsFile } from './commands/detectSmells';
import { FilterViewProvider } from './providers/FilterViewProvider';
import { registerFilterSmellCommands } from './commands/filterSmells';
import { loadSmells } from './utils/smellsData';
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';

/**
 * Activates the Eco-Optimizer extension and registers all necessary commands, providers, and listeners.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  loadSmells();
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

  // Initialize the Filter Smells View.
  const filterSmellsProvider = new FilterViewProvider(context, metricsViewProvider);
  const filterSmellsView = vscode.window.createTreeView('ecooptimizer.filterView', {
    treeDataProvider: filterSmellsProvider,
    showCollapseAll: true,
  });

  // Associate the TreeView instance with the provider.
  filterSmellsProvider.setTreeView(filterSmellsView);

  // Register filter-related commands.
  registerFilterSmellCommands(context, filterSmellsProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.openFile', openFile),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.detectSmellsFile', (fileItem) => {
      try {
        const filePath = fileItem?.resourceUri?.fsPath;

        if (!filePath) {
          vscode.window.showWarningMessage(
            'No file selected or file path not found.',
          );
          return;
        }

        detectSmellsFile(filePath, smellsViewProvider, smellsCacheManager);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error detecting smells: ${error.message}`);
      }
    }),
  );

  const workspaceModifiedListener = new WorkspaceModifiedListener(
    context,
    smellsCacheManager,
    smellsViewProvider,
    metricsViewProvider,
  );

  context.subscriptions.push(workspaceModifiedListener);
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  ecoOutput.appendLine('Deactivating Eco-Optimizer extension...\n');
}
