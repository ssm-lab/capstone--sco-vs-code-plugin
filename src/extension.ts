import { envConfig } from './utils/envConfig';

import * as vscode from 'vscode';
import path from 'path';

import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';
import { detectSmellsFile, detectSmellsFolder } from './commands/detectSmells';
import { openFile } from './commands/openFile';
import { exportMetricsData } from './commands/exportMetricsData';
import { registerFilterSmellCommands } from './commands/filterSmells';
import { jumpToSmell } from './commands/jumpToSmell';
import { wipeWorkCache } from './commands/wipeWorkCache';
import {
  refactorSmell,
  acceptRefactoring,
  rejectRefactoring,
} from './commands/refactorSmell';

import { SmellsViewProvider } from './providers/SmellsViewProvider';
import { FilterViewProvider } from './providers/FilterViewProvider';
import { RefactoringDetailsViewProvider } from './providers/RefactoringDetailsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';

import { FileHighlighter } from './ui/FileHighlighter';

import { SmellsCacheManager } from './context/SmellsCacheManager';

import { registerFileSaveListener } from './listeners/fileSaveListener';
import { registerWorkspaceModifiedListener } from './listeners/workspaceModifiedListener';

import { checkServerStatus } from './api/backend';
import { loadSmells } from './utils/smellsData';
import { LineSelectionManager } from './ui/LineSelection';

/**
 * Activates the Eco-Optimizer extension and registers all necessary commands, providers, and listeners.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating Eco-Optimizer extension...');

  loadSmells();

  // Initialize the SmellsCacheManager for managing caching of smells and file hashes.
  const smellsCacheManager = new SmellsCacheManager(context);

  // Initialize the Code Smells View.
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

  // Start periodic backend status checks (every 10 seconds).
  checkServerStatus();
  setInterval(checkServerStatus, 10000);

  ////////////////////////////////////////////////
  // WORKSPACE CONFIGURATION COMMANDS
  ////////////////////////////////////////////////
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
      configureWorkspace(context, smellsViewProvider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.resetConfiguration', () =>
      resetConfiguration(context, smellsCacheManager, smellsViewProvider),
    ),
  );

  ////////////////////////////////////////////////

  // Initialize the Filter Smells View.
  const filterSmellsProvider = new FilterViewProvider(
    context,
    smellsCacheManager,
    smellsViewProvider,
    metricsViewProvider,
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
      (folderPath) => {
        try {
          detectSmellsFolder(smellsCacheManager, smellsViewProvider, folderPath);
        } catch (error: any) {
          vscode.window.showErrorMessage(`Error detecting smells: ${error.message}`);
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.detectSmellsFile', (fileUri) => {
      try {
        detectSmellsFile(smellsCacheManager, smellsViewProvider, fileUri);
      } catch (error: any) {
        vscode.window.showErrorMessage(`Error detecting smells: ${error.message}`);
      }
    }),
  );

  // Initialize the RefactoringDetailsViewProvider
  const refactoringDetailsViewProvider = new RefactoringDetailsViewProvider();
  // eslint-disable-next-line unused-imports/no-unused-vars
  const refactoringDetailsView = vscode.window.createTreeView(
    'ecooptimizer.refactoringDetails',
    {
      treeDataProvider: refactoringDetailsViewProvider,
    },
  );

  // Register the export command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.exportMetricsData', () =>
      exportMetricsData(context),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.metricsView.refresh', () => {
      metricsViewProvider.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.clearMetricsData', () => {
      vscode.window
        .showWarningMessage(
          'Are you sure you want to clear the metrics data? This action is irreversible, and the data will be permanently lost unless exported.',
          { modal: true },
          'Yes',
          'No',
        )
        .then((selection) => {
          if (selection === 'Yes') {
            context.workspaceState.update(
              envConfig.WORKSPACE_METRICS_DATA!,
              undefined,
            );
            vscode.window.showInformationMessage('Metrics data has been cleared.');
          }
        });
      metricsViewProvider.refresh();
    }),
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
    vscode.commands.registerCommand('ecooptimizer.acceptRefactoring', () =>
      acceptRefactoring(
        refactoringDetailsViewProvider,
        metricsViewProvider,
        smellsCacheManager,
        smellsViewProvider,
      ),
    ),
  );

  // Register the rejectRefactoring command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.rejectRefactoring', () =>
      rejectRefactoring(refactoringDetailsViewProvider),
    ),
  );

  // Register the command to open the diff editor
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer.openDiffEditor',
      (originalFilePath: string, refactoredFilePath: string) => {
        // Get the file name for the diff editor title
        const fileName = path.basename(originalFilePath);

        // Show the diff editor with the updated title
        const originalUri = vscode.Uri.file(originalFilePath);
        const refactoredUri = vscode.Uri.file(refactoredFilePath);
        vscode.commands.executeCommand(
          'vscode.diff',
          originalUri,
          refactoredUri,
          `Refactoring Comparison (${fileName})`,
          {
            preview: false,
          },
        );
      },
    ),
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

  // Initialize the FileHighlighter for highlighting code smells.
  const fileHighlighter = FileHighlighter.getInstance(smellsCacheManager);

  fileHighlighter.updateHighlightsForVisibleEditors();

  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      editors.forEach((editor) => {
        fileHighlighter.highlightSmells(editor);
      });
    }),
  );

  const lineSelectManager = new LineSelectionManager(smellsCacheManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      console.log('Eco: Detected line selection event');
      lineSelectManager.commentLine(event.textEditor);
    }),
  );

  // Register the file save listener to detect outdated files.
  const fileSaveListener = registerFileSaveListener(
    smellsCacheManager,
    smellsViewProvider,
  );
  context.subscriptions.push(fileSaveListener);

  // Register the workspace modified listener
  const workspaceModifiedListener =
    registerWorkspaceModifiedListener(metricsViewProvider);
  context.subscriptions.push(workspaceModifiedListener);
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  console.log('Deactivating Eco-Optimizer extension...');
}
