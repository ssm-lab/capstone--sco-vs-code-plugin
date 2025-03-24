import * as vscode from 'vscode';

// Output channel for logging
export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer');

// === Core Utilities ===
import { loadSmells } from './utils/smellsData';
import { initializeStatusesFromCache } from './utils/initializeStatusesFromCache';
import { openDiffEditor } from './utils/openDiffEditor';

// === Context & View Providers ===
import { SmellsCacheManager } from './context/SmellsCacheManager';
import { SmellsViewProvider, SmellTreeItem } from './providers/SmellsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';
import { FilterViewProvider } from './providers/FilterViewProvider';
import { RefactoringDetailsViewProvider } from './providers/RefactoringDetailsViewProvider';

// === Commands ===
import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';
import { detectSmellsFile, detectSmellsFolder } from './commands/detectSmells';
import { registerFilterSmellCommands } from './commands/filterSmells';
import { jumpToSmell } from './commands/jumpToSmell';
import { wipeWorkCache } from './commands/wipeWorkCache';
import { refactorSmell } from './commands/refactorSmell';

// === Listeners & UI ===
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';
import { LineSelectionManager } from './ui/LineSelection';

export function activate(context: vscode.ExtensionContext): void {
  // Load smell definitions
  loadSmells();

  // === Initialize Managers & Providers ===
  const smellsCacheManager = new SmellsCacheManager(context);
  const smellsViewProvider = new SmellsViewProvider(context);
  const metricsViewProvider = new MetricsViewProvider(context);
  const filterSmellsProvider = new FilterViewProvider(
    context,
    metricsViewProvider,
    smellsCacheManager,
    smellsViewProvider,
  );
  const refactoringDetailsViewProvider = new RefactoringDetailsViewProvider();

  // Restore cached statuses
  initializeStatusesFromCache(context, smellsCacheManager, smellsViewProvider);

  // === Register Tree Views ===
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
    vscode.window.createTreeView('ecooptimizer.refactorView', {
      treeDataProvider: refactoringDetailsViewProvider,
    }),
  );

  // Connect checkbox UI logic
  filterSmellsProvider.setTreeView(
    vscode.window.createTreeView('ecooptimizer.filterView', {
      treeDataProvider: filterSmellsProvider,
      showCollapseAll: true,
    }),
  );

  // Set workspace configuration context
  const workspaceConfigured = Boolean(
    context.workspaceState.get<string>('workspaceConfiguredPath'),
  );
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    workspaceConfigured,
  );

  // === Register Commands ===
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
      const filePath = fileItem?.resourceUri?.fsPath;
      if (!filePath) {
        vscode.window.showWarningMessage('No file selected or file path not found.');
        return;
      }
      detectSmellsFile(filePath, smellsViewProvider, smellsCacheManager);
    }),

    vscode.commands.registerCommand(
      'ecooptimizer.detectSmellsFolder',
      (folderItem) => {
        const folderPath = folderItem?.resourceUri?.fsPath;
        if (!folderPath) {
          vscode.window.showWarningMessage('No folder selected.');
          return;
        }
        detectSmellsFolder(folderPath, smellsViewProvider, smellsCacheManager);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.refactorSmell',
      (item: SmellTreeItem) => {
        const smell = item?.smell;
        if (!smell) {
          vscode.window.showErrorMessage('No smell found for this item.');
          return;
        }
        refactorSmell(smellsViewProvider, refactoringDetailsViewProvider, smell);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.openDiffEditor',
      (originalFilePath: string, refactoredFilePath: string) => {
        openDiffEditor(originalFilePath, refactoredFilePath);
      },
    ),
  );

  // Register filter-related commands
  registerFilterSmellCommands(context, filterSmellsProvider);

  // === Watch for workspace changes ===
  context.subscriptions.push(
    new WorkspaceModifiedListener(
      context,
      smellsCacheManager,
      smellsViewProvider,
      metricsViewProvider,
    ),
  );

  // === Register Line Selection Listener ===
  const lineSelectManager = new LineSelectionManager(smellsCacheManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      lineSelectManager.commentLine(event.textEditor);
    }),
  );
}

export function deactivate(): void {
  ecoOutput.appendLine('Deactivating Eco-Optimizer extension...');
}
