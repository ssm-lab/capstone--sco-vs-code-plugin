import { envConfig } from './utils/envConfig';
import * as vscode from 'vscode';

import { detectSmells } from './commands/detectSmells';
import {
  refactorSelectedSmell,
  refactorAllSmellsOfType,
} from './commands/refactorSmell';
import { refactorAllSmellType } from './commands/refactorAllSmellsOfType';
import { wipeWorkCache } from './commands/wipeWorkCache';
import { stopWatchingLogs } from './commands/showLogs';
import { ContextManager } from './context/contextManager';
import {
  getEnabledSmells,
  handleSmellFilterUpdate,
} from './utils/handleSmellSettings';
import { updateHash } from './utils/hashDocs';
import { RefactorSidebarProvider } from './ui/refactorView';
import { handleEditorChanges } from './utils/handleEditorChange';
import { LineSelectionManager } from './ui/lineSelectionManager';
import { checkServerStatus } from './api/backend';
import { serverStatus } from './utils/serverStatus';


export const globalData: { contextManager?: ContextManager } = {
  contextManager: undefined,
};

export function activate(context: vscode.ExtensionContext): void {
  console.log('Eco: Refactor Plugin Activated Successfully');
  const contextManager = new ContextManager(context);

  globalData.contextManager = contextManager;

  // Show the settings popup if needed
  // TODO: Setting to re-enable popup if disabled
  const settingsPopupChoice =
    contextManager.getGlobalData<boolean>('showSettingsPopup');

  if (settingsPopupChoice === undefined || settingsPopupChoice) {
    showSettingsPopup();
  }

  console.log('environment variables:', envConfig);

  checkServerStatus();

  let smellsData = contextManager.getWorkspaceData(envConfig.SMELL_MAP_KEY!) || {};
  contextManager.setWorkspaceData(envConfig.SMELL_MAP_KEY!, smellsData);

  let fileHashes =
    contextManager.getWorkspaceData(envConfig.FILE_CHANGES_KEY!) || {};
  contextManager.setWorkspaceData(envConfig.FILE_CHANGES_KEY!, fileHashes);

  // Check server health every 10 seconds
  setInterval(checkServerStatus, 10000);

  // ===============================================================
  // REGISTER COMMANDS
  // ===============================================================

  // Detect Smells Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.detectSmells',
      async () => {
        console.log('Eco: Detect Smells Command Triggered');
        detectSmells(contextManager);
      },
    ),
  );

  // Refactor Selected Smell Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.refactorSmell',
      () => {
        if (serverStatus.getStatus() === 'up') {
          console.log('Eco: Refactor Selected Smell Command Triggered');
          refactorSelectedSmell(contextManager);
        } else {
          vscode.window.showWarningMessage('Action blocked: Server is down.');
        }
      },
    ),
  );

  // Refactor All Smells of Type Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.refactorAllSmellsOfType',
      async (smellId: string) => {
        if (serverStatus.getStatus() === 'up') {
          console.log(
            `Eco: Refactor All Smells of Type Command Triggered for ${smellId}`,
          );
          refactorAllSmellsOfType(contextManager, smellId);
        } else {
          vscode.window.showWarningMessage('Action blocked: Server is down.');
        }
      },
    ),
  );

  // Wipe Cache Command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.wipeWorkCache',
      async () => {
        console.log('Eco: Wipe Work Cache Command Triggered');
        vscode.window.showInformationMessage(
          'Eco: Manually wiping workspace memory... ✅',
        );
        await wipeWorkCache(contextManager, 'manual');
      },
    ),
  );

  // ===============================================================
  // REGISTER VIEWS
  // ===============================================================

  const refactorProvider = new RefactorSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      RefactorSidebarProvider.viewType,
      refactorProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.showRefactorSidebar',
      () => refactorProvider.updateView(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.pauseRefactorSidebar',
      () => refactorProvider.pauseView(),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'ecooptimizer-vs-code-plugin.clearRefactorSidebar',
      () => refactorProvider.clearView(),
    ),
  );

  // ===============================================================
  // ADD LISTENERS
  // ===============================================================

  // Register a listener for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      handleConfigurationChange(event);
    }),
  );

  vscode.window.onDidChangeVisibleTextEditors(async (editors) => {
    handleEditorChanges(contextManager, editors);
  });

  // Adds comments to lines describing the smell
  const lineSelectManager = new LineSelectionManager(contextManager);
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      console.log('Eco: Detected line selection event');
      lineSelectManager.commentLine(event.textEditor);
    }),
  );

  // Updates directory of file states (for checking if modified)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      console.log('Eco: Detected document saved event');
      await updateHash(contextManager, document);
    }),
  );

  // Handles case of documents already being open on VS Code open
  vscode.window.visibleTextEditors.forEach(async (editor) => {
    if (editor.document) {
      await updateHash(contextManager, editor.document);
    }
  });

  // Initializes first state of document when opened while extension is active
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      console.log('Eco: Detected document opened event');
      await updateHash(contextManager, document);
    }),
  );

  // ===============================================================
  // HANDLE SMELL FILTER CHANGES
  // ===============================================================

  let previousSmells = getEnabledSmells();
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('ecooptimizer.enableSmells')) {
      console.log('Eco: Smell preferences changed! Wiping cache.');
      handleSmellFilterUpdate(previousSmells, contextManager);
      previousSmells = getEnabledSmells();
    }
  });
}

function showSettingsPopup(): void {
  // Check if the required settings are already configured
  const config = vscode.workspace.getConfiguration('ecooptimizer-vs-code-plugin');
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
          globalData.contextManager!.setGlobalData('showSettingsPopup', false);
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
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.projectWorkspacePath') ||
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.unitTestCommand') ||
    event.affectsConfiguration('ecooptimizer-vs-code-plugin.logsOutputPath')
  ) {
    // Display a warning message about changing critical settings
    vscode.window.showWarningMessage(
      'You have changed a critical setting for the EcoOptimizer plugin. Ensure the new value is valid and correct for optimal functionality.',
    );
  }
}

export function deactivate(): void {
  console.log('Eco: Deactivating Plugin - Stopping Log Watching');
  stopWatchingLogs();
}
