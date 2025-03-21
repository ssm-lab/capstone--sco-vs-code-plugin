// eslint-disable-next-line unused-imports/no-unused-imports
import { envConfig } from './utils/envConfig';

import * as vscode from 'vscode';

import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';
import { detectSmellsFile, detectSmellsFolder } from './commands/detectSmells';
import { openFile } from './commands/openFile';
import { registerFilterSmellCommands } from './commands/filterSmells';
import { jumpToSmell } from './commands/jumpToSmell';
import { wipeWorkCache } from './commands/wipeWorkCache';
import { SmellsDisplayProvider } from './providers/SmellsViewProvider';
import { checkServerStatus } from './api/backend';
import { FilterSmellsProvider } from './providers/FilterSmellsProvider';
import { SmellsCacheManager } from './context/SmellsCacheManager';
import { registerFileSaveListener } from './listeners/fileSaveListener';

/**
 * Activates the Eco-Optimizer extension and registers all necessary commands, providers, and listeners.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating Eco-Optimizer extension...');

  // Initialize the SmellsCacheManager for managing caching of smells and file hashes.
  const smellsCacheManager = new SmellsCacheManager(context);

  // Initialize the Code Smells View.
  const smellsDisplayProvider = new SmellsDisplayProvider(context);
  const codeSmellsView = vscode.window.createTreeView('ecooptimizer.view', {
    treeDataProvider: smellsDisplayProvider,
  });
  context.subscriptions.push(codeSmellsView);

  // Start periodic backend status checks (every 10 seconds).
  checkServerStatus();
  setInterval(checkServerStatus, 10000);

  // Track the workspace configuration state.
  const workspaceConfigured = Boolean(
    context.workspaceState.get<string>('workspaceConfiguredPath'),
  );
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    workspaceConfigured,
  );

  // Register workspace-related commands.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.configureWorkspace', () =>
      configureWorkspace(context, smellsDisplayProvider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.resetConfiguration', () =>
      resetConfiguration(context, smellsCacheManager, smellsDisplayProvider),
    ),
  );

  // Initialize the Filter Smells View.
  const filterSmellsProvider = new FilterSmellsProvider(context);
  const filterSmellsView = vscode.window.createTreeView('ecooptimizer.filterView', {
    treeDataProvider: filterSmellsProvider,
    showCollapseAll: true,
  });

  // Associate the TreeView instance with the provider.
  filterSmellsProvider.setTreeView(filterSmellsView);

  // Register filter-related commands.
  registerFilterSmellCommands(context, filterSmellsProvider);

  // Register code smell analysis commands.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.openFile', openFile),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer.detectSmellsFolder',
      (folderPath) =>
        detectSmellsFolder(smellsCacheManager, smellsDisplayProvider, folderPath),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.detectSmellsFile', (fileUri) =>
      detectSmellsFile(smellsCacheManager, smellsDisplayProvider, fileUri),
    ),
  );

  // Register the "Jump to Smell" command.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.jumpToSmell', jumpToSmell),
  );

  // Register the "Clear Smells Cache" command.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.wipeWorkCache', async () => {
      await wipeWorkCache(smellsCacheManager, smellsDisplayProvider);
    }),
  );

  // Register the file save listener to detect outdated files.
  const fileSaveListener = registerFileSaveListener(
    smellsCacheManager,
    smellsDisplayProvider,
  );
  context.subscriptions.push(fileSaveListener);
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  console.log('Deactivating Eco-Optimizer extension...');
}
