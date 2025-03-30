import * as vscode from 'vscode';
import path from 'path';

// let port: number;

// export function getApiPort(): number {
//   return port;
// }

// === Output Channel ===
export const ecoOutput = vscode.window.createOutputChannel('Eco-Optimizer', {
  log: true,
});

// === Smell Linting ===
let smellLintingEnabled = false;

export function isSmellLintingEnabled(): boolean {
  return smellLintingEnabled;
}

// === In-Built ===
import { existsSync, promises } from 'fs';

// === Core Utilities ===
import { envConfig } from './utils/envConfig';
import { getNameByMessageId, loadSmells } from './utils/smellsData';
import { initializeStatusesFromCache } from './utils/initializeStatusesFromCache';
import { checkServerStatus } from './api/backend';

// === Context & View Providers ===
import { SmellsCacheManager } from './context/SmellsCacheManager';
import {
  SmellsViewProvider,
  SmellTreeItem,
  TreeItem,
} from './providers/SmellsViewProvider';
import { MetricsViewProvider } from './providers/MetricsViewProvider';
import { FilterViewProvider } from './providers/FilterViewProvider';
import { RefactoringDetailsViewProvider } from './providers/RefactoringDetailsViewProvider';

// === Commands ===
import { configureWorkspace } from './commands/configureWorkspace';
import { resetConfiguration } from './commands/resetConfiguration';
import {
  detectSmellsFile,
  detectSmellsFolder,
} from './commands/detection/detectSmells';
import { registerFilterSmellCommands } from './commands/views/filterSmells';
import { jumpToSmell } from './commands/views/jumpToSmell';
import { wipeWorkCache } from './commands/detection/wipeWorkCache';
import { refactor, startRefactorSession } from './commands/refactor/refactor';
import { acceptRefactoring } from './commands/refactor/acceptRefactoring';
import { rejectRefactoring } from './commands/refactor/rejectRefactoring';
import { exportMetricsData } from './commands/views/exportMetricsData';

// === Listeners & UI ===
import { WorkspaceModifiedListener } from './listeners/workspaceModifiedListener';
import { FileHighlighter } from './ui/fileHighlighter';
import { LineSelectionManager } from './ui/lineSelectionManager';
import { HoverManager } from './ui/hoverManager';
import {
  closeAllTrackedDiffEditors,
  registerDiffEditor,
} from './utils/trackedDiffEditors';
import { initializeRefactorActionButtons } from './utils/refactorActionButtons';
import { LogManager } from './commands/showLogs';

// === Backend Server ===
// import { ServerProcess } from './lib/processManager';
// import { DependencyManager } from './lib/dependencyManager';

let backendLogManager: LogManager;
// let server: ServerProcess;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  ecoOutput.info('Initializing Eco-Optimizer extension...');
  console.log('Initializing Eco-Optimizer extension...');

  // === Install and Run Backend Server ====
  // if (!(await DependencyManager.ensureDependencies(context))) {
  //   vscode.window.showErrorMessage(
  //     'Cannot run the extension without the ecooptimizer server. Deactivating extension.',
  //   );
  // }

  // server = new ServerProcess(context);
  // try {
  //   port = await server.start();

  //   console.log(`Server started on port ${port}`);
  // } catch (error) {
  //   vscode.window.showErrorMessage(`Failed to start server: ${error}`);
  // }

  backendLogManager = new LogManager(context);

  // === Load Core Data ===
  loadSmells();

  // === Start periodic backend status checks ===
  checkServerStatus();
  setInterval(checkServerStatus, 10000);

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

  const workspaceConfigured = context.workspaceState.get<string>(
    envConfig.WORKSPACE_CONFIGURED_PATH!,
  );
  vscode.commands.executeCommand(
    'setContext',
    'workspaceState.workspaceConfigured',
    Boolean(workspaceConfigured),
  );

  // === Register Commands ===
  context.subscriptions.push(
    // vscode.commands.registerCommand('ecooptimizer.startServer', async () => {
    //   port = await server.start();
    // }),
    // vscode.commands.registerCommand('ecooptimizer.stopServer', async () => {
    //   server.dispose();
    // }),
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

    vscode.commands.registerCommand(
      'ecooptimizer.detectSmellsFile',
      async (fileItem: TreeItem) => {
        let filePath: string;
        if (!fileItem) {
          const allPythonFiles: vscode.QuickPickItem[] = [];
          const folderPath = workspaceConfigured;

          if (!folderPath) {
            vscode.window.showWarningMessage('No workspace configured.');
            return;
          }

          const gatherPythonFiles = async (dirPath: string): Promise<void> => {
            const files = await vscode.workspace.fs.readDirectory(
              vscode.Uri.file(dirPath),
            );
            for (const [name, type] of files) {
              const fullPath = path.join(dirPath, name);
              if (type === vscode.FileType.File && name.endsWith('.py')) {
                const relativePath = path.relative(folderPath, fullPath);
                allPythonFiles.push({
                  label: `${name}`,
                  description: `${path.dirname(relativePath) === '.' ? undefined : path.dirname(relativePath)}`,
                  iconPath: new vscode.ThemeIcon('symbol-file'),
                });
              } else if (type === vscode.FileType.Directory) {
                await gatherPythonFiles(fullPath); // Recursively gather Python files in subdirectories
              }
            }
          };

          const currentFile = vscode.window.activeTextEditor?.document.fileName;
          if (currentFile && currentFile.endsWith('.py')) {
            const relativePath = path.relative(folderPath, currentFile);
            allPythonFiles.push({
              label: `${path.basename(currentFile)}`,
              description: `${path.dirname(relativePath) === '.' ? undefined : path.dirname(relativePath)}`,
              detail: 'Current File',
              iconPath: new vscode.ThemeIcon('symbol-file'),
            });

            allPythonFiles.push({
              label: '───────────────',
              kind: vscode.QuickPickItemKind.Separator,
            });
          }

          await gatherPythonFiles(folderPath);

          if (allPythonFiles.length === 0) {
            vscode.window.showWarningMessage(
              'No Python files found in the workspace.',
            );
            return;
          }

          const selectedFile = await vscode.window.showQuickPick(allPythonFiles, {
            title: 'Select a Python file to analyze',
            placeHolder: 'Choose a Python file from the workspace',
            canPickMany: false,
          });

          if (!selectedFile) {
            vscode.window.showWarningMessage('No file selected.');
            return;
          }

          filePath = path.join(
            folderPath,
            selectedFile.description!,
            selectedFile.label,
          );
        } else {
          if (!(fileItem instanceof vscode.TreeItem)) {
            vscode.window.showWarningMessage('Invalid file item selected.');
            return;
          }
          filePath = fileItem.resourceUri!.fsPath;
          if (!filePath) {
            vscode.window.showWarningMessage('Please select a file to analyze.');
            return;
          }
        }
        detectSmellsFile(filePath, smellsViewProvider, smellsCacheManager);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.detectSmellsFolder',
      async (folderItem: vscode.TreeItem) => {
        let folderPath: string;
        if (!folderItem) {
          if (!workspaceConfigured) {
            vscode.window.showWarningMessage('No workspace configured.');
            return;
          }

          const allDirectories: vscode.QuickPickItem[] = [];
          const directoriesWithPythonFiles = new Set<string>();

          const gatherDirectories = async (
            dirPath: string,
            relativePath = '',
          ): Promise<boolean> => {
            const files = await vscode.workspace.fs.readDirectory(
              vscode.Uri.file(dirPath),
            );
            let hasPythonFile = false;

            for (const [name, type] of files) {
              const fullPath = path.join(dirPath, name);
              const newRelativePath = path.join(relativePath, name);
              if (type === vscode.FileType.File && name.endsWith('.py')) {
                hasPythonFile = true;
              } else if (type === vscode.FileType.Directory) {
                const subDirHasPythonFile = await gatherDirectories(
                  fullPath,
                  newRelativePath,
                );
                if (subDirHasPythonFile) {
                  hasPythonFile = true;
                }
              }
            }

            if (hasPythonFile) {
              directoriesWithPythonFiles.add(dirPath);
              const isDirectChild = relativePath.split(path.sep).length === 1;
              allDirectories.push({
                label: `${path.basename(dirPath)}`,
                description: isDirectChild ? undefined : path.dirname(relativePath),
                iconPath: new vscode.ThemeIcon('folder'),
              });
            }

            return hasPythonFile;
          };

          await gatherDirectories(workspaceConfigured);

          if (allDirectories.length === 0) {
            vscode.window.showWarningMessage(
              'No directories with Python files found in the workspace.',
            );
            return;
          }

          const selectedDirectory = await vscode.window.showQuickPick(
            allDirectories,
            {
              title: 'Select a directory to analyze',
              placeHolder: 'Choose a directory with Python files from the workspace',
              canPickMany: false,
            },
          );

          if (!selectedDirectory) {
            vscode.window.showWarningMessage('No directory selected.');
            return;
          }

          folderPath = path.join(
            workspaceConfigured,
            selectedDirectory.description
              ? path.join(
                  selectedDirectory.description,
                  path.basename(selectedDirectory.label),
                )
              : path.basename(selectedDirectory.label),
          );
        } else {
          if (!(folderItem instanceof vscode.TreeItem)) {
            vscode.window.showWarningMessage('Invalid folder item selected.');
            return;
          }
          folderPath = folderItem.resourceUri!.fsPath;
        }
        detectSmellsFolder(folderPath, smellsViewProvider, smellsCacheManager);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.refactorSmell',
      (item: SmellTreeItem | Smell) => {
        let smell: Smell;
        if (item instanceof SmellTreeItem) {
          smell = item.smell;
        } else {
          smell = item;
        }
        if (!smell) {
          vscode.window.showErrorMessage('No code smell detected for this item.');
          return;
        }
        refactor(smellsViewProvider, refactoringDetailsViewProvider, smell, context);
      },
    ),

    vscode.commands.registerCommand(
      'ecooptimizer.refactorAllSmellsOfType',
      async (item: TreeItem | { fullPath: string; smellType: string }) => {
        let filePath = item.fullPath;
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

        ecoOutput.info(`🟡 Found ${cachedSmells.length} smells in ${filePath}`);

        const uniqueMessageIds = new Set<string>();
        for (const smell of cachedSmells) {
          uniqueMessageIds.add(smell.messageId);
        }

        let selectedSmell: string;
        if (item instanceof TreeItem) {
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

          if (!selected) {
            return;
          }
          selectedSmell = selected.description!;
        } else {
          selectedSmell = item.smellType;
        }

        const firstSmell = cachedSmells.find(
          (smell) => smell.messageId === selectedSmell,
        );

        if (!firstSmell) {
          vscode.window.showWarningMessage('No smells found for the selected type.');
          return;
        }

        ecoOutput.info(
          `🔁 Triggering refactorAllSmellsOfType for: ${selectedSmell}`,
        );

        await refactor(
          smellsViewProvider,
          refactoringDetailsViewProvider,
          firstSmell,
          context,
          true, // isRefactorAllOfType
        );
      },
    ),

    vscode.commands.registerCommand('ecooptimizer.acceptRefactoring', async () => {
      await acceptRefactoring(
        context,
        refactoringDetailsViewProvider,
        metricsViewProvider,
        smellsCacheManager,
        smellsViewProvider,
      );
    }),

    vscode.commands.registerCommand('ecooptimizer.rejectRefactoring', async () => {
      await rejectRefactoring(
        context,
        refactoringDetailsViewProvider,
        smellsViewProvider,
      );
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

  // === File Highlighting ===
  const fileHighlighter = FileHighlighter.getInstance(smellsCacheManager);

  fileHighlighter.updateHighlightsForVisibleEditors();

  // === Line Selection ===
  const lineSelectManager = new LineSelectionManager(smellsCacheManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      const textEditor = event.textEditor;
      if (!textEditor.document.fileName.endsWith('.py')) {
        return;
      }
      lineSelectManager.commentLine(textEditor);
    }),
  );

  // == Hover Manager ===
  const hoverManager = new HoverManager(smellsCacheManager);
  hoverManager.register(context);

  // === Smell Linting ===
  const updateSmellLintingContext = (): void => {
    vscode.commands.executeCommand(
      'setContext',
      'ecooptimizer.smellLintingEnabled',
      smellLintingEnabled,
    );
  };

  const lintActiveEditors = (): void => {
    for (const editor of vscode.window.visibleTextEditors) {
      const filePath = editor.document.uri.fsPath;
      detectSmellsFile(filePath, smellsViewProvider, smellsCacheManager);
      ecoOutput.info(
        `[WorkspaceListener] Smell linting is ON — auto-detecting smells for ${filePath}`,
      );
    }
  };

  const toggleSmellLinting = (): void => {
    smellLintingEnabled = !smellLintingEnabled;
    updateSmellLintingContext();
    const msg = smellLintingEnabled
      ? 'Smell linting enabled'
      : 'Smell linting disabled';
    lintActiveEditors();
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

  // === File View Change Listner ===
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      fileHighlighter.updateHighlightsForVisibleEditors();

      if (smellLintingEnabled) {
        lintActiveEditors();
      }
    }),
  );

  const cleanPastSessionArtifacts = async (): Promise<void> => {
    const pastData = context.workspaceState.get<RefactorArtifacts>(
      envConfig.UNFINISHED_REFACTORING!,
    );

    if (pastData) {
      const tempDir = pastData.refactoredData.tempDir;

      try {
        const tempDirExists = existsSync(tempDir);

        if (tempDirExists) {
          const userChoice = await vscode.window.showWarningMessage(
            'A previous refactoring session was detected. Would you like to continue or discard it?',
            { modal: true },
            'Continue',
            'Discard',
          );

          if (userChoice === 'Discard') {
            await promises.rm(tempDir, { recursive: true, force: true });

            context.workspaceState.update(
              envConfig.UNFINISHED_REFACTORING!,
              undefined,
            );

            closeAllTrackedDiffEditors();
          } else if (userChoice === 'Continue') {
            ecoOutput.info('Resuming previous refactoring session...');
            startRefactorSession(
              pastData.smell,
              pastData.refactoredData,
              refactoringDetailsViewProvider,
            );
            return;
          }
        }
      } catch (error) {
        ecoOutput.error(`Error handling past refactoring session: ${error}`);
        context.workspaceState.update(envConfig.UNFINISHED_REFACTORING!, undefined);
      }
    }
  };

  cleanPastSessionArtifacts();

  // if (!port) {
  //   try {
  //     port = await server.start();

  //     console.log(`Server started on port ${port}`);
  //   } catch (error) {
  //     vscode.window.showErrorMessage(`Failed to start server: ${error}`);
  //   }
  // }

  ecoOutput.info('Eco-Optimizer extension activated successfully');
  console.log('Eco-Optimizer extension activated successfully');
}

export function deactivate(): void {
  ecoOutput.info('Extension deactivated');
  console.log('Extension deactivated');

  // server.dispose();
  backendLogManager.stopWatchingLogs();
  ecoOutput.dispose();
}
