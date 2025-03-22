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
import { SmellsViewProvider } from './providers/SmellsViewProvider';
import { checkServerStatus } from './api/backend';
import { FilterViewProvider } from './providers/FilterViewProvider';
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
  const smellsViewProvider = new SmellsViewProvider(context);
  const codeSmellsView = vscode.window.createTreeView('ecooptimizer.view', {
    treeDataProvider: smellsViewProvider,
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
      configureWorkspace(context, smellsViewProvider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.resetConfiguration', () =>
      resetConfiguration(context, smellsCacheManager, smellsViewProvider),
    ),
  );

  // Initialize the Filter Smells View.
  const filterSmellsProvider = new FilterViewProvider(
    context,
    smellsCacheManager,
    smellsViewProvider,
  );
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
        detectSmellsFolder(smellsCacheManager, smellsViewProvider, folderPath),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.detectSmellsFile', (fileUri) =>
      detectSmellsFile(smellsCacheManager, smellsViewProvider, fileUri),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.refactorSmell', (fileUri) => {
      // Ensure the fileUri is valid
      if (!fileUri) {
        console.error('No file URI provided.');
        return;
      }

      // Extract the smell ID from the fileUri string (e.g., "(aa7) R0913: Line 15")
      const smellIdMatch = fileUri.match(/\(([^)]+)\)/);
      const smellId = smellIdMatch ? smellIdMatch[1] : null;

      if (!smellId) {
        console.error('No smell ID found in the file URI:', fileUri);
        return;
      }

      // Retrieve the smell object by ID using the cache manager
      const smell = smellsCacheManager.getSmellById(smellId);
      if (!smell) {
        console.error('No smell found with ID:', smellId);
        return;
      }

      // Get the file path from the smell object
      const filePath = smell.path;

      // Print the file path and smell object to the console
      console.log('File Path:', filePath);
      console.log('Smell Object:', smell);

      // Add additional logic here to handle refactoring
    }),
  );

  // Register the "Jump to Smell" command.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.jumpToSmell', jumpToSmell),
  );

  // Register the "Clear Smells Cache" command.
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.wipeWorkCache', async () => {
      await wipeWorkCache(smellsCacheManager, smellsViewProvider);
    }),
  );

  // Register the file save listener to detect outdated files.
  const fileSaveListener = registerFileSaveListener(
    smellsCacheManager,
    smellsViewProvider,
  );
  context.subscriptions.push(fileSaveListener);
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  console.log('Deactivating Eco-Optimizer extension...');
}
