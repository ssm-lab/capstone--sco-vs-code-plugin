import * as vscode from 'vscode';
import path from 'path';

// === Output Channel ===
export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer');

// === Core Utilities ===
import { loadSmells } from './utils/smellsData';
import { initializeStatusesFromCache } from './utils/initializeStatusesFromCache';
import { envConfig } from './utils/envConfig';
import { checkServerStatus } from './api/backend';

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
import { acceptRefactoring } from './commands/acceptRefactoring';
import { rejectRefactoring } from './commands/rejectRefactoring';
import { exportMetricsData } from './commands/exportMetricsData';

// === Listeners & UI ===
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';
import { LineSelectionManager } from './ui/LineSelection';
import { registerDiffEditor } from './utils/trackedDiffEditors';

export function activate(context: vscode.ExtensionContext): void {
  ecoOutput.appendLine('Initializing Eco-Optimizer extension...');

  // === Status Bar Buttons for Refactoring ===
  const acceptRefactoringItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  acceptRefactoringItem.text = '$(check) Accept Refactoring';
  acceptRefactoringItem.command = 'ecooptimizer.acceptRefactoring';
  acceptRefactoringItem.tooltip = 'Accept and apply the suggested refactoring';
  acceptRefactoringItem.hide();

  const rejectRefactoringItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  rejectRefactoringItem.text = '$(x) Reject Refactoring';
  rejectRefactoringItem.command = 'ecooptimizer.rejectRefactoring';
  rejectRefactoringItem.tooltip = 'Reject the suggested refactoring';
  rejectRefactoringItem.hide();

  context.subscriptions.push(acceptRefactoringItem, rejectRefactoringItem);

  vscode.commands.executeCommand('setContext', 'refactoringInProgress', false);

  vscode.commands.registerCommand('ecooptimizer.showRefactorStatusBar', () => {
    acceptRefactoringItem.show();
    rejectRefactoringItem.show();
  });

  vscode.commands.registerCommand('ecooptimizer.hideRefactorStatusBar', () => {
    acceptRefactoringItem.hide();
    rejectRefactoringItem.hide();
  });

  // === Load Core Data ===
  loadSmells();

  // === Start periodic backend status checks ===
  checkServerStatus();
  setInterval(checkServerStatus, 10000);

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

  filterSmellsProvider.setTreeView(
    vscode.window.createTreeView('ecooptimizer.filterView', {
      treeDataProvider: filterSmellsProvider,
      showCollapseAll: true,
    }),
  );

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
          'Workspace configuration and analysis data have been reset.',
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
        vscode.window.showWarningMessage('Please select a file to analyze.');
        return;
      }
      detectSmellsFile(filePath, smellsViewProvider, smellsCacheManager);
    }),

    vscode.commands.registerCommand(
      'ecooptimizer.detectSmellsFolder',
      (folderItem) => {
        const folderPath = folderItem?.resourceUri?.fsPath;
        if (!folderPath) {
          vscode.window.showWarningMessage('Please select a folder to analyze.');
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
          vscode.window.showErrorMessage('No code smell detected for this item.');
          return;
        }
        refactorSmell(
          smellsViewProvider,
          refactoringDetailsViewProvider,
          smell,
          context,
        );
      },
    ),

    vscode.commands.registerCommand('ecooptimizer.acceptRefactoring', async () => {
      await acceptRefactoring(
        refactoringDetailsViewProvider,
        metricsViewProvider,
        smellsCacheManager,
        smellsViewProvider,
        context,
      );
    }),

    vscode.commands.registerCommand('ecooptimizer.rejectRefactoring', async () => {
      await rejectRefactoring(refactoringDetailsViewProvider, context);
    }),

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

        registerDiffEditor(originalUri, refactoredUri);
      },
    ),

    vscode.commands.registerCommand('ecooptimizer.exportMetricsData', () => {
      exportMetricsData(context);
    }),

    vscode.commands.registerCommand('ecooptimizer.metricsView.refresh', () => {
      metricsViewProvider.refresh();
    }),

    vscode.commands.registerCommand('ecooptimizer.clearMetricsData', () => {
      vscode.window
        .showWarningMessage(
          'Clear all metrics data? This cannot be undone unless you have exported it.',
          { modal: true },
          'Clear',
          'Cancel',
        )
        .then((selection) => {
          if (selection === 'Clear') {
            context.workspaceState.update(
              envConfig.WORKSPACE_METRICS_DATA!,
              undefined,
            );
            metricsViewProvider.refresh();
            vscode.window.showInformationMessage('Metrics data cleared.');
          }
        });
    }),
  );

  // === Register Filter UI Commands ===
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

  // === Line Selection ===
  const lineSelectManager = new LineSelectionManager(smellsCacheManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      lineSelectManager.commentLine(event.textEditor);
    }),
  );

  ecoOutput.appendLine('Eco-Optimizer extension activated successfully');
}

export function deactivate(): void {
  ecoOutput.appendLine('Extension deactivated');
}
