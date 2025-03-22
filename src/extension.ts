// eslint-disable-next-line unused-imports/no-unused-imports
import { envConfig } from './utils/envConfig';

import * as vscode from 'vscode';

import { configureWorkspace } from './commands/configureWorkspace';
import * as fs from 'fs';
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
import { refactorSmell } from './commands/refactorSmell';
import { RefactoringDetailsViewProvider } from './providers/RefactoringDetailsViewProvider';

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

  // Initialize the RefactoringDetailsViewProvider
  const refactoringDetailsViewProvider = new RefactoringDetailsViewProvider();
  const refactoringDetailsView = vscode.window.createTreeView(
    'ecooptimizer.refactoringDetails',
    {
      treeDataProvider: refactoringDetailsViewProvider,
    },
  );

  // Reset the refactoring details view initially
  refactoringDetailsViewProvider.resetRefactoringDetails();

  // Register the refactorSmell command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.refactorSmell', (fileUri) => {
      // Extract the smell ID from the fileUri string (e.g., "(aa7) R0913: Line 15")
      const smellIdMatch = fileUri.match(/\(ID:\s*([^)]+)\)/);
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

      // Print the smell object to the console
      console.log('Smell Object:', smell);

      // Call the refactorSmell function with only the smell object
      refactorSmell(smellsViewProvider, refactoringDetailsViewProvider, smell);
    }),
  );

  // Register the acceptRefactoring command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.acceptRefactoring', () => {
      const refactoredFilePath = refactoringDetailsViewProvider.refactoredFilePath;
      const originalFilePath = refactoringDetailsViewProvider.originalFilePath;

      if (refactoredFilePath && originalFilePath) {
        // Replace the original file with the refactored file
        fs.copyFileSync(refactoredFilePath, originalFilePath);
        vscode.window.showInformationMessage(
          'Refactoring accepted! Changes applied.',
        );

        // Reset the refactoring details view
        refactoringDetailsViewProvider.resetRefactoringDetails();
      } else {
        vscode.window.showErrorMessage('No refactoring data available.');
      }
    }),
  );

  // Register the rejectRefactoring command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.rejectRefactoring', () => {
      vscode.window.showInformationMessage(
        'Refactoring rejected! Changes discarded.',
      );

      // Reset the refactoring details view
      refactoringDetailsViewProvider.resetRefactoringDetails();
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
