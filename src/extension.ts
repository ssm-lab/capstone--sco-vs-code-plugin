import * as vscode from 'vscode';

// Output channel for logging
export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer');

// Core utilities
import { loadSmells } from './utils/smellsData';
import { initializeStatusesFromCache } from './utils/initializeStatusesFromCache';

// Context & View Providers
import { SmellsCacheManager } from './context/SmellsCacheManager';
import { SmellsViewProvider } from './providers/SmellsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';
import { FilterViewProvider } from './providers/FilterViewProvider';

// Commands
import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';
import { detectSmellsFile } from './commands/detectSmells';
import { registerFilterSmellCommands } from './commands/filterSmells';

// Listeners
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';
import { jumpToSmell } from './commands/jumpToSmell';
import { wipeWorkCache } from './commands/wipeWorkCache';

/**
 * Activates the Eco-Optimizer extension and registers all necessary components.
 */
export function activate(context: vscode.ExtensionContext): void {
  // Load smell definitions and initialize context
  loadSmells();

  const smellsCacheManager = new SmellsCacheManager(context);
  const smellsViewProvider = new SmellsViewProvider(context);
  const metricsViewProvider = new MetricsViewProvider(context);
  const filterSmellsProvider = new FilterViewProvider(
    context,
    metricsViewProvider,
    smellsCacheManager,
    smellsViewProvider,
  );

  // Restore cached statuses
  initializeStatusesFromCache(context, smellsCacheManager, smellsViewProvider);

  // === Tree Views ===
  context.subscriptions.push(
    vscode.window.createTreeView('ecooptimizer.smellsView', {
      treeDataProvider: smellsViewProvider,
    }),
    vscode.window.createTreeView('ecooptimizer.metricsView', {
      treeDataProvider: metricsViewProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('ecooptimizer.filterView', {
      treeDataProvider: filterSmellsProvider,
      showCollapseAll: true,
    }),
  );

  // Link checkbox UI to filter logic
  filterSmellsProvider.setTreeView(
    vscode.window.createTreeView('ecooptimizer.filterView', {
      treeDataProvider: filterSmellsProvider,
      showCollapseAll: true,
    }),
  );

  // === Workspace Context Flag ===
  const workspaceConfigured = Boolean(
    context.workspaceState.get<string>('workspaceConfiguredPath'),
  );
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    workspaceConfigured,
  );

  // === Command Registration ===
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.configureWorkspace', async () => {
      await configureWorkspace(context);
      smellsViewProvider.refresh();
      metricsViewProvider.refresh();
    }),

    vscode.commands.registerCommand('ecooptimizer.resetConfiguration', async () => {
      const didReset = await resetConfiguration(context);

      if (didReset) {
        smellsCacheManager.clearAllCachedSmells();
        smellsViewProvider.clearAllStatuses();
        smellsViewProvider.refresh();
        metricsViewProvider.refresh();

        vscode.window.showInformationMessage(
          'Workspace configuration has been reset. All analysis data has been cleared.',
        );
      }
    }),

    vscode.commands.registerCommand('ecooptimizer.jumpToSmell', jumpToSmell),

    vscode.commands.registerCommand('ecooptimizer.wipeWorkCache', async () => {
      await wipeWorkCache(smellsCacheManager, smellsViewProvider);
    }),

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

  // Register filter UI toggle/edit/select-all/deselect-all
  registerFilterSmellCommands(context, filterSmellsProvider);

  // === Workspace File Listener ===
  context.subscriptions.push(
    new WorkspaceModifiedListener(
      context,
      smellsCacheManager,
      smellsViewProvider,
      metricsViewProvider,
    ),
  );
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  ecoOutput.appendLine('Deactivating Eco-Optimizer extension...\n');
}
