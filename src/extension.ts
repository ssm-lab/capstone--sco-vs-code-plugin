import * as vscode from 'vscode';
import path from 'path';

// === Output Channel ===
export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer');

// === Smell Linting ===
let smellLintingEnabled = false;

export function isSmellLintingEnabled(): boolean {
  return smellLintingEnabled;
}

// === Core Utilities ===
import { getNameByMessageId, loadSmells } from './utils/smellsData';
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
import { refactor } from './commands/refactor';
import { acceptRefactoring } from './commands/acceptRefactoring';
import { rejectRefactoring } from './commands/rejectRefactoring';
import { exportMetricsData } from './commands/exportMetricsData';

// === Listeners & UI ===
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';
import { LineSelectionManager } from './ui/LineSelection';
import { registerDiffEditor } from './utils/trackedDiffEditors';
import { initializeRefactorActionButtons } from './utils/refactorActionButtons';
import { HoverManager } from './ui/hoverManager';

export function activate(context: vscode.ExtensionContext): void {
  ecoOutput.appendLine('Initializing Eco-Optimizer extension...');

  // === Load Core Data ===
  loadSmells();

  // === Start periodic backend status checks ===
  checkServerStatus();
  setInterval(checkServerStatus, 50000);

  // === Initialize Refactor Action Buttons ===
  initializeRefactorActionButtons(context);

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
        refactor(smellsViewProvider, refactoringDetailsViewProvider, smell, context);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.refactorAllSmellsOfType',
      async (item: any) => {
        const filePath = item?.fullPath;
        if (!filePath) {
          vscode.window.showWarningMessage(
            'Unable to get file path for smell refactoring.',
          );
          return;
        }

        const cachedSmells = smellsCacheManager.getCachedSmells(filePath);
        if (!cachedSmells || cachedSmells.length === 0) {
          vscode.window.showInformationMessage('No smells detected in this file.');
          return;
        }

        ecoOutput.appendLine(
          `🟡 Found ${cachedSmells.length} smells in ${filePath}`,
        );

        const uniqueMessageIds = new Set<string>();
        for (const smell of cachedSmells) {
          uniqueMessageIds.add(smell.messageId);
        }

        const quickPickItems: vscode.QuickPickItem[] = Array.from(
          uniqueMessageIds,
        ).map((id) => {
          const name = getNameByMessageId(id) ?? id;
          return {
            label: name,
            description: id,
          };
        });

        const selected = await vscode.window.showQuickPick(quickPickItems, {
          title: 'Select a smell type to refactor',
          placeHolder: 'Choose the type of smell you want to refactor',
          matchOnDescription: false,
          matchOnDetail: false,
          ignoreFocusOut: false,
          canPickMany: false,
        });

        if (selected) {
          const selectedMessageId = selected.description;
          const firstSmell = cachedSmells.find(
            (smell) => smell.messageId === selectedMessageId,
          );

          if (!firstSmell) {
            vscode.window.showWarningMessage(
              'No smells found for the selected type.',
            );
            return;
          }

          ecoOutput.appendLine(
            `🔁 Triggering refactorAllSmellsOfType for: ${selectedMessageId}`,
          );

          await refactor(
            smellsViewProvider,
            refactoringDetailsViewProvider,
            firstSmell,
            context,
            true, // isRefactorAllOfType
          );
        }
      },
    ),

    vscode.commands.registerCommand('ecooptimizer.acceptRefactoring', async () => {
      await acceptRefactoring(
        refactoringDetailsViewProvider,
        metricsViewProvider,
        smellsCacheManager,
        smellsViewProvider,
      );
    }),

    vscode.commands.registerCommand('ecooptimizer.rejectRefactoring', async () => {
      await rejectRefactoring(refactoringDetailsViewProvider, smellsViewProvider);
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

  // == Hover Manager ===
  const hoverManager = new HoverManager(smellsCacheManager);
  hoverManager.register(context);

  // === Smell Linting ===
  function updateSmellLintingContext() {
    vscode.commands.executeCommand(
      'setContext',
      'ecooptimizer.smellLintingEnabled',
      smellLintingEnabled,
    );
  }

  const toggleSmellLinting = () => {
    smellLintingEnabled = !smellLintingEnabled;
    updateSmellLintingContext();
    const msg = smellLintingEnabled
      ? 'Smell linting enabled'
      : 'Smell linting disabled';
    vscode.window.showInformationMessage(msg);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer.toggleSmellLintingOn',
      toggleSmellLinting,
    ),
    vscode.commands.registerCommand(
      'ecooptimizer.toggleSmellLintingOff',
      toggleSmellLinting,
    ),
  );

  ecoOutput.appendLine('Eco-Optimizer extension activated successfully');
}

export function deactivate(): void {
  ecoOutput.appendLine('Extension deactivated');
}
