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
import { serverStatus } from './utils/serverStatus';
import {
  refactorAllSmellsOfType,
  refactorSelectedSmell,
} from './commands/refactorSmell';
import { LogManager } from './commands/showLogs';
import { LineSelectionManager } from './ui/lineSelectionManager';

let logManager: LogManager;

/**
 * Activates the Eco-Optimizer extension and registers all necessary commands, providers, and listeners.
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Activating Eco-Optimizer extension...');

  // Iniiialize the log manager
  logManager = new LogManager(context);

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

  // Refactor Selected Smell Command
  context.subscriptions.push(
    vscode.commands.registerCommand('ecooptimizer.refactorSmell', () => {
      if (serverStatus.getStatus() === 'up') {
        console.log('Eco: Refactor Selected Smell Command Triggered');
        refactorSelectedSmell(context, smellsCacheManager);
      } else {
        vscode.window.showWarningMessage('Action blocked: Server is down.');
      }
    }),
  );

  // Refactor All Smells of Type Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer.refactorAllSmellsOfType',
      async (smellId: string) => {
        if (serverStatus.getStatus() === 'up') {
          console.log(
            `Eco: Refactor All Smells of Type Command Triggered for ${smellId}`,
          );
          refactorAllSmellsOfType(context, smellsCacheManager, smellId);
        } else {
          vscode.window.showWarningMessage('Action blocked: Server is down.');
        }
      },
    ),
  );

  // Register the "Toggle Smell Auto Lint" command.
  // TODO: Uncomment this block after implementing smell linting
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('ecooptimizer.toggleSmellLinting', () => {
  //     console.log('Eco: Toggle Smell Linting Command Triggered');
  //     toggleSmellLinting(contextManager);
  //   }),
  // );

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

  // Adds comments to lines describing the smell
  const lineSelectManager = new LineSelectionManager(smellsCacheManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      console.log('Eco: Detected line selection event');
      lineSelectManager.commentLine(event.textEditor);
    }),
  );

  // Register a listener for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      handleConfigurationChange(event);
    }),
  );

  // Listen for editor changes
  // TODO: Uncomment this block after implementing smell linting
  // context.subscriptions.push(
  //   vscode.window.onDidChangeActiveTextEditor(async (editor) => {
  //     if (editor) {
  //       console.log('Eco: Detected editor change event');

  //       // Check if the file is a Python file
  //       if (editor.document.languageId === 'python') {
  //         console.log('Eco: Active file is a Python file.');

  //         // Check if smell linting is enabled
  //         const isEnabled = context.workspaceState.get<boolean>(
  //           envConfig.SMELL_LINTING_ENABLED_KEY,
  //           false,
  //         );
  //         if (isEnabled) {
  //           console.log('Eco: Smell linting is enabled. Detecting smells...');
  //           await detectSmells(contextManager);
  //         }
  //       }
  //     }
  //   }),
  // );

  // Register the file save listener to detect outdated files.
  const fileSaveListener = registerFileSaveListener(
    smellsCacheManager,
    smellsDisplayProvider,
  );
  context.subscriptions.push(fileSaveListener);

  // TODO: Setting to re-enable popup if disabled
  const settingsPopupChoice = context.globalState.get<boolean>('showSettingsPopup');

  if (settingsPopupChoice === undefined || settingsPopupChoice) {
    showSettingsPopup(context);
  }
}

function showSettingsPopup(context: vscode.ExtensionContext): void {
  // Check if the required settings are already configured
  const config = vscode.workspace.getConfiguration('ecooptimizer');
  const workspacePath = config.get<string>('projectWorkspacePath', '');
  const logsOutputPath = config.get<string>('logsOutputPath', '');
  const unitTestPath = config.get<string>('unitTestPath', '');

  // If settings are not configured, prompt the user to configure them
  if (!workspacePath || !logsOutputPath || !unitTestPath) {
    vscode.window
      .showInformationMessage(
        'Please configure the paths for your workspace and logs.',
        { modal: true },
        'Continue', // Button to open settings
        'Skip', // Button to dismiss
        'Never show this again',
      )
      .then((selection) => {
        if (selection === 'Continue') {
          // Open the settings page filtered to extension's settings
          vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'ecooptimizer',
          );
        } else if (selection === 'Skip') {
          // Inform user they can configure later
          vscode.window.showInformationMessage(
            'You can configure the paths later in the settings.',
          );
        } else if (selection === 'Never show this again') {
          context.globalState.update('showSettingsPopup', false);
          vscode.window.showInformationMessage(
            'You can re-enable this popup again in the settings.',
          );
        }
      });
  }
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
  // Check if any relevant setting was changed
  if (
    event.affectsConfiguration('ecooptimizer.projectWorkspacePath') ||
    event.affectsConfiguration('ecooptimizer.logsOutputPath')
  ) {
    // Display a warning message about changing critical settings
    vscode.window.showWarningMessage(
      'You have changed a critical setting for the EcoOptimizer plugin. Ensure the new value is valid and correct for optimal functionality.',
    );
  }
}

/**
 * Deactivates the Eco-Optimizer extension.
 */
export function deactivate(): void {
  console.log('Deactivating Eco-Optimizer extension...');
  logManager.stopWatchingLogs();
}
